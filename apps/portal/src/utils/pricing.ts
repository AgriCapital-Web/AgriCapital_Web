/**
 * Progressive pricing system based on AgriCapital flyer structure.
 * Rates change automatically per year (An1, An2, An3) based on activation date.
 * 
 * PalmInvest / PalmInvest+:
 *   Dépôt initial: 90,700 F/ha
 *   An 1 (12 mois): 60,000 F/mois/ha
 *   An 2 (12 mois): 120,000 F/mois/ha
 *   An 3 (11 mois): 194,000 F/mois/ha
 *   Total: 4,384,700 F/ha (35 mois)
 * 
 * TerraPalm / TerraPalm+:
 *   Dépôt initial: 84,700 F/ha
 *   An 1 (12 mois): 54,000 F/mois/ha
 *   An 2 (12 mois): 75,000 F/mois/ha
 *   An 3 (11 mois): 96,200 F/mois/ha
 *   Total: 2,690,900 F/ha (35 mois)
 */

export interface PricingSchedule {
  depot_initial: number;
  an1_mensuel: number;
  an1_duree_mois: number;
  an2_mensuel: number;
  an2_duree_mois: number;
  an3_mensuel: number;
  an3_duree_mois: number;
  total_par_ha: number;
  duree_totale_mois: number;
  cash_price: number;
}

export interface OfferPricingSource {
  code?: string | null;
  montant_da_par_ha?: number | null;
  montant_depot_initial_par_ha?: number | null;
  contribution_mensuelle_par_ha?: number | null;
  montant_total_par_ha?: number | null;
  duree_paiement_mois?: number | null;
  tranches_paiement?: unknown;
}

export interface CurrentRate {
  annee: number; // 1, 2, or 3
  label: string; // "An 1", "An 2", "An 3"
  mensuel_par_ha: number;
  jour_par_ha: number;
  semaine_par_ha: number;
  trimestre_par_ha: number;
  semestre_par_ha: number;
  annuel_par_ha: number;
  mois_restants_dans_annee: number;
  mois_ecoules: number;
  schedule: PricingSchedule;
}

export interface PaymentBreakdownSegment {
  label: string;
  annee: number;
  jours: number;
  moisEquivalent: number;
  mensuel_par_ha: number;
  montant: number;
}

export interface ProgressivePaymentResult {
  montant: number;
  totalJours: number;
  segments: PaymentBreakdownSegment[];
}

const PRICING: Record<string, PricingSchedule> = {
  PALMINVEST: { depot_initial: 90700, an1_mensuel: 31900, an1_duree_mois: 11, an2_mensuel: 56900, an2_duree_mois: 12, an3_mensuel: 83800, an3_duree_mois: 16, total_par_ha: 2465200, duree_totale_mois: 40, cash_price: 2465200 },
  'PALMINVEST+': { depot_initial: 90700, an1_mensuel: 31900, an1_duree_mois: 11, an2_mensuel: 56900, an2_duree_mois: 12, an3_mensuel: 83800, an3_duree_mois: 16, total_par_ha: 2465200, duree_totale_mois: 40, cash_price: 2465200 },
  TERRAPALM: { depot_initial: 84700, an1_mensuel: 26900, an1_duree_mois: 11, an2_mensuel: 36900, an2_duree_mois: 12, an3_mensuel: 49800, an3_duree_mois: 16, total_par_ha: 1620200, duree_totale_mois: 40, cash_price: 1620200 },
  'TERRAPALM+': { depot_initial: 84700, an1_mensuel: 26900, an1_duree_mois: 11, an2_mensuel: 36900, an2_duree_mois: 12, an3_mensuel: 49800, an3_duree_mois: 16, total_par_ha: 1620200, duree_totale_mois: 40, cash_price: 1620200 },
};

/**
 * Determine the current pricing year and rate based on offer code and activation date.
 * Falls back to DB rates if offer code not in progressive schedule.
 */
