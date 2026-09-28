import { corsHeaders } from "npm:@supabase/supabase-js@2";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const response=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const Schema=z.object({imageDataUrl:z.string().startsWith("data:image/").max(15_000_000),documentType:z.string().max(80).optional()});

Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return response({error:"Méthode non autorisée."},405);
 try{
   const token=(req.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");
   const admin=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
   const auth=await admin.auth.getUser(token);
   if(!auth.data.user) return response({error:"Non authentifié."},401);
   const parsed=Schema.safeParse(await req.json());
   if(!parsed.success) return response({error:"Image invalide."},400);
   const key=Deno.env.get("LOVABLE_API_KEY"); if(!key) return response({error:"Service IA non configuré."},503);
   const prompt="Analyse cette pièce d’identité. Retourne UNIQUEMENT un JSON valide sous la forme {numero_piece,type_piece,confiance}. Extrais le numéro officiel visible sur la pièce, sans le deviner. Si absent ou illisible, numero_piece doit être vide. type_piece doit être l’un de cni,cni_cedeao,passeport,attestation,carte_consulaire,permis,carte_sejour,titre_sejour,autre. confiance est un nombre entre 0 et 1.";
   const r=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Lovable-API-Key":key},body:JSON.stringify({model:"google/gemini-3-flash-preview",messages:[{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:parsed.data.imageDataUrl}}]}],temperature:0,response_format:{type:"json_object"}})});
   if(!r.ok) return response({error:"Analyse IA indisponible."},502);
   const p=await r.json(); const raw=p?.choices?.[0]?.message?.content;
   let result:any={numero_piece:"",type_piece:"",confiance:0}; try{result={...result,...JSON.parse(typeof raw==="string"?raw:"{}")}}catch{}
   return response({success:true,numero_piece:String(result.numero_piece||"").trim().slice(0,120),type_piece:String(result.type_piece||"").trim(),confiance:Math.max(0,Math.min(1,Number(result.confiance)||0))});
 }catch(e){return response({error:e instanceof Error?e.message:"Erreur interne."},500);}
});