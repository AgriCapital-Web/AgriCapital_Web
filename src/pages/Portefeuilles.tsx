import { useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, TrendingUp, CircleDollarSign, CalendarClock, RefreshCw, LockKeyhole } from "lucide-react";
import { format, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

const COMMISSION_ROLES=["commercial"];
const TEAM_ROLES=["chef_equipe_commercial","chef_equipe_technique","responsable_commercial","responsable_operations"];

const fortnight = (d=new Date()) => {
  const date=new Date(d);
  if(date.getDate()<=15) return {start:new Date(date.getFullYear(),date.getMonth(),1),end:new Date(date.getFullYear(),date.getMonth(),15)};
  return {start:new Date(date.getFullYear(),date.getMonth(),16),end:endOfMonth(date)};
};
const iso=(d:Date)=>format(d,"yyyy-MM-dd");
const money=(n:any)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"XOF",maximumFractionDigits:0}).format(Number(n||0));

export default function Portefeuilles(){
  const { can, roles, isSuperAdmin, isPdg } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = isSuperAdmin || isPdg || can("portefeuilles.manage_payouts") || can("commissions.manage_payouts");
  const [profiles,setProfiles]=useState<any[]>([]);
  const [portefeuilles,setPortefeuilles]=useState<any[]>([]);
  const [commissions,setCommissions]=useState<any[]>([]);
  const [versements,setVersements]=useState<any[]>([]);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const q=fortnight();
  const [periodStart,setPeriodStart]=useState(iso(q.start));
  const [periodEnd,setPeriodEnd]=useState(iso(q.end));

  const load=async()=>{
    setLoading(true);
    try{
      const [pr,pf,cm,vp,lines]=await Promise.all([
        (supabase as any).from("profiles").select("id,user_id,nom_complet,email,telephone,equipe_id,actif").eq("actif",true).order("nom_complet"),
        (supabase as any).from("portefeuilles").select("*").order("updated_at",{ascending:false}),
        (supabase as any).from("commissions").select("id,profile_id,client_id,paiement_id,type_commission,montant_base,taux_commission,montant_commission,periode,statut,date_calcul").order("periode",{ascending:false}).limit(2000),
        (supabase as any).from("portefeuille_versements").select("*").order("periode_debut",{ascending:false}),
        (supabase as any).from("portefeuille_versement_lignes").select("commission_id,versement_id"),
      ]);
      if(pr.error)throw pr.error;if(pf.error)throw pf.error;if(cm.error)throw cm.error;if(vp.error)throw vp.error;if(lines.error)throw lines.error;
      const roleRes=await (supabase as any).from("user_roles").select("user_id,role");
      const roleMap:Record<string,string[]>={};
      (roleRes.data||[]).forEach((r:any)=>(roleMap[r.user_id]||=[]).push(r.role));
      const profilesData=(pr.data||[]).map((p:any)=>({...p,roles:roleMap[p.user_id]||[]}));
      setProfiles(profilesData);
      setPortefeuilles((pf.data||[]).map((x:any)=>({...x,user:profilesData.find((p:any)=>p.user_id===x.user_id)})));
      setCommissions(cm.data||[]);
      setVersements((vp.data||[]).map((v:any)=>({...v,lines:(lines.data||[]).filter((l:any)=>l.versement_id===v.id)})));
    }catch(e:any){toast({variant:"destructive",title:"Portefeuilles indisponibles",description:e?.message||"Erreur de chargement."});}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  
  const visibleProfiles=useMemo(()=>{
    if(isSuperAdmin||isPdg||can("portefeuilles.manage_payouts")) return profiles;
    const me=profiles.find((p:any)=>p.user_id===user?.id);
    if(!me) return [];
    const isManager=me.roles?.some((r:string)=>TEAM_ROLES.includes(r));
    if(isManager && me.equipe_id) return profiles.filter((p:any)=>p.equipe_id===me.equipe_id);
    return profiles.filter((p:any)=>p.user_id===user?.id);
  },[profiles,user,isSuperAdmin,isPdg,can]);
  
  const filtered=useMemo(()=>portefeuilles.filter((p:any)=>{
    if(!visibleProfiles.some((x:any)=>x.user_id===p.user_id)) return false;
    const q=search.toLowerCase();
    return !q || p.user?.nom_complet?.toLowerCase().includes(q) || p.user?.email?.toLowerCase().includes(q);
  }),[portefeuilles,visibleProfiles,search]);

  const stats=useMemo(()=>({
    solde:filtered.reduce((s:any,p:any)=>s+Number(p.solde_commissions||0),0),
    gagne:filtered.reduce((s:any,p:any)=>s+Number(p.total_gagne||0),0),
    verse:filtered.reduce((s:any,p:any)=>s+Number(p.total_verse||0),0),
    pending:commissions.filter((c:any)=>visibleProfiles.some((p:any)=>p.id===c.profile_id)&&c.statut==="calculee").reduce((s:any,c:any)=>s+Number(c.montant_commission||0),0),
  }),[filtered,commissions,visibleProfiles]);

  const commissionIdsAlreadyLinked=new Set(versements.flatMap((v:any)=>v.lines?.map((l:any)=>l.commission_id)||[]));

  const generateFortnight=async()=>{
    if(!canManage)return;
    setSaving(true);
    try{
      const eligible=commissions.filter((c:any)=>(c.statut==="calculee"||c.statut==="validee")&&!commissionIdsAlreadyLinked.has(c.id)&&c.periode>=periodStart&&c.periode<=periodEnd&&visibleProfiles.some((p:any)=>p.id===c.profile_id));
      const groups=new Map<string,any[]>();
      eligible.forEach((c:any)=>(groups.get(c.profile_id)||groups.set(c.profile_id,[]).get(c.profile_id)!).push(c));
      for(const [profileId,items] of groups){
        const amount=items.reduce((s:number,c:any)=>s+Number(c.montant_commission||0),0);
        const {data:v,error}=await (supabase as any).from("portefeuille_versements").upsert({profile_id:profileId,periode_debut:periodStart,periode_fin:periodEnd,montant_brut:amount,montant_paye:amount,statut:"brouillon",created_by:(await supabase.auth.getUser()).data.user?.id||null,updated_at:new Date().toISOString()},{onConflict:"profile_id,periode_debut,periode_fin"}).select().single();
        if(error)throw error;
        await (supabase as any).from("portefeuille_versement_lignes").upsert(items.map((c:any)=>({versement_id:v.id,commission_id:c.id,montant:c.montant_commission})),{onConflict:"versement_id,commission_id"});
      }
      toast({title:"Quinzaine générée",description:`${groups.size} portefeuille(s) préparé(s).`}); await load();
    }catch(e:any){toast({variant:"destructive",title:"Génération impossible",description:e?.message||"Erreur."});}
    finally{setSaving(false);}
  };

  const validatePayout=async(v:any)=>{
    if(!canManage)return;
    setSaving(true);
    try{
      const {data:userData}=await supabase.auth.getUser();
      const {error}=await (supabase as any).from("portefeuille_versements").update({statut:"valide",valide_par:profiles.find((p:any)=>p.user_id===userData.user?.id)?.id||null,date_validation:new Date().toISOString()}).eq("id",v.id);
      if(error)throw error;
      const ids=(v.lines||[]).map((x:any)=>x.commission_id);
      if(ids.length) await (supabase as any).from("commissions").update({statut:"validee",date_validation:new Date().toISOString()}).in("id",ids);
      toast({title:"Versement validé"});await load();
    }catch(e:any){toast({variant:"destructive",title:"Validation impossible",description:e?.message||"Erreur."});}
    finally{setSaving(false);}
  };

  const markPaid=async(v:any)=>{
    if(!canManage)return;
    setSaving(true);
    try{
      const {data:userData}=await supabase.auth.getUser();
      const payer=profiles.find((p:any)=>p.user_id===userData.user?.id)?.id||null;
      const {error}=await (supabase as any).from("portefeuille_versements").update({statut:"paye",paye_par:payer,date_paiement:new Date().toISOString(),montant_paye:Number(v.montant_brut||0)}).eq("id",v.id);
      if(error)throw error;
      const ids=(v.lines||[]).map((x:any)=>x.commission_id);
      if(ids.length) await (supabase as any).from("commissions").update({statut:"payee"}).in("id",ids);
      const p=profiles.find((x:any)=>x.id===v.profile_id);
      if(p) await (supabase as any).rpc("recalculer_portefeuilles_commissions");
      toast({title:"Versement enregistré"});await load();
    }catch(e:any){toast({variant:"destructive",title:"Paiement impossible",description:e?.message||"Erreur."});}
    finally{setSaving(false);}
  };

  return <ProtectedRoute requiredPermission={["super_admin","pdg","responsable_operations","comptable","responsable_commercial","chef_equipe_commercial","chef_equipe_technique","commercial","technicien"]}>
    <MainLayout>
      <div className="min-w-0 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold">Portefeuilles</h1><p className="text-sm text-muted-foreground">Commissions commerciales, soldes et versements par quinzaine.</p></div>
          <Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Actualiser</Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Solde disponible",stats.solde,Wallet],["Total gagné",stats.gagne,TrendingUp],["Total versé",stats.verse,CircleDollarSign],["Commissions à traiter",stats.pending,CalendarClock]].map(([label,value,Icon]:any)=>
            <Card key={label as string}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary"/></div><div className="mt-2 text-xl font-bold">{money(value)}</div></CardContent></Card>
          )}
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1"><label className="text-xs font-medium">Rechercher</label><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom ou email" className="mt-1"/></div>
            {canManage && <><div><label className="text-xs font-medium">Début quinzaine</label><Input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} className="mt-1"/></div><div><label className="text-xs font-medium">Fin quinzaine</label><Input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className="mt-1"/></div><Button onClick={generateFortnight} disabled={saving}><CalendarClock className="mr-2 h-4 w-4"/>Générer la quinzaine</Button></>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Portefeuilles accessibles</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Collaborateur</TableHead><TableHead>Rôle</TableHead><TableHead>Solde</TableHead><TableHead>Total gagné</TableHead><TableHead>Total versé</TableHead><TableHead>Accès</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading?<TableRow><TableCell colSpan={6} className="py-8 text-center">Chargement…</TableCell></TableRow>:filtered.length===0?<TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucun portefeuille accessible.</TableCell></TableRow>:filtered.map((p:any)=><TableRow key={p.id}><TableCell className="font-medium">{p.user?.nom_complet||"—"}<span className="block text-xs text-muted-foreground">{p.user?.email}</span></TableCell><TableCell><Badge variant="outline">{p.user?.roles?.includes("commercial")?"Commercial":"Technique / Encadrement"}</Badge></TableCell><TableCell className="font-bold text-primary">{money(p.solde_commissions)}</TableCell><TableCell>{money(p.total_gagne)}</TableCell><TableCell>{money(p.total_verse)}</TableCell><TableCell><Badge variant="secondary"><LockKeyhole className="mr-1 h-3 w-3"/>Lecture</Badge></TableCell></TableRow>)}
              </TableBody></Table>
            </div>
          </CardContent>
        </Card>

        {canManage && <Card>
          <CardHeader><CardTitle className="text-base">Versements des commissions</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Collaborateur</TableHead><TableHead>Quinzaine</TableHead><TableHead>Brut</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{versements.filter((v:any)=>visibleProfiles.some((p:any)=>p.id===v.profile_id)).map((v:any)=>{
                const p=profiles.find((x:any)=>x.id===v.profile_id);
                return <TableRow key={v.id}><TableCell>{p?.nom_complet||"—"}</TableCell><TableCell>{format(new Date(v.periode_debut),"dd/MM/yyyy")} — {format(new Date(v.periode_fin),"dd/MM/yyyy")}</TableCell><TableCell className="font-semibold">{money(v.montant_brut)}</TableCell><TableCell><Badge>{v.statut}</Badge></TableCell><TableCell className="text-right"><div className="flex flex-wrap justify-end gap-2">{v.statut==="brouillon"&&<Button size="sm" onClick={()=>validatePayout(v)} disabled={saving}>Valider</Button>}{v.statut==="valide"&&<Button size="sm" onClick={()=>markPaid(v)} disabled={saving}>Marquer payé</Button>}</div></TableCell></TableRow>
              })}</TableBody></Table>
            </div>
          </CardContent>
        </Card>}
      </div>
    </MainLayout>
  </ProtectedRoute>;
}