function normalizeOfferCode(offreCode: string | null | undefined): string {
  return (offreCode || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\s]+/g, '')
    .replace(/_PLUS/g, '+')
    .replace(/PLUS/g, '+')
    .replace(/PALMINVESTISSEMENT/g, 'PALMINVEST');
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Résout le Dépôt Initial en priorisant STRICTEMENT la valeur CRM
 * (montant_da_par_ha puis ancien alias), même si elle vaut 0.
 * Retourne null si aucune valeur n'est définie côté CRM.
 */
function resolveDIFromCrm(offre?: OfferPricingSource | null): number | null {
  const da = offre?.montant_da_par_ha as unknown;
  if (da !== null && da !== undefined && da !== '' && Number.isFinite(Number(da))) return Number(da);
  const di = offre?.montant_depot_initial_par_ha as unknown;
  if (di !== null && di !== undefined && di !== '' && Number.isFinite(Number(di))) return Number(di);
  return null;
}


function getTranches(offre?: OfferPricingSource | null): Array<{ annee: number; mois: number; mensualite_par_ha: number }> {
  const raw = offre?.tranches_paiement;
  const parsed = Array.isArray(raw) ? raw : [];
  return parsed
    .map((t: any) => ({
      annee: toNumber(t?.annee),
      mois: toNumber(t?.mois),
      mensualite_par_ha: toNumber(t?.mensualite_par_ha),
    }))
    .filter((t) => t.annee > 0 && t.mois > 0 && t.mensualite_par_ha > 0)
    .sort((a, b) => a.annee - b.annee);
}

export function getPricingScheduleFromOffer(offre?: OfferPricingSource | null): PricingSchedule | null {
  const tranches = getTranches(offre);
  const crmDI = resolveDIFromCrm(offre);
  if (tranches.length > 0) {
    const byYear = [tranches[0], tranches[1] || tranches[0], tranches[2] || tranches[1] || tranches[0]];
    const di = crmDI ?? 0;
    const totalParHa = tranches.reduce((sum, t) => sum + t.mensualite_par_ha * t.mois, 0) + di;
    return {
      depot_initial: di,
      an1_mensuel: byYear[0].mensualite_par_ha,
      an1_duree_mois: byYear[0].mois,
      an2_mensuel: byYear[1].mensualite_par_ha,
      an2_duree_mois: byYear[1].mois,
      an3_mensuel: byYear[2].mensualite_par_ha,
      an3_duree_mois: byYear[2].mois,
      total_par_ha: toNumber(offre?.montant_total_par_ha, totalParHa) || totalParHa,
      duree_totale_mois: toNumber(offre?.duree_paiement_mois, tranches.reduce((sum, t) => sum + t.mois, 0)),
      cash_price: Math.max(0, (toNumber(offre?.montant_total_par_ha, totalParHa) || totalParHa) - 300000),
    };
  }

  const staticSchedule = PRICING[normalizeOfferCode(offre?.code)];
  if (staticSchedule) {
    // Le CRM reste maître : si un DI est défini côté CRM (même à 0), il override la grille figée.
    return crmDI !== null ? { ...staticSchedule, depot_initial: crmDI } : staticSchedule;
  }

  const fallbackMensuel = toNumber(offre?.contribution_mensuelle_par_ha);
  if (fallbackMensuel <= 0) return null;
  const fallbackDA = crmDI ?? 0;
  const duration = toNumber(offre?.duree_paiement_mois, 34);
  return {
    depot_initial: fallbackDA,
    an1_mensuel: fallbackMensuel,
    an1_duree_mois: Math.min(12, duration),
    an2_mensuel: fallbackMensuel,
    an2_duree_mois: Math.min(12, Math.max(0, duration - 12)),
    an3_mensuel: fallbackMensuel,
    an3_duree_mois: Math.max(0, duration - 24),
    total_par_ha: fallbackDA + fallbackMensuel * duration,
    duree_totale_mois: duration,
    cash_price: fallbackDA + fallbackMensuel * duration,
  };
}


function getElapsedDays(dateActivation: string | null | undefined): number {
  if (!dateActivation) return 0;
  const activation = new Date(dateActivation).getTime();
  if (!Number.isFinite(activation)) return 0;
  return Math.max(0, Math.floor((Date.now() - activation) / 86400000));
}

