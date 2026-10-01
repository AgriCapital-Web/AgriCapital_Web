import MediaUploadVisual from "@/components/ui/media-upload-visual";
import { useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { offlineInsert } from "@/lib/offlineWrite";
import { uploadOrQueueFile } from "@/lib/offlineFiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TECH_ROLES=["technicien","chef_equipe_technique","responsable_operations","super_admin","pdg"];
const STAGES_AGRICAPITAL=[
  ["validation_parcelle","Validation de la parcelle"],
  ["defrichage","Défrichage"],
  ["piquetage","Piquetage"],
  ["trouaison","Trouaison"],
  ["mise_en_terre","Planting / mise en terre"],
  ["remplacement","Remplacement"],
  ["entretien","Entretien"],
  ["fertilisation","Fertilisation"],
  ["mise_en_production","Mise en production"],
  ["remise","Remise de plantation"],
  ["suivi_mensuel","Suivi mensuel"],
  ["autre","Autre"],
];
const STAGES_PALMTERROIR_AVANT_PLANTATION=[["validation_parcelle","Validation de la parcelle"],["piquetage","Piquetage"],["trouaison","Trouaison"],["mise_en_terre","Planting / mise en terre"]];
const STAGES_PALMTERROIR_APRES_PLANTATION=[["suivi_mensuel","Suivi / encadrement technique"],["autre","Autre suivi technique"]];
const isPalmTerroir=(p:any)=>String(p?.formule_code||p?.client?.formule_code||"").toLowerCase().includes("palm-terroir");

const TechnicienTerrain=()=>{
  const {user,userRoles}=useAuth();
  const {toast}=useToast();
  const {can}=usePermissions();
  const allowed=can("rapports.view_technique") || userRoles.some(r=>TECH_ROLES.includes(r));
  const manager=userRoles.some(r=>["chef_equipe_technique","responsable_operations","super_admin","pdg"].includes(r));
  const [plantations,setPlantations]=useState<any[]>([]);
  const [clients,setClients]=useState<any[]>([]);
  const [parcelles,setParcelles]=useState<any[]>([]);
  const [reports,setReports]=useState<any[]>([]);
  const [interventions,setInterventions]=useState<any[]>([]);
  const [tickets,setTickets]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [activeTab,setActiveTab]=useState("rapport");
  const [saving,setSaving]=useState(false);
  const [report,setReport]=useState<any>({
    plantation_id:"",date_visite:new Date().toISOString().slice(0,16),type_visite:"suivi",
    constat:"",travaux_realises:"",etat_plantation:"",observations:"",recommandations:"",contenu_client:"",
    prochaine_intervention:"",localisation_gps_lat:"",localisation_gps_lng:""
  });
  const [media,setMedia]=useState<File[]>([]);
  const [intervention,setIntervention]=useState<any>({
    plantation_id:"",client_id:"",parcelle_id:"",type_intervention:"defrichage",date_intervention:new Date().toISOString().slice(0,10),
    observations:"",recommandations:"",statut:"planifiee",nombre_plants_prevus:"",nombre_plants_realises:"",nombre_plants_remplaces:"",densite_plants:"143"
  });

  const profileContext=async()=>{
    const uid=user?.id;
    if(!uid)return null;
    const {data}=await (supabase as any).from("profiles").select("id,equipe_id,nom_complet").eq("user_id",uid).maybeSingle();
    return data||null;
  };

  const load=async()=>{
    if(!allowed)return;
    setLoading(true);
    const profile=await profileContext();
    const [{data:p},{data:c},{data:pa},{data:r},{data:i},{data:t}]=await Promise.all([
      (supabase as any).from("plantations").select("id,id_unique,nom_plantation,nom,superficie_ha,client_id,statut_global,prochaine_visite,date_plantation").order("nom_plantation"),
      (supabase as any).from("clients").select("id,id_unique,formule_code,formule_nom,famille_offre,nom_complet,total_hectares,parcelle_id").order("nom_complet"),
      (supabase as any).from("parcelles").select("id,id_unique,nom,village,surface_totale_ha,region_id,plantation_date_activation,plantation_type_culture,plantation_densite_plants").order("nom"),
      (supabase as any).from("rapports_visites_techniques").select("*,plantation:plantations(id_unique,nom_plantation),agent:profiles!rapports_visites_techniques_agent_technique_id_fkey(nom_complet)").order("date_visite",{ascending:false}).limit(100),
      (supabase as any).from("interventions_techniques").select("*,plantation:plantations(id_unique,nom_plantation),agent:profiles!interventions_techniques_agent_technique_id_fkey(nom_complet)").order("date_intervention",{ascending:false}).limit(100)
      ,(supabase as any).from("tickets_techniques").select("*,client:clients(nom_complet),plantation:plantations(id_unique,nom_plantation)").eq("assigne_a",profile?.id||"00000000-0000-0000-0000-000000000000").order("created_at",{ascending:false})
    ]);
    setPlantations(p||[]);setClients(c||[]);setParcelles(pa||[]);setReports(r||[]);setInterventions(i||[]);setTickets(t||[]);setLoading(false);
  };

  useEffect(()=>{load();},[allowed]);

  const plantation=useMemo(()=>{
    const p=plantations.find(x=>x.id===report.plantation_id);
    if(!p)return null;
    return {...p,client:clients.find(c=>c.id===p.client_id)||null};
  },[plantations,clients,report.plantation_id]);
  const palmTerroir=useMemo(()=>isPalmTerroir(plantation),[plantation]);
  const applicableStages=palmTerroir?(plantation?.date_plantation?STAGES_PALMTERROIR_APRES_PLANTATION:STAGES_PALMTERROIR_AVANT_PLANTATION):STAGES_AGRICAPITAL;

  const saveReport=async(submit:boolean)=>{
    if(!report.plantation_id){toast({variant:"destructive",title:"Plantation requise"});return;}
    if(!report.constat&&!report.travaux_realises&&!report.observations){toast({variant:"destructive",title:"Rapport incomplet",description:"Renseignez au moins le constat ou les travaux réalisés."});return;}
    setSaving(true);
    try{
      const profile=await profileContext(); if(!profile?.id)throw new Error("Profil technicien introuvable");
      const id=crypto.randomUUID();
      const payload={
        id,plantation_id:report.plantation_id,client_id:plantation?.client_id||null,agent_technique_id:profile.id,equipe_id:profile.equipe_id||null,ticket_id:report.ticket_id||null,
        date_visite:new Date(report.date_visite).toISOString(),type_visite:report.type_visite,
        constat:report.constat||null,travaux_realises:report.travaux_realises||null,etat_plantation:report.etat_plantation||null,
        observations:report.observations||null,recommandations:report.recommandations||null,contenu_client:report.contenu_client||null,
        prochaine_intervention:report.prochaine_intervention||null,
        localisation_gps_lat:report.localisation_gps_lat?Number(report.localisation_gps_lat):null,
        localisation_gps_lng:report.localisation_gps_lng?Number(report.localisation_gps_lng):null,
        statut:submit?"soumis":"brouillon",client_visible:false,created_by:profile.id
      };
      const {error}=await offlineInsert("rapports_visites_techniques",payload);
      if(error)throw error;
      for(const file of media){
        const path=`plantations/${report.plantation_id}/rapports/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
        const uploaded=await uploadOrQueueFile({bucket:"rapports-techniques",path,file});
        await offlineInsert("rapports_visites_medias",{
          id:crypto.randomUUID(),rapport_id:id,plantation_id:report.plantation_id,
          media_type:file.type.startsWith("video/")?"video":"photo",storage_path:uploaded.path,
          mime_type:file.type,nom_fichier:file.name,client_visible:false,created_by:profile.id
        });
      }
      toast({title:submit?"Rapport soumis":"Brouillon enregistré",description:media.length?`${media.length} média(s) rattaché(s).`:undefined});
      setMedia([]);
      setReport({ticket_id:"",plantation_id:"",date_visite:new Date().toISOString().slice(0,16),type_visite:"suivi",constat:"",travaux_realises:"",etat_plantation:"",observations:"",recommandations:"",contenu_client:"",prochaine_intervention:"",localisation_gps_lat:"",localisation_gps_lng:""});
      load();
    }catch(e:any){toast({variant:"destructive",title:"Enregistrement impossible",description:e?.message||"Erreur inconnue"});}
    finally{setSaving(false);}
  };

  const saveIntervention=async()=>{
    const interventionPlantation=plantations.find(p=>p.id===intervention.plantation_id);
    const interventionClient=clients.find(c=>c.id===(intervention.client_id||interventionPlantation?.client_id));
    const targetClientId=intervention.client_id||interventionPlantation?.client_id||null;
    const targetParcelleId=intervention.parcelle_id||interventionClient?.parcelle_id||interventionPlantation?.parcelle_id||null;
    const isPrePlantationStage=["defrichage","piquetage","trouaison","mise_en_terre"].includes(intervention.type_intervention);
    if(!targetClientId){toast({variant:"destructive",title:"Client / dossier requis",description:"Sélectionnez le Client ou dossier concerné."});return;}
    if(!targetParcelleId){toast({variant:"destructive",title:"Parcelle requise",description:"La parcelle doit être rattachée au Client avant l’intervention."});return;}
    if(!isPrePlantationStage && !intervention.plantation_id){toast({variant:"destructive",title:"Plantation requise",description:"Cette étape intervient après la création de la plantation."});return;}
    const technicalContext={...interventionPlantation,client:interventionClient,date_plantation:interventionPlantation?.date_plantation};
    const interventionStages=isPalmTerroir(technicalContext)
      ? (interventionPlantation?.date_plantation?STAGES_PALMTERROIR_APRES_PLANTATION:STAGES_PALMTERROIR_AVANT_PLANTATION)
      : STAGES_AGRICAPITAL;
    if(!interventionStages.some(([code])=>code===intervention.type_intervention)){toast({variant:"destructive",title:"Étape non applicable",description:"Cette étape n’est pas autorisée pour le parcours ou la phase actuelle."});return;}
    setSaving(true);
    try{
      const profile=await profileContext(); if(!profile?.id)throw new Error("Profil technicien introuvable");
      const payload={...intervention,id:crypto.randomUUID(),agent_technique_id:profile.id,
        client_id:targetClientId,parcelle_id:targetParcelleId,plantation_id:intervention.plantation_id||null,
        nombre_plants_prevus:intervention.nombre_plants_prevus?Number(intervention.nombre_plants_prevus):null,
        nombre_plants_realises:intervention.nombre_plants_realises?Number(intervention.nombre_plants_realises):null,
        nombre_plants_remplaces:intervention.nombre_plants_remplaces?Number(intervention.nombre_plants_remplaces):null,
        densite_plants:intervention.densite_plants?Number(intervention.densite_plants):143
      };
      const {error}=await offlineInsert("interventions_techniques",payload);
      if(error)throw error;
      toast({title:intervention.type_intervention==="mise_en_terre"&&intervention.statut==="realisee"?"Mise en terre validée":"Intervention enregistrée",description:intervention.type_intervention==="mise_en_terre"&&intervention.statut==="realisee"?"La plantation sera créée automatiquement par la base de données.":undefined});
      setIntervention({plantation_id:"",client_id:"",parcelle_id:"",type_intervention:"defrichage",date_intervention:new Date().toISOString().slice(0,10),observations:"",recommandations:"",statut:"planifiee",nombre_plants_prevus:"",nombre_plants_realises:"",nombre_plants_remplaces:"",densite_plants:"143"});
      load();
    }catch(e:any){toast({variant:"destructive",title:"Enregistrement impossible",description:e?.message||"Erreur inconnue"});}
    finally{setSaving(false);}
  };

  const validateReport=async(r:any,publish:boolean)=>{
    if(!manager)return;
    const {error}=await (supabase as any).from("rapports_visites_techniques").update({statut:publish?"valide":"rejete",client_visible:publish}).eq("id",r.id);
    if(error)toast({variant:"destructive",title:"Validation impossible",description:error.message});
    else{toast({title:publish?"Rapport validé et publié":"Rapport refusé"});load();}
  };

  if(!allowed)return <ProtectedRoute><MainLayout><Card><CardHeader><CardTitle>Accès technicien</CardTitle><CardDescription>Cette interface est réservée aux accès techniques autorisés.</CardDescription></CardHeader></Card></MainLayout></ProtectedRoute>;

  return <ProtectedRoute><MainLayout><div className="min-w-0 w-full max-w-full space-y-6 overflow-hidden">
    <div><h1 className="text-3xl font-bold">Technique — suivi des plantations</h1><p className="text-muted-foreground">Visites, interventions, rapports et médias des plantations.</p></div>

    <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 w-full">
      <div className="w-full min-w-0 overflow-x-auto pb-1"><TabsList className="inline-flex min-w-max whitespace-nowrap"><TabsTrigger value="demandes">Demandes à traiter {tickets.length>0&&<Badge className="ml-2">{tickets.length}</Badge>}</TabsTrigger><TabsTrigger value="rapport">Rapport de visite</TabsTrigger><TabsTrigger value="intervention">Intervention</TabsTrigger><TabsTrigger value="historique">Historique</TabsTrigger></TabsList></div>

      <TabsContent value="demandes" className="space-y-4">
        <Card><CardHeader><CardTitle>Demandes clients à traiter</CardTitle><CardDescription>Les demandes qui vous sont affectées apparaissent ici. Ouvrez une demande pour préparer directement votre rapport.</CardDescription></CardHeader><CardContent className="space-y-3">
          {tickets.length===0?<p className="text-sm text-muted-foreground">Aucune demande en attente.</p>:tickets.map(t=><div key={t.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{t.titre}</p><p className="text-sm text-muted-foreground">{t.client?.nom_complet||"Client"} · {t.plantation?.nom_plantation||t.plantation?.id_unique||"Plantation"}</p></div><Badge>{t.priorite}</Badge></div>
            <p className="text-sm mt-2">{t.description}</p>
            <div className="flex justify-end mt-3"><Button onClick={()=>{setReport((x:any)=>({...x,ticket_id:t.id,plantation_id:t.plantation_id,type_visite:"incident",constat:t.description||"",recommandations:t.action_recommandee||""}));setActiveTab("rapport");}}>Intervenir et faire le rapport</Button></div>
          </div>)}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="rapport" className="space-y-5">
        <Card><CardHeader><CardTitle>Nouveau rapport terrain</CardTitle><CardDescription>Le rapport reste privé jusqu’à validation technique.</CardDescription></CardHeader><CardContent className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Demande support</Label><Select value={report.ticket_id||"none"} onValueChange={v=>setReport((x:any)=>({...x,ticket_id:v==="none"?"":v}))}><SelectTrigger><SelectValue placeholder="Aucune demande liée"/></SelectTrigger><SelectContent><SelectItem value="none">Aucune</SelectItem>{tickets.map(t=><SelectItem key={t.id} value={t.id}>{t.titre}</SelectItem>)}</SelectContent></Select></div><div><Label>Plantation *</Label><Select value={report.plantation_id} onValueChange={v=>setReport((x:any)=>({...x,plantation_id:v}))}><SelectTrigger><SelectValue placeholder="Sélectionner une plantation"/></SelectTrigger><SelectContent>{plantations.map(p=><SelectItem key={p.id} value={p.id}>{p.nom_plantation||p.nom||p.id_unique}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Date et heure *</Label><Input type="datetime-local" value={report.date_visite} onChange={e=>setReport((x:any)=>({...x,date_visite:e.target.value}))}/></div>
            <div><Label>Type de visite</Label><Select value={report.type_visite} onValueChange={v=>setReport((x:any)=>({...x,type_visite:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="suivi">Suivi</SelectItem><SelectItem value="installation">Installation</SelectItem><SelectItem value="controle">Contrôle</SelectItem><SelectItem value="incident">Incident</SelectItem><SelectItem value="remise">Remise de plantation</SelectItem></SelectContent></Select></div>
            <div><Label>État de la plantation</Label><Input value={report.etat_plantation} onChange={e=>setReport((x:any)=>({...x,etat_plantation:e.target.value}))} placeholder="Bon, à surveiller, intervention urgente…"/></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4"><div><Label>Constat</Label><Textarea value={report.constat} onChange={e=>setReport((x:any)=>({...x,constat:e.target.value}))}/></div><div><Label>{palmTerroir?"Actions d’encadrement / suivi":"Travaux réalisés"}</Label><Textarea value={report.travaux_realises} onChange={e=>setReport((x:any)=>({...x,travaux_realises:e.target.value}))}/></div></div>
          <div className="grid md:grid-cols-2 gap-4"><div><Label>Observations internes</Label><Textarea value={report.observations} onChange={e=>setReport((x:any)=>({...x,observations:e.target.value}))}/></div><div><Label>Recommandations internes</Label><Textarea value={report.recommandations} onChange={e=>setReport((x:any)=>({...x,recommandations:e.target.value}))}/></div></div>
          <div><Label>Message destiné au client</Label><Textarea value={report.contenu_client} onChange={e=>setReport((x:any)=>({...x,contenu_client:e.target.value}))} placeholder="Ce message pourra être publié dans l’espace client après validation technique."/><p className="text-xs text-muted-foreground mt-1">Seul ce contenu est destiné à être présenté au client.</p>{palmTerroir&&<p className="text-xs text-amber-700 mt-1">PalmTerroir : après la mise en terre, AgriCapital assure l’encadrement, les recommandations et le suivi ; les travaux d’entretien et les intrants restent à la charge du client.</p>}</div>
          <div className="grid md:grid-cols-3 gap-4"><div><Label>Prochaine intervention</Label><Input type="date" value={report.prochaine_intervention} onChange={e=>setReport((x:any)=>({...x,prochaine_intervention:e.target.value}))}/></div><div><Label>Latitude</Label><Input value={report.localisation_gps_lat} onChange={e=>setReport((x:any)=>({...x,localisation_gps_lat:e.target.value}))}/></div><div><Label>Longitude</Label><Input value={report.localisation_gps_lng} onChange={e=>setReport((x:any)=>({...x,localisation_gps_lng:e.target.value}))}/></div></div>
          <div><Label>Photos / vidéos</Label><MediaUploadVisual label="Photos / vidéos" files={media} onChange={setMedia}/><p className="text-xs text-muted-foreground mt-1">Les médias restent privés jusqu’à validation du rapport.</p></div>
          <div className="flex gap-3 justify-end"><Button variant="outline" disabled={saving} onClick={()=>saveReport(false)}>Enregistrer brouillon</Button><Button disabled={saving} onClick={()=>saveReport(true)}>Soumettre le rapport</Button></div>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="intervention" className="space-y-5">
        <Card><CardHeader><CardTitle>Intervention technique</CardTitle><CardDescription>Pour une intervention avant plantation, sélectionnez le Client et sa parcelle. La plantation n’est créée automatiquement qu’après validation de la mise en terre réalisée.</CardDescription></CardHeader><CardContent className="space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Client / dossier *</Label><Select value={intervention.client_id} onValueChange={v=>setIntervention((x:any)=>({...x,client_id:v,parcelle_id:clients.find(c=>c.id===v)?.parcelle_id||x.parcelle_id,plantation_id:""}))}><SelectTrigger><SelectValue placeholder="Sélectionner un Client"/></SelectTrigger><SelectContent>{clients.map(c=><SelectItem key={c.id} value={c.id}>{c.nom_complet} · {c.id_unique}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Parcelle *</Label><Select value={intervention.parcelle_id} onValueChange={v=>setIntervention((x:any)=>({...x,parcelle_id:v}))}><SelectTrigger><SelectValue placeholder="Sélectionner une parcelle"/></SelectTrigger><SelectContent>{parcelles.filter(pa=>!intervention.client_id||clients.find(c=>c.id===intervention.client_id)?.parcelle_id===pa.id).map(pa=><SelectItem key={pa.id} value={pa.id}>{pa.id_unique}{pa.village?` · ${pa.village}`:""}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Plantation</Label><Select value={intervention.plantation_id||"none"} onValueChange={v=>{const p=plantations.find(x=>x.id===v);const density=Number(intervention.densite_plants||143);const planned=p?.superficie_ha?Math.round(Number(p.superficie_ha)*density):"";setIntervention((x:any)=>({...x,plantation_id:v==="none"?"":v,client_id:p?.client_id||x.client_id,parcelle_id:p?.parcelle_id||clients.find(c=>c.id===p?.client_id)?.parcelle_id||x.parcelle_id,nombre_plants_prevus:planned}));}}><SelectTrigger><SelectValue placeholder="Aucune si avant plantation"/></SelectTrigger><SelectContent><SelectItem value="none">Aucune — avant plantation</SelectItem>{plantations.filter(p=>!intervention.client_id||p.client_id===intervention.client_id).map(p=><SelectItem key={p.id} value={p.id}>{p.nom_plantation||p.nom||p.id_unique} · {p.id_unique}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Date *</Label><Input type="date" value={intervention.date_intervention} onChange={e=>setIntervention((x:any)=>({...x,date_intervention:e.target.value}))}/></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Étape technique</Label><Select value={intervention.type_intervention} onValueChange={v=>setIntervention((x:any)=>({...x,type_intervention:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{((()=>{const p=plantations.find(x=>x.id===intervention.plantation_id);const c=clients.find(x=>x.id===(intervention.client_id||p?.client_id));const stages=isPalmTerroir({...p,client:c})?(p?.date_plantation?STAGES_PALMTERROIR_APRES_PLANTATION:STAGES_PALMTERROIR_AVANT_PLANTATION):STAGES_AGRICAPITAL;return stages;})()).map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Statut</Label><Select value={intervention.statut} onValueChange={v=>setIntervention((x:any)=>({...x,statut:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="planifiee">Planifiée</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="realisee">Réalisée</SelectItem><SelectItem value="annulee">Annulée</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4"><div><Label>Constat / observations</Label><Textarea value={intervention.observations} onChange={e=>setIntervention((x:any)=>({...x,observations:e.target.value}))}/></div><div><Label>Recommandations</Label><Textarea value={intervention.recommandations} onChange={e=>setIntervention((x:any)=>({...x,recommandations:e.target.value}))}/></div></div>|140n           {(intervention.type_intervention==="mise_en_terre"||intervention.type_intervention==="remplacement") && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border bg-muted/20 p-4"><div><Label>Densité (plants/ha)</Label><Input type="number" min="1" value={intervention.densite_plants} onChange={e=>setIntervention((x:any)=>({...x,densite_plants:e.target.value}))}/><p className="text-[10px] text-muted-foreground mt-1">Valeur par défaut : |140 plants/ha.</p></div><div><Label>Plants prévus</Label><Input type="number" min="0" value={intervention.nombre_plants_prevus} onChange={e=>setIntervention((x:any)=>({...x,nombre_plants_prevus:e.target.value}))}/></div><div><Label>{intervention.type_intervention==="remplacement"?"Plants remplacés":"Plants mis en terre"}</Label><Input type="number" min="0" value={intervention.type_intervention==="remplacement"?intervention.nombre_plants_remplaces:intervention.nombre_plants_realises} onChange={e=>setIntervention((x:any)=>intervention.type_intervention==="remplacement"?({...x,nombre_plants_remplaces:e.target.value}):({...x,nombre_plants_realises:e.target.value}))}/></div><div><Label>Calcul prévu</Label><div className="h-10 rounded-md border bg-background px-3 flex items-center text-sm">{(()=>{const p=plantations.find(x=>x.id===intervention.plantation_id);const ha=Number(p?.superficie_ha||0);return ha?`${Math.round(ha*Number(intervention.densite_plants||143))} plants`:"Sélectionnez une plantation";})()}</div></div></div>}
          <div className="flex justify-end"><Button disabled={saving} onClick={saveIntervention}>Enregistrer l’intervention</Button></div>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="historique"><div className="grid lg:grid-cols-2 gap-5">
        <Card><CardHeader><CardTitle>Rapports récents</CardTitle></CardHeader><CardContent className="space-y-3">{loading?"Chargement…":reports.length===0?"Aucun rapport.":reports.map(r=><div key={r.id} className="border rounded-lg p-3"><div className="flex justify-between gap-3"><div><p className="font-medium">{r.plantation?.nom_plantation||r.plantation?.id_unique}</p><p className="text-xs text-muted-foreground">{new Date(r.date_visite).toLocaleString("fr-FR")}</p></div><Badge variant={r.client_visible?"default":"outline"}>{r.client_visible?"Publié":"Privé · "+r.statut}</Badge></div><p className="text-sm mt-2">{r.constat||r.observations||"—"}</p>{manager&&r.statut==="soumis"&&<div className="flex gap-2 mt-3"><Button size="sm" onClick={()=>validateReport(r,true)}>Valider & publier</Button><Button size="sm" variant="outline" onClick={()=>validateReport(r,false)}>Refuser</Button></div>}</div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Interventions récentes</CardTitle></CardHeader><CardContent className="space-y-3">{interventions.length===0?"Aucune intervention.":interventions.map(i=><div key={i.id} className="border rounded-lg p-3"><div className="flex justify-between"><p className="font-medium">{i.plantation?.nom_plantation||i.plantation?.id_unique}</p><Badge variant="outline">{i.type_intervention}</Badge></div><p className="text-xs text-muted-foreground mt-1">{new Date(i.date_intervention).toLocaleDateString("fr-FR")} · {i.statut}</p><p className="text-sm mt-2">{i.observations||"—"}</p></div>)}</CardContent></Card>
      </div></TabsContent>
    </Tabs>
  </div></MainLayout></ProtectedRoute>;
};
export default TechnicienTerrain;
