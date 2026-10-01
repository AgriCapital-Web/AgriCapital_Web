import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "account-request-photos";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const attempts = new Map<string, { count: number; resetAt: number }>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ip = (req: Request) =>
  req.headers.get("cf-connecting-ip") ||
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

const allowed = (key: string) => {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (a.count >= 8) return false;
  a.count++;
  return true;
};

const decode = (value: string) => {
  const clean = value.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) {
    throw new Error("Image invalide");
  }
  const bytes = Uint8Array.from(atob(clean), (char) => char.charCodeAt(0));
  if (bytes.byteLength === 0) throw new Error("Photo vide");
  if (bytes.byteLength > MAX_BYTES) throw new Error("Photo trop volumineuse");
  return bytes;
};

const hasMagicBytes = (bytes: Uint8Array, mime: string) => {
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= sig.length && sig.every((v, i) => bytes[i] === v);
  }
  if (mime === "image/webp") {
    return bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!allowed(ip(req))) return json({ error: "Trop de tentatives. Réessayez plus tard." }, 429);

  try {
    const body = await req.json();
    if (!body || typeof body !== "object") return json({ error: "Requête invalide" }, 400);

    // This endpoint is intentionally upload-only. There is no public delete path.
    if (body?.mode === "delete") return json({ error: "Suppression non disponible depuis le point d'entrée public" }, 403);

    const mime = String(body?.mime || "").toLowerCase();
    if (!ALLOWED.has(mime)) return json({ error: "Format photo non pris en charge" }, 415);

    const bytes = decode(String(body?.data || ""));
    if (!hasMagicBytes(bytes, mime)) return json({ error: "Le contenu du fichier ne correspond pas à son type" }, 415);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // A second rate limit in the database survives warm/cold edge instances.
    const clientIp = ip(req).slice(0, 120);
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", clientIp)
      .eq("action", "account_request_photo")
      .gt("first_attempt_at", windowStart);

    if ((count || 0) >= 12) return json({ error: "Trop de tentatives. Réessayez plus tard." }, 429);
    await admin.from("rate_limits").insert({ identifier: clientIp, action: "account_request_photo" });

    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const path = "pending/" + crypto.randomUUID() + "." + ext;

    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;

    await admin.from("admin_audit_logs").insert({
      acteur_user_id: null,
      acteur_libelle: "Visiteur",
      action: "photo_demande_compte_deposee",
      entite: "account_request_photo",
      entite_id: null,
      nouvelle_valeur: { bucket: BUCKET, path, mime, bytes: bytes.byteLength },
      details: "Photo de demande de création de compte déposée avant validation.",
      source: "public_account_request",
    }).catch(() => undefined);

    return json({ success: true, bucket: BUCKET, path });
  } catch (error) {
    console.error("upload-account-request-photo", error);
    return json({ error: error instanceof Error ? error.message : "Upload impossible" }, 400);
  }
});
