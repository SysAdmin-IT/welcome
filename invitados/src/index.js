// Worker "welcome-invitados"
// Está protegido por Cloudflare Access (código por correo). Cuando Access deja pasar a alguien,
// este Worker valida el token de Access y le emite al sitio principal un pase firmado de 2 minutos.

const enc = new TextEncoder();

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function bytesToB64url(bytes) {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let jwksCache = { at: 0, keys: [] };
async function getKeys(teamDomain) {
  if (Date.now() - jwksCache.at < 10 * 60 * 1000 && jwksCache.keys.length) return jwksCache.keys;
  const r = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  const d = await r.json();
  jwksCache = { at: Date.now(), keys: d.keys || [] };
  return jwksCache.keys;
}

// Verifica el JWT de Cloudflare Access (RS256)
async function verifyAccessJwt(token, env) {
  const [h, p, s] = token.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const team = env.TEAM_DOMAIN.replace(/\/+$/, "");
  const jwk = (await getKeys(team)).find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== "RS256") throw new Error("Clave desconocida");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error("Firma inválida");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.POLICY_AUD)) throw new Error("Audiencia inválida");
  if (payload.iss !== team) throw new Error("Emisor inválido");
  if (!(payload.exp > Date.now() / 1000)) throw new Error("Token vencido");
  if (!payload.email) throw new Error("Sin correo");
  return payload;
}

async function signPass(obj, secret) {
  if (!secret || secret.length < 16) throw new Error("GUEST_LINK_SECRET ausente");
  const payload = bytesToB64url(enc.encode(JSON.stringify(obj)));
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${bytesToB64url(sig)}`;
}

function page(title, msg, status) {
  return new Response(
    `<!DOCTYPE html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui;background:#f3f6f9;color:#1d2b3a;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="max-width:440px;background:#fff;border-radius:14px;padding:24px;text-align:center"><h1 style="font-size:1.2rem">${title}</h1><p>${msg}</p></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

const configured = (v) => v && !/PEGAR|TU-EQUIPO/.test(v);

// Obtiene el correo verificado por Cloudflare Access.
// 1) Modo nuevo (pestaña "Access" del Worker): Cloudflare valida antes y entrega ctx.access.
// 2) Modo clásico (workers.dev / aplicación self-hosted): se valida el JWT con TEAM_DOMAIN y POLICY_AUD.
async function verifiedEmail(request, env, ctx) {
  if (ctx && ctx.access) {
    const identity = await ctx.access.getIdentity();
    if (identity && identity.email) return identity.email;
  }
  if (configured(env.TEAM_DOMAIN) && configured(env.POLICY_AUD)) {
    const token = request.headers.get("Cf-Access-Jwt-Assertion");
    if (token) return (await verifyAccessJwt(token, env)).email;
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const missing = ["GUEST_LINK_SECRET", "MAIN_URL"].filter((k) => !env[k]);
    if (missing.length) return page("Falta configuración", `Faltan variables: ${missing.join(", ")}`, 500);

    let email = null;
    try {
      email = await verifiedEmail(request, env, ctx);
    } catch (e) {
      email = null;
    }
    if (!email) {
      return page("Acceso denegado", "No se pudo verificar tu identidad. Este sitio tiene que estar protegido por Cloudflare Access.", 403);
    }

    const pass = await signPass(
      { e: String(email).toLowerCase(), x: Math.floor(Date.now() / 1000) + 120 },
      env.GUEST_LINK_SECRET
    );
    const main = env.MAIN_URL.replace(/\/+$/, "");
    return Response.redirect(`${main}/auth/guest-callback?t=${encodeURIComponent(pass)}`, 302);
  },
};
