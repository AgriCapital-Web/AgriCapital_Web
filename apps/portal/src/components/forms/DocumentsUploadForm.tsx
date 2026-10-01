import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";

interface DocumentsUploadFormProps {
  onSuccess: () => void;
}

const DocumentsUploadForm = ({ onSuccess }: DocumentsUploadFormProps) => {
  const { register, handleSubmit, setValue } = useForm();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [souscripteurs, setSouscripteurs] = useState<any[]>([]);
  const [files, setFiles] = useState<{ [key: string]: File | null }>({});
  const [previews, setPreviews] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchSouscripteurs = async () => {
      const { data } = await (supabase as any)
        .from("souscripteurs")
        .select("id, id_unique, nom_complet, prenoms")
        .order("created_at", { ascending: false });
      setSouscripteurs(data || []);
    };
    fetchSouscripteurs();
  }, []);

  const DOCUMENT_TYPES = [
    { key: "fiche_contrat", label: "Fiche Contrat", bucket: "documents-fonciers" },
    { key: "enquete_communautaire", label: "Enquête Communautaire", bucket: "documents-fonciers" },
    { key: "piece_identite", label: "Pièce d'Identité", bucket: "pieces-identite" },
    { key: "document_foncier", label: "Document Foncier", bucket: "documents-fonciers" },
    { key: "attestation_exploitation", label: "Attestation d'Exploitation (optionnel)", bucket: "documents-fonciers" },
  ];

  const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles({ ...files, [key]: file });
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews({ ...previews, [key]: reader.result as string });
        };
        reader.readAsDataURL(file);
      } else {
        setPreviews({ ...previews, [key]: file.name });
      }
    }
  };

  const clearFile = (key: string) => {
    setFiles({ ...files, [key]: null });
    setPreviews({ ...previews, [key]: "" });
  };

  const onSubmit = async (data: any) => {
    if (!user) return;
    setLoading(true);

    try {
      for (const docType of DOCUMENT_TYPES) {
        const file = files[docType.key];
        if (!file && docType.key !== "attestation_exploitation") {
          toast({
            variant: "destructive",
            title: "Document manquant",
            description: `Le document ${docType.label} est requis`,
          });
          setLoading(false);
          return;
        }

        if (file) {
          const result = await uploadFile(docType.bucket, file);
          if (result) {
            await (supabase as any).from("documents_souscription").insert({
              souscripteur_id: data.souscripteur_id,
              type_document: docType.key,
              fichier_url: result.url,
              statut: "en_attente",
            });
          }
        }
      }

      toast({
        title: "Succès",
        description: "Documents soumis avec succès",
      });
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
      <div className="space-y-2">
        <Label>Souscripteur *</Label>
        <Select onValueChange={(value) => setValue("souscripteur_id", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un souscripteur" />
          </SelectTrigger>
          <SelectContent>
            {souscripteurs.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.id_unique} - {s.nom_complet} {s.prenoms}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {DOCUMENT_TYPES.map((docType) => (
          <Card key={docType.key}>
            <CardContent className="pt-6">
              <Label>{docType.label}</Label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(docType.key, e)}
                className="mt-2 w-full"
              />
              {previews[docType.key] && (
                <div className="mt-3 relative">
                  {previews[docType.key].startsWith('data:image') ? (
                    <img
                      src={previews[docType.key]}
                      alt="Aperçu"
                      className="w-full h-32 object-cover rounded border"
                    />
                  ) : (
                    <div className="p-3 bg-muted rounded border text-sm">
                      📄 {previews[docType.key]}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => clearFile(docType.key)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Envoi en cours..." : "Soumettre tous les documents"}
        </Button>
      </div>
    </form>
  );
};

export default DocumentsUploadForm;
