import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";
import CountryPhoneInput from "@/components/common/CountryPhoneInput";
import PieceTypeSelect from "@/components/common/PieceTypeSelect";
import RelationshipSelect from "@/components/common/RelationshipSelect";

interface Etape2Props { formData:any; updateFormData:(data:any)=>void; }
export const Etape2Cotitulaire=({formData,updateFormData}:Etape2Props)=>{
 const handleFileChange=(field:string,file:File|null,preview:string)=>updateFormData({[field+"_file"]:file,[field+"_preview"]:preview});
 return <div className="space-y-6">
  <Card><CardHeader><CardTitle>Cotitulaire ou mandataire</CardTitle><CardDescription>Facultatif — à renseigner uniquement lorsque le client en désigne un.</CardDescription></CardHeader><CardContent><div className="flex items-center space-x-2"><Checkbox id="has_cotitulaire" checked={Boolean(formData.has_cotitulaire)} onCheckedChange={v=>updateFormData({has_cotitulaire:Boolean(v)})}/><Label htmlFor="has_cotitulaire">Ajouter un cotitulaire ou mandataire</Label></div></CardContent></Card>
  {formData.has_cotitulaire&&<Card><CardHeader><CardTitle>Identité du co-titulaire</CardTitle></CardHeader><CardContent className="space-y-4">
   <div className="grid md:grid-cols-3 gap-4"><div><Label>Civilité *</Label><Select value={formData.cotit_civilite||""} onValueChange={v=>updateFormData({cotit_civilite:v})}><SelectTrigger><SelectValue placeholder="Sélectionner"/></SelectTrigger><SelectContent><SelectItem value="M">M.</SelectItem><SelectItem value="Mme">Mme</SelectItem><SelectItem value="Mlle">Mlle</SelectItem></SelectContent></Select></div><div><Label>Nom de famille *</Label><Input value={formData.cotit_nom_famille||""} onChange={e=>updateFormData({cotit_nom_famille:e.target.value})} required/></div><div><Label>Prénoms *</Label><Input value={formData.cotit_prenoms||""} onChange={e=>updateFormData({cotit_prenoms:e.target.value})} required/></div></div>
   <div className="grid md:grid-cols-2 gap-4"><div><Label>Date de naissance *</Label><Input type="date" value={formData.cotit_date_naissance||""} onChange={e=>updateFormData({cotit_date_naissance:e.target.value})} required/></div><div><Label>Lien avec le Client *</Label><RelationshipSelect value={formData.cotit_relation||""} onChange={v=>updateFormData({cotit_relation:v})}/></div></div>
  </CardContent></Card>}
  {formData.has_cotitulaire&&<Card><CardHeader><CardTitle>Pièce d’identité du co-titulaire</CardTitle></CardHeader><CardContent className="space-y-4">
   <div className="grid md:grid-cols-3 gap-4"><div><Label>Type de pièce *</Label><PieceTypeSelect value={formData.cotit_type_piece} onChange={v=>updateFormData({cotit_type_piece:v})}/></div><div><Label>Numéro de pièce *</Label><Input value={formData.cotit_numero_piece||""} onChange={e=>updateFormData({cotit_numero_piece:e.target.value})} required/></div><div><Label>Date de délivrance *</Label><Input type="date" value={formData.cotit_date_delivrance||""} onChange={e=>updateFormData({cotit_date_delivrance:e.target.value})} required/></div></div>
   <div className="grid md:grid-cols-2 gap-4"><FileUploadVisual label="Photo Pièce - Recto *" field="cotit_photo_cni_recto" accept="image/*" required currentFile={formData.cotit_photo_cni_recto_file||null} currentPreview={formData.cotit_photo_cni_recto_preview||""} onFileChange={handleFileChange} onIdentityNumberDetected={n=>updateFormData({cotit_numero_piece:n})} identityDocumentType={formData.cotit_type_piece}/><FileUploadVisual label="Photo Pièce - Verso *" field="cotit_photo_cni_verso" accept="image/*" required currentFile={formData.cotit_photo_cni_verso_file||null} currentPreview={formData.cotit_photo_cni_verso_preview||""} onFileChange={handleFileChange}/></div>
   <FileUploadVisual label="Photo Profil *" field="cotit_photo_profil" accept="image/*" required currentFile={formData.cotit_photo_profil_file||null} currentPreview={formData.cotit_photo_profil_preview||""} onFileChange={handleFileChange}/>
  </CardContent></Card>}
  {formData.has_cotitulaire&&<Card><CardHeader><CardTitle>Coordonnées du co-titulaire</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 gap-4">
   <CountryPhoneInput label="Téléphone" required countryCode={formData.cotit_telephone_indicatif||"+225"} localValue={formData.cotit_telephone_local||""} onChange={v=>updateFormData({cotit_telephone_indicatif:v.callingCode,cotit_telephone_local:v.localValue,cotit_telephone:v.internationalValue})}/>
   <CountryPhoneInput label="WhatsApp" required countryCode={formData.cotit_whatsapp_indicatif||"+225"} localValue={formData.cotit_whatsapp_local||""} onChange={v=>updateFormData({cotit_whatsapp_indicatif:v.callingCode,cotit_whatsapp_local:v.localValue,cotit_whatsapp:v.internationalValue})}/>
  </CardContent></Card>}
 </div>
};