import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useKkiapay } from "@/hooks/useKkiapay";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import {
  calculateProgressiveAmountByDays,
  calculateProgressivePeriodAmount,
  formatCFA,
  getCurrentRateFromOffer,
  getFullTariffGridFromOffer,
} from "@/utils/pricing";
import { assertOfferPricingFresh } from "@/utils/pricingGuard";
import { appendJournal } from "@/utils/syncJournal";
import { trackEvent } from "@/utils/errorTracker";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, CreditCard, MapPin, Check, AlertTriangle, Calculator, Loader2, Phone, Trophy, Target, Zap, Plus, Leaf, Calendar } from "lucide-react";

interface ClientPaymentProps {
  souscripteur: any; plantations: any[]; paiements: any[]; onBack: () => void;
  prefillAmount?: number; prefillType?: 'arriere' | 'avance' | 'solde_initial';
}

const STEPS = [
  { key: 'type', label: 'Type' },
  { key: 'plantation', label: 'Plantation' },
  { key: 'details', label: 'Détails' },
  { key: 'confirm', label: 'Payer' },
] as const;

const KKIAPAY_MOBILE_MONEY_FEE_RATE = 0.019;
type ClientPaymentMethod = 'momo' | 'card';

const daysForPeriod = (type: string, count: number) => {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  if (type === 'jour') return n;
  if (type === 'semaine') return n * 7;
  if (type === 'mois') return n * 30;
  if (type === 'trimestre') return n * 90;
  if (type === 'semestre') return n * 180;
  if (type === 'annee') return n * 360;
  return n;
};

const calculateKkiapayAbsorption = (amount: number, method: ClientPaymentMethod) => {
  const clientDebitAmount = Math.round(amount || 0);
  if (method === 'card') {
    return { clientDebitAmount, widgetAmount: clientDebitAmount, estimatedFees: 0, feeRate: 0, absorbedByAgriCapital: 0 };
  }

  const theoreticalAmount = Math.max(0, Math.round(clientDebitAmount / (1 + KKIAPAY_MOBILE_MONEY_FEE_RATE)));
  let widgetAmount = theoreticalAmount;

  for (let candidate = Math.max(0, theoreticalAmount - 20); candidate <= theoreticalAmount + 20; candidate += 1) {
    const totalWithRoundedFee = candidate + Math.ceil(candidate * KKIAPAY_MOBILE_MONEY_FEE_RATE);
    if (totalWithRoundedFee === clientDebitAmount) {
      widgetAmount = candidate;
      break;
    }
  }

  const estimatedFees = Math.max(0, clientDebitAmount - widgetAmount);
  return {
    clientDebitAmount,
    widgetAmount,
    estimatedFees,
    feeRate: KKIAPAY_MOBILE_MONEY_FEE_RATE,
    absorbedByAgriCapital: estimatedFees,
  };
};

