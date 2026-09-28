import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props { formData: any; updateFormData: (data: any) => void; }

export const EtapePaiementConfirmation = ({ formData, updateFormData }: Props) => {
  const offre = formData.offre || {};
  const ha = Number(formData.superficie_prevue || 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Récapitulatif du dossier Client</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div><p className="text-xs text-muted-foreground">Client</p><p className="font-medium">{formData.nom_famille} {formData.prenoms}</p></div>
          <div><p className="text-xs text-muted-foreground">Offre</p><p className="font-medium">{offre.nom || formData.offre_code}</p></div>
          <div><p className="text-xs text-muted-foreground">Superficie</p><p className="font-medium">{ha} ha</p></div>
          <div><p className="text-xs text-muted-foreground">Parcours</p><Badge variant="outline">{formData.offre_code}</Badge></div>
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