function getElapsedMonths(dateActivation: string | null | undefined): number {
  if (!dateActivation) return 0;
  const activation = new Date(dateActivation);
  if (Number.isNaN(activation.getTime())) return 0;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - activation.getFullYear()) * 12 + (now.getMonth() - activation.getMonth()));
}

function getScheduleTranches(schedule: PricingSchedule) {
  return [
    { annee: 1, label: 'An 1', mois: schedule.an1_duree_mois, mensuel: schedule.an1_mensuel },
    { annee: 2, label: 'An 2', mois: schedule.an2_duree_mois, mensuel: schedule.an2_mensuel },
    { annee: 3, label: 'An 3', mois: schedule.an3_duree_mois, mensuel: schedule.an3_mensuel },
  ].filter((t) => t.mois > 0 && t.mensuel > 0);
}

export function getCurrentRate(
  offreCode: string | undefined,
  dateActivation: string | null | undefined,
  fallbackMensuel: number = 0,
  fallbackDA: number = 0,
): CurrentRate | null {
  return getCurrentRateFromSchedule(PRICING[normalizeOfferCode(offreCode)] || null, dateActivation, fallbackMensuel, fallbackDA);
}

export function getCurrentRateFromOffer(
  offre: OfferPricingSource | null | undefined,
  dateActivation: string | null | undefined,
): CurrentRate | null {
  return getCurrentRateFromSchedule(getPricingScheduleFromOffer(offre), dateActivation, toNumber(offre?.contribution_mensuelle_par_ha), resolveDIFromCrm(offre) ?? 0);
}

function getCurrentRateFromSchedule(
  schedule: PricingSchedule | null,
  dateActivation: string | null | undefined,
  fallbackMensuel: number = 0,
  fallbackDA: number = 0,
): CurrentRate | null {

  if (!schedule) {
    // Fallback to flat DB rate (e.g. PalmÉlite or unknown offers)
    if (fallbackMensuel > 0) {
      return {
        annee: 1,
        label: 'Tarif CRM',
        mensuel_par_ha: fallbackMensuel,
        jour_par_ha: Math.round(fallbackMensuel / 30),
        semaine_par_ha: Math.round(fallbackMensuel / 4),
        trimestre_par_ha: fallbackMensuel * 3,
        semestre_par_ha: fallbackMensuel * 6,
        annuel_par_ha: fallbackMensuel * 12,
        mois_restants_dans_annee: 12,
        mois_ecoules: 0,
        schedule: {
          depot_initial: fallbackDA,
          an1_mensuel: fallbackMensuel,
          an1_duree_mois: 12,
          an2_mensuel: fallbackMensuel,
          an2_duree_mois: 12,
          an3_mensuel: fallbackMensuel,
          an3_duree_mois: 12,
          total_par_ha: fallbackDA + fallbackMensuel * 36,
          duree_totale_mois: 36,
          cash_price: fallbackDA + fallbackMensuel * 36,
        },
      };
    }
    return null;
  }

  const moisEcoules = getElapsedMonths(dateActivation);

  let annee: number;
  let mensuel: number;
  let moisRestants: number;

  if (moisEcoules < schedule.an1_duree_mois) {
    annee = 1;
    mensuel = schedule.an1_mensuel;
    moisRestants = schedule.an1_duree_mois - moisEcoules;
  } else if (moisEcoules < schedule.an1_duree_mois + schedule.an2_duree_mois) {
    annee = 2;
    mensuel = schedule.an2_mensuel;
    moisRestants = (schedule.an1_duree_mois + schedule.an2_duree_mois) - moisEcoules;
  } else {
    annee = 3;
    mensuel = schedule.an3_mensuel;
    moisRestants = Math.max(0, schedule.duree_totale_mois - moisEcoules);
  }

  return {
    annee,
    label: `An ${annee}`,
    mensuel_par_ha: mensuel,
    jour_par_ha: Math.round(mensuel / 30),
    semaine_par_ha: Math.round(mensuel / 4),
    trimestre_par_ha: mensuel * 3,
    semestre_par_ha: mensuel * 6,
    annuel_par_ha: mensuel * 12,
    mois_restants_dans_annee: moisRestants,
    mois_ecoules: moisEcoules,
    schedule,
  };
}

