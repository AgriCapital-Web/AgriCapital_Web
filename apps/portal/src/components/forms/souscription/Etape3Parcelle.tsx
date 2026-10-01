import { useState, useEffect, lazy, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";

const InteractiveMap = lazy(() => import("@/components/maps/InteractiveMap"));


interface Etape3Props {
  formData: any;
  updateFormData: (data: any) => void;
}

export const Etape3Parcelle = ({ formData, updateFormData }: Etape3Props) => {
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [sousPrefectures, setSousPrefectures] = useState<any[]>([]);


  useEffect(() => {
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (formData.district_id) fetchRegions(formData.district_id);
  }, [formData.district_id]);

  useEffect(() => {
    if (formData.region_id) fetchDepartements(formData.region_id);
  }, [formData.region_id]);

  useEffect(() => {
    if (formData.departement_id) fetchSousPrefectures(formData.departement_id);
  }, [formData.departement_id]);

  const fetchDistricts = async () => {
    const { data } = await (supabase as any).from("districts").select("*").eq("est_actif", true).order("nom");
    setDistricts(data || []);
  };

  const fetchRegions = async (districtId: string) => {
    const { data } = await (supabase as any).from("regions").select("*").eq("district_id", districtId).eq("est_active", true).order("nom");
    setRegions(data || []);
  };

  const fetchDepartements = async (regionId: string) => {
    const { data } = await (supabase as any).from("departements").select("*").eq("region_id", regionId).eq("est_actif", true).order("nom");
    setDepartements(data || []);
  };

  const fetchSousPrefectures = async (departementId: string) => {
    const { data } = await (supabase as any).from("sous_prefectures").select("*").eq("departement_id", departementId).eq("est_active", true).order("nom");
    setSousPrefectures(data || []);
  };

  const handleFileChange = (field: string, file: File | null, preview: string) => {
    updateFormData({
      [field]: file,
      [`${field}_preview`]: preview,
    });
  };


  const nombrePlants = formData.superficie_ha ? Math.round(formData.superficie_ha * 143) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Localisation de la parcelle</CardTitle>
          <CardDescription>Informations géographiques</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="district">District *</Label>
              <Select
                value={formData.district_id}
                onValueChange={(value) => {
                  updateFormData({ district_id: value, region_id: null, departement_id: null, sous_prefecture_id: null });
                  setRegions([]);
                  setDepartements([]);
                  setSousPrefectures([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un district" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Région *</Label>
              <Select
                value={formData.region_id}
                onValueChange={(value) => {
                  updateFormData({ region_id: value, departement_id: null, sous_prefecture_id: null });
                  setDepartements([]);
                  setSousPrefectures([]);
                }}
                disabled={!formData.district_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une région" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departement">Département *</Label>
              <Select
                value={formData.departement_id}
                onValueChange={(value) => {
                  updateFormData({ departement_id: value, sous_prefecture_id: null });
                  setSousPrefectures([]);
                }}
                disabled={!formData.region_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un département" />
                </SelectTrigger>
                <SelectContent>
                  {departements.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sous_prefecture">Sous-préfecture *</Label>
              <Select
                value={formData.sous_prefecture_id}
                onValueChange={(value) => updateFormData({ sous_prefecture_id: value })}
                disabled={!formData.departement_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une sous-préfecture" />
                </SelectTrigger>
                <SelectContent>
                  {sousPrefectures.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>{sp.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="village">Village *</Label>
            <Input
              id="village"
              value={formData.village}
              onChange={(e) => updateFormData({ village: e.target.value })}
              placeholder="Ex: Village de Kounahiri"
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Superficie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="superficie_ha">Superficie (hectares) *</Label>
            <Input
              id="superficie_ha"
              type="number"
              step="0.5"
              min="1"
              max="50"
              value={formData.superficie_ha}
              onChange={(e) => updateFormData({ superficie_ha: e.target.value })}
              required
            />
          </div>

          {nombrePlants > 0 && (
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium">
                Nombre de plants calculé: <span className="text-lg text-primary">{nombrePlants}</span> plants
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ({formData.superficie_ha} ha × 143 plants/ha)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limites de la parcelle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="limite_nord">Limite Nord *</Label>
              <Input
                id="limite_nord"
                value={formData.limite_nord}
                onChange={(e) => updateFormData({ limite_nord: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="limite_sud">Limite Sud *</Label>
              <Input
                id="limite_sud"
                value={formData.limite_sud}
                onChange={(e) => updateFormData({ limite_sud: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="limite_est">Limite Est *</Label>
              <Input
                id="limite_est"
                value={formData.limite_est}
                onChange={(e) => updateFormData({ limite_est: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="limite_ouest">Limite Ouest *</Label>
              <Input
                id="limite_ouest"
                value={formData.limite_ouest}
                onChange={(e) => updateFormData({ limite_ouest: e.target.value })}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coordonnées GPS (Recommandé)</CardTitle>
          <CardDescription>Cliquez sur la carte pour placer la parcelle (les coordonnées se remplissent automatiquement)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={
            <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Chargement de la carte...</span>
            </div>
          }>
            <InteractiveMap
              mode="pick"
              position={formData.latitude && formData.longitude ? [parseFloat(formData.latitude), parseFloat(formData.longitude)] : null}
              onPositionChange={(lat, lng, alt) => {
                updateFormData({
                  latitude: lat.toFixed(6),
                  longitude: lng.toFixed(6),
                  altitude: alt?.toFixed(2) || formData.altitude,
                });
              }}
              height="300px"
            />
          </Suspense>

          {(formData.latitude && formData.longitude) && (
            <p className="text-sm text-muted-foreground">
              Position sélectionnée : {formData.latitude}, {formData.longitude}{formData.altitude ? ` (alt: ${formData.altitude}m)` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Photos de la parcelle (3 obligatoires)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadVisual
            label="Vue générale *"
            field="photo_1_file"
            accept="image/*"
            required
            currentFile={formData.photo_1_file || null}
            currentPreview={formData.photo_1_file_preview || ""}
            onFileChange={handleFileChange}
          />

          <FileUploadVisual
            label="Vue délimitée (limites visibles) *"
            field="photo_2_file"
            accept="image/*"
            required
            currentFile={formData.photo_2_file || null}
            currentPreview={formData.photo_2_file_preview || ""}
            onFileChange={handleFileChange}
          />

          <FileUploadVisual
            label="Vue alternative (autre angle) *"
            field="photo_3_file"
            accept="image/*"
            required
            currentFile={formData.photo_3_file || null}
            currentPreview={formData.photo_3_file_preview || ""}
            onFileChange={handleFileChange}
          />
        </CardContent>
      </Card>
    </div>
  );
};
