import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { ArrowLeft, User, MapPin, Phone, Calendar, Sprout, CreditCard, CheckCircle, Clock, AlertTriangle, Mail, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientPortfolioProps {
  souscripteur: any;
  plantations: any[];
  paiements: any[];
  onBack: () => void;
}

const ClientPortfolio = ({ souscripteur, plantations, paiements, onBack }: ClientPortfolioProps) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);
  const fmt = (m: number) => new Intl.NumberFormat("fr-FR").format(m || 0) + " F CFA";

  const getStatutBadge = (statut: string) => {
    const configs: Record<string, { label: string; cls: string }> = {
      'en_attente_da': { label: 'En attente DI', cls: 'bg-gold/10 text-gold-dark border-gold/30' },
      'actif': { label: 'Actif', cls: 'bg-primary/10 text-primary border-primary/30' },
      'active': { label: 'Active', cls: 'bg-primary/10 text-primary border-primary/30' },
      'valide': { label: 'Validé', cls: 'bg-primary/10 text-primary border-primary/30' },
      'en_attente': { label: 'En attente', cls: 'bg-gold/10 text-gold-dark border-gold/30' },
      'echec': { label: 'Échoué', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
    };
    const cfg = configs[statut] || { label: statut || 'N/A', cls: 'bg-muted text-muted-foreground border-border' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
  };

  const stats = {
    totalPlantations: plantations.length,
    totalHectares: plantations.reduce((s, p) => s + (p.superficie_ha || 0), 0),
    hectaresActifs: plantations.reduce((s, p) => s + (p.superficie_activee || 0), 0),
    totalPaye: paiements.filter(p => p.statut === 'valide').reduce((s, p) => s + (p.montant_paye || 0), 0),
    totalDA: paiements.filter(p => p.statut === 'valide' && p.type_paiement === 'DA').reduce((s, p) => s + (p.montant_paye || 0), 0),
    totalRedev: paiements.filter(p => p.statut === 'valide' && (p.type_paiement === 'REDEVANCE' || p.type_paiement === 'contribution')).reduce((s, p) => s + (p.montant_paye || 0), 0),
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #00643C 0%, #004d2e 28%, #f8f7f4 28.1%, #f8f7f4 100%)' }}>
      <header className="py-3 px-4 shadow-lg sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #00643C, #004d2e)' }}>
        <div className="container mx-auto flex items-center gap-3 max-w-lg lg:max-w-7xl">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/15 h-9 w-9"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="bg-white rounded-lg p-1 flex items-center justify-center"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 sm:h-10 object-contain" /></div>
          <span className="font-semibold text-white text-sm">Mon Portefeuille</span>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 lg:px-8 py-4 lg:py-8 space-y-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:space-y-0 max-w-lg lg:max-w-7xl" style={{ marginTop: '-0.5rem' }}>
        {/* Profile - Glassmorphism */}
        <Card className={`border-0 shadow-xl overflow-hidden rounded-2xl transition-all duration-500 lg:col-span-5 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl border-2 border-gold/30 overflow-hidden bg-white/15 flex items-center justify-center shrink-0">
                {souscripteur.photo_profil_url ? <img src={souscripteur.photo_profil_url} alt="" className="h-full w-full object-cover" /> : <User className="h-7 w-7 text-white/60" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white truncate">{souscripteur.nom_complet}</h2>
                <p className="text-white/50 text-[10px] font-mono">{souscripteur.id_unique}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-white/70">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{souscripteur.telephone}</span>
                  {souscripteur.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{souscripteur.email}</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "Région", value: souscripteur.regions?.nom },
                { label: "Département", value: souscripteur.departements?.nom },
                { label: "Membre depuis", value: souscripteur.created_at ? format(new Date(souscripteur.created_at), "MMM yyyy", { locale: fr }) : 'N/A' },
              ].map((item, i) => (
                <div key={i} className="bg-white/10 rounded-xl p-2 text-center">
                  <p className="text-white font-semibold text-[11px] truncate">{item.value || 'N/A'}</p>
                  <p className="text-white/40 text-[9px]">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats - solid cards (lisibles sur fond clair) */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 transition-all duration-500 delay-100 lg:col-span-7 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {[
            { icon: Sprout, label: "Plantations", value: stats.totalPlantations, color: "text-primary", bg: "bg-primary/10" },
            { icon: MapPin, label: "Hectares", value: `${stats.totalHectares} ha`, color: "text-gold-dark", bg: "bg-gold/10" },
            { icon: TrendingUp, label: "Total payé", value: fmt(stats.totalPaye), color: "text-primary", bg: "bg-primary/10" },
            { icon: CreditCard, label: "DI versé", value: fmt(stats.totalDA), color: "text-gold-dark", bg: "bg-gold/10" },
          ].map((s, i) => (
            <Card key={i} className="card-brand-subtle rounded-2xl shadow-sm bg-card">
              <CardContent className="p-3">
                <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center mb-1.5`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="text-sm font-bold text-foreground truncate">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className={`transition-all duration-500 delay-150 lg:col-span-12 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Tabs defaultValue="plantations" className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-2xl bg-muted p-1 h-auto">
              <TabsTrigger value="plantations" className="rounded-xl text-xs py-2">Plantations</TabsTrigger>
              <TabsTrigger value="financier" className="rounded-xl text-xs py-2">Résumé financier</TabsTrigger>
            </TabsList>

            <TabsContent value="plantations" className="space-y-2 mt-3">
              {plantations.length === 0 ? (
                <Card className="card-brand-subtle rounded-2xl"><CardContent className="p-10 text-center text-muted-foreground">
                  <Sprout className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="font-semibold">Aucune plantation</p>
                </CardContent></Card>
              ) : plantations.map((p) => (
                <Card key={p.id} className="card-brand-green rounded-2xl shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div><p className="font-bold text-sm truncate">{p.nom_plantation || p.id_unique}</p><p className="text-[10px] text-muted-foreground font-mono">{p.id_unique}</p></div>
                      {getStatutBadge(p.statut_global)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[{ l: "Surface", v: `${p.superficie_ha || 0} ha` }, { l: "Activée", v: `${p.superficie_activee || 0} ha` }, { l: "Région", v: p.regions?.nom || 'N/A' }, { l: "Variété", v: p.variete || "Palmier" }].map((item, i) => (
                        <div key={i} className="bg-muted/30 rounded-xl p-2">
                          <p className="text-[9px] text-muted-foreground uppercase">{item.l}</p><p className="font-semibold truncate">{item.v}</p>
                        </div>
                      ))}
                    </div>
                    {p.date_activation && (
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" />Activée le {format(new Date(p.date_activation), "dd MMM yyyy", { locale: fr })}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="financier" className="mt-3">
              <Card className="card-brand-subtle rounded-2xl shadow-sm">
                <CardContent className="p-4 space-y-3">
                  {[
                    { label: "Dépôt Initial versé", value: fmt(stats.totalDA), color: "text-primary" },
                    { label: "Total mensualités versées", value: fmt(stats.totalRedev), color: "text-gold-dark" },
                    { label: "Total payé", value: fmt(stats.totalPaye), color: "text-foreground" },
                    { label: "Paiements validés", value: String(paiements.filter(p => p.statut === 'valide').length), color: "text-primary" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2.5 border-b last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default ClientPortfolio;
