import { useEffect,useState } from "react";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/common/SearchableSelect";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";
import CountryPhoneInput from "@/components/common/CountryPhoneInput";
import PieceTypeSelect from "@/components/common/PieceTypeSelect";
import { supabase } from "@/integrations/supabase/client";

interface Props{formData:any;updateFormData:(data:any)=>void;}\n\nconst upperName=(value:string)=>value.toLocaleUpperCase("fr-FR");
const CODES=[["+225","Côte d’Ivoire"],["+33","France"],["+1","USA / Canada"],["+32","Belgique"],["+41","Suisse"],["+44","Royaume-Uni"],["+221","Sénégal"],["+224","Guinée"],["+226","Burkina Faso"],["+223","Mali"],["+237","Cameroun"],["+228","Togo"],["+229","Bénin"]];

export const EtapeClientDynamique=({formData,updateFormData}:Props)=>{
 const [districts,setDistricts]=useState<any[]>([]),[regions,setRegions]=useState<any[]>([]),[departements,setDepartements]=useState<any[]>([]),[sps,setSps]=useState<any[]>([]),[villages,setVillages]=useState<any[]>([]);
 useEffect(()=>{(async()=>{const {data}=await (supabase as any).from("districts").select("id,nom").eq("est_actif",true).order("nom");setDistricts(data||[]);})();},[]);
 useEffect(()=>{if(!formData.district_id){setRegions([]);return;} (async()=>{const {data}=await (supabase as any).from("v_geo_regions").select("id,nom").eq("district_id",formData.district_id).eq("est_active_effectif",true).order("nom");setRegions(data||[]);})();},[formData.district_id]);
 useEffect(()=>{if(!formData.region_id){setDepartements([]);return;} (async()=>{const {data}=await (supabase as any).from("v_geo_departements").select("id,nom").eq("region_id",formData.region_id).eq("est_actif_effectif",true).order("nom");setDepartements(data||[]);})();},[formData.region_id]);
 useEffect(()=>{if(!formData.departement_id){setSps([]);setVillages([]);return;} (async()=>{const {data}=await (supabase as any).from("v_geo_sous_prefectures").select("id,nom").eq("departement_id",formData.departement_id).eq("est_active_effectif",true).order("nom");setSps(data||[]);})();},[formData.departement_id]);
 useEffect(()=>{if(!formData.sous_prefecture_id){setVillages([]);return;} (async()=>{const {data}=await (supabase as any).from("v_geo_villages").select("id,nom").eq("sous_prefecture_id",formData.sous_prefecture_id).eq("est_actif_effectif",true).order("nom");setVillages(data||[]);})();},[formData.sous_prefecture_id]);
 const file=(field:string,label:string,accept=".pdf,image/jpeg,image/png",ocr=false)=><FileUploadVisual label={label} field={field} accept={accept} required currentFile={formData[field+"_file"]||null} currentPreview={formData[field+"_preview"]||""} onFileChange={(f,value,preview)=>updateFormData({[field+"_file"]:value,[field+"_preview"]:preview})} onIdentityNumberDetected={ocr?n=>updateFormData({numero_piece:n}):undefined} identityDocumentType={formData.type_piece}/>;
 const phone=(field:"telephone"|"whatsapp",label:string)=> <CountryPhoneInput label={label} required={field==="telephone"} countryCode={formData[field+"_indicatif"]||"+225"} localValue={formData[field+"_local"]||""} onChange={v=>updateFormData({[field+"_indicatif"]:v.callingCode,[field+"_local"]:v.localValue,[field]:v.internationalValue})}/>;
 return <div className="space-y-6">
  <Card><CardHeader><CardTitle>Identité du Client</CardTitle><CardDescription>Informations utilisées dans le dossier et les documents contractuels.</CardDescription></CardHeader><CardContent className="space-y-4">
   <div className="grid md:grid-cols-3 gap-4"><div><Label>Civilité *</Label><Select value={formData.civilite||""} onValueChange={v=>updateFormData({civilite:v})}><SelectTrigger><SelectValue placeholder="Sélectionner"/></SelectTrigger><SelectContent><SelectItem value="M">M.</SelectItem><SelectItem value="Mme">Mme</SelectItem><SelectItem value="Mlle">Mlle</SelectItem></SelectContent></Select></div><div><Label>Nom de famille *</Label><Input value={formData.nom_famille||""} onChange={e=>updateFormData({nom_famille:upperName(e.target.value)})}/></div><div><Label>Prénoms *</Label><Input value={formData.prenoms||""} onChange={e=>updateFormData({prenoms:upperName(e.target.value)})}/></div></div>
   <div className="grid md:grid-cols-3 gap-4"><div><Label>Date de naissance *</Label><Input type="date" value={formData.date_naissance||""} onChange={e=>updateFormData({date_naissance:e.target.value})}/></div><div><Label>Lieu de naissance *</Label><Input value={formData.lieu_naissance||""} onChange={e=>updateFormData({lieu_naissance:e.target.value})}/></div><div><Label>Nationalité *</Label><Input value={formData.nationalite||""} onChange={e=>updateFormData({nationalite:e.target.value})} placeholder="Ivoirienne"/></div></div>
   <div><Label>Situation matrimoniale</Label><Select value={formData.statut_marital||""} onValueChange={v=>updateFormData({statut_marital:v})}><SelectTrigger><SelectValue placeholder="Sélectionner"/></SelectTrigger><SelectContent><SelectItem value="celibataire">Célibataire</SelectItem><SelectItem value="marie">Marié(e)</SelectItem><SelectItem value="divorce">Divorcé(e)</SelectItem><SelectItem value="veuf">Veuf(ve)</SelectItem></SelectContent></Select></div>
  </CardContent></Card>

  <Card><CardHeader><CardTitle>Pièce d’identité et photos</CardTitle><CardDescription>La pièce recto/verso et la photo du Client font partie du dossier.</CardDescription></CardHeader><CardContent className="space-y-4">
   <div className="grid md:grid-cols-3 gap-4"><div><Label>Type de pièce *</Label><PieceTypeSelect value={formData.type_piece||""} onChange={v=>updateFormData({type_piece:v})}/></div><div><Label>Numéro de pièce *</Label><Input value={formData.numero_piece||""} onChange={e=>updateFormData({numero_piece:e.target.value})}/></div><div><Label>Date de délivrance</Label><Input type="date" value={formData.date_delivrance_piece||""} onChange={e=>updateFormData({date_delivrance_piece:e.target.value})}/></div></div>
   <div className="grid md:grid-cols-2 gap-4">{file("photo_piece_recto","Pièce d’identité — recto *",".pdf,image/jpeg,image/png",true)}{file("photo_piece_verso","Pièce d’identité — verso *")}</div>{file("photo_profil","Photo du Client *","image/*")}
  </CardContent></Card>

  <Card><CardHeader><CardTitle>Coordonnées et résidence</CardTitle><CardDescription>Téléphone avec indicatif international, WhatsApp, adresse et localisation administrative.</CardDescription></CardHeader><CardContent className="space-y-4">
   <div className="grid md:grid-cols-2 gap-4">{phone("telephone","Téléphone *")}{phone("whatsapp","WhatsApp")}</div>
   <div><Label>Email</Label><Input type="email" value={formData.email||""} onChange={e=>updateFormData({email:e.target.value})}/></div>
   <div><Label>Adresse complète *</Label><Input value={formData.domicile||""} onChange={e=>updateFormData({domicile:e.target.value})} placeholder="Quartier, rue, commune, ville..."/></div>
   <div className="grid md:grid-cols-4 gap-4">
    <div><Label>District</Label><SearchableSelect value={formData.district_id||""} onValueChange={v=>updateFormData({district_id:v,region_id:null,departement_id:null,sous_prefecture_id:null,village_id:null})} options={districts.map(x=>({value:x.id,label:x.nom}))} placeholder="District" searchPlaceholder="Rechercher un district..." /></div>
    <div><Label>Région</Label><SearchableSelect value={formData.region_id||""} onValueChange={v=>updateFormData({region_id:v,departement_id:null,sous_prefecture_id:null,village_id:null})} disabled={!formData.district_id} options={regions.map(x=>({value:x.id,label:x.nom}))} placeholder="Région" searchPlaceholder="Rechercher une région..." /></div>
    <div><Label>Département</Label><SearchableSelect value={formData.departement_id||""} onValueChange={v=>updateFormData({departement_id:v,sous_prefecture_id:null,village_id:null})} disabled={!formData.region_id} options={departements.map(x=>({value:x.id,label:x.nom}))} placeholder="Département" searchPlaceholder="Rechercher un département..." /></div>
    <div><Label>Sous-préfecture</Label><SearchableSelect value={formData.sous_prefecture_id||""} onValueChange={v=>updateFormData({sous_prefecture_id:v,village_id:null})} disabled={!formData.departement_id} options={sps.map(x=>({value:x.id,label:x.nom}))} placeholder="Sous-préfecture" searchPlaceholder="Rechercher une sous-préfecture..." /></div>
    <div><Label>Village / localité</Label><SearchableSelect value={formData.village_id||""} onValueChange={v=>updateFormData({village_id:v})} disabled={!formData.sous_prefecture_id} options={villages.map(x=>({value:x.id,label:x.nom}))} placeholder="Village / localité" searchPlaceholder="Rechercher un village..." /></div>
   </div>
  </CardContent></Card>
 </div>;
};