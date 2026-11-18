import { profile, sections, theme } from "./links.js";

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderLink(link) {
  const tag = link.type ? `<span class="tag">${esc(link.type)}</span>` : "";
  if (!link.url) {
    return `<div class="btn disabled" title="Link pendiente">${esc(link.label)}${tag}</div>`;
  }
  return `<a class="btn" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)}${tag}</a>`;
}

function renderPage() {
  const body = sections
    .map(
      (s) => `
      <section>
        <h2>${esc(s.title)}</h2>
        ${s.links.map(renderLink).join("\n")}
      </section>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(profile.title)}</title>
<meta name="description" content="${esc(profile.bio || profile.title)}">
<link rel="icon" href="${esc(profile.avatar)}">
<style>
  :root{--bg:${theme.background};--card:${theme.card};--text:${theme.text};--muted:${theme.muted};--accent:${theme.accent}}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
  main{max-width:580px;margin:0 auto;padding:48px 20px 64px;text-align:center}
  .avatar{width:96px;height:96px;border-radius:50%;object-fit:cover;box-shadow:0 2px 10px rgba(0,0,0,.12)}
  h1{font-size:1.25rem;margin:14px 0 4px}
  .bio{color:var(--muted);margin:0 0 8px}
  section{margin-top:32px}
  h2{font-size:1rem;font-weight:600;color:var(--muted);margin:0 0 12px}
  .btn{display:flex;align-items:center;justify-content:center;gap:8px;position:relative;
       background:var(--card);color:var(--text);text-decoration:none;font-weight:500;
       padding:16px 20px;margin:0 0 12px;border-radius:14px;border:1px solid rgba(0,0,0,.06);
       box-shadow:0 1px 3px rgba(0,0,0,.06);transition:transform .15s,box-shadow .15s,border-color .15s}
  a.btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.1);border-color:var(--accent)}
  .btn.disabled{opacity:.5;cursor:not-allowed}
  .tag{font-size:.7rem;font-weight:600;color:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:1px 6px}
  footer{margin-top:40px;font-size:.8rem;color:var(--muted)}
</style>
</head>
<body>
<main>
  <img class="avatar" src="${esc(profile.avatar)}" alt="${esc(profile.title)}">
  <h1>${esc(profile.handle)}</h1>
  ${profile.bio ? `<p class="bio">${esc(profile.bio)}</p>` : ""}
  ${body}
  <footer>${esc(profile.title)}</footer>
</main>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Archivos estáticos de /public (avatar, PDFs) si existen
    if (url.pathname !== "/" && env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 404) return res;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(renderPage(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    return Response.redirect(url.origin + "/", 302);
  },
};
