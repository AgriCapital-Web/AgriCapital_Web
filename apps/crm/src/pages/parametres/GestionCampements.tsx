import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, TentTree } from "lucide-react";

type Row = { id:string; nom:string; sous_prefecture_id:string|null; village_noyau_id:string|null; type:string; est_actif:boolean; sous_prefecture_nom:string|null; departement_nom:string|null; region_nom:string|null; district_nom:string|null };

export default function GestionCampements(){
  const [rows,setRows]=useState<Row[]>([]);
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{ (async()=>{
    setLoading(true);
    const {data,error}=await (supabase as any).from("v_geo_campements").select("*").order("nom").limit(1000);
    if(!error && data) setRows(data as Row[]);
    setLoading(false);
  })(); },[]);

  const filtered=rows.filter(r=>[r.nom,r.sous_prefecture_nom,r.departement_nom,r.region_nom,r.district_nom].some(v=>(v||"").toLowerCase().includes(q.toLowerCase())));
  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-4">
      <CardTitle className="flex items-center gap-2"><TentTree className="h-5 w-5"/>Campements & hameaux</CardTitle>
      <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un campement..." className="pl-9"/></div>
    </CardHeader>
    <CardContent>
      <div className="mb-4 text-sm text-muted-foreground">{loading?"Chargement…":`${filtered.length} résultat(s) affiché(s)`}</div>
      <div className="overflow-auto rounded-md border">
        <table className="w-full text-sm"><thead><tr className="border-b bg-muted/40 text-left"><th className="p-3">Campement</th><th className="p-3">Sous-préfecture</th><th className="p-3">Département</th><th className="p-3">Région</th><th className="p-3">District</th><th className="p-3">Type</th><th className="p-3">État</th></tr></thead>
        <tbody>{filtered.map(r=><tr key={r.id} className="border-b last:border-0"><td className="p-3 font-medium">{r.nom}</td><td className="p-3">{r.sous_prefecture_nom||"—"}</td><td className="p-3">{r.departement_nom||"—"}</td><td className="p-3">{r.region_nom||"—"}</td><td className="p-3">{r.district_nom||"—"}</td><td className="p-3">{r.type}</td><td className="p-3"><Badge variant={r.est_actif?"default":"secondary"}>{r.est_actif?"Actif":"Inactif"}</Badge></td></tr>)}</tbody></table>
      </div>
    </CardContent>
  </Card>;
}
