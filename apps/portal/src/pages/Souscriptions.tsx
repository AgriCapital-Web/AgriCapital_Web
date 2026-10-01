import { useState, useEffect } from "react";
import { logActivity } from "@/utils/traceability";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, FileText, Eye, CheckCircle, Clock, MoreVertical, Edit, Archive, Ban, Trash2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import PlanteurForm from "@/components/forms/PlanteurForm";

const Souscriptions = () => {
  const [souscripteurs, setSouscripteurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSouscripteur, setSelectedSouscripteur] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [souscripteurToDelete, setSouscripteurToDelete] = useState<any>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const { data: sousData, error: sousError } = await supabase
        .from("souscripteurs")
        .select(`
          *,
          offres (nom, couleur),
          regions (nom),
          plantations (id, superficie_ha)
        `)
        .order("created_at", { ascending: false });

      if (sousError) throw sousError;

      // Calculer les totaux
      const enrichedData = (sousData || []).map((s: any) => ({
        ...s,
        nombre_plantations: s.plantations?.length || 0,
        total_hectares: s.plantations?.reduce((sum: number, p: any) => sum + Number(p.superficie_ha || 0), 0) || 0,
      }));

      setSouscripteurs(enrichedData);
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

  useEffect(() => {
    fetchData();
  }, []);

  useRealtime({ table: "souscripteurs", onChange: fetchData });
  useRealtime({ table: "plantations", onChange: fetchData });

  const filteredSouscripteurs = souscripteurs.filter((s) =>
    s.id_unique?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.telephone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const souscripteur = souscripteurs.find(s => s.id === id);
      const { error } = await supabase
        .from("souscripteurs")
        .update({ statut: newStatus, statut_global: newStatus })
        .eq("id", id);

      if (error) throw error;

      await logActivity({
        tableName: 'souscripteurs',
        recordId: id,
        action: 'STATUS_CHANGE',
        details: `Statut changé de "${souscripteur?.statut}" à "${newStatus}"`,
        ancienValeurs: { statut: souscripteur?.statut },
        nouvellesValeurs: { statut: newStatus },
      });

      toast({
        title: "Succès",
        description: `Statut mis à jour: ${newStatus}`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  const handleDelete = async () => {
    if (!souscripteurToDelete) return;
    try {
      const { error } = await supabase
        .from("souscripteurs")
        .delete()
        .eq("id", souscripteurToDelete.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Souscripteur supprimé",
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setSouscripteurToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedSouscripteur(null);
    fetchData();
  };

  const getStatutBadge = (statut: string) => {
    const colors: Record<string, string> = {
      actif: "bg-green-500",
      inactif: "bg-gray-500",
      suspendu: "bg-orange-500",
      archive: "bg-slate-500",
      radie: "bg-red-500",
    };
    return colors[statut] || "bg-gray-500";
  };

  const stats = {
    total: souscripteurs.length,
    actifs: souscripteurs.filter(s => s.statut === "actif" || s.statut_global === "actif").length,
    inactifs: souscripteurs.filter(s => s.statut === "inactif" || s.statut === "suspendu" || s.statut === "archive").length,
    totalHectares: souscripteurs.reduce((sum, s) => sum + Number(s.total_hectares || 0), 0),
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Gestion des Souscriptions</h1>
              <p className="text-muted-foreground mt-1">
                {souscripteurs.length} souscripteur(s) enregistré(s)
              </p>
            </div>
            <Link to="/nouvelle-souscription">
              <Button className="bg-primary hover:bg-primary-hover">
                <FileText className="mr-2 h-4 w-4" />
                Nouvelle Souscription
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Souscripteurs
                </CardTitle>
                <FileText className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Actifs
                </CardTitle>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.actifs}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Inactifs/Suspendus
                </CardTitle>
                <Clock className="h-5 w-5 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.inactifs}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Hectares
                </CardTitle>
                <FileText className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalHectares.toFixed(2)} ha</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par ID, nom, téléphone..."
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
                  <TableHead>ID Unique</TableHead>
                  <TableHead>Nom Complet</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Offre</TableHead>
                  <TableHead>Plantations</TableHead>
                  <TableHead>Hectares</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredSouscripteurs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Aucune souscription trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSouscripteurs.map((souscripteur) => (
                    <TableRow key={souscripteur.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {souscripteur.id_unique}
                      </TableCell>
                      <TableCell className="font-medium">
                        {souscripteur.nom_complet || `${souscripteur.nom} ${souscripteur.prenoms || ''}`}
                      </TableCell>
                      <TableCell>{souscripteur.telephone}</TableCell>
                      <TableCell>
                        {souscripteur.offres && (
                          <Badge style={{ backgroundColor: souscripteur.offres.couleur }}>
                            {souscripteur.offres.nom}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {souscripteur.nombre_plantations || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {Number(souscripteur.total_hectares || 0).toFixed(2)} ha
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatutBadge(souscripteur.statut || souscripteur.statut_global)}>
                          {souscripteur.statut || souscripteur.statut_global || 'actif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(souscripteur.created_at), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link to={`/planteur/${souscripteur.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedSouscripteur(souscripteur);
                                setIsFormOpen(true);
                              }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {souscripteur.statut !== 'actif' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(souscripteur.id, 'actif')}>
                                  <RotateCcw className="mr-2 h-4 w-4 text-green-500" />
                                  Activer
                                </DropdownMenuItem>
                              )}
                              {souscripteur.statut !== 'suspendu' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(souscripteur.id, 'suspendu')}>
                                  <Ban className="mr-2 h-4 w-4 text-orange-500" />
                                  Suspendre
                                </DropdownMenuItem>
                              )}
                              {souscripteur.statut !== 'archive' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(souscripteur.id, 'archive')}>
                                  <Archive className="mr-2 h-4 w-4 text-slate-500" />
                                  Archiver
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  setSouscripteurToDelete(souscripteur);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Dialog de modification */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedSouscripteur ? "Modifier" : "Nouveau"} Souscripteur
              </DialogTitle>
            </DialogHeader>
            <PlanteurForm
              planteur={selectedSouscripteur}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setIsFormOpen(false);
                setSelectedSouscripteur(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation de suppression */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer le souscripteur "{souscripteurToDelete?.nom_complet || souscripteurToDelete?.nom}"? 
                Cette action est irréversible et supprimera également toutes les plantations associées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default Souscriptions;