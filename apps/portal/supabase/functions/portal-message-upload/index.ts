import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BUCKET = "portail-messages";
const MAX_SIZE = 50 * 1024 * 1024;

const json = (body: any, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPortalSession(token: unknown) {
  if (typeof token !== "string" || token.length < 40) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const tokenHash = await sha256(token);
  const { data } = await supabase.from("client_portal_sessions")
    .select("id,client_id,expires_at").eq("token_hash", tokenHash).is("revoked_at", null)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  return data ? { clientId: data.client_id, sessionId: data.id } : null;
}

function safeName(name: string) {
  return name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-160) || "piece-jointe";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const form = await req.formData();
    const session = await verifyPortalSession(form.get("access_token") || form.get("session_token") || req.headers.get("x-portal-session"));
    if (!session) return json({ success: false, error: "Session portail invalide ou expirée." }, 401);

    const file = form.get("file");
    const plantationId = String(form.get("plantation_id") || "").trim() || null;
    if (!(file instanceof File)) return json({ success: false, error: "Fichier manquant." }, 400);
    if (file.size <= 0 || file.size > MAX_SIZE) return json({ success: false, error: "Fichier trop volumineux. Maximum : 50 Mo." }, 413);

    const allowed = new Set([
      "image/jpeg","image/png","image/webp","image/heic","image/heif","image/gif",
      "video/mp4","video/webm","video/quicktime","video/mpeg",
      "application/pdf","text/plain","text/csv",
      "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]);
    if (!allowed.has(file.type)) return json({ success: false, error: "Type de fichier non autorisé." }, 415);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (plantationId) {
      const { data: p } = await supabase.from("plantations").select("id,client_id,parcelle_id").eq("id", plantationId).maybeSingle();
      if (!p) return json({ success: false, error: "Plantation introuvable." }, 404);
      if (p.client_id !== session.clientId) {
        const { data: c } = await supabase.from("clients").select("proprietaire_id,type_client").eq("id", session.clientId).maybeSingle();
        let allowedPlantation = false;
        if (c?.proprietaire_id) {
          const { data: parcel } = await supabase.from("parcelles").select("id").eq("id", p.parcelle_id).eq("proprietaire_id", c.proprietaire_id).maybeSingle();
          allowedPlantation = !!parcel;
        }
        if (!allowedPlantation && c?.type_client === "beneficiaire_particulier") {
          const { data: attribution } = await supabase.from("beneficiaire_attributions").select("id")
            .eq("client_id", session.clientId).eq("statut", "active")
            .or(`plantation_id.eq.${plantationId},parcelle_id.eq.${p.parcelle_id}`).limit(1).maybeSingle();
          allowedPlantation = !!attribution;
        }
        if (!allowedPlantation) return json({ success: false, error: "Plantation non autorisée." }, 403);
      }
    }

    const ext = safeName(file.name).split(".").pop() || "bin";
    const path = `${session.clientId}/${plantationId || "general"}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
      cacheControl: "31536000",
    });
    if (error) throw error;

    return json({
      success: true,
      bucket: BUCKET,
      path,
      name: file.name,
      type: file.type,
      size: file.size,
      optimized: file.type.startsWith("image/"),
    });
  } catch (error: any) {
    console.error("portal-message-upload", error);
    return json({ success: false, error: error?.message || "Upload impossible." }, 400);
  }
});
