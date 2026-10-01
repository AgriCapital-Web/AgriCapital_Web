import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Crown, TrendingUp, Leaf, Plus, Pencil, Loader2, Trash2, Gift, Percent, CheckCircle, XCircle, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Offre = Tables<'offres'>;
type Promotion = Tables<'promotions'>;

const getIcone = (code: string) => {
  switch (code) {
    case 'PALMELITE':
      return Crown;
    case 'PALMINVEST':
      return TrendingUp;
    case 'TERRAPALM':
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
    case 'PALMELITE':
      return { text: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    case 'PALMINVEST':
      return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
    case 'TERRAPALM':
      return { text: 'text-emerald-700', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    default:
      return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
  }
};

const Offres = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'offres' | 'promotions'>('offres');
  const [editOffre, setEditOffre] = useState<Offre | null>(null);
  const [isOffreDialogOpen, setIsOffreDialogOpen] = useState(false);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  const [promoFormData, setPromoFormData] = useState({
    nom: "",
    pourcentage_reduction: "30",
    date_debut: "",
    date_fin: "",
    description: "",
    applique_toutes_offres: true,
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

  // Save promotion
  const savePromoMutation = useMutation({
    mutationFn: async (data: typeof promoFormData) => {
      const promoData = {
        nom: data.nom,
        pourcentage_reduction: parseInt(data.pourcentage_reduction),
        date_debut: new Date(data.date_debut).toISOString(),
        date_fin: new Date(data.date_fin).toISOString(),
        description: data.description,
        active: true,
        applique_toutes_offres: data.applique_toutes_offres,
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
      toast({ title: editingPromo ? "Promotion modifiée" : "Promotion créée" });
      resetPromoForm();
      setIsPromoDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
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
      toast({ title: "Promotion supprimée" });
    }
  });

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR').format(montant);
  };

  const handleSaveOffre = () => {
    if (!editOffre) return;
    updateOffreMutation.mutate({
      id: editOffre.id,
      updates: {
        nom: editOffre.nom,
        description: editOffre.description,
        montant_da_par_ha: editOffre.montant_da_par_ha,
        contribution_mensuelle_par_ha: editOffre.contribution_mensuelle_par_ha,
        couleur: editOffre.couleur,
        avantages: editOffre.avantages
      }
    });
  };

  const resetPromoForm = () => {
    setPromoFormData({
      nom: "",
      pourcentage_reduction: "30",
      date_debut: "",
      date_fin: "",
      description: "",
      applique_toutes_offres: true,
    });
    setEditingPromo(null);
  };

  const handleEditPromo = (promo: Promotion) => {
    setEditingPromo(promo);
    setPromoFormData({
      nom: promo.nom,
      pourcentage_reduction: promo.pourcentage_reduction.toString(),
      date_debut: format(new Date(promo.date_debut), 'yyyy-MM-dd'),
      date_fin: format(new Date(promo.date_fin), 'yyyy-MM-dd'),
      description: promo.description || "",
      applique_toutes_offres: promo.applique_toutes_offres ?? true,
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

  const calculateReducedAmount = (offreMontant: number, percentage: number) => {
    return offreMontant - (offreMontant * percentage / 100);
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
          <p className="text-muted-foreground">Gérez les offres de souscription et les promotions</p>
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
                    -{activePromo.pourcentage_reduction}% sur le DA jusqu'au {format(new Date(activePromo.date_fin), 'dd/MM/yyyy', { locale: fr })}
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
              const montantPromo = activePromo 
                ? calculateReducedAmount(offre.montant_da_par_ha, activePromo.pourcentage_reduction)
                : offre.montant_da_par_ha;
              
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
                      <p className="text-sm text-muted-foreground">Droit d'accès :</p>
                      <div className="flex items-baseline gap-2">
                        {activePromo ? (
                          <>
                            <span className="text-lg text-muted-foreground line-through">
                              {formatMontant(offre.montant_da_par_ha)}F
                            </span>
                            <span className="text-2xl font-bold text-green-600">
                              {formatMontant(montantPromo)}F
                            </span>
                            <Badge className="bg-green-500">-{activePromo.pourcentage_reduction}%</Badge>
                          </>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-primary">
                              {formatMontant(offre.montant_da_par_ha)}F
                            </span>
                            <span className="text-sm">/ha</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Redevance mensuelle :</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold">{formatMontant(offre.contribution_mensuelle_par_ha)}F</span>
                        <span className="text-sm text-muted-foreground">/ ha / mois</span>
                      </div>
                    </div>

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
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="montant_da">Montant DA/ha (F)</Label>
                                  <Input 
                                    id="montant_da"
                                    type="number"
                                    value={editOffre.montant_da_par_ha}
                                    onChange={(e) => setEditOffre({...editOffre, montant_da_par_ha: Number(e.target.value)})}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="contribution">Redevance/ha/mois (F)</Label>
                                  <Input 
                                    id="contribution"
                                    type="number"
                                    value={editOffre.contribution_mensuelle_par_ha}
                                    onChange={(e) => setEditOffre({...editOffre, contribution_mensuelle_par_ha: Number(e.target.value)})}
                                  />
                                </div>
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
                    La réduction sera appliquée automatiquement sur le Droit d'Accès de toutes les offres.
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pourcentage">Pourcentage de réduction (%) *</Label>
                      <div className="relative">
                        <Input
                          id="pourcentage"
                          type="number"
                          value={promoFormData.pourcentage_reduction}
                          onChange={(e) => setPromoFormData({...promoFormData, pourcentage_reduction: e.target.value})}
                          min="1"
                          max="99"
                          required
                        />
                        <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Aperçu (PalmElite)</Label>
                      <div className="p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-sm text-green-700">
                          20 000F → {formatMontant(calculateReducedAmount(20000, parseInt(promoFormData.pourcentage_reduction || "0")))}F
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                <Table>
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
                </Table>
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
