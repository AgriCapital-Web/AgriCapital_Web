import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ClientMessagingPanel from "@/components/clients/ClientMessagingPanel";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";

type ClientRow={id:string;nom_complet:string|null;telephone:string;type_client:string;type_client_foncier:string|null;compte_actif:boolean;proprietaire_id:string|null};

const typeLabel=(c:ClientRow)=>{
  if(c.proprietaire_id&&c.type_client==="beneficiaire_particulier") return "Propriétaire · Bénéficiaire";
  if(c.proprietaire_id) return "Propriétaire foncier";
  if(c.type_client==="beneficiaire_particulier") return "Bénéficiaire particulier";
  return "Client";
};

export default function Messagerie(){
  const {can}=usePermissions();
  const [params,setParams]=useSearchParams();
  const [clients,setClients]=useState<ClientRow[]>([]);
  const [unread,setUnread]=useState<Record<string,number>>({});
  const [selected,setSelected]=useState<string|null>(params.get("client"));
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);

  const load=async()=>{
    setLoading(true);
    const {data,error}=await (supabase as any).from("clients")
      .select("id,nom_complet,telephone,type_client,type_client_foncier,compte_actif,proprietaire_id")
      .eq("compte_actif",true).order("nom_complet",{ascending:true});
    if(error){setLoading(false);return;}
    const rows=(data||[]) as ClientRow[];
    setClients(rows);
    const ids=rows.map(c=>c.id);
    if(ids.length){
      const {data:msgs}=await (supabase as any).from("portail_messages")
        .select("client_id,lu,auteur_type").in("client_id",ids).eq("auteur_type","client").eq("lu",false);
      const counts:Record<string,number>={};
      (msgs||[]).forEach((m:any)=>{counts[m.client_id]=(counts[m.client_id]||0)+1;});
      setUnread(counts);
    }
    setLoading(false);
  };

  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    const channel=supabase.channel("crm-messaging-index")
      .on("postgres_changes",{event:"*",schema:"public",table:"portail_messages"},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[]);

  const filtered=useMemo(()=>clients.filter(c=>{
    const hay=[c.nom_complet,c.telephone,c.type_client].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(query.toLowerCase());
  }),[clients,query]);

  const choose=(id:string)=>{setSelected(id);setParams({client:id});};
  const current=clients.find(c=>c.id===selected)||null;

  if(!can("clients.view")) return <ProtectedRoute><MainLayout><Card><CardContent className="p-8 text-center">Accès non autorisé.</CardContent></Card></MainLayout></ProtectedRoute>;

  return <ProtectedRoute><MainLayout>
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary"/><h1 className="text-2xl font-bold">Messagerie</h1></div><p className="text-sm text-muted-foreground">Un seul canal CRM ↔ portail pour les clients, propriétaires fonciers et bénéficiaires.</p></div>
        <Badge variant="outline">{clients.length} dossier(s) portail</Badge>
      </div>

      <div className="grid min-h-[620px] grid-cols-1 gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b p-3"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Rechercher un dossier…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
          <div className="max-h-[620px] overflow-y-auto p-2">
            {loading?<p className="p-5 text-center text-xs text-muted-foreground">Chargement…</p>:
            filtered.map(c=><button key={c.id} onClick={()=>choose(c.id)} className={`mb-1 w-full rounded-xl p-3 text-left transition ${selected===c.id?"bg-primary text-primary-foreground":"hover:bg-muted"}`}>
              <div className="flex items-start gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.nom_complet||"Dossier sans nom"}</p><p className={`truncate text-[10px] ${selected===c.id?"text-white/70":"text-muted-foreground"}`}>{c.telephone}</p><div className="mt-1 flex items-center gap-1"><Badge variant={selected===c.id?"secondary":"outline"} className="text-[9px]">{typeLabel(c)}</Badge>{(unread[c.id]||0)>0&&<Badge className="h-5 min-w-5 px-1 text-[9px]">{unread[c.id]}</Badge>}</div></div></div>
            </button>)}
          </div>
        </Card>

        <div className="min-w-0">
          {current?<ClientMessagingPanel key={current.id} clientId={current.id}/>:<Card className="h-full"><CardContent className="flex h-full min-h-[620px] flex-col items-center justify-center text-center"><MessageSquare className="mb-3 h-12 w-12 text-muted-foreground/30"/><p className="font-semibold">Sélectionnez un dossier</p><p className="max-w-sm text-xs text-muted-foreground">La conversation est la même que celle visible par le client dans le portail.</p></CardContent></Card>}
        </div>
      </div>
    </div>
  </MainLayout></ProtectedRoute>;
}
