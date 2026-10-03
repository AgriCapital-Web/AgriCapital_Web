import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { formatUserShortName } from "@/lib/utils";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Camera, ClipboardCheck, AlertTriangle, TrendingUp, MapPin, Plus, Upload, Video, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { offlineInsert } from "@/lib/offlineWrite";
import { uploadOrQueueFile } from "@/lib/offlineFiles";
import TableSearchInput from "@/components/common/TableSearchInput";

const RapportsTechniques = () => {
  const [interventions, setInterventions] = useState<any[]>([]);
  const [plantationOptions, setPlantationOptions] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportForm, setReportForm] = useState({ plantation_id: "", date_visite: new Date().toISOString().slice(0,16), type_visite: "suivi", observations: "", recommandations: "", client_visible: false });
  const [mediaDrafts, setMediaDrafts] = useState<Array<{file: File; client_visible: boolean; description: string}>>([]);
  const [tableSearch, setTableSearch] = useState("");
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
    const { data: plantationsData } = await (supabase as any).from("plantations").select("id,client_id,id_unique,nom_plantation").order("nom_plantation");
    setPlantationOptions(plantationsData || []);

    const { data: interventionsData } = await (supabase as any)
      .from("interventions_techniques")
      .select(`
        *,
        agent_technique:profiles!interventions_techniques_agent_technique_id_fkey(nom_complet),
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

  const saveTechnicalReport = async () => {
    if (!reportForm.plantation_id) {
      toast({ variant: "destructive", title: "Plantation requise" });
      return;
    }
    setReportSaving(true);
    try {
      const plantation = interventions.find((i:any) => i.plantation?.id === reportForm.plantation_id)?.plantation
        || (await supabase.from("plantations").select("id,client_id").eq("id", reportForm.plantation_id).maybeSingle()).data;
      const reportId = crypto.randomUUID();
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").maybeSingle();
      const payload = {
        id: reportId,
        plantation_id: reportForm.plantation_id,
        client_id: plantation?.client_id || null,
        agent_technique_id: profile?.id || null,
        date_visite: new Date(reportForm.date_visite).toISOString(),
        type_visite: reportForm.type_visite,
        observations: reportForm.observations || null,
        recommandations: reportForm.recommandations || null,
        statut: "valide",
        client_visible: reportForm.client_visible,
        created_by: profile?.id || null,
      };
      const { error } = await offlineInsert("rapports_visites_techniques", payload);
      if (error) throw error;

      for (const media of mediaDrafts) {
        const path = `plantations/${reportForm.plantation_id}/rapports/${reportId}/${crypto.randomUUID()}-${media.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const uploaded = await uploadOrQueueFile({ bucket: "rapports-techniques", path, file: media.file });
        const mediaId = crypto.randomUUID();
        await offlineInsert("rapports_visites_medias", {
          id: mediaId, rapport_id: reportId, plantation_id: reportForm.plantation_id,
          media_type: media.file.type.startsWith("video/") ? "video" : "photo",
          storage_path: uploaded.path, mime_type: media.file.type, nom_fichier: media.file.name,
          description: media.description || null, client_visible: media.client_visible, created_by: profile?.id || null,
        });
      }
      toast({ title: navigator.onLine ? "Rapport enregistré" : "Rapport enregistré hors ligne", description: mediaDrafts.length ? `${mediaDrafts.length} média(s) associé(s).` : undefined });
      setReportOpen(false);
      setReportForm({ plantation_id: "", date_visite: new Date().toISOString().slice(0,16), type_visite: "suivi", observations: "", recommandations: "", client_visible: false });
      setMediaDrafts([]);
      fetchData();
    } catch (error:any) {
      toast({ variant: "destructive", title: "Enregistrement impossible", description: error?.message || "Erreur inconnue" });
    } finally { setReportSaving(false); }
  };

  useRealtime({ table: "interventions_techniques", onChange: fetchData });
  useRealtime({ table: "tickets_techniques", onChange: fetchData });

  const filteredInterventions = interventions.filter((row) => JSON.stringify(row).toLowerCase().includes(tableSearch.trim().toLowerCase()));
  const filteredTickets = tickets.filter((row) => JSON.stringify(row).toLowerCase().includes(tableSearch.trim().toLowerCase()));
  const filteredPhotos = photos.filter((row) => JSON.stringify(row).toLowerCase().includes(tableSearch.trim().toLowerCase()));

  const statsCards = [
    { title: "Total Interventions", value: stats.totalInterventions, icon: ClipboardCheck, color: "text-blue-600" },
    { title: "Tickets Ouverts", value: stats.ticketsOuverts, icon: AlertTriangle, color: "text-orange-600" },
    { title: "Tickets Résolus", value: stats.ticketsResolus, icon: FileText, color: "text-green-600" },
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
            <p className="text-muted-foreground mt-1">Suivi des interventions, rapports de visite, tickets et médias terrain</p>
            <Button className="mt-3" onClick={() => setReportOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouveau rapport de visite</Button>
          </div>

          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Rapport de visite technique</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>Plantation *</Label><Select value={reportForm.plantation_id} onValueChange={(v)=>setReportForm(p=>({...p,plantation_id:v}))}><SelectTrigger><SelectValue placeholder="Sélectionner une plantation" /></SelectTrigger><SelectContent>{plantationOptions.map((p:any)=><SelectItem key={p.id} value={p.id}>{p.nom_plantation || p.id_unique || p.id}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Date et heure</Label><Input type="datetime-local" value={reportForm.date_visite} onChange={e=>setReportForm(p=>({...p,date_visite:e.target.value}))}/></div>
                </div>
                <div><Label>Type de visite</Label><Select value={reportForm.type_visite} onValueChange={v=>setReportForm(p=>({...p,type_visite:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="suivi">Suivi</SelectItem><SelectItem value="inspection">Inspection</SelectItem><SelectItem value="traitement">Traitement</SelectItem><SelectItem value="incident">Incident</SelectItem><SelectItem value="mise_en_place">Mise en place</SelectItem></SelectContent></Select></div>
                <div><Label>Observations</Label><Textarea value={reportForm.observations} onChange={e=>setReportForm(p=>({...p,observations:e.target.value}))} rows={5}/></div>
                <div><Label>Recommandations</Label><Textarea value={reportForm.recommandations} onChange={e=>setReportForm(p=>({...p,recommandations:e.target.value}))} rows={4}/></div>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={reportForm.client_visible} onCheckedChange={(v)=>setReportForm(p=>({...p,client_visible:Boolean(v)}))}/>Afficher le rapport texte dans l’espace client</label>
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between"><div><Label>Médias de la visite</Label><p className="text-xs text-muted-foreground">Photos et vidéos, avec visibilité client indépendante pour chaque fichier.</p></div><label className="inline-flex items-center gap-2 cursor-pointer"><Upload className="h-4 w-4"/><span className="text-sm">Ajouter</span><input type="file" className="hidden" accept="image/*,video/*" multiple onChange={e=>setMediaDrafts(p=>[...p,...Array.from(e.target.files||[]).map(file=>({file,client_visible:false,description:""}))])}/></label></div>
                  {mediaDrafts.map((m,i)=><div key={i} className="rounded-lg border p-3 space-y-2"><div className="flex items-center gap-2 text-sm"><span className="truncate flex-1">{m.file.name}</span>{m.file.type.startsWith("video/")?<Video className="h-4 w-4"/>:<Camera className="h-4 w-4"/>}<button type="button" className="text-destructive text-xs" onClick={()=>setMediaDrafts(p=>p.filter((_,idx)=>idx!==i))}>Retirer</button></div><Input placeholder="Description (optionnel)" value={m.description} onChange={e=>setMediaDrafts(p=>p.map((x,idx)=>idx===i?{...x,description:e.target.value}:x))}/><label className="flex items-center gap-2 text-xs"><Checkbox checked={m.client_visible} onCheckedChange={v=>setMediaDrafts(p=>p.map((x,idx)=>idx===i?{...x,client_visible:Boolean(v)}:x))}/><Eye className="h-3 w-3"/>Afficher ce média dans l’espace client</label></div>)}
                </div>
                <Button onClick={saveTechnicalReport} disabled={reportSaving} className="w-full">{reportSaving ? "Enregistrement..." : "Enregistrer le rapport"}</Button>
              </div>
            </DialogContent>
          </Dialog>

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
              
            </TabsList>

            <TabsContent value="interventions" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>Interventions Techniques</CardTitle><TableSearchInput value={tableSearch} onChange={setTableSearch} placeholder="Rechercher une intervention…" /></div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Plantation</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Agent technique</TableHead>
                        <TableHead>Observations</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInterventions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucune intervention enregistrée
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInterventions.map((intervention) => (
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
                            <TableCell>{formatUserShortName(intervention.agent_technique?.nom_complet)}</TableCell>
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>Tickets Techniques</CardTitle><TableSearchInput value={tableSearch} onChange={setTableSearch} placeholder="Rechercher un ticket…" /></div>
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
                      {filteredTickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucun ticket technique
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTickets.map((ticket) => (
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
                            <TableCell>{formatUserShortName(ticket.cree_par?.nom_complet)}</TableCell>
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

            {false && <TabsContent value="photos" className="space-y-4">
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
                      {filteredPhotos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucune photo archivée
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPhotos.map((photo) => (
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
            </TabsContent>}
          </Tabs>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default RapportsTechniques;
