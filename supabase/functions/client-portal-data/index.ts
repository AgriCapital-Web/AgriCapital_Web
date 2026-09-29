import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
async function sha256(v:string){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:corsHeaders});
  try{
    const body=await req.json().catch(()=>({}));
    const token=String(body?.access_token||"");
    if(!token) return json({success:false,error:"Session portail manquante."},401);

    const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,secret);
    const tokenHash=await sha256(token);

    const {data:session}=await supabase
      .from("client_portal_sessions")
      .select("client_id,expires_at,revoked_at")
      .eq("token_hash",tokenHash)
      .maybeSingle();

    if(!session || session.revoked_at || new Date(session.expires_at).getTime()<=Date.now())
      return json({success:false,error:"Session portail expirée. Veuillez vous reconnecter."},401);

    await supabase.from("client_portal_sessions")
      .update({last_seen_at:new Date().toISOString()})
      .eq("token_hash",tokenHash);

    if(body?.action==="quote_payment"){
      const days=Math.max(1,Math.floor(Number(body?.days||0)));
      const {data:quote,error:quoteError}=await supabase.rpc("portal_quote_payment",{
        _client_id:session.client_id,_plantation_id:body?.plantation_id,_days:days
      });
      if(quoteError) throw quoteError;
      return json({success:true,quote});
    }

    const {data:client,error:clientError}=await supabase
      .from("clients")
      .select("*,offres(*),regions(id,nom),departements(id,nom),districts(id,nom),sous_prefectures(id,nom),promotions:promotion_id(id,nom,code,pourcentage_reduction,montant_fixe_reduction,date_debut,date_fin,cible,active,applique_toutes_offres,offre_ids)")
      .eq("id",session.client_id)
      .eq("compte_actif",true)
      .eq("statut_global","actif")
      .maybeSingle();

    if(clientError) throw clientError;
    if(!client) return json({success:false,error:"Compte portail inactif ou introuvable."},403);

    const isOwner=Boolean(client.proprietaire_id);
    const isBeneficiary=client.type_client==="beneficiaire_particulier";
    const isStakeholder=isOwner||isBeneficiary;

    const portalRoles=[
      ...(isOwner?["proprietaire_foncier"]:[]),
      ...(isBeneficiary?["beneficiaire_particulier"]:[]),
      ...(!isOwner&&!isBeneficiary?["client"]:[])
    ];

    const [ownerRes, attributionRes, directPlantationRes, payRes, commercialRes, notificationRes] = await Promise.all([
      client.proprietaire_id
        ? supabase.from("proprietaires_terres").select("*").eq("id",client.proprietaire_id).maybeSingle()
        : Promise.resolve({data:null}),
      supabase.from("beneficiaire_attributions")
        .select("id,client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,reference_acte,notes,created_at")
        .eq("client_id",client.id).eq("statut","active").order("created_at",{ascending:true}),
      supabase.from("plantations")
        .select("*,regions(id,nom),departements(id,nom),districts(id,nom),sous_prefectures(id,nom)")
        .eq("client_id",client.id).order("created_at",{ascending:false}),
      supabase.from("paiements").select("*").eq("client_id",client.id).order("created_at",{ascending:false}).limit(500),
      client.created_by
        ? supabase.from("profiles").select("nom_complet,telephone,email,photo_url").eq("user_id",client.created_by).maybeSingle()
        : Promise.resolve({data:null}),
      supabase.from("portail_notifications").select("id,type,title,message,data,read,created_at")
        .eq("client_id",client.id).order("created_at",{ascending:false}).limit(50)
    ]);

    const owner=ownerRes.data||null;
    const attributions=attributionRes.data||[];
    const directPlantations=directPlantationRes.data||[];
    const paiements=payRes.data||[];
    const notificationRows=notificationRes.data||[];

    let parcelleIds:string[]=[];
    if(owner?.id){
      const {data:ownerParcelles}=await supabase.from("parcelles").select("*")
        .eq("proprietaire_id",owner.id).order("created_at",{ascending:false});
      var parcelles=ownerParcelles||[];
      parcelleIds=parcelles.map((p:any)=>p.id);
    } else {
      parcelleIds=[...new Set(attributions.map((a:any)=>a.parcelle_id).filter(Boolean))];
      if(parcelleIds.length){
        const {data:benefParcelles}=await supabase.from("parcelles").select("*")
          .in("id",parcelleIds).order("created_at",{ascending:false});
        var parcelles=benefParcelles||[];
      } else {
        var parcelles:any[]=[];
      }
    }

    let sharedPlantations:any[]=[];
    if(parcelleIds.length){
      const {data:byParcel}=await supabase.from("plantations")
        .select("*,regions(id,nom),departements(id,nom),districts(id,nom),sous_prefectures(id,nom)")
        .in("parcelle_id",parcelleIds).order("created_at",{ascending:false});
      sharedPlantations=byParcel||[];
    }

    const plantationMap=new Map<string,any>();
    for(const p of [...directPlantations,...sharedPlantations]) plantationMap.set(p.id,p);
    const plantations=[...plantationMap.values()];

    // Attribution -> plantation est conservée explicitement pour que le portail
    // puisse afficher les droits du bénéficiaire même lorsque client_id de la plantation est NULL.
    const attributionPlantationIds=new Set(attributions.map((a:any)=>a.plantation_id).filter(Boolean));
    for(const p of plantations){
      p.attributions=attributions.filter((a:any)=>a.plantation_id===p.id || (!a.plantation_id && a.parcelle_id===p.parcelle_id));
    }

    const ids=plantations.map((p:any)=>p.id);
    let tickets:any[]=[]; let reports:any[]=[]; let media:any[]=[];
    if(ids.length){
      const [tRes,rRes]=await Promise.all([
        supabase.from("tickets_techniques").select("id,titre,description,plantation_id,priorite,statut,date_resolution,created_at,updated_at")
          .in("plantation_id",ids).order("updated_at",{ascending:false}),
        supabase.from("rapports_visites_techniques").select("id,plantation_id,date_visite,type_visite,etat_plantation,contenu_client,prochaine_intervention,client_visible,statut")
          .in("plantation_id",ids).eq("client_visible",true).eq("statut","valide").order("date_visite",{ascending:false})
      ]);
      tickets=tRes.data||[];
      reports=rRes.data||[];
      const reportIds=reports.map((r:any)=>r.id);
      if(reportIds.length){
        const {data:m}=await supabase.from("rapports_visites_medias")
          .select("id,rapport_id,plantation_id,media_type,storage_path,mime_type,nom_fichier,description,client_visible,created_at")
          .in("rapport_id",reportIds).eq("client_visible",true).order("created_at",{ascending:false});
        media=m||[];
        for(const item of media){
          if(item.storage_path){
            const {data:signed}=await supabase.storage.from("rapports-techniques").createSignedUrl(item.storage_path,3600);
            item.url=signed?.signedUrl||null;
          }
        }
      }
    }

    let dailyRate=Number(client.taux_journalier_ha||0);
    if(!isStakeholder){
      const {data:rate}=await supabase.rpc("portal_client_daily_rate",{_client_id:client.id,_at_date:new Date().toISOString().slice(0,10)});
      dailyRate=Number(rate||dailyRate||0);
    }

    for(const p of plantations){
      p.rapports_visites=reports.filter((r:any)=>r.plantation_id===p.id)
        .map((r:any)=>({...r,medias:media.filter((m:any)=>m.rapport_id===r.id)}));
      p.tickets_techniques=tickets.filter((t:any)=>t.plantation_id===p.id);
      p.taux_journalier_ha=dailyRate;
    }

    const safe:any={...client,client:true,portal_roles:portalRoles,portal_primary_role:portalRoles[0]||"client",
      is_proprietaire_foncier:isOwner,is_beneficiaire_particulier:isBeneficiary,
      promotion_active:client.promotions||null,
      proprietaire:owner,
      commercial:commercialRes.data?{...commercialRes.data,nom:commercialRes.data.nom_complet,fonction:"Conseiller AgriCapital"}:null,
      taux_journalier_actuel_ha:dailyRate,
      portail_notifications_unread:notificationRows.filter((n:any)=>!n.read).length};
    delete safe.user_id; delete safe.created_by; delete safe.updated_by; delete safe.numero_piece;
    delete safe.fichier_piece_url; delete safe.fichier_piece_recto_url; delete safe.fichier_piece_verso_url; delete safe.numero_compte;

    return json({
      success:true,demo:false,client:safe,souscripteur:safe,
      portal_roles:portalRoles,parcelles,attributions,plantations,paiements,
      notifications:notificationRows
    });
  }catch(e:any){
    console.error("client-portal-data",e);
    return json({success:false,error:e?.message||"Erreur serveur."},500);
  }
});