/**
 * Source unique de vérité pour les libellés des types de paiement.
 * Tout export (récépissé, CRM, dashboard) DOIT passer par ces helpers
 * pour garantir que « Paiements mensuels progressifs » reste cohérent.
 */
export const PAYMENT_TYPE_LABELS = {
  DA: "Dépôt Initial",
  REDEVANCE: "Paiements mensuels progressifs",
  CONTRIBUTION: "Paiements mensuels progressifs",
  MENSUALITE: "Paiements mensuels progressifs",
} as const;

export const PAYMENT_TYPE_SHORT_LABELS = {
  DA: "Dépôt Initial",
  REDEVANCE: "Mensualité",
  CONTRIBUTION: "Mensualité",
  MENSUALITE: "Mensualité",
} as const;

export function getPaymentTypeLabel(type: string | null | undefined): string {
  const key = String(type || "").toUpperCase() as keyof typeof PAYMENT_TYPE_LABELS;
  return PAYMENT_TYPE_LABELS[key] ?? "Paiement";
}

export function getPaymentTypeShortLabel(type: string | null | undefined): string {
  const key = String(type || "").toUpperCase() as keyof typeof PAYMENT_TYPE_SHORT_LABELS;
  return PAYMENT_TYPE_SHORT_LABELS[key] ?? "Paiement";
}
