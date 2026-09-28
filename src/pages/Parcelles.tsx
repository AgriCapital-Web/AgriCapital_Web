import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { PERMISSIONS } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Search, Plus, Layers, MapPin, BarChart3 } from "lucide-react";
import { useUserZones } from "@/hooks/useUserZones";
import GeographieCascade from "@/components/common/GeographieCascade";
import { offlineInsert } from "@/lib/offlineWrite";
import { getCachedItems, STORES } from "@/lib/offlineDb";
import { getSafeErrorMessage } from "@/lib/safeError";

const Parcelles = () => {
  const [parcelles, setParcelles] = useState<any[]>([]);
  const [proprietaires, setProprietaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [sousPrefectures, setSousPrefectures] = useState<any[]>([]);
  const { toast } = useToast();
  const { fetchFilteredDistricts, fetchFilteredRegions, fetchFilteredDepartements, fetchFilteredSousPrefectures } = useUserZones();

  const [formData, setFormData] = useState({
    proprietaire_id: "", nom: "", surface_totale_ha: "", district_id: "",
    region_id: "", departement_id: "", sous_prefecture_id: "", village: "",
    date_convention: "", notes: "",
  });

  const fetchData = async () => {
    try {
      if (!navigator.onLine) {
        const [pCached, oCached] = await Promise.all([
          getCachedItems(STORES.PARCELLES),
          getCachedItems(STORES.PROPRIETAIRES_TERRES),
        ]);
        setParcelles(pCached);
        setProprietaires(oCached.filter((p: any) => p.statut === 'actif'));
        setLoading(false);
        return;
      }
      const [{ data: parcellesData }, { data: propsData }] = await Promise.all([
        (supabase as any).from("parcelles")
          .select("*, proprietaires_terres(nom_complet, id_unique), districts(nom), regions(nom), departements(nom), sous_prefectures(nom)")
          .order("created_at", { ascending: false }),
        (supabase as any).from("proprietaires_terres").select("id, nom_complet, id_unique").eq("statut", "actif").order("nom_complet"),
      ]);
      setParcelles(parcellesData || []);
      setProprietaires(propsData || []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(e) });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); loadDistricts(); }, []);
  const loadDistricts = async () => { setDistricts(await fetchFilteredDistricts()); };

  const handleDistrictChange = async (v: string) => {
    setFormData(f => ({ ...f, district_id: v, region_id: "", departement_id: "", sous_prefecture_id: "" }));
    setRegions(await fetchFilteredRegions(v)); setDepartements([]); setSousPrefectures([]);
  };
  const handleRegionChange = async (v: string) => {
    setFormData(f => ({ ...f, region_id: v, departement_id: "", sous_prefecture_id: "" }));
    setDepartements(await fetchFilteredDepartements(v)); setSousPrefectures([]);
  };
  const handleDeptChange = async (v: string) => {
    setFormData(f => ({ ...f, departement_id: v, sous_prefecture_id: "" }));
    setSousPrefectures(await fetchFilteredSousPrefectures(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const surfTotale = parseFloat(formData.surface_totale_ha);
      if (surfTotale < 2) throw new Error("La surface minimale est de 2 hectares");
      const { error, offline } = await offlineInsert("parcelles", {
        nom: formData.nom || "Parcelle PP",
        proprietaire_id: formData.proprietaire_id || null,
        surface_totale_ha: surfTotale,
        district_id: formData.district_id || null, region_id: formData.region_id || null,
        departement_id: formData.departement_id || null, sous_prefecture_id: formData.sous_prefecture_id || null,
        village: formData.village, date_convention: formData.date_convention || null, notes: formData.notes,
      });
      if (error) throw error;
      toast({ title: offline ? "Enregistré hors ligne" : "Succès", description: offline ? "Parcelle en attente de synchronisation" : "Parcelle créée" });
      setIsFormOpen(false);
      setFormData({ proprietaire_id: "", nom: "", surface_totale_ha: "", district_id: "", region_id: "", departement_id: "", sous_prefecture_id: "", village: "", date_convention: "", notes: "" });
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(e) });
    }
  };

  const filtered = parcelles.filter((p: any) =>
    p.id_unique?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.proprietaires_terres?.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.village?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSurfaceDispo = parcelles.reduce((s: number, p: any) => s + (p.surface_disponible_ha || 0), 0);
  const totalSurfaceAgri = parcelles.reduce((s: number, p: any) => s + (p.surface_agricapital_ha || 0), 0);

  const statutColor = (s: string) => s === 'disponible' ? 'bg-green-500' : s === 'partiellement_attribuee' ? 'bg-amber-500' : s === 'saturee' ? 'bg-destructive' : 'bg-muted';
  const statutLabel = (s: string) => s === 'disponible' ? 'Disponible' : s === 'partiellement_attribuee' ? 'Partielle' : s === 'saturee' ? 'Saturée' : s;

  return (
    <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_PLANTATIONS}>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Parcelles</h1>
              <p className="text-muted-foreground mt-1">{parcelles.length} parcelle(s) — {totalSurfaceDispo.toFixed(1)} ha disponibles</p>
            </div>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nouvelle Parcelle</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Enregistrer une Parcelle (Convention Foncière)</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Propriétaire *</Label>
                    <Select value={formData.proprietaire_id} onValueChange={v => setFormData(f => ({ ...f, proprietaire_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un propriétaire" /></SelectTrigger>
                      <SelectContent>{proprietaires.map(p => <SelectItem key={p.id} value={p.id}>{p.nom_complet} ({p.id_unique})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nom de la parcelle</Label><Input value={formData.nom} onChange={e => setFormData(f => ({ ...f, nom: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Surface totale (ha) * (min. 2ha)</Label><Input type="number" min="2" step="0.5" value={formData.surface_totale_ha} onChange={e => setFormData(f => ({ ...f, surface_totale_ha: e.target.value }))} required /></div>
                  </div>
                  {formData.surface_totale_ha && parseFloat(formData.surface_totale_ha) >= 2 && (
                    <div className="p-3 bg-primary/10 rounded-lg text-sm space-y-1">
                      <p>Répartition 50/50 :</p>
                      <p>• Part propriétaire : <strong>{(parseFloat(formData.surface_totale_ha) / 2).toFixed(1)} ha</strong></p>
                      <p>• Part AgriCapital : <strong>{(parseFloat(formData.surface_totale_ha) / 2).toFixed(1)} ha</strong></p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>District</Label><Select value={formData.district_id} onValueChange={handleDistrictChange}><SelectTrigger><SelectValue placeholder="District" /></SelectTrigger><SelectContent>{districts.map(d => <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Région</Label><Select value={formData.region_id} onValueChange={handleRegionChange} disabled={!formData.district_id}><SelectTrigger><SelectValue placeholder="Région" /></SelectTrigger><SelectContent>{regions.map(r => <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Département</Label><Select value={formData.departement_id} onValueChange={handleDeptChange} disabled={!formData.region_id}><SelectTrigger><SelectValue placeholder="Département" /></SelectTrigger><SelectContent>{departements.map(d => <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Sous-préfecture</Label><Select value={formData.sous_prefecture_id} onValueChange={v => setFormData(f => ({ ...f, sous_prefecture_id: v }))} disabled={!formData.departement_id}><SelectTrigger><SelectValue placeholder="S/Préfecture" /></SelectTrigger><SelectContent>{sousPrefectures.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.nom}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Village</Label><Input value={formData.village} onChange={e => setFormData(f => ({ ...f, village: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Date convention</Label><Input type="date" value={formData.date_convention} onChange={e => setFormData(f => ({ ...f, date_convention: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" type="button" onClick={() => setIsFormOpen(false)}>Annuler</Button>
                    <Button type="submit">Enregistrer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg"><Layers className="h-5 w-5 text-primary" /></div><div><div className="text-2xl font-bold">{parcelles.length}</div><div className="text-xs text-muted-foreground">Parcelles</div></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><MapPin className="h-5 w-5 text-green-600" /></div><div><div className="text-2xl font-bold">{totalSurfaceDispo.toFixed(1)}</div><div className="text-xs text-muted-foreground">ha disponibles</div></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 bg-accent/10 rounded-lg"><BarChart3 className="h-5 w-5 text-accent" /></div><div><div className="text-2xl font-bold">{totalSurfaceAgri.toFixed(1)}</div><div className="text-xs text-muted-foreground">ha AgriCapital</div></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 bg-amber-100 rounded-lg"><Layers className="h-5 w-5 text-amber-600" /></div><div><div className="text-2xl font-bold">{parcelles.filter((p: any) => p.statut === 'disponible').length}</div><div className="text-xs text-muted-foreground">Disponibles</div></div></CardContent></Card>
          </div>

          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" /></div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Propriétaire</TableHead><TableHead>Localisation</TableHead><TableHead>Total</TableHead><TableHead>AgriCapital</TableHead><TableHead>Utilisation</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8">Chargement...</TableCell></TableRow>
                : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8">Aucune parcelle</TableCell></TableRow>
                : filtered.map((p: any) => {
                  const pct = p.surface_agricapital_ha > 0 ? (p.surface_attribuee_ha / p.surface_agricapital_ha * 100) : 0;
                  return <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id_unique}</TableCell>
                    <TableCell>{p.proprietaires_terres?.nom_complet || "-"}</TableCell>
                    <TableCell className="text-xs">{[p.departements?.nom, p.village].filter(Boolean).join(", ") || "-"}</TableCell>
                    <TableCell>{p.surface_totale_ha} ha</TableCell>
                    <TableCell>{p.surface_agricapital_ha} ha</TableCell>
                    <TableCell className="min-w-[100px]"><Progress value={pct} className="h-2" /><span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span></TableCell>
                    <TableCell><Badge className={statutColor(p.statut)}>{statutLabel(p.statut)}</Badge></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default Parcelles;
