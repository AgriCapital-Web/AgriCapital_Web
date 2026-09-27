import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Crown, TrendingUp, Leaf, Check, Sparkles, Loader2 } from "lucide-react";
import { usePromotionActive } from "@/hooks/usePromotionActive";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Offre = Tables<'offres'>;

interface Etape0Props {
  formData: any;
  updateFormData: (data: any) => void;
}

const getIcone = (code: string) => {
  switch (code) {
    case 'palm-elite': return Crown;
    case 'palm-invest-plus': return Crown;
    case 'palm-invest': return TrendingUp;
    case 'terra-palm-plus': return Crown;
    case 'terra-palm': return Leaf;
    default: return Crown;
  }
};

const getCouleur = (code: string) => {
  switch (code) {
    case 'palm-elite':
    case 'palm-invest-plus':
    case 'terra-palm-plus':
      return { text: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    case 'palm-invest':
      return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
    case 'terra-palm':
      return { text: 'text-emerald-700', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    default:
      return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
  }
};

export const Etape0Offre = ({ formData, updateFormData }: Etape0Props) => {
  const { data: promotionActive } = usePromotionActive();
  
  // Les offres sont pilotées par leur configuration métier. Aucun montant n'est saisi manuellement ici.
  
  const { data: offres, isLoading } = useQuery({
    queryKey: ['offres-acquisition'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offres')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true });
      
      if (error) throw error;
      return data as Offre[];
    }
  });

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR').format(montant);
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

  // Calculer PI + total contrat avec application de la promo selon cible
  const calculs = useMemo(() => {
    if (!formData.offre_id || !formData.superficie_prevue || !offres) return null;
    
    const offre = offres.find(o => o.id === formData.offre_id);
    if (!offre) return null;

    const ha = Number(formData.superficie_prevue);
    const o = offre as any;
    const tranches = Array.isArray(o.tranches_paiement) ? o.tranches_paiement : [];
    const piUnitaire = Number(o.montant_pi_par_ha ?? o.montant_pi_par_ha ?? 0);

    // PalmTerroir : le total est toujours recalculé depuis la formule sélectionnée
    // (PI + somme des mensualités de la formule × nombre de mois).
    const isPalmTerroir = String(o.code || '').startsWith('palm-terroir');
    const isCashEligible = ['palm-invest','palm-invest-plus','terra-palm','terra-palm-plus'].includes(String(o.code || '').toLowerCase());
    const modePaiement = isCashEligible && formData.mode_paiement === 'comptant' ? 'comptant' : 'echeancier';
    const mensualitesFormule = tranches.filter((t: any) =>
      Number(t.mensualite_par_ha) > 0 && t.type !== 'paiement_initial'
    );
    const totalMensualitesParHa = mensualitesFormule.reduce(
      (sum: number, t: any) => sum + Number(t.mensualite_par_ha) * Number(t.mois || 0),
      0,
    );
    const cashUnitaire = Number(o.montant_cash_par_ha ?? 0);
    const totalUnitaire = modePaiement === 'comptant' && isCashEligible && cashUnitaire > 0
      ? cashUnitaire
      : isPalmTerroir
        ? piUnitaire + totalMensualitesParHa
        : Number(o.montant_total_par_ha ?? 0);

    let piUnitaireFinal = modePaiement === 'comptant' ? totalUnitaire : piUnitaire;
    let totalFinal = totalUnitaire * ha;
    let promoCible: string | null = null;
    let promoReduction = 0;

    if (promotionActive) {
      promoCible = (promotionActive as any).cible ?? 'paiement_initial';
      promoReduction = promotionActive.pourcentage_reduction;
      if (promoCible === 'paiement_initial') {
        piUnitaireFinal = piUnitaire - (piUnitaire * promoReduction / 100);
      } else if (promoCible === 'cout_global') {
        totalFinal = totalFinal - (totalFinal * promoReduction / 100);
      }
    }

    const totalPI = piUnitaireFinal * ha;

    return {
      ha,
      piUnitaire,
      piUnitaireFinal,
      totalPI,
      totalUnitaire,
      totalFinal,
      totalNormal: totalUnitaire * ha,
      cashUnitaire,
      modePaiement,
      tranches,
      duree: modePaiement === 'comptant' ? 1 : (o.duree_paiement_mois ?? 0),
      promoCible,
      promoReduction,
      promotionAppliquee: !!promotionActive,
    };
  }, [formData.offre_id, formData.superficie_prevue, formData.mode_paiement, promotionActive, offres]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Promotion active */}
      {promotionActive && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
            <Sparkles className="h-5 w-5" />
            <span>🎉 Promotion en cours: {promotionActive.nom}</span>
          </div>
          <p className="text-sm text-amber-600">
             {`-${promotionActive.pourcentage_reduction}% sur ${(promotionActive as any).cible === 'cout_global' ? 'le coût global' : 'le Paiement Initial'}`}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Choisissez votre Offre</CardTitle>
          <CardDescription>Sélectionnez l'offre qui correspond au profil du client</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formData.offre_id}
            onValueChange={(value) => {
              const selected = offres?.find((o: any) => o.id === value);
              updateFormData({
                offre_id: value,
                offre_code: selected?.code || "",
                offre: selected,
                type_client: selected?.type_offre === "sans_terre" ? "sans_terre" : "avec_terre",
                mode_paiement: ["palm-invest","palm-invest-plus","terra-palm","terra-palm-plus"].includes(String(selected?.code || "").toLowerCase()) ? (formData.mode_paiement || "echeancier") : "echeancier",
                ...(selected?.type_offre === "sans_terre" ? {} : { parcelle_id: null }),
              });
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {offres?.map((offre: any) => {
              const IconComponent = getIcone(offre.code);
              const couleurs = getCouleur(offre.code);
              const isSelected = formData.offre_id === offre.id;
              const avantagesList = parseAvantages(offre.avantages);
              
              return (
                <div key={offre.id}>
                  <RadioGroupItem
                    value={offre.id}
                    id={offre.id}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={offre.id}
                    className={`flex flex-col h-full p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? `${couleurs.border} ${couleurs.bg} ring-2 ring-offset-2 ring-primary` 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-full ${couleurs.bg}`}>
                        <IconComponent className={`h-6 w-6 ${couleurs.text}`} />
                      </div>
                      <div>
                        <h3 className={`font-bold ${couleurs.text}`}>{offre.nom}</h3>
                        <p className="text-xs text-muted-foreground">{offre.description}</p>
                      </div>
                    </div>
                    
                    <div className="mt-auto space-y-2">
                      {offre.montant_total_par_ha === 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-green-600">GRATUIT</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold">{formatMontant(offre.montant_total_par_ha)}F</span>
                             <span className="text-xs text-muted-foreground">/ha · {offre.duree_paiement_mois} mois</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            PI: {formatMontant(offre.montant_pi_par_ha)}F/ha {["palm-invest","palm-invest-plus","terra-palm","terra-palm-plus"].includes(String(offre.code || "").toLowerCase()) ? `· Comptant: ${formatMontant(offre.montant_cash_par_ha)}F/ha` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {offre.gestion_type === 'deleguee' ? 'Gestion déléguée · 70% revenus' : 'Gestion propre · 100% revenus'}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {isSelected && (
                      <div className="mt-3 flex items-center gap-1 text-primary text-sm font-medium">
                        <Check className="h-4 w-4" /> Sélectionné
                      </div>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {(() => {
            const selected = offres?.find((o: any) => o.id === formData.offre_id);
            const code = String(selected?.code || "").toLowerCase();
            const cashEligible = ["palm-invest","palm-invest-plus","terra-palm","terra-palm-plus"].includes(code);
            if (!selected || !cashEligible || Number(selected.montant_cash_par_ha || 0) <= 0) return null;
            return (
              <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
                <div className="text-sm font-semibold">Mode de paiement</div>
                <p className="text-xs text-muted-foreground mt-1">Le client choisit entre l’échéancier de l’offre et le paiement comptant.</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button type="button" variant={formData.mode_paiement !== "comptant" ? "default" : "outline"} onClick={() => updateFormData({ mode_paiement: "echeancier" })}>
                    Échéancier — {selected.duree_paiement_mois} mois
                  </Button>
                  <Button type="button" variant={formData.mode_paiement === "comptant" ? "default" : "outline"} onClick={() => updateFormData({ mode_paiement: "comptant" })}>
                    Comptant — {formatMontant(Number(selected.montant_cash_par_ha))} F/ha
                  </Button>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Superficie prévue */}
      <Card>
        <CardHeader>
          <CardTitle>Superficie prévue</CardTitle>
          <CardDescription>Indiquez la superficie pour calculer automatiquement le PI, les mensualités et le coût total selon la formule sélectionnée</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="superficie_prevue">Superficie (hectares) *</Label>
            <Input
              id="superficie_prevue"
              type="number"
              step="0.5"
              min="1"
              max="100"
              value={formData.superficie_prevue || ""}
              onChange={(e) => updateFormData({ superficie_prevue: e.target.value })}
              placeholder="Ex: 5"
              required
            />
          </div>

          {/* Récap calculé */}
          {calculs && (
            <div className="p-4 bg-primary/10 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span>Superficie:</span>
                <span className="font-medium">{calculs.ha} ha</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Paiement Initial{calculs.promoCible === 'paiement_initial' ? ' (promo)' : ''}:</span>
                <span className="font-bold text-primary">{formatMontant(calculs.totalPI)} F</span>
              </div>
              {calculs.modePaiement !== "comptant" && calculs.tranches.length > 0 && (
                <div className="border-t pt-2 space-y-1 text-sm">
                   <div className="font-medium mb-1">Échéancier de paiement :</div>
                  {calculs.tranches.filter((t:any) => Number(t.mensualite_par_ha) > 0).map((t: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>An {t.annee} — {t.mois} mois</span>
                      <span>{formatMontant(Number(t.mensualite_par_ha) * calculs.ha)} F/mois</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t pt-2 flex justify-between">
                 <span className="font-semibold">Total contrat ({calculs.modePaiement === "comptant" ? "comptant" : `${calculs.duree} mois`}){calculs.promoCible === 'cout_global' ? ' (promo)' : ''}:</span>
                <span className="text-lg font-bold text-primary">{formatMontant(calculs.totalFinal)} F</span>
              </div>
              {calculs.promotionAppliquee && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <Sparkles className="h-3 w-3" />
                  <span>Promo -{calculs.promoReduction}% appliquée sur {calculs.promoCible === 'cout_global' ? 'le total' : 'le PI'}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Résumé de l'offre sélectionnée */}
      {formData.offre_id && offres && (
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif de l'Offre</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const offre = offres.find(o => o.id === formData.offre_id);
              if (!offre) return null;
              const avantagesList = parseAvantages(offre.avantages);
              
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Offre:</span>
                      <p className="font-medium">{offre.nom}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <p className="font-medium">{offre.description}</p>
                    </div>
                  </div>
                  
                  {avantagesList.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">Avantages inclus:</h4>
                      <ul className="space-y-1">
                        {avantagesList.map((avantage: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{avantage}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
