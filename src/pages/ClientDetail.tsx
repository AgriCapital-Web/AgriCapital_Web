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
import { ArrowLeft, Sprout, DollarSign, FileText, Settings, Camera, LandPlot, UserRound, ExternalLink } from "lucide-react";
import TicketForm from "@/components/forms/TicketForm";
import { getSafeErrorMessage } from "@/lib/safeError";
import { resolveStorageUrl } from "@/utils/storage";

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [plantations, setPlantations] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [parcelle, setParcelle] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [attributions, setAttributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTicketOpen, setIsTicketOpen] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch client
      const { data: clientData, error: clientError } = await (supabase as any)
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      if (clientData.parcelle_id) {
        const { data: parcelleData } = await (supabase as any)
          .from("parcelles")
          .select("*, proprietaires_terres(*)")
          .eq("id", clientData.parcelle_id)
          .maybeSingle();
        setParcelle(parcelleData || null);
      }

      const { data: docsData } = await (supabase as any)
        .from("beneficiaire_documents")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: true });

      const docsWithUrls = await Promise.all((docsData || []).map(async (doc: any) => ({
        ...doc,
        displayUrl: doc.fichier_url && doc.storage_bucket
          ? await resolveStorageUrl(doc.storage_bucket, doc.storage_path || doc.fichier_url)
          : null,
      })));
      setDocuments(docsWithUrls);

      const { data: attributionsData } = await (supabase as any)
        .from("beneficiaire_attributions")
        .select("*, parcelles(id_unique,nom,village), plantations(id_unique,nom_plantation,superficie_ha,statut_global)")
        .eq("client_id", id)
        .eq("statut", "active")
        .order("created_at", { ascending: true });
      setAttributions(attributionsData || []);

      // Une plantation appartient toujours à un client/dossier.
      // La parcelle peut, elle, rattacher plusieurs personnes/dossiers.
      const { data: plantationsData, error: plantationsError } = await (supabase as any)
        .from("plantations")
        .select(`
          *,
          regions (nom),
          departements (nom)
        `)
        .eq("client_id", id);

      if (plantationsError) throw plantationsError;

      const allPlantations = plantationsData || [];
      setPlantations(allPlantations);

      // Fetch paiements
      const plantationIds = allPlantations.map((p: any) => p.id);
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
            agent_technique:profiles!interventions_techniques_agent_technique_id_fkey(nom_complet)
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
        description: getSafeErrorMessage(error),
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

  if (!client) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <p>Client non trouvé</p>
            <Button onClick={() => navigate("/acquisitions")}>
              Retour aux acquisitions
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
                onClick={() => navigate("/acquisitions")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{client.nom_complet}</h1>
                <p className="text-muted-foreground">{client.id_unique}</p>
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
                <p className="text-lg font-semibold">{client.telephone}</p>
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
                  {client.total_hectares?.toFixed(2) || 0} ha
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
                <Badge className={getStatutBadge(client.statut_global)}>
                  {client.statut_global}
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
              {client.type_client === "beneficiaire_particulier" && (
                <TabsTrigger value="dossier">
                  <LandPlot className="h-4 w-4 mr-2" />
                  Dossier
                </TabsTrigger>
              )}
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
                        <TableHead>Agent technique</TableHead>
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
                            <TableCell>{intervention.agent_technique?.nom_complet}</TableCell>
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

            <TabsContent value="dossier">
              <div className="grid gap-4">
                <Card>
                  <CardHeader><CardTitle>Attributions agricoles</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcelle</TableHead>
                          <TableHead>Rôle</TableHead>
                          <TableHead>Quote-part</TableHead>
                          <TableHead>Plantation liée</TableHead>
                          <TableHead>Référence acte</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attributions.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-8">Aucune attribution enregistrée</TableCell></TableRow>
                        ) : attributions.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell>{a.parcelles?.id_unique || a.parcelles?.nom || "—"}{a.parcelles?.village ? <span className="block text-xs text-muted-foreground">{a.parcelles.village}</span> : null}</TableCell>
                            <TableCell><Badge variant="outline">{a.role_attribution === "proprietaire_beneficiaire" ? "Propriétaire + bénéficiaire" : "Bénéficiaire particulier"}</Badge></TableCell>
                            <TableCell className="font-semibold">{Number(a.surface_attribuee_ha || 0).toFixed(2)} ha</TableCell>
                            <TableCell>{a.plantations?.nom_plantation || a.plantations?.id_unique || "—"}</TableCell>
                            <TableCell>{a.reference_acte || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Propriétaire foncier</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="font-semibold">{parcelle?.proprietaires_terres?.nom_complet || "À compléter"}</p>
                      <p className="text-sm text-muted-foreground">Statut foncier : {parcelle?.proprietaires_terres?.statut_foncier || "—"}</p>
                      <p className="text-sm text-muted-foreground">Téléphone : {parcelle?.proprietaires_terres?.telephone || "À compléter"}</p>
                      <p className="text-sm text-muted-foreground">Documents et photo du propriétaire : à compléter depuis sa fiche.</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><LandPlot className="h-5 w-5" /> Parcelle</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="font-mono text-sm">{parcelle?.code_parc || parcelle?.id_unique || "—"}</p>
                      <p><span className="font-medium">{Number(parcelle?.surface_totale_ha || 0).toFixed(2)} ha</span> · {parcelle?.village || "—"}</p>
                      <p className="text-sm text-muted-foreground">Mode : {parcelle?.mode_surface === "actif_agricole" ? "Actif agricole" : "Foncier"}</p>
                      <p className="text-sm text-muted-foreground">Plan, GPS et annexes foncières : à compléter ultérieurement.</p>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Documents du dossier</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {documents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Aucun document enregistré.</p>
                        ) : documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                            <div>
                              <p className="font-medium">{doc.libelle}</p>
                              <p className="text-xs text-muted-foreground">{doc.categorie} · {doc.statut}</p>
                            </div>
                            {doc.displayUrl ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={doc.displayUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-4 w-4 mr-2" /> Ouvrir
                                </a>
                              </Button>
                            ) : (
                              <Badge variant="outline">À ajouter</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
          {id && <ActivityLog entityType="client" entityId={id} showAddNote={true} />}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default ClientDetail;
