import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safeError";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, LandPlot, UserRound, CreditCard, Wrench, MapPin } from "lucide-react";

const PlantationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plantation, setPlantation] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [parcelle, setParcelle] = useState<any>(null);
  const [proprietaire, setProprietaire] = useState<any>(null);
  const [attributions, setAttributions] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [rapports, setRapports] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: p, error: pError } = await (supabase as any)
        .from("plantations")
        .select("*, regions(nom), departements(nom), sous_prefectures(nom)")
        .eq("id", id)
        .maybeSingle();
      if (pError) throw pError;
      if (!p) { setPlantation(null); return; }
      setPlantation(p);

      const [clientRes, parcelRes, paymentRes, interventionRes, reportRes] = await Promise.all([
        p.client_id
          ? (supabase as any).from("clients").select("*").eq("id", p.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        p.parcelle_id
          ? (supabase as any).from("parcelles").select("*").eq("id", p.parcelle_id).maybeSingle()
          : Promise.resolve({ data: null }),
        (supabase as any).from("paiements").select("*").eq("plantation_id", id).order("created_at", { ascending: false }),
        (supabase as any).from("interventions_techniques").select("*, agent:profiles!interventions_techniques_agent_technique_id_fkey(nom_complet)").eq("plantation_id", id).order("date_intervention", { ascending: false }),
        (supabase as any).from("rapports_visites_techniques").select("*, agent:profiles!rapports_visites_techniques_agent_technique_id_fkey(nom_complet)").eq("plantation_id", id).order("date_visite", { ascending: false }),
      ]);
      if (clientRes.error) throw clientRes.error;
      if (parcelRes.error) throw parcelRes.error;
      setClient(clientRes.data || null);
      setParcelle(parcelRes.data || null);
      setPaiements(paymentRes.data || []);
      setInterventions(interventionRes.data || []);
      setRapports(reportRes.data || []);

      if (parcelRes.data?.proprietaire_id) {
        const { data: owner, error: ownerError } = await (supabase as any)
          .from("proprietaires_terres").select("*").eq("id", parcelRes.data.proprietaire_id).maybeSingle();
        if (ownerError) throw ownerError;
        setProprietaire(owner || null);
      } else setProprietaire(null);

      if (p.parcelle_id) {
        const { data: attrs, error: attrError } = await (supabase as any)
          .from("beneficiaire_attributions")
          .select("*, clients(id,id_unique,nom_complet,type_client), plantations(id,id_unique,nom_plantation)")
          .eq("parcelle_id", p.parcelle_id)
          .eq("statut", "active")
          .order("created_at", { ascending: true });
        if (attrError) throw attrError;
        setAttributions(attrs || []);
      } else setAttributions([]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const status = plantation?.statut_global || plantation?.statut || "actif";
  const formatMoney = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(Number(value || 0));

  if (loading) return <ProtectedRoute><MainLayout><div className="flex justify-center py-20">Chargement...</div></MainLayout></ProtectedRoute>;
  if (!plantation) return <ProtectedRoute><MainLayout><div className="space-y-4"><Button variant="ghost" onClick={() => navigate("/plantations")}><ArrowLeft className="mr-2 h-4 w-4" />Retour aux plantations</Button><Card><CardContent className="py-10 text-center">Plantation introuvable.</CardContent></Card></div></MainLayout></ProtectedRoute>;

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/plantations")}><ArrowLeft className="mr-2 h-4 w-4" />Retour</Button>
              <div>
                <p className="text-xs font-mono text-muted-foreground">{plantation.id_unique}</p>
                <h1 className="text-2xl sm:text-3xl font-bold">{plantation.nom_plantation || plantation.nom}</h1>
              </div>
            </div>
            <Badge>{status.replaceAll("_", " ")}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Superficie</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(plantation.superficie_ha || 0).toFixed(2)} ha</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Client / dossier</CardTitle></CardHeader><CardContent>{client ? <Link to={`/acquisitions/${client.id}`} className="font-semibold hover:underline">{client.nom_complet}<span className="block text-xs font-mono text-muted-foreground">{client.id_unique}</span></Link> : "—"}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Parcelle</CardTitle></CardHeader><CardContent><div className="font-semibold">{parcelle?.id_unique || "—"}</div><div className="text-xs text-muted-foreground">{parcelle?.village || parcelle?.nom || "Localisation non renseignée"}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paiements</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(paiements.filter(p => p.statut === "valide").reduce((s,p)=>s+Number(p.montant_paye ?? p.montant ?? 0),0))}</div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" />Relation client</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Type : </span>{client?.type_client || "—"}</div>
                <div><span className="text-muted-foreground">Formule : </span>{client?.formule_nom || client?.formule_code || "—"}</div>
                <div><span className="text-muted-foreground">Date de plantation : </span>{plantation.date_plantation ? new Date(plantation.date_plantation).toLocaleDateString("fr-FR") : "—"}</div>
                <div><span className="text-muted-foreground">Nombre de plants : </span>{Number(plantation.nombre_plants || 0).toLocaleString("fr-FR")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><LandPlot className="h-4 w-4" />Foncier / parcelle</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Propriétaire foncier : </span>{proprietaire?.nom_complet || proprietaire?.nom || "—"}</div>
                <div><span className="text-muted-foreground">Village : </span>{parcelle?.village || "—"}</div>
                <div><span className="text-muted-foreground">Surface parcelle : </span>{parcelle?.surface_totale_ha ? `${Number(parcelle.surface_totale_ha).toFixed(2)} ha` : "—"}</div>
                <div><span className="text-muted-foreground">GPS : </span>{plantation.localisation_gps_lat && plantation.localisation_gps_lng ? `${plantation.localisation_gps_lat}, ${plantation.localisation_gps_lng}` : "—"}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><LandPlot className="h-4 w-4" />Personnes rattachées à la même parcelle</CardTitle></CardHeader>
            <CardContent>
              {attributions.length === 0 ? <p className="text-sm text-muted-foreground">Aucune attribution active enregistrée.</p> :
                <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Personne</TableHead><TableHead>Rôle</TableHead><TableHead>Surface attribuée</TableHead><TableHead>Plantation</TableHead></TableRow></TableHeader>
                  <TableBody>{attributions.map((a:any)=><TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.clients?.id_unique}</TableCell>
                    <TableCell>{a.clients?.nom_complet}</TableCell>
                    <TableCell><Badge variant="outline">{a.role_attribution || "—"}</Badge></TableCell>
                    <TableCell>{Number(a.surface_attribuee_ha || 0).toFixed(2)} ha</TableCell>
                    <TableCell className="font-mono text-xs">{a.plantations?.id_unique || "—"}</TableCell>
                  </TableRow>)}</TableBody>
                </Table>}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Paiements</CardTitle></CardHeader><CardContent>
              {paiements.length===0?<p className="text-sm text-muted-foreground">Aucun paiement.</p>:
                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Montant</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{paiements.map((p:any)=><TableRow key={p.id}><TableCell>{new Date(p.created_at).toLocaleDateString("fr-FR")}</TableCell><TableCell>{p.type_paiement || "—"}</TableCell><TableCell>{formatMoney(p.montant_paye ?? p.montant)}</TableCell><TableCell><Badge variant={p.statut==="valide"?"default":"outline"}>{p.statut}</Badge></TableCell></TableRow>)}</TableBody></Table>}
            </CardContent></Card>

            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" />Historique technique</CardTitle></CardHeader><CardContent>
              {interventions.length===0&&rapports.length===0?<p className="text-sm text-muted-foreground">Aucune opération technique enregistrée.</p>:
                <div className="space-y-2">{interventions.slice(0,8).map((i:any)=><div key={i.id} className="border rounded p-2"><div className="flex justify-between"><span className="font-medium">{i.type_intervention}</span><Badge variant="outline">{i.statut}</Badge></div><p className="text-xs text-muted-foreground">{new Date(i.date_intervention).toLocaleDateString("fr-FR")} · {i.agent?.nom_complet || "Équipe technique"}</p><p className="text-sm">{i.observations || "—"}</p></div>)}</div>}
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />Localisation</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {plantation.regions?.nom || plantation.departements?.nom || plantation.village ? <p>{plantation.village || "—"} · {plantation.departements?.nom || "Département —"} · {plantation.regions?.nom || "Région —"}</p> : <p className="text-muted-foreground">Localisation non renseignée.</p>}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default PlantationDetail;
