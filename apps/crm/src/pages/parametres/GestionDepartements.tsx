import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/common/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/useRealtime";
import { logActivity } from "@/utils/traceability";
import { Search, MapPin, AlertTriangle } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/safeError";

const GestionDepartements = () => {
  const { toast } = useToast();
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [{ data: regionsData }, { data: departementsData }] = await Promise.all([
        supabase.from("regions").select("*").eq("est_active", true).order("nom"),
        (supabase as any).from("departements").select("*, regions!departements_region_id_fkey(nom, est_active)").order("nom")
      ]);
      setRegions(regionsData || []);
      setDepartements(departementsData || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const toggleDepartement = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("departements")
        .update({ est_actif: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      await logActivity({ tableName: 'departements', recordId: id, action: 'TOGGLE', details: `Département ${!currentStatus ? 'activé' : 'désactivé'}` });
      toast({ title: "Succès", description: `Département ${!currentStatus ? "activé" : "désactivé"}` });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    }
  };

  useRealtime({ table: 'departements', onChange: fetchData });

  const filtered = departements.filter((d) => {
    const matchesSearch = d.nom?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = selectedRegion === "all" || d.region_id === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Gestion des Départements
          </CardTitle>
          <CardDescription>Activer ou désactiver les départements. La cascade s'applique automatiquement aux sous-préfectures.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrer par région" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les régions</SelectItem>
                {regions.map((r) => (<SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center py-8">Chargement...</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((dept) => {
                const regionInactive = dept.regions?.est_active !== true;
                return (
                  <div key={dept.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${regionInactive ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/50'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium cursor-pointer">{dept.nom}</Label>
                        {regionInactive && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />Région désactivée
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Région: {dept.regions?.nom || "—"}</p>
                    </div>
                    <Switch
                      checked={!regionInactive && dept.est_actif === true}
                      disabled={regionInactive}
                      onCheckedChange={() => toggleDepartement(dept.id, dept.est_actif ?? false)}
                    />
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-center py-4 text-muted-foreground">Aucun département trouvé</p>}
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              💡 {filtered.length} département(s) • {filtered.filter(d => d.regions?.est_active === true && d.est_actif === true).length} actif(s)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionDepartements;
