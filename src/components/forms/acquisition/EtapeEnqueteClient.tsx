import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface Props { formData:any; updateFormData:(data:any)=>void; }
export const EtapeEnqueteClient=({formData,updateFormData}:Props)=>{
 const light=String(formData.offre_code||"").startsWith("palm-terroir");
 const set=(key:string,value:any)=>updateFormData({[key]:value});
 return <div className="space-y-6">
  <Card><CardHeader><CardTitle>Enquête Client</CardTitle><CardDescription>{light?"Questionnaire allégé adapté à PalmTerroir.":"Informations nécessaires pour qualifier le projet, la situation foncière et l’accompagnement du Client."}</CardDescription></CardHeader>
  <CardContent className="space-y-5">
   <div className="grid md:grid-cols-2 gap-4">
    <div><Label>Objectif du Client *</Label><Select value={formData.enquete_objectif||""} onValueChange={v=>set("enquete_objectif",v)}><SelectTrigger><SelectValue placeholder="Sélectionner"/></SelectTrigger><SelectContent><SelectItem value="patrimoine">Constituer un patrimoine</SelectItem><SelectItem value="revenus">Préparer des revenus futurs</SelectItem><SelectItem value="retraite">Préparer la retraite</SelectItem><SelectItem value="transmission">Transmission familiale</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></div>
    <div><Label>Expérience agricole</Label><Select value={formData.enquete_experience||""} onValueChange={v=>set("enquete_experience",v)}><SelectTrigger><SelectValue placeholder="Sélectionner"/></SelectTrigger><SelectContent><SelectItem value="aucune">Aucune</SelectItem><SelectItem value="debutant">Débutant</SelectItem><SelectItem value="intermediaire">Intermédiaire</SelectItem><SelectItem value="expert">Expérimenté</SelectItem></SelectContent></Select></div>
   </div>
   {!light&&<div className="grid md:grid-cols-2 gap-4">
    <div><Label>Disponibilité pour le suivi</Label><Select value={formData.enquete_disponibilite||""} onValueChange={v=>set("enquete_disponibilite",v)}><SelectTrigger><SelectValue placeholder="Sélectionner"/></SelectTrigger><SelectContent><SelectItem value="faible">Faible</SelectItem><SelectItem value="moyenne">Moyenne</SelectItem><SelectItem value="forte">Forte</SelectItem></SelectContent></Select></div>
    <div><Label>Source de connaissance d’AgriCapital</Label><Input value={formData.enquete_source||""} onChange={e=>set("enquete_source",e.target.value)} placeholder="Recommandation, réseau social, événement..."/></div>
   </div>}
   <div><Label>Observations / attentes du Client</Label><Input value={formData.enquete_observations||""} onChange={e=>set("enquete_observations",e.target.value)} placeholder="Informations utiles au dossier"/></div>
  </CardContent></Card>
 </div>;
};