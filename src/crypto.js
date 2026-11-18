// Utilidades de firma (HMAC-SHA256) y codificación base64url.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes) {
  if (typeof bytes === "string") bytes = enc.encode(bytes);
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecodeBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const b64urlDecode = (str) => dec.decode(b64urlDecodeBytes(str));

export function randomString(bytes = 32) {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 16) throw new Error("Secreto de firma ausente o demasiado corto");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// Firma un objeto: devuelve "payload.firma"
export async function sign(obj, secret) {
  const payload = b64urlEncode(JSON.stringify(obj));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64urlEncode(sig)}`;
}

// Verifica y devuelve el objeto, o null. Rechaza si venció (campo x = epoch en segundos).
export async function verify(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64urlDecodeBytes(sig), enc.encode(payload));
    if (!ok) return null;
    const obj = JSON.parse(b64urlDecode(payload));
    if (obj.x && obj.x < Math.floor(Date.now() / 1000)) return null;
    return obj;
  } catch {
    return null;
  }
}

export async function sha256b64url(str) {
  return b64urlEncode(await crypto.subtle.digest("SHA-256", enc.encode(str)));
}
