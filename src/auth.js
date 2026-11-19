// Inicio de sesión: Microsoft Entra ID (empleados) y pase de invitado (Cloudflare Access).
import { sign, verify, randomString, sha256b64url, b64urlDecode } from "./crypto.js";
import { normEmail, isCorporate, isGuest, corporateDomain } from "./store.js";

const SESSION_COOKIE = "dm_sess";
const OIDC_COOKIE = "dm_oidc";
const SESSION_HOURS = 12;

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function readCookie(request, name) {
  const h = request.headers.get("Cookie") || "";
  for (const part of h.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// ---------- Sesión ----------
export async function getSession(request, env) {
  const s = await verify(readCookie(request, SESSION_COOKIE), env.SESSION_SECRET);
  if (!s || !s.e) return null;
  // Empleado: solo dominio corporativo. Invitado: tiene que seguir en la lista.
  if (s.k === "emp" && isCorporate(env, s.e)) return { email: s.e, kind: "emp" };
  if (s.k === "guest" && (await isGuest(env, s.e))) return { email: s.e, kind: "guest" };
  return null;
}

async function sessionCookie(env, email, kind) {
  const token = await sign({ e: email, k: kind, x: Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600 }, env.SESSION_SECRET);
  return cookie(SESSION_COOKIE, token, SESSION_HOURS * 3600);
}

export function logoutCookie() {
  return cookie(SESSION_COOKIE, "", 0);
}

function safeReturn(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

// ---------- Entra ID (OpenID Connect, código + PKCE) ----------
// ENTRA_AUTHORITY solo se cambia para pruebas locales.
function authority(env) {
  return (env.ENTRA_AUTHORITY || "https://login.microsoftonline.com").replace(/\/+$/, "");
}
function entraBase(env) {
  return `${authority(env)}/${env.ENTRA_TENANT_ID}/oauth2/v2.0`;
}

// Invitados B2B: modo "entra" (por defecto) o "cloudflare" (Access con código).
export function guestMode(env) {
  return String(env.GUEST_MODE || "entra").toLowerCase() === "cloudflare" ? "cloudflare" : "entra";
}

// Correo real del usuario. En invitados B2B, preferred_username/upn pueden venir
// como "usuario_gmail.com#EXT#@tenant.onmicrosoft.com": en ese caso se usa el claim "email".
function emailFromClaims(c) {
  const candidates = [c.email, c.preferred_username, c.upn, c.unique_name];
  for (const v of candidates) {
    const e = normEmail(v);
    if (e && e.includes("@") && !e.includes("#ext#")) return e;
  }
  return "";
}

export async function startEntraLogin(request, env) {
  const url = new URL(request.url);
  const state = randomString(16);
  const nonce = randomString(16);
  const verifier = randomString(32);
  const ret = safeReturn(url.searchParams.get("return"));

  const params = new URLSearchParams({
    client_id: env.ENTRA_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${url.origin}/auth/callback`,
    response_mode: "query",
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: await sha256b64url(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  const tmp = await sign({ state, nonce, verifier, ret, x: Math.floor(Date.now() / 1000) + 600 }, env.SESSION_SECRET);
  return new Response(null, {
    status: 302,
    headers: { Location: `${entraBase(env)}/authorize?${params}`, "Set-Cookie": cookie(OIDC_COOKIE, tmp, 600) },
  });
}

export async function finishEntraLogin(request, env) {
  const url = new URL(request.url);
  const tmp = await verify(readCookie(request, OIDC_COOKIE), env.SESSION_SECRET);
  if (url.searchParams.get("error")) {
    return { error: `Microsoft devolvió un error: ${url.searchParams.get("error_description") || url.searchParams.get("error")}` };
  }
  if (!tmp || tmp.state !== url.searchParams.get("state")) return { error: "La sesión de inicio expiró. Volvé a intentar." };

  const res = await fetch(`${entraBase(env)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.ENTRA_CLIENT_ID,
      client_secret: env.ENTRA_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: url.searchParams.get("code") || "",
      redirect_uri: `${url.origin}/auth/callback`,
      code_verifier: tmp.verifier,
    }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.id_token) {
    const desc = String(tok.error_description || tok.error || `HTTP ${res.status}`);
    console.error("Entra token error:", res.status, desc);
    const code = (desc.match(/AADSTS\d+/) || [tok.error || `HTTP ${res.status}`])[0];
    const hints = {
      AADSTS7000215: "El secreto de la app es inválido: cargá el 'Value' (no el 'Secret ID') en ENTRA_CLIENT_SECRET.",
      AADSTS7000222: "El secreto de la app venció: creá uno nuevo en Entra y actualizá ENTRA_CLIENT_SECRET.",
      AADSTS50011: "La dirección de retorno no está registrada en Entra (plataforma Web).",
      AADSTS9002327: "La dirección de retorno está registrada como 'Single-page application'; tiene que ser 'Web'.",
      AADSTS700025: "La app está configurada como cliente público; poné 'Allow public client flows' en No.",
      AADSTS501481: "Falló la verificación PKCE; volvé a intentar.",
      AADSTS54005: "El código ya se usó; volvé a intentar.",
    };
    return { error: `No se pudo validar el inicio de sesión con Microsoft (${code}). ${hints[code] || ""}`.trim() };
  }

  // El id_token llega directo del endpoint de Microsoft por TLS con nuestro secreto,
  // igualmente validamos emisor, audiencia, inquilino, nonce y vencimiento.
  let claims;
  try {
    claims = JSON.parse(b64urlDecode(tok.id_token.split(".")[1]));
  } catch {
    return { error: "Respuesta de Microsoft inválida." };
  }
  const now = Math.floor(Date.now() / 1000);
  const tenant = String(env.ENTRA_TENANT_ID).toLowerCase();
  if (
    claims.aud !== env.ENTRA_CLIENT_ID ||
    String(claims.tid).toLowerCase() !== tenant ||
    String(claims.iss).toLowerCase() !== `${authority(env).toLowerCase()}/${tenant}/v2.0` ||
    claims.nonce !== tmp.nonce ||
    !(claims.exp > now)
  ) {
    return { error: "El token de Microsoft no es válido para esta aplicación." };
  }

  const email = emailFromClaims(claims);
  let kind = "";
  if (isCorporate(env, email)) {
    kind = "emp";
  } else if (guestMode(env) === "entra" && email && (await isGuest(env, email))) {
    kind = "guest"; // invitado B2B habilitado en el panel
  } else if (!email) {
    return { error: "Microsoft no envió el correo de la cuenta. Un administrador tiene que agregar el claim opcional 'email' en la app de Entra." };
  } else {
    return {
      error:
        guestMode(env) === "entra"
          ? `El correo ${email} no está habilitado o su acceso venció. Pedile acceso a un administrador.`
          : `Solo pueden ingresar con Microsoft las cuentas @${corporateDomain(env)}. Ingresaste como ${email}.`,
    };
  }

  const headers = new Headers({ Location: tmp.ret || "/" });
  headers.append("Set-Cookie", await sessionCookie(env, email, kind));
  headers.append("Set-Cookie", cookie(OIDC_COOKIE, "", 0));
  return { response: new Response(null, { status: 302, headers }) };
}

// ---------- Invitados: pase firmado que emite el Worker "welcome-invitados" ----------
export async function finishGuestLogin(request, env) {
  const url = new URL(request.url);
  const pass = await verify(url.searchParams.get("t"), env.GUEST_LINK_SECRET);
  if (!pass || !pass.e) return { error: "El enlace de verificación expiró. Volvé a intentar." };
  const email = normEmail(pass.e);
  if (isCorporate(env, email)) {
    return { error: "Las cuentas corporativas ingresan con Microsoft, no como invitado." };
  }
  if (!(await isGuest(env, email))) {
    return { error: `El correo ${email} no está habilitado o su acceso venció. Pedile acceso a un administrador.` };
  }
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", await sessionCookie(env, email, "guest"));
  return { response: new Response(null, { status: 302, headers }) };
}
