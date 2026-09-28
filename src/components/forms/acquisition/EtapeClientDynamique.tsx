import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";

interface Props { formData: any; updateFormData: (data: any) => void; }

const CODES = [
  ["+225","Côte d’Ivoire"],["+33","France"],["+1","USA / Canada"],["+32","Belgique"],
  ["+41","Suisse"],["+44","Royaume-Uni"],["+221","Sénégal"],["+224","Guinée"],
  ["+226","Burkina Faso"],["+223","Mali"],["+237","Cameroun"],["+228","Togo"],["+229","Bénin"]
];

export const EtapeClientDynamique = ({ formData, updateFormData }: Props) => {
  const file = (field: string, label: string, accept = ".pdf,image/jpeg,image/png") => (
    <FileUploadVisual
      label={label}
      field={field}
      accept={accept}
      required
      currentFile={formData[field + "_file"] || null}
      currentPreview={formData[field + "_preview"] || ""}
      onFileChange={(f, value, preview) => updateFormData({ [field + "_file"]: value, [field + "_preview"]: preview })}
    />
  );

  const phone = (field: "telephone" | "whatsapp", label: string) => {
    const codeKey = field + "_indicatif";
    const localKey = field + "_local";
    const code = formData[codeKey] || "+225";
    const local = formData[localKey] || "";
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Select value={code} onValueChange={(v) => updateFormData({ [codeKey]: v, [field]: v + local })}>
            <SelectTrigger className="w-[145px]"><SelectValue /></SelectTrigger>
            <SelectContent>{CODES.map(([v,n]) => <SelectItem key={v} value={v}>{v} · {n}</SelectItem>)}</SelectContent>
          </Select>
          <Input
            type="tel"
            value={local}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "");
              updateFormData({ [localKey]: next, [field]: code + next });
            }}
            placeholder="Numéro local"
            required={field === "telephone"}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Identité du Client</CardTitle><CardDescription>Informations utilisées dans le dossier et les documents contractuels.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Civilité *</Label><Select value={formData.civilite || ""} onValueChange={(v) => updateFormData({civilite:v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="M">M.</SelectItem><SelectItem value="Mme">Mme</SelectItem><SelectItem value="Mlle">Mlle</SelectItem></SelectContent></Select></div>
            <div><Label>Nom de famille *</Label><Input value={formData.nom_famille || ""} onChange={(e) => updateFormData({nom_famille:e.target.value})} /></div>
            <div><Label>Prénoms *</Label><Input value={formData.prenoms || ""} onChange={(e) => updateFormData({prenoms:e.target.value})} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Date de naissance *</Label><Input type="date" value={formData.date_naissance || ""} onChange={(e) => updateFormData({date_naissance:e.target.value})} /></div>
            <div><Label>Lieu de naissance *</Label><Input value={formData.lieu_naissance || ""} onChange={(e) => updateFormData({lieu_naissance:e.target.value})} /></div>
            <div><Label>Nationalité *</Label><Input value={formData.nationalite || ""} onChange={(e) => updateFormData({nationalite:e.target.value})} placeholder="Ivoirienne" /></div>
          </div>
          <div><Label>Situation matrimoniale</Label><Select value={formData.statut_marital || ""} onValueChange={(v) => updateFormData({statut_marital:v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="celibataire">Célibataire</SelectItem><SelectItem value="marie">Marié(e)</SelectItem><SelectItem value="divorce">Divorcé(e)</SelectItem><SelectItem value="veuf">Veuf(ve)</SelectItem></SelectContent></Select></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pièce d’identité et photos</CardTitle><CardDescription>Les photos sont conservées dans le dossier du Client.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Type de pièce *</Label><Select value={formData.type_piece || ""} onValueChange={(v) => updateFormData({type_piece:v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="cni">CNI</SelectItem><SelectItem value="passeport">Passeport</SelectItem><SelectItem value="cni_cedeao">CNI CEDEAO</SelectItem><SelectItem value="permis">Permis</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></div>
            <div><Label>Numéro de pièce *</Label><Input value={formData.numero_piece || ""} onChange={(e) => updateFormData({numero_piece:e.target.value})} /></div>
            <div><Label>Date de délivrance</Label><Input type="date" value={formData.date_delivrance_piece || ""} onChange={(e) => updateFormData({date_delivrance_piece:e.target.value})} /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {file("photo_piece_recto","Pièce d’identité — recto *")}
            {file("photo_piece_verso","Pièce d’identité — verso *")}
          </div>
          {file("photo_profil","Photo du Client *")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Coordonnées du Client</CardTitle><CardDescription>Téléphone avec indicatif international, WhatsApp et adresse.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">{phone("telephone","Téléphone *")}{phone("whatsapp","WhatsApp")}</div>
          <div><Label>Email</Label><Input type="email" value={formData.email || ""} onChange={(e) => updateFormData({email:e.target.value})} /></div>
          <div><Label>Adresse complète *</Label><Input value={formData.domicile || ""} onChange={(e) => updateFormData({domicile:e.target.value})} placeholder="Quartier, rue, commune, ville..." /></div>
        </CardContent>
      </Card>
    </div>
  );
};
