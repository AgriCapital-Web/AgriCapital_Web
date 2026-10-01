import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ActivityLog } from "@/components/common/ActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Sprout, DollarSign, FileText, Settings, Camera } from "lucide-react";
import TicketForm from "@/components/forms/TicketForm";

const PlanteurDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [planteur, setPlanteur] = useState<any>(null);
  const [plantations, setPlantations] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTicketOpen, setIsTicketOpen] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch planteur
      const { data: planteurData, error: planteurError } = await (supabase as any)
        .from("souscripteurs")
        .select("*")
        .eq("id", id)
        .single();

      if (planteurError) throw planteurError;
      setPlanteur(planteurData);

      // Fetch plantations
      const { data: plantationsData, error: plantationsError } = await (supabase as any)
        .from("plantations")
        .select(`
          *,
          regions (nom),
          departements (nom)
        `)
        .eq("souscripteur_id", id);

      if (plantationsError) throw plantationsError;
      setPlantations(plantationsData || []);

      // Fetch paiements
      const plantationIds = plantationsData?.map((p: any) => p.id) || [];
      if (plantationIds.length > 0) {
        const { data: paiementsData } = await (supabase as any)
          .from("paiements")
          .select("*")
          .in("plantation_id", plantationIds)
          .order("created_at", { ascending: false });

        setPaiements(paiementsData || []);

        // Fetch interventions
        const { data: interventionsData } = await (supabase as any)
          .from("interventions_techniques")
          .select(`
            *,
            technicien:profiles!interventions_techniques_technicien_id_fkey(nom_complet)
          `)
          .in("plantation_id", plantationIds)
          .order("date_intervention", { ascending: false });

        setInterventions(interventionsData || []);

        // Fetch photos
        const { data: photosData } = await (supabase as any)
          .from("photos_plantation")
          .select("*")
          .in("plantation_id", plantationIds)
          .order("date_prise", { ascending: false });

        setPhotos(photosData || []);
      }
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
    if (id) {
      fetchData();
    }
  }, [id]);

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
    }).format(montant);
  };

  const getStatutBadge = (statut: string) => {
    const colors: any = {
      en_attente_da: "bg-yellow-500",
      da_valide: "bg-blue-500",
      en_cours: "bg-purple-500",
      en_production: "bg-green-500",
      en_attente: "bg-yellow-500",
      valide: "bg-green-500",
      rejete: "bg-red-500",
    };
    return colors[statut] || "bg-gray-500";
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="flex items-center justify-center h-96">
            <p>Chargement...</p>
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  if (!planteur) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <p>Planteur non trouvé</p>
            <Button onClick={() => navigate("/portefeuille-clients")}>
              Retour au portefeuille
            </Button>
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/portefeuille-clients")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{planteur.nom_complet}</h1>
                <p className="text-muted-foreground">{planteur.id_unique}</p>
              </div>
            </div>
            <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Settings className="mr-2 h-4 w-4" />
                  Gestion Technique
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Créer un ticket technique</DialogTitle>
                </DialogHeader>
                <TicketForm
                  plantationId={plantations[0]?.id}
                  onSuccess={() => {
                    setIsTicketOpen(false);
                    fetchData();
                  }}
                  onCancel={() => setIsTicketOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Téléphone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{planteur.telephone}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Plantations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{plantations.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Superficie Totale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {planteur.total_hectares?.toFixed(2) || 0} ha
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Statut
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getStatutBadge(planteur.statut_global)}>
                  {planteur.statut_global}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="plantations" className="space-y-4">
            <TabsList>
              <TabsTrigger value="plantations">
                <Sprout className="h-4 w-4 mr-2" />
                Plantations
              </TabsTrigger>
              <TabsTrigger value="paiements">
                <DollarSign className="h-4 w-4 mr-2" />
                Paiements
              </TabsTrigger>
              <TabsTrigger value="interventions">
                <FileText className="h-4 w-4 mr-2" />
                Interventions
              </TabsTrigger>
              <TabsTrigger value="photos">
                <Camera className="h-4 w-4 mr-2" />
                Photos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="plantations">
              <Card>
                <CardHeader>
                  <CardTitle>Plantations</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Unique</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Région</TableHead>
                        <TableHead>Superficie</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plantations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            Aucune plantation
                          </TableCell>
                        </TableRow>
                      ) : (
                        plantations.map((plantation) => (
                          <TableRow key={plantation.id}>
                            <TableCell className="font-mono">{plantation.id_unique}</TableCell>
                            <TableCell>{plantation.nom_plantation}</TableCell>
                            <TableCell>{plantation.regions?.nom}</TableCell>
                            <TableCell>{plantation.superficie_ha} ha</TableCell>
                            <TableCell>
                              <Badge className={getStatutBadge(plantation.statut_global)}>
                                {plantation.statut_global}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="paiements">
              <Card>
                <CardHeader>
                  <CardTitle>Historique des Paiements</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paiements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            Aucun paiement
                          </TableCell>
                        </TableRow>
                      ) : (
                        paiements.map((paiement) => (
                          <TableRow key={paiement.id}>
                            <TableCell>
                              {new Date(paiement.created_at).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell>{paiement.type_paiement}</TableCell>
                            <TableCell className="font-semibold">
                              {formatMontant(paiement.montant_theorique)}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatutBadge(paiement.statut)}>
                                {paiement.statut}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="interventions">
              <Card>
                <CardHeader>
                  <CardTitle>Interventions Techniques</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Technicien</TableHead>
                        <TableHead>Observations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {interventions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            Aucune intervention
                          </TableCell>
                        </TableRow>
                      ) : (
                        interventions.map((intervention) => (
                          <TableRow key={intervention.id}>
                            <TableCell>
                              {new Date(intervention.date_intervention).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell>{intervention.type_intervention}</TableCell>
                            <TableCell>{intervention.technicien?.nom_complet}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {intervention.observations}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photos">
              <Card>
                <CardHeader>
                  <CardTitle>Photos de Plantation</CardTitle>
                </CardHeader>
                <CardContent>
                  {photos.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Aucune photo disponible
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {photos.map((photo) => (
                        <div key={photo.id} className="space-y-2">
                          <img
                            src={photo.url}
                            alt={photo.description || "Photo plantation"}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                          <p className="text-xs text-muted-foreground">
                            {new Date(photo.date_prise).toLocaleDateString("fr-FR")}
                          </p>
                          <p className="text-xs">{photo.type_photo}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Traçabilité et historique */}
          {id && <ActivityLog entityType="souscripteur" entityId={id} showAddNote={true} />}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default PlanteurDetail;
