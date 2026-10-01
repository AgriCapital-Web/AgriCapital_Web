import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { ArrowLeft, History, Download, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, Calendar, TrendingUp, CreditCard, Wallet } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientPaymentHistoryProps { souscripteur: any; plantations: any[]; paiements: any[]; onBack: () => void; }
const ITEMS_PER_PAGE = 10;

const ClientPaymentHistory = ({ souscripteur, plantations, paiements, onBack }: ClientPaymentHistoryProps) => {
  const [visible, setVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);

  const filteredPaiements = useMemo(() => {
    return paiements.filter(p => {
      const matchSearch = !searchTerm || p.reference?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === "all" || p.type_paiement === filterType;
      const matchStatut = filterStatut === "all" || p.statut === filterStatut;
      return matchSearch && matchType && matchStatut;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [paiements, searchTerm, filterType, filterStatut]);

  const totalPages = Math.ceil(filteredPaiements.length / ITEMS_PER_PAGE);
  const paginated = filteredPaiements.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const exportCSV = () => {
    const headers = ["Référence", "Date", "Type", "Montant", "Statut"];
    const rows = filteredPaiements.map(p => [p.reference || "-", p.date_paiement ? format(new Date(p.date_paiement), "dd/MM/yyyy HH:mm") : format(new Date(p.created_at), "dd/MM/yyyy HH:mm"), p.type_paiement === "DA" ? "Dépôt Initial" : "Mensualité", p.montant_paye || p.montant, p.statut === "valide" ? "Validé" : p.statut === "echec" ? "Échoué" : p.statut === "planifie" ? "Planifié" : "En attente"]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `historique-${format(new Date(), "yyyy-MM-dd")}.csv`; link.click();
  };

  const fmt = (m: number) => new Intl.NumberFormat("fr-FR").format(m || 0) + " F";

  const getStatutBadge = (statut: string) => {
    const map: Record<string, { icon: any; label: string; cls: string }> = {
      valide: { icon: CheckCircle, label: "Validé", cls: "bg-primary/10 text-primary border-primary/30" },
      echec: { icon: XCircle, label: "Échoué", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    };
    const cfg = map[statut] || { icon: Clock, label: "En attente", cls: "bg-gold/10 text-gold-dark border-gold/30" };
    const Icon = cfg.icon;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}><Icon className="h-3 w-3" />{cfg.label}</span>;
  };

  const stats = useMemo(() => {
    const valides = paiements.filter(p => p.statut === "valide");
    return {
      total: valides.reduce((s, p) => s + (p.montant_paye || p.montant || 0), 0),
      da: valides.filter(p => p.type_paiement === "DA").reduce((s, p) => s + (p.montant_paye || p.montant || 0), 0),
      redev: valides.filter(p => p.type_paiement === "REDEVANCE" || p.type_paiement === "contribution").reduce((s, p) => s + (p.montant_paye || p.montant || 0), 0),
      count: valides.length,
    };
  }, [paiements]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #00643C 0%, #004d2e 28%, #f8f7f4 28.1%, #f8f7f4 100%)' }}>
      <header className="py-3 px-4 shadow-lg sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #00643C, #004d2e)' }}>
        <div className="container mx-auto flex items-center gap-3 max-w-lg lg:max-w-7xl">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/15 h-9 w-9"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="bg-white rounded-lg p-1 flex items-center justify-center"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 sm:h-10 object-contain" /></div>
          <span className="font-semibold text-white text-sm">Historique</span>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 lg:px-8 py-4 lg:py-8 space-y-3 lg:grid lg:grid-cols-12 lg:gap-5 lg:space-y-0 max-w-lg lg:max-w-7xl" style={{ marginTop: '-0.5rem' }}>
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 transition-all duration-500 lg:col-span-12 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {[
            { icon: TrendingUp, label: "Total payé", value: fmt(stats.total), color: "text-primary", bg: "bg-primary/10" },
            { icon: CreditCard, label: "Dépôt Initial", value: fmt(stats.da), color: "text-gold-dark", bg: "bg-gold/10" },
            { icon: Wallet, label: "Mensualités", value: fmt(stats.redev), color: "text-primary", bg: "bg-primary/10" },
            { icon: CheckCircle, label: "Transactions", value: stats.count, color: "text-gold-dark", bg: "bg-gold/10" },
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

        <Card className={`card-brand-subtle rounded-2xl shadow-sm transition-all duration-500 delay-100 lg:col-span-4 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm rounded-xl" />
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 text-xs gap-1 shrink-0 rounded-xl border-gold/30 text-gold-dark hover:bg-gold/5"><Download className="h-3.5 w-3.5" />CSV</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterType} onValueChange={v => { setFilterType(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tous types</SelectItem><SelectItem value="DA">Dépôt Initial</SelectItem><SelectItem value="REDEVANCE">Mensualité</SelectItem></SelectContent>
              </Select>
              <Select value={filterStatut} onValueChange={v => { setFilterStatut(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tous statuts</SelectItem><SelectItem value="valide">Validé</SelectItem><SelectItem value="en_attente">En attente</SelectItem><SelectItem value="echec">Échoué</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className={`card-brand-subtle rounded-2xl shadow-sm transition-all duration-500 delay-150 lg:col-span-8 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Transactions
              <Badge variant="secondary" className="ml-auto text-[10px] bg-gold/10 text-gold-dark border-gold/30">{filteredPaiements.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paginated.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><History className="h-12 w-12 mx-auto mb-3 opacity-20" /><p className="font-semibold text-sm">Aucun paiement</p></div>
            ) : (
              <div className="divide-y">
                {paginated.map(p => (
                  <div key={p.id} className="p-3 hover:bg-muted/20 transition-colors">
                    <div className="flex justify-between items-start mb-1.5">
                      <div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{p.date_paiement ? format(new Date(p.date_paiement), "dd MMM yyyy", { locale: fr }) : format(new Date(p.created_at), "dd MMM yyyy", { locale: fr })}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">{p.reference?.slice(0, 16) || '-'}</p>
                      </div>
                      {getStatutBadge(p.statut)}
                    </div>
                    <div className="flex justify-between items-center">
                      <Badge variant={p.type_paiement === "DA" ? "default" : "secondary"} className={`text-[10px] ${p.type_paiement === "DA" ? "bg-primary" : "bg-gold/10 text-gold-dark border-gold/30"}`}>
                        {p.type_paiement === "DA" ? "Dépôt Initial" : "Mensualité"}
                      </Badge>
                      <span className="font-bold text-sm text-primary">{fmt(p.montant_paye || p.montant)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t bg-muted/20">
                <p className="text-[10px] text-muted-foreground">{currentPage}/{totalPages}</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 w-7 p-0 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-7 w-7 p-0 rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ClientPaymentHistory;
