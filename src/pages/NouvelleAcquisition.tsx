import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Etape1Client } from "@/components/forms/acquisition/Etape1Client";
import { Etape2Cotitulaire } from "@/components/forms/acquisition/Etape2Cotitulaire";
import { Etape0Offre } from "@/components/forms/acquisition/Etape0Offre";
import { Etape3Foncier } from "@/components/forms/acquisition/Etape3Foncier";
import { ANNEXES_SOUSCRIPTION, Etape5Documents } from "@/components/forms/acquisition/Etape5Documents";
import { Etape6Confirmation } from "@/components/forms/acquisition/Etape6Confirmation";
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

  // Parcours client : identité → co-titulaire → offre → foncier → documents → confirmation.
  const etapes = useMemo(() => {
    return [
      { num: 1, titre: "Client", component: Etape1Client },
      { num: 2, titre: "Co-titulaire", component: Etape2Cotitulaire },
      { num: 3, titre: "Offre", component: Etape0Offre },
      { num: 4, titre: "Foncier", component: Etape3Foncier },
      { num: 5, titre: "Documents", component: Etape5Documents },
      { num: 6, titre: "Confirmation", component: Etape6Confirmation },
    ];
  }, []);

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
        .from("acquisitions_brouillon")
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
          .from("acquisitions_brouillon")
          .update({
            etape_actuelle: etape,
            donnees: formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", brouillonId);

        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("acquisitions_brouillon")
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

      if (!formData.nom_famille || !formData.prenoms || !formData.telephone || !formData.offre_id) {
        throw new Error("Veuillez remplir tous les champs obligatoires (identité, coordonnées et offre)");
      }

      // Le foncier dépend exclusivement de l'offre sélectionnée.
      const offreCode = String(formData.offre_code || formData.offre?.code || "").toLowerCase();
      const isPalmInvest = offreCode === "palm-invest" || offreCode === "palm-invest-plus";
      const typeFoncier = isPalmInvest ? "EXT" : "OWN";
      if (typeFoncier === "EXT") {
        if (!formData.convention_id || !formData.lot_id) {
          throw new Error("PalmInvest : convention foncière et lot disponible obligatoires");
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

      // Créer le client et, pour TerraPalm/PalmTerroir, créer automatiquement sa parcelle propre.
      let parcelleId = formData.parcelle_id || null;
      if (typeFoncier === "OWN" && !parcelleId) {
        const surface = Number(formData.surface_propre_ha || formData.superficie_prevue || 0);
        if (surface <= 0) throw new Error("La surface de la parcelle du client est obligatoire");
        const { data: parcelle, error: parcelleError } = await offlineInsert("parcelles", {
            surface_totale_ha: surface,
            surface_proprietaire_ha: surface,
            surface_agricapital_ha: 0,
            surface_attribuee_ha: 0,
            surface_disponible_ha: surface,
            village: formData.village_propre || null,
            region_id: formData.region_id || null,
            departement_id: formData.departement_id || null,
            sous_prefecture_id: formData.sous_prefecture_id || null,
            reference_convention: formData.reference_cadastrale || null,
            statut: "active",
            notes: formData.statut_foncier ? "Statut foncier : " + formData.statut_foncier : null,
            created_by: user.id,
            updated_by: user.id,
          })

        if (parcelleError || !parcelle) throw parcelleError || new Error("Parcelle client non créée");
        parcelleId = parcelle.id;
      }

      const nomComplet = `${formData.nom_famille || ''} ${formData.prenoms || ''}`.trim();
      const selectedOffer = formData.offre || {};
      const modePaiement = formData.mode_paiement === "comptant" ? "comptant" : "echeancier";
      const superficie = Number(formData.superficie_prevue || 0);
      const paiementInitialMontant = modePaiement === "comptant"
        ? Number(selectedOffer.montant_cash_par_ha || selectedOffer.montant_total_par_ha || 0) * superficie
        : Number(selectedOffer.montant_depot_initial_par_ha || selectedOffer.montant_da_par_ha || 0) * superficie;
      
      const { data: client, error: errorSous, offline } = await offlineInsert("clients", {
          offre_id: formData.offre_id,
          parcelle_id: parcelleId,
          type_client: isPalmInvest ? "sans_terre" : "avec_terre",
          type_client_foncier: typeFoncier,
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
          mode_paiement: modePaiement,
          paiement_initial_montant: paiementInitialMontant,
        });

      if (errorSous) throw errorSous;
      if (!client) throw new Error("Client non créé");
      setSyncState(offline ? "queued" : "syncing");

      const requiredMissing = ANNEXES_SOUSCRIPTION.find((a) => a.condition(formData) && formData[`${a.field}_status`] === "joint" && !formData[`${a.field}_file`]);
      if (requiredMissing) throw new Error(`${requiredMissing.label}: fichier obligatoire lorsque “Joint” est coché`);

      const documentsPayload: any[] = [];
      if (formData.contrat_file) {
        const uploaded = await uploadFile("documents", formData.contrat_file, `${user.id}/acquisitions/${client.id}`);
        if (!uploaded) throw new Error("Upload impossible du contrat signé");
        documentsPayload.push({ client_id: client.id, type_document: "contrat_acquisition_signe", fichier_url: uploaded.url, statut: "soumis", uploaded_by: user.id });
      }
      for (const annexe of ANNEXES_SOUSCRIPTION.filter((a) => a.condition(formData))) {
        const file = formData[`${annexe.field}_file`];
        if (!file) continue;
        const uploaded = await uploadFile("documents", file, `${user.id}/acquisitions/${client.id}/annexes`);
        if (!uploaded) throw new Error(`Upload impossible: ${annexe.label}`);
        documentsPayload.push({ client_id: client.id, type_document: annexe.field, fichier_url: uploaded.url, statut: "soumis", uploaded_by: user.id });
      }
      if (documentsPayload.length > 0) {
        const { error: docsError } = await (supabase as any).from("documents_acquisition").insert(documentsPayload);
        if (docsError) throw docsError;
      }

      // Attribution du lot au client PalmInvest
      if (typeFoncier === "EXT" && formData.lot_id) {
        await (supabase as any)
          .from("lots_hectares")
          .update({
            client_id: client.id,
            statut: "attribue",
            date_attribution: new Date().toISOString().slice(0, 10),
          })
          .eq("id", formData.lot_id);
      }

      if (formData.lead_id && !offline) {
        const { error: leadError } = await (supabase as any)
          .from("leads")
          .update({ statut: "converti", client_id: client.id, converti_at: new Date().toISOString() })
          .eq("id", formData.lead_id);
        if (leadError) throw leadError;
      }

      // Supprimer le brouillon
      if (brouillonId) {
        await (supabase as any).from("acquisitions_brouillon").delete().eq("id", brouillonId);
      }

      toast({
        title: "✅ Parcours client enregistré",
        description: `N° Contrat: ${client.numero_contrat || client.id_unique || client.id}`,
      });
      setSyncState(offline ? "queued" : "synced");

      navigate("/acquisitions");
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
      <div className="max-w-7xl mx-auto page-section">
        <div>
          <h1 className="text-3xl font-bold">Nouveau parcours client</h1>
          <p className="text-muted-foreground">
            Contrat client — Sauvegarde automatique
          </p>
          <SyncStatusBadge state={syncState} className="mt-2" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
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

        <Card className="p-4 sm:p-6 rounded-2xl shadow-sm">
          <EtapeComponent formData={formData} updateFormData={updateFormData} />
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
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
