const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const pad = value.length % 4 ? "=".repeat(4 - (value.length % 4)) : "";
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function signingSecret(): string {
  const raw = Deno.env.get("PORTAL_SESSION_SECRET") || Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("PORTAL_SESSION_SECRET non configuré");
  if (raw.trim().startsWith("{")) {
    try { return JSON.parse(raw).default; } catch { throw new Error("Clé de session indisponible"); }
  }
  return raw;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(signingSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

export function normalizePhone(input: unknown): string {
  let digits = String(input ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("225") && digits.length > 8) digits = digits.slice(3);
  return digits.replace(/^0+/, "");
}

export function phoneMatches(a: unknown, b: unknown): boolean {
  return !!normalizePhone(a) && normalizePhone(a) === normalizePhone(b);
}

export async function createPortalSession(phone: string, ttlSeconds = 4 * 3600): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify({ p: normalizePhone(phone), exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyPortalSession(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const expected = await hmac(payload);
    if (expected.length !== signature.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    if (diff !== 0) return null;
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    return data?.p && typeof data.exp === "number" && data.exp * 1000 > Date.now() ? String(data.p) : null;
  } catch { return null; }
}
