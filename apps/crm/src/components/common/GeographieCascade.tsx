import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/common/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  districtId?: string | null; regionId?: string | null; departementId?: string | null; sousPrefectureId?: string | null; villageId?: string | null;
  onChange:(values:{districtId?:string|null;regionId?:string|null;departementId?:string|null;sousPrefectureId?:string|null;villageId?:string|null;villageName?:string|null;regionName?:string|null;departementName?:string|null;sousPrefectureName?:string|null})=>void;
  required?:boolean; showDistrict?:boolean; showVillage?:boolean; className?:string;
}
export default function GeographieCascade({districtId,regionId,departementId,sousPrefectureId,villageId,onChange,required=false,showDistrict=true,showVillage=true,className="grid md:grid-cols-2 gap-4"}:Props){
  const [districts,setDistricts]=useState<any[]>([]),[regions,setRegions]=useState<any[]>([]),[departements,setDepartements]=useState<any[]>([]),[sousPrefectures,setSousPrefectures]=useState<any[]>([]),[villages,setVillages]=useState<any[]>([]);
  useEffect(()=>{(async()=>{const {data}=await (supabase as any).from("v_geo_districts").select("id,nom").eq("est_actif_effectif",true).order("nom");setDistricts(data||[]);})();},[]);
  useEffect(()=>{if(!districtId){setRegions([]);return;} (async()=>{const {data}=await (supabase as any).from("v_geo_regions").select("id,nom").eq("district_id",districtId).eq("est_active_effectif",true).order("nom");setRegions(data||[]);})();},[districtId]);
  useEffect(()=>{if(!regionId){setDepartements([]);return;} (async()=>{const {data}=await (supabase as any).from("v_geo_departements").select("id,nom").eq("region_id",regionId).eq("est_actif_effectif",true).order("nom");setDepartements(data||[]);})();},[regionId]);
  useEffect(()=>{if(!departementId){setSousPrefectures([]);return;} (async()=>{const {data}=await (supabase as any).from("v_geo_sous_prefectures").select("id,nom").eq("departement_id",departementId).eq("est_active_effectif",true).order("nom");setSousPrefectures(data||[]);})();},[departementId]);
  useEffect(()=>{if(!sousPrefectureId){setVillages([]);return;} (async()=>{const {data}=await (supabase as any).from("v_geo_villages").select("id,nom").eq("sous_prefecture_id",sousPrefectureId).eq("est_actif_effectif",true).order("nom");setVillages(data||[]);})();},[sousPrefectureId]);

  const hasChildren=regions.length>0;
  return <div className={className}>
    {showDistrict&&<div className="space-y-2"><Label>District{required?" *":""}</Label><SearchableSelect value={districtId||""} onValueChange={value=>onChange({districtId:value,regionId:null,departementId:null,sousPrefectureId:null,villageId:null})} options={districts.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner le district" searchPlaceholder="Rechercher un district..."/></div>}
    {hasChildren&&<>
      <div className="space-y-2"><Label>Région{required?" *":""}</Label><SearchableSelect value={regionId||""} onValueChange={value=>{const x=regions.find(r=>r.id===value);onChange({regionId:value,departementId:null,sousPrefectureId:null,villageId:null,regionName:x?.nom||null});}} disabled={!districtId} options={regions.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner la région" searchPlaceholder="Rechercher une région..."/></div>
      <div className="space-y-2"><Label>Département{required?" *":""}</Label><SearchableSelect value={departementId||""} onValueChange={value=>{const x=departements.find(d=>d.id===value);onChange({departementId:value,sousPrefectureId:null,villageId:null,departementName:x?.nom||null});}} disabled={!regionId} options={departements.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner le département" searchPlaceholder="Rechercher un département..."/></div>
      <div className="space-y-2"><Label>Sous-préfecture{required?" *":""}</Label><SearchableSelect value={sousPrefectureId||""} onValueChange={value=>{const x=sousPrefectures.find(s=>s.id===value);onChange({sousPrefectureId:value,villageId:null,sousPrefectureName:x?.nom||null});}} disabled={!departementId} options={sousPrefectures.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner la sous-préfecture" searchPlaceholder="Rechercher une sous-préfecture..."/></div>
      {showVillage&&<div className="space-y-2"><Label>Village / localité{required?" *":""}</Label><SearchableSelect value={villageId||""} onValueChange={value=>{const x=villages.find(v=>v.id===value);onChange({villageId:value,villageName:x?.nom||null});}} disabled={!sousPrefectureId} options={villages.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner le village / la localité" searchPlaceholder="Rechercher un village..."/></div>}
    </>}
  </div>;
}