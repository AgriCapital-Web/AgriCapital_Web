import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Plantations from "./pages/Plantations";
import GestionPaiements from "./pages/GestionPaiements";
import RapportsFinanciers from "./pages/RapportsFinanciers";
import RapportsTechniques from "./pages/RapportsTechniques";
import Commissions from "./pages/Commissions";
import Portefeuilles from "./pages/Portefeuilles";
import NouvelleAcquisition from "./pages/NouvelleAcquisition";
import Parametres from "./pages/Parametres";
import Profil from "./pages/Profil";
import HistoriqueComplet from "./pages/HistoriqueComplet";
import AccountRequest from "./pages/AccountRequest";
import Tickets from "./pages/Tickets";
import ProprietairesTerres from "./pages/ProprietairesTerres";
import Parcelles from "./pages/Parcelles";
import Documents from "./pages/Documents";
import Leads from "./pages/Leads";
import SyncQueue from "./pages/SyncQueue";
import PublicLead from "./pages/PublicLead";
import DevCarteApercu from "./pages/__DevCarteApercu";
import VerificationCarte from "./pages/VerificationCarte";
import BeneficiaireParticulier from "./pages/BeneficiaireParticulier";
import TechnicienTerrain from "./pages/TechnicienTerrain";

const LegacyVerificationRedirect = () => {
  const path = window.location.pathname;
  const code = path.split("/").filter(Boolean).pop();
  return <Navigate to={code && code !== "verifier-carte" ? `/verify/${code}` : "/verify"} replace />;
};
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const DomainRouter = () => {
  return (
    <Routes>
      {/* Page d'accueil = Login */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/account-request" element={<AccountRequest />} />

      {/* Formulaire public prospects */}
      <Route path="/leads/public" element={<PublicLead />} />
      <Route path="/prospect" element={<PublicLead />} />

      {/* Vérification publique d'une carte du personnel (QR code) */}
      <Route path="/__dev-carte" element={<DevCarteApercu />} />
      {/* Unique parcours public de scan/vérification : app.agricapital.ci/verify */}
      <Route path="/verify" element={<VerificationCarte />} />
      <Route path="/verify/:code" element={<VerificationCarte />} />
      {/* Compatibilité des anciennes URLs : redirection immédiate vers le parcours officiel. */}
      <Route path="/verifier-carte" element={<Navigate to="/verify" replace />} />
      <Route path="/verifier-carte/:code" element={<LegacyVerificationRedirect />} />

      {/* Protected routes: garde-fou global d'authentification. Les pages conservent leurs contrôles métier propres. */}
      <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/leads" element={<Leads />} />
      <Route path="/synchronisation" element={<SyncQueue />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/client/:id" element={<ClientDetail />} />
      <Route path="/client/:id/historique" element={<HistoriqueComplet />} />
      <Route path="/plantations" element={<Plantations />} />
      <Route path="/proprietaires-terres" element={<ProprietairesTerres />} />
      <Route path="/parcelles" element={<Parcelles />} />
      <Route path="/documents" element={<Documents />} />
      <Route path="/acquisitions" element={<Clients />} />
      <Route path="/acquisitions/nouveau" element={<NouvelleAcquisition />} />
      <Route path="/acquisitions/:id" element={<ClientDetail />} />
      <Route path="/nouvelle-acquisition" element={<Navigate to="/acquisitions/nouveau" replace />} />
      <Route path="/beneficiaire-particulier" element={<BeneficiaireParticulier />} />
      <Route path="/profil" element={<Profil />} />
      
      {/* Paiements */}
      <Route path="/paiements" element={<GestionPaiements />} />
      <Route path="/gestion-paiements" element={<Navigate to="/paiements" replace />} />
      
      {/* Redirections vers Paramètres */}
      <Route path="/utilisateurs" element={<Navigate to="/parametres?tab=utilisateurs" replace />} />
      <Route path="/equipes" element={<Navigate to="/parametres?tab=equipes" replace />} />
      <Route path="/offres" element={<Navigate to="/parametres?tab=offres" replace />} />
      <Route path="/promotions" element={<Navigate to="/parametres?tab=offres" replace />} />
      <Route path="/portefeuille-clients" element={<Navigate to="/clients" replace />} />
      
      <Route path="/account-requests" element={<Navigate to="/parametres?tab=demandes" replace />} />
      
      {/* Rapports */}
      <Route path="/rapports-financiers" element={<RapportsFinanciers />} />
      <Route path="/rapports-techniques" element={<Navigate to="/support" replace />} />
      <Route path="/terrain" element={<TechnicienTerrain />} />
      
      {/* Finances */}
      <Route path="/commissions" element={<Commissions />} />
      <Route path="/portefeuilles" element={<Portefeuilles />} />
      
      {/* Support */}
      <Route path="/support" element={<Tickets />} />
              <Route path="/tickets" element={<Navigate to="/support" replace />} />
      
      {/* Admin */}
      <Route path="/parametres" element={<Parametres />} />
      
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <InstallPrompt />
          <DomainRouter />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
