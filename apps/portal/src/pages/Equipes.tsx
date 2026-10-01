import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Search, Users, Plus, Edit, MoreHorizontal, CheckCircle, XCircle } from "lucide-react";

const Equipes = () => {
  const [equipes, setEquipes] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEquipe, setSelectedEquipe] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nom: "",
    responsable_id: "",
    region_id: "",
    actif: true,
  });

  const fetchData = async () => {
    try {
      const { data: equipesData, error: equipesError } = await (supabase as any)
        .from("equipes")
        .select(`
          *,
          responsable:profiles!equipes_responsable_id_fkey(nom_complet, telephone),
          region:regions(nom)
        `)
        .order("created_at", { ascending: false });

      const { data: regionsData } = await (supabase as any)
        .from("regions")
        .select("*")
        .order("nom");

      const { data: profilesData } = await (supabase as any)
        .from("profiles")
        .select("id, nom_complet")
        .order("nom_complet");

      if (equipesError) throw equipesError;

      setEquipes(equipesData || []);
      setRegions(regionsData || []);
      setProfiles(profilesData || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtime({ table: "equipes", onChange: fetchData });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (selectedEquipe) {
        const { error } = await (supabase as any)
          .from("equipes")
          .update(formData)
          .eq("id", selectedEquipe.id);

        if (error) throw error;
        toast({ title: "Succès", description: "Équipe modifiée avec succès" });
      } else {
        const { error } = await (supabase as any)
          .from("equipes")
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Succès", description: "Équipe créée avec succès" });
      }

      setIsFormOpen(false);
      setSelectedEquipe(null);
      setFormData({ nom: "", responsable_id: "", region_id: "", actif: true });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const handleEdit = (equipe: any) => {
    setSelectedEquipe(equipe);
    setFormData({
      nom: equipe.nom,
      responsable_id: equipe.responsable_id || "",
      region_id: equipe.region_id || "",
      actif: equipe.actif ?? true,
    });
    setIsFormOpen(true);
  };

  const handleStatusChange = async (equipeId: string, newStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("equipes")
        .update({ actif: newStatus })
        .eq("id", equipeId);

      if (error) throw error;
      toast({
        title: "Succès",
        description: `Équipe ${newStatus ? "activée" : "désactivée"} avec succès`,
      });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const filteredEquipes = equipes.filter((e) =>
    e.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.responsable?.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.region?.nom?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Équipes</h1>
          <p className="text-muted-foreground mt-1">{equipes.length} équipe(s) enregistrée(s)</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setSelectedEquipe(null);
              setFormData({ nom: "", responsable_id: "", region_id: "", actif: true });
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Équipe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedEquipe ? "Modifier l'équipe" : "Nouvelle équipe"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nom">Nom de l'équipe</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="responsable">Responsable</Label>
                <Select
                  value={formData.responsable_id}
                  onValueChange={(value) => setFormData({ ...formData, responsable_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.nom_complet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="region">Région</Label>
                <Select
                  value={formData.region_id}
                  onValueChange={(value) => setFormData({ ...formData, region_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une région" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">
                  {selectedEquipe ? "Modifier" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vue d'ensemble</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{equipes.length}</div>
                <div className="text-sm text-muted-foreground">Équipes Totales</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{equipes.filter(e => e.actif).length}</div>
                <div className="text-sm text-muted-foreground">Équipes Actives</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, responsable ou région..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom de l'Équipe</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Région</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Chargement...</TableCell>
              </TableRow>
            ) : filteredEquipes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Aucune équipe trouvée</TableCell>
              </TableRow>
            ) : (
              filteredEquipes.map((equipe) => (
                <TableRow key={equipe.id}>
                  <TableCell className="font-medium">{equipe.nom}</TableCell>
                  <TableCell>{equipe.responsable?.nom_complet || "Non assigné"}</TableCell>
                  <TableCell>{equipe.responsable?.telephone || "-"}</TableCell>
                  <TableCell>{equipe.region?.nom || "Non assignée"}</TableCell>
                  <TableCell>
                    <Badge className={equipe.actif ? "bg-green-500" : "bg-red-500"}>
                      {equipe.actif ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(equipe)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        {equipe.actif ? (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(equipe.id, false)}
                            className="text-orange-600"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Désactiver
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(equipe.id, true)}
                            className="text-green-600"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Activer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Equipes;
