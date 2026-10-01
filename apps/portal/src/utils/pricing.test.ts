import { describe, it, expect } from "vitest";
import {
  getPricingSchedule,
  getCurrentRate,
  getFullTariffGrid,
  getPricingScheduleFromOffer,
  getCurrentRateFromOffer,
  calculateProgressiveAmountByDays,
  formatCFA,
} from "./pricing";
import { validateOfferPricing } from "./pricingGuard";

const palmOffer = {
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

const terraOffer = {
  code: "TERRAPALM",
  montant_depot_initial_par_ha: 84700,
  montant_total_par_ha: 2690900,
  duree_paiement_mois: 35,
  tranches_paiement: [
    { annee: 1, mois: 12, mensualite_par_ha: 54000 },
    { annee: 2, mois: 12, mensualite_par_ha: 75000 },
    { annee: 3, mois: 11, mensualite_par_ha: 96200 },
  ],
};

describe("pricing.ts — PalmInvest static schedule", () => {
  const s = getPricingSchedule("PALMINVEST")!;

  it("expose un dépôt initial à 90 700 F", () => {
    expect(s.depot_initial).toBe(90700);
  });

  it("respecte les mensualités An1/An2/An3", () => {
    expect(s.an1_mensuel).toBe(60000);
    expect(s.an2_mensuel).toBe(120000);
    expect(s.an3_mensuel).toBe(194000);
    expect(s.an3_duree_mois).toBe(11);
  });

  it("totalise 35 mois et 4 384 700 F/ha", () => {
    expect(s.duree_totale_mois).toBe(35);
    const recompute =
      s.depot_initial +
      s.an1_mensuel * s.an1_duree_mois +
      s.an2_mensuel * s.an2_duree_mois +
      s.an3_mensuel * s.an3_duree_mois;
    expect(recompute).toBe(4384700);
    expect(s.total_par_ha).toBe(4384700);
  });

  it("expose un cash price de 4 070 812 F", () => {
    expect(s.cash_price).toBe(4070812);
  });
});

describe("pricing.ts — TerraPalm static schedule", () => {
  const s = getPricingSchedule("TERRAPALM")!;
  it("totalise 35 mois et 2 690 900 F/ha", () => {
    expect(s.duree_totale_mois).toBe(35);
    expect(s.total_par_ha).toBe(2690900);
    expect(s.an3_duree_mois).toBe(11);
    expect(s.cash_price).toBe(2379777);
  });
});

describe("pricing.ts — getCurrentRate par phase", () => {
  function dateOffsetMonths(months: number) {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString();
  }

  it("renvoie An1 dans les 12 premiers mois", () => {
    const r = getCurrentRate("PALMINVEST", dateOffsetMonths(3))!;
    expect(r.annee).toBe(1);
    expect(r.mensuel_par_ha).toBe(60000);
  });

  it("renvoie An2 entre 12 et 24 mois", () => {
    const r = getCurrentRate("PALMINVEST", dateOffsetMonths(15))!;
    expect(r.annee).toBe(2);
    expect(r.mensuel_par_ha).toBe(120000);
  });

  it("renvoie An3 entre 24 et 35 mois", () => {
    const r = getCurrentRate("PALMINVEST", dateOffsetMonths(30))!;
    expect(r.annee).toBe(3);
    expect(r.mensuel_par_ha).toBe(194000);
  });

  it("reste sur An3 (post-35 mois) sans crasher (cas hors-contrat / An4)", () => {
    const r = getCurrentRate("PALMINVEST", dateOffsetMonths(40))!;
    expect(r.annee).toBe(3);
    expect(r.mois_restants_dans_annee).toBe(0);
  });
});

describe("pricing.ts — grille complète", () => {
  it("affiche An3 sur 11 mois", () => {
    const grid = getFullTariffGrid("PALMINVEST")!;
    expect(grid).toHaveLength(3);
    expect(grid[2].label).toContain("11 mois");
    expect(grid[2].duree).toBe(11);
    expect(grid[2].total).toBe(194000 * 11);
  });
});

describe("pricing.ts — schedule depuis offre DB", () => {
  it("reconstruit le schedule PalmInvest depuis tranches_paiement", () => {
    const s = getPricingScheduleFromOffer(palmOffer)!;
    expect(s.an1_mensuel).toBe(60000);
    expect(s.an2_mensuel).toBe(120000);
    expect(s.an3_mensuel).toBe(194000);
    expect(s.an3_duree_mois).toBe(11);
    expect(s.duree_totale_mois).toBe(35);
    expect(s.total_par_ha).toBe(4384700);
  });

  it("reconstruit le schedule TerraPalm depuis tranches_paiement", () => {
    const s = getPricingScheduleFromOffer(terraOffer)!;
    expect(s.total_par_ha).toBe(2690900);
    expect(s.an3_duree_mois).toBe(11);
  });

  it("getCurrentRateFromOffer suit la phase courante", () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 25);
    const r = getCurrentRateFromOffer(palmOffer, d.toISOString())!;
    expect(r.annee).toBe(3);
    expect(r.mensuel_par_ha).toBe(194000);
  });
});

describe("pricing.ts — calculateProgressiveAmountByDays", () => {
  it("facture 30 jours An1 PalmInvest sur 1 ha = 60 000 F", () => {
    const r = calculateProgressiveAmountByDays(palmOffer, 0, 30, 1);
    expect(Math.round(r.montant)).toBe(60000);
  });

  it("traverse An1 → An2 quand la fenêtre chevauche", () => {
    // démarre à J350 (fin An1), couvre 30 jours → 10j An1 + 20j An2
    const r = calculateProgressiveAmountByDays(palmOffer, 350, 30, 1);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].annee).toBe(1);
    expect(r.segments[1].annee).toBe(2);
    const expected = (60000 / 30) * 10 + (120000 / 30) * 20;
    expect(Math.round(r.montant)).toBe(Math.round(expected));
  });

  it("s'arrête à la fin du contrat (35 mois) — pas d'An4", () => {
    // 35 mois = 1050 jours ; on demande 100 jours après la fin
    const r = calculateProgressiveAmountByDays(palmOffer, 1050, 100, 1);
    expect(r.montant).toBe(0);
    expect(r.totalJours).toBe(0);
  });
});

describe("pricingGuard — détection des décalages DB", () => {
  it("ne signale aucun problème quand la DB est synchronisée", () => {
    expect(validateOfferPricing(palmOffer)).toEqual([]);
    expect(validateOfferPricing(terraOffer)).toEqual([]);
  });

  it("signale un décalage de total quand la DB diverge", () => {
    const bad = { ...palmOffer, montant_total_par_ha: 9999999 };
    const issues = validateOfferPricing(bad);
    expect(issues.some((i) => i.field === "montant_total_par_ha")).toBe(true);
  });

  it("signale un décalage de durée si la DB n'a pas migré vers 35 mois", () => {
    const bad = { ...palmOffer, duree_paiement_mois: 34 };
    const issues = validateOfferPricing(bad);
    expect(issues.some((i) => i.field === "duree_paiement_mois")).toBe(true);
  });
});

describe("formatCFA", () => {
  it("formate avec espace insécable et suffixe F", () => {
    expect(formatCFA(4384700)).toMatch(/4[\s\u00a0\u202f]384[\s\u00a0\u202f]700 F/);
  });
});
