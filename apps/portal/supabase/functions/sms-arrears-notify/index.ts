import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-cron-secret" };
const formatMontant=(m:number)=>new Intl.NumberFormat("fr-FR").format(Math.round(m));
const formatPhone=(phone:string)=>{const c=phone.replace(/\D/g,"");return c.startsWith("225")?c:"225"+c;};

async function sendSms(base:string|undefined,key:string|undefined,to:string,text:string){
  if(!base||!key){console.log("[DEV SMS]",to,text);return {sent:false,dev:true};}
  const res=await fetch(`${base}/sms/2/text/advanced`,{method:"POST",headers:{Authorization:`App ${key}`,"Content-Type":"application/json"},body:JSON.stringify({messages:[{destinations:[{to:formatPhone(to)}],from:"AgriCapital",text}]})});
  return {sent:res.ok,status:res.status};
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:corsHeaders});
  try{
    const auth=req.headers.get("Authorization"); const cron=req.headers.get("x-cron-secret"); const expected=Deno.env.get("CRON_SECRET");
    let authorized=Boolean(expected&&cron&&cron===expected);
    if(!authorized&&auth?.startsWith("Bearer ")){
      const uc=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
      const token=auth.replace("Bearer ",""); const {data:claims}=await uc.auth.getClaims(token); const uid=claims?.claims?.sub as string|undefined;
      if(uid){const ac=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);authorized=(await ac.rpc("is_admin",{_user_id:uid})).data===true;}
    }
    if(!authorized)return new Response(JSON.stringify({success:false,error:"Non autorisé"}),{headers:{...corsHeaders,"Content-Type":"application/json"},status:401});

    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body=await req.json().catch(()=>({})); const mode=body.mode||"both";
    const today=new Date().toISOString().slice(0,10); const in3=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    const results={arrears:[] as any[],upcoming:[] as any[],errors:[] as string[]};

    const {data:clients,error}=await supabase.from("clients").select("id,nom_complet,telephone,user_id,paiement_personnalise").eq("compte_actif",true).in("statut_global",["actif","active"]);
    if(error)throw error;

    for(const client of clients||[]){
      if(!client.telephone)continue;
      const custom=client.paiement_personnalise||{}; const monthly=custom.mensualite||{}; const initial=custom.paiement_initial||{};
      const customActive=custom.actif===true; const monthlyActive=monthly.active===true&&Number(monthly.montant||0)>0&&Number(monthly.nombre||0)>0;
      const {data:pending}=await supabase.from("paiements").select("id,montant,date_echeance,statut,type_paiement,plantation_id").eq("client_id",client.id).eq("statut","en_attente").eq("type_paiement","REDEVANCE").order("date_echeance",{ascending:true});
      const overdue=(pending||[]).filter(p=>p.date_echeance&&p.date_echeance<today); const upcoming=(pending||[]).filter(p=>p.date_echeance&&p.date_echeance>=today&&p.date_echeance<=in3);
      const arrears=overdue.reduce((s,p)=>s+Number(p.montant||0),0); const firstDue=overdue[0]?.date_echeance; const daysLate=firstDue?Math.max(1,Math.floor((Date.now()-new Date(firstDue).getTime())/86400000)):0;

      if((mode==="arrears"||mode==="both")&&monthlyActive&&arrears>0){
        const text=`AgriCapital: Bonjour ${client.nom_complet||"cher client"}, votre arriéré est de ${formatMontant(arrears)} F CFA (${daysLate}j). Votre échéancier personnalisé est actif. Régularisez sur pay.agricapital.ci.`;
        const sent=await sendSms(Deno.env.get("INFOBIP_BASE_URL"),Deno.env.get("INFOBIP_API_KEY"),client.telephone,text);
        results.arrears.push({client_id:client.id,montant_arriere:arrears,jours_retard:daysLate,...sent});
      }

      if(mode==="upcoming"||mode==="both"){
        if(customActive&&Number(initial.solde||0)>0){
          const solde=Number(initial.solde); const text=`AgriCapital: Bonjour ${client.nom_complet||"cher client"}, votre solde de Paiement Initial est de ${formatMontant(solde)} F CFA. Retrouvez votre situation sur pay.agricapital.ci.`;
          const sent=await sendSms(Deno.env.get("INFOBIP_BASE_URL"),Deno.env.get("INFOBIP_API_KEY"),client.telephone,text);
          results.upcoming.push({client_id:client.id,type:"solde_pi",montant:solde,...sent});
        }
        if(monthlyActive){
          for(const payment of upcoming.slice(0,1)){
            const text=`AgriCapital: Rappel — échéance personnalisée de ${formatMontant(Number(payment.montant))} F CFA le ${new Date(payment.date_echeance).toLocaleDateString("fr-FR")}.`;
            const sent=await sendSms(Deno.env.get("INFOBIP_BASE_URL"),Deno.env.get("INFOBIP_API_KEY"),client.telephone,text);
            results.upcoming.push({client_id:client.id,paiement_id:payment.id,montant:Number(payment.montant),...sent});
          }
        }else if(!customActive){
          for(const payment of upcoming.slice(0,1)){
            const text=`AgriCapital: Rappel — échéance de ${formatMontant(Number(payment.montant))} F CFA le ${new Date(payment.date_echeance).toLocaleDateString("fr-FR")}.`;
            const sent=await sendSms(Deno.env.get("INFOBIP_BASE_URL"),Deno.env.get("INFOBIP_API_KEY"),client.telephone,text);
            results.upcoming.push({client_id:client.id,paiement_id:payment.id,montant:Number(payment.montant),...sent});
          }
        }
      }
    }

    await supabase.from("historique_activites").insert({table_name:"sms_notifications",action:"SMS_BATCH_SENT",details:`Arrears: ${results.arrears.length}, Upcoming: ${results.upcoming.length}, Errors: ${results.errors.length}`});
    return new Response(JSON.stringify({success:true,results}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e:any){console.error("SMS notification error:",e);return new Response(JSON.stringify({success:false,error:e.message}),{headers:{...corsHeaders,"Content-Type":"application/json"},status:500});}
});