import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props { formData: any; updateFormData: (data: any) => void; }

export const ANNEXES_SOUSCRIPTION = [
  { field: "annexe1_plan_bloc", label: "Annexe 1 — Plan du bloc ou de la zone de plantation", condition: () => true },
  { field: "annexe2_plan_individuel", label: "Annexe 2 — Fiche d’identification et plan individuel (polygonal GPS)", condition: () => true },
  { field: "annexe3_acte_remise", label: "Annexe 3 — Acte de Remise de Plantation", condition: (data: any) => data.famille_offre !== "PALMTERROIR" },
  { field: "annexe4_avenant_plus", label: "Annexe 4 — Avenant Formule +", condition: (data: any) => Boolean(data.formule_code?.endsWith("_PLUS")) },
  { field: "annexe5_procuration", label: "Annexe 5 — Procuration du cotitulaire ou mandataire", condition: (data: any) => Boolean(data.has_cotitulaire) },
  { field: "annexe6_securisation", label: "Annexe 6 — Document complémentaire de sécurisation", condition: () => true },
];

export const Etape5Documents = ({ formData, updateFormData }: Props) => {
  const handleFileChange = (field: string, file: File | null, preview: string) =>
    updateFormData({ [`${field}_file`]: file, [`${field}_preview`]: preview });

  return (
    <div className="space-y-6">
      {formData.contrat_acquisition_requis !== false && (
        <Card>
          <CardHeader>
            <CardTitle>Contrat d'acquisition client</CardTitle>
            <CardDescription>Contrat d'acquisition client signé et daté.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUploadVisual label="Contrat d'acquisition client (signé) *" field="contrat_acquisition" accept=".pdf,image/*" required currentFile={formData.contrat_acquisition_file || null} currentPreview={formData.contrat_acquisition_preview || ""} onFileChange={handleFileChange} />
            <div className="space-y-2">
              <Label htmlFor="date_signature_acquisition">Date de signature *</Label>
              <Input id="date_signature_acquisition" type="date" value={formData.date_signature_acquisition || ""} onChange={(e) => updateFormData({ date_signature_acquisition: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      )}

      {formData.contrat_accompagnement_requis !== false && (
        <Card>
          <CardHeader>
            <CardTitle>Contrat d'accompagnement agricole</CardTitle>
            <CardDescription>Contrat d'accompagnement agricole signé et daté.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUploadVisual label="Contrat d'accompagnement agricole (signé) *" field="contrat_accompagnement" accept=".pdf,image/*" required currentFile={formData.contrat_accompagnement_file || null} currentPreview={formData.contrat_accompagnement_preview || ""} onFileChange={handleFileChange} />
            <div className="space-y-2">
              <Label htmlFor="date_signature_accompagnement">Date de signature *</Label>
              <Input id="date_signature_accompagnement" type="date" value={formData.date_signature_accompagnement || ""} onChange={(e) => updateFormData({ date_signature_accompagnement: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Annexes contractuelles</CardTitle><CardDescription>Joignez maintenant les documents disponibles ou indiquez qu'ils seront fournis plus tard.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {ANNEXES_SOUSCRIPTION.filter((a) => a.condition(formData)).map((a) => (
            <div key={a.field} className="space-y-3 rounded-md border p-3">
              <Label>{a.label}</Label>
              <RadioGroup value={formData[`${a.field}_status`] || "plus_tard"} onValueChange={(status) => updateFormData({ [`${a.field}_status`]: status })} className="flex gap-5">
                <div className="flex items-center gap-2"><RadioGroupItem value="joint" id={`${a.field}-joint`} /><Label htmlFor={`${a.field}-joint`}>Joint</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="plus_tard" id={`${a.field}-later`} /><Label htmlFor={`${a.field}-later`}>À fournir plus tard</Label></div>
              </RadioGroup>
              {(formData[`${a.field}_status`] || "plus_tard") === "joint" && <FileUploadVisual label="Fichier *" field={a.field} accept=".pdf,image/*" required currentFile={formData[`${a.field}_file`] || null} currentPreview={formData[`${a.field}_preview`] || ""} onFileChange={handleFileChange} />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
