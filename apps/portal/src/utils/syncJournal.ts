/**
 * Journal de synchronisation par compte.
 *
 * Objectif : diagnostic. On trace, pour chaque compte client (clé = téléphone /
 * identifiant unique) :
 *  - les synchronisations réussies / échouées (lastSync)
 *  - les changements CRM détectés (prix DI, mensualité, offre, promotion, statut…)
 *  - les annulations d'échéances de Dépôt Initial
 *  - la source effective des prix affichés (vue prix effectif, champ CRM, grille figée)
 *
 * Stockage local (localStorage), borné à 120 entrées par compte.
 */

export type SyncJournalKind =
  | "sync"
  | "sync_error"
  | "crm_change"
  | "di_cancel"
  | "price_source"
  | "connection";

export interface SyncJournalEntry {
  id: string;
  at: string; // ISO
  kind: SyncJournalKind;
  label: string;
  details?: string;
  before?: string;
  after?: string;
}

const MAX_ENTRIES = 120;
const PREFIX = "agri_sync_journal:";
export const SYNC_JOURNAL_EVENT = "agri:sync-journal";

export function journalKey(account: string | null | undefined): string | null {
  const clean = (account || "").toString().trim();
  return clean ? PREFIX + clean : null;
}

export function readJournal(account: string | null | undefined): SyncJournalEntry[] {
  const key = journalKey(account);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendJournal(
  account: string | null | undefined,
  entry: Omit<SyncJournalEntry, "id" | "at"> & { at?: string },
): void {
  const key = journalKey(account);
  if (!key) return;
  const full: SyncJournalEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at || new Date().toISOString(),
    kind: entry.kind,
    label: entry.label,
    details: entry.details,
    before: entry.before,
    after: entry.after,
  };
  try {
    const next = [full, ...readJournal(account)].slice(0, MAX_ENTRIES);
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SYNC_JOURNAL_EVENT, { detail: { account } }));
  } catch {
    /* quota */
  }
}

export function clearJournal(account: string | null | undefined): void {
  const key = journalKey(account);
  if (!key) return;
  try {
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent(SYNC_JOURNAL_EVENT, { detail: { account } }));
  } catch {
    /* noop */
  }
}

/** Empreinte des données CRM sensibles servant à détecter les changements. */
export interface CrmSnapshot {
  offre_code: string;
  offre_nom: string;
  di_par_ha: number | null;
  mensuel_par_ha: number | null;
  total_par_ha: number | null;
  duree_mois: number | null;
  tranches: string;
  promotion: string;
  statut: string;
  phase: string;
  nb_plantations: number;
  nb_paiements: number;
  di_annules: number;
  price_source: string;
}

const nOrNull = (v: any): number | null =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);

export function buildCrmSnapshot(
  souscripteur: any,
  plantations: any[],
  paiements: any[],
): CrmSnapshot {
  const offre = souscripteur?.offres || {};
  const promo = souscripteur?.promotion_active || souscripteur?.promotions;
  const diAnnules = (paiements || []).filter(
    (p: any) => p?.est_depot_initial && String(p?.statut || "").toLowerCase() === "annule",
  ).length;
  return {
    offre_code: String(offre.code || "—"),
    offre_nom: String(offre.nom || "—"),
    di_par_ha: nOrNull(offre.montant_da_par_ha) ?? nOrNull(offre.montant_depot_initial_par_ha),
    mensuel_par_ha: nOrNull(offre.contribution_mensuelle_par_ha),
    total_par_ha: nOrNull(offre.montant_total_par_ha),
    duree_mois: nOrNull(offre.duree_paiement_mois),
    tranches: JSON.stringify(offre.tranches_paiement ?? null),
    promotion: promo ? `${promo.nom || promo.code || "promo"}` : "—",
    statut: String(souscripteur?.statut || souscripteur?.statut_global || "—"),
    phase: String(souscripteur?.phase_actuelle || "—"),
    nb_plantations: (plantations || []).length,
    nb_paiements: (paiements || []).length,
    di_annules: diAnnules,
    price_source: String(offre._price_source || "offres (champs CRM)"),
  };
}

const LABELS: Record<keyof CrmSnapshot, string> = {
  offre_code: "Code offre",
  offre_nom: "Nom de l'offre",
  di_par_ha: "Dépôt Initial / ha",
  mensuel_par_ha: "Paiement mensuel / ha",
  total_par_ha: "Total contrat / ha",
  duree_mois: "Durée (mois)",
  tranches: "Tranches progressives",
  promotion: "Promotion appliquée",
  statut: "Statut du compte",
  phase: "Phase du contrat",
  nb_plantations: "Nombre de plantations",
  nb_paiements: "Nombre de paiements",
  di_annules: "Échéances DI annulées",
  price_source: "Source des prix",
};

const fmtVal = (v: any) => (v === null || v === undefined ? "—" : String(v));

/** Compare deux snapshots et écrit les différences dans le journal. */
export function diffAndLog(
  account: string | null | undefined,
  prev: CrmSnapshot | null,
  next: CrmSnapshot,
): number {
  if (!prev) {
    appendJournal(account, {
      kind: "price_source",
      label: "Source des prix",
      details: next.price_source,
      after: next.di_par_ha === null ? "DI —" : `DI ${next.di_par_ha} F/ha`,
    });
    return 0;
  }
  let count = 0;
  (Object.keys(next) as Array<keyof CrmSnapshot>).forEach((k) => {
    if (prev[k] === next[k]) return;
    count++;
    if (k === "di_annules" && Number(next[k]) > Number(prev[k])) {
      appendJournal(account, {
        kind: "di_cancel",
        label: "Échéance Dépôt Initial annulée",
        details: `${Number(next[k]) - Number(prev[k])} échéance(s) DI annulée(s) côté CRM`,
        before: fmtVal(prev[k]),
        after: fmtVal(next[k]),
      });
      return;
    }
    appendJournal(account, {
      kind: k === "price_source" ? "price_source" : "crm_change",
      label: LABELS[k],
      before: k === "tranches" ? "modifiées" : fmtVal(prev[k]),
      after: k === "tranches" ? "nouvelle grille CRM" : fmtVal(next[k]),
    });
  });
  return count;
}
