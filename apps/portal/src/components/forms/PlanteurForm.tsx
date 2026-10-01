import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FileUpload from "@/components/ui/file-upload";
import { X } from "lucide-react";

interface PlanteurFormProps {
  planteur?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const PlanteurForm = ({ planteur, onSuccess, onCancel }: PlanteurFormProps) => {
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: planteur || {},
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pieceRectoFile, setPieceRectoFile] = useState<File | null>(null);
  const [pieceVersoFile, setPieceVersoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [pieceRectoPreview, setPieceRectoPreview] = useState<string>("");
  const [pieceVersoPreview, setPieceVersoPreview] = useState<string>("");

  const handleFileSelect = (file: File, setFile: (file: File) => void, setPreview: (url: string) => void) => {
    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: any) => {
    if (!user) return;
    setLoading(true);

    try {
      let photo_profil_url = planteur?.photo_profil_url;
      let fichier_piece_url = planteur?.fichier_piece_url;

      // Upload photo de profil
      if (photoFile) {
        const result = await uploadFile("photos-profils", photoFile);
        if (result) photo_profil_url = result.url;
      }

      // Upload pièce d'identité recto
      if (pieceRectoFile) {
        const result = await uploadFile("pieces-identite", pieceRectoFile);
        if (result) data.fichier_piece_recto_url = result.url;
      }

      // Upload pièce d'identité verso
      if (pieceVersoFile) {
        const result = await uploadFile("pieces-identite", pieceVersoFile);
        if (result) data.fichier_piece_verso_url = result.url;
      }

      const payload = {
        ...data,
        photo_profil_url,
        created_by: planteur ? undefined : user.id,
        updated_by: user.id,
      };

      if (planteur) {
        const { error } = await (supabase as any)
          .from("souscripteurs")
          .update(payload)
          .eq("id", planteur.id);
        
        if (error) throw error;
        
        toast({
          title: "Succès",
          description: "Planteur modifié avec succès",
        });
      } else {
        const { data: genId, error: genErr } = await (supabase as any).rpc('generate_souscripteur_id');
        if (genErr) throw genErr;
        const { error } = await (supabase as any)
          .from("souscripteurs")
          .insert({ ...payload, id_unique: genId });
        
        if (error) throw error;
        
        toast({
          title: "Succès",
          description: "Planteur créé avec succès",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Civilité *</Label>
          <Select
            defaultValue={planteur?.civilite}
            onValueChange={(value) => setValue("civilite", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Monsieur</SelectItem>
              <SelectItem value="Mme">Madame</SelectItem>
              <SelectItem value="Mlle">Mademoiselle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Nom Complet *</Label>
          <Input {...register("nom_complet", { required: true })} />
        </div>

        <div className="space-y-2">
          <Label>Prénoms *</Label>
          <Input {...register("prenoms", { required: true })} />
        </div>

        <div className="space-y-2">
          <Label>Date de Naissance *</Label>
          <Input type="date" {...register("date_naissance", { required: true })} />
        </div>

        <div className="space-y-2">
          <Label>Lieu de Naissance</Label>
          <Input {...register("lieu_naissance")} />
        </div>

        <div className="space-y-2">
          <Label>Téléphone *</Label>
          <Input {...register("telephone", { required: true })} />
        </div>

        <div className="space-y-2">
          <Label>WhatsApp *</Label>
          <Input {...register("whatsapp", { required: true })} />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" {...register("email")} />
        </div>

        <div className="space-y-2">
          <Label>Domicile/Résidence *</Label>
          <Input {...register("domicile_residence", { required: true })} />
        </div>

        <div className="space-y-2">
          <Label>Type de Pièce *</Label>
          <Select
            defaultValue={planteur?.type_piece}
            onValueChange={(value) => setValue("type_piece", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cni">CNI</SelectItem>
              <SelectItem value="passeport">Passeport</SelectItem>
              <SelectItem value="attestation">Attestation d'identité</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Numéro de Pièce *</Label>
          <Input {...register("numero_piece", { required: true })} />
        </div>

        <div className="space-y-2">
          <Label>Date de Délivrance *</Label>
          <Input
            type="date"
            {...register("date_delivrance_piece", { required: true })}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Photo de profil</Label>
          <FileUpload
            onFileSelect={(file) => handleFileSelect(file, setPhotoFile, setPhotoPreview)}
            accept="image/*"
            currentFile={photoFile?.name || planteur?.photo_profil_url}
            label="Choisir une photo"
            onRemove={() => {
              setPhotoFile(null);
              setPhotoPreview("");
            }}
          />
          {photoPreview && (
            <div className="relative mt-2">
              <img src={photoPreview} alt="Aperçu photo" className="w-full h-40 object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview("");
                }}
                className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Pièce d'identité - Recto</Label>
          <FileUpload
            onFileSelect={(file) => handleFileSelect(file, setPieceRectoFile, setPieceRectoPreview)}
            accept="image/*"
            currentFile={pieceRectoFile?.name}
            label="Choisir recto"
            onRemove={() => {
              setPieceRectoFile(null);
              setPieceRectoPreview("");
            }}
          />
          {pieceRectoPreview && (
            <div className="relative mt-2">
              <img src={pieceRectoPreview} alt="Aperçu recto" className="w-full h-40 object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => {
                  setPieceRectoFile(null);
                  setPieceRectoPreview("");
                }}
                className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Pièce d'identité - Verso</Label>
          <FileUpload
            onFileSelect={(file) => handleFileSelect(file, setPieceVersoFile, setPieceVersoPreview)}
            accept="image/*"
            currentFile={pieceVersoFile?.name}
            label="Choisir verso"
            onRemove={() => {
              setPieceVersoFile(null);
              setPieceVersoPreview("");
            }}
          />
          {pieceVersoPreview && (
            <div className="relative mt-2">
              <img src={pieceVersoPreview} alt="Aperçu verso" className="w-full h-40 object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => {
                  setPieceVersoFile(null);
                  setPieceVersoPreview("");
                }}
                className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : planteur ? "Modifier le souscripteur" : "Enregistrer le souscripteur"}
        </Button>
      </div>
    </form>
  );
};

export default PlanteurForm;
