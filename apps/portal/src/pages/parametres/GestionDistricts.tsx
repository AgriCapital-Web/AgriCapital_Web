import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/useRealtime";
import { logActivity } from "@/utils/traceability";
import { Search, MapPin } from "lucide-react";

const GestionDistricts = () => {
  const { toast } = useToast();
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDistricts();
  }, []);

  const fetchDistricts = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("districts")
        .select("*")
        .order("nom");

      if (error) throw error;
      setDistricts(data || []);
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

  const toggleDistrict = async (districtId: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
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
        description: `District ${!currentStatus ? "activé" : "désactivé"}`,
      });
      fetchDistricts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
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
            Activer ou désactiver les districts selon le déploiement de l'entreprise
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
                    <Label htmlFor={`district-${district.id}`} className="font-medium cursor-pointer">
                      {district.nom}
                    </Label>
                    {district.code && (
                      <p className="text-xs text-muted-foreground">Code: {district.code}</p>
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
              💡 Les districts sont les plus grandes subdivisions administratives de Côte d'Ivoire.
              Activez les districts où vous êtes déployé.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionDistricts;
