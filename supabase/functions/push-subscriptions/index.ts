import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function resolveOwner(admin: any, req: Request, body: any) {
  const portalToken = String(body?.access_token || req.headers.get("x-portal-session") || "");
  if (portalToken) {
    const tokenHash = await sha256(portalToken);
    const { data: session } = await admin.from("client_portal_sessions")
      .select("client_id,expires_at,revoked_at")
      .eq("token_hash", tokenHash).maybeSingle();
    if (session && !session.revoked_at && new Date(session.expires_at).getTime() > Date.now()) {
      return { client_id: session.client_id, user_id: null };
    }
  }

  const auth = req.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const { data } = await admin.auth.getUser(auth.slice(7));
    if (data.user) return { user_id: data.user.id, client_id: null };
  }

  throw new Error("Session non autorisée.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST requis." }, 405);

  try {
    const body = await req.json();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const action = String(body?.action || "config");

    if (action === "config") {
      const { data: vapid, error: vapidError } = await admin.rpc("notification_vapid_config");
      if (vapidError || !vapid?.public_key) {
        return json({ success: true, supported: false, public_key: null });
      }
      return json({ success: true, supported: true, public_key: vapid.public_key });
    }

    const owner = await resolveOwner(admin, req, body);

    if (action === "subscribe") {
      const subscription = body?.subscription;
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return json({ success: false, error: "Abonnement push invalide." }, 400);
      }

      const { error } = await admin.from("push_subscriptions").upsert({
        user_id: owner.user_id,
        client_id: owner.client_id,
        endpoint: String(subscription.endpoint),
        p256dh: String(subscription.keys.p256dh),
        auth: String(subscription.keys.auth),
        content_encoding: String(subscription.contentEncoding || "aes128gcm"),
        user_agent: req.headers.get("user-agent") || null,
        active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });

      if (error) throw error;
      return json({ success: true });
    }

    if (action === "unsubscribe") {
      const endpoint = String(body?.endpoint || "");
      if (!endpoint) return json({ success: false, error: "Endpoint requis." }, 400);

      let query = admin.from("push_subscriptions").update({
        active: false,
        updated_at: new Date().toISOString(),
      }).eq("endpoint", endpoint);

      if (owner.client_id) query = query.eq("client_id", owner.client_id);
      if (owner.user_id) query = query.eq("user_id", owner.user_id);

      const { error } = await query;
      if (error) throw error;
      return json({ success: true });
    }

    return json({ success: false, error: "Action inconnue." }, 400);
  } catch (error: any) {
    console.error("push-subscriptions:", error);
    return json({ success: false, error: error?.message || "Erreur serveur." }, 500);
  }
});