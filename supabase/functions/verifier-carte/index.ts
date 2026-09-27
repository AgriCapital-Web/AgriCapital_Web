import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let code = url.searchParams.get("code") ?? "";
    if (!code && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      code = typeof body?.code === "string" ? body.code : "";
    }
    code = code.trim();

    if (!/^[A-Za-z0-9-]{6,64}$/.test(code)) {
      return new Response(JSON.stringify({ valide: false, error: "Code invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const sourceIp = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 120);
    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const { count } = await admin.from("rate_limits").select("*", { count: "exact", head: true })
      .eq("identifier", sourceIp).eq("action", "card_verification").gt("first_attempt_at", since);
    if ((count || 0) >= 30) {
      return new Response(JSON.stringify({ valide: false, error: "Trop de requêtes" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await admin.from("rate_limits").insert({ identifier: sourceIp, action: "card_verification" });

    const { data, error } = await admin.rpc("verifier_carte", { _code: code });
    if (error) {
      console.error("verifier-carte rpc error", error.message);
      return new Response(JSON.stringify({ valide: false, error: "Vérification impossible" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const carte = Array.isArray(data) ? data[0] : data;
    if (!carte) {
      return new Response(JSON.stringify({ valide: false, error: "Carte inconnue" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ valide: carte.valide === true, carte }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verifier-carte error", e);
    return new Response(JSON.stringify({ valide: false, error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
