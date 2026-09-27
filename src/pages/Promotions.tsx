import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, CheckCircle, XCircle, Percent, Calculator } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSafeErrorMessage } from "@/lib/safeError";
import { useOffresPrixEffectif } from "@/hooks/useOffresPrixEffectif";
import { formatF } from "@/lib/pricing";

const Promotions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any>(null);
  const { prix: prixEffectifs, isLoading: prixLoading } = useOffresPrixEffectif();

  const [formData, setFormData] = useState({
    nom: "",
    pourcentage_reduction: "30",
    date_debut: "",
    date_fin: "",
    description: "",
    applique_toutes_offres: true,
    type_promotion: "paiement_initial" as string,
    cible: "paiement_initial" as string,
    montant_fixe_reduction: "",
  });

  const { data: promotions, isLoading } = useQuery({
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

  // Offres de référence pour la simulation (par hectare)
  const { data: offresRef } = useQuery({
    queryKey: ['offres-simulation'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('offres')
        .select('code, nom, montant_depot_initial_par_ha, montant_total_par_ha')
        .eq('actif', true)
        .order('montant_total_par_ha', { ascending: true });
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const isSpecial = data.cible === "special";
      const promoData = {
        nom: data.nom,
        pourcentage_reduction: isSpecial ? 0 : parseInt(data.pourcentage_reduction || "0"),
        montant_fixe_reduction: isSpecial ? parseFloat(data.montant_fixe_reduction || "0") : null,
        date_debut: new Date(data.date_debut).toISOString(),
        date_fin: new Date(data.date_fin).toISOString(),
        description: data.description,
          active: true,
        applique_toutes_offres: data.applique_toutes_offres,
        type_promotion:
          data.cible,
        cible: data.cible,
      };

      if (editingPromo) {
        const { error } = await (supabase as any)
          .from('promotions')
          .update(promoData)
          .eq('id', editingPromo.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('promotions')
          .insert([promoData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast({ title: "Succès", description: editingPromo ? "Promotion modifiée" : "Promotion créée" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: boolean }) => {
      const { error } = await supabase.from('promotions').update({ active: newStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast({ title: "Succès", description: "Statut modifié" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast({ title: "Succès", description: "Promotion supprimée" });
    }
  });

  const resetForm = () => {
    setFormData({
      nom: "",
      pourcentage_reduction: "30",
      date_debut: "",
      date_fin: "",
      description: "",
      applique_toutes_offres: true,
      type_promotion: "paiement_initial",
      cible: "paiement_initial",
      montant_fixe_reduction: "",
    });
    setEditingPromo(null);
  };

  const handleEdit = (promo: any) => {
    setEditingPromo(promo);
    setFormData({
      nom: promo.nom,
      pourcentage_reduction: promo.pourcentage_reduction.toString(),
      date_debut: format(new Date(promo.date_debut), 'yyyy-MM-dd'),
      date_fin: format(new Date(promo.date_fin), 'yyyy-MM-dd'),
      description: promo.description || "",
      applique_toutes_offres: promo.applique_toutes_offres ?? true,
      type_promotion: promo.type_promotion || "paiement_initial",
      cible: promo.cible || (promo.type_promotion === "cout_global" ? "cout_global" : "paiement_initial"),
      montant_fixe_reduction: promo.montant_fixe_reduction?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const getStatusBadge = (active: boolean | null) => {
    return active 
      ? <Badge variant="default" className="bg-primary">ACTIF</Badge>
      : <Badge variant="secondary">INACTIF</Badge>;
  };

  const getTypeBadge = (promo: any) => {
    const cible = promo.cible || (promo.type_promotion === "cout_global" ? "cout_global" : "paiement_initial");
    if (cible === "cout_global") return <Badge className="bg-amber-500">Coût Global (CG)</Badge>;
    return cible === "paiement_initial" ? <Badge className="bg-blue-500">Paiement Initial (PI)</Badge> : <Badge className="bg-amber-500">Coût Global (CG)</Badge>;
  };

  const calculateReducedAmount = (percentage: number) => {
    const montantNormal = Number(offresRef?.[0]?.montant_depot_initial_par_ha || 0);
    return montantNormal - (montantNormal * percentage / 100);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Promotions</h1>
          <p className="text-muted-foreground">
            Réductions sur le Paiement Initial (PI) ou le Coût Global (CG) du contrat
          </p>
        </div>
          
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nouvelle Promotion</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPromo ? "Modifier la promotion" : "Créer une promotion"}</DialogTitle>
              <DialogDescription>
                Choisissez l'assiette de la promotion : Paiement Initial (PI) ou Coût Global (CG).
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom de la promotion *</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({...formData, nom: e.target.value})}
                  placeholder="Ex: Promo Lancement Phase Pilote"
                  required
                />
              </div>

              <div className="space-y-2 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <Label className="text-base font-bold">Type de promotion — sur quoi s'applique la réduction ? *</Label>
                <Select
                  value={formData.cible}
                  onValueChange={(v) => setFormData({ ...formData, cible: v, type_promotion: v })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Choisir le type de promotion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paiement_initial">Promotion sur le Paiement Initial (PI)</SelectItem>
                    <SelectItem value="cout_global">Promotion sur le Coût Global (CG)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.cible === "paiement_initial" && "La réduction s'applique uniquement sur le Paiement Initial (PI) du contrat."}
                  {formData.cible === "cout_global" && "La réduction s'applique sur le Coût Global (CG) du contrat. Le PI et les mensualités sont recalculés automatiquement."}
                  
                </p>
              </div>

              

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pourcentage">Pourcentage de réduction (%) *</Label>
                  <div className="relative">
                    <Input
                      id="pourcentage"
                      type="number"
                      value={formData.pourcentage_reduction}
                      onChange={(e) => setFormData({...formData, pourcentage_reduction: e.target.value})}
                      min="1" max="99" required
                    />
                    <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  {formData.cible === "paiement_initial" && (
                    <p className="text-xs text-muted-foreground">
                      PI réduit: {calculateReducedAmount(parseInt(formData.pourcentage_reduction || "0")).toLocaleString()} F/ha
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Référence</Label>
                  <Input value={formData.cible === "paiement_initial" ? "Paiement Initial selon l'offre" : "Coût Global du contrat"} disabled />
                  <p className="text-xs text-primary font-medium">
                    Économie: {formData.cible === "paiement_initial" 
                      ? `${formData.pourcentage_reduction}% sur le PI`
                      : `${formData.pourcentage_reduction}% sur le CG`
                    }
                  </p>
                </div>
              </div>


              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="debut">Date début *</Label>
                  <Input id="debut" type="date" value={formData.date_debut} onChange={(e) => setFormData({...formData, date_debut: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fin">Date fin *</Label>
                  <Input id="fin" type="date" value={formData.date_fin} onChange={(e) => setFormData({...formData, date_fin: e.target.value})} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} />
              </div>

              {/* Récapitulatif d'impact avant validation */}
              {parseInt(formData.pourcentage_reduction || "0") > 0 && (offresRef?.length ?? 0) > 0 && (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Calculator className="h-4 w-4" />
                    Récapitulatif d'impact (par hectare)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cible: <strong>{formData.cible === "paiement_initial" ? "Paiement Initial (PI)" : "Coût Global (CG)"}</strong> — Réduction: <strong>{formData.pourcentage_reduction}%</strong>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-2">Offre</th>
                          <th className="py-2 pr-2 text-right">Montant avant</th>
                          <th className="py-2 pr-2 text-right">Réduction</th>
                          <th className="py-2 text-right">Montant après</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offresRef!.map((o: any) => {
                          const base = formData.cible === "paiement_initial"
                            ? Number(o.montant_depot_initial_par_ha || 0)
                            : Number(o.montant_total_par_ha || 0);
                          const reduction = base * (parseInt(formData.pourcentage_reduction || "0") / 100);
                          const apres = base - reduction;
                          return (
                            <tr key={o.code} className="border-b last:border-0">
                              <td className="py-2 pr-2">{o.nom}</td>
                              <td className="py-2 pr-2 text-right font-mono">{base.toLocaleString('fr-FR')} F</td>
                              <td className="py-2 pr-2 text-right font-mono text-destructive">-{reduction.toLocaleString('fr-FR')} F</td>
                              <td className="py-2 text-right font-mono font-semibold text-primary">{apres.toLocaleString('fr-FR')} F</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    Les montants sont par hectare. Pour un client, multiplier par le nombre d'hectares de la souscription.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Prix effectifs après application automatique des promotions actives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calculator className="h-5 w-5" />Prix effectifs actuels
          </CardTitle>
          <CardDescription>
            Montants réellement appliqués aux parcours clients et au portail (par hectare), promotions actives incluses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prixLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : prixEffectifs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune offre active.</p>
          ) : (
            <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Offre</TableHead>
                    <TableHead>Promotion</TableHead>
                    <TableHead className="text-right">Prix global</TableHead>
                    <TableHead className="text-right">PI</TableHead>
                    <TableHead className="text-right">Mensualité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prixEffectifs.map((r) => (
                    <TableRow key={r.offre_id}>
                      <TableCell className="font-medium">{r.nom}</TableCell>
                      <TableCell>
                        {r.promotion_id ? (
                          <Badge variant="outline" className="max-w-[180px] truncate text-primary">
                            {r.promotion_nom} · -{r.reduction_pct}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aucune</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">
                        {r.montant_total_effectif < r.montant_total_base && (
                          <span className="mr-1 text-muted-foreground line-through">{formatF(r.montant_total_base)}</span>
                        )}
                        <span className="font-semibold text-primary">{formatF(r.montant_total_effectif)}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">
                        {r.depot_initial_effectif < r.depot_initial_base && (
                          <span className="mr-1 text-muted-foreground line-through">{formatF(r.depot_initial_base)}</span>
                        )}
                        <span className="font-semibold text-primary">{formatF(r.depot_initial_effectif)}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">
                        {r.mensualite_effective < r.mensualite_base && (
                          <span className="mr-1 text-muted-foreground line-through">{formatF(r.mensualite_base)}</span>
                        )}
                        <span className="font-semibold text-primary">{formatF(r.mensualite_effective)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des promotions</CardTitle>
          <CardDescription>Gérez les promotions sur le PI (dépôt initial) et sur le coût global.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8">Chargement...</p>
          ) : promotions && promotions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Réduction</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo: any) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-medium">{promo.nom}</TableCell>
                    <TableCell>{getTypeBadge(promo)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-primary font-bold">{promo.pourcentage_reduction}%</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(promo.date_debut), 'dd/MM/yyyy', { locale: fr })} - {format(new Date(promo.date_fin), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>{getStatusBadge(promo.active)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(promo)}><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatusMutation.mutate({ id: promo.id, newStatus: !promo.active })}>
                        {promo.active ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-primary" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm('Supprimer cette promotion ?')) deleteMutation.mutate(promo.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Aucune promotion configurée.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Promotions;
