// HTML de las páginas públicas (protegidas), login y errores.

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const CSS = `
  :root{--bg:#f3f6f9;--card:#fff;--text:#1d2b3a;--muted:#5b6b7c;--accent:#1f6feb}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
  main{max-width:580px;margin:0 auto;padding:40px 20px 64px;text-align:center;position:relative}
  .top{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;color:var(--muted);min-height:24px}
  .top a{color:var(--muted);text-decoration:none}.top a:hover{color:var(--accent)}
  .avatar{width:96px;height:96px;border-radius:50%;object-fit:cover;box-shadow:0 2px 10px rgba(0,0,0,.12);margin-top:16px;background:#dde3ea}
  h1{font-size:1.25rem;margin:14px 0 4px}
  section{margin-top:28px}
  h2{font-size:1rem;font-weight:600;color:var(--muted);margin:0 0 12px}
  .btn{display:flex;align-items:center;justify-content:center;gap:8px;position:relative;background:var(--card);color:var(--text);
       text-decoration:none;font-weight:500;padding:16px 44px;margin:0 0 12px;border-radius:14px;border:1px solid rgba(0,0,0,.06);
       box-shadow:0 1px 3px rgba(0,0,0,.06);transition:transform .15s,box-shadow .15s,border-color .15s;font-size:1rem;width:100%;cursor:pointer;font-family:inherit}
  a.btn:hover,button.btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.1);border-color:var(--accent)}
  .btn.primary{background:var(--accent);color:#fff}
  .btn.disabled{opacity:.5;cursor:not-allowed}
  .tag{font-size:.7rem;font-weight:600;color:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:1px 6px}
  .arrow{position:absolute;right:18px;font-size:1.4rem;color:var(--muted)}
  .note{color:var(--muted);font-size:.9rem;line-height:1.5}
  .error{background:#fdecec;color:#8a1f1f;border-radius:12px;padding:14px 16px;margin-top:20px;text-align:left}
`;

function shell(title, inner) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="app-version" content="4.0">
<title>${esc(title)}</title><style>${CSS}</style></head><body><main>${inner}</main></body></html>`;
}

export function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", ...extraHeaders },
  });
}

export function avatarSrc(content) {
  const s = content.settings || {};
  return s.avatarFileId ? `/f/${s.avatarFileId}` : s.avatarUrl || "";
}

export function renderPage(content, slug, session, isAdmin, fileIds) {
  const page = content.pages[slug];
  const sections = page.sections
    .map((s) => {
      const btns = s.links
        .map((l) => {
          let href = "";
          let ext = true;
          let tag = "";
          if (l.type === "page" && content.pages[l.value]) { href = l.value; ext = false; }
          else if (l.type === "file" && l.value && fileIds.has(l.value)) { href = `/f/${l.value}`; tag = "PDF"; }
          else if (l.type === "url" && l.value) { href = l.value; if (/docs\.google\.com\/forms/.test(l.value)) tag = "Formulario"; }
          if (!href) return `<div class="btn disabled" title="Pendiente">${esc(l.label)}</div>`;
          const t = tag ? `<span class="tag">${esc(tag)}</span>` : "";
          const target = ext ? ` target="_blank" rel="noopener noreferrer"` : "";
          const arrow = ext ? "" : `<span class="arrow">›</span>`;
          return `<a class="btn" href="${esc(href)}"${target}>${esc(l.label)}${t}${arrow}</a>`;
        })
        .join("");
      return `<section>${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${btns}</section>`;
    })
    .join("");

  const back = slug !== "/" ? `<a href="/">‹ Volver</a>` : `<span></span>`;
  const right = `<span>${isAdmin ? `<a href="/admin">⚙️ Administración</a> · ` : ""}<span title="Sesión iniciada">${esc(session.email)}</span> · <a href="/logout">Salir</a></span>`;
  const av = avatarSrc(content);
  return shell(
    page.title || content.settings.siteTitle,
    `<div class="top">${back}${right}</div>
     ${av ? `<img class="avatar" src="${esc(av)}" alt="">` : ""}
     <h1>${esc(page.heading || page.title)}</h1>${sections}`
  );
}

export function renderLogin(content, { error = "", returnTo = "/", guestEnabled = true } = {}) {
  const av = avatarSrc(content);
  return shell(
    "Ingresar",
    `${av ? `<img class="avatar" src="${esc(av)}" alt="">` : ""}
     <h1>${esc(content.settings.siteTitle || "Bienvenida")}</h1>
     <p class="note">Ingresá para ver la información de bienvenida.</p><!-- v4.0 -->
     ${error ? `<div class="error">${esc(error)}</div>` : ""}
     <section>
       <a class="btn primary" href="/auth/login?return=${encodeURIComponent(returnTo)}">Ingresar con Microsoft</a>
       <p class="note">Colaboradores: con su cuenta @diagnosticomaipu.com.ar.<br>Invitados: con el correo que fue habilitado (aceptá antes la invitación de Microsoft).</p>
       ${guestEnabled ? `<a class="btn" href="/auth/invitado">Tengo un acceso de invitado</a>
       <p class="note">Si no tenés cuenta corporativa, un administrador tiene que habilitar tu correo. Vas a recibir un código de verificación de Cloudflare.</p>` : ""}
     </section>`
  );
}

export function renderMessage(title, message, status = 403) {
  return html(
    shell(title, `<h1>${esc(title)}</h1><div class="error">${esc(message)}</div><section><a class="btn" href="/login">Volver a ingresar</a></section>`),
    status
  );
}
