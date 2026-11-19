// Acceso a los datos guardados en Workers KV (binding DATA).
import { seedContent } from "./seed.js";

// Límite de invitados: solo en modo "cloudflare" (50 puestos gratuitos de Zero Trust).
// En modo "entra" no hay límite (0 = sin límite), salvo que se defina MAX_GUESTS.
export function maxGuests(env) {
  if (String(env.GUEST_MODE || "entra").toLowerCase() === "cloudflare") return 50;
  const n = Number(env.MAX_GUESTS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB (KV admite hasta 25 MB por valor)

export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const isEmail = (e) => /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(e);

export function corporateDomain(env) {
  return normEmail(env.CORPORATE_DOMAIN || "diagnosticomaipu.com.ar");
}
export function isCorporate(env, email) {
  return normEmail(email).endsWith("@" + corporateDomain(env));
}

// ---------- Contenido ----------
export async function getContent(env) {
  const c = await env.DATA.get("content", "json");
  return c || structuredClone(seedContent);
}

export function validateContent(c) {
  if (!c || typeof c !== "object" || !c.pages || typeof c.pages !== "object") return "Formato inválido";
  if (!c.pages["/"]) return "Tiene que existir la página principal (/)";
  for (const [slug, p] of Object.entries(c.pages)) {
    if (!/^\/[a-z0-9\-]*$/.test(slug)) return `Dirección de página inválida: ${slug} (solo minúsculas, números y guiones)`;
    if (["/admin", "/auth", "/login", "/logout", "/f"].some((r) => slug === r || slug.startsWith(r + "/")))
      return `La dirección ${slug} está reservada`;
    if (!Array.isArray(p.sections)) return `La página ${slug} no tiene secciones`;
    for (const s of p.sections) {
      if (!Array.isArray(s.links)) return `Sección inválida en ${slug}`;
      for (const l of s.links) {
        if (!["page", "file", "url"].includes(l.type)) return `Tipo de botón inválido en ${slug}`;
        if (l.type === "url" && l.value && !/^https?:\/\//i.test(l.value)) return `El enlace "${l.label}" tiene que empezar con https://`;
        if (l.type === "page" && l.value && !c.pages[l.value]) return `El botón "${l.label}" apunta a una página que no existe (${l.value})`;
      }
    }
  }
  return null;
}

export async function saveContent(env, c) {
  await env.DATA.put("content", JSON.stringify(c));
}

// ---------- Administradores ----------
export function bootstrapAdmins(env) {
  return String(env.ADMIN_EMAILS || "")
    .split(",")
    .map(normEmail)
    .filter(Boolean);
}

export async function getAdmins(env) {
  return (await env.DATA.get("admins", "json")) || [];
}
export async function saveAdmins(env, list) {
  await env.DATA.put("admins", JSON.stringify(list));
}
export async function isAdmin(env, email) {
  email = normEmail(email);
  if (!isCorporate(env, email)) return false; // regla dura: solo correos del dominio
  if (bootstrapAdmins(env).includes(email)) return true;
  return (await getAdmins(env)).some((a) => a.email === email);
}

// ---------- Invitados (correos externos) ----------
export async function getGuests(env) {
  return (await env.DATA.get("guests", "json")) || [];
}
export async function saveGuests(env, list) {
  await env.DATA.put("guests", JSON.stringify(list));
}
// ---------- Vencimiento de invitados ----------
// GUEST_DAYS: días de acceso desde el alta o la última renovación (por defecto 30).
export function guestDays(env) {
  const n = Number(env.GUEST_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 30;
}
export function newExpiry(env, from = Date.now()) {
  return new Date(from + guestDays(env) * 86400000).toISOString();
}
// Invitados viejos (sin expiresAt) vencen a los GUEST_DAYS de su alta.
export function guestExpiresAt(env, g) {
  if (g.expiresAt) return g.expiresAt;
  const base = Date.parse(g.addedAt || "") || Date.now();
  return newExpiry(env, base);
}
export function isExpired(env, g, now = Date.now()) {
  return Date.parse(guestExpiresAt(env, g)) <= now;
}

export async function isGuest(env, email) {
  email = normEmail(email);
  const g = (await getGuests(env)).find((x) => x.email === email);
  return Boolean(g && !isExpired(env, g));
}

// Saca de la lista a los vencidos. Devuelve { removed, remaining }.
export async function purgeExpiredGuests(env) {
  const all = await getGuests(env);
  const removed = all.filter((g) => isExpired(env, g));
  if (!removed.length) return { removed, remaining: all };
  const remaining = all.filter((g) => !isExpired(env, g));
  await saveGuests(env, remaining);
  return { removed, remaining };
}

// ---------- Archivos ----------
export async function listFiles(env) {
  const out = [];
  let cursor;
  do {
    const r = await env.DATA.list({ prefix: "file:", cursor });
    for (const k of r.keys) out.push({ id: k.name.slice(5), ...(k.metadata || {}) });
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return out.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
}

export async function getFile(env, id) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return null;
  return env.DATA.getWithMetadata("file:" + id, "arrayBuffer");
}

export async function putFile(env, id, bytes, meta) {
  await env.DATA.put("file:" + id, bytes, { metadata: meta });
}

export async function deleteFile(env, id) {
  await env.DATA.delete("file:" + id);
}
