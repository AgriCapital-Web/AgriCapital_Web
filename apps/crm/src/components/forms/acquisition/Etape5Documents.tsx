import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import MediaUploadVisual from "@/components/ui/media-upload-visual";

interface Etape5Props {
  formData: any;
  updateFormData: (data: any) => void;
}

export const ANNEXES_ACQUISITION = [
  { field: "annexe1_plan_bloc", label: "Annexe 1 — Plan du bloc ou de la zone de plantation", condition: () => true },
  { field: "annexe2_plan_individuel", label: "Annexe 2 — Fiche d’identification et plan individuel (polygonal GPS)", condition: () => true },
  { field: "annexe3_acte_remise", label: "Annexe 3 — Acte de Remise de Plantation", condition: () => true },
  { field: "annexe4_avenant_plus", label: "Annexe 4 — Avenant Formules +", condition: (data: any) => Boolean(data.formule_deleguee) },
  { field: "annexe5_procuration", label: "Annexe 5 — Procuration du cotitulaire ou mandataire", condition: (data: any) => Boolean(data.has_cotitulaire) },
  { field: "annexe6_securisation", label: "Annexe 6 — Document complémentaire de sécurisation", condition: () => true },
];

export const Etape5Documents = ({ formData, updateFormData }: Etape5Props) => {
  const handleFileChange = (field: string, file: File | null, preview: string) => {
    updateFormData({
      [`${field}_file`]: file,
      [`${field}_preview`]: preview,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contrat client</CardTitle>
          <CardDescription>Contrat signé (AGC-SUB-YYYY-SPxxx-NNNN) + date de signature</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <FileUploadVisual
              label="Contrat client (Signé) *"
              field="contrat"
              accept=".pdf,image/*"
              required
              currentFile={formData.contrat_file || null}
              currentPreview={formData.contrat_preview || ""}
              onFileChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Formats acceptés: PDF, JPEG, PNG. Max 10MB.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_signature">Date de signature du contrat *</Label>
            <Input
              id="date_signature"
              type="date"
              value={formData.date_signature_contrat}
              onChange={(e) => updateFormData({ date_signature_contrat: e.target.value })}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annexes du contrat V1</CardTitle>
          <CardDescription>
            Indiquez pour chaque annexe si elle est jointe maintenant ou sera fournie plus tard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ANNEXES_ACQUISITION.filter((a) => a.condition(formData)).map((a) => (
            <div key={a.field} className="space-y-3 rounded-md border p-3">
              <Label>{a.label}</Label>
              <RadioGroup
                value={formData[`${a.field}_status`] || "plus_tard"}
                onValueChange={(status) => updateFormData({ [`${a.field}_status`]: status })}
                className="flex gap-5"
              >
                <div className="flex items-center gap-2"><RadioGroupItem value="joint" id={`${a.field}-joint`} /><Label htmlFor={`${a.field}-joint`}>Joint</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="plus_tard" id={`${a.field}-later`} /><Label htmlFor={`${a.field}-later`}>À fournir plus tard</Label></div>
              </RadioGroup>
              {(formData[`${a.field}_status`] || "plus_tard") === "joint" && <FileUploadVisual
                label="Fichier *"
                field={a.field}
                accept=".pdf,image/*"
                required
                currentFile={formData[`${a.field}_file`] || null}
                currentPreview={formData[`${a.field}_preview`] || ""}
                onFileChange={handleFileChange}
              />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents complémentaires (optionnel)</CardTitle>
          <CardDescription>Autres documents (PV de délimitation, photos, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="docs_complementaires">Autres documents</Label>
<MediaUploadVisual label="Autres documents" files={formData.docs_complementaires_files||[]} onChange={files=>updateFormData({docs_complementaires_files:files})} accept=".pdf,image/jpeg,image/png"/>
            <p className="text-xs text-muted-foreground">
              Maximum 5 fichiers. Formats: PDF, JPEG, PNG.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