const ClientPayment = ({ souscripteur, plantations, paiements, onBack, prefillAmount, prefillType }: ClientPaymentProps) => {
  const { toast } = useToast();
  const { openPayment, onSuccess, onFailed, onClose } = useKkiapay();
  const [step, setStep] = useState<'type' | 'plantation' | 'details' | 'confirm'>('type');
  const [typePaiement, setTypePaiement] = useState<'da' | 'redevance'>('redevance');
  const [selectedPlantation, setSelectedPlantation] = useState('');
  const [periodType, setPeriodType] = useState<'jour' | 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'annee' | 'jours' | 'custom'>('mois');
  const [periodCount, setPeriodCount] = useState(1);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPaiementRef, setCurrentPaiementRef] = useState<string | null>(null);
  const [modeArriere, setModeArriere] = useState<'only' | 'avance' | null>(null);
  const [avancePeriodType, setAvancePeriodType] = useState<'jour' | 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'annee' | 'jours'>('mois');
  const [avancePeriodCount, setAvancePeriodCount] = useState(1);
  const [joursDemandes, setJoursDemandes] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<ClientPaymentMethod>('momo');
  const customPayment = souscripteur?.paiement_personnalise?.actif ? souscripteur.paiement_personnalise : null;
  const customInitialBalance = Number(customPayment?.paiement_initial?.solde || 0);
  const customMonthlyActive = customPayment?.mensualite?.active === true;
  const customSchedulePayment = customMonthlyActive && !plantations.length && typePaiement === 'redevance';
  const paymentContextRef = useRef<{
    reference: string;
    montantTotal: number;
    pricing: ReturnType<typeof calculateKkiapayAbsorption>;
  } | null>(null);

  useEffect(() => {
    if (!prefillType && customMonthlyActive && plantations.length === 0) {
      setTypePaiement('redevance'); setModeArriere(null); setPeriodType('custom'); setCustomAmount(String(customPayment?.mensualite?.montant || 0)); setStep('details');
    } else if (prefillType === 'solde_initial') {
      setTypePaiement('da'); setModeArriere(null);
      const p = plantations.find((p: any) => p.superficie_ha > 0) || plantations[0];
      if (p) setSelectedPlantation(p.id);
      setStep('details');
    } else if (prefillType === 'arriere') {
      setTypePaiement('redevance'); setModeArriere('only');
      const p = plantations.find((p: any) => p.superficie_activee > 0);
      if (p) setSelectedPlantation(p.id);
      setStep('details');
    } else if (prefillType === 'avance') {
      setTypePaiement('redevance'); setModeArriere('avance');
      const p = plantations.find((p: any) => p.superficie_activee > 0);
      if (p) setSelectedPlantation(p.id);
      setStep('details');
    }
  }, [prefillType, customMonthlyActive, plantations.length]);

  // Auto-select most recent plantation when entering plantation step
  useEffect(() => {
    if (step !== 'plantation' || selectedPlantation || plantations.length === 0) return;
    const candidates = typePaiement === 'da'
      ? plantations.filter((p: any) => (p.superficie_ha - (p.superficie_activee || 0)) > 0)
      : plantations.filter((p: any) => (p.superficie_activee || 0) > 0);
    const sorted = [...candidates].sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    if (sorted[0]) setSelectedPlantation(sorted[0].id);
  }, [step, typePaiement, plantations]);

  const plantation = useMemo(() => plantations.find(p => p.id === selectedPlantation), [selectedPlantation, plantations]);

  const activePromotion = souscripteur?.promotion_active || souscripteur?.promotions || null;

  const isPromotionApplicable = (target: 'depot_initial' | 'redevance') => {
    if (!activePromotion?.active && !souscripteur?.promotion_id) return false;
    const now = Date.now();
    const starts = activePromotion.date_debut ? new Date(activePromotion.date_debut).getTime() : 0;
    const ends = activePromotion.date_fin ? new Date(activePromotion.date_fin).getTime() : Number.MAX_SAFE_INTEGER;
    if (Number.isFinite(starts) && now < starts) return false;
    if (Number.isFinite(ends) && now > ends) return false;
    const cible = (activePromotion.cible || '').toLowerCase();
    return cible === 'total_contrat' || cible === 'toutes' || cible === 'all'
      || (target === 'depot_initial' && ['depot_initial', 'da', 'di'].includes(cible))
      || (target === 'redevance' && ['redevance', 'mensualite', 'mensualité'].includes(cible));
  };

  const applyPromotion = (amount: number, target: 'depot_initial' | 'redevance') => {
    if (!isPromotionApplicable(target)) return { amount, savings: 0, applied: false };
    const fixed = Number(activePromotion?.montant_fixe_reduction || 0);
    const percent = Number(activePromotion?.pourcentage_reduction || 0);
    const discounted = fixed > 0 ? Math.max(0, amount - fixed) : Math.max(0, amount - (amount * percent / 100));
    return { amount: discounted, savings: Math.max(0, amount - discounted), applied: discounted < amount };
  };

  // Get progressive rate for the selected plantation from CRM offer tranches
  const plantationRate = useMemo(() => {
    assertOfferPricingFresh(souscripteur?.offres);
    return getCurrentRateFromOffer(souscripteur?.offres, plantation?.date_activation);
  }, [souscripteur, plantation]);

  const tariffGrid = useMemo(() => getFullTariffGridFromOffer(souscripteur?.offres), [souscripteur]);

  const TARIFS = useMemo(() => {
    if (plantationRate) {
      return {
        jour: plantationRate.jour_par_ha,
        semaine: plantationRate.semaine_par_ha,
        mois: plantationRate.mensuel_par_ha,
        trimestre: plantationRate.trimestre_par_ha,
        semestre: plantationRate.semestre_par_ha,
        annee: plantationRate.annuel_par_ha,
        da_par_hectare: plantationRate.schedule.depot_initial,
      };
    }
    const offre = souscripteur?.offres;
    if (offre) {
      const cm = offre.contribution_mensuelle_par_ha || 0;
      return { jour: Math.round(cm / 30), semaine: Math.round(cm / 4), mois: cm, trimestre: cm * 3, semestre: cm * 6, annee: cm * 12, da_par_hectare: offre.montant_da_par_ha ?? offre.montant_depot_initial_par_ha ?? 0 };
    }
    // Defensive fallback (used only if no offre is loaded — should never happen for valid subscribers)
    return { jour: 0, semaine: 0, mois: 0, trimestre: 0, semestre: 0, annee: 0, da_par_hectare: 0 };
  }, [plantationRate, souscripteur]);

  const freeActivationPlantation = useMemo(() => {
    if (typePaiement !== 'da') return null;
    const candidate = [...plantations]
      .filter((p: any) => Number(p.superficie_ha || 0) > Number(p.superficie_activee || 0))
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
    if (!candidate) return null;
    const hectares = Math.max(0, Number(candidate.superficie_ha || 0) - Number(candidate.superficie_activee || 0));
    return applyPromotion(hectares * Number(TARIFS.da_par_hectare || 0), 'depot_initial').amount <= 0
      ? candidate
      : null;
  }, [typePaiement, plantations, TARIFS.da_par_hectare, activePromotion]);

  const fmt = (m: number) => formatCFA(m);

  const calculerArrieres = (plant: any) => {
    if (customPayment) {
      if (!customMonthlyActive) return { montant: 0, jours: 0, enAvance: false };
      const pending = paiements.filter((p: any) => p.plantation_id === plant?.id && p.type_paiement === 'REDEVANCE' && p.statut === 'en_attente' && p.date_echeance && new Date(p.date_echeance).getTime() < Date.now());
      const montant = pending.reduce((s: number, p: any) => s + Number(p.montant || 0), 0);
      const firstDue = pending.length ? new Date(pending[0].date_echeance).getTime() : 0;
      const jours = firstDue ? Math.max(1, Math.floor((Date.now() - firstDue) / 86400000)) : 0;
      return { montant, jours, enAvance: false };
    }
    if (!plant?.date_activation || plant.statut_global === 'en_attente_da') return { montant: 0, jours: 0, enAvance: false };
    const jours = Math.floor((Date.now() - new Date(plant.date_activation).getTime()) / 86400000);
    const attendu = calculateProgressiveAmountByDays(souscripteur?.offres, 0, jours, plant.superficie_activee || 0).montant;
    const paye = paiements.filter((p: any) => p.plantation_id === plant.id && (p.type_paiement === 'REDEVANCE' || p.type_paiement === 'contribution') && p.statut === 'valide').reduce((s: number, p: any) => s + (p.montant_paye || 0), 0);
    const diff = attendu - paye;
    const averageDaily = jours > 0 ? attendu / jours : ((plantationRate?.jour_par_ha || 0) * (plant.superficie_activee || 1));
    if (diff > 0) return { montant: diff, jours: averageDaily > 0 ? Math.floor(diff / averageDaily) : 0, enAvance: false };
    return { montant: Math.abs(diff), jours: averageDaily > 0 ? Math.floor(Math.abs(diff) / averageDaily) : 0, enAvance: true };
  };

  const calculerMontantAvance = () => {
    if (!plantation) return 0;
    const sup = plantation.superficie_activee || plantation.superficie_ha || 1;
    const progressive = avancePeriodType === 'jours'
      ? calculateProgressiveAmountByDays(souscripteur?.offres, Number(souscripteur?.jours_payes || 0), avancePeriodCount, sup)
      : calculateProgressiveAmountByDays(souscripteur?.offres, Number(souscripteur?.jours_payes || 0), daysForPeriod(avancePeriodType, avancePeriodCount), sup);
    return applyPromotion(progressive.montant, 'redevance').amount;
  };

  const redevanceBreakdown = useMemo(() => {
    if (!plantation || periodType === 'custom') return { montant: Number(customAmount) || 0, totalJours: 0, segments: [] };
    const sup = plantation.superficie_activee || plantation.superficie_ha || 1;
    const progressive = periodType === 'jours'
      ? calculateProgressiveAmountByDays(souscripteur?.offres, Number(souscripteur?.jours_payes || 0), joursDemandes, sup)
      : calculateProgressiveAmountByDays(souscripteur?.offres, Number(souscripteur?.jours_payes || 0), periodType === 'jour' ? 1 * periodCount : periodType === 'semaine' ? 7 * periodCount : periodType === 'mois' ? 30 * periodCount : periodType === 'trimestre' ? 90 * periodCount : periodType === 'semestre' ? 180 * periodCount : 360 * periodCount, sup);
    const promo = applyPromotion(progressive.montant, 'redevance');
    return { ...progressive, montant: promo.amount, economie: promo.savings, promotionAppliquee: promo.applied };
  }, [plantation, periodType, periodCount, joursDemandes, customAmount, souscripteur?.offres, activePromotion, souscripteur?.jours_payes]);

  const depotInitialDetails = useMemo(() => {
    if (customPayment && customInitialBalance > 0) {
      return { montant: customInitialBalance, brut: customInitialBalance, economie: 0, promotionAppliquee: false, personnalise: true };
    }
    if (!plantation) return { montant: 0, brut: 0, economie: 0, promotionAppliquee: false, personnalise: false };
    const hectares = Math.max(0, (plantation.superficie_ha || 0) - (plantation.superficie_activee || 0));
    const brut = hectares * TARIFS.da_par_hectare;
    const promo = applyPromotion(brut, 'depot_initial');
    return { montant: promo.amount, brut, economie: promo.savings, promotionAppliquee: promo.applied, personnalise: false };
  }, [plantation, TARIFS.da_par_hectare, activePromotion, customPayment, customInitialBalance]);

  const calculerMontantRedevance = () => {
    if (!plantation) return 0;
    if (periodType === 'custom') return Number(customAmount) || 0;
    return redevanceBreakdown.montant;
  };

  const montantArriere = plantation ? calculerArrieres(plantation).montant : 0;
  const montantAvance = calculerMontantAvance();
  const montantTotal = useMemo(() => {
    if (typePaiement === 'da') return depotInitialDetails.montant;
    if (customSchedulePayment) return Number(customMonthly?.montant || 0);
    if (modeArriere === 'only') return montantArriere;
    if (modeArriere === 'avance') return montantArriere + montantAvance;
    return calculerMontantRedevance();
  }, [typePaiement, plantation, modeArriere, montantArriere, montantAvance, depotInitialDetails.montant, periodType, periodCount, customAmount, redevanceBreakdown.montant]);

  const kkiapayPricing = useMemo(() => calculateKkiapayAbsorption(montantTotal, paymentMethod), [montantTotal, paymentMethod]);

  useEffect(() => {
    onSuccess(async (response) => {
      const paymentContext = paymentContextRef.current;
      if (paymentContext?.reference) {
        try {
          const { data: confirmation, error: confirmationError } = await supabase.functions.invoke('create-payment', {
            body: {
              action: 'confirm',
              reference: paymentContext.reference,
              kkiapay_transaction_id: response.transactionId,
              montant_paye: paymentContext.montantTotal,
              method: response.method || null,
              fees: response.fees || 0,
              kkiapay_amount: response.amount || paymentContext.pricing.widgetAmount,
              client_debit_amount: paymentContext.pricing.clientDebitAmount,
              fee_absorption_rate: paymentContext.pricing.feeRate,
            }
          });
          if (confirmationError || !confirmation?.success) {
            throw new Error(confirmation?.error || confirmationError?.message || "Confirmation du paiement impossible");
          }
        } catch (e: any) {
          trackEvent({ level: "error", scope: "payment", message: "Confirmation serveur du paiement échouée", account: souscripteur?.id_unique || souscripteur?.telephone, context: { error: e?.message } });
          toast({ variant: "destructive", title: "Paiement en cours de confirmation", description: "La transaction a été reçue. La synchronisation sécurisée se poursuit automatiquement." });
          setLoading(false);
          return;
        }
        // Confirmation SMS is now sent server-side inside `create-payment`
        // after KKiaPay verification. The previous unauthenticated
        // `send-otp/send_custom` client call has been removed.

      }
      toast({ title: "✅ Paiement réussi !", description: `Transaction ${response.transactionId} validée.` });
      setTimeout(() => onBack(), 2000);
    });
    onFailed((error) => { toast({ variant: "destructive", title: "Paiement échoué", description: error.reason }); setLoading(false); });
    onClose(() => setLoading(false));
  }, [currentPaiementRef, montantTotal, kkiapayPricing, souscripteur.telephone, onBack, toast, onSuccess, onFailed, onClose]);

  // DI offert (0 F via promotion CRM) : aucun passage par KKiaPay,
  // on valide et on active directement la plantation côté serveur.
  const isDiGratuit = typePaiement === 'da' && !!plantation && montantTotal <= 0;

  const handleActivationGratuite = async (targetPlantation = plantation) => {
    if (!targetPlantation) return;
    setLoading(true);
    const reference = `DI0-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    const account = souscripteur?.id_unique || souscripteur?.telephone;
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          action: 'activate_free',
          client_id: souscripteur.id,
          plantation_id: targetPlantation.id,
          reference,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Activation impossible");
      const horodatage = new Date();
      appendJournal(account, {
        kind: "crm_change",
        label: "Plantation activée automatiquement (DI 0 F)",
        details: `Plantation ${targetPlantation.nom_plantation || targetPlantation.id_unique} · Référence CRM ${data?.reference || reference} · ${format(horodatage, "dd/MM/yyyy HH:mm:ss", { locale: fr })}`,
        after: "Activée",
      });
      trackEvent({
        level: "info",
        scope: "payment",
        message: "Activation gratuite (Dépôt Initial 0 F)",
        account,
        context: { plantation_id: targetPlantation.id, reference: data?.reference || reference, at: horodatage.toISOString() },
      });
      toast({
        title: "✅ Plantation activée — Dépôt Initial offert",
        description: `Référence CRM ${data?.reference || reference} · ${format(horodatage, "dd/MM/yyyy 'à' HH:mm", { locale: fr })}. L'opération est tracée dans votre journal de synchronisation.`,
      });
      setTimeout(() => onBack(), 1800);
    } catch (e: any) {
      trackEvent({ level: "error", scope: "payment", message: "Échec de l'activation gratuite (DI 0 F)", account, context: { error: e?.message, reference } });
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Compte de démonstration : parcours de paiement complet joué de bout en bout
  // (aucun débit réel, aucune écriture CRM).
  const isDemoAccount = !!souscripteur?._demo;

  const handleDemoPayment = async () => {
    if ((!plantation && !customSchedulePayment) || montantTotal <= 0) { toast({ variant: "destructive", title: "Erreur", description: customSchedulePayment ? "Montant invalide" : "Plantation et montant requis" }); return; }
    setLoading(true);
    const reference = `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    await new Promise((r) => setTimeout(r, 1400));
    toast({
      title: "✅ Paiement réussi (démonstration)",
      description: `Transaction ${reference} validée · ${typePaiement === 'da' ? "Dépôt Initial" : "Paiement mensuel"}. Aucun débit réel n'a été effectué.`,
    });
    setLoading(false);
    setTimeout(() => onBack(), 1800);
  };

  const handleSubmit = async () => {
    if (isDiGratuit) return handleActivationGratuite();
    if (isDemoAccount) return handleDemoPayment();
    if (!plantation || montantTotal <= 0) { toast({ variant: "destructive", title: "Erreur", description: "Plantation et montant requis" }); return; }
    setLoading(true);

    try {
      const reference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      setCurrentPaiementRef(reference);
      paymentContextRef.current = { reference, montantTotal, pricing: kkiapayPricing };
      const { data: invokeData, error: insertError } = await supabase.functions.invoke('create-payment', {
        body: {
          action: 'insert',
          souscripteur_id: souscripteur.id,
          plantation_id: plantation?.id || null,
          type_paiement: typePaiement === 'da' ? 'DA' : 'REDEVANCE',
          montant: montantTotal,
          mode_paiement: paymentMethod === 'momo' ? 'Mobile Money' : 'Carte bancaire',
          reference,
          metadata: {
            jours_demandes: typePaiement === 'redevance' && modeArriere === null ? (periodType === 'jours' ? joursDemandes : redevanceBreakdown.totalJours) : null,
            mode_arriere: modeArriere,
            montant_arriere: modeArriere ? montantArriere : null,
            montant_avance: modeArriere === 'avance' ? montantAvance : null,
            payment_provider: 'kkiapay',
            annee_tarif: plantationRate?.annee || 1,
            tarif_mensuel: TARIFS.mois,
            offre_id: souscripteur?.offre_id || souscripteur?.offres?.id,
            promotion_id: activePromotion?.id || null,
            economie_promotion: typePaiement === 'da' ? depotInitialDetails.economie : (redevanceBreakdown as any).economie || 0,
            ventilation_tarifaire: typePaiement === 'redevance' ? redevanceBreakdown.segments : [],
            client_debit_amount: kkiapayPricing.clientDebitAmount,
            kkiapay_widget_amount: kkiapayPricing.widgetAmount,
            estimated_kkiapay_fees: kkiapayPricing.estimatedFees,
            fee_absorption_rate: kkiapayPricing.feeRate,
            fee_absorption_method: paymentMethod,
            fee_absorption_note: paymentMethod === 'momo'
              ? 'Montant KKiaPay réduit pour absorber les frais Mobile Money AgriCapital et garder le débit client exact.'
              : 'Carte bancaire sans frais KKiaPay appliqués au client.',
          }
        }
      });
      if (insertError || !invokeData?.success) throw new Error(invokeData?.error || insertError?.message || 'Erreur création paiement');
      const paiementRow = invokeData.paiement;
      const opened = await openPayment({
        amount: kkiapayPricing.widgetAmount,
        email: souscripteur.email || 'client@agricapital.ci',
        phone: souscripteur.telephone,
        name: souscripteur.nom_complet || `${souscripteur.prenoms} ${souscripteur.nom}`,
        paymentMethods: [paymentMethod],
        data: {
          reference,
          paiement_id: paiementRow.id,
          plantation_id: plantation ? plantation.id : null,
          type: typePaiement,
          client_debit_amount: kkiapayPricing.clientDebitAmount,
          kkiapay_widget_amount: kkiapayPricing.widgetAmount,
          fee_absorption_rate: kkiapayPricing.feeRate,
        }
      });
      if (!opened) { toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ouvrir la page de paiement." }); setLoading(false); }
    } catch (error: any) { toast({ variant: "destructive", title: "Erreur", description: error.message }); setLoading(false); }
  };

  const PERIODE_OPTIONS = [
    { key: 'jours' as const, label: 'Jours personnalisés', tarif: TARIFS.jour },
    { key: 'jour' as const, label: '1 jour', tarif: TARIFS.jour },
    { key: 'semaine' as const, label: 'Semaine', tarif: TARIFS.semaine },
    { key: 'mois' as const, label: 'Mois', tarif: TARIFS.mois },
    { key: 'trimestre' as const, label: 'Trimestre', tarif: TARIFS.trimestre },
    { key: 'semestre' as const, label: 'Semestre', tarif: TARIFS.semestre },
    { key: 'annee' as const, label: 'Année', tarif: TARIFS.annee },
  ];

  const stepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="py-3 px-4 shadow-lg sticky top-0 z-50 bg-[image:var(--gradient-hero)]">
        <div className="container mx-auto flex items-center gap-3 max-w-lg lg:max-w-7xl">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/15 h-9 w-9"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="bg-white rounded-lg p-1 flex items-center justify-center"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 sm:h-10 object-contain" /></div>
          <span className="font-semibold text-white text-sm">Paiement</span>
        </div>
      </header>

      {/* Step Progress */}
      <div className="px-4 py-3 bg-card border-b">
        <div className="container mx-auto max-w-lg lg:max-w-7xl">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium hidden sm:block ${i <= stepIndex ? 'text-primary' : 'text-muted-foreground'}`}>{s.label}</span>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 rounded ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="client-page-content flex-1 container mx-auto py-4 lg:py-8 space-y-4 max-w-lg lg:max-w-7xl">

        {/* Bannière offre active */}
        {souscripteur?.offres && (
          <Card className="rounded-2xl shadow-md border-2" style={{ borderColor: souscripteur.offres.couleur || '#00643C' }}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: souscripteur.offres.couleur || '#00643C' }}>
                <Leaf className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Votre offre</p>
                <p className="font-bold text-sm truncate">{souscripteur.offres.nom}</p>
              </div>
              {plantationRate && (
                <Badge className="bg-gold/15 text-gold-dark border-gold/30 text-[10px]">{plantationRate.label}</Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Type */}
        {step === 'type' && (
          <Card className="card-brand rounded-2xl shadow-md">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1"><CreditCard className="h-5 w-5 text-primary" /><h3 className="text-base font-bold">Type de paiement</h3></div>
              <RadioGroup value={typePaiement} onValueChange={(v) => setTypePaiement(v as any)} className="space-y-3">
                {[
                  { val: 'redevance', title: "Mensualité", desc: "Paiements mensuels progressifs", badge: plantationRate ? `${fmt(plantationRate.mensuel_par_ha)}/mois` : '', icon: "📅" },
                  { val: 'da', title: "Dépôt Initial", desc: "Activer vos hectares", badge: `${fmt(TARIFS.da_par_hectare)}/ha`, icon: "🔑" },
                ].map(opt => (
                  <div key={opt.val} onClick={() => setTypePaiement(opt.val as any)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${typePaiement === opt.val ? 'border-gold bg-gold/5 shadow-sm' : 'border-border hover:border-gold/30'}`}>
                    <span className="text-2xl">{opt.icon}</span>
                    <RadioGroupItem value={opt.val} className="sr-only" />
                    <div className="flex-1"><span className="font-bold text-sm block">{opt.title}</span><span className="text-xs text-muted-foreground">{opt.desc}</span></div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 bg-gold/10 text-gold-dark border-gold/30">{opt.badge}</Badge>
                  </div>
                ))}
              </RadioGroup>

              {/* Tariff Grid Display */}
              {tariffGrid && (
                <Card className="bg-muted/20 border-dashed rounded-xl">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-gold" />
                      <span className="text-xs font-bold">Grille tarifaire — {souscripteur.offres?.nom || ''} (par hectare)</span>
                    </div>
                    <div className="space-y-1">
                      {tariffGrid.map((row, i) => (
                        <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${plantationRate?.annee === i + 1 ? 'bg-primary/10 font-bold text-primary' : 'text-muted-foreground'}`}>
                          <span>{row.label} {plantationRate?.annee === i + 1 && '← actuel'}</span>
                          <span>{fmt(row.mensuel)}/mois</span>
                        </div>
                      ))}
                    </div>
                    {plantationRate && (
                      <div className="mt-2 pt-2 border-t border-dashed">
                        <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                          <div className="bg-card rounded-lg p-1.5">
                            <p className="text-muted-foreground">Jour</p>
                            <p className="font-bold">{fmt(plantationRate.jour_par_ha)}</p>
                          </div>
                          <div className="bg-card rounded-lg p-1.5">
                            <p className="text-muted-foreground">Semaine</p>
                            <p className="font-bold">{fmt(plantationRate.semaine_par_ha)}</p>
                          </div>
                          <div className="bg-card rounded-lg p-1.5">
                            <p className="text-muted-foreground">Trimestre</p>
                            <p className="font-bold">{fmt(plantationRate.trimestre_par_ha)}</p>
                          </div>
                          <div className="bg-card rounded-lg p-1.5">
                            <p className="text-muted-foreground">Semestre</p>
                            <p className="font-bold">{fmt(plantationRate.semestre_par_ha)}</p>
                          </div>
                          <div className="bg-card rounded-lg p-1.5">
                            <p className="text-muted-foreground">Année</p>
                            <p className="font-bold">{fmt(plantationRate.annuel_par_ha)}</p>
                          </div>
                          <div className="bg-gold/10 rounded-lg p-1.5">
                            <p className="text-gold-dark font-bold">Total</p>
                            <p className="font-black text-gold-dark">{fmt(plantationRate.schedule.total_par_ha)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

               <Button
                 onClick={() => freeActivationPlantation ? handleActivationGratuite(freeActivationPlantation) : setStep('plantation')}
                 disabled={loading}
                 className="w-full h-12 rounded-xl font-bold btn-brand-green"
               >
                 {loading && freeActivationPlantation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                 {freeActivationPlantation ? "Activer ma plantation" : "Continuer"}
                 {!freeActivationPlantation && <ArrowLeft className="h-4 w-4 rotate-180 ml-1" />}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Plantation */}
        {step === 'plantation' && (
          <Card className="card-brand rounded-2xl shadow-md">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setStep('type')} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
                <MapPin className="h-5 w-5 text-primary" /><h3 className="text-base font-bold">Choisir la plantation</h3>
              </div>
              {plantations.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gold" /><p className="font-semibold">Aucune plantation</p><p className="text-xs mt-1">Contactez votre technico-commercial</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {plantations.map((plant: any) => {
                    const etat = calculerArrieres(plant);
                    const pRate = getCurrentRateFromOffer(souscripteur?.offres, plant.date_activation);
                    const isSelectable = typePaiement === 'da' ? (plant.superficie_ha - (plant.superficie_activee || 0)) > 0 : (plant.superficie_activee || 0) > 0;
                    return (
                      <div key={plant.id} onClick={() => isSelectable && setSelectedPlantation(plant.id)}
                        className={`p-4 rounded-2xl border-2 transition-all ${selectedPlantation === plant.id ? 'border-gold bg-gold/5 shadow-sm' : isSelectable ? 'border-border hover:border-gold/30 cursor-pointer' : 'border-border opacity-40'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-sm">{plant.nom_plantation || plant.id_unique}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{plant.id_unique}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {pRate && <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary border-0">{pRate.label}</Badge>}
                            {selectedPlantation === plant.id && <div className="h-6 w-6 rounded-full bg-gold flex items-center justify-center"><Check className="h-3.5 w-3.5 text-white" /></div>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted/50 rounded-xl p-2"><p className="text-muted-foreground">Surface</p><p className="font-bold">{plant.superficie_ha} ha</p></div>
                          <div className="bg-muted/50 rounded-xl p-2"><p className="text-muted-foreground">Activée</p><p className="font-bold">{plant.superficie_activee || 0} ha</p></div>
                        </div>
                        {typePaiement === 'redevance' && plant.date_activation && (
                          <div className={`flex items-center gap-1.5 text-[11px] mt-2 p-2 rounded-xl ${etat.enAvance ? 'bg-primary/5 text-primary' : etat.jours > 0 ? 'bg-destructive/5 text-destructive' : 'bg-muted/30 text-muted-foreground'}`}>
                            {etat.enAvance ? <Trophy className="h-3.5 w-3.5" /> : etat.jours > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                            {etat.enAvance ? `En avance : ${etat.jours}j` : etat.jours > 0 ? `Arriéré : ${etat.jours}j (${fmt(etat.montant)})` : 'À jour'}
                          </div>
                        )}
                        {pRate && (
                          <p className="text-[10px] text-muted-foreground mt-1">Tarif actuel : {fmt(pRate.mensuel_par_ha)}/mois/ha</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedPlantation && <Button onClick={() => setStep('details')} className="w-full h-12 rounded-xl font-bold btn-brand-green">Continuer</Button>}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Details */}
        {step === 'details' && customSchedulePayment && (
          <Card className="card-brand rounded-2xl shadow-md">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold">Échéancier personnalisé</h3>
                  <p className="text-xs text-muted-foreground">Aucune plantation n'est encore activée pour ce dossier.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground">Prochaine échéance</p>
                <p className="text-lg font-black text-primary">{customPayment?.mensualite?.date_debut ? format(new Date(customPayment.mensualite.date_debut), 'dd/MM/yyyy') : '—'}</p>
                <p className="text-xs mt-1">{fmt(Number(customMonthly?.montant || 0))} F CFA · échéance personnalisée</p>
              </div>
              <div className="rounded-2xl p-4 bg-muted/20 flex justify-between items-center">
                <span className="font-bold">Montant à payer</span>
                <span className="text-2xl font-black text-primary">{fmt(Number(customMonthly?.montant || 0))}</span>
              </div>
              <Button onClick={handleSubmit} disabled={loading || montantTotal <= 0} className="w-full h-12 rounded-xl font-bold btn-brand-green">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Payer {fmt(Number(customMonthly?.montant || 0))} F CFA
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'details' && plantation && (
          <Card className="card-brand rounded-2xl shadow-md">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setStep('plantation')} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
                <Calculator className="h-5 w-5 text-primary" /><h3 className="text-base font-bold">{typePaiement === 'da' ? "Dépôt Initial" : 'Détails du paiement'}</h3>
              </div>

              <div className="bg-muted/30 rounded-2xl p-3 flex items-center gap-3 card-brand-subtle">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><MapPin className="h-5 w-5 text-primary" /></div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{plantation.nom_plantation || plantation.id_unique}</p>
                  <p className="text-xs text-muted-foreground">{plantation.superficie_activee || plantation.superficie_ha} ha {plantationRate && `· ${plantationRate.label}`}</p>
                </div>
              </div>

              {/* Current rate info */}
              {plantationRate && typePaiement === 'redevance' && (
                <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Leaf className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-primary">Tarif {plantationRate.label} — {souscripteur.offres?.nom}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmt(plantationRate.mensuel_par_ha)}/mois/ha · {fmt(plantationRate.jour_par_ha)}/jour/ha</p>
                  {plantationRate.mois_restants_dans_annee > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">{plantationRate.mois_restants_dans_annee} mois restants à ce tarif</p>
                  )}
                </div>
              )}

              {typePaiement === 'da' ? (
                <div className="space-y-2 text-sm">
                  {[['Superficie totale', `${plantation.superficie_ha} ha`], ['Activée', `${plantation.superficie_activee || 0} ha`], ['À activer', `${plantation.superficie_ha - (plantation.superficie_activee || 0)} ha`], ['Dépôt initial', `${fmt(TARIFS.da_par_hectare)}/ha`]].map(([l, v], i) => (
                    <div key={i} className="flex justify-between py-2 border-b last:border-0"><span className="text-muted-foreground">{l}</span><span className="font-bold">{v}</span></div>
                  ))}
                  {depotInitialDetails.promotionAppliquee && (
                    <div className="flex justify-between py-2 text-primary"><span>Réduction appliquée</span><span className="font-bold">- {fmt(depotInitialDetails.economie)}</span></div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => { const etat = calculerArrieres(plantation); if (!etat.jours && !etat.enAvance) return null; return (
                    <div className={`p-3 rounded-2xl border ${etat.enAvance ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
                      <div className={`flex items-center gap-2 font-bold text-sm ${etat.enAvance ? 'text-primary' : 'text-destructive'}`}>
                        {etat.enAvance ? <Trophy className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        {etat.enAvance ? 'En avance !' : 'Arriéré détecté'}
                      </div>
                      <p className={`text-xs mt-0.5 ${etat.enAvance ? 'text-primary/80' : 'text-destructive/80'}`}>
                        {etat.enAvance ? `${etat.jours}j d'avance — ${fmt(etat.montant)}` : `${etat.jours}j de retard — ${fmt(etat.montant)}`}
                      </p>
                    </div>
                  ); })()}

                  {(modeArriere || montantArriere > 0) && (
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Mode de régularisation</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div onClick={() => setModeArriere('only')} className={`p-3 rounded-2xl border-2 cursor-pointer text-center transition-all ${modeArriere === 'only' ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/30'}`}>
                          <Zap className="h-5 w-5 mx-auto mb-1 text-gold-dark" />
                          <p className="text-xs font-bold">Arriéré seul</p>
                          <p className="text-[10px] text-muted-foreground">{fmt(montantArriere)}</p>
                        </div>
                        <div onClick={() => setModeArriere('avance')} className={`p-3 rounded-2xl border-2 cursor-pointer text-center transition-all ${modeArriere === 'avance' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                          <Plus className="h-5 w-5 mx-auto mb-1 text-primary" />
                          <p className="text-xs font-bold">Arriéré + Avance</p>
                          <p className="text-[10px] text-muted-foreground">Prendre de l'avance</p>
                        </div>
                      </div>
                      <div onClick={() => setModeArriere(null)} className={`p-2.5 rounded-2xl border-2 cursor-pointer text-center transition-all ${modeArriere === null ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                        <p className="text-xs font-bold">Paiement classique</p>
                      </div>
                    </div>
                  )}

                  {modeArriere === 'avance' && (
                    <div className="space-y-3 p-3 bg-primary/5 rounded-2xl border border-primary/15">
                      <Label className="text-sm font-bold text-primary">Avance supplémentaire</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {PERIODE_OPTIONS.map(opt => (
                          <div key={opt.key} onClick={() => { setAvancePeriodType(opt.key); setAvancePeriodCount(1); }}
                            className={`p-2 rounded-xl border-2 cursor-pointer text-center transition-all ${avancePeriodType === opt.key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30 bg-card'}`}>
                            <p className="text-[11px] font-bold">{opt.label}</p>
                            <p className="text-[9px] text-muted-foreground">{fmt(opt.tarif * (plantation.superficie_activee || 1))}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0">Quantité</Label>
                        <Input type="number" min="1" max="24" value={avancePeriodCount} onChange={e => setAvancePeriodCount(Math.max(1, Number(e.target.value)))} className="h-9 text-sm rounded-xl" />
                      </div>
                      <div className="flex justify-between text-sm text-primary font-bold"><span>Avance :</span><span>{fmt(montantAvance)}</span></div>
                    </div>
                  )}

                  {modeArriere === null && (
                    <div className="space-y-3">
                      <Label className="text-sm font-bold">Période de paiement</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {PERIODE_OPTIONS.map(opt => (
                          <div key={opt.key} onClick={() => { setPeriodType(opt.key); setPeriodCount(1); setJoursDemandes(1); }}
                            className={`p-2 rounded-xl border-2 cursor-pointer text-center transition-all ${periodType === opt.key ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/30'}`}>
                            <p className="text-[11px] font-bold">{opt.label}</p>
                            <p className="text-[9px] text-muted-foreground">{fmt(opt.tarif * (plantation.superficie_activee || plantation.superficie_ha || 1))}</p>
                          </div>
                        ))}
                      </div>
                      <div onClick={() => setPeriodType('custom')} className={`p-2.5 rounded-xl border-2 cursor-pointer text-center ${periodType === 'custom' ? 'border-gold bg-gold/5' : 'border-border'}`}>
                        <p className="text-xs font-bold">Montant personnalisé</p>
                      </div>
                      {periodType !== 'custom' ? (
                        <div className="flex items-center gap-2"><Label className="text-xs shrink-0">{periodType === "jours" ? "Nombre de jours" : "Quantité"}</Label><Input type="number" min="1" max="360" value={periodType === "jours" ? joursDemandes : periodCount} onChange={e => periodType === "jours" ? setJoursDemandes(Math.max(1, Number(e.target.value))) : setPeriodCount(Math.max(1, Number(e.target.value)))} className="h-9 rounded-xl" /></div>
                      ) : (
                        <div><Label className="text-xs">Montant (F CFA)</Label><Input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder="50000" className="h-12 mt-1 rounded-xl" /></div>
                      )}
                      {periodType !== 'custom' && redevanceBreakdown.segments.length > 0 && (
                        <div className="rounded-xl border border-dashed bg-muted/20 p-3 space-y-1.5">
                          <p className="text-[11px] font-bold text-muted-foreground">Ventilation automatique selon les années tarifaires</p>
                          {redevanceBreakdown.segments.map((segment, i) => (
                            <div key={`${segment.label}-${i}`} className="flex justify-between text-[11px]">
                              <span>{segment.label} · {segment.jours} j · {fmt(segment.mensuel_par_ha)}/mois/ha</span>
                              <span className="font-bold">{fmt(segment.montant)}</span>
                            </div>
                          ))}
                          {(redevanceBreakdown as any).promotionAppliquee && (
                            <div className="flex justify-between text-[11px] text-primary pt-1 border-t border-dashed">
                              <span>Réduction appliquée</span><span className="font-bold">- {fmt((redevanceBreakdown as any).economie)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Total */}
              <div className="rounded-2xl p-4 card-brand-subtle bg-muted/20">
                {modeArriere === 'avance' && (
                  <div className="space-y-1 mb-2 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Arriéré :</span><span className="font-bold text-destructive">{fmt(montantArriere)}</span></div>
                    <div className="flex justify-between"><span>Avance :</span><span className="font-bold text-primary">{fmt(montantAvance)}</span></div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base">Total à payer</span>
                  <span className="text-2xl font-black text-primary">{fmt(montantTotal)}</span>
                </div>
              </div>

              {!isDiGratuit && <div className="rounded-2xl p-4 card-brand-subtle bg-card space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">Mode de paiement</p>
                    <p className="text-[11px] text-muted-foreground">Le client est débité du montant exact AgriCapital.</p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Frais absorbés</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('momo')}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${paymentMethod === 'momo' ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/40'}`}
                  >
                    <p className="text-xs font-black">Mobile Money</p>
                    <p className="text-[10px] text-muted-foreground">1,9% absorbé</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  >
                    <p className="text-xs font-black">Carte bancaire</p>
                    <p className="text-[10px] text-muted-foreground">0% de frais</p>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-muted-foreground">Débit client</p>
                    <p className="font-black text-primary">{fmt(kkiapayPricing.clientDebitAmount)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-muted-foreground">Coût AgriCapital</p>
                    <p className="font-black text-gold-dark">{fmt(kkiapayPricing.absorbedByAgriCapital)}</p>
                  </div>
                </div>
                {paymentMethod === 'momo' && (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Les frais de transaction sont pris en charge par AgriCapital, afin que le montant payé par le client reste strictement celui annoncé.
                  </p>
                )}
              </div>}

              <Button onClick={() => isDiGratuit ? handleActivationGratuite() : setStep('confirm')} disabled={loading || (montantTotal <= 0 && !isDiGratuit)} className="w-full h-12 rounded-xl font-bold btn-brand">
                <CreditCard className="h-5 w-5 mr-2" />{isDiGratuit ? "Activer ma plantation (0 F)" : "Confirmer et payer"}
              </Button>

            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && plantation && (
          <Card className="card-brand rounded-2xl shadow-md">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setStep('details')} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
                <h3 className="text-base font-bold">Confirmation</h3>
              </div>

              <div className="bg-primary/5 rounded-2xl p-4 space-y-2.5 text-sm card-brand-subtle">
                {[['Client', souscripteur.nom_complet], ['Téléphone', souscripteur.telephone], ['Plantation', plantation.nom_plantation || plantation.id_unique], ['Type', typePaiement === 'da' ? "Dépôt Initial" : 'Mensualité'], ['Tarif', plantationRate ? `${plantationRate.label} — ${fmt(plantationRate.mensuel_par_ha)}/mois/ha` : '']].filter(([, v]) => v).map(([l, v], i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="font-semibold">{v}</span></div>
                ))}
                {modeArriere === 'avance' && (
                  <><div className="flex justify-between text-xs text-muted-foreground"><span>dont arriéré</span><span className="text-destructive font-bold">{fmt(montantArriere)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>dont avance</span><span className="text-primary font-bold">{fmt(montantAvance)}</span></div></>
                )}
                {modeArriere === 'only' && (
                  <div className="flex justify-between text-xs text-gold-dark"><span>Régularisation arriéré</span><span className="font-bold">✓</span></div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground"><span>Mode</span><span className="font-bold">{paymentMethod === 'momo' ? 'Mobile Money' : 'Carte bancaire'}</span></div>
                {paymentMethod === 'momo' && (
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Frais KKiaPay absorbés</span><span className="font-bold text-gold-dark">{fmt(kkiapayPricing.estimatedFees)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t"><span className="font-black text-base">Total</span><span className="text-xl font-black text-primary">{fmt(montantTotal)}</span></div>
              </div>

              <Button onClick={handleSubmit} disabled={loading} className="w-full h-14 text-base rounded-xl font-bold btn-brand">
                {loading ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{isDiGratuit ? 'Activation...' : 'Ouverture...'}</> : <><CreditCard className="h-5 w-5 mr-2" />{isDiGratuit ? 'Activer ma plantation (DI offert)' : 'Procéder au paiement'}</>}
              </Button>
              {isDiGratuit ? (
                <p className="text-[10px] text-center text-muted-foreground">Dépôt Initial à 0 F (promotion CRM) — activation immédiate, aucun paiement requis.</p>
              ) : (
                <p className="text-[10px] text-center text-muted-foreground">Paiement sécurisé via KKiaPay — débit client exact : {fmt(kkiapayPricing.clientDebitAmount)}</p>
              )}

            </CardContent>
          </Card>
        )}

        <Card className="card-brand-green rounded-2xl shadow-none">
          <CardContent className="p-3 text-center">
            <a href="tel:+2250564551717" className="inline-flex items-center gap-2 text-primary font-bold text-sm"><Phone className="h-4 w-4" />+225 05 64 55 17 17</a>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t bg-card py-3">
        <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} AgriCapital</p>
      </footer>
    </div>
  );
};

export default ClientPayment;
