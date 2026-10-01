import { describe, it, expect } from "vitest";
import {
  PAYMENT_TYPE_LABELS,
  getPaymentTypeLabel,
  getPaymentTypeShortLabel,
} from "./paymentLabels";

describe("paymentLabels — libellé canonique pour CRM/exports", () => {
  it("aligne REDEVANCE / CONTRIBUTION / MENSUALITE sur le même libellé long", () => {
    expect(PAYMENT_TYPE_LABELS.REDEVANCE).toBe("Paiements mensuels progressifs");
    expect(PAYMENT_TYPE_LABELS.CONTRIBUTION).toBe("Paiements mensuels progressifs");
    expect(PAYMENT_TYPE_LABELS.MENSUALITE).toBe("Paiements mensuels progressifs");
  });

  it("ne réintroduit jamais l'ancienne formulation « contribution mensuelle progressive »", () => {
    for (const label of Object.values(PAYMENT_TYPE_LABELS)) {
      expect(label.toLowerCase()).not.toContain("contribution mensuel");
      expect(label.toLowerCase()).not.toContain("contributions mensuel");
    }
  });

  it("getPaymentTypeLabel est insensible à la casse et tombe sur le libellé canonique", () => {
    expect(getPaymentTypeLabel("redevance")).toBe("Paiements mensuels progressifs");
    expect(getPaymentTypeLabel("Contribution")).toBe("Paiements mensuels progressifs");
    expect(getPaymentTypeLabel("DA")).toBe("Dépôt Initial");
  });

  it("getPaymentTypeShortLabel renvoie « Mensualité » pour les versements mensuels", () => {
    expect(getPaymentTypeShortLabel("redevance")).toBe("Mensualité");
    expect(getPaymentTypeShortLabel("CONTRIBUTION")).toBe("Mensualité");
    expect(getPaymentTypeShortLabel("DA")).toBe("Dépôt Initial");
  });

  it("fallback sûr pour un type inconnu", () => {
    expect(getPaymentTypeLabel("foo")).toBe("Paiement");
    expect(getPaymentTypeLabel(null)).toBe("Paiement");
  });
});
