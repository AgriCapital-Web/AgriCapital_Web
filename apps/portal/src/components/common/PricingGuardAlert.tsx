import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  PRICING_GUARD_EVENT,
  type PricingConsistencyIssue,
} from "@/utils/pricingGuard";

/**
 * Bannière visible affichée dès qu'un décalage entre `tranches_paiement` /
 * `montant_total_par_ha` côté DB et le moteur de pricing est détecté.
 * Branchée via le CustomEvent `agc:pricing-guard-issue` émis par
 * `assertOfferPricingFresh`.
 */
export function PricingGuardAlert() {
  const [issues, setIssues] = useState<PricingConsistencyIssue[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ issues: PricingConsistencyIssue[] }>).detail;
      if (!detail?.issues?.length) return;
      setIssues((prev) => {
        const seen = new Set(prev.map((i) => `${i.code}:${i.field}`));
        const merged = [...prev];
        for (const issue of detail.issues) {
          const k = `${issue.code}:${issue.field}`;
          if (!seen.has(k)) merged.push(issue);
        }
        return merged;
      });
      setDismissed(false);
    };
    window.addEventListener(PRICING_GUARD_EVENT, handler);
    return () => window.removeEventListener(PRICING_GUARD_EVENT, handler);
  }, []);

  if (dismissed || issues.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[2147483647] w-[min(95vw,640px)] rounded-2xl border-2 border-destructive bg-destructive text-destructive-foreground shadow-2xl"
    >
      <div className="flex items-start gap-3 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 text-sm">
          <p className="font-bold mb-1">Prix CRM incohérents</p>
          <p className="opacity-90 mb-2">
            Les tarifs renvoyés par la base divergent des tranches de paiement. Vérifie
            l'offre concernée avant tout encaissement.
          </p>
          <ul className="space-y-1 text-xs font-mono">
            {issues.slice(0, 5).map((i, idx) => (
              <li key={idx}>
                <span className="font-semibold">{i.code}</span> · {i.field} ·
                attendu&nbsp;{i.expected} / DB&nbsp;{i.actual}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Fermer l'alerte"
          className="rounded-md p-1 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
