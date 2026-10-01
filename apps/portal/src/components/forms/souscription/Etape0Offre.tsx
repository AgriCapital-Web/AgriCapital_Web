import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
    case 'palm-invest': return TrendingUp;
    case 'terra-palm': return Leaf;
    default: return Crown;
  }
};

const getCouleur = (code: string) => {
  switch (code) {
    case 'palm-elite':
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
  
  const { data: offres, isLoading } = useQuery({
    queryKey: ['offres-souscription'],
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

  // Calculer le montant total du DA basé sur l'offre et la superficie
  const montantDA = useMemo(() => {
    if (!formData.offre_id || !formData.superficie_prevue || !offres) return null;
    
    const offre = offres.find(o => o.id === formData.offre_id);
    if (!offre) return null;
    
    let tarifDA = offre.montant_da_par_ha;
    
    // Appliquer la promotion si elle existe
    if (promotionActive) {
      tarifDA = offre.montant_da_par_ha - (offre.montant_da_par_ha * promotionActive.pourcentage_reduction / 100);
    }
    
    const total = tarifDA * Number(formData.superficie_prevue);
    
    return {
      tarifUnitaire: tarifDA,
      tarifNormal: offre.montant_da_par_ha,
      total,
      superficie: Number(formData.superficie_prevue),
      promotionAppliquee: !!promotionActive,
      pourcentageReduction: promotionActive?.pourcentage_reduction || 0
    };
  }, [formData.offre_id, formData.superficie_prevue, promotionActive, offres]);

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
            Réduction de {promotionActive.pourcentage_reduction}% sur le Droit d'Accès!
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Choisissez votre Offre</CardTitle>
          <CardDescription>Sélectionnez l'offre qui correspond au profil du partenaire souscripteur</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formData.offre_id}
            onValueChange={(value) => updateFormData({ offre_id: value })}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {offres?.map((offre) => {
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
                      {offre.montant_da_par_ha === 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-green-600">GRATUIT</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold">{formatMontant(offre.montant_da_par_ha)}F</span>
                          <span className="text-xs text-muted-foreground">/ha</span>
                        </div>
                      )}
                      
                      {offre.contribution_mensuelle_par_ha > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          + {formatMontant(offre.contribution_mensuelle_par_ha)}F/mois/ha (redevance mensuelle)
                        </div>
                      ) : (
                        <div className="text-xs text-green-600 font-medium">
                          Aucune redevance mensuelle
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
        </CardContent>
      </Card>

      {/* Superficie prévue */}
      <Card>
        <CardHeader>
          <CardTitle>Superficie prévue</CardTitle>
          <CardDescription>Indiquez la superficie approximative pour calculer le montant du Droit d'Accès</CardDescription>
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

          {/* Calcul du montant */}
          {montantDA && (
            <div className="p-4 bg-primary/10 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Superficie:</span>
                <span className="font-medium">{montantDA.superficie} ha</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tarif DA{montantDA.promotionAppliquee ? ' (promo)' : ''}:</span>
                <span className="font-medium">{formatMontant(montantDA.tarifUnitaire)} F/ha</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-semibold">Montant Droit d'Accès:</span>
                <span className="text-lg font-bold text-primary">{formatMontant(montantDA.total)} F</span>
              </div>
              {montantDA.promotionAppliquee && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <Sparkles className="h-3 w-3" />
                  <span>Promotion appliquée!</span>
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
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