/**
 * Get full tariff grid for display (all 3 years)
 */
export function getFullTariffGrid(offreCode: string | undefined): {
  label: string;
  mensuel: number;
  duree: number;
  total: number;
}[] | null {
  const code = normalizeOfferCode(offreCode);
  const schedule = PRICING[code];
  if (!schedule) return null;

  return [
    { label: 'An 1 — 12 mois', mensuel: schedule.an1_mensuel, duree: schedule.an1_duree_mois, total: schedule.an1_mensuel * schedule.an1_duree_mois },
    { label: 'An 2 — 12 mois', mensuel: schedule.an2_mensuel, duree: schedule.an2_duree_mois, total: schedule.an2_mensuel * schedule.an2_duree_mois },
    { label: 'An 3 — 11 mois', mensuel: schedule.an3_mensuel, duree: schedule.an3_duree_mois, total: schedule.an3_mensuel * schedule.an3_duree_mois },
  ];
}

export function getFullTariffGridFromOffer(offre: OfferPricingSource | null | undefined): {
  label: string;
  mensuel: number;
  duree: number;
  total: number;
}[] | null {
  const schedule = getPricingScheduleFromOffer(offre);
  if (!schedule) return null;

  return getScheduleTranches(schedule).map((t) => ({
    label: `${t.label} — ${t.mois} mois`,
    mensuel: t.mensuel,
    duree: t.mois,
    total: t.mensuel * t.mois,
  }));
}

export function getPricingSchedule(offreCode: string | undefined): PricingSchedule | null {
  const code = normalizeOfferCode(offreCode);
  return PRICING[code] || null;
}

export function periodToDays(periodType: 'jour' | 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'annee', count: number): number {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const unitDays: Record<typeof periodType, number> = {
    jour: 1,
    semaine: 7,
    mois: 30,
    trimestre: 90,
    semestre: 180,
    annee: 360,
  };
  return unitDays[periodType] * safeCount;
}

export function calculateProgressiveAmountByDays(
  offre: OfferPricingSource | null | undefined,
  startDayOffset: number,
  daysCount: number,
  superficieHa: number,
): ProgressivePaymentResult {
  const schedule = getPricingScheduleFromOffer(offre);
  const sup = Math.max(0, Number(superficieHa) || 0);
  const totalDays = Math.max(0, Math.floor(Number(daysCount) || 0));
  if (!schedule || sup <= 0 || totalDays <= 0) return { montant: 0, totalJours: totalDays, segments: [] };

  const segments: PaymentBreakdownSegment[] = [];
  let cursor = Math.max(0, Math.floor(Number(startDayOffset) || 0));
  let remaining = totalDays;

  for (const tranche of getScheduleTranches(schedule)) {
    const trancheDays = tranche.mois * 30;
    if (cursor >= trancheDays) {
      cursor -= trancheDays;
      continue;
    }

    const available = trancheDays - cursor;
    const days = Math.min(remaining, available);
    const amount = (tranche.mensuel / 30) * days * sup;
    segments.push({
      label: tranche.label,
      annee: tranche.annee,
      jours: days,
      moisEquivalent: days / 30,
      mensuel_par_ha: tranche.mensuel,
      montant: amount,
    });
    remaining -= days;
    cursor = 0;
    if (remaining <= 0) break;
  }

  return {
    montant: segments.reduce((sum, segment) => sum + segment.montant, 0),
    totalJours: totalDays - remaining,
    segments,
  };
}

export function calculateProgressivePeriodAmount(
  offre: OfferPricingSource | null | undefined,
  dateActivation: string | null | undefined,
  periodType: 'jour' | 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'annee',
  count: number,
  superficieHa: number,
): ProgressivePaymentResult {
  return calculateProgressiveAmountByDays(
    offre,
    getElapsedDays(dateActivation),
    periodToDays(periodType, count),
    superficieHa,
  );
}

export function formatCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount || 0)) + " F";
}
