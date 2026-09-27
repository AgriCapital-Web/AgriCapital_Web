import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS, hasPermission } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationCenter } from "@/components/common/NotificationCenter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import AIAssistant from "@/components/ai/AIAssistant";
import logoV2 from "@/assets/logo-agricapital-v2.png";
import { cn } from "@/lib/utils";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useGlobalRealtime } from "@/hooks/useGlobalRealtime";
import {
  LayoutDashboard, Users, Sprout, CreditCard, LogOut, Menu, Receipt,
  BarChart3, Ticket, Wallet, FileText, Settings, UserCircle, Wifi, WifiOff, RefreshCw, Signal,
  LandPlot, Layers, Target, CloudUpload, Leaf
} from "lucide-react";

interface MainLayoutProps { children: ReactNode; }

const MainLayout = ({ children }: MainLayoutProps) => {
  const { signOut, profile, userRoles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { isOnline, isSyncing, syncNow, pendingCount, networkQuality } = useOfflineSync();
  const photoUrl = useSignedUrl('photos-profils', profile?.photo_url);
  useGlobalRealtime();

  const menuItems = [
    { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard", permission: PERMISSIONS.VIEW_DASHBOARD },
    { icon: Target, label: "Prospects", path: "/leads", permission: PERMISSIONS.VIEW_LEADS },
    { icon: Users, label: "Souscripteurs", path: "/souscriptions", permission: PERMISSIONS.VIEW_SOUSCRIPTIONS },
    { icon: LandPlot, label: "Propriétaires", path: "/proprietaires-terres", permission: PERMISSIONS.VIEW_SOUSCRIPTIONS },
    { icon: Layers, label: "Parcelles", path: "/parcelles", permission: PERMISSIONS.VIEW_PLANTATIONS },
    { icon: Sprout, label: "Plantations", path: "/plantations", permission: PERMISSIONS.VIEW_PLANTATIONS },
    { icon: CreditCard, label: "Paiements", path: "/paiements", permission: PERMISSIONS.VIEW_PAIEMENTS },
    { icon: Receipt, label: "Commissions", path: "/commissions", permission: PERMISSIONS.VIEW_COMMISSIONS },
    { icon: Wallet, label: "Portefeuilles", path: "/portefeuilles", permission: PERMISSIONS.VIEW_PORTEFEUILLES },
    { icon: Users, label: "Équipes", path: "/equipes", permission: PERMISSIONS.VIEW_EQUIPES },
    { icon: BarChart3, label: "Rapports techniques", path: "/rapports-techniques", permission: PERMISSIONS.VIEW_RAPPORTS_TECHNIQUES },
    { icon: FileText, label: "Rapports financiers", path: "/rapports-financiers", permission: PERMISSIONS.VIEW_RAPPORTS_FINANCIERS },
    { icon: Ticket, label: "Tickets", path: "/tickets", permission: PERMISSIONS.VIEW_TICKETS },
    { icon: CloudUpload, label: "Synchronisation", path: "/synchronisation", permission: PERMISSIONS.VIEW_DASHBOARD },
  ];

  const visibleMenuItems = menuItems.filter(item => hasPermission(userRoles, item.permission));
  const handleLogout = async () => { await signOut(); navigate("/"); };
  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AG';

  const NetworkIndicator = ({ compact = false }: { compact?: boolean }) => {
    if (!isOnline) return <span className="flex items-center gap-1 text-xs font-semibold text-destructive"><WifiOff className="h-3.5 w-3.5" /> {!compact && 'Hors ligne'}</span>;
    if (networkQuality === 'slow') return <span className="flex items-center gap-1 text-xs font-semibold text-accent"><Signal className="h-3.5 w-3.5" /> {!compact && 'Réseau lent'}</span>;
    return <span className={cn("flex items-center gap-1 text-xs font-semibold", compact ? "text-primary" : "text-primary-foreground")}><Wifi className="h-3.5 w-3.5" /> {!compact && 'En ligne'}</span>;
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-primary text-primary-foreground">
      <div className="border-b border-primary-foreground/10 px-4 py-6 bg-white">
        <button onClick={() => navigate('/dashboard')} className="flex w-full items-center justify-center">
          <img src={logoV2} alt="AgriCapital" className="w-full max-w-[220px] h-auto object-contain" />
          <span className="sr-only">AgriCapital</span>
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleMenuItems.length === 0 && (
          <div className="rounded-md bg-primary-foreground/10 px-3 py-4 text-xs text-primary-foreground/90">
            Aucun rôle attribué à votre compte. Contactez un administrateur ou reconnectez-vous.
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={handleLogout}>Se reconnecter</Button>
          </div>
        )}
        {visibleMenuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                "h-10 w-full justify-start gap-3 rounded-md px-3 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                active && "bg-primary-foreground text-primary shadow-sm hover:bg-primary-foreground hover:text-primary"
              )}
              onClick={() => { navigate(item.path); setOpen(false); }}
              title={item.label}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate text-sm font-medium">{item.label}</span>
            </Button>
          );
        })}
      </nav>

      <div className="border-t border-primary-foreground/10 p-3">
        <div className="mb-2 rounded-md bg-primary-foreground/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2"><NetworkIndicator />{pendingCount > 0 && <Badge className="bg-accent text-accent-foreground">{pendingCount}</Badge>}</div>
        </div>
        <div className="space-y-1">
          <NotificationCenter />
          <Button variant="ghost" className={cn("h-10 w-full justify-start gap-3 rounded-md text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground", location.pathname === "/profil" && "bg-primary-foreground/15 text-primary-foreground")} onClick={() => { navigate("/profil"); setOpen(false); }}>
            <UserCircle className="h-4 w-4" /><span className="text-sm font-medium">Profil</span>
          </Button>
          {hasPermission(userRoles, PERMISSIONS.VIEW_PARAMETRES) && (
            <Button variant="ghost" className={cn("h-10 w-full justify-start gap-3 rounded-md text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground", location.pathname === "/parametres" && "bg-primary-foreground/15 text-primary-foreground")} onClick={() => { navigate("/parametres"); setOpen(false); }}>
              <Settings className="h-4 w-4" /><span className="text-sm font-medium">Paramètres</span>
            </Button>
          )}
          <Button variant="ghost" className="h-10 w-full justify-start gap-3 rounded-md text-primary-foreground/80 hover:bg-destructive hover:text-destructive-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /><span className="text-sm font-medium">Déconnexion</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/35">
      <aside className="hidden h-screen w-64 flex-shrink-0 md:sticky md:top-0 md:flex"><SidebarContent /></aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <SheetTrigger asChild><Button variant="outline" size="icon"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <NetworkIndicator compact />
          </div>
          <Avatar className="h-8 w-8" onClick={() => navigate('/profil')}><AvatarImage src={photoUrl || ''} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{getInitials(profile?.nom_complet || '')}</AvatarFallback></Avatar>
        </div>
        <SheetContent side="left" className="w-72 p-0"><SidebarContent /></SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 pt-14 md:pt-0">
        <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur md:flex">
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <NetworkIndicator />
            {pendingCount > 0 && <Badge variant="outline" className="border-accent text-accent">{pendingCount} en attente</Badge>}
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={syncNow} disabled={isSyncing || !isOnline} title="Synchroniser">
              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            </Button>
            <div className="text-right leading-tight"><p className="text-sm font-semibold">{profile?.nom_complet || "Utilisateur"}</p><p className="text-xs text-muted-foreground">{userRoles.join(' / ') || 'Compte actif'}</p></div>
            <Avatar className="h-9 w-9 cursor-pointer" onClick={() => navigate('/profil')}><AvatarImage src={photoUrl || ''} /><AvatarFallback className="bg-primary text-primary-foreground text-sm">{getInitials(profile?.nom_complet || '')}</AvatarFallback></Avatar>
          </div>
        </header>
        <div className="min-w-0 w-full max-w-full p-3 sm:p-5 lg:p-7">{children}</div>
      </main>


      <AIAssistant mode="admin" context={`Utilisateur: ${profile?.nom_complet || 'Admin'}, Rôles: ${userRoles.join(', ') || 'N/A'}`} />
    </div>
  );
};

export default MainLayout;
