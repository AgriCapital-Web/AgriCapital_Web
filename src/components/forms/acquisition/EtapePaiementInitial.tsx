import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";
import { calculPrixEffectif } from "@/lib/pricing";
interface Props{formData:any;updateFormData:(data:any)=>void;}
export const EtapePaiementInitial=({formData,updateFormData}:Props)=>{
 const offre=formData.offre||{}; const ha=Number(formData.superficie_prevue||0); const prix=calculPrixEffectif(offre,[],{modePaiement:formData.mode_paiement==="comptant"?"comptant":"echeancier"}); const attendu=Number(prix.depot_initial_effectif||0)*ha;
 return <div className="space-y-6"><Card><CardHeader><CardTitle>Paiement initial</CardTitle><CardDescription>Déclarez le paiement initial attendu pour le dossier. La validation financière peut rester en attente.</CardDescription></CardHeader><CardContent className="space-y-5">
  <div className="rounded-xl bg-primary/5 border p-4 flex justify-between"><span className="font-medium">Montant attendu</span><strong>{attendu.toLocaleString("fr-FR")} F CFA</strong></div>
  <div className="grid md:grid-cols-3 gap-4"><div><Label>Montant déclaré</Label><Input type="number" min="0" value={formData.paiement_initial_declare||""} onChange={e=>updateFormData({paiement_initial_declare:e.target.value})}/></div>
   <div><Label>Mode de paiement</Label><Select value={formData.paiement_initial_mode||"non_paye"} onValueChange={v=>updateFormData({paiement_initial_mode:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="non_paye">Non payé</SelectItem><SelectItem value="especes">Espèces</SelectItem><SelectItem value="mobile_money">Mobile Money</SelectItem><SelectItem value="virement">Virement</SelectItem><SelectItem value="cheque">Chèque</SelectItem></SelectContent></Select></div>
   <div><Label>Référence transaction</Label><Input value={formData.paiement_initial_reference||""} onChange={e=>updateFormData({paiement_initial_reference:e.target.value})}/></div>
  </div>
  <FileUploadVisual label="Justificatif du paiement" field="paiement_initial_preuve" accept=".pdf,image/jpeg,image/png" required={false} currentFile={formData.paiement_initial_preuve_file||null} currentPreview={formData.paiement_initial_preuve_preview||""} onFileChange={(f,file,preview)=>updateFormData({paiement_initial_preuve_file:file,paiement_initial_preuve_preview:preview})}/>
 </CardContent></Card></div>;
};