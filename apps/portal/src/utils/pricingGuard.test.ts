import { describe, it, expect, beforeEach } from "vitest";
import {
  assertOfferPricingFresh,
  validateOfferPricing,
  PRICING_GUARD_EVENT,
  __resetPricingGuardForTests,
} from "./pricingGuard";

beforeEach(() => __resetPricingGuardForTests());

const goodOffer = {
  code: "PALMINVEST",
  montant_depot_initial_par_ha: 90700,
  montant_total_par_ha: 4384700,
  duree_paiement_mois: 35,
  tranches_paiement: [
    { annee: 1, mois: 12, mensualite_par_ha: 60000 },
    { annee: 2, mois: 12, mensualite_par_ha: 120000 },
    { annee: 3, mois: 11, mensualite_par_ha: 194000 },
  ],
};

describe("pricingGuard — émission d'un événement UI", () => {
  it("ne dispatch rien quand la DB est cohérente", () => {
    let fired = 0;
    const h = () => fired++;
    window.addEventListener(PRICING_GUARD_EVENT, h);
    assertOfferPricingFresh(goodOffer);
    window.removeEventListener(PRICING_GUARD_EVENT, h);
    expect(fired).toBe(0);
  });

  it("dispatch un CustomEvent avec les issues quand un décalage existe", () => {
    const events: any[] = [];
    const h = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener(PRICING_GUARD_EVENT, h);
    assertOfferPricingFresh({ ...goodOffer, montant_total_par_ha: 1 });
    window.removeEventListener(PRICING_GUARD_EVENT, h);
    expect(events).toHaveLength(1);
    expect(events[0].issues[0].field).toBe("montant_total_par_ha");
  });

  it("validateOfferPricing reste utilisable seul (pas d'effet de bord)", () => {
    const issues = validateOfferPricing({ ...goodOffer, duree_paiement_mois: 34 });
    expect(issues.some((i) => i.field === "duree_paiement_mois")).toBe(true);
  });
});
