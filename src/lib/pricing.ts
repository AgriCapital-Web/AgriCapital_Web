/**
 * Moteur unique de calcul des prix AgriCapital.
 * Une promotion est choisie parmi les promotions actives applicables à l'offre.
 * PI = réduction du paiement initial uniquement.
 * CG = réduction du prix global, PI conservé et échéancier ajusté.
 */
export interface TranchePaiement {
  mois?: number | null;
  mois_debut?: number | null;
  mois_fin?: number | null;
  annee?: number | null;
  type?: string | null;
  montant?: number | null;
  mensualite_par_ha?: number | null;
  total_periode_par_ha?: number | null;
  [key: string]: unknown;
}

export interface OffreBase {
  id: string;
  code: string;
  nom: string;
  montant_total_par_ha?: number | null;
  montant_pi_par_ha?: number | null;
  contribution_mensuelle_par_ha?: number | null;
  montant_cash_par_ha?: number | null;
  duree_paiement_mois?: number | null;
  tranches_paiement?: TranchePaiement[] | null;
  actif?: boolean | null;
}

export interface PromotionBase {
  id: string;
  nom: string;
  cible?: string | null;
  type_promotion?: string | null;
  pourcentage_reduction?: number | null;
  montant_fixe_reduction?: number | null;
  active?: boolean | null;
  date_debut?: string | null;
  date_fin?: string | null;
  applique_toutes_offres?: boolean | null;
  offre_ids?: unknown;
  created_at?: string | null;
}

export interface PrixEffectif {
  offre_id: string;
  code: string;
  nom: string;
  montant_total_base: number;
  depot_initial_base: number;
  mensualite_base: number;
  montant_total_effectif: number;
  depot_initial_effectif: number;
  mensualite_effective: number;
  promotion_id: string | null;
  promotion_nom: string | null;
  promotion_cible: string | null;
  reduction_pct: number;
  reduction_montant: number;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const promotionCible = (p?: PromotionBase | null): "paiement_initial" | "cout_global" => {
  const cible = String(p?.cible || p?.type_promotion || "paiement_initial").toLowerCase().trim();
  return ["cout_global", "coût_global", "total_contrat", "cg", "special"].includes(cible)
    ? "cout_global"
    : "paiement_initial";
};

export const promotionActiveMaintenant = (p: PromotionBase, at: Date = new Date()) => {
  if (!p.active) return false;
  if (p.date_debut && new Date(p.date_debut) > at) return false;
  if (p.date_fin && new Date(p.date_fin) < at) return false;
  return true;
};

const cibleOffre = (p: PromotionBase, offreId: string) => {
  if (p.applique_toutes_offres) return true;
  const ids = Array.isArray(p.offre_ids) ? p.offre_ids.map(String) : [];
  return ids.includes(String(offreId));
};

export const promotionsEligibles = (
  offre: OffreBase,
  promotions: PromotionBase[],
  at: Date = new Date(),
) => promotions
  .filter((p) => promotionActiveMaintenant(p, at) && cibleOffre(p, offre.id))
  .sort((a, b) =>
    num(b.pourcentage_reduction) - num(a.pourcentage_reduction) ||
    num(b.montant_fixe_reduction) - num(a.montant_fixe_reduction) ||
    String(b.created_at || "").localeCompare(String(a.created_at || "")));

export const meilleurePromotion = (
  offre: OffreBase,
  promotions: PromotionBase[],
  at: Date = new Date(),
) => promotionsEligibles(offre, promotions, at)[0] || null;

export const calculPrixEffectif = (
  offre: OffreBase,
  promotions: PromotionBase[],
  options: { modePaiement?: "echeancier" | "comptant"; at?: Date } = {},
): PrixEffectif => {
  const mode = options.modePaiement || "echeancier";
  const promo = meilleurePromotion(offre, promotions, options.at);
  const cible = promo ? promotionCible(promo) : null;
  const pct = num(promo?.pourcentage_reduction);
  const fixe = num(promo?.montant_fixe_reduction);

  const piBase = Math.max(0, num(offre.montant_pi_par_ha));
  const cashBase = Math.max(0, num(offre.montant_cash_par_ha));
  const totalBase = mode === "comptant" && cashBase > 0 ? cashBase : Math.max(0, num(offre.montant_total_par_ha));
  const mensualiteBase = Math.max(0, num(offre.contribution_mensuelle_par_ha));

  if (!promo) return {
    offre_id: offre.id, code: offre.code, nom: offre.nom,
    montant_total_base: totalBase, depot_initial_base: mode === "comptant" ? totalBase : piBase,
    mensualite_base: mensualiteBase, montant_total_effectif: totalBase,
    depot_initial_effectif: mode === "comptant" ? totalBase : piBase,
    mensualite_effective: mensualiteBase, promotion_id: null, promotion_nom: null,
    promotion_cible: null, reduction_pct: 0, reduction_montant: 0,
  };

  if (mode === "comptant") {
    const effective = cible === "cout_global"
      ? Math.max(totalBase * (1 - pct / 100) - fixe, 0)
      : totalBase;
    return {
      offre_id: offre.id, code: offre.code, nom: offre.nom,
      montant_total_base: totalBase, depot_initial_base: totalBase, mensualite_base: 0,
      montant_total_effectif: effective, depot_initial_effectif: effective,
      mensualite_effective: 0, promotion_id: promo.id, promotion_nom: promo.nom,
      promotion_cible: cible, reduction_pct: pct, reduction_montant: totalBase - effective,
    };
  }

  if (cible === "cout_global") {
    const totalEff = Math.max(totalBase * (1 - pct / 100) - fixe, 0);
    const piEff = Math.min(piBase, totalEff);
    const remainingEff = Math.max(totalEff - piEff, 0);
    const duration = Math.max(1, num(offre.duree_paiement_mois));
    const monthlyEff = Math.round(remainingEff / duration);
    return {
      offre_id: offre.id, code: offre.code, nom: offre.nom,
      montant_total_base: totalBase, depot_initial_base: piBase,
      mensualite_base: mensualiteBase, montant_total_effectif: totalEff,
      depot_initial_effectif: piEff, mensualite_effective: monthlyEff,
      promotion_id: promo.id, promotion_nom: promo.nom, promotion_cible: cible,
      reduction_pct: pct, reduction_montant: totalBase - totalEff,
    };
  }

  const piEff = Math.max(piBase * (1 - pct / 100) - fixe, 0);
  const totalEff = Math.max(totalBase - (piBase - piEff), 0);
  return {
    offre_id: offre.id, code: offre.code, nom: offre.nom,
    montant_total_base: totalBase, depot_initial_base: piBase,
    mensualite_base: mensualiteBase, montant_total_effectif: totalEff,
    depot_initial_effectif: piEff, mensualite_effective: mensualiteBase,
    promotion_id: promo.id, promotion_nom: promo.nom, promotion_cible: cible,
    reduction_pct: pct, reduction_montant: totalBase - totalEff,
  };
};

export const prixEffectif = (offre: OffreBase, promotions: PromotionBase[], at: Date = new Date()) =>
  calculPrixEffectif(offre, promotions, { at });

export const formatF = (v: number | null | undefined) =>
  `${Number(v || 0).toLocaleString("fr-FR")} F`;
