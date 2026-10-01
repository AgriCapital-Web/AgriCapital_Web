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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Users, MapPin, Download, Filter } from "lucide-react";

const RapportsFinanciers = () => {
  const [commissions, setCommissions] = useState<any[]>([]);
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
    totalPlanteurs: 0,
    totalPlantations: 0,
    totalSuperficie: 0,
  });

  const fetchData = async () => {
    // Fetch all data
    const [commissionsRes, regionsRes, departementsRes, equipesRes, usersRes, planteursRes, plantationsRes] = await Promise.all([
      (supabase as any).from("commissions").select(`
        *,
        profile:profiles!commissions_profile_id_fkey(id, nom_complet, equipe_id),
        plantation:plantations(id_unique, nom_plantation, region_id, departement_id, souscripteur_id)
      `).order("date_calcul", { ascending: false }),
      (supabase as any).from("regions").select("*"),
      (supabase as any).from("departements").select("*"),
      (supabase as any).from("equipes").select("*"),
      (supabase as any).from("profiles").select("id, nom_complet, equipe_id"),
      (supabase as any).from("souscripteurs").select("id"),
      (supabase as any).from("plantations").select("id, superficie_ha"),
    ]);

    if (commissionsRes.data) setCommissions(commissionsRes.data);
    if (regionsRes.data) setRegions(regionsRes.data);
    if (departementsRes.data) setDepartements(departementsRes.data);
    if (equipesRes.data) setEquipes(equipesRes.data);
    if (usersRes.data) setUsers(usersRes.data);

    // Calculate stats
    const commissionsData = commissionsRes.data || [];
    const total = commissionsData.reduce((sum: number, c: any) => sum + Number(c.montant_commission), 0);
    const validees = commissionsData.filter((c: any) => c.statut === "valide").reduce((sum: number, c: any) => sum + Number(c.montant_commission), 0);
    const pendantes = commissionsData.filter((c: any) => c.statut === "en_attente").reduce((sum: number, c: any) => sum + Number(c.montant_commission), 0);
    const payees = commissionsData.filter((c: any) => c.statut === "paye").reduce((sum: number, c: any) => sum + Number(c.montant_commission), 0);

    setStats({
      totalCommissions: total,
      commissionsValidees: validees,
      commissionsPendantes: pendantes,
      commissionsPayees: payees,
      totalPlanteurs: planteursRes.data?.length || 0,
      totalPlantations: plantationsRes.data?.length || 0,
      totalSuperficie: plantationsRes.data?.reduce((sum: number, p: any) => sum + Number(p.superficie_ha || 0), 0) || 0,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtime({ table: "commissions", onChange: fetchData });

  const formatMontant = (m: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(m);

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case "paye": return "bg-green-500";
      case "valide": return "bg-blue-500";
      case "en_attente": return "bg-yellow-500";
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
    const csvContent = [
      ["Date", "Commercial", "Plantation", "Type", "Montant Base", "Taux", "Commission", "Statut"],
      ...filteredCommissions.map((c: any) => [
        new Date(c.date_calcul).toLocaleDateString("fr-FR"),
        c.profile?.nom_complet || "N/A",
        c.plantation?.id_unique || "N/A",
        c.type_commission?.replace("_", " "),
        c.montant_base,
        c.taux_commission + "%",
        c.montant_commission,
        c.statut?.replace("_", " "),
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-financier-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const statsCards = [
    { title: "Total Commissions", value: formatMontant(stats.totalCommissions), icon: DollarSign, color: "text-green-500" },
    { title: "Validées", value: formatMontant(stats.commissionsValidees), icon: TrendingUp, color: "text-blue-500" },
    { title: "En Attente", value: formatMontant(stats.commissionsPendantes), icon: Users, color: "text-yellow-500" },
    { title: "Payées", value: formatMontant(stats.commissionsPayees), icon: MapPin, color: "text-purple-500" },
    { title: "Total Planteurs", value: stats.totalPlanteurs.toString(), icon: Users, color: "text-primary" },
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
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Rapports Financiers</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <label className="text-sm font-medium">Technico-commercial</label>
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
            <TabsList>
              <TabsTrigger value="liste">Liste des Commissions</TabsTrigger>
              <TabsTrigger value="par-commercial">Par Commercial</TabsTrigger>
              <TabsTrigger value="par-equipe">Par Équipe</TabsTrigger>
            </TabsList>

            <TabsContent value="liste" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Toutes les Commissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
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
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="par-commercial" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Commissions par Commercial</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
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
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="par-equipe" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Commissions par Équipe</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
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

export default RapportsFinanciers;
