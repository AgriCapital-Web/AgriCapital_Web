import { useState, useEffect, lazy, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Plus, 
  MapPin, 
  Sprout, 
  Eye, 
  Edit,
  Loader2,
  User
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

const InteractiveMap = lazy(() => import("@/components/maps/InteractiveMap"));

const Parcelles = () => {
  const [parcelles, setParcelles] = useState<any[]>([]);
  const [souscripteurs, setSouscripteurs] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [sousPrefectures, setSousPrefectures] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedParcelle, setSelectedParcelle] = useState<any>(null);
  const [souscripteurSearch, setSouscripteurSearch] = useState("");
  const [souscripteurOpen, setSouscripteurOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    souscripteur_id: "",
    district_id: "",
    region_id: "",
    departement_id: "",
    sous_prefecture_id: "",
    village_nom: "",
    superficie_ha: "",
    latitude: null as number | null,
    longitude: null as number | null,
    nom_plantation: "",
    type_culture: "Palmier à huile",
    variete: "Tenera",
    document_foncier_type: "",
    document_foncier_numero: "",
  });
  
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const { data: parcellesData, error } = await supabase
        .from("plantations")
        .select(`
          *,
          souscripteurs (id, nom_complet, telephone, id_unique),
          regions (nom),
          departements (nom),
          districts (nom),
          sous_prefectures (nom)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setParcelles(parcellesData || []);
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

  const fetchSouscripteurs = async () => {
    const { data } = await supabase
      .from("souscripteurs")
      .select("id, nom_complet, telephone, id_unique")
      .order("nom_complet");
    if (data) setSouscripteurs(data);
  };

  const fetchDistricts = async () => {
    const { data } = await supabase
      .from("districts")
      .select("*")
      .eq("est_actif", true)
      .order("nom");
    if (data) setDistricts(data);
  };

  useEffect(() => {
    fetchData();
    fetchSouscripteurs();
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (formData.district_id) {
      const fetchRegions = async () => {
        const { data } = await supabase
          .from("regions")
          .select("*")
          .eq("district_id", formData.district_id)
          .eq("est_active", true)
          .order("nom");
        if (data) setRegions(data);
      };
      fetchRegions();
    } else {
      setRegions([]);
    }
  }, [formData.district_id]);

  useEffect(() => {
    if (formData.region_id) {
      const fetchDepartements = async () => {
        const { data } = await supabase
          .from("departements")
          .select("*")
          .eq("region_id", formData.region_id)
          .eq("est_actif", true)
          .order("nom");
        if (data) setDepartements(data);
      };
      fetchDepartements();
    } else {
      setDepartements([]);
    }
  }, [formData.region_id]);

  useEffect(() => {
    if (formData.departement_id) {
      const fetchSousPrefectures = async () => {
        const { data } = await supabase
          .from("sous_prefectures")
          .select("*")
          .eq("departement_id", formData.departement_id)
          .eq("est_active", true)
          .order("nom");
        if (data) setSousPrefectures(data);
      };
      fetchSousPrefectures();
    } else {
      setSousPrefectures([]);
    }
  }, [formData.departement_id]);

  const filteredParcelles = parcelles.filter((p) =>
    p.souscripteurs?.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.souscripteurs?.telephone?.includes(searchTerm) ||
    p.souscripteurs?.id_unique?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.village_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id_unique?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSouscripteurs = souscripteurs.filter((s) =>
    s.nom_complet?.toLowerCase().includes(souscripteurSearch.toLowerCase()) ||
    s.telephone?.includes(souscripteurSearch) ||
    s.id_unique?.toLowerCase().includes(souscripteurSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.souscripteur_id || !formData.superficie_ha) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
      return;
    }

    try {
      const parcelleData = {
        souscripteur_id: formData.souscripteur_id,
        district_id: formData.district_id || null,
        region_id: formData.region_id || null,
        departement_id: formData.departement_id || null,
        sous_prefecture_id: formData.sous_prefecture_id || null,
        village_nom: formData.village_nom || null,
        superficie_ha: parseFloat(formData.superficie_ha),
        latitude: formData.latitude,
        longitude: formData.longitude,
        nom_plantation: formData.nom_plantation || null,
        type_culture: formData.type_culture,
        variete: formData.variete,
        document_foncier_type: formData.document_foncier_type || null,
        document_foncier_numero: formData.document_foncier_numero || null,
        nombre_plants: Math.round(parseFloat(formData.superficie_ha) * 143),
      };

      if (selectedParcelle) {
        const { error } = await supabase
          .from("plantations")
          .update(parcelleData)
          .eq("id", selectedParcelle.id);
        if (error) throw error;
        toast({ title: "Succès", description: "Parcelle mise à jour" });
      } else {
        const { error } = await supabase
          .from("plantations")
          .insert([parcelleData]);
        if (error) throw error;
        toast({ title: "Succès", description: "Parcelle ajoutée" });
      }

      setIsFormOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      souscripteur_id: "",
      district_id: "",
      region_id: "",
      departement_id: "",
      sous_prefecture_id: "",
      village_nom: "",
      superficie_ha: "",
      latitude: null,
      longitude: null,
      nom_plantation: "",
      type_culture: "Palmier à huile",
      variete: "Tenera",
      document_foncier_type: "",
      document_foncier_numero: "",
    });
    setSelectedParcelle(null);
    setRegions([]);
    setDepartements([]);
    setSousPrefectures([]);
  };

  const openEditForm = (parcelle: any) => {
    setSelectedParcelle(parcelle);
    setFormData({
      souscripteur_id: parcelle.souscripteur_id,
      district_id: parcelle.district_id || "",
      region_id: parcelle.region_id || "",
      departement_id: parcelle.departement_id || "",
      sous_prefecture_id: parcelle.sous_prefecture_id || "",
      village_nom: parcelle.village_nom || "",
      superficie_ha: parcelle.superficie_ha?.toString() || "",
      latitude: parcelle.latitude,
      longitude: parcelle.longitude,
      nom_plantation: parcelle.nom_plantation || "",
      type_culture: parcelle.type_culture || "Palmier à huile",
      variete: parcelle.variete || "Tenera",
      document_foncier_type: parcelle.document_foncier_type || "",
      document_foncier_numero: parcelle.document_foncier_numero || "",
    });
    setIsFormOpen(true);
  };

  const stats = {
    total: parcelles.length,
    superficie: parcelles.reduce((sum, p) => sum + (p.superficie_ha || 0), 0),
    geolocalisees: parcelles.filter(p => p.latitude && p.longitude).length,
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Gestion des Parcelles</h1>
              <p className="text-muted-foreground mt-1">
                {parcelles.length} parcelle(s) enregistrée(s)
              </p>
            </div>
            <Button 
              onClick={() => { resetForm(); setIsFormOpen(true); }}
              className="bg-primary hover:bg-primary-hover"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Parcelle
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Parcelles
                </CardTitle>
                <Sprout className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Superficie Totale
                </CardTitle>
                <MapPin className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.superficie.toFixed(2)} ha</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Géolocalisées
                </CardTitle>
                <MapPin className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.geolocalisees}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par souscripteur, téléphone, village..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Souscripteur</TableHead>
                  <TableHead>Village</TableHead>
                  <TableHead>Superficie</TableHead>
                  <TableHead>Plants</TableHead>
                  <TableHead>GPS</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredParcelles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Aucune parcelle trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParcelles.map((parcelle) => (
                    <TableRow key={parcelle.id}>
                      <TableCell className="font-mono text-sm">
                        {parcelle.id_unique || parcelle.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{parcelle.souscripteurs?.nom_complet}</p>
                          <p className="text-xs text-muted-foreground">{parcelle.souscripteurs?.telephone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {parcelle.village_nom || parcelle.sous_prefectures?.nom || '-'}
                      </TableCell>
                      <TableCell>
                        {parcelle.superficie_ha?.toFixed(2)} ha
                      </TableCell>
                      <TableCell>
                        {parcelle.nombre_plants || Math.round((parcelle.superficie_ha || 0) * 143)}
                      </TableCell>
                      <TableCell>
                        {parcelle.latitude && parcelle.longitude ? (
                          <Badge variant="outline" className="text-green-600">
                            <MapPin className="h-3 w-3 mr-1" />
                            Oui
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            Non
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          parcelle.statut_global === 'en_production' ? 'bg-green-500' :
                          parcelle.statut_global === 'actif' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }>
                          {parcelle.statut_global || 'en_attente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(parcelle.created_at), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditForm(parcelle)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedParcelle ? "Modifier la Parcelle" : "Nouvelle Parcelle"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Sélection du souscripteur */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Souscripteur *
                  </CardTitle>
                  <CardDescription>
                    Sélectionnez le souscripteur à associer à cette parcelle
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Popover open={souscripteurOpen} onOpenChange={setSouscripteurOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={souscripteurOpen}
                        className="w-full justify-between"
                      >
                        {formData.souscripteur_id
                          ? souscripteurs.find((s) => s.id === formData.souscripteur_id)?.nom_complet
                          : "Rechercher un souscripteur..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Rechercher par nom, téléphone, ID..." 
                          value={souscripteurSearch}
                          onValueChange={setSouscripteurSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Aucun souscripteur trouvé.</CommandEmpty>
                          <CommandGroup>
                            {filteredSouscripteurs.slice(0, 20).map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.id}
                                onSelect={() => {
                                  setFormData({ ...formData, souscripteur_id: s.id });
                                  setSouscripteurOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.souscripteur_id === s.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div>
                                  <p className="font-medium">{s.nom_complet}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {s.id_unique} • {s.telephone}
                                  </p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </CardContent>
              </Card>

              {/* Localisation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Localisation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>District *</Label>
                      <Select
                        value={formData.district_id}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          district_id: value, 
                          region_id: "", 
                          departement_id: "", 
                          sous_prefecture_id: "" 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {districts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Région *</Label>
                      <Select
                        value={formData.region_id}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          region_id: value, 
                          departement_id: "", 
                          sous_prefecture_id: "" 
                        })}
                        disabled={!formData.district_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Département</Label>
                      <Select
                        value={formData.departement_id}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          departement_id: value, 
                          sous_prefecture_id: "" 
                        })}
                        disabled={!formData.region_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {departements.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Sous-préfecture</Label>
                      <Select
                        value={formData.sous_prefecture_id}
                        onValueChange={(value) => setFormData({ ...formData, sous_prefecture_id: value })}
                        disabled={!formData.departement_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {sousPrefectures.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nom du village</Label>
                    <Input
                      value={formData.village_nom}
                      onChange={(e) => setFormData({ ...formData, village_nom: e.target.value })}
                      placeholder="Ex: Vorouho"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Parcelle details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sprout className="h-5 w-5" />
                    Détails de la parcelle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom de la plantation</Label>
                      <Input
                        value={formData.nom_plantation}
                        onChange={(e) => setFormData({ ...formData, nom_plantation: e.target.value })}
                        placeholder="Ex: Plantation Vorouho 1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Superficie (ha) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.superficie_ha}
                        onChange={(e) => setFormData({ ...formData, superficie_ha: e.target.value })}
                        placeholder="Ex: 2.5"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Type de culture</Label>
                      <Select
                        value={formData.type_culture}
                        onValueChange={(value) => setFormData({ ...formData, type_culture: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Palmier à huile">Palmier à huile</SelectItem>
                          <SelectItem value="Hévéa">Hévéa</SelectItem>
                          <SelectItem value="Cacao">Cacao</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Variété</Label>
                      <Select
                        value={formData.variete}
                        onValueChange={(value) => setFormData({ ...formData, variete: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Tenera">Tenera</SelectItem>
                          <SelectItem value="Dura">Dura</SelectItem>
                          <SelectItem value="Pisifera">Pisifera</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.superficie_ha && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <p className="text-sm">
                        <strong>Estimation:</strong> {Math.round(parseFloat(formData.superficie_ha) * 143)} plants
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* GPS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Coordonnées GPS
                  </CardTitle>
                  <CardDescription>
                    Cliquez sur la carte pour positionner la parcelle
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={
                    <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-lg">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  }>
                    <InteractiveMap
                      mode="pick"
                      height="300px"
                      onPositionChange={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })}
                      position={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : null}
                    />
                  </Suspense>
                  
                  {formData.latitude && formData.longitude && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                      <strong>Position:</strong> {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Document foncier */}
              <Card>
                <CardHeader>
                  <CardTitle>Document foncier (optionnel)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type de document</Label>
                      <Select
                        value={formData.document_foncier_type}
                        onValueChange={(value) => setFormData({ ...formData, document_foncier_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="certificat_foncier">Certificat foncier</SelectItem>
                          <SelectItem value="titre_foncier">Titre foncier</SelectItem>
                          <SelectItem value="contrat_metayage">Contrat métayage</SelectItem>
                          <SelectItem value="autorisation">Autorisation d'exploiter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Numéro du document</Label>
                      <Input
                        value={formData.document_foncier_numero}
                        onChange={(e) => setFormData({ ...formData, document_foncier_numero: e.target.value })}
                        placeholder="Ex: CF-2025-001"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-primary">
                  {selectedParcelle ? "Mettre à jour" : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default Parcelles;