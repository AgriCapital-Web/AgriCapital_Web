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
import Souscriptions from "./pages/Souscriptions";
import PlanteurDetail from "./pages/PlanteurDetail";
import Plantations from "./pages/Plantations";
import GestionPaiements from "./pages/GestionPaiements";
import RapportsFinanciers from "./pages/RapportsFinanciers";
import RapportsTechniques from "./pages/RapportsTechniques";
import Commissions from "./pages/Commissions";
import Portefeuilles from "./pages/Portefeuilles";
import NouvelleSouscription from "./pages/NouvelleSouscription";
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
import AgriPlan from "./pages/AgriPlan";
import DevCarteApercu from "./pages/__DevCarteApercu";
import VerificationCarte from "./pages/VerificationCarte";

const LegacyVerificationRedirect = () => {
  const path = window.location.pathname;
  const code = path.split("/").filter(Boolean).pop();
  return <Navigate to={code && code !== "verifier-carte" ? `/verify/${code}` : "/verify"} replace />;
};
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const queryClient = new QueryClient();

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
      <Route path="/souscriptions" element={<Souscriptions />} />
      <Route path="/planteur/:id" element={<PlanteurDetail />} />
      <Route path="/planteur/:id/historique" element={<HistoriqueComplet />} />
      <Route path="/plantations" element={<Plantations />} />
      <Route path="/agriplan" element={<AgriPlan />} />
      <Route path="/agriplant" element={<Navigate to="/agriplan" replace />} />
      <Route path="/proprietaires-terres" element={<ProprietairesTerres />} />
      <Route path="/parcelles" element={<Parcelles />} />
      <Route path="/documents" element={<Documents />} />
      <Route path="/nouvelle-souscription" element={<NouvelleSouscription />} />
      <Route path="/profil" element={<Profil />} />
      
      {/* Paiements */}
      <Route path="/paiements" element={<GestionPaiements />} />
      <Route path="/gestion-paiements" element={<Navigate to="/paiements" replace />} />
      
      {/* Redirections vers Paramètres */}
      <Route path="/utilisateurs" element={<Navigate to="/parametres?tab=utilisateurs" replace />} />
      <Route path="/equipes" element={<Navigate to="/parametres?tab=equipes" replace />} />
      <Route path="/offres" element={<Navigate to="/parametres?tab=offres" replace />} />
      <Route path="/promotions" element={<Navigate to="/parametres?tab=offres" replace />} />
      <Route path="/portefeuille-clients" element={<Navigate to="/souscriptions" replace />} />
      
      <Route path="/account-requests" element={<Navigate to="/parametres?tab=demandes" replace />} />
      
      {/* Rapports */}
      <Route path="/rapports-financiers" element={<RapportsFinanciers />} />
      <Route path="/rapports-techniques" element={<RapportsTechniques />} />
      
      {/* Finances */}
      <Route path="/commissions" element={<Commissions />} />
      <Route path="/portefeuilles" element={<Portefeuilles />} />
      
      {/* Support */}
      <Route path="/tickets" element={<Tickets />} />
      
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
