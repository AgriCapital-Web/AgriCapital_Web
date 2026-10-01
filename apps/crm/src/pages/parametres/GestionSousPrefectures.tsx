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

const GestionSousPrefectures = () => {
  const { toast } = useToast();
  const [departements, setDepartements] = useState<any[]>([]);
  const [sousPrefectures, setSousPrefectures] = useState<any[]>([]);
  const [selectedDepartement, setSelectedDepartement] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [{ data: depData }, { data: spData }] = await Promise.all([
        (supabase as any).from("departements").select("*").eq("est_actif", true).order("nom"),
        (supabase as any).from("sous_prefectures").select("*, departements!sous_prefectures_departement_id_fkey(nom, est_actif)").order("nom")
      ]);
      setDepartements(depData || []);
      setSousPrefectures(spData || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const toggleSousPrefecture = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("sous_prefectures")
        .update({ est_active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      await logActivity({ tableName: 'sous_prefectures', recordId: id, action: 'TOGGLE', details: `Sous-préfecture ${!currentStatus ? 'activée' : 'désactivée'}` });
      toast({ title: "Succès", description: `Sous-préfecture ${!currentStatus ? "activée" : "désactivée"}` });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    }
  };

  useRealtime({ table: 'sous_prefectures', onChange: fetchData });

  const filtered = sousPrefectures.filter((sp) => {
    const matchesSearch = sp.nom?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDepartement === "all" || sp.departement_id === selectedDepartement;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Gestion des Sous-Préfectures
          </CardTitle>
          <CardDescription>Gérer les sous-préfectures par département</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={selectedDepartement} onValueChange={setSelectedDepartement}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrer par département" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les départements</SelectItem>
                {departements.map((d) => (<SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center py-8">Chargement...</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((sp) => {
                const deptInactif = sp.departements?.est_actif !== true;
                return (
                  <div key={sp.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${deptInactif ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/50'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium">{sp.nom}</Label>
                        {deptInactif && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />Dept. désactivé
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Département: {sp.departements?.nom || "—"}</p>
                    </div>
                    <Switch
                      checked={!deptInactif && sp.est_active === true}
                      disabled={deptInactif}
                      onCheckedChange={() => toggleSousPrefecture(sp.id, sp.est_active ?? false)}
                    />
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-center py-4 text-muted-foreground">Aucune sous-préfecture trouvée</p>}
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              💡 {filtered.length} sous-préfecture(s) • {filtered.filter(s => s.departements?.est_actif === true && s.est_active === true).length} active(s)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionSousPrefectures;
