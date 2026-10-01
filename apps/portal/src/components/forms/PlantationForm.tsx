import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";

interface PlantationFormProps {
  plantation?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const PlantationForm = ({ plantation, onSuccess, onCancel }: PlantationFormProps) => {
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: plantation || {},
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [souscripteurs, setSouscripteurs] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [sousPrefectures, setSousPrefectures] = useState<any[]>([]);

  useEffect(() => {
    fetchSouscripteurs();
    fetchDistricts();
    
    // Si modification, charger les données dépendantes
    if (plantation?.district_id) {
      fetchRegions(plantation.district_id);
    }
    if (plantation?.region_id) {
      fetchDepartements(plantation.region_id);
    }
    if (plantation?.departement_id) {
      fetchSousPrefectures(plantation.departement_id);
    }
  }, [plantation]);

  const fetchSouscripteurs = async () => {
    const { data } = await supabase
      .from("souscripteurs")
      .select("id, nom, prenoms")
      .order("nom");
    setSouscripteurs(data || []);
  };

  const fetchDistricts = async () => {
    const { data } = await supabase
      .from("districts")
      .select("id, nom")
      .eq("est_actif", true)
      .order("nom");
    setDistricts(data || []);
  };

  const fetchRegions = async (districtId: string) => {
    const { data } = await supabase
      .from("regions")
      .select("id, nom, code")
      .eq("district_id", districtId)
      .eq("est_active", true)
      .order("nom");
    setRegions(data || []);
  };

  const fetchDepartements = async (regionId: string) => {
    const { data } = await supabase
      .from("departements")
      .select("id, nom, code")
      .eq("region_id", regionId)
      .eq("est_actif", true)
      .order("nom");
    setDepartements(data || []);
  };

  const fetchSousPrefectures = async (departementId: string) => {
    const { data } = await supabase
      .from("sous_prefectures")
      .select("id, nom, code")
      .eq("departement_id", departementId)
      .eq("est_active", true)
      .order("nom");
    setSousPrefectures(data || []);
  };

  const onSubmit = async (data: any) => {
    if (!user) return;
    setLoading(true);

    try {
      const payload = {
        souscripteur_id: data.souscripteur_id,
        nom: data.nom_plantation || data.nom,
        nom_plantation: data.nom_plantation || data.nom,
        superficie_ha: Number(data.superficie_ha),
        nombre_plants: data.nombre_plants ? Number(data.nombre_plants) : null,
        densite_plants: data.densite_plants ? Number(data.densite_plants) : null,
        district_id: data.district_id || null,
        region_id: data.region_id || null,
        departement_id: data.departement_id || null,
        sous_prefecture_id: data.sous_prefecture_id || null,
        village_nom: data.village_nom || null,
        localite: data.localite || data.village_nom || null,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
        altitude: data.altitude ? Number(data.altitude) : null,
        document_foncier_type: data.document_foncier_type || null,
        document_foncier_numero: data.document_foncier_numero || null,
        document_foncier_date_delivrance: data.document_foncier_date_delivrance || null,
        date_signature_contrat: data.date_signature_contrat || null,
        chef_village_nom: data.chef_village_nom || null,
        chef_village_telephone: data.chef_village_telephone || null,
        notes_internes: data.notes_internes || null,
        type_culture: data.type_culture || 'Palmier à huile',
        variete: data.variete || null,
      };

      if (plantation) {
        const { error } = await supabase
          .from("plantations")
          .update(payload)
          .eq("id", plantation.id);
        
        if (error) throw error;
        
        toast({
          title: "Succès",
          description: "Plantation modifiée avec succès",
        });
      } else {
        const { error } = await supabase
          .from("plantations")
          .insert({
            ...payload,
            created_by: user.id,
            statut: 'actif',
            statut_global: 'en_attente_da',
          });
        
        if (error) throw error;
        
        toast({
          title: "Succès",
          description: "Plantation créée avec succès",
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-3 space-y-2">
          <Label>Nom de la Plantation *</Label>
          <Input 
            {...register("nom_plantation")} 
            defaultValue={plantation?.nom_plantation || plantation?.nom}
          />
        </div>

        <div className="space-y-2">
          <Label>Planteur *</Label>
          <Select
            defaultValue={plantation?.souscripteur_id}
            onValueChange={(value) => setValue("souscripteur_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un planteur" />
            </SelectTrigger>
            <SelectContent>
              {souscripteurs.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nom} {s.prenoms}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Superficie (ha) *</Label>
          <Input
            type="number"
            step="0.01"
            {...register("superficie_ha", { required: true })}
          />
        </div>

        <div className="space-y-2">
          <Label>Nombre de Plants</Label>
          <Input
            type="number"
            {...register("nombre_plants")}
          />
        </div>

        <div className="space-y-2">
          <Label>District</Label>
          <Select
            defaultValue={plantation?.district_id}
            onValueChange={(value) => {
              setValue("district_id", value);
              fetchRegions(value);
              setRegions([]);
              setDepartements([]);
              setSousPrefectures([]);
              setValue("region_id", "");
              setValue("departement_id", "");
              setValue("sous_prefecture_id", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un district" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Région</Label>
          <Select
            defaultValue={plantation?.region_id}
            onValueChange={(value) => {
              setValue("region_id", value);
              fetchDepartements(value);
              setDepartements([]);
              setSousPrefectures([]);
              setValue("departement_id", "");
              setValue("sous_prefecture_id", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une région" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Département</Label>
          <Select
            defaultValue={plantation?.departement_id}
            onValueChange={(value) => {
              setValue("departement_id", value);
              fetchSousPrefectures(value);
              setSousPrefectures([]);
              setValue("sous_prefecture_id", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un département" />
            </SelectTrigger>
            <SelectContent>
              {departements.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Sous-Préfecture</Label>
          <Select
            defaultValue={plantation?.sous_prefecture_id}
            onValueChange={(value) => setValue("sous_prefecture_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une sous-préfecture" />
            </SelectTrigger>
            <SelectContent>
              {sousPrefectures.map((sp) => (
                <SelectItem key={sp.id} value={sp.id}>
                  {sp.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Village / Localité</Label>
          <Input {...register("village_nom")} />
        </div>

        <div className="space-y-2">
          <Label>Type de culture</Label>
          <Select
            defaultValue={plantation?.type_culture || "Palmier à huile"}
            onValueChange={(value) => setValue("type_culture", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Palmier à huile">Palmier à huile</SelectItem>
              <SelectItem value="Hévéa">Hévéa</SelectItem>
              <SelectItem value="Cacao">Cacao</SelectItem>
              <SelectItem value="Café">Café</SelectItem>
              <SelectItem value="Autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Variété</Label>
          <Input {...register("variete")} placeholder="Ex: Tenera" />
        </div>

        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input type="number" step="0.000001" {...register("latitude")} />
        </div>

        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input type="number" step="0.000001" {...register("longitude")} />
        </div>

        <div className="space-y-2">
          <Label>Altitude (m)</Label>
          <Input type="number" {...register("altitude")} />
        </div>

        <div className="space-y-2">
          <Label>Type de Document Foncier</Label>
          <Select
            defaultValue={plantation?.document_foncier_type}
            onValueChange={(value) => setValue("document_foncier_type", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="titre_foncier">Titre Foncier</SelectItem>
              <SelectItem value="certificat_foncier">Certificat Foncier</SelectItem>
              <SelectItem value="contrat_metayage">Contrat Métayage</SelectItem>
              <SelectItem value="autorisation">Autorisation d'exploiter</SelectItem>
              <SelectItem value="attestation_villageoise">Attestation Villageoise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Numéro du Document</Label>
          <Input {...register("document_foncier_numero")} />
        </div>

        <div className="space-y-2">
          <Label>Date de Délivrance</Label>
          <Input
            type="date"
            {...register("document_foncier_date_delivrance")}
          />
        </div>

        <div className="space-y-2">
          <Label>Date de Signature Contrat</Label>
          <Input
            type="date"
            {...register("date_signature_contrat")}
          />
        </div>

        <div className="space-y-2">
          <Label>Chef de Village</Label>
          <Input {...register("chef_village_nom")} />
        </div>

        <div className="space-y-2">
          <Label>Téléphone Chef Village</Label>
          <Input {...register("chef_village_telephone")} />
        </div>

        <div className="col-span-3 space-y-2">
          <Label>Notes Internes</Label>
          <Textarea {...register("notes_internes")} rows={3} />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : plantation ? "Modifier" : "Créer"}
        </Button>
      </div>
    </form>
  );
};

export default PlantationForm;