import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
async function sha256(v:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");}

serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response(null,{headers:corsHeaders});
 try{
  const body=await req.json();
  const token=String(body?.access_token||"");
  if(!token) return json({success:false,error:"Session portail manquante."},401);
  const secret= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,secret);
  const tokenHash=await sha256(token);
  const {data:session}=await supabase.from("client_portal_sessions").select("client_id,expires_at,revoked_at").eq("token_hash",tokenHash).maybeSingle();
  if(!session || session.revoked_at || new Date(session.expires_at).getTime()<=Date.now()) return json({success:false,error:"Session portail expirée. Veuillez vous reconnecter."},401);
  await supabase.from("client_portal_sessions").update({last_seen_at:new Date().toISOString()}).eq("token_hash",tokenHash);
  if (body?.action === "quote_payment") {
    const days = Math.max(1, Math.floor(Number(body?.days || 0)));
    const { data: quote, error: quoteError } = await supabase.rpc("portal_quote_payment", {
      _client_id: session.client_id,
      _plantation_id: body?.plantation_id,
      _days: days,
    });
    if (quoteError) throw quoteError;
    return json({ success: true, quote });
  }

  const {data:client,error:clientError}=await supabase.from("clients").select("*,offres(*),regions(id,nom),departements(id,nom),districts(id,nom),sous_prefectures(id,nom),promotions:promotion_id(id,nom,code,pourcentage_reduction,montant_fixe_reduction,date_debut,date_fin,cible,active,applique_toutes_offres,offre_ids)").eq("id",session.client_id).eq("compte_actif",true).eq("statut_global","actif").maybeSingle();
  if(clientError) throw clientError;
  if(!client) return json({success:false,error:"Compte client inactif ou introuvable."},403);

  const [pRes,payRes,commercialRes]=await Promise.all([
   supabase.from("plantations").select("*,regions(id,nom),departements(id,nom),districts(id,nom),sous_prefectures(id,nom)").eq("client_id",client.id).order("created_at",{ascending:false}),
   supabase.from("paiements").select("*").eq("client_id",client.id).order("created_at",{ascending:false}).limit(500),
   client.created_by ? supabase.from("profiles").select("nom_complet,telephone,email,photo_url").eq("user_id",client.created_by).maybeSingle() : Promise.resolve({data:null})
  ]);
  const plantations=pRes.data||[], paiements=payRes.data||[];
  const ids=plantations.map((p:any)=>p.id);

  let tickets:any[]=[]; let reports:any[]=[]; let media:any[]=[]; let interventions:any[]=[];
  if(ids.length){
   const [tRes,rRes,iRes]=await Promise.all([
    supabase.from("tickets_techniques").select("id,titre,description,plantation_id,priorite,statut,date_resolution,created_at,updated_at").in("plantation_id",ids).order("updated_at",{ascending:false}),
    supabase.from("rapports_visites_techniques").select("id,plantation_id,date_visite,type_visite,etat_plantation,contenu_client,prochaine_intervention,client_visible,statut").in("plantation_id",ids).eq("client_visible",true).eq("statut","valide").order("date_visite",{ascending:false}),
    supabase.from("interventions_techniques").select("id,plantation_id,type_intervention,date_intervention,statut,observations,recommandations").in("plantation_id",ids).order("date_intervention",{ascending:true})
   ]);
   tickets=tRes.data||[]; reports=rRes.data||[]; interventions=iRes.data||[];
   const reportIds=reports.map((r:any)=>r.id);
   if(reportIds.length){
    const {data:m}=await supabase.from("rapports_visites_medias").select("id,rapport_id,plantation_id,media_type,storage_path,mime_type,nom_fichier,description,client_visible,created_at").in("rapport_id",reportIds).eq("client_visible",true).order("created_at",{ascending:false});
    media=m||[];
    for(const item of media){if(item.storage_path){const {data:signed}=await supabase.storage.from("rapports-techniques").createSignedUrl(item.storage_path,3600);item.url=signed?.signedUrl||null;}}
   }
  }

  for(const p of plantations){
    p.rapports_visites=reports.filter((r:any)=>r.plantation_id===p.id).map((r:any)=>({...r,medias:media.filter((m:any)=>m.rapport_id===r.id)}));
    p.tickets_techniques=tickets.filter((t:any)=>t.plantation_id===p.id);
    p.interventions_techniques=interventions.filter((i:any)=>i.plantation_id===p.id);
    const byStage:any={};
    for(const i of p.interventions_techniques){
      const key=i.type_intervention==="planting"?"mise_en_terre":i.type_intervention;
      if(!byStage[key] || i.statut==="realisee") byStage[key]={...i,key,type:i.type_intervention,statut:i.statut==="realisee"?"termine":i.statut,date_realisation:i.date_intervention,commentaire:i.observations||i.recommandations||null};
    }
    p.etapes=Object.values(byStage);
    const {data:rate}=await supabase.rpc("portal_client_daily_rate",{_client_id:client.id,_at_date:new Date().toISOString().slice(0,10)});
    p.taux_journalier_ha=Number(rate||0);
  }

  const safe:any={...client,client:true,promotion_active:client.promotions||null,commercial:commercialRes.data?{...commercialRes.data,nom:commercialRes.data.nom_complet,fonction:"Conseiller AgriCapital"}:null,taux_journalier_actuel_ha:Number((await supabase.rpc("portal_client_daily_rate",{_client_id:client.id,_at_date:new Date().toISOString().slice(0,10)})).data||client.taux_journalier_ha||0)};
  delete safe.user_id;delete safe.created_by;delete safe.updated_by;delete safe.numero_piece;delete safe.fichier_piece_url;delete safe.fichier_piece_recto_url;delete safe.fichier_piece_verso_url;delete safe.numero_compte;
  return json({success:true,demo:false,client:safe,souscripteur:safe,plantations,paiements});
 }catch(e:any){console.error("client-portal-data",e);return json({success:false,error:e?.message||"Erreur serveur."},500);}
});