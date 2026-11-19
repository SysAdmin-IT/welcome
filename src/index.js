import { aliases } from "./seed.js";
import { randomString } from "./crypto.js";
import {
  getContent, saveContent, validateContent,
  getAdmins, saveAdmins, bootstrapAdmins, isAdmin,
  getGuests, saveGuests,
  listFiles, getFile, putFile, deleteFile,
  normEmail, isEmail, isCorporate, corporateDomain,
  MAX_GUESTS, MAX_FILE_BYTES,
} from "./store.js";
import { getSession, startEntraLogin, finishEntraLogin, finishGuestLogin, logoutCookie, guestMode } from "./auth.js";
import { inviteGuest, removeGuestFromEntra } from "./graph.js";
import { accessConfigured, syncGuestsToAccess, revokeGuestInAccess, discoverAccess } from "./access.js";
import { html, renderPage, renderLogin, renderMessage } from "./render.js";
import { adminHtml } from "./admin.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const APP_VERSION = "4.0";

const SECURITY_HEADERS = {
  "X-App-Version": APP_VERSION,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

function withSecurity(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!r.headers.has(k)) r.headers.set(k, v);
  return r;
}

// Botón "Tengo un acceso de invitado" (Cloudflare Access) solo en modo cloudflare
const cfGuests = (env) => guestMode(env) === "cloudflare" && !!env.GUEST_GATEWAY_URL;

function checkConfig(env) {
  const missing = ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_CLIENT_SECRET", "SESSION_SECRET"].filter((k) => !env[k]);
  if (!env.DATA) missing.push("binding KV 'DATA'");
  return missing;
}

export default {
  async fetch(request, env) {
    try {
      return withSecurity(await handle(request, env));
    } catch (e) {
      console.error(e);
      return renderMessage("Error", "Ocurrió un error inesperado. Intentá de nuevo en unos minutos.", 500);
    }
  },
};

async function handle(request, env) {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/+$/, "") || "/";

  const missing = checkConfig(env);
  if (missing.length) {
    return renderMessage("Falta configuración", `Faltan estas variables o secretos en el Worker: ${missing.join(", ")}. Revisá el README.`, 500);
  }

  // ---------- Rutas sin sesión ----------
  if (aliases[path]) return Response.redirect(url.origin + aliases[path], 301);
  if (path === "/auth/login") return startEntraLogin(request, env);
  if (path === "/auth/callback") {
    const r = await finishEntraLogin(request, env);
    if (r.response) return r.response;
    return html(renderLogin(await getContent(env), { error: r.error, guestEnabled: cfGuests(env) }), 403);
  }
  if (path === "/auth/invitado") {
    if (!cfGuests(env)) return renderMessage("No disponible", "El acceso de invitados todavía no está configurado.", 404);
    return Response.redirect(env.GUEST_GATEWAY_URL, 302);
  }
  if (path === "/auth/guest-callback") {
    if (!cfGuests(env)) return Response.redirect(url.origin + "/login", 302);
    const r = await finishGuestLogin(request, env);
    if (r.response) return r.response;
    return html(renderLogin(await getContent(env), { error: r.error, guestEnabled: cfGuests(env) }), 403);
  }
  if (path === "/logout") {
    return new Response(null, { status: 302, headers: { Location: "/login", "Set-Cookie": logoutCookie() } });
  }

  const content = await getContent(env);

  // La foto de perfil se muestra también en la pantalla de login
  if (path.startsWith("/f/") && path.slice(3) === content.settings?.avatarFileId) return serveFile(env, path.slice(3));

  const session = await getSession(request, env);

  if (path === "/login") {
    if (session) return Response.redirect(url.origin + "/", 302);
    return html(renderLogin(content, { returnTo: url.searchParams.get("return") || "/", guestEnabled: cfGuests(env) }));
  }

  // ---------- A partir de acá, todo requiere sesión ----------
  if (!session) {
    if (path.startsWith("/admin/api/")) return json({ error: "Sesión vencida. Recargá la página." }, 401);
    return Response.redirect(`${url.origin}/login?return=${encodeURIComponent(path)}`, 302);
  }

  const admin = session.kind === "emp" && (await isAdmin(env, session.email));

  if (path === "/admin" || path.startsWith("/admin/")) {
    if (!admin) {
      return renderMessage(
        "Sin permiso",
        `Esta sección es solo para administradores. Ingresaste como ${session.email}: ese correo tiene que estar en ADMIN_EMAILS (wrangler.jsonc) o haber sido agregado por otro administrador.`,
        403
      );
    }
    if (path === "/admin") return html(adminHtml(), 200, { "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'" });
    return adminApi(request, env, url, path, session);
  }

  if (path.startsWith("/f/")) return serveFile(env, path.slice(3));

  if (content.pages[path]) {
    const fileIds = new Set((await listFiles(env)).map((f) => f.id));
    return html(renderPage(content, path, session, admin, fileIds));
  }

  // Archivos estáticos (public/)
  if (env.ASSETS) {
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404) return res;
  }
  return Response.redirect(url.origin + "/", 302);
}

