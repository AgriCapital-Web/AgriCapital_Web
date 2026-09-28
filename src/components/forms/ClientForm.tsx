import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineUpdate, offlineInsert } from "@/lib/offlineWrite";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FileUpload from "@/components/ui/file-upload";
import CountryPhoneInput from "@/components/common/CountryPhoneInput";
import PieceTypeSelect from "@/components/common/PieceTypeSelect";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, LandPlot, UserRound } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/safeError";
import GeographieCascade from "@/components/common/GeographieCascade";

interface ClientFormProps { client?: any; onSuccess: () => void; onCancel: () => void; }

const CODES = [
  ["+225","Côte d’Ivoire"],["+33","France"],["+1","USA / Canada"],["+32","Belgique"],
  ["+41","Suisse"],["+44","Royaume-Uni"],["+221","Sénégal"],["+224","Guinée"],
  ["+226","Burkina Faso"],["+223","Mali"],["+237","Cameroun"],["+228","Togo"],["+229","Bénin"],
];

const CLIENT_COLUMNS = new Set([
  "civilite","nom_famille","prenoms","nom_complet","nom","date_naissance","lieu_naissance","statut_marital",
  "type_piece","numero_piece","date_delivrance_piece","telephone","whatsapp","email","domicile","domicile_residence",
  "district_id","region_id","departement_id","sous_prefecture_id","village_id","offre_id","type_compte","banque_operateur",
  "numero_compte","nom_titulaire_compte","photo_profil_url","fichier_piece_url","fichier_piece_recto_url",
  "fichier_piece_verso_url","localite","nationalite","type_client","parcelle_id","telephone_indicatif","telephone_local",
  "whatsapp_indicatif","whatsapp_local","updated_by"
]);

const PARCEL_COLUMNS = new Set([
  "nom","surface_totale_ha","surface_proprietaire_ha","surface_agricapital_ha","surface_attribuee_ha",
  "surface_disponible_ha","district_id","region_id","departement_id","sous_prefecture_id","village_id","village",
  "localisation_gps_lat","localisation_gps_lng","notes","mode_surface","plantation_surface_cible_ha",
  "plantation_type_culture","plantation_densite_plants","updated_by"
]);

