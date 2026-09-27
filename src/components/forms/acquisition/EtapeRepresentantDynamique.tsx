import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";

interface Props { formData: any; updateFormData: (data: any) => void; }

export const EtapeRepresentantDynamique = ({ formData, updateFormData }: Props) => {
  const active = Boolean(formData.has_representant);
  const file = (field: string, label: string) => (
    <FileUploadVisual
      label={label}
      field={field}
      accept="image/*"
      required
      currentFile={formData[field + "_file"] || null}
      currentPreview={formData[field + "_preview"] || ""}
      onFileChange={(f, value, preview) => updateFormData({ [field + "_file"]: value, [field + "_preview"]: preview })}
    />
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Cotitulaire ou mandataire</CardTitle><CardDescription>Cette personne n’est renseignée que si le Client la désigne.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Checkbox id="has_representant" checked={active} onCheckedChange={(v) => updateFormData({has_representant:Boolean(v), has_cotitulaire:Boolean(v)})} />
            <Label htmlFor="has_representant">Ajouter un cotitulaire ou un mandataire</Label>
          </div>
        </CardContent>
      </Card>

      {active && <Card>
        <CardHeader><CardTitle>Identité du représentant</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Qualité *</Label><Select value={formData.representant_type || "cotitulaire"} onValueChange={(v) => updateFormData({representant_type:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cotitulaire">Cotitulaire</SelectItem><SelectItem value="mandataire">Mandataire</SelectItem></SelectContent></Select></div>
            <div><Label>Lien avec le Client</Label><Input value={formData.representant_lien || ""} onChange={(e) => updateFormData({representant_lien:e.target.value})} placeholder="Conjoint(e), enfant, parent..." /></div>
            <div><Label>Civilité</Label><Select value={formData.representant_civilite || ""} onValueChange={(v) => updateFormData({representant_civilite:v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="M">M.</SelectItem><SelectItem value="Mme">Mme</SelectItem><SelectItem value="Mlle">Mlle</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Nom *</Label><Input value={formData.representant_nom || ""} onChange={(e) => updateFormData({representant_nom:e.target.value})} /></div>
            <div><Label>Prénoms *</Label><Input value={formData.representant_prenoms || ""} onChange={(e) => updateFormData({representant_prenoms:e.target.value})} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Date de naissance</Label><Input type="date" value={formData.representant_date_naissance || ""} onChange={(e) => updateFormData({representant_date_naissance:e.target.value})} /></div>
            <div><Label>Lieu de naissance</Label><Input value={formData.representant_lieu_naissance || ""} onChange={(e) => updateFormData({representant_lieu_naissance:e.target.value})} /></div>
            <div><Label>Nationalité</Label><Input value={formData.representant_nationalite || ""} onChange={(e) => updateFormData({representant_nationalite:e.target.value})} /></div>
          </div>
        </CardContent>
      </Card>}

      {active && <Card>
        <CardHeader><CardTitle>Pièce d’identité et photo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Type de pièce *</Label><Select value={formData.representant_type_piece || ""} onValueChange={(v) => updateFormData({representant_type_piece:v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="cni">CNI</SelectItem><SelectItem value="passeport">Passeport</SelectItem><SelectItem value="cni_cedeao">CNI CEDEAO</SelectItem><SelectItem value="permis">Permis</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></div>
            <div><Label>Numéro de pièce *</Label><Input value={formData.representant_numero_piece || ""} onChange={(e) => updateFormData({representant_numero_piece:e.target.value})} /></div>
            <div><Label>Date de délivrance</Label><Input type="date" value={formData.representant_date_delivrance || ""} onChange={(e) => updateFormData({representant_date_delivrance:e.target.value})} /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">{file("representant_piece_recto","Pièce d’identité — recto *")}{file("representant_piece_verso","Pièce d’identité — verso *")}</div>
          {file("representant_photo_profil","Photo du cotitulaire / mandataire *")}
        </CardContent>
      </Card>}

      {active && <Card>
        <CardHeader><CardTitle>Coordonnées du représentant</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Téléphone</Label><Input value={formData.representant_telephone || ""} onChange={(e) => updateFormData({representant_telephone:e.target.value})} /></div>
            <div><Label>WhatsApp</Label><Input value={formData.representant_whatsapp || ""} onChange={(e) => updateFormData({representant_whatsapp:e.target.value})} /></div>
          </div>
          <div><Label>Adresse</Label><Input value={formData.representant_adresse || ""} onChange={(e) => updateFormData({representant_adresse:e.target.value})} /></div>
        </CardContent>
      </Card>}
    </div>
  );
};
