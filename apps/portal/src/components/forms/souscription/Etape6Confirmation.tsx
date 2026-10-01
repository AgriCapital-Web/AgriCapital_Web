import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface Etape6Props {
  formData: any;
  updateFormData: (data: any) => void;
}

export const Etape6Confirmation = ({ formData, updateFormData }: Etape6Props) => {
  const acceptations = [
    { id: 'contrat_lu', label: "J'ai lu le contrat (20 articles)" },
    { id: 'documents_authentiques', label: 'Tous les documents fournis sont authentiques' },
    { id: 'accept_redevance', label: "J'accepte les conditions de redevance (20%)" },
    { id: 'accept_exclusivite', label: "J'accepte l'exclusivité commerciale" },
    { id: 'accept_hypothecation', label: 'Je comprends l\'hypothécation de 10 ans' },
    { id: 'autorisation_donnees', label: 'J\'autorise l\'utilisation de mes données personnelles' },
    { id: 'autorisation_photos', label: 'J\'autorise l\'utilisation des photos de ma parcelle' },
  ];

  const allAccepted = acceptations.every(acc => formData[acc.id]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Résumé de la souscription</CardTitle>
          <CardDescription>Vérifiez toutes les informations avant de soumettre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Souscripteur</h4>
              <p className="text-sm">
                {formData.nom_famille} {formData.prenoms}
              </p>
              <p className="text-xs text-muted-foreground">{formData.telephone}</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Co-titulaire</h4>
              <p className="text-sm">
                {formData.cotit_nom_famille} {formData.cotit_prenoms}
              </p>
              <p className="text-xs text-muted-foreground">
                Relation: {formData.cotit_relation}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Parcelle</h4>
              <p className="text-sm">
                {formData.superficie_ha} hectares
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round(formData.superficie_ha * 143)} plants • {formData.village}, {formData.departement}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Enquête</h4>
              <p className="text-sm">
                Chef: {formData.chef_nom} {formData.chef_prenoms}
              </p>
              <p className="text-xs text-muted-foreground">
                2 témoins + Attestation absence litiges
              </p>
            </div>
          </div>

          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Documents fournis</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Contrat signé</Badge>
              <Badge variant="outline">Document foncier</Badge>
              <Badge variant="outline">Photos parcelle (3)</Badge>
              <Badge variant="outline">Photos identité (multiples)</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acceptation des conditions</CardTitle>
          <CardDescription>Toutes les cases doivent être cochées pour continuer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {acceptations.map((acc) => (
            <div key={acc.id} className="flex items-start space-x-2">
              <Checkbox
                id={acc.id}
                checked={formData[acc.id]}
                onCheckedChange={(checked) => updateFormData({ [acc.id]: checked })}
              />
              <Label htmlFor={acc.id} className="text-sm font-normal leading-tight">
                {acc.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {!allAccepted && (
        <Card className="border-orange-500">
          <CardContent className="pt-6">
            <p className="text-sm text-orange-600">
              ⚠️ Veuillez cocher toutes les cases pour pouvoir soumettre le dossier.
            </p>
          </CardContent>
        </Card>
      )}

      {allAccepted && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">✅ Prêt à soumettre</h4>
              <p className="text-sm">
                Une fois soumis, le dossier sera envoyé au Service Client pour examen.
              </p>
              <p className="text-xs text-muted-foreground">
                Vous recevrez un numéro de référence et une notification par SMS.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
