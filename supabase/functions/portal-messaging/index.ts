import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-portal-session",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2,"0")).join("");
}

async function verifyPortalSession(token:unknown):Promise<{clientId:string;sessionId:string}|null>{
  if(typeof token!=="string"||token.length<40) return null;
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const tokenHash=await sha256(token);
  const {data,error}=await supabase.from("client_portal_sessions")
    .select("id,client_id,expires_at").eq("token_hash",tokenHash).is("revoked_at",null)
    .gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error||!data) return null;
  await supabase.from("client_portal_sessions").update({
    last_seen_at:new Date().toISOString(),
    expires_at:new Date(Date.now()+12*60*60*1000).toISOString()
  }).eq("id",data.id);
  return {clientId:data.client_id,sessionId:data.id};
}

async function canUsePlantation(supabase:any,clientId:string,plantationId:string){
  const {data:p}=await supabase.from("plantations").select("id,client_id,parcelle_id").eq("id",plantationId).maybeSingle();
  if(!p) return false;
  if(p.client_id===clientId) return true;

  const {data:c}=await supabase.from("clients").select("proprietaire_id,type_client").eq("id",clientId).maybeSingle();
  if(c?.proprietaire_id){
    const {data:parcel}=await supabase.from("parcelles").select("id").eq("id",p.parcelle_id).eq("proprietaire_id",c.proprietaire_id).maybeSingle();
    if(parcel) return true;
  }
  if(c?.type_client==="beneficiaire_particulier"){
    const {data:a}=await supabase.from("beneficiaire_attributions").select("id")
      .eq("client_id",clientId).eq("statut","active")
      .or(`plantation_id.eq.${plantationId},parcelle_id.eq.${p.parcelle_id}`).limit(1).maybeSingle();
    if(a) return true;
  }
  return false;
}

serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:corsHeaders});
  try{
    const body=await req.json().catch(()=>({}));
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const session=await verifyPortalSession(body.access_token||body.session_token||req.headers.get("x-portal-session"));
    if(!session) return json({success:false,error:"Session portail invalide ou expirée."},401);

    const action=body.action||"list";

    if(action==="list"){
      let query=supabase.from("portail_messages")
        .select("id,client_id,plantation_id,auteur_user_id,auteur_type,auteur_nom,message,lu,created_at,piece_jointe_url,piece_jointe_nom,piece_jointe_type,piece_jointe_taille,piece_jointe_bucket")
        .eq("client_id",session.clientId).order("created_at",{ascending:true}).limit(500);
      if(body.plantation_id) query=query.eq("plantation_id",body.plantation_id);
      const {data,error}=await query;
      if(body.plantation_id) query = query.eq("plantation_id", body.plantation_id);
      if(error) throw error;

      const messagesWithUrls = await Promise.all((data || []).map(async (m:any) => {
        if (!m.piece_jointe_url || !m.piece_jointe_bucket) return m;
        const { data: signed } = await supabase.storage.from(m.piece_jointe_bucket).createSignedUrl(m.piece_jointe_url, 60 * 60);
        return { ...m, piece_jointe_url: signed?.signedUrl || null };
      }));
      const {data:notifications}=await supabase.from("portail_notifications")
        .select("id,type,title,message,data,read,created_at")
        .eq("client_id",session.clientId).order("created_at",{ascending:false}).limit(50);
      return json({
        success:true,messages:messagesWithUrls,
        notifications:notifications||[],
        unread_notifications:(notifications||[]).filter((n:any)=>!n.read).length,
        unread_messages:(data||[]).filter((m:any)=>m.auteur_type==="staff"&&!m.lu).length
      });
    }

    if(action==="notifications"){
      const {data,error}=await supabase.from("portail_notifications")
        .select("id,type,title,message,data,read,created_at")
        .eq("client_id",session.clientId).order("created_at",{ascending:false}).limit(50);
      if(error) throw error;
      return json({success:true,notifications:data||[],unread_count:(data||[]).filter((n:any)=>!n.read).length});
    }

    if(action==="mark_notification_read"){
      if(body.notification_id){
        const {error}=await supabase.from("portail_notifications").update({read:true})
          .eq("client_id",session.clientId).eq("id",body.notification_id);
        if(error) throw error;
      }else{
        const {error}=await supabase.from("portail_notifications").update({read:true})
          .eq("client_id",session.clientId).eq("read",false);
        if(error) throw error;
      }
      return json({success:true});
    }

    if(action==="send"){
      const message=String(body.message||body.contenu||"").trim();
      if(!message||message.length>4000) throw new Error("Message invalide.");
      const plantationId=body.plantation_id||null;
      if(plantationId&&!await canUsePlantation(supabase,session.clientId,plantationId))
        throw new Error("Plantation non autorisée.");

      const attachment = body.attachment && typeof body.attachment === "object" ? body.attachment : null;
      if (attachment) {
        if (!attachment.path || !attachment.bucket || !attachment.name) throw new Error("Pièce jointe invalide.");
        if (attachment.bucket !== "portail-messages" || !String(attachment.path).startsWith(session.clientId + "/")) {
          throw new Error("Pièce jointe non autorisée.");
        }
        if (Number(attachment.size || 0) > 50 * 1024 * 1024) throw new Error("Pièce jointe trop volumineuse.");
      }

      const {data:client}=await supabase.from("clients").select("nom_complet").eq("id",session.clientId).maybeSingle();
      const {data,error}=await supabase.from("portail_messages").insert({
        client_id:session.clientId,plantation_id:plantationId,auteur_type:"client",
        auteur_nom:client?.nom_complet||"Client",message,lu:false,
        piece_jointe_url: attachment?.path || null,
        piece_jointe_nom: attachment?.name || null,
        piece_jointe_type: attachment?.type || null,
        piece_jointe_taille: Number(attachment?.size || 0) || null,
        piece_jointe_bucket: attachment?.bucket || null,
      }).select("id,client_id,plantation_id,auteur_user_id,auteur_type,auteur_nom,message,lu,created_at,piece_jointe_url,piece_jointe_nom,piece_jointe_type,piece_jointe_taille,piece_jointe_bucket").single();
      if(error) throw error;
      let responseMessage:any = data;
      if (data?.piece_jointe_url && data?.piece_jointe_bucket) {
        const { data: signed } = await supabase.storage.from(data.piece_jointe_bucket).createSignedUrl(data.piece_jointe_url, 60 * 60);
        responseMessage = { ...data, piece_jointe_url: signed?.signedUrl || null };
      }
      return json({success:true,message:responseMessage});
    }

    if(action==="mark_read"||action==="read"){
      let query=supabase.from("portail_messages").update({lu:true})
        .eq("client_id",session.clientId).eq("auteur_type","staff").eq("lu",false);
      if(body.message_id) query=query.eq("id",body.message_id);
      if(body.plantation_id) query=query.eq("plantation_id",body.plantation_id);
      const {error}=await query;
      if(error) throw error;
      return json({success:true});
    }

    throw new Error("Action inconnue.");
  }catch(error:any){
    console.error("portal-messages",error);
    return json({success:false,error:error?.message||"Erreur serveur."},400);
  }
});