import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";
import { hasPermission, PERMISSIONS, ROLE_SHORT_LABELS } from "@/lib/roles";
import { useRealtime } from "@/hooks/useRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlantationsMap } from "@/components/dashboard/PlantationsMap";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Sprout, 
  TrendingUp, 
  CreditCard, 
  AlertCircle,
  MapPin,
  Calendar,
  TrendingDown,
  Bell,
  Award,
  DollarSign,
  FileText,
  Plus,
  FileCheck,
  Wallet
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

const Dashboard = () => {
  const { profile, userRoles } = useAuth();
  const profilePhotoUrl = useSignedUrl('photos-profils', profile?.photo_url);

  // Client (user) : redirection vers son espace personnel
  const isClientOnly =
    userRoles.length > 0 && userRoles.every((r) => r === "user");

  // Définition des actions rapides selon les permissions
  const canCreateAcquisition = hasPermission(userRoles, PERMISSIONS.CREATE_ACQUISITION);
  const canViewPaiements = hasPermission(userRoles, PERMISSIONS.VIEW_PAIEMENTS);
  const canViewPlantations = hasPermission(userRoles, PERMISSIONS.VIEW_PLANTATIONS);
  const canValidateDocuments = hasPermission(userRoles, PERMISSIONS.VALIDATE_PAYMENTS);

  const [connectionTime] = useState(new Date().toLocaleTimeString("fr-FR"));
  const [stats, setStats] = useState({
    totalClients: 0,
    totalPlantations: 0,
    totalSuperficie: 0,
    totalPaiements: 0,
    paiementsEnAttente: 0,
    plantationsEnProduction: 0,
    evolutionClients: 0,
    evolutionPlantations: 0,
    tauxProduction: 0,
  });

  const [recentClients, setRecentClients] = useState<any[]>([]);
  const [recentPaiements, setRecentPaiements] = useState<any[]>([]);
  const [statsParRegion, setStatsParRegion] = useState<any[]>([]);
  const [evolutionMensuelle, setEvolutionMensuelle] = useState<any[]>([]);
  const [alertes, setAlertes] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [docsEnAttente, setDocsEnAttente] = useState(0);
  const [acquisitionsEnAttente, setAcquisitionsEnAttente] = useState(0);
  const [synthese, setSynthese] = useState<any[]>([]);
  const [syntheseAgg, setSyntheseAgg] = useState({
    contratsActifs: 0,
    enInstallation: 0,
    enProduction: 0,
    joursRestantsMoy: 0,
    echeancesRetardTotal: 0,
    restantDuTotal: 0,
    avancementMoy: 0,
  });

  const fetchStats = async () => {
    try {
      // Vue de synthèse — cycle 28 ans
      const { data: syn } = await (supabase as any)
        .from("v_client_synthese")
        .select("*");
      if (syn && syn.length) {
        setSynthese(syn);
        const actifs = syn.filter((r: any) => r.compte_actif);
        setSyntheseAgg({
          contratsActifs: actifs.length,
          enInstallation: actifs.filter((r: any) => r.phase_actuelle === "installation").length,
          enProduction: actifs.filter((r: any) => r.phase_actuelle === "production").length,
          joursRestantsMoy: actifs.length ? Math.round(actifs.reduce((s: number, r: any) => s + (r.jours_restants || 0), 0) / actifs.length) : 0,
          echeancesRetardTotal: syn.reduce((s: number, r: any) => s + Number(r.echeances_en_retard || 0), 0),
          restantDuTotal: syn.reduce((s: number, r: any) => s + Number(r.restant_du || 0), 0),
          avancementMoy: actifs.length ? Math.round(actifs.reduce((s: number, r: any) => s + Number(r.avancement_pct || 0), 0) / actifs.length) : 0,
        });
      }

      // Stats globales
      const { count: clientsCount } = await (supabase as any)
        .from("clients")
        .select("*", { count: "exact", head: true });

      const { data: plantations } = await (supabase as any)
        .from("plantations")
        .select("superficie_ha, statut_global, created_at, region_id");

      const totalSuperficie = plantations?.reduce((sum, p) => sum + (p.superficie_ha || 0), 0) || 0;
      const plantationsEnProduction = plantations?.filter((p) => p.statut_global === "en_production").length || 0;
      const tauxProduction = plantations?.length ? ((plantationsEnProduction / plantations.length) * 100).toFixed(1) : 0;

      // Évolution mois précédent
      const dateDebutMois = new Date();
      dateDebutMois.setDate(1);
      dateDebutMois.setHours(0, 0, 0, 0);

      const plantationsCeMois = plantations?.filter(p => 
        new Date(p.created_at) >= dateDebutMois
      ).length || 0;

      const { data: paiements } = await (supabase as any)
        .from("paiements")
        .select("montant, statut, created_at, plantation_id, plantations(clients(nom_complet))");
      
      const totalPaiements = paiements?.filter((p) => p.statut === "valide")
        .reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
      
      const paiementsEnAttenteCount = paiements?.filter((p) => p.statut === "en_attente").length || 0;
      const montantEnAttente = paiements?.filter((p) => p.statut === "en_attente")
        .reduce((sum, p) => sum + (p.montant || 0), 0) || 0;

      // Clients récents
      const { data: clients } = await (supabase as any)
        .from("clients")
        .select("id_unique, nom_complet, created_at, statut_global, nombre_plantations")
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentClients(clients || []);

      // Paiements récents
      const paiementsRecents = paiements?.slice(0, 5).map((p: any) => ({
        ...p,
        client_nom: p.plantations?.clients?.nom_complet || "N/A"
      })) || [];
      setRecentPaiements(paiementsRecents);

      // Stats par département
      const { data: departements } = await (supabase as any)
        .from("departements")
        .select("id, nom");

      const statsDepartements = await Promise.all(
        (departements || []).map(async (dept: any) => {
          const { count } = await (supabase as any)
            .from("plantations")
            .select("*", { count: "exact", head: true })
            .eq("departement_id", dept.id);
          
          return {
            name: dept.nom,
            value: count || 0
          };
        })
      );

      setStatsParRegion(statsDepartements.filter(s => s.value > 0).slice(0, 6));

      // Évolution mensuelle (6 derniers mois)
      const mois = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const moisNom = date.toLocaleDateString('fr-FR', { month: 'short' });
        
        const debutMois = new Date(date.getFullYear(), date.getMonth(), 1);
        const finMois = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const plantatsMois = plantations?.filter(p => {
          const d = new Date(p.created_at);
          return d >= debutMois && d <= finMois;
        }).length || 0;

        const paiementsMois = paiements?.filter((p: any) => {
          const d = new Date(p.created_at);
          return d >= debutMois && d <= finMois && p.statut === "valide";
        }).reduce((sum, p) => sum + (p.montant || 0), 0) || 0;

        mois.push({
          mois: moisNom,
          plantations: plantatsMois,
          paiements: paiementsMois / 1000000 // En millions
        });
      }

      setEvolutionMensuelle(mois);

      // Alertes
      const alertesArray = [];
      if (paiementsEnAttenteCount > 0) {
        alertesArray.push({
          type: "warning",
          message: `${paiementsEnAttenteCount} paiement(s) en attente - ${formatMontant(montantEnAttente)}`,
          date: new Date()
        });
      }

      const { data: plantationsAlerte } = await (supabase as any)
        .from("plantations")
        .select("*")
        .or("alerte_non_paiement.eq.true,alerte_visite_retard.eq.true");

      if (plantationsAlerte && plantationsAlerte.length > 0) {
        alertesArray.push({
          type: "error",
          message: `${plantationsAlerte.length} plantation(s) nécessitent votre attention`,
          date: new Date()
        });
      }

      setAlertes(alertesArray);

      // Top clients
      const { data: topClientsData } = await (supabase as any)
        .from("clients")
        .select("nom_complet, nombre_plantations, total_hectares")
        .order("total_hectares", { ascending: false })
        .limit(5);

      setTopClients(topClientsData || []);

      // Documents en attente
      const { count: docsCount } = await (supabase as any)
        .from("documents_acquisition")
        .select("*", { count: "exact", head: true })
        .eq("statut", "en_attente");
      setDocsEnAttente(docsCount || 0);

      // Acquisitions en attente
      const { count: subsCount } = await (supabase as any)
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("statut", "en_attente");
      setAcquisitionsEnAttente(subsCount || 0);

      setStats({
        totalClients: clientsCount || 0,
        totalPlantations: plantations?.length || 0,
        totalSuperficie,
        totalPaiements,
        paiementsEnAttente: paiementsEnAttenteCount,
        plantationsEnProduction,
        evolutionClients: plantationsCeMois > 0 ? 12 : 0,
        evolutionPlantations: plantationsCeMois,
        tauxProduction: Number(tauxProduction),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => { fetchStats(); }, []);
  useRealtime({ table: "clients", onChange: fetchStats });
  useRealtime({ table: "plantations", onChange: fetchStats });
  useRealtime({ table: "paiements", onChange: fetchStats });

  const formatMontant = (m: number) => 
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(m);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d'];

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* Header avec photo de profil */}
          <div className="bg-gradient-to-r from-primary to-primary/80 p-4 sm:p-6 rounded-lg shadow-lg">
            <div className="flex items-center gap-4">
              {/* Photo de profil avec bordure bicolore */}
              <div className="relative">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full p-0.5 bg-gradient-to-br from-amber-400 via-transparent to-primary">
                  <div className="h-full w-full rounded-full overflow-hidden bg-background">
                    {profilePhotoUrl ? (
                      <img 
                        src={profilePhotoUrl} 
                        alt={profile.nom_complet || 'Photo profil'} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-primary/20 text-primary-foreground text-xl font-bold">
                        {profile?.nom_complet?.split(' ').map(n => n[0]).join('').slice(0,2) || 'AG'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary-foreground">
                  Bienvenue, <span className="text-accent font-extrabold">{profile?.nom_complet || "Utilisateur"}</span>
                </h1>
                <p className="text-primary-foreground/90 mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-semibold">
                    {userRoles.map(r => ROLE_SHORT_LABELS[r] || r).join(' / ')}
                  </span>
                  <span className="flex items-center gap-1">
                    📞 {profile?.telephone || 'Non renseigné'}
                  </span>
                  <span className="hidden sm:inline text-primary-foreground/70">•</span>
                  <span>Connecté à {connectionTime}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {isClientOnly && (
              <>
                <Button asChild variant="default" className="h-auto py-4 flex-col gap-2">
                  <Link to="/profil">
                    <Users className="h-5 w-5" />
                    <span className="text-xs sm:text-sm">Mon profil</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Link to="/paiements">
                    <CreditCard className="h-5 w-5" />
                    <span className="text-xs sm:text-sm">Mes paiements</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Link to="/plantations">
                    <Sprout className="h-5 w-5" />
                    <span className="text-xs sm:text-sm">Ma plantation</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Link to="/documents">
                    <FileCheck className="h-5 w-5" />
                    <span className="text-xs sm:text-sm">Mes documents</span>
                  </Link>
                </Button>
              </>
            )}
            {!isClientOnly && (
            <>
            {canCreateAcquisition && (
              <Button asChild variant="default" className="h-auto py-4 flex-col gap-2">
                <Link to="/nouvelle-acquisition">
                  <Plus className="h-5 w-5" />
                  <span className="text-xs sm:text-sm">Nouvelle acquisition</span>
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2 border-primary/40">
              <Link to="/leads?new=1">
                <Plus className="h-5 w-5" />
                <span className="text-xs sm:text-sm">Nouveau lead</span>
              </Link>
            </Button>
            {canViewPaiements && (
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to="/paiements">
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs sm:text-sm">Saisir un paiement</span>
                </Link>
              </Button>
            )}
            {canValidateDocuments && (
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to="/documents">
                  <FileCheck className="h-5 w-5" />
                  <span className="text-xs sm:text-sm">Valider documents</span>
                </Link>
              </Button>
            )}
            {canViewPlantations && (
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to="/plantations">
                  <Sprout className="h-5 w-5" />
                  <span className="text-xs sm:text-sm">Plantations</span>
                </Link>
              </Button>
            )}
            </>
            )}
          </div>

          {/* Cartes d'état */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Acquisitions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl font-bold">{stats.totalClients}</div>
                    <p className="text-xs text-muted-foreground">{acquisitionsEnAttente} en attente</p>
                  </div>
                  <Link to="/acquisitions" className="text-xs text-primary hover:underline">Voir →</Link>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-600" /> Paiements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl font-bold">{formatMontant(stats.totalPaiements)}</div>
                    <p className="text-xs text-muted-foreground">{stats.paiementsEnAttente} à valider</p>
                  </div>
                  <Link to="/paiements" className="text-xs text-primary hover:underline">Voir →</Link>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-emerald-600" /> Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl font-bold">{docsEnAttente}</div>
                    <p className="text-xs text-muted-foreground">à vérifier</p>
                  </div>
                  <Link to="/documents" className="text-xs text-primary hover:underline">Voir →</Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Synthèse cycle 28 ans — v_client_synthese */}
          {synthese.length > 0 && !isClientOnly && (
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Synthèse contrats — Cycle 28 ans (3 ans installation + 25 ans production)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xl font-bold">{syntheseAgg.contratsActifs}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Contrats actifs</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xl font-bold text-blue-600">{syntheseAgg.enInstallation}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Installation (36 mois)</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xl font-bold text-green-600">{syntheseAgg.enProduction}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Production (25 ans)</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xl font-bold">{syntheseAgg.joursRestantsMoy.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Jours restants (moy.)</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xl font-bold text-amber-600">{syntheseAgg.avancementMoy}%</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Avancement moy.</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xl font-bold text-red-600">{syntheseAgg.echeancesRetardTotal}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Échéances en retard</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-sm font-bold">{formatMontant(syntheseAgg.restantDuTotal)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Reste à percevoir</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPIs adaptés au rôle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <Card className="hover-scale cursor-pointer transition-all hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Clients
                </CardTitle>
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{stats.totalClients}</div>
                {stats.evolutionClients > 0 && (
                  <div className="flex items-center gap-1 mt-1 sm:mt-2 text-green-600">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm font-medium">+{stats.evolutionClients}%</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="hover-scale cursor-pointer transition-all hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Plantations
                </CardTitle>
                <Sprout className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{stats.totalPlantations}</div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                  {stats.totalSuperficie.toFixed(1)} ha
                </p>
              </CardContent>
            </Card>

            <Card className="hover-scale cursor-pointer transition-all hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Production
                </CardTitle>
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{stats.plantationsEnProduction}</div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                  {stats.tauxProduction}%
                </p>
              </CardContent>
            </Card>

            <Card className="hover-scale cursor-pointer transition-all hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Paiements
                </CardTitle>
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold">{formatMontant(stats.totalPaiements)}</div>
                {stats.paiementsEnAttente > 0 && (
                  <p className="text-xs sm:text-sm text-orange-600 mt-1 sm:mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    {stats.paiementsEnAttente} attente
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* KPIs par zone pour RCom/CE/Commercial */}
          <RoleDashboard />

          {/* Carte Interactive des Plantations */}
          <PlantationsMap />

          {/* 2️⃣ ANALYSE GRAPHIQUE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Évolution mensuelle */}
          <Card>
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Évolution sur 6 mois
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 lg:p-6">
              <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px] lg:!h-[300px]">
                <AreaChart data={evolutionMensuelle}>
                  <defs>
                    <linearGradient id="colorPlantations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mois" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="plantations" 
                    name="Plantations" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorPlantations)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

            {/* Répartition par département */}
            <Card>
              <CardHeader className="p-3 sm:p-4 lg:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Répartition par Département
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 sm:p-4 lg:p-6">
                <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px] lg:!h-[300px]">
                  <PieChart>
                    <Pie
                      data={statsParRegion}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name?.slice(0,6) || ''} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statsParRegion.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Progression paiements */}
            <Card className="lg:col-span-2">
              <CardHeader className="p-3 sm:p-4 lg:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <span className="hidden sm:inline">Évolution des Paiements (en millions XOF)</span>
                  <span className="sm:hidden">Paiements (M XOF)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 sm:p-4 lg:p-6">
                <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px] lg:!h-[300px]">
                  <LineChart data={evolutionMensuelle}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="paiements" 
                      name="Paiements" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 3️⃣ TABLEAUX DÉTAILLÉS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Clients récents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Clients Récents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Plantations</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentClients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Aucun client
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentClients.map((p) => (
                          <TableRow key={p.id_unique}>
                            <TableCell className="font-mono text-xs">{p.id_unique}</TableCell>
                            <TableCell>{p.nom_complet}</TableCell>
                            <TableCell>{p.nombre_plantations || 0}</TableCell>
                            <TableCell>
                              <Badge variant={p.statut_global === 'actif' ? 'default' : 'secondary'}>
                                {p.statut_global}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Paiements récents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Paiements Récents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPaiements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Aucun paiement
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentPaiements.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{p.client_nom}</TableCell>
                            <TableCell>{formatMontant(p.montant_paye || 0)}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  p.statut === 'valide' ? 'default' : 
                                  p.statut === 'en_attente' ? 'secondary' : 
                                  'destructive'
                                }
                              >
                                {p.statut}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4️⃣ ALERTES & 5️⃣ PERFORMANCE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Alertes */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-500" />
                  Alertes & Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alertes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune alerte pour le moment
                    </p>
                  ) : (
                    alertes.map((alerte, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-lg border ${
                          alerte.type === 'error' ? 'border-destructive bg-destructive/10' :
                          alerte.type === 'warning' ? 'border-orange-500 bg-orange-500/10' :
                          'border-primary bg-primary/10'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className={`h-4 w-4 mt-0.5 ${
                            alerte.type === 'error' ? 'text-destructive' :
                            alerte.type === 'warning' ? 'text-orange-500' :
                            'text-primary'
                          }`} />
                          <p className="text-sm">{alerte.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Top Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                      Top 5 Clients (par superficie)
                    </h4>
                    <div className="space-y-2">
                      {topClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucune donnée disponible
                        </p>
                      ) : (
                        topClients.map((client, i) => (
                          <div 
                            key={i}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                                i === 0 ? 'bg-yellow-500/20 text-yellow-700' :
                                i === 1 ? 'bg-gray-400/20 text-gray-700' :
                                i === 2 ? 'bg-orange-500/20 text-orange-700' :
                                'bg-primary/20 text-primary'
                              }`}>
                                <span className="text-sm font-bold">#{i + 1}</span>
                              </div>
                              <span className="font-medium">{client.nom_complet}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold">{client.total_hectares?.toFixed(1) || 0} ha</div>
                              <div className="text-xs text-muted-foreground">
                                {client.nombre_plantations || 0} plantation(s)
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default Dashboard;
