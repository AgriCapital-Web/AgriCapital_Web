import { useEffect,useState } from "react";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";
import { supabase } from "@/integrations/supabase/client";
interface Props{formData:any;updateFormData:(data:any)=>void;}
export const EtapeContratsDynamiques=({formData,updateFormData}:Props)=>{
 const [contracts,setContracts]=useState<any[]>([]);
 useEffect(()=>{if(!formData.offre_id)return; (async()=>{const {data}=await (supabase as any).from("offre_formulaire_contrats").select("*").eq("offre_id",formData.offre_id).eq("actif",true);setContracts(data||[]);})();},[formData.offre_id]);
 return <Card><CardHeader><CardTitle>Contrats applicables</CardTitle><CardDescription>Les documents officiels conservent leur dénomination juridique. Le CRM utilise « Client ».</CardDescription></CardHeader><CardContent className="space-y-4">
  {contracts.map(c=><div key={c.id} className="rounded-xl border p-4 space-y-3"><div className="flex justify-between gap-3"><div><p className="font-medium">{c.type_contrat==="contrat_acquisition_client"?"Contrat d’acquisition de plantation agricole":"Contrat d’accompagnement agricole"}</p><p className="text-xs text-muted-foreground">{c.source_document}</p></div><Badge>Obligatoire</Badge></div>
   <FileUploadVisual label="Contrat signé (si disponible)" field={"contrat_"+c.type_contrat} accept=".pdf,image/jpeg,image/png" required={false} currentFile={formData["contrat_"+c.type_contrat+"_file"]||null} currentPreview={formData["contrat_"+c.type_contrat+"_preview"]||""} onFileChange={(f,file,preview)=>updateFormData({["contrat_"+c.type_contrat+"_file"]:file,["contrat_"+c.type_contrat+"_preview"]:preview})}/>
   <div className="grid md:grid-cols-2 gap-3"><div><label className="text-sm">Statut</label><select className="w-full border rounded-md h-10 px-3" value={formData["contrat_"+c.type_contrat+"_statut"]||"a_preparer"} onChange={e=>updateFormData({["contrat_"+c.type_contrat+"_statut"]:e.target.value})}><option value="a_preparer">À préparer</option><option value="a_signer">À signer</option><option value="signe">Signé</option></select></div></div>
  </div>)}
 </CardContent></Card>;
};