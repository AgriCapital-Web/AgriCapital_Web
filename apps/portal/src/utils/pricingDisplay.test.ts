import { describe, it, expect } from "vitest";
import {
  getPricingScheduleFromOffer,
  getFullTariffGridFromOffer,
  formatCFA,
} from "./pricing";

const palmOffer = {
  code: "PALMINVEST",
  montant_depot_initial_par_ha: 90700,
  montant_total_par_ha: 4384700,
  montant_cash_par_ha: 4070812,
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
  montant_cash_par_ha: 2379777,
  duree_paiement_mois: 35,
  tranches_paiement: [
    { annee: 1, mois: 12, mensualite_par_ha: 54000 },
    { annee: 2, mois: 12, mensualite_par_ha: 75000 },
    { annee: 3, mois: 11, mensualite_par_ha: 96200 },
  ],
};

/**
 * E2E « pricing display » : on ne lance pas Playwright (le projet est protégé
 * derrière OTP SMS), mais on vérifie de bout-en-bout les chaînes qui seront
 * effectivement injectées dans ClientPayment, le récap paiement et la grille
 * tarifaire. Si l'une de ces assertions casse, l'UI ne pourrait pas afficher
 * « An 3 — 11 mois » ni le total 35 mois / 4 384 700 F.
 */
describe("ClientPayment & récap — affichage attendu pour PalmInvest", () => {
  const schedule = getPricingScheduleFromOffer(palmOffer)!;
  const grid = getFullTariffGridFromOffer(palmOffer)!;

  it("affiche 35 mois de durée totale", () => {
    expect(schedule.duree_totale_mois).toBe(35);
  });

  it("affiche un total de 4 384 700 F formaté", () => {
    expect(formatCFA(schedule.total_par_ha)).toMatch(/4[\s\u00a0\u202f]384[\s\u00a0\u202f]700 F/);
  });

  it("affiche le cash à 4 070 812 F depuis la DB", () => {
    expect(formatCFA(Number(palmOffer.montant_cash_par_ha))).toMatch(
      /4[\s\u00a0\u202f]070[\s\u00a0\u202f]812 F/,
    );
  });

  it("rend la grille avec An 3 — 11 mois et la bonne mensualité", () => {
    expect(grid[0].label).toBe("An 1 — 12 mois");
    expect(grid[1].label).toBe("An 2 — 12 mois");
    expect(grid[2].label).toBe("An 3 — 11 mois");
    expect(grid[2].mensuel).toBe(194000);
    expect(grid[2].total).toBe(194000 * 11);
  });
});

describe("ClientPayment & récap — affichage attendu pour TerraPalm", () => {
  const schedule = getPricingScheduleFromOffer(terraOffer)!;
  const grid = getFullTariffGridFromOffer(terraOffer)!;

  it("totalise 35 mois et 2 690 900 F", () => {
    expect(schedule.duree_totale_mois).toBe(35);
    expect(formatCFA(schedule.total_par_ha)).toMatch(/2[\s\u00a0\u202f]690[\s\u00a0\u202f]900 F/);
  });

  it("affiche le cash à 2 379 777 F", () => {
    expect(formatCFA(Number(terraOffer.montant_cash_par_ha))).toMatch(
      /2[\s\u00a0\u202f]379[\s\u00a0\u202f]777 F/,
    );
  });

  it("rend An 3 sur 11 mois avec mensualité 96 200 F", () => {
    expect(grid[2].label).toBe("An 3 — 11 mois");
    expect(grid[2].mensuel).toBe(96200);
  });
});
