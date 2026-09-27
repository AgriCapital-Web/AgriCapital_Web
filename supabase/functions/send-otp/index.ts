import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { createPortalSession, normalizePhone, phoneMatches } from "../_shared/portal-session.ts";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const ip=(req:Request)=>req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
const admin=()=>createClient(Deno.env.get("SUPABASE_URL")||"",JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||"",{auth:{autoRefreshToken:false,persistSession:false}});
const otp=()=>String((new DataView(crypto.getRandomValues(new Uint8Array(4)).buffer).getUint32(0)%900000)+100000);
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,"0")).join("");

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:corsHeaders});
  if(req.method!=="POST") return json({success:false,error:"POST requis"},405);
  try{
    const body=await req.json();
    const action=body?.action==="verify"?"verify":body?.action==="status"?"status":"send";
    const phone=normalizePhone(body?.telephone);
    if(!phone||phone.length<8||phone.length>15) return json({success:false,error:"Numéro invalide"},400);
    const db=admin();
    const key=ip(req).slice(0,120);
    const since=new Date(Date.now()-15*60*1000).toISOString();
    const {count}=await db.from("rate_limits").select("*",{count:"exact",head:true}).eq("identifier",`otp:${key}`).eq("action","portal_otp").gt("first_attempt_at",since);
    if((count||0)>=20) return json({success:false,error:"Trop de tentatives. Réessayez plus tard."},429);
    await db.from("rate_limits").insert({identifier:`otp:${key}`,action:"portal_otp"});
    const suffix=phone.slice(-8);
    const {data:candidates}=await db.from("clients").select("id,telephone").ilike("telephone",`%${suffix}%`).limit(50);
    const client=(candidates||[]).find((c:any)=>phoneMatches(c.telephone,phone));

    if(action==="status"){
      const {data:last}=await db.from("otp_codes").select("created_at,expires_at,verified,attempts").eq("telephone",phone).order("created_at",{ascending:false}).limit(1).maybeSingle();
      const exp=last?.expires_at?new Date(last.expires_at).getTime():0;
      return json({success:true,status:{created_at:last?.created_at??null,expires_at:last?.expires_at??null,verified:!!last?.verified,attempts:last?.attempts??0,expired:!exp||exp<=Date.now()}});
    }

    if(!client) return json({success:true,message:"Si ce numéro est enregistré, un code sera envoyé."});

    if(action==="verify"){
      const code=typeof body?.code==="string"?body.code.trim():"";
      if(!/^\d{6}$/.test(code)) return json({success:false,error:"Code invalide"},400);
      const {data:row}=await db.from("otp_codes").select("id,code,expires_at,attempts").eq("telephone",phone).eq("verified",false).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(!row) return json({success:false,error:"Code expiré ou inexistant."},400);
      if((row.attempts||0)>=5) return json({success:false,error:"Trop de tentatives. Demandez un nouveau code."},429);
      await db.from("otp_codes").update({attempts:(row.attempts||0)+1}).eq("id",row.id);
      if(row.code!==await hash(`${code}:${phone}`)) return json({success:false,error:"Code incorrect."},400);
      await db.from("otp_codes").update({verified:true,expires_at:new Date().toISOString()}).eq("id",row.id);
      return json({success:true,message:"Code vérifié",portal_token:await createPortalSession(phone)});
    }

    const smsKey=Deno.env.get("INFOBIP_API_KEY"), smsBase=Deno.env.get("INFOBIP_BASE_URL");
    if(!smsKey||!smsBase) return json({success:false,error:"Le service SMS n'est pas configuré."},503);
    const ten=new Date(Date.now()-10*60*1000).toISOString();
    const {count:recent}=await db.from("otp_codes").select("*",{count:"exact",head:true}).eq("telephone",phone).gt("created_at",ten);
    if((recent||0)>=3) return json({success:false,error:"Trop de demandes de code. Réessayez plus tard."},429);
    await db.from("otp_codes").update({expires_at:new Date().toISOString()}).eq("telephone",phone).eq("verified",false);
    const code=otp(), expires=new Date(Date.now()+5*60*1000).toISOString();
    const formatted=phone.startsWith("225")?phone:`225${phone}`;
    const sms=await fetch(`${smsBase}/sms/2/text/advanced`,{method:"POST",headers:{Authorization:`App ${smsKey}`,"Content-Type":"application/json"},body:JSON.stringify({messages:[{destinations:[{to:formatted}],from:"AgriCapital",text:`Votre code AgriCapital: ${code}. Valide 5 min. Ne partagez jamais ce code.`}]})});
    if(!sms.ok) return json({success:false,error:"Impossible d'envoyer le code. Réessayez plus tard."},502);
    const {error}=await db.from("otp_codes").insert({telephone:phone,code:await hash(`${code}:${phone}`),expires_at:expires,verified:false,attempts:0});
    if(error) throw error;
    return json({success:true,simulated:false,message:"Code envoyé par SMS."});
  }catch(e){console.error("send-otp",e);return json({success:false,error:"Erreur interne."},500)}
});