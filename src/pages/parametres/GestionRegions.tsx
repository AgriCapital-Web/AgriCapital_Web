import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/useRealtime";
import { logActivity } from "@/utils/traceability";
import { Search, MapPin, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSafeErrorMessage } from "@/lib/safeError";

const GestionRegions = () => {
  const { toast } = useToast();
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: districtsData, error: dErr } = await supabase
        .from("districts")
        .select("*")
        .order("nom");
      
      if (dErr) throw dErr;

      const { data: regionsData, error: rErr } = await supabase
        .from("regions")
        .select("*, districts!regions_district_id_fkey(nom, est_actif)")
        .order("nom");

      if (rErr) throw rErr;

      setDistricts(districtsData || []);
      setRegions(regionsData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: getSafeErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRegion = async (regionId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("regions")
        .update({ est_active: !currentStatus })
        .eq("id", regionId);

      if (error) throw error;

      await logActivity({
        tableName: 'regions',
        recordId: regionId,
        action: 'TOGGLE',
        details: `Région ${!currentStatus ? 'activée' : 'désactivée'}`,
      });

      toast({
        title: "Succès",
        description: `Région ${!currentStatus ? "activée" : "désactivée"}`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: getSafeErrorMessage(error),
      });
    }
  };

  useRealtime({ table: 'regions', onChange: fetchData });

  const filteredRegions = regions.filter((region) => {
    const matchesSearch = region.nom?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDistrict = selectedDistrict === "all" || region.district_id === selectedDistrict;
    return matchesSearch && matchesDistrict;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Gestion des Régions
          </CardTitle>
          <CardDescription>
            Activer ou désactiver les régions selon le déploiement de l'entreprise
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une région..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrer par district" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les districts</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center py-8">Chargement...</p>
          ) : (
            <div className="space-y-2">
              {filteredRegions.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  Aucune région trouvée
                </p>
              ) : (
                filteredRegions.map((region) => {
                  const districtInactif = region.districts?.est_actif !== true;
                  const regionEffective = !districtInactif && region.est_active === true;
                  return (
                  <div
                    key={region.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${districtInactif ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/50'}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`region-${region.id}`} className="font-medium cursor-pointer">
                          {region.nom}
                        </Label>
                        {districtInactif && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />District désactivé
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        District: {region.districts?.nom || "Non défini"}
                      </p>
                    </div>
                    <Switch
                      id={`region-${region.id}`}
                      checked={regionEffective}
                      disabled={districtInactif}
                      onCheckedChange={() => toggleRegion(region.id, region.est_active ?? false)}
                    />
                  </div>
                  );
                })
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              💡 {filteredRegions.length} région(s) affichée(s) • {filteredRegions.filter(r => r.districts?.est_actif === true && r.est_active === true).length} active(s)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionRegions;
