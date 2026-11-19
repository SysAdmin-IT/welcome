# Bienvenida — Diagnóstico Maipú (Cloudflare Workers)

Sitio de bienvenida privado con panel de administración.

| Quién | Cómo ingresa | Límite |
|---|---|---|
| Empleados (@diagnosticomaipu.com.ar) | Microsoft Entra ID (SSO) | Sin límite, sin costo |
| Administradores (solo @diagnosticomaipu.com.ar) | Microsoft Entra ID + figuran en la lista de administradores | — |
| Correos externos (Gmail, Hotmail…) | Código por correo de **Cloudflare Access** | Máximo 50 (plan gratuito de Zero Trust) |

Los empleados **no** pasan por Cloudflare Access, así que no consumen los 50 puestos gratuitos: esos quedan solo para los correos externos.

## Cómo está armado

```
/                      Worker "welcome"           -> sitio + panel /admin + login Entra ID
/invitados/            Worker "welcome-invitados" -> protegido por Cloudflare Access (código por correo)
```

1. Un empleado entra a `welcome…workers.dev` → **Ingresar con cuenta de Diagnóstico Maipú** → Microsoft → vuelve con sesión de 12 h.
2. Un externo toca **Tengo un acceso de invitado** → va a `welcome-invitados…workers.dev` → Cloudflare Access le pide el correo y le manda un código → si el correo está en la política, el Worker de invitados le emite un pase firmado de 2 minutos → el sitio principal verifica el pase y que el correo siga habilitado.
3. Cuando un administrador habilita o da de baja un correo externo en `/admin`, el Worker actualiza la política de Access por API (y al dar de baja, corta la sesión y libera el puesto).

El contenido (páginas, botones, PDFs) se guarda en **Workers KV** y se edita desde `/admin`. Ya no hace falta tocar código para cambiar un botón.

---

## Configuración (una sola vez)

### 1. Crear el KV
Cloudflare → **Storage & Databases → KV → Create** → nombre `welcome-data`.
Copiá el **ID** y pegalo en `wrangler.jsonc` (`"id": "PEGAR-ID-DEL-KV-AQUI"`).

### 2. Registrar la app en Microsoft Entra ID
1. https://entra.microsoft.com → **Applications → App registrations → New registration**.
   - Nombre: `Bienvenida`
   - Tipos de cuenta: **Solo cuentas de este directorio organizativo (inquilino único)**
   - Redirect URI: plataforma **Web** → `https://welcome.sistemas-97d.workers.dev/auth/callback`
2. En **Overview** copiá **Application (client) ID** y **Directory (tenant) ID** → pegalos en `wrangler.jsonc` (`ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID`).
3. **Certificates & secrets → New client secret** → copiá el **Value** (se ve una sola vez). Va como secreto `ENTRA_CLIENT_SECRET` en el paso 4.
   ⚠️ Anotá la fecha de vencimiento: cuando venza, el login deja de funcionar hasta cargar uno nuevo.
4. **API permissions**: dejá `openid`, `profile`, `email` y `User.Read` (Microsoft Graph, delegados) → **Grant admin consent**.
5. (Opcional) **Token configuration → Add optional claim → ID → email**.

> Si querés que solo un grupo de Entra pueda entrar: **Enterprise applications → Bienvenida → Properties → Assignment required = Yes** y asigná el grupo.

### 3. Completar `wrangler.jsonc` del Worker principal
- `ADMIN_EMAILS`: tu correo (y el de otro administrador de respaldo). Son administradores fijos que no se pueden quitar desde el panel. Solo se aceptan correos @diagnosticomaipu.com.ar.
- `CF_ACCOUNT_ID`: Cloudflare → panel derecho de **Workers & Pages** (Account ID).
- `CF_ACCESS_POLICY_ID` (y `CF_ACCESS_APP_ID` si corresponde): se completan en el paso 6.4.

### 4. Cargar los secretos del Worker `welcome`
Workers & Pages → **welcome → Settings → Variables and Secrets → Add** (tipo **Secret**):

