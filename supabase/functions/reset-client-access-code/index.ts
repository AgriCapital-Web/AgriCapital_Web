import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: any, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const STAFF_ROLES = new Set([
  "super_admin", "pdg", "directeur_tc", "responsable_operations", "responsable_commercial",
  "chef_equipe_commercial", "chef_equipe_technique", "service_client",
  "chef_equipe_service_client", "comptable",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ success: false, error: "Authentification requise." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData } = await supabase.auth.getUser(auth.slice(7));
    if (!userData.user) return json({ success: false, error: "Session utilisateur invalide." }, 401);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!(roles || []).some((r: any) => STAFF_ROLES.has(r.role))) {
      return json({ success: false, error: "Vous n'avez pas l'autorisation de réinitialiser les codes d'accès." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const clientId = String(body.client_id || "").trim();
    if (!clientId) return json({ success: false, error: "Client requis." }, 400);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id,nom_complet,telephone,compte_actif,statut_global")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) return json({ success: false, error: "Client introuvable." }, 404);
    if (!client.compte_actif || client.statut_global !== "actif") {
      return json({ success: false, error: "Ce compte client n'est pas actif." }, 409);
    }

    const { error: deleteError } = await supabase
      .from("client_portal_access_codes")
      .delete()
      .eq("client_id", client.id);
    if (deleteError) throw deleteError;

    const { error: revokeError } = await supabase
      .from("client_portal_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", client.id)
      .is("revoked_at", null);
    if (revokeError) throw revokeError;

    const { error: auditError } = await supabase.from("historique_actions").insert({
      user_id: userData.user.id,
      client_id: client.id,
      entity_type: "client",
      entity_id: client.id,
      action: "PORTAL_ACCESS_CODE_RESET",
      details: {
        message: "Code d'accès portail réinitialisé. Le client devra créer un nouveau code à sa prochaine connexion.",
        performed_by: userData.user.email || userData.user.id,
      },
    });
    if (auditError) console.error("reset-client-access-code audit error", auditError.message);

    await supabase.rpc("notification_emit_event", {
      _event: "client_access_code_reset",
      _context: {
        client_id: client.id,
        reset_by_user_id: userData.user.id,
        reset_at: new Date().toISOString(),
      },
    });

    return json({
      success: true,
      client_id: client.id,
      client_name: client.nom_complet,
      telephone: client.telephone,
      message: "Code d'accès réinitialisé. Le client devra créer un nouveau code à sa prochaine connexion.",
    });
  } catch (error: any) {
    console.error("reset-client-access-code", error);
    return json({ success: false, error: error?.message || "Réinitialisation impossible." }, 400);
  }
});