import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Etape1Souscripteur } from "@/components/forms/souscription/Etape1Souscripteur";
import { Etape2Cotitulaire } from "@/components/forms/souscription/Etape2Cotitulaire";
import { Etape0Offre } from "@/components/forms/souscription/Etape0Offre";
import { Etape3Foncier } from "@/components/forms/souscription/Etape3Foncier";
import { ANNEXES_SOUSCRIPTION, Etape5Documents } from "@/components/forms/souscription/Etape5Documents";
import { Etape6Confirmation } from "@/components/forms/souscription/Etape6Confirmation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/utils/storage";
import { offlineInsert } from "@/lib/offlineWrite";
import { SyncStatusBadge, type SyncState } from "@/components/offline/SyncStatusBadge";
import { getSafeErrorMessage } from "@/lib/safeError";

const NouvelleSouscription = () => {
  const [etapeActuelle, setEtapeActuelle] = useState(0);
  const [formData, setFormData] = useState<any>({});
  const [brouillonId, setBrouillonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [syncState, setSyncState] = useState<SyncState>("draft");

  // Le parcours commence désormais par l'offre. PalmInvest/TerraPalm utilisent le parcours complet ;
  // PalmTerroir utilise un parcours allégé sans co-titulaire.
  const etapes = useMemo(() => {
    const famille = formData.famille_offre;
    const base = [{ num: 1, titre: "Offre", component: Etape0Offre }, { num: 2, titre: "Client", component: Etape1Souscripteur }];
    if (famille !== "PALMTERROIR") base.push({ num: 3, titre: "Co-titulaire", component: Etape2Cotitulaire });
    base.push({ num: base.length + 1, titre: "Foncier", component: Etape3Foncier });
    base.push({ num: base.length + 1, titre: "Documents", component: Etape5Documents });
    base.push({ num: base.length + 1, titre: "Confirmation", component: Etape6Confirmation });
    return base;
  }, [formData.famille_offre]);
  
  useEffect(() => {
    const leadId = searchParams.get("lead_id");
    if (!leadId) return;
    setFormData((prev: any) => ({
      ...prev,
      lead_id: leadId,
      nom_famille: prev.nom_famille || searchParams.get("nom") || "",
      prenoms: prev.prenoms || searchParams.get("prenoms") || "",
      telephone: prev.telephone || searchParams.get("telephone") || "",
      whatsapp: prev.whatsapp || searchParams.get("whatsapp") || "",
      email: prev.email || searchParams.get("email") || "",
    }));
  }, [searchParams]);

  // Charger le brouillon existant au montage
  useEffect(() => {
    const chargerBrouillon = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: brouillons } = await (supabase as any)
        .from("souscriptions_brouillon")
        .select("*")
        .eq("created_by", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (brouillons && brouillons.length > 0) {
        const brouillon = brouillons[0];
        setBrouillonId(brouillon.id);
        setFormData(brouillon.donnees);
        setEtapeActuelle(Math.min(brouillon.etape_actuelle, etapes.length - 1));
        toast({
          title: "Brouillon récupéré",
          description: "Reprise de votre parcours client en cours",
        });
      }
    };

    chargerBrouillon();
  }, []);

  const updateFormData = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
  };

  const sauvegarderBrouillon = async (nouvelleEtape?: number) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const etape = nouvelleEtape ?? etapeActuelle;
      
      if (brouillonId) {
        const { error } = await (supabase as any)
          .from("souscriptions_brouillon")
          .update({
            etape_actuelle: etape,
            donnees: formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", brouillonId);

        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("souscriptions_brouillon")
          .insert({
            etape_actuelle: etape,
            donnees: formData,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setBrouillonId(data.id);
      }

      toast({
        title: "Sauvegarde réussie",
        description: "Vos données ont été enregistrées",
      });
      setSyncState("synced");
    } catch (error: any) {
      setSyncState("error");
      toast({
        variant: "destructive",
        title: "Erreur de sauvegarde",
        description: getSafeErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const passerEtapeSuivante = async () => {
    if (safeEtape === 0 && !formData.offre_id) {
      toast({ variant: "destructive", title: "Offre obligatoire", description: "Choisissez d'abord l'offre puis sa formule." });
      return;
    }
    const nouvelleEtape = Math.min(etapes.length - 1, etapeActuelle + 1);
    await sauvegarderBrouillon(nouvelleEtape);
    setEtapeActuelle(nouvelleEtape);
  };

  const passerEtapePrecedente = () => {
    setEtapeActuelle(Math.max(0, etapeActuelle - 1));
  };

  const soumettreFormulaire = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      if (!formData.famille_offre || !formData.formule_code || !formData.nom_famille || !formData.prenoms || !formData.telephone || !formData.offre_id) {
        throw new Error("Veuillez remplir tous les champs obligatoires (identité, coordonnées et offre)");
      }

      // Validation V1 — type_souscripteur_foncier (EXT/OWN) + cohérence convention/lot
      const typeFoncier = formData.type_souscripteur_foncier || (formData.type_souscripteur === "avec_terre" ? "OWN" : "EXT");
      const famille = formData.famille_offre;
      if (!["PALMINVEST","TERRAPALM","PALMTERROIR"].includes(famille)) throw new Error("Offre non reconnue : sélectionnez une des trois offres officielles.");
      if (famille === "PALMINVEST") formData.type_souscripteur_foncier = "EXT";
      if (famille !== "PALMINVEST") formData.type_souscripteur_foncier = "OWN";
      if (typeFoncier === "EXT") {
        if (!formData.convention_id || !formData.lot_id) {
          throw new Error("Client externe : convention Planter-Partager et lot Hxx obligatoires");
        }
        // Vérifier que le lot appartient bien à la convention sélectionnée et est disponible
        const { data: lot, error: lotErr } = await (supabase as any)
          .from("lots_hectares")
          .select("id, convention_id, statut")
          .eq("id", formData.lot_id)
          .single();
        if (lotErr || !lot) throw new Error("Lot Hxx introuvable");
        if (lot.convention_id !== formData.convention_id) {
          throw new Error("Le lot sélectionné n'appartient pas à la convention");
        }
        if (lot.statut !== "disponible") {
          throw new Error("Ce lot Hxx n'est plus disponible");
        }
      }

      // Créer le souscripteur
      const nomComplet = `${formData.nom_famille || ''} ${formData.prenoms || ''}`.trim();
      
      const { data: souscripteur, error: errorSous, offline } = await offlineInsert("souscripteurs", {
          offre_id: formData.offre_id,
          famille_offre: formData.famille_offre,
          formule_code: formData.formule_code,
          formule_nom: formData.formule_nom,
          parcours_code: formData.famille_offre,
          total_hectares: Number(formData.superficie_prevue) || 0,
          paiement_initial_montant: 0,
          parcelle_id: formData.parcelle_id || null,
          type_souscripteur: formData.type_souscripteur || "sans_terre",
          type_souscripteur_foncier: typeFoncier,
          nom: formData.nom_famille || "",
          prenoms: formData.prenoms || "",
          nom_complet: nomComplet,
          nom_famille: formData.nom_famille || "",
          civilite: formData.civilite || null,
          date_naissance: formData.date_naissance && formData.date_naissance !== "" ? formData.date_naissance : null,
          lieu_naissance: formData.lieu_naissance || "",
          nationalite: formData.nationalite || "Ivoirienne",
          statut_marital: formData.statut_marital || null,
          type_piece: formData.type_piece?.toLowerCase() || 'cni',
          numero_piece: formData.numero_piece || "",
          date_delivrance_piece: formData.date_delivrance_piece && formData.date_delivrance_piece !== "" ? formData.date_delivrance_piece : null,
          telephone: formData.telephone || "",
          whatsapp: formData.whatsapp || null,
          email: formData.email || null,
          domicile: formData.domicile || null,
          localite: formData.localite || null,
          district_id: formData.district_id || null,
          region_id: formData.region_id || null,
          departement_id: formData.departement_id || null,
          sous_prefecture_id: formData.sous_prefecture_id || null,
          type_compte: formData.type_compte || null,
          banque_operateur: formData.banque_operateur || null,
          numero_compte: formData.numero_compte || null,
          nom_titulaire_compte: formData.nom_beneficiaire || null,
          created_by: user.id,
          updated_by: user.id,
          statut: 'actif',
          statut_global: 'actif',
          compte_actif: false,
        });

      if (errorSous) throw errorSous;
      if (!souscripteur) throw new Error("Client non créé");
      setSyncState(offline ? "queued" : "syncing");

      const contractMissing =
        (formData.contrat_acquisition_requis !== false && !formData.contrat_acquisition_file) ||
        (formData.contrat_accompagnement_requis !== false && !formData.contrat_accompagnement_file);
      if (contractMissing) throw new Error("Les contrats requis (acquisition client et/ou accompagnement agricole) doivent être joints.");
      const requiredMissing = ANNEXES_SOUSCRIPTION.find((a) => a.condition(formData) && formData[`${a.field}_status`] === "joint" && !formData[`${a.field}_file`]);
      if (requiredMissing) throw new Error(`${requiredMissing.label}: fichier obligatoire lorsque “Joint” est coché`);

      const documentsPayload: any[] = [];
      const contractRows: any[] = [];
      if (formData.contrat_acquisition_file) {
        const uploaded = await uploadFile("documents", formData.contrat_acquisition_file, `${user.id}/souscriptions/${souscripteur.id}/contrats`);
        if (!uploaded) throw new Error("Upload impossible du contrat d'acquisition client");
        contractRows.push({ souscripteur_id: souscripteur.id, type_contrat: "acquisition_client", statut: "signe", fichier_url: uploaded.url, date_signature: formData.date_signature_acquisition || null, observations: "Contrat signé fourni lors du parcours client" });
        documentsPayload.push({ souscripteur_id: souscripteur.id, type_document: "contrat_acquisition_client_signe", fichier_url: uploaded.url, statut: "soumis", uploaded_by: user.id });
      }
      if (formData.contrat_accompagnement_file) {
        const uploaded = await uploadFile("documents", formData.contrat_accompagnement_file, `${user.id}/souscriptions/${souscripteur.id}/contrats`);
        if (!uploaded) throw new Error("Upload impossible du contrat d'accompagnement agricole");
        contractRows.push({ souscripteur_id: souscripteur.id, type_contrat: "accompagnement_agricole", statut: "signe", fichier_url: uploaded.url, date_signature: formData.date_signature_accompagnement || null, observations: "Contrat signé fourni lors du parcours client" });
        documentsPayload.push({ souscripteur_id: souscripteur.id, type_document: "contrat_accompagnement_agricole_signe", fichier_url: uploaded.url, statut: "soumis", uploaded_by: user.id });
      }
      if (contractRows.length) {
        const { error: contractError } = await (supabase as any).from("client_contracts").upsert(contractRows, { onConflict: "souscripteur_id,type_contrat" });
        if (contractError) throw contractError;
      }
      for (const annexe of ANNEXES_SOUSCRIPTION.filter((a) => a.condition(formData))) {
        const file = formData[`${annexe.field}_file`];
        if (!file) continue;
        const uploaded = await uploadFile("documents", file, `${user.id}/souscriptions/${souscripteur.id}/annexes`);
        if (!uploaded) throw new Error(`Upload impossible: ${annexe.label}`);
        documentsPayload.push({ souscripteur_id: souscripteur.id, type_document: annexe.field, fichier_url: uploaded.url, statut: "soumis", uploaded_by: user.id });
      }
      if (documentsPayload.length > 0) {
        const { error: docsError } = await (supabase as any).from("documents_souscription").insert(documentsPayload);
        if (docsError) throw docsError;
      }

      // Le Paiement initial est enregistré comme échéance à payer. Le terme officiel remplace
      // partout le legacy "Dépôt Initial".
      const offreRow = (await (supabase as any).from("offres").select("montant_depot_initial_par_ha,montant_total_par_ha").eq("id", formData.offre_id).single()).data;
      const paiementInitial = Math.round(Number(offreRow?.montant_depot_initial_par_ha || 0) * Number(formData.superficie_prevue || 0));
      await (supabase as any).from("souscripteurs").update({ paiement_initial_montant: paiementInitial }).eq("id", souscripteur.id);
      if (paiementInitial > 0) {
        const { error: paymentError } = await (supabase as any).from("paiements").insert({
          souscripteur_id: souscripteur.id,
          montant: paiementInitial,
          montant_theorique: paiementInitial,
          montant_paye: 0,
          type_paiement: "paiement_initial",
          est_depot_initial: true,
          statut: "en_attente",
          parcours: formData.famille_offre,
          phase: "mise_en_place",
          date_echeance: new Date().toISOString().slice(0,10),
          created_by: user.id,
        });
        if (paymentError && !String(paymentError.message || "").toLowerCase().includes("duplicate")) throw paymentError;
      }

      // Attribution du lot Hxx au souscripteur (EXT)
      if (typeFoncier === "EXT" && formData.lot_id) {
        await (supabase as any)
          .from("lots_hectares")
          .update({
            souscripteur_id: souscripteur.id,
            statut: "attribue",
            date_attribution: new Date().toISOString().slice(0, 10),
          })
          .eq("id", formData.lot_id);
      }

      if (formData.lead_id && !offline) {
        const { error: leadError } = await (supabase as any)
          .from("leads")
          .update({ statut: "converti", souscripteur_id: souscripteur.id, converti_at: new Date().toISOString() })
          .eq("id", formData.lead_id);
        if (leadError) throw leadError;
      }

      // Supprimer le brouillon
      if (brouillonId) {
        await (supabase as any).from("souscriptions_brouillon").delete().eq("id", brouillonId);
      }

      toast({
        title: "✅ Parcours client enregistré",
        description: `N° Contrat: ${souscripteur.numero_contrat || souscripteur.id_unique || souscripteur.id}`,
      });
      setSyncState(offline ? "queued" : "synced");

      navigate("/souscriptions");
    } catch (error: any) {
      setSyncState("error");
      toast({
        variant: "destructive",
        title: "Erreur",
        description: getSafeErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  // Ensure etapeActuelle doesn't exceed available steps
  const safeEtape = Math.min(etapeActuelle, etapes.length - 1);
  const EtapeComponent = etapes[safeEtape].component;
  const isLastStep = safeEtape === etapes.length - 1;

  return (
    <ProtectedRoute>
      <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Nouveau parcours client</h1>
          <p className="text-muted-foreground">
            Contrat client V1 — Sauvegarde automatique
          </p>
          <SyncStatusBadge state={syncState} className="mt-2" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {etapes.map((etape, index) => (
            <Button
              key={`${etape.titre}-${index}`}
              variant={safeEtape === index ? "default" : "outline"}
              size="sm"
              onClick={() => setEtapeActuelle(index)}
              className="min-w-fit"
            >
              {etape.num}. {etape.titre}
            </Button>
          ))}
        </div>

        <Card className="p-6">
          <EtapeComponent formData={formData} updateFormData={updateFormData} />
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={passerEtapePrecedente}
            disabled={safeEtape === 0 || saving}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Précédent
          </Button>

          {!isLastStep ? (
            <Button onClick={passerEtapeSuivante} disabled={saving}>
              {saving ? "Sauvegarde..." : "Suivant"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="lg"
              className="bg-primary"
              onClick={soumettreFormulaire}
              disabled={saving || !formData.contrat_lu}
            >
              {saving ? "Envoi en cours..." : "✓ ENREGISTRER LE PARCOURS"}
            </Button>
          )}
        </div>
      </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default NouvelleSouscription;
