import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-runtime",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const money = (n: unknown) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "XOF", maximumFractionDigits: 0,
}).format(Number(n || 0));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages, context, mode } = await req.json();
    const safeMessages = (Array.isArray(messages) ? messages : []).slice(-20)
      .map((m: any) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: String(m?.content ?? "").slice(0, 8000),
      })).filter((m) => m.content.length > 0);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!token || token === anonKey) return json({ error: "Non authentifié" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await service.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) return json({ error: "Session invalide" }, 401);

    // Les lectures métier utilisent le JWT de l'utilisateur : les RLS déterminent le périmètre réel.
    const db = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const [{ data: roles }, { data: profile }, { data: rolePermissions }] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", caller.id),
      db.from("profiles").select("nom_complet,email,poste,equipe_id,district_id,region_id,departement").eq("user_id", caller.id).maybeSingle(),
      db.from("user_roles").select("role,created_at").eq("user_id", caller.id),
    ]);
    const roleCodes = Array.from(new Set((roles || []).map((r: any) => String(r.role || "")).filter(Boolean)));
    const clientMode = mode === "client" || mode === "subscriber";
    if (!clientMode && !roleCodes.some((r) => r !== "user")) return json({ error: "Accès CRM non autorisé pour ce compte" }, 403);

    const globalRole = roleCodes.some((r) => r === "super_admin" || r === "pdg");
    const live: any = {
      generated_at: new Date().toISOString(),
      user: {
        name: profile?.nom_complet ?? null, role_codes: roleCodes, poste: profile?.poste ?? null,
        equipe_id: profile?.equipe_id ?? null, district_id: profile?.district_id ?? null,
        region_id: profile?.region_id ?? null, departement: profile?.departement ?? null,
        global_access: globalRole,
      },
      permission_scope: rolePermissions || [],
    };

    const [{ data: offers }, { data: configs }] = await Promise.all([
      db.from("offres").select("code,nom,famille_offre,formule_code,formule_nom,description,actif,duree_installation_mois,duree_production_ans,duree_paiement_mois,montant_pi_par_ha,montant_cash_par_ha,montant_total_par_ha,gestion_type,pourcentage_revenus_reverses,necessite_foncier_client,necessite_cotitulaire,contrat_acquisition_requis,contrat_accompagnement_requis").eq("actif", true).order("ordre"),
      db.from("configurations_systeme").select("cle,valeur,description,categorie,type_valeur,updated_at").order("categorie").order("cle"),
    ]);
    live.knowledge = {
      offers: offers || [],
      configurations: (configs || []).filter((c: any) => !/secret|key|token|password|api/i.test(String(c.cle || ""))),
    };

    if (clientMode) {
      const { data: clients } = await db.from("clients")
        .select("id,id_unique,nom_complet,statut,statut_global,formule_nom,formule_code,famille_offre,total_hectares,nombre_plantations,montant_total_contrat,montant_promo_applique,paiement_initial_montant,paiement_initial_paye_at,prochaine_echeance,phase_actuelle,contrat_debut_at,contrat_fin_at")
        .eq("user_id", caller.id);
      const ids = (clients || []).map((c: any) => c.id).filter(Boolean);
      const [{ data: plantations }, { data: payments }, { data: synthese }] = ids.length ? await Promise.all([
        db.from("plantations").select("id,id_unique,client_id,nom_plantation,superficie_ha,superficie_reellement_plantee,statut,statut_global,localite,village_nom,date_plantation,date_activation,prochaine_visite").in("client_id", ids),
        db.from("paiements").select("client_id,montant,montant_paye,type_paiement,mode_paiement,statut,date_paiement,date_echeance,reference,est_paiement_initial,est_depot_initial,numero_echeance").in("client_id", ids).order("date_paiement", { ascending: false, nullsFirst: false }).limit(100),
        db.from("v_client_synthese").select("*").in("client_id", ids),
      ]) : [{ data: [] }, { data: [] }, { data: [] }];
      live.client_scope = { clients: clients || [], plantations: plantations || [], payments: payments || [], synthese: synthese || [] };
    } else {
      const [clients, plantations, leads, docs, interventions, payments, synthese] = await Promise.all([
        db.from("clients").select("id,id_unique,nom_complet,statut,statut_global,formule_nom,formule_code,total_hectares,nombre_plantations,phase_actuelle,prochaine_echeance,created_at").order("created_at", { ascending: false }).limit(50),
        db.from("plantations").select("id,id_unique,client_id,superficie_ha,superficie_reellement_plantee,statut_global,region_id,localite,village_nom,date_plantation,date_activation,alerte_non_paiement,alerte_visite_retard").limit(300),
        db.from("leads").select("id,statut,assigned_to,converti_at,prochaine_relance_at,created_at").limit(300),
        db.from("documents_acquisition").select("id,client_id,statut,obligatoire,code_document,created_at").limit(300),
        db.from("interventions_techniques").select("id,client_id,plantation_id,type_intervention,statut,date_intervention").limit(500),
        db.from("paiements").select("client_id,montant,montant_paye,statut,date_paiement,date_echeance,type_paiement,mode_paiement,reference").order("date_paiement", { ascending: false, nullsFirst: false }).limit(300),
        db.from("v_client_synthese").select("*").limit(300),
      ]);
      const ps = payments.data || [];
      const valid = ps.filter((p: any) => p.statut === "valide" && Number(p.montant_paye ?? p.montant ?? 0) > 0);
      const collected = valid.reduce((s: number, p: any) => s + Number(p.montant_paye ?? p.montant ?? 0), 0);
      const overdue = ps.filter((p: any) => !["valide", "annule", "planifie"].includes(String(p.statut)) && p.date_echeance && new Date(p.date_echeance) <= new Date() && Number(p.montant_paye || 0) < Number(p.montant || 0));
      const contractRows = (synthese.data || []).filter((r: any) => Number(r.montant_total_contrat || 0) > 0);
      live.crm_scope = {
        counts: {
          clients_visible: clients.count ?? clients.data?.length ?? 0, plantations_visible: plantations.count ?? plantations.data?.length ?? 0,
          leads_visible: leads.count ?? leads.data?.length ?? 0, documents_visible: docs.count ?? docs.data?.length ?? 0,
          interventions_visible: interventions.count ?? interventions.data?.length ?? 0,
        },
        finance: { paiements_valides: valid.length, encaissements: collected, encaissements_formates: money(collected), paiements_en_retard: overdue.length },
        recent_clients_visible: clients.data || [], plantations_visible: plantations.data || [], synthese_contractuelle_visible: contractRows,
        documents_visible: docs.data || [], leads_visible: leads.data || [], interventions_visible: interventions.data || [],
      };
    }

    const systemPrompt = `Tu es l'assistant virtuel officiel d'AgriCapital SARL dans son CRM/Portail.
La base de connaissances ci-dessous est reconstruite à chaque question depuis les données actuelles. Elle doit donc suivre l'évolution réelle du projet, des offres, des configurations et des données visibles par l'utilisateur.

UTILISATEUR
Nom: ${profile?.nom_complet || "Utilisateur"}
Rôles: ${roleCodes.join(", ") || "client"}
Mode: ${clientMode ? "Portail client" : "CRM interne"}

RÈGLES ABSOLUES
1. Respecte strictement le périmètre de données retourné pour cet utilisateur. Les RLS Supabase sont la source de contrôle du périmètre.
2. Ne révèle jamais les données d'un autre client à un client.
3. Les offres, formules, prix et durées doivent venir de la base dynamique. N'utilise pas d'ancienne connaissance si la base actuelle dit autre chose.
4. Les paiements planifiés sont des échéances de fond propres au dossier/offre/formule : ils ne sont pas des encaissements et ne doivent pas être transformés en KPI global.
5. Un encaissement compte seulement si le paiement est réellement validé et positif.
6. Pour une question sur un client, une plantation ou un paiement, utilise d'abord les lignes individuelles visibles.
7. Pour une analyse, indique le périmètre et distingue réel/validé, planifié, restant dû et retard.
8. Si une donnée manque ou est contradictoire, dis-le. N'invente jamais une valeur.
9. Adapte tes réponses au rôle et aux permissions réellement visibles. Si l'utilisateur n'a pas accès à un module, explique simplement que ce module n'est pas dans son périmètre.
10. Ne prétends jamais avoir exécuté une action sans confirmation de l'application.
11. Réponds en français, de manière claire, concise et opérationnelle.

BASE DE CONNAISSANCES DYNAMIQUE
${JSON.stringify(live).slice(0, 100000)}

CONTEXTE FOURNI PAR L'APPLICATION
${String(context || "Aucun contexte supplémentaire disponible").slice(0, 12000)}`;

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: systemPrompt }, ...safeMessages], stream: true }),
    });
    if (!response.ok) {
      if (response.status === 429) return json({ error: "Trop de requêtes. Veuillez réessayer dans quelques instants." }, 429);
      if (response.status === 402) return json({ error: "Crédit IA épuisé. Veuillez contacter l'administrateur." }, 402);
      console.error("AI gateway error:", response.status, await response.text());
      return json({ error: "Erreur du service IA" }, 500);
    }
    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("AI assistant error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
