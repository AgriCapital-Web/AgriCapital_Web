import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/utils/storage";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FileUploadVisual from "@/components/ui/file-upload-visual";
import { ArrowLeft, FileCheck2, LandPlot, UserRound, Sprout, Upload } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/safeError";

type UploadState = { file: File | null; preview: string };

const BeneficiaireParticulier = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [beneficiaire, setBeneficiaire] = useState({
    civilite: "M",
    nom_famille: "",
    prenoms: "",
    nom_complet: "",
    date_naissance: "",
    lieu_naissance: "",
    nationalite: "Ivoirienne",
    type_piece: "cni",
    numero_piece: "",
    date_delivrance_piece: "",
    telephone: "",
    whatsapp: "",
    email: "",
    domicile: "",
  });
  const [proprietaire, setProprietaire] = useState({
    nom: "",
    prenoms: "",
    nom_complet: "",
    telephone: "",
    whatsapp: "",
    statut_foncier: "coutumier",
    village: "Zakaria",
    region_id: "d7738144-14cf-43f6-be4d-500f21a9cee5",
    departement_id: "f6903743-4dc4-4554-8be5-c751ab2ffb28",
    sous_prefecture_id: "ffdb4050-1b54-49fb-b5ec-faf338b58b19",
  });
  const [parcelle, setParcelle] = useState({
    nom: "",
    surface_totale_ha: "2",
    village: "Zakaria",
    code_parc: "",
    region_id: "d7738144-14cf-43f6-be4d-500f21a9cee5",
    departement_id: "f6903743-4dc4-4554-8be5-c751ab2ffb28",
    sous_prefecture_id: "ffdb4050-1b54-49fb-b5ec-faf338b58b19",
  });
  const [plantation, setPlantation] = useState({
    nom: "",
    superficie_ha: "2",
    superficie_activee: "2",
    date_plantation: "",
    date_activation: "",
    statut: "en_cours",
    statut_global: "en_cours",
  });
  const [files, setFiles] = useState<Record<string, UploadState>>({
    cni_recto: { file: null, preview: "" },
    cni_verso: { file: null, preview: "" },
    photo_officielle: { file: null, preview: "" },
    acte_remise: { file: null, preview: "" },
  });
  const [remisePhotos, setRemisePhotos] = useState<File[]>([]);

  const setFile = (field: string, file: File | null, preview: string) => {
    setFiles((prev) => ({ ...prev, [field]: { file, preview } }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiaire.nom_complet.trim() || !beneficiaire.numero_piece.trim()) {
      toast({ variant: "destructive", title: "Informations manquantes", description: "Le nom complet et le numéro de pièce sont obligatoires." });
      return;
    }
    if (!proprietaire.nom_complet.trim() || !parcelle.code_parc.trim()) {
      toast({ variant: "destructive", title: "Rattachement incomplet", description: "Le propriétaire foncier et la référence de parcelle sont obligatoires." });
      return;
    }

    setLoading(true);
    try {
      const docs = [
        { document_type: "cni_recto", libelle: "CNI — recto", categorie: "beneficiaire" },
        { document_type: "cni_verso", libelle: "CNI — verso", categorie: "beneficiaire" },
        { document_type: "photo_officielle", libelle: "Photo officielle du bénéficiaire", categorie: "beneficiaire" },
        { document_type: "acte_remise", libelle: "Acte de remise d’actif agricole", categorie: "acte" },
      ];

      const { data, error } = await (supabase as any).rpc("register_beneficiaire_particulier", {
        p_beneficiaire: beneficiaire,
        p_proprietaire: proprietaire,
        p_parcelle: parcelle,
        p_plantation: plantation,
        p_documents: docs,
      });
      if (error) throw error;

      const ids = data as {
        client_id: string;
        proprietaire_id: string;
        parcelle_id: string;
        plantation_id: string;
      };

      for (const doc of docs) {
        const selected = files[doc.document_type]?.file;
        if (!selected) continue;
        const bucket = doc.document_type.startsWith("cni_") ? "pieces-identite" : doc.document_type === "photo_officielle" ? "photos-profils" : "documents";
        const uploaded = await uploadFile(bucket, selected, `beneficiaires/${ids.client_id}`);
        if (!uploaded) throw new Error(`Échec du stockage de ${doc.libelle}`);
        await (supabase as any)
          .from("beneficiaire_documents")
          .update({ fichier_url: uploaded.url, storage_bucket: bucket, storage_path: uploaded.path, statut: "stocke" })
          .eq("client_id", ids.client_id)
          .eq("document_type", doc.document_type);
      }

      for (const photo of remisePhotos) {
        const uploaded = await uploadFile("documents", photo, `beneficiaires/${ids.client_id}/remise-acte`);
        if (!uploaded) continue;
        await (supabase as any).from("beneficiaire_documents").insert({
          client_id: ids.client_id,
          proprietaire_id: ids.proprietaire_id,
          parcelle_id: ids.parcelle_id,
          plantation_id: ids.plantation_id,
          document_type: "photo_remise_acte",
          libelle: `Photo remise de l’acte — ${photo.name}`,
          categorie: "remise_acte",
          fichier_url: uploaded.url,
          storage_bucket: "documents",
          storage_path: uploaded.path,
          statut: "stocke",
        });
      }

      toast({
        title: "Bénéficiaire enregistré",
        description: "Le bénéficiaire, le propriétaire foncier, la parcelle et l’actif agricole ont été rattachés. Aucun accès portail n’a été créé.",
      });
      navigate(`/client/${ids.client_id}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Enregistrement impossible", description: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={() => navigate("/clients")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Bénéficiaire particulier</h1>
          <p className="text-muted-foreground">Enregistrement interne d’un actif agricole remis à titre gracieux — sans compte portail.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Bénéficiaire</CardTitle>
            <Badge variant="secondary">Externe · sans portail</Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Nom de famille *</Label><Input value={beneficiaire.nom_famille} onChange={e=>setBeneficiaire({...beneficiaire,nom_famille:e.target.value})}/></div>
            <div><Label>Prénoms *</Label><Input value={beneficiaire.prenoms} onChange={e=>setBeneficiaire({...beneficiaire,prenoms:e.target.value})}/></div>
            <div><Label>Nom complet *</Label><Input value={beneficiaire.nom_complet} onChange={e=>setBeneficiaire({...beneficiaire,nom_complet:e.target.value})}/></div>
            <div><Label>Date de naissance</Label><Input type="date" value={beneficiaire.date_naissance} onChange={e=>setBeneficiaire({...beneficiaire,date_naissance:e.target.value})}/></div>
            <div><Label>Lieu de naissance</Label><Input value={beneficiaire.lieu_naissance} onChange={e=>setBeneficiaire({...beneficiaire,lieu_naissance:e.target.value})}/></div>
            <div><Label>Nationalité</Label><Input value={beneficiaire.nationalite} onChange={e=>setBeneficiaire({...beneficiaire,nationalite:e.target.value})}/></div>
            <div><Label>N° CNI / pièce *</Label><Input value={beneficiaire.numero_piece} onChange={e=>setBeneficiaire({...beneficiaire,numero_piece:e.target.value})}/></div>
            <div><Label>Date d’émission</Label><Input type="date" value={beneficiaire.date_delivrance_piece} onChange={e=>setBeneficiaire({...beneficiaire,date_delivrance_piece:e.target.value})}/></div>
            <div><Label>Téléphone</Label><Input value={beneficiaire.telephone} onChange={e=>setBeneficiaire({...beneficiaire,telephone:e.target.value})}/></div>
            <div><Label>WhatsApp</Label><Input value={beneficiaire.whatsapp} onChange={e=>setBeneficiaire({...beneficiaire,whatsapp:e.target.value})}/></div>
            <div className="md:col-span-2"><Label>Adresse</Label><Input value={beneficiaire.domicile} onChange={e=>setBeneficiaire({...beneficiaire,domicile:e.target.value})}/></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LandPlot className="h-5 w-5" /> Propriétaire foncier</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Nom complet *</Label><Input value={proprietaire.nom_complet} onChange={e=>setProprietaire({...proprietaire,nom_complet:e.target.value})}/></div>
            <div><Label>Nom</Label><Input value={proprietaire.nom} onChange={e=>setProprietaire({...proprietaire,nom:e.target.value})}/></div>
            <div><Label>Prénoms</Label><Input value={proprietaire.prenoms} onChange={e=>setProprietaire({...proprietaire,prenoms:e.target.value})}/></div>
            <div><Label>Téléphone</Label><Input value={proprietaire.telephone} onChange={e=>setProprietaire({...proprietaire,telephone:e.target.value})}/></div>
            <div><Label>Village / localité</Label><Input value={proprietaire.village} onChange={e=>setProprietaire({...proprietaire,village:e.target.value})}/></div>
            <div><Label>Statut foncier</Label><Input value={proprietaire.statut_foncier} onChange={e=>setProprietaire({...proprietaire,statut_foncier:e.target.value})}/></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LandPlot className="h-5 w-5" /> Parcelle</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Référence parcelle *</Label><Input value={parcelle.code_parc} onChange={e=>setParcelle({...parcelle,code_parc:e.target.value})}/></div>
            <div><Label>Superficie (ha) *</Label><Input type="number" step="0.01" min="0" value={parcelle.surface_totale_ha} onChange={e=>setParcelle({...parcelle,surface_totale_ha:e.target.value})}/></div>
            <div><Label>Village / localité</Label><Input value={parcelle.village} onChange={e=>setParcelle({...parcelle,village:e.target.value})}/></div>
            <div className="md:col-span-3"><p className="text-sm text-muted-foreground">La parcelle est enregistrée avec le mode « actif agricole » pour que les 2 ha de plantation puissent être comptabilisés dans le portefeuille agricole sans les confondre avec une souscription client.</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sprout className="h-5 w-5" /> Actif agricole</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Superficie de l’actif (ha)</Label><Input type="number" step="0.01" value={plantation.superficie_ha} onChange={e=>setPlantation({...plantation,superficie_ha:e.target.value})}/></div>
            <div><Label>Date de plantation / engagement</Label><Input type="date" value={plantation.date_plantation} onChange={e=>setPlantation({...plantation,date_plantation:e.target.value})}/></div>
            <div><Label>Date d’activation</Label><Input type="date" value={plantation.date_activation} onChange={e=>setPlantation({...plantation,date_activation:e.target.value})}/></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5" /> Documents disponibles</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FileUploadVisual label="CNI — recto" field="cni_recto" accept="image/jpeg,image/png" currentFile={files.cni_recto.file} currentPreview={files.cni_recto.preview} onFileChange={setFile}/>
            <FileUploadVisual label="CNI — verso" field="cni_verso" accept="image/jpeg,image/png" currentFile={files.cni_verso.file} currentPreview={files.cni_verso.preview} onFileChange={setFile}/>
            <FileUploadVisual label="Photo officielle" field="photo_officielle" accept="image/jpeg,image/png" currentFile={files.photo_officielle.file} currentPreview={files.photo_officielle.preview} onFileChange={setFile}/>
            <FileUploadVisual label="Acte de remise" field="acte_remise" accept="application/pdf,image/jpeg,image/png" currentFile={files.acte_remise.file} currentPreview={files.acte_remise.preview} onFileChange={setFile}/>
            <div className="md:col-span-2 space-y-2">
              <Label>Photos de remise de l’acte</Label>
              <div className="border-2 border-dashed rounded-lg p-5">
                <Input type="file" accept="image/jpeg,image/png" multiple onChange={e=>setRemisePhotos(Array.from(e.target.files || []))}/>
                <p className="text-xs text-muted-foreground mt-2">Plusieurs photos peuvent être ajoutées. Les photos du propriétaire et de la parcelle pourront être ajoutées plus tard.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={()=>navigate("/clients")}>Annuler</Button>
          <Button type="submit" disabled={loading}>
            <Upload className="h-4 w-4 mr-2" />{loading ? "Enregistrement..." : "Enregistrer le bénéficiaire et les rattachements"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default BeneficiaireParticulier;
