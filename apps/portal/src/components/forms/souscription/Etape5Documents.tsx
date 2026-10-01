import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";

interface Etape5Props {
  formData: any;
  updateFormData: (data: any) => void;
}

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
          <CardTitle>Contrat de souscription</CardTitle>
          <CardDescription>Document signé par les deux parties</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <FileUploadVisual
              label="Contrat de Souscription (Signé) *"
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
          <CardTitle>Document foncier</CardTitle>
          <CardDescription>Justificatif de propriété ou d'exploitation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type_doc_foncier">Type de document foncier *</Label>
            <Select
              value={formData.type_document_foncier}
              onValueChange={(value) => updateFormData({ type_document_foncier: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="certificat_foncier">Certificat foncier</SelectItem>
                <SelectItem value="titre_foncier">Titre foncier</SelectItem>
                <SelectItem value="contrat_metayage">Contrat métayage</SelectItem>
                <SelectItem value="autorisation">Autorisation d'exploiter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_doc_foncier">Numéro du document *</Label>
              <Input
                id="numero_doc_foncier"
                value={formData.numero_document_foncier}
                onChange={(e) => updateFormData({ numero_document_foncier: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_delivrance_foncier">Date de délivrance *</Label>
              <Input
                id="date_delivrance_foncier"
                type="date"
                value={formData.date_delivrance_foncier}
                onChange={(e) => updateFormData({ date_delivrance_foncier: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proprietaire_legal">Propriétaire légal (si différent du souscripteur)</Label>
            <Input
              id="proprietaire_legal"
              value={formData.proprietaire_legal}
              onChange={(e) => updateFormData({ proprietaire_legal: e.target.value })}
              placeholder="Laisser vide si le souscripteur est le propriétaire"
            />
          </div>

          <div className="space-y-2">
            <FileUploadVisual
              label="Fichier du document foncier *"
              field="document_foncier"
              accept=".pdf,image/*"
              required
              currentFile={formData.document_foncier_file || null}
              currentPreview={formData.document_foncier_preview || ""}
              onFileChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Formats acceptés: PDF, JPEG, PNG. Max 10MB.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents complémentaires (optionnel)</CardTitle>
          <CardDescription>Autres documents pertinents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="docs_complementaires">Autres documents</Label>
            <Input
              id="docs_complementaires"
              type="file"
              multiple
              accept=".pdf,image/jpeg,image/png"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) updateFormData({ docs_complementaires_files: files });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Maximum 5 fichiers. Formats: PDF, JPEG, PNG.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