| Nombre | Valor |
|---|---|
| `ENTRA_CLIENT_SECRET` | el Value del paso 2.3 |
| `SESSION_SECRET` | texto aleatorio largo (ver abajo) |
| `GUEST_LINK_SECRET` | otro texto aleatorio largo (el **mismo** va en el Worker de invitados) |
| `CF_API_TOKEN` | token del paso 7 |

Para generar textos aleatorios (PowerShell):
```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```
o en Mac/Linux: `openssl rand -base64 48`

### 5. Crear el Worker de invitados
Workers & Pages → **Create → Import a repository** → el **mismo repositorio** →
- Nombre del proyecto: `welcome-invitados`
- **Root directory: `invitados`**
- Deploy command: `npx wrangler deploy`

Después: **welcome-invitados → Settings → Variables and Secrets** → secreto `GUEST_LINK_SECRET` (el mismo valor que en `welcome`).

### 6. Activar Cloudflare Access en el Worker de invitados
1. **Zero Trust → Settings → Authentication → Login methods → Add new → One-time PIN** (si no está).
2. **Workers & Pages → welcome-invitados → pestaña Access → Protect this Worker behind Access**.
   - Traffic scope: **All traffic**
   - Authentication policy: **Email domain** → `invalid.invalid` (es provisorio; el panel lo reemplaza por la lista de correos)
   - **Apply Access**
3. En Zero Trust, abrí la aplicación que se creó y dejá como método de login solo **One-time PIN**.
4. Completá los pasos 7 y 8, entrá a `/admin → Accesos externos → 🔎 Buscar IDs de Access` y copiá
   `CF_ACCESS_POLICY_ID` (y `CF_ACCESS_APP_ID` si la política figura como "De la app") en `wrangler.jsonc`.

Con este método no hace falta `TEAM_DOMAIN` ni `POLICY_AUD`.

### 7. Crear el token de API de Cloudflare
**My Profile → API Tokens → Create Token → Custom token**:
- Account · **Access: Apps and Policies** · Edit  ← obligatorio (actualizar la política)
- Account · **Access: Organizations, Identity Providers, and Groups** · Edit  ← para cortar la sesión al dar de baja
- Account · **Zero Trust** · Edit  ← opcional, para liberar el puesto al dar de baja
- Account Resources: solo tu cuenta.

Guardalo como secreto `CF_API_TOKEN` en `welcome`.

### 8. Subir los cambios
Hacé commit de `wrangler.jsonc` e `invitados/wrangler.jsonc`. Cloudflare despliega los dos Workers solo.
Entrá a `https://welcome.sistemas-97d.workers.dev` → ingresá con Microsoft → arriba a la derecha aparece **⚙️ Administración**.

---

## Uso del panel `/admin`

- **Contenido**: páginas, secciones y botones. Cada botón puede ser *Enlace* (URL), *Archivo* (PDF subido) o *Página* (otra página del sitio). **Guardar y publicar** aplica los cambios.
- **Archivos**: subir PDFs o imágenes (hasta 20 MB). Solo los ve quien inició sesión. Subí acá la foto de perfil y elegila en *Ajustes generales* para dejar de depender de Linktree.
- **Accesos externos**: habilitar o dar de baja hasta 50 correos que no son @diagnosticomaipu.com.ar.
- **Administradores**: agregar o quitar administradores (solo @diagnosticomaipu.com.ar).

Los cambios pueden tardar hasta ~1 minuto en verse en todas las ubicaciones (Workers KV).

## Dominio propio (opcional)
Si se usa `bienvenida.diagnosticomaipu.com.ar`:
1. Agregá la Redirect URI `https://bienvenida.diagnosticomaipu.com.ar/auth/callback` en Entra (paso 2).
2. Cambiá `MAIN_URL` en `invitados/wrangler.jsonc`.
3. El dominio tiene que estar en Cloudflare para usar *Custom domain* (ver conversación sobre DNS interno).

## Desarrollo local
Creá `.dev.vars` (no se sube a GitHub) con los secretos y ejecutá `npm install && npx wrangler dev`.
