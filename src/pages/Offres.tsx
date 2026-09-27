import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Crown, TrendingUp, Leaf, Plus, Pencil, Loader2, Trash2, Gift, Percent, CheckCircle, XCircle, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSafeErrorMessage } from "@/lib/safeError";
import { useOffresPrixEffectif } from "@/hooks/useOffresPrixEffectif";

type Offre = Tables<'offres'>;
type Promotion = Tables<'promotions'>;

const getIcone = (code: string) => {
  switch (code) {
    case 'palm-invest-plus':
      return Crown;
    case 'palm-invest':
      return TrendingUp;
    case 'terra-palm':
      return Leaf;
    default:
      return Crown;
  }
};

const getCouleur = (code: string, couleur?: string | null) => {
  if (couleur) {
    return {
      text: `text-[${couleur}]`,
      bg: `bg-[${couleur}]/10`,
      border: `border-[${couleur}]/30`
    };
  }
  switch (code) {
    case 'palm-invest-plus':
      return { text: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    case 'palm-invest':
      return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
    case 'terra-palm':
      return { text: 'text-emerald-700', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    default:
      return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
  }
};

const Offres = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { parOffre } = useOffresPrixEffectif();
  const [activeTab, setActiveTab] = useState<'offres' | 'promotions'>('offres');
  const [editOffre, setEditOffre] = useState<Offre | null>(null);
  const [isOffreDialogOpen, setIsOffreDialogOpen] = useState(false);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  const [promoFormData, setPromoFormData] = useState({
    nom: "",
    pourcentage_reduction: "30",
    montant_fixe_reduction: "",
    date_debut: "",
    date_fin: "",
    description: "",
    applique_toutes_offres: true,
    cible: "paiement_initial",
    type_promotion: "paiement_initial",
  });

  // Fetch offres
  const { data: offres, isLoading: loadingOffres } = useQuery({
    queryKey: ['offres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offres')
        .select('*')
        .order('ordre', { ascending: true });
      
      if (error) throw error;
      return data as Offre[];
    }
  });

  // Fetch promotions
  const { data: promotions, isLoading: loadingPromos } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Update offre
  const updateOffreMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Offre> }) => {
      const { error } = await supabase
        .from('offres')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offres'] });
      toast({ title: "Offre mise à jour" });
      setIsOffreDialogOpen(false);
      setEditOffre(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour l'offre." });
    }
  });

  // Toggle offre
  const toggleOffreMutation = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from('offres')
        .update({ actif })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offres'] });
    }
  });

  const deleteOffreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('offres').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Offre supprimée' });
      queryClient.invalidateQueries({ queryKey: ['offres'] });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: err?.message });
    },
  });

  // Save promotion
  const savePromoMutation = useMutation({
    mutationFn: async (data: typeof promoFormData) => {
      const promoData = {
        nom: data.nom,
        pourcentage_reduction: Number(data.pourcentage_reduction || 0),
        montant_fixe_reduction: Number(data.montant_fixe_reduction || 0),
        date_debut: new Date(`${data.date_debut}T00:00:00`).toISOString(),
        // Une date de fin saisie dans le formulaire couvre toute la journée.
        date_fin: new Date(`${data.date_fin}T23:59:59.999`).toISOString(),
        description: data.description,
        active: true,
        applique_toutes_offres: data.applique_toutes_offres,
        cible: data.cible,
        type_promotion: data.cible,
      };

      if (editingPromo) {
        const { error } = await supabase
          .from('promotions')
          .update(promoData)
          .eq('id', editingPromo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('promotions')
          .insert([promoData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['offres-prix-effectif'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-active'] });
      queryClient.invalidateQueries({ queryKey: ['offres-acquisition'] });
      toast({ title: editingPromo ? "Promotion modifiée" : "Promotion créée" });
      resetPromoForm();
      setIsPromoDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    }
  });

  // Toggle promo status
  const togglePromoMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: boolean }) => {
      const { error } = await supabase
        .from('promotions')
        .update({ active: newStatus })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['offres-prix-effectif'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-active'] });
      queryClient.invalidateQueries({ queryKey: ['offres-acquisition'] });
    }
  });

  // Delete promo
  const deletePromoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['offres-prix-effectif'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-active'] });
      queryClient.invalidateQueries({ queryKey: ['offres-acquisition'] });
      toast({ title: "Promotion supprimée" });
    }
  });

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR').format(montant);
  };

  const getTranches = (offre: any) => {
    const raw = Array.isArray(offre?.tranches_paiement) ? offre.tranches_paiement : [];
    if (raw.length) return raw;
    const duree = Number(offre?.duree_paiement_mois) || 0;
    const mensuel = Number(offre?.contribution_mensuelle_par_ha) || 0;
    return mensuel > 0 && duree > 0 ? [{ annee: 1, mois_debut: 1, mois_fin: duree, mois: duree, mensualite_par_ha: mensuel, total_periode_par_ha: mensuel * duree }] : [];
  };

  const handleSaveOffre = () => {
    if (!editOffre) return;
    const pi = Math.max(0, Number(editOffre.montant_pi_par_ha) || 0);
    const tranches = getTranches(editOffre).map((t: any, index: number) => {
      const mois = Math.max(0, Number(t.mois) || ((Number(t.mois_fin) || 0) - (Number(t.mois_debut) || 0) + 1));
      const mensuel = Math.max(0, Number(t.mensualite_par_ha) || 0);
      return { ...t, annee: Number(t.annee) || index + 1, mois, mensualite_par_ha: mensuel, total_periode_par_ha: mensuel * mois };
    });
    const duree = tranches.reduce((sum: number, t: any) => sum + Number(t.mois || 0), 0);
    // Les tranches ponctuelles (ex. paiement après trouaison) peuvent déjà
    // être incluses dans le PI. Le total contractuel = PI + mensualités.
    // On ne les additionne donc jamais une seconde fois.
    const totalMensualites = tranches.reduce(
      (sum: number, t: any) => sum + (Number(t.mensualite_par_ha || 0) * Number(t.mois || 0)),
      0,
    );
    const total = pi + totalMensualites;
    const lastMonthly = Number(tranches[tranches.length - 1]?.mensualite_par_ha || 0);
    updateOffreMutation.mutate({
      id: editOffre.id,
      updates: {
        nom: editOffre.nom,
        description: editOffre.description,
        montant_pi_par_ha: pi,
        contribution_mensuelle_par_ha: lastMonthly,
        montant_total_par_ha: total,
        duree_paiement_mois: duree,
        tranches_paiement: tranches as any,
        couleur: editOffre.couleur,
        avantages: editOffre.avantages
      }
    });
  };

  const resetPromoForm = () => {
    setPromoFormData({
      nom: "",
      pourcentage_reduction: "30",
      montant_fixe_reduction: "",
      date_debut: "",
      date_fin: "",
      description: "",
      applique_toutes_offres: true,
      cible: "paiement_initial",
      type_promotion: "paiement_initial",
    });
    setEditingPromo(null);
  };

  const handleEditPromo = (promo: Promotion) => {
    setEditingPromo(promo);
    setPromoFormData({
      nom: promo.nom,
      pourcentage_reduction: promo.pourcentage_reduction.toString(),
      montant_fixe_reduction: String(promo.montant_fixe_reduction || 0),
      date_debut: format(new Date(promo.date_debut), 'yyyy-MM-dd'),
      date_fin: format(new Date(promo.date_fin), 'yyyy-MM-dd'),
      description: promo.description || "",
      applique_toutes_offres: promo.applique_toutes_offres ?? true,
      cible: promo.cible || (promo.type_promotion === "cout_global" ? "cout_global" : "paiement_initial"),
      type_promotion: promo.cible || (promo.type_promotion === "cout_global" ? "cout_global" : "paiement_initial"),
    });
    setIsPromoDialogOpen(true);
  };

  const handleSubmitPromo = (e: React.FormEvent) => {
    e.preventDefault();
    savePromoMutation.mutate(promoFormData);
  };

  const parseAvantages = (avantages: any): string[] => {
    if (Array.isArray(avantages)) return avantages;
    if (typeof avantages === 'string') {
      try {
        return JSON.parse(avantages);
      } catch {
        return [avantages];
      }
    }
    return [];
  };

  const calculateReducedAmount = (offreMontant: number, percentage: number, fixed = 0) => {
    return Math.max(offreMontant - (offreMontant * percentage / 100) - fixed, 0);
  };

  // Récupérer la promo active
  const activePromo = promotions?.find(p => {
    if (!p.active) return false;
    const now = new Date();
    return new Date(p.date_debut) <= now && new Date(p.date_fin) >= now;
  });

  if (loadingOffres) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Offres & Promotions</h2>
          <p className="text-muted-foreground">Gérez les offres clients et les promotions</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'offres' | 'promotions')}>
        <TabsList>
          <TabsTrigger value="offres" className="gap-2">
            <Crown className="h-4 w-4" />
            Offres
          </TabsTrigger>
          <TabsTrigger value="promotions" className="gap-2">
            <Gift className="h-4 w-4" />
            Promotions
            {activePromo && (
              <Badge className="ml-1 bg-green-500" variant="secondary">1 active</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Onglet Offres */}
        <TabsContent value="offres" className="space-y-4">
          {activePromo && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 flex items-center gap-3">
                <Gift className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Promotion active: {activePromo.nom}</p>
                  <p className="text-sm text-green-600">
                    -{activePromo.pourcentage_reduction}% sur {activePromo.cible === "cout_global" ? "le CG" : "le PI"} jusqu'au {format(new Date(activePromo.date_fin), 'dd/MM/yyyy', { locale: fr })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {offres?.map((offre) => {
              const IconComponent = getIcone(offre.code);
              const couleurs = getCouleur(offre.code, offre.couleur);
              const avantagesList = parseAvantages(offre.avantages);
              const prix = parOffre(offre.id);
              const promoApplicable = !!prix?.promotion_id;
              
              return (
                <Card 
                  key={offre.id} 
                  className={`relative overflow-hidden transition-all ${couleurs.border} ${!offre.actif ? 'opacity-60' : ''}`}
                >
                  <CardHeader className={`${couleurs.bg} pb-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-full bg-white shadow-sm">
                          <IconComponent className={`h-8 w-8 ${couleurs.text}`} />
                        </div>
                        <div>
                          <CardTitle className={`text-xl ${couleurs.text}`}>
                            {offre.nom}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">{offre.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={offre.actif ?? true}
                        onCheckedChange={(checked) => toggleOffreMutation.mutate({ id: offre.id, actif: checked })}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Paiement Initial (PI) / ha :</p>
                      <div className="flex items-baseline gap-2">
                        {promoApplicable && prix && prix.depot_initial_effectif !== prix.depot_initial_base && (
                          <span className="text-lg text-muted-foreground line-through">
                            {formatMontant(prix.depot_initial_base)}F
                          </span>
                        )}
                        <span className="text-2xl font-bold text-primary">
                          {formatMontant(prix?.depot_initial_effectif ?? offre.montant_pi_par_ha)}F
                        </span>
                        <span className="text-sm">/ha</span>
                        {promoApplicable && prix && (
                          <Badge className="bg-green-500">
                            {prix.reduction_pct > 0 ? `-${prix.reduction_pct}%` : "Promotion"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const pe = parOffre(offre.id);
                      const promoActive = !!pe?.promotion_id;
                      return (
                        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                          <p className="text-sm font-semibold">Prix effectif (promotion appliquée depuis la base)</p>
                          <div className="grid gap-1 text-sm">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-muted-foreground">Prix global / ha</span>
                              <span className="flex items-baseline gap-2">
                                {promoActive && pe && pe.montant_total_effectif !== pe.montant_total_base && (
                                  <span className="line-through text-muted-foreground">{formatMontant(pe.montant_total_base)}F</span>
                                )}
                                <span className="font-bold text-primary">{formatMontant(pe?.montant_total_effectif ?? offre.montant_total_par_ha)}F</span>
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-muted-foreground">Paiement Initial (PI) / ha</span>
                              <span className="flex items-baseline gap-2">
                                {promoActive && pe && pe.depot_initial_effectif !== pe.depot_initial_base && (
                                  <span className="line-through text-muted-foreground">{formatMontant(pe.depot_initial_base)}F</span>
                                )}
                                <span className="font-bold">{formatMontant(pe?.depot_initial_effectif ?? offre.montant_pi_par_ha)}F</span>
                              </span>
                            </div>
                            <div className="space-y-2">
                              <span className="text-muted-foreground">Échéancier mensuel / ha</span>
                              <div className="space-y-1 rounded-md bg-background/70 p-2">
                                {(pe?.tranches_effectives?.length
                                  ? pe.tranches_effectives
                                  : getTranches(offre)
                                ).filter((t: any) => Number(t.mensualite_par_ha ?? 0) > 0).map((t: any, i: number) => {
                                  const base = Number(t.mensualite_par_ha ?? 0);
                                  const eff = Number(t.mensualite_par_ha_effective ?? base);
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <span>An {t.annee ?? i + 1} — {t.mois ?? ((t.mois_fin ?? 0) - (t.mois_debut ?? 0) + 1)} mois</span>
                                      <span className="font-semibold">
                                        {promoActive && eff !== base && <span className="mr-2 text-muted-foreground line-through">{formatMontant(base)}F</span>}
                                        {formatMontant(eff)}F/mois
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          {promoActive && pe && (
                            <Badge className="bg-green-500">
                              {pe.promotion_nom} — {pe.promotion_cible === "paiement_initial" ? "PI" : "CG"} -{pe.reduction_pct}%
                            </Badge>
                          )}
                        </div>
                      );
                    })()}


                    <div className="space-y-2 pt-2 border-t">
                      {avantagesList.map((avantage: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{avantage}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <Badge variant={offre.actif ? "default" : "secondary"}>
                        {offre.actif ? "Active" : "Inactive"}
                      </Badge>
                      <Dialog open={isOffreDialogOpen && editOffre?.id === offre.id} onOpenChange={(open) => {
                        setIsOffreDialogOpen(open);
                        if (!open) setEditOffre(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditOffre(offre);
                            setIsOffreDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Modifier
                          </Button>
                        </DialogTrigger>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-2"
                          onClick={() => {
                            if (confirm(`Supprimer définitivement l'offre "${offre.nom}" ? Cette action est irréversible.`)) {
                              deleteOffreMutation.mutate(offre.id);
                            }
                          }}
                          disabled={deleteOffreMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Modifier l'offre {editOffre?.nom}</DialogTitle>
                          </DialogHeader>
                          {editOffre && (
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="nom">Nom de l'offre</Label>
                                <Input 
                                  id="nom"
                                  value={editOffre.nom}
                                  onChange={(e) => setEditOffre({...editOffre, nom: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="description">Description</Label>
                                <Textarea 
                                  id="description"
                                  value={editOffre.description || ''}
                                  onChange={(e) => setEditOffre({...editOffre, description: e.target.value})}
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="montant_pi">Montant PI/ha (F)</Label>
                                  <Input 
                                    id="montant_pi"
                                    type="number"
                                    value={editOffre.montant_pi_par_ha ?? ""}
                                    onChange={(e) => setEditOffre({...editOffre, montant_pi_par_ha: e.target.value === "" ? null : Number(e.target.value)})}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="contribution">Échéancier mensuel / ha (F)</Label>
                                  <Input 
                                    id="contribution"
                                    type="number"
                                    value={editOffre.contribution_mensuelle_par_ha ?? ""}
                                    onChange={(e) => {
                                      const value = e.target.value === "" ? 0 : Number(e.target.value);
                                      const current = getTranches(editOffre);
                                      const next = current.length ? current.map((t:any,i:number)=>i===current.length-1?{...t,mensualite_par_ha:value}:t) : [{annee:1,mois:1,mensualite_par_ha:value}];
                                      setEditOffre({...editOffre, contribution_mensuelle_par_ha:value, tranches_paiement:next});
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="space-y-3 rounded-lg border p-3">
                                <div>
                                  <div className="text-sm font-semibold">Échéancier par période</div>
                                  <p className="text-xs text-muted-foreground">Le PI reste séparé. Les mensualités sont configurées par An 1, An 2 et An 3.</p>
                                </div>
                                {getTranches(editOffre).filter((t:any)=>t.type !== "paiement_initial").map((t:any,index:number)=>(
                                  <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div>
                                      <Label>An {index+1} — nombre de mois</Label>
                                      <Input type="number" min="0" value={t.mois ?? ""} onChange={(e)=>{
                                        const next=getTranches(editOffre).map((x:any,i:number)=>i===index?{...x,mois:e.target.value===""?"":Number(e.target.value)}:x);
                                        setEditOffre({...editOffre,tranches_paiement:next});
                                      }}/>
                                    </div>
                                    <div>
                                      <Label>Mensualité / ha (F)</Label>
                                      <Input type="number" min="0" value={t.mensualite_par_ha ?? ""} onChange={(e)=>{
                                        const next=getTranches(editOffre).map((x:any,i:number)=>i===index?{...x,mensualite_par_ha:e.target.value===""?"":Number(e.target.value)}:x);
                                        setEditOffre({...editOffre,tranches_paiement:next});
                                      }}/>
                                    </div>
                                    <div className="flex items-end pb-2 text-xs text-muted-foreground">{formatMontant((Number(t.mois)||0)*(Number(t.mensualite_par_ha)||0))} F / période</div>
                                  </div>
                                ))}
                              </div>
                              <Button 
                                onClick={handleSaveOffre} 
                                className="w-full"
                                disabled={updateOffreMutation.isPending}
                              >
                                {updateOffreMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Enregistrer
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Onglet Promotions */}
        <TabsContent value="promotions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Gestion des promotions</h3>
              <p className="text-sm text-muted-foreground">
                Les promotions s'appliquent automatiquement à toutes les offres
              </p>
            </div>
            
            <Dialog open={isPromoDialogOpen} onOpenChange={(open) => {
              setIsPromoDialogOpen(open);
              if (!open) resetPromoForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle Promotion
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPromo ? "Modifier la promotion" : "Créer une promotion"}
                  </DialogTitle>
                  <DialogDescription>
                    La réduction sera appliquée automatiquement sur le Paiement Initial (PI) ou le Coût Global (CG), selon le choix ci-dessous.
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmitPromo} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="promo-nom">Nom de la promotion *</Label>
                    <Input
                      id="promo-nom"
                      value={promoFormData.nom}
                      onChange={(e) => setPromoFormData({...promoFormData, nom: e.target.value})}
                      placeholder="Ex: Promo Lancement Phase Pilote"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Assiette de la promotion *</Label>
                    <Select
                      value={promoFormData.cible}
                      onValueChange={(v) => setPromoFormData({ ...promoFormData, cible: v, type_promotion: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paiement_initial">Paiement Initial (PI)</SelectItem>
                        <SelectItem value="cout_global">Coût Global (CG)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {promoFormData.cible === "paiement_initial"
                        ? "La remise porte uniquement sur le Paiement Initial."
                        : "La remise porte sur le prix global du contrat. Le PI et les mensualités sont recalculés."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pourcentage">Pourcentage de réduction (%)</Label>
                      <div className="relative">
                        <Input
                          id="pourcentage"
                          type="number"
                          value={promoFormData.pourcentage_reduction}
                          onChange={(e) => setPromoFormData({...promoFormData, pourcentage_reduction: e.target.value})}
                          min="1"
                          max="99"
                          min="0"
                        />
                        <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Aperçu indicatif</Label>
                      <div className="p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-sm text-green-700">
                          20 000F → {formatMontant(calculateReducedAmount(promoFormData.cible === "paiement_initial" ? 20000 : 100000, Number(promoFormData.pourcentage_reduction || "0"), Number((promoFormData as any).montant_fixe_reduction || 0)))}F
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="debut">Date début *</Label>
                      <Input
                        id="debut"
                        type="date"
                        value={promoFormData.date_debut}
                        onChange={(e) => setPromoFormData({...promoFormData, date_debut: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fin">Date fin *</Label>
                      <Input
                        id="fin"
                        type="date"
                        value={promoFormData.date_fin}
                        onChange={(e) => setPromoFormData({...promoFormData, date_fin: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="desc">Description</Label>
                    <Textarea
                      id="desc"
                      value={promoFormData.description}
                      onChange={(e) => setPromoFormData({...promoFormData, description: e.target.value})}
                      placeholder="Informations complémentaires..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsPromoDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={savePromoMutation.isPending}>
                      {savePromoMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingPromos ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : promotions && promotions.length > 0 ? (
                <div className="overflow-x-auto"><Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Réduction</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotions.map((promo) => {
                      const now = new Date();
                      const isCurrentlyActive = promo.active && 
                        new Date(promo.date_debut) <= now && 
                        new Date(promo.date_fin) >= now;
                      
                      return (
                        <TableRow key={promo.id}>
                          <TableCell className="font-medium">{promo.nom}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-primary font-bold">
                              -{promo.pourcentage_reduction}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(promo.date_debut), 'dd/MM/yyyy', { locale: fr })} -{' '}
                            {format(new Date(promo.date_fin), 'dd/MM/yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            {isCurrentlyActive ? (
                              <Badge className="bg-green-500">ACTIVE</Badge>
                            ) : promo.active ? (
                              <Badge variant="secondary">Programmée</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="ghost" onClick={() => handleEditPromo(promo)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => togglePromoMutation.mutate({ id: promo.id, newStatus: !promo.active })}
                            >
                              {promo.active ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Supprimer cette promotion ?')) {
                                  deletePromoMutation.mutate(promo.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table></div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  Aucune promotion configurée. Créez-en une pour commencer.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Offres;
