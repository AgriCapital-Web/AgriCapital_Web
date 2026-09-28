import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/useRealtime";
import { logActivity } from "@/utils/traceability";
import { Search, MapPin, AlertTriangle } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/safeError";

const GestionVillages = () => {
  const { toast } = useToast();
  const [sousPrefectures, setSousPrefectures] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [selectedSP, setSelectedSP] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [{ data: spData }, { data: vData }] = await Promise.all([
        supabase.from("sous_prefectures").select("*").eq("est_active", true).order("nom"),
        supabase.from("villages").select("*, sous_prefectures!villages_sous_prefecture_id_fkey(nom, est_active)").order("nom")
      ]);
      setSousPrefectures(spData || []);
      setVillages(vData || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const toggleVillage = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("villages")
        .update({ est_actif: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      await logActivity({ tableName: 'villages', recordId: id, action: 'TOGGLE', details: `Village ${!currentStatus ? 'activé' : 'désactivé'}` });
      toast({ title: "Succès", description: `Village ${!currentStatus ? "activé" : "désactivé"}` });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    }
  };

  useRealtime({ table: 'villages', onChange: fetchData });

  const filtered = villages.filter((v) => {
    const matchesSearch = v.nom?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSP = selectedSP === "all" || v.sous_prefecture_id === selectedSP;
    return matchesSearch && matchesSP;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Gestion des Villages
          </CardTitle>
          <CardDescription>Gérer les villages par sous-préfecture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={selectedSP} onValueChange={setSelectedSP}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Filtrer par sous-préfecture" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les sous-préfectures</SelectItem>
                {sousPrefectures.map((sp) => (<SelectItem key={sp.id} value={sp.id}>{sp.nom}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center py-8">Chargement...</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((village) => {
                const spInactive = village.sous_prefectures?.est_active !== true;
                return (
                  <div key={village.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${spInactive ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/50'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium">{village.nom}</Label>
                        {spInactive && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />S/P désactivée
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">S/Préfecture: {village.sous_prefectures?.nom || "—"}</p>
                    </div>
                    <Switch
                      checked={!spInactive && village.est_actif === true}
                      disabled={spInactive}
                      onCheckedChange={() => toggleVillage(village.id, village.est_actif ?? false)}
                    />
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-center py-4 text-muted-foreground">Aucun village trouvé</p>}
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              💡 {filtered.length} village(s) • {filtered.filter(v => v.sous_prefectures?.est_active === true && v.est_actif === true).length} actif(s)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionVillages;
