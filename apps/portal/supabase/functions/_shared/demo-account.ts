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
