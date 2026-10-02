import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { PERMISSIONS } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Users, MapPin, Download } from "lucide-react";
import { exportFinancialWorkbook } from "@/utils/financialExcelExport";

const RapportsFinanciers = () => {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [synthese, setSynthese] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // Filtres
  const [filtreRegion, setFiltreRegion] = useState<string>("all");
  const [filtreDepartement, setFiltreDepartement] = useState<string>("all");
  const [filtreEquipe, setFiltreEquipe] = useState<string>("all");
  const [filtreUser, setFiltreUser] = useState<string>("all");
  
  const [stats, setStats] = useState({
    totalCommissions: 0,
    commissionsValidees: 0,
    commissionsPendantes: 0,
    commissionsPayees: 0,
    totalClients: 0,
    totalPlantations: 0,
    totalSuperficie: 0,
  });

  const fetchData = async () => {
    // Fetch all data
    const [commissionsRes, regionsRes, departementsRes, equipesRes, usersRes, clientsRes, plantationsRes, syntheseRes] = await Promise.all([
      (supabase as any).from("commissions").select(`
        *,
        profile:profiles!commissions_profile_id_fkey(id, nom_complet, equipe_id),
        plantation:plantations(id_unique, nom_plantation, region_id, departement_id, client_id)
      `).order("date_calcul", { ascending: false }),
      (supabase as any).from("regions").select("*"),
      (supabase as any).from("departements").select("*"),
      (supabase as any).from("equipes").select("*"),
      (supabase as any).from("profils_annuaire").select("id, nom_complet, equipe_id"),
      (supabase as any).from("clients").select("id"),
      (supabase as any).from("plantations").select("id, superficie_ha, superficie_activee, surface_reellement_plantee"),
      (supabase as any).from("v_client_synthese").select("*").order("avancement_pct", { ascending: false }),
    ]);

    if (commissionsRes.data) setCommissions(commissionsRes.data);
    if (regionsRes.data) setRegions(regionsRes.data);
    if (departementsRes.data) setDepartements(departementsRes.data);
    if (equipesRes.data) setEquipes(equipesRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    if (syntheseRes.data) setSynthese(syntheseRes.data);

    // Calculate stats
    const commissionsData = commissionsRes.data || [];
    const total = commissionsData.filter((c: any) => c.statut !== "annule").reduce((sum: number, c: any) => sum + Number(c.montant_commission || 0), 0);
    const validees = commissionsData.filter((c: any) => c.statut === "validee").reduce((sum: number, c: any) => sum + Number(c.montant_commission || 0), 0);
    const pendantes = commissionsData.filter((c: any) => c.statut === "calculee").reduce((sum: number, c: any) => sum + Number(c.montant_commission || 0), 0);
    const payees = commissionsData.filter((c: any) => c.statut === "payee").reduce((sum: number, c: any) => sum + Number(c.montant_commission || 0), 0);

    setStats({
      totalCommissions: total,
      commissionsValidees: validees,
      commissionsPendantes: pendantes,
      commissionsPayees: payees,
      totalClients: clientsRes.data?.length || 0,
      totalPlantations: plantationsRes.data?.length || 0,
      totalSuperficie: plantationsRes.data?.reduce((sum: number, p: any) => sum + Number(p.surface_reellement_plantee ?? p.superficie_activee ?? p.superficie_ha ?? 0), 0) || 0,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtime({ table: "commissions", onChange: fetchData });
  useRealtime({ table: "clients", onChange: fetchData });
  useRealtime({ table: "paiements", onChange: fetchData });

  const formatMontant = (m: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(m);

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case "payee": return "bg-green-500";
      case "validee": return "bg-blue-500";
      case "calculee": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  // Apply filters
  const filteredCommissions = commissions.filter((c: any) => {
    if (filtreRegion !== "all" && c.plantation?.region_id !== filtreRegion) return false;
    if (filtreDepartement !== "all" && c.plantation?.departement_id !== filtreDepartement) return false;
    if (filtreEquipe !== "all" && c.profile?.equipe_id !== filtreEquipe) return false;
    if (filtreUser !== "all" && c.profile_id !== filtreUser) return false;
    return true;
  });

  const handleExportRapport = () => {
    const date = new Date().toLocaleDateString("fr-FR");
    const commissionsRows = [
      ["RAPPORT FINANCIER — AGRICAPITAL", "", "", "", "", "", "", ""],
      [`Export du ${date} · Données selon les filtres actifs`, "", "", "", "", "", "", ""],
      ...filteredCommissions.map((c: any) => [
        new Date(c.date_calcul).toLocaleDateString("fr-FR"),
        c.profile?.nom_complet || "N/A",
        c.plantation?.id_unique || "N/A",
        c.type_commission?.replaceAll("_", " ") || "—",
        Number(c.montant_base || 0),
        Number(c.taux_commission || 0) / 100,
        Number(c.montant_commission || 0),
        c.statut?.replaceAll("_", " ") || "—",
      ]),
    ];

    const commissionHeaders = ["Date", "Commercial", "Plantation", "Type", "Montant Base", "Taux", "Commission", "Statut"];
    commissionsRows.splice(2, 0, commissionHeaders);
    const commissionData = commissionsRows.slice(0, 2).concat(commissionsRows.slice(3));
    commissionData[2] = commissionHeaders;

    const commercialData = [
      ["COMMISSIONS PAR COMMERCIAL", "", "", ""],
      [`Export du ${date}`, "", "", ""],
      ["Nom", "Équipe", "Nombre de commissions", "Total commissions"],
      ...groupByUser().map((u: any) => [u.nom, u.equipe, Number(u.count), Number(u.total)]),
    ];

    const equipeData = [
      ["COMMISSIONS PAR ÉQUIPE", "", ""],
      [`Export du ${date}`, "", ""],
      ["Équipe", "Nombre de commissions", "Total"],
      ...groupByEquipe().map((e: any) => [e.equipe, Number(e.count), Number(e.total)]),
    ];

    const syntheseData = [
      ["SYNTHÈSE FINANCIÈRE DES CLIENTS", "", "", "", "", "", ""],
      [`Export du ${date}`, "", "", "", "", "", ""],
      ["Client", "Référence", "Phase", "Hectares", "Total contrat", "Payé", "Restant dû", "Avancement"],
      ...synthese.map((r: any) => {
        const contrat = Number(r.montant_total_contrat || 0);
        const paye = Number(r.total_paye || 0);
        return [r.nom_complet || "—", r.id_unique || "—", r.phase_actuelle || "—", Number(r.total_hectares || 0), contrat, paye, Math.max(0, contrat - paye), contrat > 0 ? Math.min(1, paye / contrat) : 0];
      }),
    ];

    const dashboardData = [
      ["TABLEAU DE BORD FINANCIER — AGRICAPITAL", "", "", ""],
      [`Situation au ${date}`, "", "", ""],
      ["Indicateur", "Valeur", "Lecture", ""],
      ["Total commissions", Number(stats.totalCommissions), "Toutes commissions hors annulations", ""],
      ["Commissions validées", Number(stats.commissionsValidees), "Montants validés", ""],
      ["Commissions en attente", Number(stats.commissionsPendantes), "Montants calculés non encore validés", ""],
      ["Commissions payées", Number(stats.commissionsPayees), "Montants effectivement payés", ""],
      ["Clients", Number(stats.totalClients), "Nombre de clients", ""],
      ["Plantations", Number(stats.totalPlantations), "Nombre de plantations", ""],
      ["Superficie totale", Number(stats.totalSuperficie), "Hectares", ""],
    ];

    void exportFinancialWorkbook([
      { name: "Tableau de bord", rows: dashboardData, widths: [30, 22, 48, 4], merges: ["A1:D1", "A2:D2"], freeze: 3, moneyCols: [1] },
      { name: "Commissions", rows: commissionData, widths: [14, 26, 20, 24, 20, 12, 20, 18], merges: ["A1:H1", "A2:H2"], freeze: 3, autoFilter: true, moneyCols: [4, 6], percentCols: [5],
        conditional: [
          { range: `H3:H${commissionData.length}`, formula: '$H3="payee"', style: 0 },
          { range: `H3:H${commissionData.length}`, formula: '$H3="validee"', style: 0 },
          { range: `H3:H${commissionData.length}`, formula: '$H3="calculee"', style: 2 },
        ] },
      { name: "Par commercial", rows: commercialData, widths: [30, 22, 24, 24], merges: ["A1:D1", "A2:D2"], freeze: 3, autoFilter: true, moneyCols: [3] },
      { name: "Par équipe", rows: equipeData, widths: [32, 24, 24], merges: ["A1:C1", "A2:C2"], freeze: 3, autoFilter: true, moneyCols: [2] },
      { name: "Synthèse clients", rows: syntheseData, widths: [30, 20, 22, 14, 22, 22, 22, 16], merges: ["A1:H1", "A2:H2"], freeze: 3, autoFilter: true, moneyCols: [4, 5, 6], percentCols: [7],
        conditional: [
          { range: `H3:H${syntheseData.length}`, formula: "$H3>=1", style: 0 },
          { range: `H3:H${syntheseData.length}`, formula: "$H3<0.5", style: 1 },
          { range: `H3:H${syntheseData.length}`, formula: "AND($H3>=0.5,$H3<1)", style: 2 },
        ] },
    ], `rapport-financier-agricapital-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const statsCards = [
    { title: "Total Commissions", value: formatMontant(stats.totalCommissions), icon: DollarSign, color: "text-green-500" },
    { title: "Validées", value: formatMontant(stats.commissionsValidees), icon: TrendingUp, color: "text-blue-500" },
    { title: "En Attente", value: formatMontant(stats.commissionsPendantes), icon: Users, color: "text-yellow-500" },
    { title: "Payées", value: formatMontant(stats.commissionsPayees), icon: MapPin, color: "text-purple-500" },
    { title: "Total Clients", value: stats.totalClients.toString(), icon: Users, color: "text-primary" },
    { title: "Total Plantations", value: stats.totalPlantations.toString(), icon: MapPin, color: "text-green-600" },
    { title: "Superficie Totale", value: `${stats.totalSuperficie.toFixed(2)} ha`, icon: TrendingUp, color: "text-blue-600" },
  ];

  const groupByUser = () => {
    const grouped: { [key: string]: any } = {};
    commissions.forEach((c: any) => {
      const userId = c.profile_id;
      if (!grouped[userId]) {
        grouped[userId] = {
          nom: c.profile?.nom_complet || "N/A",
          equipe: c.profile?.equipe_id || "N/A",
          total: 0,
          count: 0,
        };
      }
      grouped[userId].total += Number(c.montant_commission);
      grouped[userId].count += 1;
    });
    return Object.values(grouped);
  };

  const groupByEquipe = () => {
    const grouped: { [key: string]: any } = {};
    commissions.forEach((c: any) => {
      const equipe = c.profile?.equipe_id || "Sans équipe";
      if (!grouped[equipe]) {
        grouped[equipe] = { equipe, total: 0, count: 0 };
      }
      grouped[equipe].total += Number(c.montant_commission);
      grouped[equipe].count += 1;
    });
    return Object.values(grouped);
  };

  return (
    <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_RAPPORTS_FINANCIERS}>
      <MainLayout>
        <div className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold">Rapports financiers</h1>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((card, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Filtres</CardTitle>
                <Button onClick={handleExportRapport} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Exporter Rapport
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Région</label>
                  <Select value={filtreRegion} onValueChange={setFiltreRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes les régions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les régions</SelectItem>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Département</label>
                  <Select value={filtreDepartement} onValueChange={setFiltreDepartement}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les départements" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les départements</SelectItem>
                      {departements.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Équipe</label>
                  <Select value={filtreEquipe} onValueChange={setFiltreEquipe}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes les équipes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les équipes</SelectItem>
                      {equipes.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Commercial</label>
                  <Select value={filtreUser} onValueChange={setFiltreUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les commerciaux" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les commerciaux</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nom_complet}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="liste" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="liste">Liste des commissions</TabsTrigger>
              <TabsTrigger value="par-commercial">Par commercial</TabsTrigger>
              <TabsTrigger value="par-equipe">Par équipe</TabsTrigger>
              <TabsTrigger value="synthese">Synthèse clients</TabsTrigger>
            </TabsList>

            <TabsContent value="liste" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Toutes les Commissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto"><Table className="responsive-data-table" className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Commercial</TableHead>
                        <TableHead>Plantation</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Montant Base</TableHead>
                        <TableHead>Taux</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommissions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            Aucune commission trouvée
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCommissions.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell>{new Date(c.date_calcul).toLocaleDateString("fr-FR")}</TableCell>
                            <TableCell>{c.profile?.nom_complet || "N/A"}</TableCell>
                            <TableCell>{c.plantation?.id_unique || "N/A"}</TableCell>
                            <TableCell className="capitalize">{c.type_commission?.replace("_", " ")}</TableCell>
                            <TableCell>{formatMontant(c.montant_base)}</TableCell>
                            <TableCell>{c.taux_commission}%</TableCell>
                            <TableCell className="font-semibold">{formatMontant(c.montant_commission)}</TableCell>
                            <TableCell>
                              <Badge className={getStatutColor(c.statut)}>
                                {c.statut?.replace("_", " ")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="par-commercial" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Commissions par Commercial</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto"><Table className="min-w-[620px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Équipe</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Total Commissions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupByUser().map((u: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{u.nom}</TableCell>
                          <TableCell>{u.equipe}</TableCell>
                          <TableCell>{u.count}</TableCell>
                          <TableCell className="font-semibold">{formatMontant(u.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="par-equipe" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Commissions par Équipe</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto"><Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Équipe</TableHead>
                        <TableHead>Nombre de Commissions</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupByEquipe().map((e: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{e.equipe}</TableCell>
                          <TableCell>{e.count}</TableCell>
                          <TableCell className="font-semibold">{formatMontant(e.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="synthese" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Synthèse clients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto"><Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Hectares</TableHead>
                        <TableHead>Total contrat</TableHead>
                        <TableHead>Payé</TableHead>
                        <TableHead>Restant dû</TableHead>
                        <TableHead>Avancement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {synthese.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8">Aucune donnée</TableCell></TableRow>
                      ) : synthese.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.nom_complet}</div>
                            <div className="text-xs text-muted-foreground">{r.id_unique}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.phase_actuelle || '—'}</Badge>
                          </TableCell>
                          <TableCell>{Number(r.total_hectares || 0).toFixed(2)}</TableCell>
                          <TableCell>{formatMontant(Number(r.montant_total_contrat || 0))}</TableCell>
                          <TableCell className="text-green-600 font-medium">{formatMontant(Number(r.total_paye || 0))}</TableCell>
                          <TableCell className="text-amber-600 font-medium">{formatMontant(Math.max(0, Number(r.montant_total_contrat || 0) - Number(r.total_paye || 0)))}</TableCell>
                          <TableCell>
                            <Badge className="bg-primary">{(Number(r.montant_total_contrat || 0) > 0 ? Math.min(100, Number(r.total_paye || 0) / Number(r.montant_total_contrat || 0) * 100) : 0).toFixed(1)}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table></div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default RapportsFinanciers;
