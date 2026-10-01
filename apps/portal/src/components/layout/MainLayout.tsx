import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationCenter } from "@/components/common/NotificationCenter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AIAssistant from "@/components/ai/AIAssistant";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { cn } from "@/lib/utils";

import { 
  LayoutDashboard, 
  Users, 
  Sprout, 
  CreditCard, 
  LogOut, 
  Menu,
  Receipt,
  BarChart3,
  Ticket,
  Wallet,
  FileText,
  Settings
} from "lucide-react";

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { signOut, profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Use hasRole for secure role checking via user_roles table
  const isAdmin = hasRole('super_admin') || hasRole('directeur_tc');
  const canViewFinances = isAdmin || hasRole('comptable') || hasRole('responsable_zone');
  const canViewRapports = isAdmin || hasRole('responsable_zone');
  const canManageUsers = hasRole('super_admin');

  const menuItems = [
    { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard" },
    { icon: Users, label: "Souscripteurs", path: "/souscriptions" },
    { icon: Sprout, label: "Plantations", path: "/plantations" },
    { icon: CreditCard, label: "Gestion Paiements", path: "/paiements" },
    { icon: Receipt, label: "Commissions", path: "/commissions", show: canViewFinances },
    { icon: Wallet, label: "Portefeuilles", path: "/portefeuilles", show: canViewFinances },
    { icon: BarChart3, label: "Rapports Techniques", path: "/rapports-techniques", show: canViewRapports },
    { icon: FileText, label: "Rapports Financiers", path: "/rapports-financiers", show: canViewFinances },
    { icon: Ticket, label: "Tickets Support", path: "/tickets" },
    { icon: Settings, label: "Paramètres", path: "/parametres", show: isAdmin },
  ];

  const visibleMenuItems = menuItems.filter(item => item.show !== false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'US';
  };

  const SidebarContent = ({ expanded = false }: { expanded?: boolean }) => (
    <div className="flex flex-col h-full bg-primary">
      <div className="p-3 sm:p-4 border-b border-white/10 flex justify-center bg-white">
        <img src={logoWhiteBg} alt="AgriCapital" className="h-14 sm:h-16 lg:h-20 w-auto object-contain" />
      </div>
      
      <nav className="flex-1 p-2 sm:p-4 space-y-1 overflow-y-auto">
        {visibleMenuItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                "w-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground transition-all",
                "focus:bg-primary-foreground/20 p-2 sm:p-3",
                expanded ? "justify-start gap-3" : "justify-center",
                location.pathname === item.path && "bg-primary-foreground/20"
              )}
              onClick={() => {
                navigate(item.path);
                setOpen(false);
              }}
              title={item.label}
            >
              <item.icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              {expanded && <span className="text-sm truncate">{item.label}</span>}
            </Button>
          ))}
      </nav>

      <div className="p-2 sm:p-4 border-t border-white/10 flex flex-col gap-2">
        <NotificationCenter />
        <Button
          variant="ghost"
          className={cn(
            "w-full text-primary-foreground hover:bg-destructive hover:text-white transition-all p-2 sm:p-3",
            expanded ? "justify-start gap-3" : "justify-center"
          )}
          onClick={handleLogout}
          title="Déconnexion"
        >
          <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
          {expanded && <span className="text-sm">Déconnexion</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-52 lg:w-60 flex-col flex-shrink-0">
        <SidebarContent expanded />
      </aside>

      {/* Mobile Header + Sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b px-3 py-2 flex items-center justify-between">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs font-medium truncate max-w-[120px]">{profile?.nom_complet}</p>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.photo_url || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(profile?.nom_complet || '')}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent expanded />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {/* Desktop Header with profile */}
        <div className="hidden md:flex items-center justify-end gap-3 px-4 py-3 border-b bg-background">
          <div className="text-right">
            <p className="text-sm font-medium">{profile?.nom_complet || "Utilisateur"}</p>
            <p className="text-xs text-muted-foreground">
              Support: <a href="tel:+2250759566087" className="text-primary hover:underline">+225 07 59 56 60 87</a>
            </p>
          </div>
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.photo_url || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(profile?.nom_complet || '')}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </main>
      
      <AIAssistant 
        mode="admin" 
        context={`Utilisateur: ${profile?.nom_complet || 'Admin'}, Rôle: ${profile?.role || 'admin'}`} 
      />
    </div>
  );
};

export default MainLayout;