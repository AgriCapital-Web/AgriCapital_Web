import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
const title=(s)=>String(s||"").toLocaleLowerCase("fr-FR").replace(/(^|[\\s-])([a-zà-ÿ])/g,(_,a,b)=>a+b.toLocaleUpperCase("fr-FR"));
const fetchForm=async(url,params)=>{const body=new URLSearchParams(params);const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});if(!res.ok)throw new Error("ANStat "+res.status+" "+url);return await res.json();};
const allPages=async(url,params)=>{const out=[];for(let page=1;page<=50;page++){const json=await fetchForm(url,{...params,page:String(page),pagination:"oui"});const rows=json.results||[];out.push(...rows);if(!json.result_info?.next||rows.length===0)break;}return out;};
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response(JSON.stringify({error:"POST requis"}),{status:405});
 if(req.headers.get("x-agricapital-geography-secret")!==Deno.env.get("NOTIFICATION_CRON_SECRET"))return new Response(JSON.stringify({error:"Non autorisé"}),{status:401});
 try{
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
  const base="https://api-public.anstat.ci/api/v1";
  const dr=await fetch(base+"/districts?annee=2021");if(!dr.ok)throw new Error("ANStat districts "+dr.status);const districts=(await dr.json()).results||[];
  for(const d of districts){await admin.from("districts").upsert({code:String(d.code_district),nom:title(d.nom_district),est_actif:true},{onConflict:"code"});}
  const ds=(await admin.from("districts").select("id,code")).data||[];const dm=new Map(ds.map(d=>[String(d.code),d.id]));
  const regions=await allPages(base+"/regions",{annee:"2021"});
  for(const r of regions){const district_id=dm.get(String(r.cod_dist));if(!district_id)continue;const payload={nom:title(r.nom_reg),code:String(r.cod_reg),district_id,est_active:true};const e=(await admin.from("regions").select("id").eq("code",String(r.cod_reg)).maybeSingle()).data;if(e)await admin.from("regions").update(payload).eq("id",e.id);else await admin.from("regions").insert(payload);}
  const rs=(await admin.from("regions").select("id,code")).data||[];const rm=new Map(rs.map(r=>[String(r.code),r.id]));
  const departments=await allPages(base+"/departements",{annee:"2021"});
  for(const d of departments){const region_id=rm.get(String(d.cod_reg));if(!region_id)continue;const name=title(d.nom_dep);const e=(await admin.from("departements").select("id").eq("region_id",region_id).ilike("nom",name).maybeSingle()).data;const payload={nom:name,code:String(d.cod_dep),region_id,est_actif:true};if(e)await admin.from("departements").update(payload).eq("id",e.id);else await admin.from("departements").insert(payload);}
  const deps=(await admin.from("departements").select("id,code")).data||[];const depm=new Map(deps.map(d=>[String(d.code),d.id]));
  const subpref=await allPages(base+"/sous-prefectures",{annee:"2021"});
  for(const s of subpref){const departement_id=depm.get(String(s.cod_dep));if(!departement_id)continue;const name=title(s.nom_sp);const composite="CI"+String(s.cod_dep).padStart(3,"0")+"-"+String(s.cod_sp).padStart(3,"0");const e=(await admin.from("sous_prefectures").select("id").eq("departement_id",departement_id).ilike("nom",name).maybeSingle()).data;const payload={nom:name,code:composite,code_sp:composite,departement_id,est_active:true,sp_assigned_at:new Date().toISOString()};if(e)await admin.from("sous_prefectures").update(payload).eq("id",e.id);else await admin.from("sous_prefectures").insert(payload);}
  return new Response(JSON.stringify({success:true,districts:districts.length,regions:regions.length,departements:departments.length,sous_prefectures:subpref.length}),{headers:{"Content-Type":"application/json"}});
 }catch(error){console.error(error);return new Response(JSON.stringify({success:false,error:error?.message||"Synchronisation impossible"}),{status:500,headers:{"Content-Type":"application/json"}});}
});