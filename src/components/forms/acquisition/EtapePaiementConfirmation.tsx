import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { calculPrixEffectif } from "@/lib/pricing";
import { usePromotionActive } from "@/hooks/usePromotionActive";

interface Props { formData: any; updateFormData: (data: any) => void; }

export const EtapePaiementConfirmation = ({ formData, updateFormData }: Props) => {
  const offre = formData.offre || {};
  const ha = Number(formData.superficie_prevue || 0);
  const { data: promotionActive } = usePromotionActive(formData.offre_id);
  const prix = calculPrixEffectif(offre, promotionActive ? [promotionActive as any] : [], { modePaiement: formData.mode_paiement === "comptant" ? "comptant" : "echeancier" });
  const pi = Number(prix.depot_initial_effectif || 0) * ha;
  const total = Number(prix.montant_total_effectif || prix.montant_total_base || 0) * ha;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Récapitulatif du Client</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div><p className="text-xs text-muted-foreground">Client</p><p className="font-medium">{formData.nom_famille} {formData.prenoms}</p></div>
          <div><p className="text-xs text-muted-foreground">Offre</p><p className="font-medium">{offre.nom || formData.offre_code}</p></div>
          <div><p className="text-xs text-muted-foreground">Superficie</p><p className="font-medium">{ha} ha</p></div>
          <div><p className="text-xs text-muted-foreground">Parcours</p><Badge variant="outline">{formData.offre_code}</Badge></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conditions financières</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between"><span>Paiement initial</span><strong>{pi.toLocaleString("fr-FR")} F CFA</strong></div>
          <div className="flex justify-between"><span>Total selon l’offre</span><strong>{total.toLocaleString("fr-FR")} F CFA</strong></div>
          <div className="text-sm text-muted-foreground">Les montants sont recalculés depuis l’offre, la superficie et la promotion applicable.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Validation du dossier</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            ["contrat_lu","Le Client a pris connaissance des documents contractuels applicables."],
            ["documents_authentiques","Les documents fournis ont été contrôlés et déclarés authentiques."],
            ["autorisation_donnees","Le Client autorise le traitement de ses données pour l’exécution du dossier."]
          ].map(([id,label]) => (
            <div className="flex items-start gap-2" key={id}>
              <Checkbox id={id} checked={Boolean(formData[id])} onCheckedChange={(v) => updateFormData({[id]:Boolean(v)})} />
              <Label htmlFor={id} className="font-normal">{label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
