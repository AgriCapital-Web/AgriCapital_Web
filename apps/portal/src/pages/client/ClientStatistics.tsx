import { useMemo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, AlertTriangle, CheckCircle, BarChart3, Wallet } from "lucide-react";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { getCurrentRateFromOffer, formatCFA } from "@/utils/pricing";
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientStatisticsProps { souscripteur: any; plantations: any[]; paiements: any[]; onBack: () => void; }
const COLORS = ['#00643C', '#E89C31'];

const ClientStatistics = ({ souscripteur, plantations, paiements, onBack }: ClientStatisticsProps) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);
  const fmt = (m: number) => formatCFA(m);

  const paiementStats = useMemo(() => {
    const da = paiements.filter(p => p.type_paiement === 'DA' && p.statut === 'valide').reduce((s, p) => s + (p.montant_paye || 0), 0);
    const rev = paiements.filter(p => (p.type_paiement === 'REDEVANCE' || p.type_paiement === 'contribution') && p.statut === 'valide').reduce((s, p) => s + (p.montant_paye || 0), 0);
    return [{ name: "Dépôt Initial", value: da }, { name: "Mensualités", value: rev }].filter(d => d.value > 0);
  }, [paiements]);

  const evolution = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(new Date(), 11 - i);
      const debut = startOfMonth(date), fin = endOfMonth(date);
      const moisPay = paiements.filter(p => {
        if (!p.date_paiement || p.statut !== 'valide') return false;
        try { return isWithinInterval(parseISO(p.date_paiement), { start: debut, end: fin }); } catch { return false; }
      });
      return { mois: format(date, 'MMM yy', { locale: fr }), DI: moisPay.filter(p => p.type_paiement === 'DA').reduce((s, p) => s + (p.montant_paye || 0), 0), Mensualité: moisPay.filter(p => p.type_paiement === 'REDEVANCE' || p.type_paiement === 'contribution').reduce((s, p) => s + (p.montant_paye || 0), 0) };
    });
  }, [paiements]);

  const arrieres = useMemo(() => {
    return plantations.map(p => {
      if (!p.date_activation || p.statut_global === 'en_attente_da') return { nom: p.nom_plantation || p.id_unique, arrieres: 0, enAvance: false, enAttente: true };
      const rate = getCurrentRateFromOffer(souscripteur?.offres, p.date_activation);
      const tarifJour = rate?.jour_par_ha || 2000;
      const jours = Math.floor((Date.now() - new Date(p.date_activation).getTime()) / 86400000);
      const attendu = jours * tarifJour * (p.superficie_activee || 0);
      const paye = paiements.filter(pay => pay.plantation_id === p.id && (pay.type_paiement === 'REDEVANCE' || pay.type_paiement === 'contribution') && pay.statut === 'valide').reduce((s, pay) => s + (pay.montant_paye || 0), 0);
      const diff = attendu - paye;
      if (diff > 0) return { nom: p.nom_plantation || p.id_unique, arrieres: diff, joursArr: Math.floor(diff / (tarifJour * (p.superficie_activee || 1))), enAvance: false, enAttente: false };
      return { nom: p.nom_plantation || p.id_unique, arrieres: 0, avance: Math.abs(diff), enAvance: true, enAttente: false };
    });
  }, [plantations, paiements, souscripteur]);

  const totalPaye = paiements.filter(p => p.statut === 'valide').reduce((s, p) => s + (p.montant_paye || 0), 0);
  const totalArr = arrieres.filter(a => !a.enAvance && !a.enAttente).reduce((s, a) => s + a.arrieres, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border rounded-xl shadow-lg p-3 text-xs">
        <p className="font-bold text-foreground mb-1">{label}</p>
        {payload.map((e: any, i: number) => <p key={i} style={{ color: e.color }} className="flex justify-between gap-4"><span>{e.name}</span><span className="font-bold">{fmt(e.value)}</span></p>)}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #00643C 0%, #004d2e 25%, #f8f7f4 25.1%, #f8f7f4 100%)' }}>
      <header className="py-3 px-4 shadow-lg sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #00643C, #004d2e)' }}>
        <div className="container mx-auto flex items-center gap-3 max-w-lg lg:max-w-7xl">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/15 h-9 w-9"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="bg-white rounded-lg p-1 flex items-center justify-center"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 sm:h-10 object-contain" /></div>
          <span className="font-semibold text-white text-sm">Statistiques</span>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 lg:px-8 py-4 lg:py-8 space-y-3 lg:grid lg:grid-cols-12 lg:gap-5 lg:space-y-0 max-w-lg lg:max-w-7xl" style={{ marginTop: '-0.5rem' }}>
        <div className={`grid grid-cols-2 gap-2 transition-all duration-500 lg:col-span-12 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Card className="card-brand-subtle rounded-2xl shadow-sm bg-card">
            <CardContent className="p-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-1.5">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-lg font-black text-foreground">{fmt(totalPaye)}</p>
              <p className="text-[10px] text-muted-foreground">Total payé</p>
            </CardContent>
          </Card>
          <Card className={`card-brand-subtle rounded-2xl shadow-sm bg-card ${totalArr > 0 ? 'border-destructive/40' : ''}`}>
            <CardContent className="p-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-1.5 ${totalArr > 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                {totalArr > 0 ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-primary" />}
              </div>
              <p className={`text-lg font-black ${totalArr > 0 ? 'text-destructive' : 'text-foreground'}`}>{totalArr > 0 ? fmt(totalArr) : "À jour ✓"}</p>
              <p className="text-[10px] text-muted-foreground">{totalArr > 0 ? "Arriérés" : "Statut"}</p>
            </CardContent>
          </Card>
        </div>

        {paiementStats.length > 0 && (
          <Card className={`card-brand-subtle rounded-2xl shadow-sm transition-all duration-500 delay-100 lg:col-span-12 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <CardHeader className="p-3 pb-1"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-gold" />Répartition</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={paiementStats} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {paiementStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip content={<CustomTooltip />} /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {paiementStats.map((s, i) => (
                  <div key={i} className="text-center p-2 rounded-xl" style={{ background: `${COLORS[i]}10`, border: `1px solid ${COLORS[i]}25` }}>
                    <p className="text-[10px] text-muted-foreground">{s.name}</p>
                    <p className="font-bold text-xs" style={{ color: COLORS[i] }}>{fmt(s.value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={`card-brand-subtle rounded-2xl shadow-sm transition-all duration-500 delay-150 lg:col-span-12 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />Évolution (12 mois)</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="h-48 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gDI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00643C" stopOpacity={0.3} /><stop offset="95%" stopColor="#00643C" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#E89C31" stopOpacity={0.3} /><stop offset="95%" stopColor="#E89C31" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="mois" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span className="text-[9px] text-muted-foreground">{v}</span>} />
                  <Area type="monotone" dataKey="DI" stackId="1" stroke="#00643C" fill="url(#gDI)" name="Dépôt Initial" strokeWidth={2} />
                  <Area type="monotone" dataKey="Mensualité" stackId="1" stroke="#E89C31" fill="url(#gRev)" name="Mensualités" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {arrieres.length > 0 && (
          <Card className={`card-brand-subtle rounded-2xl shadow-sm transition-all duration-500 delay-200 lg:col-span-12 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                {totalArr > 0 ? <TrendingDown className="h-4 w-4 text-destructive" /> : <TrendingUp className="h-4 w-4 text-primary" />}
                État par plantation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-2">
              {arrieres.map((item, i) => (
                <div key={i} className={`p-3 rounded-2xl border ${
                  item.enAttente ? 'bg-muted/30 border-gold/20' :
                  item.enAvance ? 'bg-primary/5 border-primary/20' :
                  item.arrieres > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30 border-border'
                }`}>
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-bold text-xs truncate">{item.nom}</span>
                    {item.enAttente ? (
                      <span className="text-[10px] font-semibold text-gold-dark flex items-center gap-1"><Wallet className="h-3 w-3" />En attente DI</span>
                    ) : item.enAvance ? (
                      <span className="text-[10px] font-semibold text-primary flex items-center gap-1"><CheckCircle className="h-3 w-3" />Avance : {fmt(item.avance || 0)}</span>
                    ) : item.arrieres > 0 ? (
                      <span className="text-[10px] font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Arriéré : {fmt(item.arrieres)} ({item.joursArr}j)</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" />À jour</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ClientStatistics;
