import { useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { PERMISSIONS } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, Wallet, TrendingUp, CircleDollarSign, Coins } from "lucide-react";
import { exportFinancialWorkbook } from "@/utils/financialExcelExport";
import TableSearchInput from "@/components/common/TableSearchInput";

const money=(n:any)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"XOF",maximumFractionDigits:0}).format(Number(n||0));

export default function RapportsFinanciers(){
  const [rows,setRows]=useState<any[]>([]);
  const [payments,setPayments]=useState<any[]>([]);
  const [commissions,setCommissions]=useState<any[]>([]);
  const [moneyRows,setMoneyRows]=useState<any[]>([]);
  const [districts,setDistricts]=useState<any[]>([]);
  const [regions,setRegions]=useState<any[]>([]);
  const [clients,setClients]=useState<any[]>([]);
  const [district,setDistrict]=useState("all");
  const [region,setRegion]=useState("all");
  const [offer,setOffer]=useState("all");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [loading,setLoading]=useState(true);
  const [tableSearch,setTableSearch]=useState("");

  const load=async()=>{
    setLoading(true);
    try{
      const [s,c,p,cm,m,d,r]=await Promise.all([
        (supabase as any).from("v_client_synthese").select("*").eq("compte_actif",true).order("nom_complet"),
        (supabase as any).from("clients").select("id,id_unique,district_id,region_id,formule_nom,formule_code").eq("compte_actif",true),
        (supabase as any).from("paiements").select("id,client_id,montant,montant_paye,statut,date_paiement,type_paiement").order("date_paiement",{ascending:false}),
        (supabase as any).from("commissions").select("id,client_id,montant_commission,statut,date_calcul"),
        (supabase as any).from("v_monnaie_clients").select("client_id,monnaie_client"),
        (supabase as any).from("v_geo_districts").select("id,nom").eq("est_actif_effectif",true).order("nom"),
        (supabase as any).from("v_geo_regions").select("id,nom").eq("est_active_effectif",true).order("nom"),
      ]);
      if(s.error)throw s.error;if(c.error)throw c.error;if(p.error)throw p.error;if(cm.error)throw cm.error;
      setRows(s.data||[]);setClients(c.data||[]);setPayments(p.data||[]);setCommissions(cm.data||[]);setMoneyRows(m.data||[]);setDistricts(d.data||[]);setRegions(r.data||[]);
    }catch(e:any){console.error(e);}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);

  const clientMeta=useMemo(()=>new Map(clients.map(c=>[c.id,c])),[clients]);
  const filtered=useMemo(()=>rows.filter(r=>{
    const meta=clientMeta.get(r.client_id);
    if(district!=="all"&&meta?.district_id!==district)return false;
    if(region!=="all"&&meta?.region_id!==region)return false;
    if(offer!=="all"&&(r.offre_nom||"")!==offer)return false;
    return true;
  }),[rows,clientMeta,district,region,offer]);

  const ids=new Set(filtered.map(r=>r.client_id));
  const filteredPayments=payments.filter(p=>{
    if(!ids.has(p.client_id))return false;
    if(from&&p.date_paiement&&p.date_paiement<from)return false;
    if(to&&p.date_paiement&&p.date_paiement>to+"T23:59:59")return false;
    return true;
  });
  const filteredCommissions=commissions.filter(c=>ids.has(c.client_id));
  const forecast=filtered.reduce((s,r)=>s+Number(r.montant_total_contrat||0),0);
  const collected=filteredPayments.filter(p=>p.statut==="valide").reduce((s,p)=>s+Number(p.montant_paye??p.montant??0),0);
  const remaining=Math.max(0,forecast-collected);
  const clientMoney=moneyRows.filter(r=>ids.has(r.client_id)).reduce((s,r)=>s+Number(r.monnaie_client||0),0);
  const commissionsPaid=filteredCommissions.filter(c=>c.statut==="payee").reduce((s,c)=>s+Number(c.montant_commission||0),0);
  const gross=collected;
  const net=collected-commissionsPaid;

  const exportReport=()=>{
    const date=new Date().toLocaleDateString("fr-FR");
    const data=[
      ["RAPPORT FINANCIER GLOBAL — AGRICAPITAL","","",""],
      ["Situation au "+date,"","",""],
      ["Indicateur","Montant","Périmètre",""],
      ["Chiffre d'affaires prévisionnel",forecast,"CRM global selon filtres",""],
      ["Montant encaissé",collected,"Paiements validés",""],
      ["Montant restant à encaisser",remaining,"Contrats moins encaissements",""],
      ["Chiffre d'affaires brut encaissé",gross,"Encaissements validés",""],
      ["Commissions payées",commissionsPaid,"Commissions effectivement versées",""],
      ["Encaissements nets après commissions",net,"Encaissements moins commissions payées",""],
      ["Monnaie client",clientMoney,"Registre interne",""],
      [],
      ["CLIENT","RÉFÉRENCE","OFFRE","HECTARES","CA PRÉVISIONNEL","ENCAISSÉ","RESTANT","AVANCEMENT"],
      ...filtered.map(r=>[r.nom_complet,r.id_unique,r.offre_nom,Number(r.total_hectares||0),Number(r.montant_total_contrat||0),Number(r.total_paye||0),Number(r.reste_a_payer||0),Number(r.pourcentage_avancement||0)/100])
    ];
    void exportFinancialWorkbook([{name:"Rapport global",rows:data,widths:[34,22,30,14,22,20,22,16],merges:["A1:H1","A2:H2"],freeze:3,autoFilter:true,moneyCols:[1,4,5,6]}],`rapport-financier-global-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const offers=Array.from(new Set(rows.map(r=>r.offre_nom).filter(Boolean))).sort();
  const tableRows=filtered.filter((r:any)=>JSON.stringify(r).toLowerCase().includes(tableSearch.trim().toLowerCase()));
  return <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_RAPPORTS_FINANCIERS}>
    <MainLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold">Rapports financiers</h1><p className="text-sm text-muted-foreground">Synthèse financière globale des activités enregistrées dans le CRM.</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Actualiser</Button><Button onClick={exportReport}><Download className="mr-2 h-4 w-4"/>Exporter</Button></div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ["Chiffre d'affaires prévisionnel",forecast,Wallet],
            ["Montant encaissé",collected,CircleDollarSign],
            ["Montant restant à encaisser",remaining,TrendingUp],
            ["Chiffre d'affaires brut encaissé",gross,Wallet],
            ["Commissions payées",commissionsPaid,Coins],
          ].map(([label,value,Icon]:any)=><Card key={label}><CardContent className="p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary"/></div><p className="mt-2 text-xl font-bold">{money(value)}</p></CardContent></Card>)}
        </div>

        <Card><CardHeader><CardTitle>Lecture globale</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Encaissements nets après commissions</p><p className="text-lg font-bold">{money(net)}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Clients dans le périmètre</p><p className="text-lg font-bold">{filtered.length}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Monnaie client</p><p className="text-lg font-bold">{money(clientMoney)}</p></div>
        </div></CardContent></Card>

        <Card><CardHeader><CardTitle>Filtres</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select value={district} onValueChange={setDistrict}><SelectTrigger><SelectValue placeholder="District"/></SelectTrigger><SelectContent><SelectItem value="all">Tous les districts</SelectItem>{districts.map(d=><SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>)}</SelectContent></Select>
          <Select value={region} onValueChange={setRegion}><SelectTrigger><SelectValue placeholder="Région"/></SelectTrigger><SelectContent><SelectItem value="all">Toutes les régions</SelectItem>{regions.map(r=><SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>)}</SelectContent></Select>
          <Select value={offer} onValueChange={setOffer}><SelectTrigger><SelectValue placeholder="Offre"/></SelectTrigger><SelectContent><SelectItem value="all">Toutes les offres</SelectItem>{offers.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
          <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} aria-label="Date de début"/>
          <Input type="date" value={to} onChange={e=>setTo(e.target.value)} aria-label="Date de fin"/>
        </div></CardContent></Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Contrats et encaissements</CardTitle>
              <TableSearchInput value={tableSearch} onChange={setTableSearch} placeholder="Rechercher un client…" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3">Client</th><th className="text-left p-3">Offre</th><th className="text-right p-3">CA prévisionnel</th><th className="text-right p-3">Encaissé</th><th className="text-right p-3">Restant</th><th className="text-right p-3">Avancement</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center">Chargement…</td></tr>
                  ) : tableRows.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune donnée dans le périmètre sélectionné.</td></tr>
                  ) : tableRows.map((r:any) => (
                    <tr key={r.client_id} className="border-b">
                      <td className="p-3">{r.nom_complet}<span className="block text-xs text-muted-foreground">{r.id_unique}</span></td>
                      <td className="p-3"><Badge variant="outline">{r.offre_nom||"—"}</Badge></td>
                      <td className="p-3 text-right">{money(r.montant_total_contrat)}</td>
                      <td className="p-3 text-right">{money(r.total_paye)}</td>
                      <td className="p-3 text-right">{money(r.reste_a_payer)}</td>
                      <td className="p-3 text-right">{Number(r.pourcentage_avancement||0).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  </ProtectedRoute>;
}
