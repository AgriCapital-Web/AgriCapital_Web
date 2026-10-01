import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated user to consume AI credits
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { messages, context, mode } = body;

    // Basic input validation
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return new Response(
        JSON.stringify({ error: "Messages invalides" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const totalChars = messages.reduce(
      (sum: number, m: any) => sum + (typeof m?.content === "string" ? m.content.length : 0),
      0
    );
    if (totalChars > 20000) {
      return new Response(
        JSON.stringify({ error: "Message trop long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // System prompt adapté selon le mode (CRM admin ou portail souscripteur)
    let systemPrompt = "";
    
    if (mode === "subscriber") {
      systemPrompt = `Tu es l'assistant IA du Portail Souscripteur AgriCapital. Tu aides les souscripteurs (partenaires agricoles) avec leurs questions sur:
- Leurs plantations (superficie, statut, localisation)
- Leurs paiements (Droit d'Accès, redevances mensuelles, arriérés)
- Leur portefeuille et statistiques
- Les offres AgriCapital (PalmElite, PalmInvest, TerraPalm - gratuit)
- Les procédures et démarches

Contexte du souscripteur connecté:
${context || "Aucun contexte disponible"}

Règles:
- Réponds toujours en français
- Sois concis, professionnel et chaleureux
- Utilise le nom du souscripteur quand disponible
- Pour les questions de paiement, oriente vers le bouton "Effectuer un paiement"
- Pour les problèmes techniques, oriente vers le support: +225 05 64 55 17 17
- Ne donne jamais d'informations sur d'autres souscripteurs
- L'offre TerraPalm est entièrement GRATUITE (DA et redevance à 0 FCFA)`;
    } else {
      systemPrompt = `Tu es l'assistant IA avancé du CRM AgriCapital, une plateforme de gestion agro-industrielle en Côte d'Ivoire. Tu aides les administrateurs, commerciaux, comptables et responsables avec:

- Analyse des données (souscripteurs, plantations, paiements, commissions)
- Aide à la prise de décision (tendances, alertes, recommandations)
- Guide d'utilisation des fonctionnalités du CRM
- Rédaction de rapports et synthèses
- Optimisation des processus métier

Contexte utilisateur:
${context || "Aucun contexte disponible"}

Règles:
- Réponds toujours en français
- Sois professionnel, analytique et proactif
- Fournis des données chiffrées quand possible
- Propose des actions concrètes
- Respecte la confidentialité des données
- L'offre TerraPalm est entièrement GRATUITE
- Le terme correct est "redevance mensuelle" (pas "redevance modulable")
- Les souscripteurs sont des partenaires agricoles`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes. Veuillez réessayer dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédit IA épuisé. Veuillez contacter l'administrateur." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
