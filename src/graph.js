// Invitaciones B2B de Microsoft Entra a través de Microsoft Graph.
// Usa la misma app registrada (ENTRA_CLIENT_ID / ENTRA_CLIENT_SECRET) con permisos de aplicación:
//   User.Invite.All      -> enviar invitaciones (obligatorio)
//   User.ReadWrite.All   -> borrar el invitado de Entra al darlo de baja (opcional, ENTRA_DELETE_GUESTS=true)

let tokenCache = { token: "", exp: 0 };

const authority = (env) => (env.ENTRA_AUTHORITY || "https://login.microsoftonline.com").replace(/\/+$/, "");
const graphBase = (env) => (env.GRAPH_BASE || "https://graph.microsoft.com").replace(/\/+$/, "");

async function appToken(env) {
  if (tokenCache.token && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(`${authority(env)}/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.ENTRA_CLIENT_ID,
      client_secret: env.ENTRA_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: `${graphBase(env)}/.default`,
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.access_token) {
    const desc = String(d.error_description || d.error || `HTTP ${res.status}`);
    throw new Error((desc.match(/AADSTS\d+[^\r\n.]*/) || [desc])[0]);
  }
  tokenCache = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

async function graph(env, method, path, body) {
  const res = await fetch(`${graphBase(env)}/v1.0${path}`, {
    method,
    headers: { Authorization: `Bearer ${await appToken(env)}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = d.error?.message || `HTTP ${res.status}`;
    const code = d.error?.code || "";
    const err = new Error(code === "Authorization_RequestDenied" || res.status === 403
      ? `Falta el permiso de Microsoft Graph o el consentimiento de administrador (${msg})`
      : msg);
    err.status = res.status;
    throw err;
  }
  return d;
}

// Envía (o reenvía) la invitación. Devuelve { ok, message, userId, status }
export async function inviteGuest(env, { email, displayName, redirectUrl }) {
  try {
    const d = await graph(env, "POST", "/invitations", {
      invitedUserEmailAddress: email,
      invitedUserDisplayName: displayName || undefined,
      inviteRedirectUrl: redirectUrl,
      sendInvitationMessage: true,
      invitedUserMessageInfo: {
        customizedMessageBody:
          "Te habilitamos el acceso a la página de Bienvenida de Diagnóstico Maipú. Aceptá la invitación y después ingresá con el botón de Microsoft usando este mismo correo.",
      },
    });
    return {
      ok: true,
      userId: d.invitedUser?.id || "",
      status: d.status || "",
      message: `Invitación de Microsoft enviada a ${email}.`,
    };
  } catch (e) {
    return { ok: false, message: `No se pudo enviar la invitación de Microsoft: ${e.message}` };
  }
}

// Al dar de baja: el acceso al sitio se corta igual (sale de la lista). Esto además
// cierra sus sesiones de Microsoft y, si está habilitado, borra la cuenta invitada de Entra.
export async function removeGuestFromEntra(env, userId) {
  if (!userId) return { ok: true, message: "" };
  if (String(env.ENTRA_DELETE_GUESTS).toLowerCase() !== "true") {
    return { ok: true, message: "La cuenta invitada sigue en Entra (ENTRA_DELETE_GUESTS no está activado)." };
  }
  try {
    await graph(env, "DELETE", `/users/${encodeURIComponent(userId)}`);
    return { ok: true, message: "La cuenta invitada también se eliminó de Entra." };
  } catch (e) {
    return { ok: false, message: `El acceso al sitio se quitó, pero no se pudo borrar la cuenta en Entra: ${e.message}` };
  }
}
