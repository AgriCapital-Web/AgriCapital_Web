/**
 * Calcul du prix effectif d'une offre après application de la meilleure promotion
 * active. Reproduit exactement la logique SQL de `offre_prix_effectif()` afin que
 * le CRM, le portail et la base restent alignés (la fonction SQL reste réservée
 * au serveur pour raisons de sécurité).
 */

export interface OffreBase {
  id: string;
  code: string;
  nom: string;
  montant_total_par_ha?: number | null;
  montant_pi_par_ha?: number | null;
  montant_pi_par_ha?: number | null;
  contribution_mensuelle_par_ha?: number | null;
  duree_paiement_mois?: number | null;
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

const num = (v: unknown) => Number(v || 0);

export const promotionCible = (p: PromotionBase) =>
  (() => {
    const cible = p.cible || p.type_promotion;
    if (["depot_initial", "dépôt_initial", "da", "di", "paiement_initial"].includes(String(cible).toLowerCase())) return "paiement_initial";
    if (["total_contrat", "cout_global", "coût_global", "cg"].includes(String(cible).toLowerCase())) return "cout_global";
    return "paiement_initial";
  })();

export const promotionActiveMaintenant = (p: PromotionBase, at: Date = new Date()) => {
  if (!p.active) return false;
  if (p.date_debut && new Date(p.date_debut) > at) return false;
  if (p.date_fin && new Date(p.date_fin) < at) return false;
  return true;
};

const cibleOffre = (p: PromotionBase, offreId: string) => {
  if (p.applique_toutes_offres) return true;
  const ids = Array.isArray(p.offre_ids) ? (p.offre_ids as unknown[]).map(String) : [];
  return ids.includes(offreId);
};

/** Meilleure promotion applicable à une offre (plus forte réduction). */
export const meilleurePromotion = (
  offre: OffreBase,
  promotions: PromotionBase[],
  at: Date = new Date(),
): PromotionBase | null => {
  const eligibles = promotions
    .filter((p) => promotionActiveMaintenant(p, at) && cibleOffre(p, offre.id))
    .sort(
      (a, b) =>
        num(b.pourcentage_reduction) - num(a.pourcentage_reduction) ||
        num(b.montant_fixe_reduction) - num(a.montant_fixe_reduction),
    );
  return eligibles[0] || null;
};

/** Prix effectif (total, dépôt initial, mensualité) d'une offre. */
export const prixEffectif = (
  offre: OffreBase,
  promotions: PromotionBase[],
  at: Date = new Date(),
): PrixEffectif => {
  const totalBase = num(offre.montant_total_par_ha);
  const piBase = num(offre.montant_pi_par_ha ?? offre.montant_pi_par_ha);
  const mensBase = num(offre.contribution_mensuelle_par_ha);
  const duree = num(offre.duree_paiement_mois);

  const promo = meilleurePromotion(offre, promotions, at);
  const pct = num(promo?.pourcentage_reduction);
  const fixe = num(promo?.montant_fixe_reduction);
  const cible = promo ? promotionCible(promo) : null;

  let totalEff = totalBase;
  let piEff = piBase;

  if (promo) {
    if (cible === "cout_global") {
      totalEff = Math.max(totalBase * (1 - pct / 100) - fixe, 0);
    } else if (cible === "paiement_initial") {
      piEff = Math.max(piBase * (1 - pct / 100) - fixe, 0);
    }
  }

  // Le dépôt ne peut jamais dépasser le total effectif
  piEff = Math.min(piEff, totalEff || piEff);

  const mensualiteEffective = duree > 0 ? Math.round(Math.max(totalEff - piEff, 0) / duree) : mensBase;

  return {
    offre_id: offre.id,
    code: offre.code,
    nom: offre.nom,
    montant_total_base: totalBase,
    depot_initial_base: piBase,
    mensualite_base: mensBase,
    montant_total_effectif: totalEff,
    depot_initial_effectif: piEff,
    mensualite_effective: mensualiteEffective,
    promotion_id: promo?.id ?? null,
    promotion_nom: promo?.nom ?? null,
    promotion_cible: cible,
    reduction_pct: pct,
    reduction_montant: Math.max(totalBase - totalEff, 0) + Math.max(piBase - piEff, 0),
  };
};

export const formatF = (v: number | null | undefined) =>
  `${Number(v || 0).toLocaleString("fr-FR")} F`;
