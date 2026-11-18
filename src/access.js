// Sincroniza la lista de invitados con la política de Cloudflare Access
// que protege al Worker "welcome-invitados" (verificación por código de correo).

const API = "https://api.cloudflare.com/client/v4";

export function accessConfigured(env) {
  return Boolean(env.CF_API_TOKEN && env.CF_ACCOUNT_ID && env.CF_ACCESS_POLICY_ID);
}

async function cf(env, method, path, body) {
  const res = await fetch(`${API}/accounts/${env.CF_ACCOUNT_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = (data.errors || []).map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data.result;
}

// Reemplaza los correos permitidos de la política por la lista actual de invitados.
export async function syncGuestsToAccess(env, emails) {
  if (!accessConfigured(env)) return { ok: false, message: "Cloudflare Access todavía no está configurado (faltan variables)." };
  try {
    const policy = await cf(env, "GET", `/access/policies/${env.CF_ACCESS_POLICY_ID}`);
    // Una política no puede quedar vacía: si no hay invitados, se usa un correo que no existe.
    const include = (emails.length ? emails : ["sin-invitados@invalid.invalid"]).map((email) => ({ email: { email } }));
    const body = { name: policy.name, decision: "allow", include, exclude: policy.exclude || [], require: policy.require || [] };
    for (const k of ["session_duration", "approval_required", "approval_groups", "isolation_required", "purpose_justification_required", "purpose_justification_prompt", "mfa_config"]) {
      if (policy[k] !== undefined && policy[k] !== null) body[k] = policy[k];
    }
    await cf(env, "PUT", `/access/policies/${env.CF_ACCESS_POLICY_ID}`, body);
    return { ok: true, message: `Política de Access actualizada (${emails.length} correo/s).` };
  } catch (e) {
    return { ok: false, message: `No se pudo actualizar Access: ${e.message}` };
  }
}

// Al dar de baja: corta la sesión de Access y libera el puesto (si se puede).
export async function revokeGuestInAccess(env, email) {
  if (!accessConfigured(env)) return;
  try {
    await cf(env, "POST", `/access/organizations/revoke_user`, { email });
  } catch {}
  try {
    const users = await cf(env, "GET", `/access/users?email=${encodeURIComponent(email)}`);
    const u = (users || []).find((x) => String(x.email).toLowerCase() === email);
    if (u && u.seat_uid) {
      await cf(env, "PATCH", `/access/seats`, [{ seat_uid: u.seat_uid, access_seat: false, gateway_seat: false }]);
    }
  } catch {}
}