async function serveFile(env, id) {
  const f = await getFile(env, id);
  if (!f || !f.value) return renderMessage("No encontrado", "El archivo no existe o fue eliminado.", 404);
  const m = f.metadata || {};
  const safeName = String(m.name || "archivo").replace(/[^\w.\- ]+/g, "_");
  return new Response(f.value, {
    headers: {
      "content-type": m.type || "application/octet-stream",
      "content-disposition": `inline; filename="${safeName}"`,
      "cache-control": "private, max-age=300",
    },
  });
}

// ====================== API del panel de administración ======================
async function adminApi(request, env, url, path, session) {
  const method = request.method;

  // Protección CSRF: las modificaciones solo se aceptan desde el mismo sitio
  if (method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin !== url.origin) return json({ error: "Origen no permitido" }, 403);
  }

  const sub = path.slice("/admin/api".length);

  // Estado completo
  if (sub === "/state" && method === "GET") {
    const [content, admins, guests, files] = await Promise.all([getContent(env), getAdmins(env), getGuests(env), listFiles(env)]);
    return json({
      me: session.email,
      domain: corporateDomain(env),
      content,
      admins,
      fixedAdmins: bootstrapAdmins(env),
      guests,
      maxGuests: MAX_GUESTS,
      maxFileMB: MAX_FILE_BYTES / 1024 / 1024,
      files,
      accessConfigured: accessConfigured(env),
      guestMode: guestMode(env),
      guestGateway: env.GUEST_GATEWAY_URL || "",
    });
  }

  // Contenido
  if (sub === "/content" && method === "PUT") {
    const body = await request.json().catch(() => null);
    const err = validateContent(body);
    if (err) return json({ error: err }, 400);
    await saveContent(env, body);
    return json({ ok: true });
  }

  // Administradores
  if (sub === "/admins" && method === "POST") {
    const { email } = await request.json().catch(() => ({}));
    const e = normEmail(email);
    if (!isEmail(e)) return json({ error: "Correo inválido" }, 400);
    if (!isCorporate(env, e)) return json({ error: `Los administradores tienen que ser @${corporateDomain(env)}` }, 400);
    const list = await getAdmins(env);
    if (list.some((a) => a.email === e) || bootstrapAdmins(env).includes(e)) return json({ error: "Ya es administrador" }, 400);
    list.push({ email: e, addedBy: session.email, addedAt: new Date().toISOString() });
    await saveAdmins(env, list);
    return json({ ok: true });
  }
  if (sub.startsWith("/admins/") && method === "DELETE") {
    const e = normEmail(decodeURIComponent(sub.slice(8)));
    if (bootstrapAdmins(env).includes(e)) return json({ error: "Este administrador está fijado en la configuración del Worker (ADMIN_EMAILS)" }, 400);
    if (e === session.email) return json({ error: "No podés quitarte a vos mismo" }, 400);
    await saveAdmins(env, (await getAdmins(env)).filter((a) => a.email !== e));
    return json({ ok: true });
  }

  // Invitados (correos externos)
  if (sub === "/guests" && method === "POST") {
    const { email, note } = await request.json().catch(() => ({}));
    const e = normEmail(email);
    if (!isEmail(e)) return json({ error: "Correo inválido" }, 400);
    if (isCorporate(env, e)) return json({ error: `Los correos @${corporateDomain(env)} ya tienen acceso con Microsoft; no hace falta registrarlos.` }, 400);
    const list = await getGuests(env);
    if (list.some((g) => g.email === e)) return json({ error: "Ese correo ya está registrado" }, 400);
    if (list.length >= MAX_GUESTS) return json({ error: `Se alcanzó el máximo de ${MAX_GUESTS} correos externos. Dá de baja alguno primero.` }, 400);
    const rec = { email: e, note: String(note || "").slice(0, 120), addedBy: session.email, addedAt: new Date().toISOString() };
    let sync;
    if (guestMode(env) === "entra") {
      sync = await inviteGuest(env, { email: e, displayName: rec.note, redirectUrl: url.origin + "/" });
      if (sync.ok) { rec.entraUserId = sync.userId; rec.invitedAt = new Date().toISOString(); }
    }
    list.push(rec);
    await saveGuests(env, list);
    if (guestMode(env) === "cloudflare") sync = await syncGuestsToAccess(env, list.map((g) => g.email));
    return json({ ok: true, sync });
  }
  if (sub.startsWith("/guests/") && sub.endsWith("/invite") && method === "POST") {
    const e = normEmail(decodeURIComponent(sub.slice(8, -7)));
    const list = await getGuests(env);
    const rec = list.find((g) => g.email === e);
    if (!rec) return json({ error: "Ese correo no está registrado" }, 404);
    if (guestMode(env) !== "entra") return json({ error: "Las invitaciones de Microsoft solo se usan en modo entra" }, 400);
    const sync = await inviteGuest(env, { email: e, displayName: rec.note, redirectUrl: url.origin + "/" });
    if (sync.ok) { rec.entraUserId = sync.userId || rec.entraUserId; rec.invitedAt = new Date().toISOString(); await saveGuests(env, list); }
    return json({ ok: true, sync });
  }
  if (sub.startsWith("/guests/") && method === "DELETE") {
    const e = normEmail(decodeURIComponent(sub.slice(8)));
    const all = await getGuests(env);
    const removed = all.find((g) => g.email === e);
    const list = all.filter((g) => g.email !== e);
    await saveGuests(env, list);
    let sync;
    if (guestMode(env) === "entra") {
      sync = await removeGuestFromEntra(env, removed?.entraUserId);
      sync.message = ("Acceso al sitio quitado. " + (sync.message || "")).trim();
    } else {
      sync = await syncGuestsToAccess(env, list.map((g) => g.email));
      await revokeGuestInAccess(env, e);
    }
    return json({ ok: true, sync });
  }
  if (sub === "/access/discover" && method === "GET") {
    return json(await discoverAccess(env));
  }
  if (sub === "/guests/sync" && method === "POST") {
    const list = await getGuests(env);
    return json({ ok: true, sync: await syncGuestsToAccess(env, list.map((g) => g.email)) });
  }

  // Archivos
  if (sub === "/files" && method === "POST") {
    const form = await request.formData().catch(() => null);
    const file = form && form.get("file");
    if (!file || typeof file === "string") return json({ error: "No se recibió ningún archivo" }, 400);
    if (file.size > MAX_FILE_BYTES) return json({ error: `El archivo supera ${MAX_FILE_BYTES / 1024 / 1024} MB` }, 400);
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) return json({ error: "Solo se aceptan PDF o imágenes (JPG, PNG, WEBP, GIF)" }, 400);
    const id = randomString(12);
    const meta = { name: String(file.name || "archivo").slice(0, 150), type: file.type, size: file.size, uploadedAt: new Date().toISOString(), uploadedBy: session.email };
    await putFile(env, id, await file.arrayBuffer(), meta);
    return json({ ok: true, file: { id, ...meta } });
  }
  if (sub.startsWith("/files/") && method === "DELETE") {
    const id = sub.slice(7);
    const content = await getContent(env);
    const used = Object.entries(content.pages).flatMap(([slug, p]) =>
      p.sections.flatMap((s) => s.links.filter((l) => l.type === "file" && l.value === id).map((l) => `${slug} → ${l.label}`))
    );
    if (content.settings?.avatarFileId === id) used.push("foto de perfil");
    if (used.length) return json({ error: `El archivo está en uso: ${used.join(", ")}. Cambiá esos botones primero.` }, 400);
    await deleteFile(env, id);
    return json({ ok: true });
  }

  return json({ error: "Ruta no encontrada" }, 404);
}
