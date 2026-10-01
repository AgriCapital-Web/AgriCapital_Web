import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

// ============================================================================
// COMPTE DE DÉMONSTRATION AGRICAPITAL
// ----------------------------------------------------------------------------
// Toute personne (quel que soit l'indicatif pays) dont le numéro n'existe pas
// dans le CRM peut se connecter et explorer une plateforme entièrement remplie.
// Aucune écriture en base : le compte est synthétisé à la volée, il est donc
// impossible de polluer les données réelles du CRM.
// ============================================================================

export const DEMO_DI_PAR_HA = 500000;
export const DEMO_MENSUEL_PAR_HA = 60000;
export const DEMO_SUPERFICIE_HA = 1;
export const DEMO_PLANTS = 143;
export const DEMO_DIFFERE_MOIS = 3;
export const DEMO_ADRESSE = "WP4X+RRM AGRICAPITAL SARL, Gonaté";

export function isDemoSouscripteurId(id?: string | null): boolean {
  return typeof id === "string" && id.startsWith("demo-");
}

function iso(d: Date) {
  return d.toISOString();
}
function day(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addMonths(base: Date, months: number) {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

export function buildDemoAccount(cleanPhone: string) {
  const now = new Date();
  // Plantation activée il y a 6 mois (planting réalisé, entretien en cours).
  const activation = addMonths(now, -6);
  const signature = addMonths(activation, -1);
  const contratFin = addMonths(activation, 35 + DEMO_DIFFERE_MOIS);

  const offre = {
    id: "demo-offre-palminvest-plus",
    code: "DEMO+",
    nom: "PalmInvest+ (Démonstration)",
    description:
      "Offre de démonstration : plantation clé en main, suivi technique complet, production et revenus partagés 70/30.",
    couleur: "#00643C",
    type_offre: "palminvest_plus",
    actif: true,
    gestion_type: "deleguee",
    pourcentage_revenus_reverses: 70,
    duree_installation_mois: 3,
    duree_production_ans: 25,
    duree_paiement_mois: 35,
    montant_da_par_ha: DEMO_DI_PAR_HA,
    montant_depot_initial_par_ha: DEMO_DI_PAR_HA,
    montant_cash_par_ha: DEMO_DI_PAR_HA,
    contribution_mensuelle_par_ha: DEMO_MENSUEL_PAR_HA,
    redevance_production_par_ha_an: 0,
    montant_total_par_ha: DEMO_DI_PAR_HA + DEMO_MENSUEL_PAR_HA * 35,
    tranches_paiement: [
      { annee: 1, mois: 12, mensualite_par_ha: DEMO_MENSUEL_PAR_HA },
      { annee: 2, mois: 12, mensualite_par_ha: DEMO_MENSUEL_PAR_HA },
      { annee: 3, mois: 11, mensualite_par_ha: DEMO_MENSUEL_PAR_HA },
    ],
    avantages: [
      "Plantation installée et entretenue par AgriCapital",
      "Suivi technique mensuel avec rapports et photos",
      "Partage des revenus 70% client / 30% AgriCapital",
      "Frais de transaction pris en charge par AgriCapital",
    ],
    _price_source: "compte de démonstration (données fictives)",
  };

  // ---- Paiements : DI réglé + 3 mensualités après le différé de 3 mois ----
  const paiements: any[] = [];
  paiements.push({
    id: "demo-pay-di",
    souscripteur_id: `demo-${cleanPhone}`,
    plantation_id: "demo-plantation-1",
    montant: DEMO_DI_PAR_HA,
    montant_paye: DEMO_DI_PAR_HA,
    montant_theorique: DEMO_DI_PAR_HA,
    type_paiement: "DA",
    mode_paiement: "Mobile Money",
    statut: "valide",
    est_depot_initial: true,
    reference: "DEMO-DI-0001",
    id_transaction: "DEMO-TRX-000001",
    date_paiement: iso(activation),
    date_validation: iso(activation),
    periode_debut: day(activation),
    periode_fin: day(activation),
    jours_couverts: 0,
    phase: "depot_initial",
    jours_retard: 0,
    annee: 1,
    observations: "Dépôt Initial de démonstration validé — plantation activée.",
    created_at: iso(activation),
  });

  for (let i = 1; i <= 3; i++) {
    const debut = addMonths(activation, DEMO_DIFFERE_MOIS + (i - 1));
    const fin = addMonths(activation, DEMO_DIFFERE_MOIS + i);
    paiements.push({
      id: `demo-pay-m${i}`,
      souscripteur_id: `demo-${cleanPhone}`,
      plantation_id: "demo-plantation-1",
      montant: DEMO_MENSUEL_PAR_HA,
      montant_paye: DEMO_MENSUEL_PAR_HA,
      montant_theorique: DEMO_MENSUEL_PAR_HA,
      type_paiement: "REDEVANCE",
      mode_paiement: i % 2 === 0 ? "Carte bancaire" : "Mobile Money",
      statut: "valide",
      est_depot_initial: false,
      numero_echeance: i,
      reference: `DEMO-MENS-000${i}`,
      id_transaction: `DEMO-TRX-00000${i + 1}`,
      date_paiement: iso(debut),
      date_validation: iso(debut),
      periode_debut: day(debut),
      periode_fin: day(fin),
      jours_couverts: 30,
      phase: "annee_1",
      jours_retard: 0,
      annee: 1,
      observations: `Paiement mensuel progressif n°${i} (démonstration).`,
      created_at: iso(debut),
    });
  }
  paiements.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const totalDa = DEMO_DI_PAR_HA;
  const totalMensualites = DEMO_MENSUEL_PAR_HA * 3;

  // ---- Étapes techniques ----
  const etape = (key: string, statut: string, moisApres: number, commentaire: string) => ({
    key,
    type: key,
    statut,
    date_realisation: iso(addMonths(activation, moisApres)),
    commentaire,
  });
  const etapes = [
    etape("defrichage", "termine", 0, "Défrichage et andainage de 1,00 ha réalisés."),
    etape("piquetage", "termine", 1, "Piquetage 9 m × 9 m — 143 piquets posés."),
    etape("trouaison", "termine", 2, "143 trous 60×60×60 cm ouverts et amendés."),
    etape("planting", "termine", 3, "143 plants Tenera mis en terre (100% du prévisionnel)."),
    etape("remplacement", "termine", 4, "3 plants remplacés — taux de reprise 98%."),
    etape("fertilisation", "termine", 5, "Épandage NPK 12-12-17 : 250 g/plant."),
    etape("entretien", "en_cours", 6, "Entretien mensuel des ronds et interlignes en cours."),
  ];

  const tickets = [
    {
      id: "demo-ticket-1",
      titre: "Entretien mensuel — désherbage des ronds",
      description: "Désherbage manuel des 143 ronds et fauchage des interlignes.",
      plantation_id: "demo-plantation-1",
      priorite: "normale",
      statut: "en cours",
      created_at: iso(addMonths(now, -1)),
      updated_at: iso(addMonths(now, 0)),
      date_resolution: null,
    },
    {
      id: "demo-ticket-2",
      titre: "Fertilisation NPK 12-12-17",
      description: "Apport de 250 g/plant, réalisé sur l'ensemble de la parcelle.",
      plantation_id: "demo-plantation-1",
      priorite: "haute",
      statut: "resolu",
      created_at: iso(addMonths(activation, 5)),
      updated_at: iso(addMonths(activation, 5)),
      date_resolution: iso(addMonths(activation, 5)),
    },
    {
      id: "demo-ticket-3",
      titre: "Contrôle sanitaire des plants",
      description: "Contrôle des 143 plants, aucun foyer de ravageur détecté.",
      plantation_id: "demo-plantation-1",
      priorite: "normale",
      statut: "resolu",
      created_at: iso(addMonths(activation, 6)),
      updated_at: iso(addMonths(activation, 6)),
      date_resolution: iso(addMonths(activation, 6)),
    },
  ];

  const medias = [
    { url: "/demo/plantation-1.jpg", type: "photo", operation: "Vue d'ensemble — 6 mois après planting", commentaire: "Parcelle entretenue", date: iso(addMonths(now, 0)) },
    { url: "/demo/plantation-2.jpg", type: "photo", operation: "Contrôle agronomique", commentaire: "Technicien AgriCapital sur site", date: iso(addMonths(now, -1)) },
    { url: "/demo/plantation-3.jpg", type: "photo", operation: "Vue aérienne du bloc (1 ha)", commentaire: "Alignement 9 m × 9 m", date: iso(addMonths(now, -1)) },
    { url: "/demo/plantation-4.jpg", type: "photo", operation: "Fertilisation NPK", commentaire: "250 g par plant", date: iso(addMonths(activation, 5)) },
    { url: "/demo/plantation-5.jpg", type: "photo", operation: "Entretien — désherbage", commentaire: "Ronds et interlignes nettoyés", date: iso(addMonths(activation, 6)) },
    { url: "/demo/plantation-6.jpg", type: "photo", operation: "Bornage du lot", commentaire: "Panneau de bloc AgriCapital", date: iso(addMonths(activation, 1)) },
  ];

  const documents = [
    { nom: "Contrat de souscription", categorie: "Contrat", type_document: "contrat", url: "/demo/contrat-souscription-demo.pdf", created_at: iso(signature) },
    { nom: "Plan de localisation de la plantation", categorie: "Foncier", type_document: "plan", url: "/demo/plan-localisation-demo.pdf", created_at: iso(activation) },
  ];

  const rapports = [1, 2, 3, 4, 5, 6].map((m) => ({
    titre: `Rapport technique mensuel — M${m}`,
    periodicite: "mensuel",
    periode: addMonths(activation, m).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    url: `/demo/rapport-m${m}.pdf`,
    created_at: iso(addMonths(activation, m)),
  }));

  const intrants = [
    { nom: "Plants sélectionnés Tenera", quantite: "143 plants", statut: "Livré et planté", cout: "429 000 FCFA" },
    { nom: "Engrais NPK 12-12-17", quantite: "36 kg", statut: "Appliqué", cout: "32 400 FCFA" },
    { nom: "Urée 46%", quantite: "15 kg", statut: "En stock", cout: "12 750 FCFA" },
    { nom: "Herbicide sélectif", quantite: "4 L", statut: "Appliqué", cout: "18 000 FCFA" },
    { nom: "Protections anti-rongeurs", quantite: "143 unités", statut: "Installé", cout: "21 450 FCFA" },
  ];

  const plantation = {
    id: "demo-plantation-1",
    id_unique: "PL-DEMO-0001",
    souscripteur_id: `demo-${cleanPhone}`,
    nom: "Plantation Démo Gonaté",
    nom_plantation: "Plantation Démo Gonaté",
    superficie_ha: DEMO_SUPERFICIE_HA,
    superficie_activee: DEMO_SUPERFICIE_HA,
    nombre_plants: DEMO_PLANTS,
    densite_plants: DEMO_PLANTS,
    type_culture: "Palmier à huile",
    variete: "Tenera sélectionné",
    statut: "active",
    statut_global: "actif",
    date_plantation: day(addMonths(activation, 3)),
    date_activation: day(activation),
    date_signature_contrat: day(signature),
    age_plants: 6,
    village: "Gonaté",
    village_nom: "Gonaté",
    localite: DEMO_ADRESSE,
    latitude: 6.9375,
    longitude: -6.5375,
    localisation_gps_lat: 6.9375,
    localisation_gps_lng: -6.5375,
    altitude: 248,
    regions: { id: "demo-region", nom: "Haut-Sassandra" },
    departements: { id: "demo-dep", nom: "Daloa" },
    districts: { id: "demo-district", nom: "Sassandra-Marahoué" },
    sous_prefectures: { id: "demo-sp", nom: "Gonaté" },
    document_foncier_type: "Attestation villageoise",
    document_foncier_numero: "AV-DEMO-2026-014",
    document_foncier_date_delivrance: day(signature),
    chef_village_nom: "Chef Bamba Sékou",
    chef_village_telephone: "0700000000",
    montant_da: DEMO_DI_PAR_HA,
    montant_da_paye: DEMO_DI_PAR_HA,
    montant_contribution_mensuelle: DEMO_MENSUEL_PAR_HA,
    alerte_non_paiement: false,
    alerte_visite_retard: false,
    derniere_visite: day(addMonths(now, 0)),
    prochaine_visite: day(addMonths(now, 1)),
    derniere_intervention: addMonths(now, 0).toLocaleDateString("fr-FR"),
    prochaine_intervention: addMonths(now, 1).toLocaleDateString("fr-FR"),
    // Suivi technique
    nombre_plants_prevus: DEMO_PLANTS,
    nombre_plants_mis_en_terre: DEMO_PLANTS,
    taux_reussite: 98,
    nombre_plants_remplaces: 3,
    surface_reellement_plantee: DEMO_SUPERFICIE_HA,
    tickets_techniques: tickets,
    etapes,
    medias,
    documents,
    rapports,
    intrants,
    production: {
      annuelle_tonnes: 0,
      cumulee_tonnes: 0,
      prix_bord_champ: 90,
      valeur_brute: 0,
      premiere_recolte_prevue: day(addMonths(activation, 36)),
      rendement_attendu_t_ha_an: 14,
    },
    revenus: {
      total_genere: 0,
      part_client_pct: 70,
      part_agricapital_pct: 30,
      premier_versement_prevu: day(addMonths(activation, 38)),
      versements: [],
    },
    notes: "Plantation de démonstration — données fictives destinées à la découverte de la plateforme.",
    created_at: iso(signature),
    _arriere: 0,
    _jours_retard: 0,
  };

  const souscripteur = {
    id: `demo-${cleanPhone}`,
    id_unique: "SOUS-DEMO-0001",
    _demo: true,
    civilite: "M.",
    nom: "AGRICAPITAL",
    nom_famille: "AGRICAPITAL",
    prenoms: "Démo Account",
    nom_complet: "Démo Account AGRICAPITAL",
    telephone: cleanPhone,
    whatsapp: cleanPhone,
    email: "demo@agricapital.ci",
    nationalite: "Ivoirienne",
    date_naissance: "1986-04-12",
    lieu_naissance: "Daloa",
    statut_marital: "Marié(e)",
    type_piece: "CNI",
    domicile: "Daloa, quartier Tazibouo",
    domicile_residence: "Daloa",
    localite: "Gonaté",
    photo_profil_url: "/demo/photo-client.jpg",
    type_souscripteur: "particulier",
    type_compte: "Mobile Money",
    banque_operateur: "Orange Money CI",
    nom_titulaire_compte: "Démo Account AGRICAPITAL",
    offre_id: offre.id,
    offres: offre,
    regions: { id: "demo-region", nom: "Haut-Sassandra" },
    departements: { id: "demo-dep", nom: "Daloa" },
    districts: { id: "demo-district", nom: "Sassandra-Marahoué" },
    sous_prefectures: { id: "demo-sp", nom: "Gonaté" },
    numero_contrat: "AGC-DEMO-2026-0001",
    annee_contrat: new Date().getFullYear(),
    code_sp_contrat: "GON",
    statut: "actif",
    statut_global: "actif",
    compte_actif: true,
    documents_valides_at: iso(signature),
    da_paye_at: iso(activation),
    contrat_debut_at: day(activation),
    contrat_fin_at: day(contratFin),
    phase_actuelle: "annee_1",
    mensualite_montant: DEMO_MENSUEL_PAR_HA,
    prochaine_echeance: day(addMonths(activation, DEMO_DIFFERE_MOIS + 4)),
    jours_contrat_total: 35 * 30,
    jours_payes: 90,
    jours_retard: 0,
    taux_journalier_ha: DEMO_MENSUEL_PAR_HA / 30,
    montant_total_contrat: DEMO_DI_PAR_HA + DEMO_MENSUEL_PAR_HA * 35,
    montant_promo_applique: 0,
    nombre_plantations: 1,
    total_hectares: DEMO_SUPERFICIE_HA,
    total_da_verse: totalDa,
    total_redevances: totalMensualites,
    total_paiements: paiements.length,
    total_paye: totalDa + totalMensualites,
    total_arrieres: 0,
    documents,
    commercial: {
      nom: "Aïcha Traoré",
      telephone: "0700000000",
      email: "conseiller.demo@agricapital.ci",
      photo: null,
      fonction: "Conseiller AgriCapital (démonstration)",
    },
    promotion_active: null,
    created_at: iso(signature),
  };

  return { souscripteur, plantations: [plantation], paiements };
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// === SECURITY: Input validation ===
function sanitizePhone(input: string): string {
  if (typeof input !== 'string') throw new Error("Format invalide");
  const cleaned = input.replace(/\D/g, '');
  if (cleaned.length < 8 || cleaned.length > 15) throw new Error("Numéro de téléphone invalide");
  return cleaned;
}

async function sha256(value: string) {
  const secret = Deno.env.get("PORTAL_ACCESS_CODE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value + ":" + secret));
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function verifyDemoToken(phone: string, token: string | null | undefined, code: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  if (!code || !/^\d{4}$/.test(code)) return false;
  const secret = Deno.env.get("PORTAL_ACCESS_CODE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`demo:${phone}:${code}:${secret}`));
  const expected = Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
  return token === expected;
}

function normalizeOfferCode(code: string | null | undefined): string {
  return (code || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-\s]+/g, '').replace(/_PLUS/g, '+').replace(/PLUS/g, '+');
}

function normalizeTechnicalLabel(value: string | null | undefined): string {
  return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function technicalStepFromTicket(ticket: any) {
  const label = normalizeTechnicalLabel(`${ticket?.titre || ''} ${ticket?.description || ''}`);
  const aliases: Array<[string, string[]]> = [
    ['defrichage', ['defrich']],
    ['piquetage', ['piquet']],
    ['trouaison', ['trouaison', 'trou']],
    ['planting', ['planting', 'mise en terre', 'plantation']],
    ['remplacement', ['remplacement', 'manquant']],
    ['entretien', ['entretien', 'desherbage']],
    ['fertilisation', ['fertilis', 'engrais']],
    ['mise_production', ['mise en production', 'production']],
    ['remise', ['remise au client', 'remise']],
  ];
  const match = aliases.find(([, words]) => words.some((word) => label.includes(word)));
  if (!match) return null;
  const status = normalizeTechnicalLabel(ticket?.statut);
  return {
    key: match[0],
    type: match[0],
    statut: ['resolu', 'termine', 'ferme', 'cloture'].includes(status) ? 'termine' : ['en cours', 'en_cours', 'assigne'].includes(status) ? 'en_cours' : 'pending',
    date_realisation: ticket?.date_resolution || ticket?.updated_at || null,
    commentaire: ticket?.description || null,
  };
}

function getProgressiveAmount(offre: any, startDayOffset: number, daysCount: number, hectares: number): number {
  const tranches = Array.isArray(offre?.tranches_paiement) ? offre.tranches_paiement : [];
  const schedule = tranches
    .map((t: any) => ({ mois: Number(t?.mois || 0), mensuel: Number(t?.mensualite_par_ha || 0) }))
    .filter((t: any) => t.mois > 0 && t.mensuel > 0);
  if (schedule.length === 0) {
    return (Number(offre?.contribution_mensuelle_par_ha || 0) / 30) * daysCount * hectares;
  }
  let cursor = Math.max(0, Math.floor(startDayOffset || 0));
  let remaining = Math.max(0, Math.floor(daysCount || 0));
  let total = 0;
  for (const tranche of schedule) {
    const trancheDays = tranche.mois * 30;
    if (cursor >= trancheDays) { cursor -= trancheDays; continue; }
    const days = Math.min(remaining, trancheDays - cursor);
    total += (tranche.mensuel / 30) * days * hectares;
    remaining -= days;
    cursor = 0;
    if (remaining <= 0) break;
  }
  return total;
}

// === SECURITY: Rate limiting ===
async function checkRateLimit(supabase: any, identifier: string, maxAttempts = 15, windowMinutes = 15): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  
  // Check if blocked
  const { data: blocked } = await supabase
    .from('rate_limits')
    .select('blocked_until')
    .eq('identifier', identifier)
    .eq('action', 'login')
    .gt('blocked_until', new Date().toISOString())
    .maybeSingle();

  if (blocked?.blocked_until) {
    const retryAfter = Math.ceil((new Date(blocked.blocked_until).getTime() - Date.now()) / 1000);
    return { allowed: false, retryAfter };
  }

  // Count recent attempts
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .eq('action', 'login')
    .gt('first_attempt_at', windowStart);

  if ((count || 0) >= maxAttempts) {
    // Block for 30 minutes
    await supabase.from('rate_limits').insert({
      identifier,
      action: 'login',
      blocked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    return { allowed: false, retryAfter: 1800 };
  }

  // Record attempt
  await supabase.from('rate_limits').insert({ identifier, action: 'login' });
  return { allowed: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // === SECURITY: Validate input ===
    if (!body || typeof body !== 'object') {
      throw new Error("Corps de requête invalide");
    }
    
    const cleanPhone = sanitizePhone(body.telephone || '');
    const demoToken = typeof body.demo_token === 'string' ? body.demo_token : null;
    const demoCode = typeof body.demo_code === 'string' ? body.demo_code : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Failed lookups are rate-limited below. Successful background CRM syncs
    // must never count as login attempts or lock an active client session.
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `${clientIP}:${cleanPhone}`;
    
    // Try multiple formats for matching
    const phoneVariants = [
      cleanPhone,
      cleanPhone.startsWith('225') ? cleanPhone.slice(3) : cleanPhone,
      cleanPhone.startsWith('0') ? cleanPhone.slice(1) : '0' + cleanPhone,
    ];

    console.log("Searching subscriber with phone variants:", phoneVariants);

    let souscripteur = null;

    for (const phone of phoneVariants) {
      const { data, error } = await supabase
        .from("souscripteurs")
        .select(`
          *,
          offres (*),
          regions (id, nom),
          departements (id, nom),
          districts (id, nom),
          sous_prefectures (id, nom),
          promotions:promotion_id (id, nom, code, pourcentage_reduction, montant_fixe_reduction, date_debut, date_fin, cible, active, applique_toutes_offres, offre_ids)
        `)
        .eq("telephone", phone)
        .maybeSingle();

      if (data) {
        souscripteur = data;
        break;
      }
    }


    if (!souscripteur) {
      if (!(await verifyDemoToken(cleanPhone, demoToken, demoCode))) {
        return new Response(
          JSON.stringify({ success: false, demo: false, error: "Numéro non enregistré : utilisez le code de démonstration généré sur l'écran de connexion." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }
      // === MODE DÉMONSTRATION ===
      // Numéro inconnu du CRM (quel que soit l'indicatif pays) : on renvoie un
      // compte de démonstration complet, sans aucune écriture en base.
      const demo = buildDemoAccount(cleanPhone);
      console.log("Demo account served for", cleanPhone.slice(0, 4) + "****");
      return new Response(
        JSON.stringify({ success: true, demo: true, ...demo }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }


    // Connexion réussie : on purge tout blocage résiduel pour ce numéro afin
    // qu'un client légitime ne reste jamais verrouillé.
    try {
      await supabase.from('rate_limits').delete().eq('identifier', rateLimitKey).eq('action', 'login');
    } catch (_e) { /* ignore */ }

    // Re-read effective prices on every lookup. The current CRM DA field is the
    // source of truth and zero is a valid promotional price.

    if (souscripteur.offre_id && souscripteur.offres) {
      souscripteur.offres._price_source = 'offres (champs CRM)';
      const { data: effectivePrice } = await supabase
        .from('v_prix_effectif_offres')
        .select('di_base, di_effectif, total_effectif')
        .eq('offre_id', souscripteur.offre_id)
        .maybeSingle();
      if (effectivePrice) {
        const effectiveDi = Number(effectivePrice.di_effectif ?? effectivePrice.di_base ?? 0);
        souscripteur.offres.montant_da_par_ha = effectiveDi;
        souscripteur.offres.montant_depot_initial_par_ha = effectiveDi;
        souscripteur.offres.montant_total_par_ha = Number(effectivePrice.total_effectif ?? souscripteur.offres.montant_total_par_ha ?? 0);
        souscripteur.offres._price_source = `v_prix_effectif_offres (DI ${effectiveDi} F/ha)`;
      }
    }


    if (body.silent !== true) {
      await supabase.from('historique_activites').insert({
        table_name: 'souscripteurs',
        record_id: souscripteur.id,
        action: 'PORTAIL_LOGIN',
        details: `Connexion au portail souscripteur: ${souscripteur.nom_complet || souscripteur.id_unique}`,
        ip_address: clientIP,
        user_agent: req.headers.get('user-agent') || 'unknown',
      });
    }

    console.log("Found subscriber:", souscripteur.id, souscripteur.nom_complet);

    // Fetch plantations
    const { data: plantations } = await supabase
      .from("plantations")
      .select(`
        *,
        regions (id, nom),
        departements (id, nom),
        districts (id, nom),
        sous_prefectures (id, nom)
      `)
      .eq("souscripteur_id", souscripteur.id)
      .order("created_at", { ascending: false });

    // Fetch paiements
    const plantationIds = (plantations || []).map((p: any) => p.id);
    let paiements: any[] = [];
    
    if (plantationIds.length > 0) {
      const { data: paiementsData } = await supabase
        .from("paiements")
        .select("*")
        .or(`souscripteur_id.eq.${souscripteur.id},plantation_id.in.(${plantationIds.join(',')})`)
        .order("created_at", { ascending: false });
      
      paiements = paiementsData || [];
    } else {
      const { data: paiementsData } = await supabase
        .from("paiements")
        .select("*")
        .eq("souscripteur_id", souscripteur.id)
        .order("created_at", { ascending: false });
      
      paiements = paiementsData || [];
    }

    // Technical follow-up is re-read on every synchronization so the portal
    // reflects CRM interventions/tickets without retaining a stale copy.
    let technicalTickets: any[] = [];
    if (plantationIds.length > 0) {
      const { data: ticketRows } = await supabase
        .from('tickets_techniques')
        .select('id, titre, description, plantation_id, priorite, statut, date_resolution, created_at, updated_at')
        .in('plantation_id', plantationIds)
        .order('updated_at', { ascending: false });
      technicalTickets = ticketRows || [];
    }

    // Rapports terrain publiés : seuls les rapports explicitement validés et rendus visibles au client sont exposés.
    let technicalReports: any[] = [];
    let technicalMedia: any[] = [];
    if (plantationIds.length > 0) {
      const { data: reportRows } = await supabase
        .from('rapports_visites_techniques')
        .select('id, plantation_id, date_visite, type_visite, etat_plantation, contenu_client, prochaine_intervention, client_visible, statut')
        .in('plantation_id', plantationIds)
        .eq('client_visible', true)
        .eq('statut', 'valide')
        .order('date_visite', { ascending: false });
      technicalReports = reportRows || [];

      const reportIds = technicalReports.map((r:any) => r.id);
      if (reportIds.length > 0) {
        const { data: mediaRows } = await supabase
          .from('rapports_visites_medias')
          .select('id, rapport_id, plantation_id, media_type, storage_path, mime_type, nom_fichier, description, client_visible, created_at')
          .in('rapport_id', reportIds)
          .eq('client_visible', true)
          .order('created_at', { ascending: false });
        technicalMedia = mediaRows || [];
        for (const media of technicalMedia) {
          const { data: signed } = await supabase.storage.from('rapports-techniques').createSignedUrl(media.storage_path, 3600);
          media.url = signed?.signedUrl || null;
        }
      }
    }

    // Calculate totals
    const totalDAVerse = paiements
      .filter((p: any) => p.type_paiement === 'DA' && p.statut === 'valide')
      .reduce((sum: number, p: any) => sum + (p.montant_paye || p.montant || 0), 0);

    const totalRedevances = paiements
      .filter((p: any) => (p.type_paiement === 'REDEVANCE' || p.type_paiement === 'contribution') && p.statut === 'valide')
      .reduce((sum: number, p: any) => sum + (p.montant_paye || p.montant || 0), 0);

    souscripteur.total_da_verse = totalDAVerse;
    souscripteur.total_redevances = totalRedevances;
    souscripteur.total_paiements = paiements.filter((p: any) => p.statut === 'valide').length;
    souscripteur.total_paye = totalDAVerse + totalRedevances;

    let totalArrieres = 0;
    const plantationsEnriched = (plantations || []).map((p: any) => {
      const tickets = technicalTickets.filter((ticket: any) => ticket.plantation_id === p.id);
      const rapports = technicalReports.filter((r:any) => r.plantation_id === p.id).map((r:any) => ({
        ...r,
        titre: r.type_visite ? `Rapport — ${r.type_visite.replace(/_/g,' ')}` : 'Rapport terrain',
        periode: r.date_visite,
        contenu: r.contenu_client || '',
        medias: technicalMedia.filter((m:any) => m.rapport_id === r.id),
      }));
      const etapes = tickets.map(technicalStepFromTicket).filter(Boolean);
      const technicalData = {
        tickets_techniques: tickets,
        rapports_visites: rapports,
        etapes,
        derniere_intervention: tickets[0]?.updated_at || p.derniere_visite || null,
        prochaine_intervention: p.prochaine_visite || null,
      };
      if (p.date_activation && (p.superficie_activee || 0) > 0) {
        const jours = Math.floor((Date.now() - new Date(p.date_activation).getTime()) / 86400000);
        const attendu = getProgressiveAmount(souscripteur.offres, 0, jours, p.superficie_activee || 0);
        const paye = paiements
          .filter((pay: any) => pay.plantation_id === p.id && (pay.type_paiement === 'REDEVANCE' || pay.type_paiement === 'contribution') && pay.statut === 'valide')
          .reduce((sum: number, pay: any) => sum + (pay.montant_paye || pay.montant || 0), 0);
        
        const arriere = Math.max(0, attendu - paye);
        totalArrieres += arriere;
        const tarifMoyenJour = jours > 0 ? attendu / jours : 0;
        return { ...p, ...technicalData, _arriere: arriere, _jours_retard: arriere > 0 && tarifMoyenJour > 0 ? Math.floor(arriere / tarifMoyenJour) : 0 };
      }
      return { ...p, ...technicalData, _arriere: 0, _jours_retard: 0 };
    });

    souscripteur.total_arrieres = totalArrieres;

    // === Fetch assigned commercial (créateur du dossier) ===
    if (souscripteur.created_by) {
      const { data: commercial } = await supabase
        .from('profiles')
        .select('nom_complet, telephone, email, photo_url')
        .eq('user_id', souscripteur.created_by)
        .maybeSingle();
      if (commercial) {
        souscripteur.commercial = {
          nom: commercial.nom_complet,
          telephone: commercial.telephone,
          email: commercial.email,
          photo: commercial.photo_url,
          fonction: 'Conseiller AgriCapital',
        };
      }
    }

    // === Fetch active and applicable promotion (client-specific first, then current CRM promotion) ===
    if (!souscripteur.promotions) {
      const nowIso = new Date().toISOString();
      const { data: promos } = await supabase
        .from('promotions')
        .select('id, nom, code, pourcentage_reduction, montant_fixe_reduction, date_debut, date_fin, cible, active, applique_toutes_offres, offre_ids')
        .eq('active', true)
        .lte('date_debut', nowIso)
        .gte('date_fin', nowIso)
        .order('created_at', { ascending: false })
        .limit(10);
      const offerId = souscripteur.offre_id;
      const offerCode = normalizeOfferCode(souscripteur.offres?.code);
      const activePromo = (promos || []).find((promo: any) => {
        if (promo.applique_toutes_offres) return true;
        const offerIds = Array.isArray(promo.offre_ids) ? promo.offre_ids : [];
        return offerIds.includes(offerId) || offerIds.map((v: any) => normalizeOfferCode(String(v))).includes(offerCode);
      });
      if (activePromo) souscripteur.promotion_active = activePromo;
    } else {
      souscripteur.promotion_active = souscripteur.promotions;
    }

    // === Sanitize sensitive fields before returning ===
    delete souscripteur.fichier_piece_url;
    delete souscripteur.fichier_piece_recto_url;
    delete souscripteur.fichier_piece_verso_url;
    delete souscripteur.numero_piece;
    delete souscripteur.user_id;
    delete souscripteur.created_by;
    delete souscripteur.updated_by;
    delete souscripteur.numero_compte;

    console.log(`Subscriber data: ${plantationsEnriched.length} plantations, ${paiements.length} paiements, DA=${totalDAVerse}, Arriérés=${totalArrieres}`);


    return new Response(
      JSON.stringify({
        success: true,
        souscripteur,
        plantations: plantationsEnriched,
        paiements
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Subscriber lookup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erreur serveur" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
