import { useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, DollarSign, TrendingUp, CheckCircle, Clock3, RefreshCw, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const money=(n:any)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"XOF",maximumFractionDigits:0}).format(Number(n||0));
const period=()=>{const d=new Date();const start=new Date(d.getFullYear(),d.getMonth(),d.getDate()<=15?1:16);const end=d.getDate()<=15?new Date(d.getFullYear(),d.getMonth(),15):new Date(d.getFullYear(),d.getMonth()+1,0);return {start,end};};

export default function Commissions(){
  const {can}=usePermissions();
  const {toast}=useToast();
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const load=async()=>{
    setLoading(true);
    try{
      const {data,error}=await (supabase as any).from("commissions").select("*,profile:profiles!commissions_profile_id_fkey(nom_complet,telephone),plantation:plantations(id_unique,nom_plantation)").order("date_calcul",{ascending:false}).limit(2000);
      if(error)throw error;setRows(data||[]);
    }catch(e:any){toast({variant:"destructive",title:"Commissions indisponibles",description:e?.message||"Erreur."});}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  useRealtime({table:"commissions",onChange:load});

  const stats=useMemo(()=>{
    const {start,end}=period();
    const startIso=start.toISOString().slice(0,10),endIso=end.toISOString().slice(0,10);
    const inPeriod=rows.filter(r=>r.periode>=startIso&&r.periode<=endIso);
    return {
      total:rows.reduce((s,r)=>s+Number(r.montant_commission||0),0),
      aValider:rows.filter(r=>r.statut==="calculee").reduce((s,r)=>s+Number(r.montant_commission||0),0),
      validees:rows.filter(r=>r.statut==="validee").reduce((s,r)=>s+Number(r.montant_commission||0),0),
      payees:rows.filter(r=>r.statut==="payee").reduce((s,r)=>s+Number(r.montant_commission||0),0),
      quinzaine:inPeriod.reduce((s,r)=>s+Number(r.montant_commission||0),0),
    };
  },[rows]);

  const filtered=rows.filter(r=>{
    const q=search.toLowerCase();
    return !q||r.profile?.nom_complet?.toLowerCase().includes(q)||r.type_commission?.toLowerCase().includes(q)||r.plantation?.id_unique?.toLowerCase().includes(q);
  });
  const typeLabel=(t:string)=>t==="acquisition"?"Activation / vente":t==="recouvrement_mensuel"?"Commission mensuelle (2,5%)":t;
  const statusLabel=(s:string)=>s==="calculee"?"À valider":s==="validee"?"Validée":s==="payee"?"Payée":s==="annule"?"Annulée":s;
  const statusVariant=(s:string)=>s==="payee"?"default":s==="validee"?"secondary":s==="calculee"?"outline":"destructive";

  return <ProtectedRoute requiredPermissionCode="commissions.view">
    <MainLayout>
      <div className="min-w-0 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold">Commissions</h1><p className="text-sm text-muted-foreground">Tableau de bord des commissions commerciales et de leur cycle de versement.</p></div>
          <Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Actualiser</Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[["Total calculé",stats.total,DollarSign],["À valider",stats.aValider,Clock3],["Validées",stats.validees,CheckCircle],["Payées",stats.payees,TrendingUp],["Quinzaine",stats.quinzaine,CalendarClock]].map(([label,value,Icon]:any)=><Card key={label as string}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary"/></div><div className="mt-2 text-lg font-bold">{money(value)}</div></CardContent></Card>)}
        </div>

        <Card><CardContent className="p-4"><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un commercial, une plantation ou un type..." className="pl-10"/></div></CardContent></Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Commercial</TableHead><TableHead>Type</TableHead><TableHead>Base</TableHead><TableHead>Taux</TableHead><TableHead>Commission</TableHead><TableHead>Période</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>{loading?<TableRow><TableCell colSpan={7} className="py-8 text-center">Chargement…</TableCell></TableRow>:filtered.length===0?<TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucune commission.</TableCell></TableRow>:filtered.map((c:any)=><TableRow key={c.id}><TableCell className="font-medium">{c.profile?.nom_complet||"—"}</TableCell><TableCell><Badge variant="outline">{typeLabel(c.type_commission)}</Badge></TableCell><TableCell>{money(c.montant_base)}</TableCell><TableCell>{Number(c.taux_commission||0)>0 ? String(c.taux_commission)+"%" : "—"}</TableCell><TableCell className="font-bold">{money(c.montant_commission)}</TableCell><TableCell>{c.periode?format(new Date(c.periode),"dd/MM/yyyy",{locale:fr}):"—"}</TableCell><TableCell><Badge variant={statusVariant(c.statut)}>{statusLabel(c.statut)}</Badge></TableCell></TableRow>)}</TableBody></Table>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">Les versements sont gérés séparément par quinzaine dans Portefeuilles. Cette page reste un tableau de bord et une piste de traçabilité.</p>
      </div>
    </MainLayout>
  </ProtectedRoute>;
}
