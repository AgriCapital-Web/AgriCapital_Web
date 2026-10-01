import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";

interface Etape4Props {
  formData: any;
  updateFormData: (data: any) => void;
}

export const Etape4Enquete = ({ formData, updateFormData }: Etape4Props) => {
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
          <CardTitle>Chef de village</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chef_nom">Nom de famille *</Label>
              <Input
                id="chef_nom"
                value={formData.chef_nom}
                onChange={(e) => updateFormData({ chef_nom: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chef_prenoms">Prénoms *</Label>
              <Input
                id="chef_prenoms"
                value={formData.chef_prenoms}
                onChange={(e) => updateFormData({ chef_prenoms: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chef_fonction">Fonction *</Label>
              <Select
                value={formData.chef_fonction}
                onValueChange={(value) => updateFormData({ chef_fonction: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chef village">Chef village</SelectItem>
                  <SelectItem value="Responsable quartier">Responsable quartier</SelectItem>
                  <SelectItem value="Délégué">Délégué</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chef_telephone">Téléphone *</Label>
              <Input
                id="chef_telephone"
                type="tel"
                value={formData.chef_telephone}
                onChange={(e) => updateFormData({ chef_telephone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chef_type_piece">Type de pièce *</Label>
              <Select
                value={formData.chef_type_piece}
                onValueChange={(value) => updateFormData({ chef_type_piece: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cni">CNI</SelectItem>
                  <SelectItem value="passeport">Passeport</SelectItem>
                  <SelectItem value="attestation">Attestation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chef_numero_piece">Numéro de pièce *</Label>
              <Input
                id="chef_numero_piece"
                value={formData.chef_numero_piece}
                onChange={(e) => updateFormData({ chef_numero_piece: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileUploadVisual
              label="Photo CNI *"
              field="chef_photo_cni"
              accept="image/*"
              required
              currentFile={formData.chef_photo_cni_file || null}
              currentPreview={formData.chef_photo_cni_preview || ""}
              onFileChange={handleFileChange}
            />

            <FileUploadVisual
              label="Photo profil *"
              field="chef_photo_profil"
              accept="image/*"
              required
              currentFile={formData.chef_photo_profil_file || null}
              currentPreview={formData.chef_photo_profil_preview || ""}
              onFileChange={handleFileChange}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="chef_signature"
              checked={formData.chef_signature}
              onCheckedChange={(checked) => updateFormData({ chef_signature: checked })}
            />
            <Label htmlFor="chef_signature">J'approuve cette enquête *</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Témoin 1</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temoin1_nom">Nom de famille *</Label>
              <Input
                id="temoin1_nom"
                value={formData.temoin1_nom}
                onChange={(e) => updateFormData({ temoin1_nom: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temoin1_prenoms">Prénoms *</Label>
              <Input
                id="temoin1_prenoms"
                value={formData.temoin1_prenoms}
                onChange={(e) => updateFormData({ temoin1_prenoms: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temoin1_fonction">Fonction *</Label>
              <Input
                id="temoin1_fonction"
                value={formData.temoin1_fonction}
                onChange={(e) => updateFormData({ temoin1_fonction: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temoin1_telephone">Téléphone *</Label>
              <Input
                id="temoin1_telephone"
                type="tel"
                value={formData.temoin1_telephone}
                onChange={(e) => updateFormData({ temoin1_telephone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temoin1_type_piece">Type de pièce *</Label>
              <Select
                value={formData.temoin1_type_piece}
                onValueChange={(value) => updateFormData({ temoin1_type_piece: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cni">CNI</SelectItem>
                  <SelectItem value="passeport">Passeport</SelectItem>
                  <SelectItem value="attestation">Attestation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temoin1_numero_piece">Numéro de pièce *</Label>
              <Input
                id="temoin1_numero_piece"
                value={formData.temoin1_numero_piece}
                onChange={(e) => updateFormData({ temoin1_numero_piece: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileUploadVisual
              label="Photo CNI *"
              field="temoin1_photo_cni"
              accept="image/*"
              required
              currentFile={formData.temoin1_photo_cni_file || null}
              currentPreview={formData.temoin1_photo_cni_preview || ""}
              onFileChange={handleFileChange}
            />

            <FileUploadVisual
              label="Photo profil *"
              field="temoin1_photo_profil"
              accept="image/*"
              required
              currentFile={formData.temoin1_photo_profil_file || null}
              currentPreview={formData.temoin1_photo_profil_preview || ""}
              onFileChange={handleFileChange}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="temoin1_signature"
              checked={formData.temoin1_signature}
              onCheckedChange={(checked) => updateFormData({ temoin1_signature: checked })}
            />
            <Label htmlFor="temoin1_signature">J'atteste cette enquête *</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Témoin 2</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temoin2_nom">Nom de famille *</Label>
              <Input
                id="temoin2_nom"
                value={formData.temoin2_nom}
                onChange={(e) => updateFormData({ temoin2_nom: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temoin2_prenoms">Prénoms *</Label>
              <Input
                id="temoin2_prenoms"
                value={formData.temoin2_prenoms}
                onChange={(e) => updateFormData({ temoin2_prenoms: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temoin2_fonction">Fonction *</Label>
              <Input
                id="temoin2_fonction"
                value={formData.temoin2_fonction}
                onChange={(e) => updateFormData({ temoin2_fonction: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temoin2_telephone">Téléphone *</Label>
              <Input
                id="temoin2_telephone"
                type="tel"
                value={formData.temoin2_telephone}
                onChange={(e) => updateFormData({ temoin2_telephone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temoin2_type_piece">Type de pièce *</Label>
              <Select
                value={formData.temoin2_type_piece}
                onValueChange={(value) => updateFormData({ temoin2_type_piece: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cni">CNI</SelectItem>
                  <SelectItem value="passeport">Passeport</SelectItem>
                  <SelectItem value="attestation">Attestation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temoin2_numero_piece">Numéro de pièce *</Label>
              <Input
                id="temoin2_numero_piece"
                value={formData.temoin2_numero_piece}
                onChange={(e) => updateFormData({ temoin2_numero_piece: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileUploadVisual
              label="Photo CNI *"
              field="temoin2_photo_cni"
              accept="image/*"
              required
              currentFile={formData.temoin2_photo_cni_file || null}
              currentPreview={formData.temoin2_photo_cni_preview || ""}
              onFileChange={handleFileChange}
            />

            <FileUploadVisual
              label="Photo profil *"
              field="temoin2_photo_profil"
              accept="image/*"
              required
              currentFile={formData.temoin2_photo_profil_file || null}
              currentPreview={formData.temoin2_photo_profil_preview || ""}
              onFileChange={handleFileChange}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="temoin2_signature"
              checked={formData.temoin2_signature}
              onCheckedChange={(checked) => updateFormData({ temoin2_signature: checked })}
            />
            <Label htmlFor="temoin2_signature">J'atteste cette enquête *</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attestation d'absence de litiges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="attestation_absence_litiges"
              checked={formData.attestation_absence_litiges}
              onCheckedChange={(checked) => updateFormData({ attestation_absence_litiges: checked })}
            />
            <Label htmlFor="attestation_absence_litiges" className="text-sm leading-tight">
              Je certifie que cette parcelle ne fait l'objet d'aucun litige foncier et que je suis habilité(e) à la mettre à disposition pour ce projet
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};