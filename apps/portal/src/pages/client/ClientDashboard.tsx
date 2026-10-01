import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { getCurrentRateFromOffer, getFullTariffGridFromOffer, formatCFA } from "@/utils/pricing";
import { 
  MapPin, Phone, Sprout, CreditCard, Wallet, Bell,
  ArrowRight, LogOut, CheckCircle, AlertTriangle, Clock, History, BarChart2,
  RefreshCw, TrendingUp, Leaf, ChevronRight, Zap, Target, Calendar
} from "lucide-react";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { TransactionStatusWidget } from "@/components/client/TransactionStatusWidget";
import SyncJournalDialog from "@/components/client/SyncJournalDialog";
import AccessCodePanel from "@/components/client/AccessCodePanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ClientDashboardProps {
  souscripteur: any;
  plantations: any[];
  paiements: any[];
  syncStatus?: string;
  lastSync?: Date | null;
  onPayment: (options?: { prefillAmount?: number; prefillType?: 'arriere' | 'avance' | 'solde_initial' }) => void;
  onPortfolio: () => void;
  onHistory: () => void;
  onStatistics: () => void;
  onPlantationHub: () => void;
  onLogout: () => void;
}


const ClientDashboard = ({ 
  souscripteur: initialSouscripteur, 
  plantations: initialPlantations, 
  paiements: initialPaiements, 
  syncStatus, lastSync,
  onPayment, onPortfolio, onHistory, onStatistics, onPlantationHub, onLogout 
}: ClientDashboardProps) => {

  const { toast } = useToast();
  const { permission, isSupported, requestPermission, checkAndNotifyArrears } = usePushNotifications();
  const [souscripteur, setSouscripteur] = useState(initialSouscripteur);
  const [plantations, setPlantations] = useState(initialPlantations);
  const [paiements, setPaiements] = useState(initialPaiements);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccessSaved, setShowAccessSaved] = useState(false);

  useEffect(() => {
    setSouscripteur(initialSouscripteur);
    setPlantations(initialPlantations);
    setPaiements(initialPaiements);
  }, [initialSouscripteur, initialPlantations, initialPaiements]);

  useEffect(() => {
    if (permission === 'granted') checkAndNotifyArrears(plantations, souscripteur);
  }, [permission, plantations, souscripteur, checkAndNotifyArrears]);

  useEffect(() => {
    if (sessionStorage.getItem("agri_access_code_saved") === "1") {
      sessionStorage.removeItem("agri_access_code_saved");
      setShowAccessSaved(true);
    }
  }, []);

  const fmt = (m: number) => formatCFA(m);
  const customPayment = souscripteur?.paiement_personnalise?.actif ? souscripteur.paiement_personnalise : null;
  const customInitialBalance = Number(customPayment?.paiement_initial?.solde || 0);
  const customMonthly = customPayment?.mensualite?.active === true ? customPayment.mensualite : null;
  const totalHectares = plantations.reduce((s: number, p: any) => s + (p.superficie_ha || 0), 0);
  const hectaresActifs = plantations.reduce((s: number, p: any) => s + (p.superficie_activee || 0), 0);

  // Get current rate based on first active plantation's activation date
  const firstActivePlantation = plantations.find((p: any) => p.date_activation);
  const currentRate = useMemo(() => getCurrentRateFromOffer(
    souscripteur.offres,
    firstActivePlantation?.date_activation,
  ), [souscripteur, firstActivePlantation]);

  const tariffGrid = useMemo(() => getFullTariffGridFromOffer(souscripteur.offres), [souscripteur]);

  const arriereData = useMemo(() => {
    if (customPayment) {
      if (!customMonthly) return { totalArrieres: 0, joursRetard: 0 };
      const pending = paiements.filter((pay: any) => pay.type_paiement === 'REDEVANCE' && pay.statut === 'en_attente' && pay.date_echeance && new Date(pay.date_echeance).getTime() < Date.now());
      const totalArrieres = pending.reduce((s: number, pay: any) => s + Number(pay.montant || 0), 0);
      const firstDue = pending.length ? new Date(pending[0].date_echeance).getTime() : 0;
      const joursRetard = firstDue ? Math.max(1, Math.floor((Date.now() - firstDue) / 86400000)) : 0;
      return { totalArrieres, joursRetard };
    }
    let totalArrieres = 0, joursRetard = 0;
    plantations.forEach((p: any) => {
      if (p.date_activation && p.superficie_activee > 0) {
        const plantRate = getCurrentRateFromOffer(souscripteur.offres, p.date_activation);
        const tarifJour = plantRate?.jour_par_ha || 2000;
        const jours = Math.floor((Date.now() - new Date(p.date_activation).getTime()) / 86400000);
        const attendu = jours * tarifJour * (p.superficie_activee || 0);
        const paye = paiements.filter((pay: any) => pay.plantation_id === p.id && (pay.type_paiement === 'REDEVANCE' || pay.type_paiement === 'contribution') && pay.statut === 'valide').reduce((s: number, pay: any) => s + (pay.montant_paye || pay.montant || 0), 0);
        if (attendu > paye) { totalArrieres += attendu - paye; joursRetard = Math.max(joursRetard, Math.floor((attendu - paye) / (tarifJour * (p.superficie_activee || 1)))); }
      }
    });
    return { totalArrieres, joursRetard };
  }, [plantations, paiements, souscripteur, customPayment, customMonthly]);

  const { totalArrieres, joursRetard } = arriereData;

  const daProgress = useMemo(() => {
    // Priorité stricte au CRM (0 F autorisé) — pas de `||` qui masquerait un DI mis à 0.
    const offre = souscripteur.offres || {};
    const crmDI = offre.montant_da_par_ha ?? offre.montant_depot_initial_par_ha;
    const tarifDA = currentRate?.schedule.depot_initial ?? (crmDI ?? 0);
    const totalDA = plantations.reduce((s: number, p: any) => s + ((p.superficie_ha || 0) * tarifDA), 0);
    const totalDAVerse = paiements.filter((p: any) => p.type_paiement === 'DA' && p.statut === 'valide')
      .reduce((s: number, p: any) => s + (p.montant_paye || p.montant || 0), 0);
    const diOffert = tarifDA === 0;
    const plantationNonActivee = plantations.some((p: any) => !p.date_activation || !(p.superficie_activee > 0));
    return {
      tarifDA,
      diOffert,
      activationGratuiteDisponible: diOffert && plantationNonActivee,
      totalDA,
      totalDAVerse,
      pct: totalDA > 0 ? Math.min(100, Math.round((totalDAVerse / totalDA) * 100)) : 100,
    };
  }, [plantations, paiements, souscripteur, currentRate]);

  const prochaines = useMemo(() => {
    if (customPayment) {
      if (!customMonthly) return [];
      return (paiements.length ? paiements.filter((p: any) => p.type_paiement === 'REDEVANCE' && ['planifie','en_attente'].includes(p.statut) && p.date_echeance).slice(0, 3) : plantations.filter((p: any) => p.superficie_activee > 0 && p.date_activation).slice(0, 3)).map((p: any) => ({
        nom: p.nom_plantation || p.id_unique || souscripteur.nom_complet || 'Échéance personnalisée',
        montant: Number(p.montant || customMonthly.montant || 0),
        annee: 'Échéancier personnalisé',
        prochaine: souscripteur.prochaine_echeance ? new Date(souscripteur.prochaine_echeance) : new Date(customMonthly.date_debut + 'T00:00:00'),
      }));
    }
    return plantations.filter((p: any) => p.superficie_activee > 0 && p.date_activation).slice(0, 3).map((p: any) => {
      const rate = getCurrentRateFromOffer(souscripteur.offres, p.date_activation);
      return { nom: p.nom_plantation || p.id_unique, montant: (rate?.mensuel_par_ha || 0) * (p.superficie_activee || 0), annee: rate?.label || '', prochaine: addDays(new Date(), 30) };
    });
  }, [plantations, souscripteur, customPayment, customMonthly]);

  const totalRedevances = paiements.filter((p: any) => (p.type_paiement === 'REDEVANCE' || p.type_paiement === 'contribution') && p.statut === 'valide')
    .reduce((s: number, p: any) => s + (p.montant_paye || p.montant || 0), 0);

  const getInitials = (name: string) => name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'AC';
  const offreNom = souscripteur.offres?.nom || '—';

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const accessToken = sessionStorage.getItem("agri_portal_access_token");
      const isDemo = sessionStorage.getItem("agri_demo") === "1";
      const { data, error } = await supabase.functions.invoke(isDemo ? "subscriber-lookup" : "client-portal-data", { body: isDemo ? { telephone: souscripteur.telephone, silent: true } : { access_token: accessToken } });
      if (error) throw error;
      if (data?.success) {
        setSouscripteur(data.souscripteur); setPlantations(data.plantations); setPaiements(data.paiements);
        sessionStorage.setItem('agri_souscripteur', JSON.stringify(data.souscripteur));
        sessionStorage.setItem('agri_plantations', JSON.stringify(data.plantations));
        sessionStorage.setItem('agri_paiements', JSON.stringify(data.paiements));
        toast({ title: "✅ Données actualisées" });
      }
    } catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible d'actualiser." }); }
    finally { setRefreshing(false); }
  }, [souscripteur.telephone, toast]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #00643C 0%, #004d2e 28%, #f8f7f4 28.1%, #f8f7f4 100%)' }}>
      <Dialog open={showAccessSaved} onOpenChange={setShowAccessSaved}>
        <DialogContent className="max-w-sm text-center rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-3 text-lg">
              <span className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </span>
              Code d'accès enregistré avec succès
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Merci de conserver votre code d'accès en lieu sûr pour vos futures connexions à votre espace client.
          </p>
          <Button className="w-full btn-brand" onClick={() => setShowAccessSaved(false)}>Continuer</Button>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <header className="px-4 pt-4 pb-2 sticky top-0 z-50" style={{ background: 'linear-gradient(180deg, #00643C 0%, #004d2e 100%)' }}>
        <div className="container mx-auto flex items-center justify-between max-w-lg lg:max-w-7xl">
          <div className="bg-white rounded-lg p-1 flex items-center justify-center"><img src={logoWhiteBg} alt="AgriCapital" className="h-10 sm:h-12 object-contain" /></div>
          <div className="flex items-center gap-1">
            {isSupported && permission !== 'granted' && (
              <Button variant="ghost" size="icon" onClick={requestPermission} className="text-white hover:bg-white/15 h-9 w-9 relative">
                <Bell className="h-4 w-4" /><span className="absolute top-1 right-1 h-2 w-2 bg-gold rounded-full animate-pulse" />
              </Button>
            )}
            {permission === 'granted' && <div className="text-white/60 h-9 w-9 flex items-center justify-center"><Bell className="h-4 w-4" /></div>}
            <AccessCodePanel
              telephone={souscripteur?.telephone}
              email={souscripteur?.email}
              account={souscripteur?.id_unique || souscripteur?.telephone}
            />
            <SyncJournalDialog
              account={souscripteur?.id_unique || souscripteur?.telephone}
              status={syncStatus}
              lastSync={lastSync}
            />

            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="text-white hover:bg-white/15 h-9 w-9">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout} className="text-white hover:bg-white/15 h-9 w-9"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="client-page-content flex-1 container mx-auto space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5 max-w-lg lg:max-w-[1400px] pb-8 lg:pb-12 pt-4 lg:pt-6">
        
        {/* Profile Card */}
        <Card className="border-0 shadow-xl overflow-hidden rounded-2xl lg:col-span-5" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl overflow-hidden border-2 border-gold/40 shadow-lg flex-shrink-0">
                {souscripteur.photo_profil_url ? (
                  <img src={souscripteur.photo_profil_url} alt={souscripteur.nom_complet} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-white/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{getInitials(souscripteur.nom_complet)}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/60 uppercase tracking-wider">Bienvenue,</p>
                <h2 className="text-base font-bold text-white truncate">{souscripteur.nom_complet}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className="text-[10px] px-2 py-0 bg-gold/20 border-gold/30 text-white">{offreNom}</Badge>
                  {currentRate && <Badge className="text-[10px] px-2 py-0 bg-white/10 border-white/20 text-white/80">{currentRate.label}</Badge>}
                  <span className="text-[10px] text-white/40">{souscripteur.id_unique || '—'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {customPayment && (
          <Card className="lg:col-span-7 border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="h-5 w-5 text-primary" />
                    <p className="font-bold">Conditions de règlement personnalisées</p>
                    <Badge variant="outline" className="text-primary border-primary/30">Exception individuelle</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-2xl">Cette configuration reste rattachée à l’offre {souscripteur.offres?.formule_nom || 'PalmTerroir Essentielle'} sans créer d’offre spéciale.</p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Solde du PI</p>
                  <p className="text-xl font-extrabold">{fmt(customInitialBalance)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-sm">
                <div className="rounded-xl bg-background/70 border p-3"><p className="text-xs text-muted-foreground">PI déjà versé</p><p className="font-bold">{fmt(Number(customPayment.paiement_initial?.montant_verse || 0))}</p></div>
                <div className="rounded-xl bg-background/70 border p-3"><p className="text-xs text-muted-foreground">Mensualité</p><p className="font-bold">{customMonthly ? fmt(Number(customMonthly.montant || 0)) + ' × ' + customMonthly.nombre : 'Aucune'}</p></div>
                <div className="rounded-xl bg-background/70 border p-3"><p className="text-xs text-muted-foreground">Début mensualités</p><p className="font-bold">{customMonthly?.date_debut ? format(new Date(customMonthly.date_debut), 'dd/MM/yyyy') : '—'}</p></div>
              </div>
              {customInitialBalance > 0 && (
                <Button className="mt-4" size="sm" onClick={() => onPayment({ prefillAmount: customInitialBalance, prefillType: 'solde_initial' })}>Payer le solde du PI — {fmt(customInitialBalance)}</Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 lg:col-span-7">
          {[
            { icon: Sprout, value: plantations.length, label: "Plantation(s)", color: "text-green-400" },
            { icon: MapPin, value: totalHectares, label: "Hectare(s)", color: "text-gold" },
            { icon: CheckCircle, value: hectaresActifs, label: "Ha. actifs", color: "text-blue-400" }
          ].map((stat, i) => (
            <Card key={i} className="border-0 shadow-lg rounded-2xl" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)' }}>
              <CardContent className="p-3 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-[10px] text-white/60">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progressive Tarifs */}
        {currentRate && (
          <Card className="card-brand-gold rounded-2xl shadow-sm lg:col-span-8">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-gold/10 flex items-center justify-center"><Leaf className="h-3.5 w-3.5 text-gold" /></div>
                <span className="text-xs font-bold text-foreground">Tarifs {offreNom} — {currentRate.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-muted/40 rounded-xl p-2 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase">Dépôt initial / ha</p>
                  <p className="text-sm font-black text-gold-dark">{fmt(currentRate.schedule.depot_initial)}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-2 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase">Mensuel actuel / ha</p>
                  <p className="text-sm font-black text-primary">{fmt(currentRate.mensuel_par_ha)}</p>
                </div>
              </div>
              {/* Tariff grid - all years */}
              {tariffGrid && (
                <div className="space-y-1 mt-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Grille tarifaire par hectare</p>
                  {tariffGrid.map((row, i) => (
                    <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${currentRate.annee === i + 1 ? 'bg-primary/10 font-bold' : 'bg-muted/20'}`}>
                      <span className={currentRate.annee === i + 1 ? 'text-primary' : 'text-muted-foreground'}>{row.label}</span>
                      <div className="flex gap-3">
                        <span className="text-muted-foreground">{fmt(row.mensuel)}/mois</span>
                        <span className="font-bold">{fmt(row.total)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gold/10 text-xs font-bold">
                    <span className="text-gold-dark">TOTAL ({currentRate.schedule.duree_totale_mois} mois)</span>
                    <span className="text-gold-dark">{fmt(currentRate.schedule.total_par_ha)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Alerte arriérés */}
        {totalArrieres > 0 && (
          <Card className="card-brand rounded-2xl shadow-lg border-destructive/20 lg:col-span-4">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-destructive text-sm">Arriéré de paiement</p>
                  <p className="text-xs text-destructive/70 mt-0.5">{joursRetard} jour(s) de retard — <span className="font-bold">{fmt(totalArrieres)}</span></p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => onPayment({ prefillAmount: totalArrieres, prefillType: 'arriere' })} className="h-10 text-xs gap-1.5 rounded-xl btn-brand">
                  <Zap className="h-3.5 w-3.5" /> Rattraper
                </Button>
                <Button onClick={() => onPayment({ prefillAmount: totalArrieres, prefillType: 'avance' })} variant="outline" className="h-10 text-xs border-gold/40 text-gold-dark gap-1.5 rounded-xl hover:bg-gold/5" size="sm">
                  <Target className="h-3.5 w-3.5" /> Arriéré + avance
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dépôt Initial offert (0 F via promotion CRM) */}
        {daProgress.diOffert && (
          <Card className="card-brand-subtle rounded-2xl shadow-md border-gold/40 lg:col-span-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-gold/15 flex items-center justify-center"><CheckCircle className="h-4 w-4 text-gold-dark" /></div>
                <span className="text-sm font-semibold">Dépôt Initial</span>
                <Badge variant="outline" className="ml-auto border-gold/40 bg-gold/10 text-gold-dark text-[10px]">Offert · 0 F</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Votre Dépôt Initial est à <span className="font-bold text-primary">0 F</span> grâce à la promotion en cours côté AgriCapital. Aucun paiement n'est requis pour démarrer.
              </p>
              {daProgress.activationGratuiteDisponible ? (
                <Button onClick={() => onPayment()} className="w-full h-11 rounded-xl btn-brand text-sm font-bold gap-2">
                  <Zap className="h-4 w-4" /> Activer ma plantation (0 F)
                </Button>
              ) : (
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> Plantation déjà activée</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dépôt Initial Progress */}
        {daProgress.totalDA > 0 && (
          <Card className="card-brand-subtle rounded-2xl shadow-md lg:col-span-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center"><Target className="h-4 w-4 text-primary" /></div>
                  <span className="text-sm font-semibold">Dépôt Initial</span>
                </div>
                <span className="text-lg font-bold text-primary">{daProgress.pct}%</span>
              </div>
              <Progress value={daProgress.pct} className="h-3 mb-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Versé : <span className="font-bold text-primary">{fmt(daProgress.totalDAVerse)}</span></span>
                <span>Total : {fmt(daProgress.totalDA)}</span>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Prochaines échéances */}
        {prochaines.length > 0 && (
          <Card className="card-brand-subtle rounded-2xl shadow-sm lg:col-span-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-gold/10 flex items-center justify-center"><Clock className="h-4 w-4 text-gold" /></div>
                <span className="text-sm font-semibold">Prochaines échéances</span>
              </div>
              <div className="space-y-2">
                {prochaines.map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{e.nom}</p>
                      <p className="text-[10px] text-muted-foreground">{format(e.prochaine, "dd MMM yyyy", { locale: fr })} · {e.annee}</p>
                    </div>
                    <span className="text-xs font-bold text-gold-dark ml-2 shrink-0">{fmt(e.montant)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Ma Plantation (nouveau hub complet) */}
        <Button onClick={onPlantationHub} className="w-full h-14 lg:h-16 text-base font-bold gap-3 shadow-xl rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white lg:col-span-6">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center"><Leaf className="h-5 w-5" /></div>
          <span className="flex-1 text-left">Ma Plantation<span className="block text-[10px] font-normal opacity-80">Progression · Médias · Carte · Rapports</span></span>
          <ArrowRight className="h-5 w-5" />
        </Button>

        {/* CTA Paiement */}
        <Button onClick={() => onPayment()} className="w-full h-14 lg:h-16 text-base font-bold gap-3 shadow-xl rounded-2xl btn-brand lg:col-span-6">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">{daProgress.activationGratuiteDisponible ? <Zap className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}</div>
          <span className="flex-1 text-left">{daProgress.activationGratuiteDisponible ? "Activer ma plantation (DI offert)" : "Effectuer un paiement"}</span>
          <ArrowRight className="h-5 w-5" />
        </Button>

        {/* Suivi temps réel des transactions */}
        <div className="lg:col-span-12"><TransactionStatusWidget paiements={paiements} limit={5} /></div>

        {/* Navigation + Summary unifiés (7 blocs sur desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 lg:gap-3 lg:col-span-12">
          {[
            { action: onPortfolio, icon: Wallet, label: "Mon portefeuille", desc: "Plantations & parcelles" },
            { action: onHistory, icon: History, label: "Historique paiements", desc: "Toutes vos transactions" },
            { action: onStatistics, icon: BarChart2, label: "Mes statistiques", desc: "Graphiques & analyses" }
          ].map((btn, i) => (
            <Card key={i} className="card-brand-subtle rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={btn.action}>
              <CardContent className="p-3 lg:p-4 flex items-center gap-3 h-full">
                <div className="h-10 w-10 lg:h-11 lg:w-11 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <btn.icon className="h-5 w-5 lg:h-5 lg:w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{btn.label}</p>
                  <p className="text-[10px] lg:text-[11px] text-muted-foreground truncate">{btn.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gold/40 shrink-0" />
              </CardContent>
            </Card>
          ))}
          {[
            { icon: CheckCircle, label: "DI versé", value: fmt(daProgress.totalDAVerse), color: "text-primary" },
            { icon: CreditCard, label: "Mensualités", value: fmt(totalRedevances), color: "text-gold-dark" },
            { icon: TrendingUp, label: "Validés", value: String(paiements.filter((p: any) => p.statut === 'valide').length), color: "text-primary" },
            { icon: Leaf, label: "Offre", value: offreNom, color: "text-gold-dark" }
          ].map((card, i) => (
            <Card key={`s-${i}`} className="card-brand-subtle rounded-2xl shadow-sm">
              <CardContent className="p-3 lg:p-4 h-full flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mb-1">
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                  <span className="text-[10px] lg:text-[11px] text-muted-foreground truncate">{card.label}</span>
                </div>
                <p className="text-sm lg:text-base font-bold truncate">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>


        {/* Promotion active */}
        {souscripteur.promotion_active && (
          <Card className="rounded-2xl shadow-md border-0 overflow-hidden lg:col-span-6" style={{ background: 'linear-gradient(120deg, #E89C31 0%, #B97A0E 100%)' }}>
            <CardContent className="p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider opacity-80">Promotion active</p>
                  <p className="font-bold text-sm truncate">{souscripteur.promotion_active.nom}</p>
                  <p className="text-xs opacity-90">
                    {souscripteur.promotion_active.pourcentage_reduction > 0 
                      ? `-${souscripteur.promotion_active.pourcentage_reduction}% sur ${souscripteur.promotion_active.cible || 'votre offre'}`
                      : `-${fmt(souscripteur.promotion_active.montant_fixe_reduction || 0)} de réduction`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mon Conseiller */}
        {souscripteur.commercial && (
          <Card className="card-brand-subtle rounded-2xl shadow-sm lg:col-span-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center shrink-0 border-2 border-gold/30">
                  {souscripteur.commercial.photo ? (
                    <img src={souscripteur.commercial.photo} alt={souscripteur.commercial.nom} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-primary">{getInitials(souscripteur.commercial.nom)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{souscripteur.commercial.fonction}</p>
                  <p className="font-bold text-sm truncate">{souscripteur.commercial.nom}</p>
                  {souscripteur.commercial.telephone && (
                    <a href={`tel:${souscripteur.commercial.telephone}`} className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {souscripteur.commercial.telephone}
                    </a>
                  )}
                </div>
                {souscripteur.commercial.telephone && (
                  <a href={`https://wa.me/225${souscripteur.commercial.telephone.replace(/\D/g,'').replace(/^225/,'')}`}
                     target="_blank" rel="noreferrer"
                     className="h-10 w-10 rounded-xl bg-[#22C55E]/10 hover:bg-[#22C55E]/20 flex items-center justify-center text-[#22C55E] transition-colors">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
              {souscripteur.numero_contrat && (
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Contrat</span>
                  <span className="font-mono font-bold text-foreground">{souscripteur.numero_contrat}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card className="card-brand-green rounded-2xl shadow-none lg:col-span-12">
          <CardContent className="p-4 text-center">
            <div className="bg-white rounded-lg p-2 inline-flex"><img src={logoWhiteBg} alt="AgriCapital" className="h-12 sm:h-14 mx-auto object-contain" /></div>
            <p className="text-xs text-muted-foreground mb-1.5">Assistance AgriCapital</p>
            <a href="tel:+2250564551717" className="inline-flex items-center gap-2 text-primary font-bold hover:underline text-sm">
              <Phone className="h-4 w-4" /> +225 05 64 55 17 17
            </a>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t bg-card py-3">
        <p className="text-[10px] text-muted-foreground text-center">© {new Date().getFullYear()} AgriCapital · Portail Client</p>
      </footer>
    </div>
  );
};

export default ClientDashboard;
