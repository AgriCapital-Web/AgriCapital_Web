import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";

const InteractiveMap = lazy(() => import("@/components/maps/InteractiveMap"));

interface PlantationMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  info: string;
}

export const PlantationsMap = () => {
  const [markers, setMarkers] = useState<PlantationMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlantations();
  }, []);

  const fetchPlantations = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("plantations")
        .select(`
          id,
          id_unique,
          nom_plantation,
          latitude,
          longitude,
          superficie_ha,
          village_nom,
          souscripteurs (nom_complet),
          sous_prefectures (nom)
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;

      const plantationMarkers: PlantationMarker[] = (data || [])
        .filter((p: any) => p.latitude && p.longitude)
        .map((p: any) => ({
          id: p.id,
          lat: parseFloat(p.latitude),
          lng: parseFloat(p.longitude),
          label: p.nom_plantation || p.id_unique || 'Plantation',
          info: `${p.souscripteurs?.nom_complet || 'N/A'} • ${p.superficie_ha || 0} ha • ${p.sous_prefectures?.nom || p.village_nom || 'N/A'}`
        }));

      setMarkers(plantationMarkers);
    } catch (error) {
      console.error("Erreur lors du chargement des plantations:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Carte Interactive des Plantations
          {markers.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {markers.length} plantation(s) localisée(s)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        {loading ? (
          <div className="h-[300px] sm:h-[400px] flex items-center justify-center bg-muted/50 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Chargement de la carte...</span>
          </div>
        ) : markers.length === 0 ? (
          <div className="h-[300px] sm:h-[400px] flex flex-col items-center justify-center bg-muted/30 rounded-lg">
            <MapPin className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground text-center">
              Aucune plantation avec coordonnées GPS
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Les plantations apparaîtront ici lorsqu'elles auront des coordonnées GPS enregistrées
            </p>
          </div>
        ) : (
          <Suspense fallback={
            <div className="h-[300px] sm:h-[400px] flex items-center justify-center bg-muted/50 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <InteractiveMap
              mode="view"
              markers={markers}
              height="400px"
              className="rounded-lg overflow-hidden"
            />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
};
