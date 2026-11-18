import { pages, theme, avatar, aliases } from "./links.js";

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ¿Existe este archivo en public/?
async function assetExists(env, origin, path) {
  if (!env.ASSETS || !path) return false;
  try {
    const res = await env.ASSETS.fetch(new Request(origin + path, { method: "HEAD" }));
    return res.ok;
  } catch {
    return false;
  }
}

// Decide a dónde apunta cada botón
async function resolveLink(env, origin, link) {
  if (link.page) return { href: link.page, external: false, kind: "" };
  if (link.file && (await assetExists(env, origin, link.file))) {
    const kind = link.file.toLowerCase().endsWith(".pdf") ? "PDF" : "";
    return { href: link.file, external: true, kind };
  }
  if (link.url) {
    const kind = link.url.includes("docs.google.com/forms") ? "Formulario" : "";
    return { href: link.url, external: true, kind };
  }
  return null;
}

async function renderPage(env, origin, page) {
  const avatarSrc = (await assetExists(env, origin, avatar.file)) ? avatar.file : avatar.url;

  const sectionsHtml = [];
  for (const s of page.sections) {
    const buttons = [];
    for (const link of s.links) {
      const r = await resolveLink(env, origin, link);
      if (!r) {
        buttons.push(`<div class="btn disabled" title="Archivo pendiente">${esc(link.label)}</div>`);
        continue;
      }
      const tag = r.kind ? `<span class="tag">${esc(r.kind)}</span>` : "";
      const target = r.external ? ` target="_blank" rel="noopener noreferrer"` : "";
      const arrow = r.external ? "" : `<span class="arrow">›</span>`;
      buttons.push(`<a class="btn" href="${esc(r.href)}"${target}>${esc(link.label)}${tag}${arrow}</a>`);
    }
    sectionsHtml.push(`
      <section>
        ${s.title ? `<h2>${esc(s.title)}</h2>` : ""}
        ${buttons.join("\n")}
      </section>`);
  }

  const back = page.back ? `<a class="back" href="${esc(page.back)}">‹ Volver</a>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<link rel="icon" href="${esc(avatarSrc)}">
<style>
  :root{--bg:${theme.background};--card:${theme.card};--text:${theme.text};--muted:${theme.muted};--accent:${theme.accent}}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
  main{max-width:580px;margin:0 auto;padding:40px 20px 64px;text-align:center;position:relative}
  .back{position:absolute;left:20px;top:20px;color:var(--muted);text-decoration:none;font-size:.95rem}
  .back:hover{color:var(--accent)}
  .avatar{width:96px;height:96px;border-radius:50%;object-fit:cover;box-shadow:0 2px 10px rgba(0,0,0,.12);margin-top:16px}
  h1{font-size:1.25rem;margin:14px 0 4px}
  section{margin-top:28px}
  h2{font-size:1rem;font-weight:600;color:var(--muted);margin:0 0 12px}
  .btn{display:flex;align-items:center;justify-content:center;gap:8px;position:relative;
       background:var(--card);color:var(--text);text-decoration:none;font-weight:500;
       padding:16px 44px;margin:0 0 12px;border-radius:14px;border:1px solid rgba(0,0,0,.06);
       box-shadow:0 1px 3px rgba(0,0,0,.06);transition:transform .15s,box-shadow .15s,border-color .15s}
  a.btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.1);border-color:var(--accent)}
  .btn.disabled{opacity:.5;cursor:not-allowed}
  .tag{font-size:.7rem;font-weight:600;color:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:1px 6px}
  .arrow{position:absolute;right:18px;font-size:1.4rem;color:var(--muted)}
</style>
</head>
<body>
<main>
  ${back}
  <img class="avatar" src="${esc(avatarSrc)}" alt="">
  <h1>${esc(page.heading)}</h1>
  ${sectionsHtml.join("\n")}
</main>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/index.html") path = "/";

    // Direcciones viejas de Linktree
    if (aliases[path]) return Response.redirect(url.origin + aliases[path], 301);

    // Páginas del sitio
    if (pages[path]) {
      return new Response(await renderPage(env, url.origin, pages[path]), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    // Archivos de public/ (PDFs, imágenes)
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 404) return res;
    }

    return Response.redirect(url.origin + "/", 302);
  },
};
