import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/useRealtime";
import { logActivity } from "@/utils/traceability";
import { Search, MapPin, AlertTriangle } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/safeError";

const GestionDistricts = () => {
  const { toast } = useToast();
  const [districts, setDistricts] = useState<any[]>([]);
  const [regionCounts, setRegionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDistricts();
  }, []);

  const fetchDistricts = async () => {
    try {
      const [{ data: distData, error: dErr }, { data: regData }] = await Promise.all([
        supabase.from("districts").select("*").order("nom"),
        supabase.from("regions").select("district_id")
      ]);

      if (dErr) throw dErr;
      setDistricts(distData || []);

      // Count regions per district
      const counts: Record<string, number> = {};
      (regData || []).forEach((r: any) => {
        if (r.district_id) counts[r.district_id] = (counts[r.district_id] || 0) + 1;
      });
      setRegionCounts(counts);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const toggleDistrict = async (districtId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("districts")
        .update({ est_actif: !currentStatus })
        .eq("id", districtId);

      if (error) throw error;

      await logActivity({
        tableName: 'districts',
        recordId: districtId,
        action: 'TOGGLE',
        details: `District ${!currentStatus ? 'activé' : 'désactivé'}`,
      });

      toast({
        title: "Succès",
        description: !currentStatus 
          ? "District activé — les niveaux inférieurs restent selon leur propre état d’activation" 
          : "District désactivé — toutes ses régions, départements et sous-préfectures sont automatiquement désactivés",
      });
      fetchDistricts();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    }
  };

  useRealtime({ table: 'districts', onChange: fetchDistricts });

  const filteredDistricts = districts.filter((d) =>
    d.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Gestion des Districts
          </CardTitle>
          <CardDescription>
            Activer ou désactiver les districts. ⚠️ La désactivation d'un district désactive automatiquement toutes ses régions, départements, sous-préfectures et villages. La réactivation du district ne réactive pas automatiquement les niveaux inférieurs. L'admin peut ensuite désactiver individuellement des régions selon l'expansion de l'entreprise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un district..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-center py-8">Chargement...</p>
          ) : (
            <div className="space-y-2">
              {filteredDistricts.map((district) => (
                <div
                  key={district.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`district-${district.id}`} className="font-medium cursor-pointer">
                        {district.nom}
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        {regionCounts[district.id] || 0} région(s)
                      </Badge>
                    </div>
                    {district.code && (
                      <p className="text-xs text-muted-foreground">Code: {district.code}</p>
                    )}
                    {!district.est_actif && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        Désactivé — ses régions, départements et sous-préfectures sont aussi désactivés
                      </p>
                    )}
                  </div>
                  <Switch
                    id={`district-${district.id}`}
                    checked={district.est_actif}
                    onCheckedChange={() => toggleDistrict(district.id, district.est_actif)}
                  />
                </div>
              ))}
              {filteredDistricts.length === 0 && (
                <p className="text-center py-4 text-muted-foreground">
                  Aucun district trouvé
                </p>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              💡 {filteredDistricts.length} district(s) • {filteredDistricts.filter(d => d.est_actif).length} actif(s)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionDistricts;
