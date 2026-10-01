import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";

interface TicketFormProps {
  ticket?: any;
  plantationId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const TicketForm = ({ ticket, plantationId, onSuccess, onCancel }: TicketFormProps) => {
  const { register, handleSubmit, setValue } = useForm({
    defaultValues: ticket || {},
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [plantations, setPlantations] = useState<any[]>([]);
  const [techniciens, setTechniciens] = useState<any[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: plantsData } = await (supabase as any)
        .from("plantations")
        .select("id, id_unique, nom_plantation")
        .order("created_at", { ascending: false });

      const { data: techData } = await (supabase as any)
        .from("profiles")
        .select("id, nom_complet")
        .in("id", (
          await (supabase as any).from("user_roles").select("user_id").eq("role", "technicien")
        ).data?.map((r: any) => r.user_id) || []);

      setPlantations(plantsData || []);
      setTechniciens(techData || []);
    };
    fetchData();
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: any) => {
    if (!user) return;
    setLoading(true);

    try {
      let photosUrls: string[] = [];

      // Upload photos
      if (photoFiles.length > 0) {
        for (const file of photoFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('photos-plantations')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('photos-plantations')
            .getPublicUrl(fileName);

          photosUrls.push(publicUrl);
        }
      }

      const payload = {
        ...data,
        photos_urls: photosUrls.length > 0 ? photosUrls : null,
        cree_par: user.id,
      };

      if (ticket) {
        const { error } = await (supabase as any)
          .from("tickets_techniques")
          .update(payload)
          .eq("id", ticket.id);
        if (error) throw error;
        toast({ title: "Succès", description: "Ticket modifié" });
      } else {
        const { error } = await (supabase as any)
          .from("tickets_techniques")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Succès", description: "Ticket créé" });
      }

      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Plantation *</Label>
        <Select
          defaultValue={plantationId || ticket?.plantation_id}
          onValueChange={(value) => setValue("plantation_id", value)}
          disabled={!!plantationId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner" />
          </SelectTrigger>
          <SelectContent>
            {plantations.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.id_unique} - {p.nom_plantation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Priorité *</Label>
          <Select
            defaultValue={ticket?.priorite || "moyenne"}
            onValueChange={(value) => setValue("priorite", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basse">Basse</SelectItem>
              <SelectItem value="moyenne">Moyenne</SelectItem>
              <SelectItem value="haute">Haute</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Assigner à</Label>
          <Select
            defaultValue={ticket?.assigne_a}
            onValueChange={(value) => setValue("assigne_a", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un technicien" />
            </SelectTrigger>
            <SelectContent>
              {techniciens.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nom_complet}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Titre *</Label>
        <Input {...register("titre", { required: true })} />
      </div>

      <div className="space-y-2">
        <Label>Description *</Label>
        <Textarea {...register("description", { required: true })} rows={4} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Label>Photos (optionnel)</Label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            className="mt-2 w-full"
          />
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative">
                  <img
                    src={preview}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-24 object-cover rounded border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => removePhoto(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {ticket && (
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select
            defaultValue={ticket.statut}
            onValueChange={(value) => setValue("statut", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ouvert">Ouvert</SelectItem>
              <SelectItem value="en_cours">En Cours</SelectItem>
              <SelectItem value="resolu">Résolu</SelectItem>
              <SelectItem value="ferme">Fermé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : ticket ? "Modifier" : "Créer"}
        </Button>
      </div>
    </form>
  );
};

export default TicketForm;
