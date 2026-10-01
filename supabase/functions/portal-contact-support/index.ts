import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error("Numéro de téléphone invalide.");
  return digits.replace(/^00/, "").replace(/^225(?=\d{8,})/, "").replace(/^0+/, "");
}
function normalizeName(value: unknown): string { return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 160); }
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Méthode non autorisée." }, 405);
  try {
    const body = await req.json();
    const nom = normalizeName(body?.nom_complet);
    const telephone = normalizePhone(body?.telephone);
    const message = String(body?.message ?? "").trim().slice(0, 4000);
    if (nom.length < 2) return json({ success: false, error: "Veuillez renseigner votre nom et prénom." }, 400);
    if (message.length < 5) return json({ success: false, error: "Veuillez décrire brièvement votre problème." }, 400);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data: clients, error: clientError } = await supabase.from("clients").select("id,nom_complet,telephone,email,compte_actif,statut_global").limit(100);
    if (clientError) throw clientError;
    const client = (clients || []).find((c: any) => { try { return normalizePhone(c.telephone) === telephone; } catch { return false; } });
    if (!client) return json({ success: false, code: "CLIENT_NOT_FOUND", error: "Ce numéro ne correspond pas à un dossier client AgriCapital. Vérifiez le numéro utilisé lors de votre contractualisation ou contactez directement notre équipe." }, 404);
    const subject = "Espace client inaccessible";
    const fullMessage = [`Objet : ${subject}`, "", `Nom déclaré : ${nom}`, `Téléphone contractualisé : ${client.telephone}`, "", message].join("\n");
    const { data: request, error: requestError } = await supabase.from("portail_support_requests").insert({ client_id: client.id, nom_complet: nom, telephone, objet: subject, message: fullMessage, statut: "ouvert", canal: "portail_public" }).select("id").single();
    if (requestError) throw requestError;
    const { error: messageError } = await supabase.from("portail_messages").insert({ client_id: client.id, auteur_type: "client", auteur_nom: nom, message: fullMessage, lu: false });
    if (messageError) console.error("portal-contact-support message insert:", messageError);
    return json({ success: true, request_id: request.id, message: "Votre demande a bien été transmise à l'équipe AgriCapital. Nous allons traiter votre demande." });
  } catch (error: any) {
    console.error("portal-contact-support:", error);
    return json({ success: false, error: error?.message || "Impossible d'envoyer votre demande." }, 500);
  }
});