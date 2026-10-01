import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, RotateCcw, Ban, Receipt } from "lucide-react";
import { formatCFA } from "@/utils/pricing";

interface TransactionStatusWidgetProps { paiements: any[]; limit?: number; }

const STATUS_META: Record<string,{label:string;icon:any;cls:string}> = {
  en_attente:{label:"En attente",icon:Clock,cls:"bg-amber-500/15 text-amber-700 border-amber-500/30"},
  valide:{label:"Payée",icon:CheckCircle2,cls:"bg-emerald-500/15 text-emerald-700 border-emerald-500/30"},
  echoue:{label:"Échouée",icon:XCircle,cls:"bg-red-500/15 text-red-700 border-red-500/30"},
  rembourse:{label:"Remboursée",icon:RotateCcw,cls:"bg-blue-500/15 text-blue-700 border-blue-500/30"},
  annule:{label:"Annulée",icon:Ban,cls:"bg-gray-500/15 text-gray-700 border-gray-500/30"},
};

export const TransactionStatusWidget = ({paiements,limit=5}:TransactionStatusWidgetProps) => {
  const recent=[...(paiements||[])].sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime()).slice(0,limit);
  if(!recent.length) return null;
  return <Card className="card-brand rounded-2xl shadow-md"><CardContent className="p-4 space-y-3">
    <div className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary"/><h3 className="font-bold text-sm">Mes transactions récentes</h3></div>
    <div className="space-y-2">{recent.map(p=>{const meta=STATUS_META[p.statut]||STATUS_META.en_attente;const Icon=meta.icon;return <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border">
      <div className={`p-2 rounded-lg ${meta.cls.split(" ").slice(0,2).join(" ")}`}><Icon className="h-4 w-4"/></div>
      <div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-2 flex-wrap"><span className="font-bold text-sm">{formatCFA(p.montant_paye||p.montant)}</span><Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge></div>
      <p className="text-[11px] text-muted-foreground truncate">{p.type_paiement==="DA"?"Dépôt Initial":"Paiement" } • {p.reference}</p>
      <p className="text-[10px] text-muted-foreground">{new Date(p.date_paiement||p.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</p></div>
    </div>})}</div>
  </CardContent></Card>;
};
export default TransactionStatusWidget;
