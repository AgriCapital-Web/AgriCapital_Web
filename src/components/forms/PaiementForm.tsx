import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { offlineInsert, offlineUpdate } from "@/lib/offlineWrite";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import FileUpload from "@/components/ui/file-upload";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAmount } from "@/lib/amount";
import { getSafeErrorMessage } from "@/lib/safeError";

interface PaiementFormProps { paiement?: any; onSuccess: () => void; onCancel: () => void; }
const fcfa = (n:number) => Math.round(n || 0).toLocaleString("fr-FR");

const PaiementForm = ({ paiement, onSuccess, onCancel }: PaiementFormProps) => {
  const { toast } = useToast();
  const { register, handleSubmit, watch, setValue } = useForm({ defaultValues: paiement || { type_paiement: "paiement_initial" } });
  const [souscripteurs, setSouscripteurs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState(paiement?.fichier_preuve_url || "");
  const [filePreview, setFilePreview] = useState("");
  const typePaiement = watch("type_paiement");
  const souscripteurId = watch("souscripteur_id");
  const typePreuve = watch("type_preuve");

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).from("souscripteurs")
        .select("*, offre:offres(id,code,nom,famille_offre,formule_code,montant_depot_initial_par_ha,montant_total_par_ha)")
        .order("created_at", { ascending: false });
      if (error) toast({ variant:"destructive", title:"Erreur", description:getSafeErrorMessage(error) });
      else setSouscripteurs(data || []);
    })();
  }, [toast]);

  useEffect(() => {
    const s = souscripteurs.find(x => x.id === souscripteurId) || null;
    setSelected(s);
    if (!s) return;
    setValue("parcours", s.famille_offre || s.offre?.famille_offre || null);
    const initial = Math.round(Number(s.total_hectares || 0) * Number(s.offre?.montant_depot_initial_par_ha || 0));
    if (typePaiement === "paiement_initial") {
      setValue("montant_theorique", initial);
      setValue("montant_paye", initial);
      setValue("est_paiement_initial", true);
      setValue("est_depot_initial", true);
    } else {
      setValue("est_paiement_initial", false);
      setValue("est_depot_initial", false);
    }
  }, [souscripteurId, souscripteurs, typePaiement, setValue]);

  const paiementInitial = useMemo(() => selected
    ? Math.round(Number(selected.total_hectares || 0) * Number(selected.offre?.montant_depot_initial_par_ha || 0))
    : 0, [selected]);

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => setFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else setFilePreview(file.name);
      const ext = file.name.split(".").pop() || "bin";
      const path = `paiements/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("documents-fonciers").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("documents-fonciers").getPublicUrl(path);
      setFileUrl(data.publicUrl); setValue("fichier_preuve_url", data.publicUrl);
      toast({ title:"Succès", description:"Preuve de paiement téléchargée." });
    } catch (e:any) {
      toast({ variant:"destructive", title:"Erreur", description:getSafeErrorMessage(e) });
    } finally { setUploading(false); }
  };

  const onSubmit = async (data:any) => {
    try {
      if (!data.souscripteur_id) throw new Error("Client obligatoire.");
      const parsed:any = {};
      for (const field of ["montant_paye","montant_theorique"] as const) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
          const p = parseAmount(data[field]); if (!p.ok) throw new Error(p.error); parsed[field] = p.value;
        }
      }
      const initial = data.type_paiement === "paiement_initial";
      if (initial && paiementInitial <= 0) throw new Error("Impossible de calculer le Paiement initial : offre ou superficie manquante.");
      const user = await supabase.auth.getUser();
      const montantTheorique = initial ? paiementInitial : (parsed.montant_theorique ?? parsed.montant_paye ?? 0);
      const paiementData = {
        ...data, ...parsed,
        type_paiement: initial ? "paiement_initial" : "echeance",
        est_paiement_initial: initial, est_depot_initial: initial,
        montant: parsed.montant_paye ?? montantTheorique,
        montant_theorique: montantTheorique,
        fichier_preuve_url: fileUrl || data.fichier_preuve_url || null,
        date_upload_preuve: fileUrl ? new Date().toISOString() : null,
        created_by: user.data.user?.id, statut: data.statut || "en_attente",
      };
      const result = paiement
        ? await offlineUpdate("paiements", paiement.id, paiementData)
        : await offlineInsert("paiements", paiementData);
      if (result.error) throw result.error;
      toast({ title:"Succès", description:`Paiement ${paiement ? "modifié" : "créé"} avec succès.` });
      onSuccess();
    } catch (e:any) {
      toast({ variant:"destructive", title:"Erreur", description:getSafeErrorMessage(e) });
    }
  };

  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
    <div className="space-y-4">
      <div><Label>Type de paiement *</Label><Select onValueChange={v=>setValue("type_paiement",v)} defaultValue={paiement?.type_paiement || "paiement_initial"}>
        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>
          <SelectItem value="paiement_initial">Paiement initial</SelectItem><SelectItem value="echeance">Échéance</SelectItem>
        </SelectContent></Select></div>
      <div><Label>Client *</Label><Select onValueChange={v=>setValue("souscripteur_id",v)} defaultValue={paiement?.souscripteur_id}>
        <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger><SelectContent>
          {souscripteurs.map(s=><SelectItem key={s.id} value={s.id}>{s.numero_contrat || s.id_unique || s.id} — {s.nom_complet}</SelectItem>)}
        </SelectContent></Select></div>
      {selected && <Card className="border-primary/20 bg-primary/5"><CardHeader className="pb-3"><CardTitle className="text-sm">Offre officielle</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
        <div className="flex justify-between"><span>Offre</span><strong>{selected.offre?.nom || "—"}</strong></div>
        <div className="flex justify-between"><span>Superficie</span><strong>{Number(selected.total_hectares || 0)} ha</strong></div>
        {typePaiement==="paiement_initial" && <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Paiement initial</span><span>{fcfa(paiementInitial)} F</span></div>}
      </CardContent></Card>}
      {typePaiement==="paiement_initial" && selected && <div><Label>Montant du Paiement initial (F CFA) *</Label><Input type="number" {...register("montant_theorique",{required:true})} readOnly className="bg-muted font-bold text-lg" /><p className="mt-1 text-xs text-muted-foreground">Calculé selon l'offre officielle et la superficie du client.</p></div>}
      {typePaiement==="echeance" && <div><Label>Montant de l'échéance (F CFA) *</Label><Input type="number" min="1" {...register("montant_paye",{required:true})} placeholder="Montant encaissé" /></div>}
      <div><Label>Date de paiement *</Label><Input type="date" {...register("date_paiement",{required:true})} defaultValue={paiement?.date_paiement?.slice?.(0,10)} /></div>
      <div><Label>Année *</Label><Input type="number" {...register("annee",{required:true})} defaultValue={new Date().getFullYear()} /></div>
      <div><Label>Mode de paiement *</Label><Select onValueChange={v=>setValue("mode_paiement",v)} defaultValue={paiement?.mode_paiement}><SelectTrigger><SelectValue placeholder="Mode de paiement" /></SelectTrigger><SelectContent>
        <SelectItem value="mobile_money">Mobile Money</SelectItem><SelectItem value="virement">Virement bancaire</SelectItem><SelectItem value="cheque">Chèque</SelectItem><SelectItem value="especes">Espèces</SelectItem>
      </SelectContent></Select></div>
      <div><Label>Type de preuve *</Label><Select onValueChange={v=>setValue("type_preuve",v)} defaultValue={paiement?.type_preuve}><SelectTrigger><SelectValue placeholder="Type de preuve" /></SelectTrigger><SelectContent>
        <SelectItem value="id_transaction">ID Transaction</SelectItem><SelectItem value="photo_recu">Photo Reçu</SelectItem><SelectItem value="pdf_document">Document PDF</SelectItem>
      </SelectContent></Select></div>
      {typePreuve==="id_transaction" && <div><Label>ID Transaction *</Label><Input {...register("id_transaction")} placeholder="Ex. OM2510156789" /></div>}
      {(typePreuve==="photo_recu" || typePreuve==="pdf_document") && <div><Label>Fichier de preuve *</Label><FileUpload onFileSelect={handleFileUpload} accept={typePreuve==="pdf_document"?".pdf":"image/*"} maxSize={10}/>{filePreview && <div className="mt-3 rounded border bg-muted p-3 text-sm flex items-center justify-between"><span>{filePreview.startsWith("data:image")?"Aperçu chargé":`📄 ${filePreview}`}</span><button type="button" onClick={()=>{setFilePreview("");setFileUrl("");setValue("fichier_preuve_url","");}}><X className="h-4 w-4"/></button></div>}</div>}
      <div><Label>Observations</Label><Textarea {...register("observations")} rows={3} placeholder="Ajouter des notes supplémentaires..." /></div>
    </div>
    <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onCancel}>Annuler</Button><Button type="submit" disabled={uploading}>{uploading?"Chargement...":paiement?"Modifier":"Enregistrer"}</Button></div>
  </form>;
};
export default PaiementForm;