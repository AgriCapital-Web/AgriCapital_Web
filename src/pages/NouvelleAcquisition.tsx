import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Etape0Offre } from "@/components/forms/acquisition/Etape0Offre";
import { EtapeClientDynamique } from "@/components/forms/acquisition/EtapeClientDynamique";
import { EtapeRepresentantDynamique } from "@/components/forms/acquisition/EtapeRepresentantDynamique";
import { EtapeParcelleDynamique } from "@/components/forms/acquisition/EtapeParcelleDynamique";
import { EtapeDocumentsContratsDynamiques } from "@/components/forms/acquisition/EtapeDocumentsContratsDynamiques";
import { EtapePaiementConfirmation } from "@/components/forms/acquisition/EtapePaiementConfirmation";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/utils/storage";
import { offlineInsert } from "@/lib/offlineWrite";
import { useToast } from "@/hooks/use-toast";
import { SyncStatusBadge, type SyncState } from "@/components/offline/SyncStatusBadge";
import { getSafeErrorMessage } from "@/lib/safeError";
import { calculPrixEffectif } from "@/lib/pricing";
import { usePromotionActive } from "@/hooks/usePromotionActive";

type Step = { code: string; titre: string; description?: string; ordre: number; obligatoire: boolean };

const NouvelleAcquisition = () => {
  const [formData, setFormData] = useState<any>({});
  const [steps, setSteps] = useState<Step[]>([]);
  const [current, setCurrent] = useState(0);
  const [brouillonId, setBrouillonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("draft");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: promotionActive } = usePromotionActive(formData.offre_id);

  const updateFormData = (data: any) => setFormData((prev: any) => ({ ...prev, ...data }));

  useEffect(() => {
    const leadId = searchParams.get("lead_id");
    if (leadId) updateFormData({
      lead_id: leadId,
      nom_famille: searchParams.get("nom") || "",
      prenoms: searchParams.get("prenoms") || "",
      telephone: searchParams.get("telephone") || "",
      whatsapp: searchParams.get("whatsapp") || "",
      email: searchParams.get("email") || "",
    });
  }, [searchParams]);

  useEffect(() => {
    if (!formData.offre_id) {
      setSteps([]);
      setCurrent(0);
      return;
    }
    let mounted = true;
    const load = async () => {
      setLoadingSteps(true);
      const { data, error } = await (supabase as any)
        .from("offre_formulaire_etapes")
        .select("code,titre,description,ordre,obligatoire")
        .eq("offre_id", formData.offre_id)
        .eq("actif", true)
        .order("ordre");
      if (!mounted) return;
      if (error) toast({ variant: "destructive", title: "Parcours indisponible", description: getSafeErrorMessage(error) });
      setSteps(data || []);
      setCurrent(0);
      setLoadingSteps(false);
    };
    load();
    return () => { mounted = false; };
  }, [formData.offre_id]);

  const activeSteps = useMemo(
    () => formData.offre_id
      ? steps
      : [{ code: "offre", titre: "Offre et superficie", ordre: 1, obligatoire: true }],
    [formData.offre_id, steps]
  );
  const step = activeSteps[current];

  const validateStep = async () => {
    if (!step) return false;
    if (step.code === "offre" && (!formData.offre_id || Number(formData.superficie_prevue) <= 0)) {
      toast({ variant: "destructive", title: "Offre incomplète", description: "Sélectionnez une offre et renseignez la superficie." });
      return false;
    }
    if (step.code === "client") {
      const fields = ["civilite","nom_famille","prenoms","date_naissance","lieu_naissance","nationalite","type_piece","numero_piece","telephone","domicile"];
      if (fields.some((f) => !formData[f]) || !formData.photo_piece_recto_file || !formData.photo_piece_verso_file || !formData.photo_profil_file) {
        toast({ variant: "destructive", title: "Client incomplet", description: "Renseignez l’identité, les coordonnées et les photos/pièces obligatoires." });
        return false;
      }
    }
    if (step.code === "parcelle") {
      const external = ["palm-invest","palm-invest-plus"].includes(String(formData.offre_code));
      if (Number(formData.superficie_prevue) <= 0 || !formData.village_propre || (external && (!formData.convention_id || !formData.lot_id))) {
        toast({ variant: "destructive", title: "Parcelle incomplète", description: external ? "La convention, le lot, la superficie et la localité sont obligatoires." : "La superficie et la localité sont obligatoires." });
        return false;
      }
    }
    if (step.code === "representant" && formData.has_representant) {
      const fields = ["representant_type","representant_nom","representant_prenoms","representant_type_piece","representant_numero_piece"];
      if (fields.some((f) => !formData[f]) || !formData.representant_piece_recto_file || !formData.representant_piece_verso_file || !formData.representant_photo_profil_file) {
        toast({ variant: "destructive", title: "Représentant incomplet", description: "Renseignez l’identité et les pièces/photos du cotitulaire ou mandataire." });
        return false;
      }
    }
    return true;
  };

  const saveDraft = async (index: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { ...formData, parcours_code: formData.offre_code || null };
    if (brouillonId) {
      await (supabase as any).from("acquisitions_brouillon").update({
        etape_actuelle: index, donnees: payload, offre_id: formData.offre_id || null,
        parcours_code: formData.offre_code || null, updated_at: new Date().toISOString()
      }).eq("id", brouillonId);
    } else {
      const { data } = await (supabase as any).from("acquisitions_brouillon").insert({
        etape_actuelle: index, donnees: payload, offre_id: formData.offre_id || null,
        parcours_code: formData.offre_code || null, created_by: user.id
      }).select().single();
      if (data) setBrouillonId(data.id);
    }
    setSyncState("synced");
  };

  const next = async () => {
    if (!(await validateStep())) return;
    setSaving(true);
    try {
      const index = Math.min(activeSteps.length - 1, current + 1);
      await saveDraft(index);
      setCurrent(index);
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!(await validateStep())) return;
    if (!formData.contrat_lu || !formData.documents_authentiques || !formData.autorisation_donnees) {
      toast({ variant: "destructive", title: "Validation incomplète", description: "Toutes les validations finales sont obligatoires." });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session utilisateur introuvable");

      const { data: offer, error: offerError } = await (supabase as any).from("offres").select("*").eq("id", formData.offre_id).single();
      if (offerError || !offer) throw new Error("Offre sélectionnée introuvable");

      const ha = Number(formData.superficie_prevue);
      const prix = calculPrixEffectif(offer, promotionActive ? [promotionActive as any] : [], { modePaiement: formData.mode_paiement === "comptant" ? "comptant" : "echeancier" });
      const paiementInitial = Number(prix.depot_initial_effectif || 0) * ha;
      const total = Number(prix.montant_total_effectif || prix.montant_total_base || 0) * ha;
      const external = ["palm-invest","palm-invest-plus"].includes(String(offer.code));

      let parcelleId = formData.parcelle_id || null;
      if (!external) {
        const { data: parcelle, error } = await offlineInsert("parcelles", {
          surface_totale_ha: ha, surface_proprietaire_ha: ha, surface_agricapital_ha: 0,
          surface_attribuee_ha: 0, surface_disponible_ha: ha,
          village: formData.village_propre || null,
          region_id: null, departement_id: null, sous_prefecture_id: null,
          localisation_gps_lat: formData.parcelle_latitude ? Number(formData.parcelle_latitude) : null,
          localisation_gps_lng: formData.parcelle_longitude ? Number(formData.parcelle_longitude) : null,
          reference_convention: formData.reference_cadastrale || null,
          statut: "active",
          notes: formData.statut_foncier ? "Statut foncier : " + formData.statut_foncier : null,
          created_by: user.id, updated_by: user.id,
        });
        if (error || !parcelle) throw error || new Error("Parcelle Client non créée");
        parcelleId = parcelle.id;
      }

      const nomComplet = (String(formData.nom_famille || "") + " " + String(formData.prenoms || "")).trim();
      const { data: client, error: clientError } = await offlineInsert("clients", {
        offre_id: offer.id, parcelle_id: parcelleId,
        type_client: external ? "sans_terre" : "avec_terre",
        type_client_foncier: external ? "EXT" : "OWN",
        nom: formData.nom_famille || "", nom_famille: formData.nom_famille || "",
        prenoms: formData.prenoms || "", nom_complet: nomComplet,
        civilite: formData.civilite || null, date_naissance: formData.date_naissance || null,
        lieu_naissance: formData.lieu_naissance || null, nationalite: formData.nationalite || null,
        statut_marital: formData.statut_marital || null, type_piece: formData.type_piece || null,
        numero_piece: formData.numero_piece || null, date_delivrance_piece: formData.date_delivrance_piece || null,
        telephone: formData.telephone || "", telephone_indicatif: formData.telephone_indicatif || null,
        telephone_local: formData.telephone_local || null, whatsapp: formData.whatsapp || null,
        whatsapp_indicatif: formData.whatsapp_indicatif || null, whatsapp_local: formData.whatsapp_local || null,
        email: formData.email || null, domicile: formData.domicile || null,
        localite: formData.parcelle_region || null, mode_paiement: formData.mode_paiement === "comptant" ? "comptant" : "echeancier",
        paiement_initial_montant: paiementInitial, montant_total_contrat: total,
        famille_offre: offer.famille_offre || null, formule_code: offer.formule_code || offer.code,
        formule_nom: offer.formule_nom || offer.nom, parcours_code: offer.parcours_code || offer.code,
        statut: "actif", statut_global: "actif",
        contrat_acquisition_statut: offer.contrat_acquisition_requis ? "a_signer" : "non_requis",
        contrat_accompagnement_statut: offer.contrat_accompagnement_requis ? "a_signer" : "non_requis",
        created_by: user.id, updated_by: user.id,
      });
      if (clientError || !client) throw clientError || new Error("Client non créé");

      const coreFiles = [["photo_profil","photo_profil_url"],["photo_piece_recto","fichier_piece_recto_url"],["photo_piece_verso","fichier_piece_verso_url"]] as const;
      const coreUrls: Record<string,string> = {};
      for (const [field,column] of coreFiles) {
        const file = formData[field + "_file"];
        if (!file) continue;
        const uploaded = await uploadFile("documents", file, user.id + "/clients/" + client.id);
        if (!uploaded) throw new Error("Upload impossible : " + field);
        coreUrls[column] = uploaded.url;
      }
      if (Object.keys(coreUrls).length) await (supabase as any).from("clients").update(coreUrls).eq("id",client.id);

      if (external && formData.lot_id) {
        const { error } = await (supabase as any).from("lots_hectares").update({ client_id: client.id, statut: "attribue", date_attribution: new Date().toISOString().slice(0,10) }).eq("id",formData.lot_id);
        if (error) throw error;
      }

      if (formData.has_representant) {
        const { data: rep, error: repError } = await (supabase as any).from("client_cotitulaires_mandataires").insert({
          client_id: client.id, type_relation: formData.representant_type || "cotitulaire",
          lien_client: formData.representant_lien || null, civilite: formData.representant_civilite || null,
          nom: formData.representant_nom, prenoms: formData.representant_prenoms,
          date_naissance: formData.representant_date_naissance || null, lieu_naissance: formData.representant_lieu_naissance || null,
          nationalite: formData.representant_nationalite || null, type_piece: formData.representant_type_piece || null,
          numero_piece: formData.representant_numero_piece || null, date_delivrance_piece: formData.representant_date_delivrance || null,
          telephone: formData.representant_telephone || null, whatsapp: formData.representant_whatsapp || null,
          adresse: formData.representant_adresse || null, created_by: user.id, updated_by: user.id
        }).select().single();
        if (repError || !rep) throw repError || new Error("Représentant non enregistré");

        for (const [field,column] of [["representant_photo_profil","photo_profil_url"],["representant_piece_recto","piece_recto_url"],["representant_piece_verso","piece_verso_url"]] as const) {
          const file = formData[field + "_file"];
          if (!file) continue;
          const uploaded = await uploadFile("documents", file, user.id + "/clients/" + client.id + "/representant");
          if (!uploaded) throw new Error("Upload impossible : " + field);
          await (supabase as any).from("client_cotitulaires_mandataires").update({[column]:uploaded.url}).eq("id",rep.id);
        }
      }

      const { data: docs } = await (supabase as any).from("offre_formulaire_documents").select("*").eq("offre_id",offer.id).eq("actif",true).order("ordre");
      for (const doc of (docs || [])) {
        const condition = doc.condition || {};
        if (condition.when === "representant_active" && !formData.has_representant) continue;
        if (condition.when === "offre_plus" && !String(offer.code).endsWith("-plus")) continue;
        if (condition.when === "necessaire" && !formData.document_securisation_necessaire) continue;
        if (doc.obligatoire && !formData["doc_" + doc.code + "_file"]) throw new Error("Pièce obligatoire manquante : " + doc.libelle);
      }
      for (const doc of (docs || [])) {
        const file = formData["doc_" + doc.code + "_file"];
        if (!file) continue;
        const uploaded = await uploadFile("documents", file, user.id + "/clients/" + client.id + "/pieces");
        if (!uploaded) throw new Error("Upload impossible : " + doc.libelle);
        const { error } = await (supabase as any).from("documents_acquisition").insert({
          client_id: client.id, type_document: doc.code, code_document: doc.code,
          categorie: doc.categorie, obligatoire: doc.obligatoire,
          source_contractuelle: doc.source_contractuelle, fichier_url: uploaded.url,
          statut: "soumis", uploaded_by: user.id,
          metadata: { offre_id: offer.id, parcours_code: offer.parcours_code || offer.code }
        });
        if (error) throw error;
      }

      if (brouillonId) await (supabase as any).from("acquisitions_brouillon").delete().eq("id",brouillonId);
      toast({ title: "Client enregistré", description: "Le parcours Client a été enregistré avec les pièces applicables." });
      setSyncState("synced");
      navigate("/acquisitions");
    } catch (error: any) {
      setSyncState("error");
      toast({ variant: "destructive", title: "Erreur d’enregistrement", description: getSafeErrorMessage(error) });
    } finally { setSaving(false); }
  };

  const renderStep = () => {
    if (!step) return <Etape0Offre formData={formData} updateFormData={updateFormData} />;
    if (step.code === "offre") return <Etape0Offre formData={formData} updateFormData={updateFormData} />;
    if (step.code === "client") return <EtapeClientDynamique formData={formData} updateFormData={updateFormData} />;
    if (step.code === "parcelle") return <EtapeParcelleDynamique formData={formData} updateFormData={updateFormData} />;
    if (step.code === "representant") return <EtapeRepresentantDynamique formData={formData} updateFormData={updateFormData} />;
    if (step.code === "documents") return <EtapeDocumentsContratsDynamiques formData={formData} updateFormData={updateFormData} />;
    if (step.code === "paiement_confirmation") return <EtapePaiementConfirmation formData={formData} updateFormData={updateFormData} />;
    return null;
  };

  const last = current === activeSteps.length - 1 && activeSteps.length > 0;

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="max-w-7xl mx-auto page-section space-y-5">
          <div>
            <h1 className="text-3xl font-bold">Nouveau Client</h1>
            <p className="text-muted-foreground">Parcours Client dynamique piloté par l’offre et les documents contractuels.</p>
            <SyncStatusBadge state={syncState} className="mt-2" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {activeSteps.map((s,i) => <Button key={s.code} size="sm" variant={i === current ? "default" : "outline"} onClick={() => i <= current && setCurrent(i)}>{i+1}. {s.titre}</Button>)}
          </div>
          <Card className="p-4 sm:p-6 rounded-2xl shadow-sm">
            {loadingSteps ? <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin" /></div> : renderStep()}
          </Card>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setCurrent((v) => Math.max(0,v-1))} disabled={current === 0 || saving}><ChevronLeft className="mr-2 h-4 w-4" />Précédent</Button>
            {!last
              ? <Button onClick={next} disabled={saving || loadingSteps}>{saving ? "Sauvegarde…" : "Suivant"}<ChevronRight className="ml-2 h-4 w-4" /></Button>
              : <Button size="lg" onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "✓ Enregistrer le Client"}</Button>}
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default NouvelleAcquisition;
