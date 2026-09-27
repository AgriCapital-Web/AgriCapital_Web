import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Leaf, TrendingUp, Sprout, Loader2 } from "lucide-react";
import { usePromotionActive } from "@/hooks/usePromotionActive";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Offre = Tables<"offres"> & {
  famille_offre?: string | null;
  formule_code?: string | null;
  formule_nom?: string | null;
  necessite_foncier_client?: boolean;
  necessite_cotitulaire?: boolean;
  contrat_acquisition_requis?: boolean;
  contrat_accompagnement_requis?: boolean;
  parcours_code?: string | null;
};

interface Props { formData: any; updateFormData: (data: any) => void; }

const FAMILLES = [
  { code: "PALMINVEST", nom: "PalmInvest", description: "Vous n'avez pas de terre : AgriCapital sécurise le foncier et crée votre plantation.", icon: TrendingUp },
  { code: "TERRAPALM", nom: "TerraPalm", description: "Vous avez votre terre : nous la transformons en plantation productive.", icon: Leaf },
  { code: "PALMTERROIR", nom: "PalmTerroir", description: "Vous disposez d'une parcelle et développez progressivement votre plantation.", icon: Sprout },
];

const formatFCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const parseAvantages = (value: any): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return [value]; }
  }
  return [];
};

export const Etape0Offre = ({ formData, updateFormData }: Props) => {
  const { data: promotionActive } = usePromotionActive();
  const { data: offres, isLoading } = useQuery({
    queryKey: ["offres-souscription-officielles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("offres").select("*")
        .eq("actif", true)
        .in("code", ["palm-invest","palm-invest-plus","terra-palm","terra-palm-plus","palm-terroir-essentielle","palm-terroir-flexible"])
        .order("ordre", { ascending: true });
      if (error) throw error;
      return (data || []) as Offre[];
    },
  });

  const famille = formData.famille_offre || "";
  const formules = useMemo(() => (offres || []).filter((o) => o.famille_offre === famille), [offres, famille]);
  const selected = (offres || []).find((o) => o.id === formData.offre_id);

  const selectFamille = (code: string) => {
    const first = (offres || []).find((o) => o.famille_offre === code);
    updateFormData({
      famille_offre: code,
      offre_id: null,
      formule_code: null,
      formule_nom: null,
      type_souscripteur: code === "PALMINVEST" ? "sans_terre" : "avec_terre",
      type_souscripteur_foncier: code === "PALMINVEST" ? "EXT" : "OWN",
      convention_id: null,
      lot_id: null,
      parcelle_id: null,
      ...(first ? {
        contrat_acquisition_requis: first.contrat_acquisition_requis !== false,
        contrat_accompagnement_requis: first.contrat_accompagnement_requis !== false,
        necessite_cotitulaire: first.necessite_cotitulaire !== false,
      } : {}),
    });
  };

  const selectFormule = (id: string) => {
    const o = (offres || []).find((x) => x.id === id);
    if (!o) return;
    updateFormData({
      offre_id: o.id,
      formule_code: o.formule_code,
      formule_nom: o.formule_nom || o.nom,
      famille_offre: o.famille_offre,
      type_souscripteur: o.type_offre === "sans_terre" ? "sans_terre" : "avec_terre",
      type_souscripteur_foncier: o.necessite_foncier_client ? "OWN" : "EXT",
      contrat_acquisition_requis: o.contrat_acquisition_requis !== false,
      contrat_accompagnement_requis: o.contrat_accompagnement_requis !== false,
      necessite_cotitulaire: o.necessite_cotitulaire !== false,
    });
  };

  const calculations = useMemo(() => {
    if (!selected || !formData.superficie_prevue) return null;
    const ha = Number(formData.superficie_prevue);
    const pi = Number(selected.montant_depot_initial_par_ha || selected.montant_da_par_ha || 0);
    const total = Number(selected.montant_total_par_ha || 0) * ha;
    const promoCible = promotionActive?.cible || null;
    const pct = Number(promotionActive?.pourcentage_reduction || 0);
    const piFinal = promoCible === "paiement_initial" ? pi * (1 - pct / 100) : pi;
    const totalFinal = promoCible === "cout_global" ? total * (1 - pct / 100) : total;
    return { ha, pi, total, piFinal: piFinal * ha, totalFinal, tranches: Array.isArray(selected.tranches_paiement) ? selected.tranches_paiement : [] };
  }, [selected, formData.superficie_prevue, promotionActive]);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Étape 1 — Choisissez l'offre</CardTitle>
          <CardDescription>Le choix de l'offre détermine automatiquement le parcours, le foncier, les contrats et les informations demandées.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={famille} onValueChange={selectFamille} className="grid gap-4 md:grid-cols-3">
            {FAMILLES.map((f) => {
              const Icon = f.icon;
              const active = famille === f.code;
              return (
                <div key={f.code}>
                  <RadioGroupItem value={f.code} id={`famille-${f.code}`} className="peer sr-only" />
                  <Label htmlFor={`famille-${f.code}`} className={`block h-full cursor-pointer rounded-xl border-2 p-5 transition ${active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/50"}`}>
                    <div className="mb-3 flex items-center gap-3"><Icon className="h-7 w-7 text-primary" /><span className="text-lg font-bold">{f.nom}</span></div>
                    <p className="text-sm text-muted-foreground">{f.description}</p>
                    <Badge className="mt-4" variant={active ? "default" : "outline"}>{active ? "Offre sélectionnée" : "Sélectionner"}</Badge>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {famille && (
        <Card>
          <CardHeader>
            <CardTitle>Choisissez la formule</CardTitle>
            <CardDescription>La formule définit la gestion de la plantation et les conditions financières.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={formData.offre_id || ""} onValueChange={selectFormule} className="grid gap-4 md:grid-cols-2">
              {formules.map((o: any) => {
                const active = formData.offre_id === o.id;
                return (
                  <div key={o.id}>
                    <RadioGroupItem value={o.id} id={`formule-${o.id}`} className="peer sr-only" />
                    <Label htmlFor={`formule-${o.id}`} className={`block h-full cursor-pointer rounded-xl border-2 p-4 ${active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/50"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-bold">{o.formule_nom || o.nom}</p><p className="text-sm text-muted-foreground">{o.description}</p></div>
                        {active && <Check className="h-5 w-5 shrink-0 text-primary" />}
                      </div>
                      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                        <div><span className="text-muted-foreground">Paiement initial / ha</span><p className="font-bold">{formatFCFA(Number(o.montant_depot_initial_par_ha || 0))} F</p></div>
                        <div><span className="text-muted-foreground">Total / ha</span><p className="font-bold text-primary">{formatFCFA(Number(o.montant_total_par_ha || 0))} F</p></div>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Superficie prévue</CardTitle>
          <CardDescription>La superficie sert à calculer automatiquement le Paiement initial et le montant contractuel.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="superficie_prevue">Superficie (hectares) *</Label>
            <Input id="superficie_prevue" type="number" step="0.1" min="0.1" max="1000" value={formData.superficie_prevue || ""} onChange={(e) => updateFormData({ superficie_prevue: e.target.value })} />
          </div>
          {calculations && (
            <div className="mt-5 rounded-xl bg-primary/10 p-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>Paiement initial : <strong>{formatFCFA(calculations.piFinal)} F</strong></p>
                <p>Total contractuel : <strong>{formatFCFA(calculations.totalFinal)} F</strong></p>
              </div>
              <div className="mt-3 border-t pt-3">
                <p className="mb-2 font-semibold">Échéancier</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {calculations.tranches.map((t: any, i: number) => (
                    <div key={i} className="rounded-md border bg-background p-2 text-xs">
                      <span className="font-medium">{t.libelle || "Échéance"}</span>
                      <span className="ml-2 text-muted-foreground">{t.mois} mois</span>
                      {t.mensualite_par_ha && <span className="ml-2">{formatFCFA(Number(t.mensualite_par_ha) * calculations.ha)} F/mois</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
