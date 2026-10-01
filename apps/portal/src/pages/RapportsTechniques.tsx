import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Camera, ClipboardCheck, AlertTriangle, TrendingUp, MapPin } from "lucide-react";

const RapportsTechniques = () => {
  const [interventions, setInterventions] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalInterventions: 0,
    interventionsEnCours: 0,
    ticketsOuverts: 0,
    ticketsResolus: 0,
    photosTotal: 0,
    tauxReussite: 0,
  });

  const fetchData = async () => {
    // Fetch interventions techniques
    const { data: interventionsData } = await (supabase as any)
      .from("interventions_techniques")
      .select(`
        *,
        technicien:profiles!interventions_techniques_technicien_id_fkey(nom_complet),
        plantation:plantations(id_unique, nom_plantation)
      `)
      .order("date_intervention", { ascending: false });

    // Fetch tickets
    const { data: ticketsData } = await (supabase as any)
      .from("tickets_techniques")
      .select(`
        *,
        plantation:plantations(id_unique, nom_plantation),
        cree_par:profiles!tickets_techniques_cree_par_fkey(nom_complet)
      `)
      .order("created_at", { ascending: false });

    // Fetch photos
    const { data: photosData } = await (supabase as any)
      .from("photos_plantation")
      .select(`
        *,
        plantation:plantations(id_unique, nom_plantation)
      `)
      .order("date_prise", { ascending: false });

    if (interventionsData) {
      setInterventions(interventionsData);
      const total = interventionsData.length;
      const enCours = interventionsData.filter((i: any) => i.type_intervention === "suivi_mensuel").length;
      
      setStats(prev => ({
        ...prev,
        totalInterventions: total,
        interventionsEnCours: enCours,
      }));
    }

    if (ticketsData) {
      setTickets(ticketsData);
      const ouverts = ticketsData.filter((t: any) => t.statut !== "ferme" && t.statut !== "resolu").length;
      const resolus = ticketsData.filter((t: any) => t.statut === "resolu").length;
      
      setStats(prev => ({
        ...prev,
        ticketsOuverts: ouverts,
        ticketsResolus: resolus,
        tauxReussite: ticketsData.length > 0 ? Math.round((resolus / ticketsData.length) * 100) : 0,
      }));
    }

    if (photosData) {
      setPhotos(photosData);
      setStats(prev => ({
        ...prev,
        photosTotal: photosData.length,
      }));
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtime({ table: "interventions_techniques", onChange: fetchData });
  useRealtime({ table: "tickets_techniques", onChange: fetchData });
  useRealtime({ table: "photos_plantation", onChange: fetchData });

  const statsCards = [
    { title: "Total Interventions", value: stats.totalInterventions, icon: ClipboardCheck, color: "text-blue-600" },
    { title: "Tickets Ouverts", value: stats.ticketsOuverts, icon: AlertTriangle, color: "text-orange-600" },
    { title: "Tickets Résolus", value: stats.ticketsResolus, icon: FileText, color: "text-green-600" },
    { title: "Photos Archivées", value: stats.photosTotal, icon: Camera, color: "text-purple-600" },
  ];

  const getTypeColor = (type: string) => {
    const colors: any = {
      suivi_mensuel: "bg-blue-500",
      traitement_phyto: "bg-green-500",
      incident: "bg-red-500",
      evaluation: "bg-purple-500",
    };
    return colors[type] || "bg-gray-500";
  };

  const getPrioriteColor = (priorite: string) => {
    const colors: any = {
      urgente: "bg-red-500",
      haute: "bg-orange-500",
      moyenne: "bg-yellow-500",
      basse: "bg-blue-500",
    };
    return colors[priorite] || "bg-gray-500";
  };

  const getStatutTicket = (statut: string) => {
    const colors: any = {
      ouvert: "bg-blue-500",
      en_cours: "bg-yellow-500",
      resolu: "bg-green-500",
      ferme: "bg-gray-500",
    };
    return colors[statut] || "bg-gray-500";
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Rapports Technico-Commerciaux</h1>
            <p className="text-muted-foreground mt-1">
              Suivi des interventions, tickets et documentation photographique
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="interventions" className="space-y-6">
            <TabsList>
              <TabsTrigger value="interventions">Interventions</TabsTrigger>
              <TabsTrigger value="tickets">Tickets Techniques</TabsTrigger>
              <TabsTrigger value="photos">Photos Plantations</TabsTrigger>
            </TabsList>

            <TabsContent value="interventions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Interventions Techniques</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Plantation</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Technicien</TableHead>
                        <TableHead>Observations</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {interventions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucune intervention enregistrée
                          </TableCell>
                        </TableRow>
                      ) : (
                        interventions.map((intervention) => (
                          <TableRow key={intervention.id}>
                            <TableCell>
                              {new Date(intervention.date_intervention).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{intervention.plantation?.nom_plantation}</div>
                              <div className="text-xs text-muted-foreground">
                                {intervention.plantation?.id_unique}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getTypeColor(intervention.type_intervention)}>
                                {intervention.type_intervention?.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>{intervention.technicien?.nom_complet}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {intervention.observations || "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tickets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tickets Techniques</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Plantation</TableHead>
                        <TableHead>Priorité</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Créé par</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucun ticket technique
                          </TableCell>
                        </TableRow>
                      ) : (
                        tickets.map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell>
                              {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{ticket.plantation?.nom_plantation}</div>
                              <div className="text-xs text-muted-foreground">
                                {ticket.plantation?.id_unique}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPrioriteColor(ticket.priorite)}>
                                {ticket.priorite}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatutTicket(ticket.statut)}>
                                {ticket.statut?.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>{ticket.cree_par?.nom_complet}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {ticket.description}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photos" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Documentation Photographique</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Plantation</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {photos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucune photo archivée
                          </TableCell>
                        </TableRow>
                      ) : (
                        photos.map((photo) => (
                          <TableRow key={photo.id}>
                            <TableCell>
                              {new Date(photo.date_prise).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{photo.plantation?.nom_plantation}</div>
                              <div className="text-xs text-muted-foreground">
                                {photo.plantation?.id_unique}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{photo.phase}</Badge>
                            </TableCell>
                            <TableCell>{photo.type_photo}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {photo.description || "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <Camera className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default RapportsTechniques;
