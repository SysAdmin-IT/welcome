# Bienvenida_ — Cloudflare Worker

Réplica de https://linktr.ee/Bienvenida_ servida desde un Cloudflare Worker, con despliegue automático desde GitHub.

## Estructura

```
src/links.js      ← TODO el contenido (perfil, secciones, links, colores). Editá solo esto.
src/index.js      ← Genera el HTML
public/           ← Archivos estáticos opcionales (avatar, PDFs)
wrangler.jsonc    ← Configuración del Worker
.github/workflows/deploy.yml ← Despliegue automático en cada push a main
```

## Pendiente antes de publicar

Linktree no expone las URLs de 3 PDFs. Completalas en `src/links.js` (campo `url`):

- Mi legajo digital ✍🏽
- Manual del Colaborador 🩺 🔬
- Reglamento Interno ⚖️

Opciones: pegar un link de Google Drive, o subir el PDF a `public/` y usar `"/manual.pdf"`.
Mientras estén vacíos, el botón se muestra deshabilitado.

## Conectar con GitHub (elegí UNA opción)

### Opción A — Workers Builds (sin tokens, recomendado)
1. Subí esta carpeta a un repo de GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Import a repository**.
3. Elegí el repo; comando de deploy: `npx wrangler deploy`.
4. Borrá `.github/workflows/deploy.yml` para no desplegar dos veces.

### Opción B — GitHub Actions
1. En Cloudflare: **My Profile → API Tokens → Create Token → plantilla "Edit Cloudflare Workers"**.
2. En GitHub: **Settings → Secrets and variables → Actions**, agregá:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID` (está en el dashboard, panel derecho de Workers)
3. Cada push a `main` despliega solo.

## Probar localmente

```bash
npm install
npm run dev      # http://localhost:8787
npm run deploy   # despliegue manual
```

## Dominio propio
Dashboard → tu Worker → **Settings → Domains & Routes → Add custom domain**.