const ClientForm = ({ client, onSuccess, onCancel }: ClientFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<any>(() => ({ ...client }));
  const [parcel, setParcel] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingParcel, setLoadingParcel] = useState(Boolean(client?.parcelle_id));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pieceRectoFile, setPieceRectoFile] = useState<File | null>(null);
  const [pieceVersoFile, setPieceVersoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [pieceRectoPreview, setPieceRectoPreview] = useState("");
  const [pieceVersoPreview, setPieceVersoPreview] = useState("");

  const setField = (key: string, value: any) => setForm((x: any) => ({ ...x, [key]: value }));

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("offres").select("id,code,nom,famille_offre,necessite_foncier_client,actif").eq("actif", true).order("nom");
      setOffers(data || []);
    })();
  }, []);

  useEffect(() => {
    if (!client?.parcelle_id) { setParcel(null); setLoadingParcel(false); return; }
    (async () => {
      setLoadingParcel(true);
      const { data, error } = await (supabase as any).from("parcelles").select("*").eq("id", client.parcelle_id).maybeSingle();
      if (!error) setParcel(data || null);
      setLoadingParcel(false);
    })();
  }, [client?.parcelle_id]);

  const offer = useMemo(
    () => offers.find(o => o.id === form.offre_id) || { code: form.formule_code, nom: form.formule_nom, necessite_foncier_client: ["terra-palm","terra-palm-plus","palm-terroir-essentielle","palm-terroir-flexible"].includes(String(form.formule_code || "").toLowerCase()) },
    [offers, form.offre_id, form.formule_code, form.formule_nom]
  );

  const ownLand = Boolean(offer?.necessite_foncier_client) || form.type_client_foncier === "OWN" || form.type_client === "avec_terre";
  const isBeneficiary = form.type_client === "beneficiaire_particulier";
  const hasActivity = Number(form.nombre_plantations || 0) > 0 || Boolean(form.pi_paye_at || form.paiement_initial_paye_at);

  const updateParcel = (key: string, value: any) => {
    setParcel((p: any) => ({ ...(p || {}), [key]: value }));
  };

  const handleFileSelect = (file: File, setter: (f: File) => void, previewSetter: (url: string) => void) => {
    setter(file);
    const reader = new FileReader();
    reader.onloadend = () => previewSetter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async () => {
    if (!user || !client?.id) return;
    setLoading(true);
    try {
      let photo_profil_url = form.photo_profil_url || null;
      let fichier_piece_recto_url = form.fichier_piece_recto_url || null;
      let fichier_piece_verso_url = form.fichier_piece_verso_url || null;

      if (photoFile) {
        const result = await uploadFile("photos-profils", photoFile);
        if (result) photo_profil_url = result.url;
      }
      if (pieceRectoFile) {
        const result = await uploadFile("pieces-identite", pieceRectoFile);
        if (result) fichier_piece_recto_url = result.url;
      }
      if (pieceVersoFile) {
        const result = await uploadFile("pieces-identite", pieceVersoFile);
        if (result) fichier_piece_verso_url = result.url;
      }

      // IMPORTANT : seules les colonnes métier de clients sont envoyées.
      // Les relations chargées pour l'affichage ne doivent jamais être réinjectées dans UPDATE.
      const clientPayload: any = {};
      for (const key of CLIENT_COLUMNS) if (key in form) clientPayload[key] = form[key];
      clientPayload.photo_profil_url = photo_profil_url;
      clientPayload.fichier_piece_recto_url = fichier_piece_recto_url;
      clientPayload.fichier_piece_verso_url = fichier_piece_verso_url;
      clientPayload.nom_complet = form.nom_complet || [form.nom_famille || form.nom, form.prenoms].filter(Boolean).join(" ").trim();
      clientPayload.updated_by = user.id;

      const { error } = await offlineUpdate("clients", client.id, clientPayload);
      if (error) throw error;

      // Pour une terre propre au Client, on met à jour la parcelle existante.
      // Pour un foncier externe, la convention/lot reste pilotée par le parcours foncier.
      if (ownLand && parcel?.id) {
        const parcelPayload: any = {};
        for (const key of PARCEL_COLUMNS) if (key in parcel) parcelPayload[key] = parcel[key];
        parcelPayload.updated_by = user.id;
        parcelPayload.surface_totale_ha = Number(parcel.surface_totale_ha || form.total_hectares || 0);
        parcelPayload.surface_proprietaire_ha = Number(parcel.surface_proprietaire_ha || parcel.surface_totale_ha || 0);
        parcelPayload.surface_agricapital_ha = Number(parcel.surface_agricapital_ha || 0);
        parcelPayload.surface_attribuee_ha = Number(parcel.surface_attribuee_ha || 0);
        parcelPayload.surface_disponible_ha = Math.max(0, parcelPayload.surface_totale_ha - parcelPayload.surface_attribuee_ha);
        const { error: parcelError } = await (supabase as any).from("parcelles").update(parcelPayload).eq("id", parcel.id);
        if (parcelError) throw parcelError;
      }

      toast({ title: "Dossier mis à jour", description: `${clientPayload.nom_complet || "Le Client"} a été modifié avec succès.` });
      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Modification impossible", description: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const fileUpload = (label: string, field: string, file: File | null, current: string | null, onSelect: (f: File) => void, onPreview: (s: string) => void, ocr=false) => (<FileUploadVisual label={label} field={field} accept="image/*,.pdf" currentFile={file} currentPreview={ocr ? pieceRectoPreview : undefined} onFileChange={(_,f,p)=>{if(f)onSelect(f);onPreview(p)}} onIdentityNumberDetected={ocr ? n=>setField("numero_piece",n) : undefined} identityDocumentType={form.type_piece}/>);
  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs text-muted-foreground">Dossier</p><p className="font-mono font-semibold">{client?.id_unique || "—"}</p></div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{isBeneficiary ? "Bénéficiaire particulier" : "Client officiel"}</Badge>
          {offer?.nom && <Badge>{offer.nom}</Badge>}
          <Badge variant="secondary">{ownLand ? "Terre du Client" : "Foncier AgriCapital / externe"}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Identité</CardTitle><CardDescription>Informations personnelles du dossier.</CardDescription></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div><Label>Civilité</Label><Select value={form.civilite || ""} onValueChange={v=>setField("civilite",v)}><SelectTrigger><SelectValue placeholder="Sélectionner"/></SelectTrigger><SelectContent><SelectItem value="M">Monsieur</SelectItem><SelectItem value="Mme">Madame</SelectItem><SelectItem value="Mlle">Mademoiselle</SelectItem></SelectContent></Select></div>
          <div><Label>Nom de famille</Label><Input value={form.nom_famille || form.nom || ""} onChange={e=>{setField("nom_famille",e.target.value);setField("nom_complet",[e.target.value,form.prenoms].filter(Boolean).join(" "));}}/></div>
          <div><Label>Prénoms</Label><Input value={form.prenoms || ""} onChange={e=>{setField("prenoms",e.target.value);setField("nom_complet",[form.nom_famille || form.nom,e.target.value].filter(Boolean).join(" "));}}/></div>
          <div><Label>Date de naissance</Label><Input type="date" value={form.date_naissance || ""} onChange={e=>setField("date_naissance",e.target.value)}/></div>
          <div><Label>Lieu de naissance</Label><Input value={form.lieu_naissance || ""} onChange={e=>setField("lieu_naissance",e.target.value)}/></div>
          <div><Label>Nationalité</Label><Input value={form.nationalite || ""} onChange={e=>setField("nationalite",e.target.value)}/></div>
          <div><Label>Situation matrimoniale</Label><Select value={form.statut_marital || ""} onValueChange={v=>setField("statut_marital",v)}><SelectTrigger><SelectValue placeholder="Sélectionner"/></SelectTrigger><SelectContent><SelectItem value="celibataire">Célibataire</SelectItem><SelectItem value="marie">Marié(e)</SelectItem><SelectItem value="divorce">Divorcé(e)</SelectItem><SelectItem value="veuf">Veuf(ve)</SelectItem></SelectContent></Select></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Coordonnées et résidence</CardTitle><CardDescription>Coordonnées utilisées pour le dossier et le portail.</CardDescription></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <CountryPhoneInput label="Téléphone" required countryCode={form.telephone_indicatif||"+225"} localValue={form.telephone_local||form.telephone||""} onChange={v=>{setField("telephone_indicatif",v.callingCode);setField("telephone_local",v.localValue);setField("telephone",v.internationalValue)}}/>
          <CountryPhoneInput label="WhatsApp" countryCode={form.whatsapp_indicatif||"+225"} localValue={form.whatsapp_local||form.whatsapp||""} onChange={v=>{setField("whatsapp_indicatif",v.callingCode);setField("whatsapp_local",v.localValue);setField("whatsapp",v.internationalValue)}}/>
          <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={e=>setField("email",e.target.value)}/></div>
          <div><Label>Domicile / résidence</Label><Input value={form.domicile_residence || form.domicile || ""} onChange={e=>{setField("domicile_residence",e.target.value);setField("domicile",e.target.value);}}/></div>
          <div className="md:col-span-2"><Label>Localisation administrative</Label><GeographieCascade districtId={form.district_id} regionId={form.region_id} departementId={form.departement_id} sousPrefectureId={form.sous_prefecture_id} villageId={form.village_id} required onChange={(g)=>setForm((x:any)=>({...x,district_id:g.districtId||null,region_id:g.regionId||null,departement_id:g.departementId||null,sous_prefecture_id:g.sousPrefectureId||null,village_id:g.villageId||null,localite:g.villageName||x.localite||""}))}/></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pièce d’identité</CardTitle><CardDescription>Informations d’identification du Client.</CardDescription></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div><Label>Type de pièce</Label><PieceTypeSelect value={form.type_piece||""} onChange={v=>setField("type_piece",v)}/></div>
          <div><Label>Numéro de pièce</Label><Input value={form.numero_piece || ""} onChange={e=>setField("numero_piece",e.target.value)}/></div>
          <div><Label>Date de délivrance</Label><Input type="date" value={form.date_delivrance_piece || ""} onChange={e=>setField("date_delivrance_piece",e.target.value)}/></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Offre et parcours</CardTitle><CardDescription>L’offre détermine notamment le parcours foncier et technique. Les éléments contractuels déjà activés ne sont pas recalculés ici.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Type de dossier</Label><Input value={isBeneficiary ? "Bénéficiaire particulier" : "Client officiel"} disabled /></div>
            <div><Label>Offre / formule</Label><Select value={form.offre_id || "none"} onValueChange={v=>{if(!hasActivity)setField("offre_id",v==="none"?"":v);}} disabled={hasActivity}><SelectTrigger><SelectValue placeholder={offer?.nom || "Offre"}/></SelectTrigger><SelectContent><SelectItem value="none">Aucune offre</SelectItem>{offers.map(o=><SelectItem key={o.id} value={o.id}>{o.nom}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Formule</Label><Input value={form.formule_nom || form.formule_code || "—"} disabled /></div>
          </div>
          {hasActivity && <div className="flex gap-2 items-start rounded-lg border p-3 text-sm"><AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground"/><span>L’offre est verrouillée car le dossier possède déjà une activation, un paiement initial ou une plantation. Toute modification contractuelle doit passer par le parcours contractuel.</span></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><LandPlot className="h-4 w-4"/>Foncier et parcelle</CardTitle><CardDescription>{ownLand ? "Cette offre utilise la terre du Client. Aucun propriétaire foncier tiers n’est obligatoire." : "Cette offre utilise un foncier mis à disposition / géré par AgriCapital. La convention et le lot restent gérés dans le parcours foncier."}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {ownLand ? (
            loadingParcel ? <p className="text-sm text-muted-foreground">Chargement de la parcelle…</p> :
            parcel ? <div className="grid md:grid-cols-3 gap-4">
              <div><Label>Référence parcelle</Label><Input value={parcel.id_unique || ""} disabled /></div>
              <div><Label>Nom de parcelle</Label><Input value={parcel.nom || ""} onChange={e=>updateParcel("nom",e.target.value)}/></div>
              <div><Label>Superficie totale (ha)</Label><Input type="number" min="0" step="0.01" value={parcel.surface_totale_ha ?? ""} onChange={e=>updateParcel("surface_totale_ha",e.target.value)}/></div>
              <div className="md:col-span-3"><Label>Localisation de la parcelle</Label><GeographieCascade districtId={parcel.district_id} regionId={parcel.region_id} departementId={parcel.departement_id} sousPrefectureId={parcel.sous_prefecture_id} villageId={parcel.village_id} required onChange={(g)=>setParcel((x:any)=>({...x,district_id:g.districtId||null,region_id:g.regionId||null,departement_id:g.departementId||null,sous_prefecture_id:g.sousPrefectureId||null,village_id:g.villageId||null,village:g.villageName||x.village||""}))}/></div>
              <div><Label>Latitude</Label><Input type="number" step="any" value={parcel.localisation_gps_lat ?? ""} onChange={e=>updateParcel("localisation_gps_lat",e.target.value)}/></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={parcel.localisation_gps_lng ?? ""} onChange={e=>updateParcel("localisation_gps_lng",e.target.value)}/></div>
              <div><Label>Culture</Label><Input value={parcel.plantation_type_culture || ""} onChange={e=>updateParcel("plantation_type_culture",e.target.value)}/></div>
              <div><Label>Densité (plants/ha)</Label><Input type="number" value={parcel.plantation_densite_plants ?? ""} onChange={e=>updateParcel("plantation_densite_plants",e.target.value)}/></div>
              <div><Label>Statut foncier</Label><Input value={parcel.mode_surface || "Propriété / terre du Client"} disabled /></div>
            </div> :
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucune parcelle rattachée à ce dossier. La création/rattachement d’une nouvelle parcelle doit être effectué depuis le parcours foncier afin de conserver les relations géographiques et foncières.</div>
          ) : (
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div><span className="text-muted-foreground">Parcelle : </span>{parcel?.id_unique || form.parcelle_id || "—"}</div>
              <div><span className="text-muted-foreground">Propriétaire foncier : </span>{parcel?.proprietaire_id ? "Propriétaire foncier enregistré" : "Non renseigné / non obligatoire"}</div>
              <div className="text-muted-foreground">Les conventions, lots et attributions ne sont pas modifiés dans ce formulaire pour éviter de rompre la traçabilité foncière.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents d’identité</CardTitle><CardDescription>Remplacez uniquement les fichiers nécessaires.</CardDescription></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div><Label>Photo profil</Label>{fileUpload("Choisir une photo","photo_profil",photoFile,form.photo_profil_url,setPhotoFile,setPhotoPreview)}</div>
          <div><Label>Pièce recto</Label>{fileUpload("Choisir recto","piece_recto",pieceRectoFile,form.fichier_piece_recto_url,setPieceRectoFile,setPieceRectoPreview,true)}</div>
          <div><Label>Pièce verso</Label>{fileUpload("Choisir verso","piece_verso",pieceVersoFile,form.fichier_piece_verso_url,setPieceVersoFile,setPieceVersoPreview)}</div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 sticky bottom-0 bg-background py-3 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={onSubmit} disabled={loading}>{loading ? "Enregistrement..." : "Enregistrer les modifications"}</Button>
      </div>
    </div>
  );
};

export default ClientForm;
