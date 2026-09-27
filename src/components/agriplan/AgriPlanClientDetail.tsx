import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgriPlanGeo } from "@/hooks/useAgriPlanGeo";
import { PERMISSIONS, hasPermission } from "@/lib/roles";
import { AGRIPLAN_ETAPES, AGRIPLAN_PARCOURS, AGRIPLAN_TYPES_VISITE, AGRIPLAN_VISITE_STATUTS, formatFCFA, labelOf } from "@/lib/agriplan";
import { openAgriPlanFile, uploadAgriPlanFile } from "@/lib/agriplanFiles";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logAdminAction } from "@/lib/audit";
import { Archive, FileText, PauseCircle, PlayCircle, Plus, Send, Upload, UserCog } from "lucide-react";


interface Props {
  clientId: string | null;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

type Row = Record<string, any>;

export default function AgriPlanClientDetail({ clientId, onOpenChange, onChanged }: Props) {
  const { user, profile, userRoles } = useAuth();
  const { nomRegion, nomSousPrefecture } = useAgriPlanGeo();
  const [client, setClient] = useState<Row | null>(null);
  const [ventes, setVentes] = useState<Row[]>([]);
  const [echeances, setEcheances] = useState<Row[]>([]);
  const [paiements, setPaiements] = useState<Row[]>([]);
  const [plantations, setPlantations] = useState<Row[]>([]);
  const [visites, setVisites] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [messages, setMessages] = useState<Row[]>([]);
  const [evenements, setEvenements] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const canTech = hasPermission(userRoles, PERMISSIONS.AGRIPLAN_TECHNIQUE);
  const canArchive = hasPermission(userRoles, PERMISSIONS.AGRIPLAN_ARCHIVER);
  const canPay = hasPermission(userRoles, PERMISSIONS.VIEW_PAIEMENTS);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, v, e, p, pl, vi, d, m, ev] = await Promise.all([
      supabase.from("agriplan_clients").select("*").eq("id", clientId).maybeSingle(),
      supabase.from("agriplan_ventes").select("*").eq("client_id", clientId).order("created_at"),
      supabase.from("agriplan_echeances").select("*").eq("client_id", clientId).order("numero_echeance"),
      supabase.from("paiements").select("*").eq("agriplan_client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("agriplan_plantations").select("*").eq("client_id", clientId).order("numero"),
      supabase.from("agriplan_visites").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("agriplan_documents").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("agriplan_messages").select("*").eq("client_id", clientId).order("created_at"),
      supabase.from("agriplan_evenements").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    setClient(c.data as Row);
    setVentes((v.data || []) as Row[]);
    setEcheances((e.data || []) as Row[]);
    setPaiements((p.data || []) as Row[]);
    setPlantations((pl.data || []) as Row[]);
    setVisites((vi.data || []) as Row[]);
    setDocuments((d.data || []) as Row[]);
    setMessages((m.data || []) as Row[]);
    setEvenements((ev.data || []) as Row[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const trace = async (entity_type: string, entity_id: string | null, action: string, details: string, visible = false) => {
    if (!clientId) return;
    await supabase.from("agriplan_evenements").insert({
      client_id: clientId, entity_type, entity_id, action, details, acteur_id: user?.id || null, visible_client: visible,
    });
  };

  /* ---------------- Paiement ---------------- */
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ echeance_id: "", montant: "", mode: "mobile_money", reference: "" });

  const enregistrerPaiement = async () => {
    const ech = echeances.find((e) => e.id === payForm.echeance_id);
    const montant = Number(payForm.montant);
    if (!ech || !(montant > 0)) {
      toast.error("Sélectionnez une échéance et un montant valide");
      return;
    }
    const { error } = await supabase.from("paiements").insert({
      parcours: AGRIPLAN_PARCOURS,
      agriplan_client_id: clientId,
      agriplan_vente_id: ech.vente_id,
      agriplan_echeance_id: ech.id,
      montant,
      montant_paye: montant,
      type_paiement: ech.type === "accompagnement" ? "accompagnement" : "mise_en_place",
      mode_paiement: payForm.mode,
      reference: payForm.reference || null,
      // La validation est réservée au service financier (contrôle serveur) :
      // un paiement saisi ici reste en attente de vérification.
      statut: "en_attente",
      date_paiement: new Date().toISOString(),
      created_by: user?.id || null,
    });
    if (error) {
      toast.error("Paiement refusé : " + error.message);
      return;
    }
    await trace("paiement", ech.id, "paiement_enregistre", `${formatFCFA(montant)} — ${ech.libelle}`, true);
    toast.success("Paiement enregistré — en attente de validation par la comptabilité");
    setPayOpen(false);
    setPayForm({ echeance_id: "", montant: "", mode: "mobile_money", reference: "" });
    load();
    onChanged();
  };

  /* ---------------- Plantation ---------------- */
  const [plantOpen, setPlantOpen] = useState(false);
  const [plantForm, setPlantForm] = useState({ localite: "", superficie_ha: "", variete: "", date_plantation: "" });

  const ajouterPlantation = async () => {
    if (!clientId) return;
    const { data, error } = await supabase
      .from("agriplan_plantations")
      .insert({
        client_id: clientId,
        vente_id: ventes[0]?.id || null,
        localite: plantForm.localite || null,
        superficie_ha: plantForm.superficie_ha ? Number(plantForm.superficie_ha) : null,
        variete: plantForm.variete || null,
        date_plantation: plantForm.date_plantation || null,
        statut: "en_preparation",
        created_by: user?.id || null,
      })
      .select("id, nom")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await trace("plantation", data.id, "plantation_creee", `${data.nom} enregistrée`, true);
    toast.success(`${data.nom} enregistrée`);
    setPlantOpen(false);
    setPlantForm({ localite: "", superficie_ha: "", variete: "", date_plantation: "" });
    load();
  };

  /* ---------------- Visite technique ---------------- */
  const [visiteOpen, setVisiteOpen] = useState(false);
  const [visiteForm, setVisiteForm] = useState({
    plantation_id: "", date_prevue: "", date_visite: "", type_visite: "suivi", statut: "planifiee",
    observations: "", etat_plantation: "", travaux_realises: "", recommandations: "",
    intrants: "", quantites: "", prochaine_intervention: "", date_prochaine_intervention: "", publie: true,
  });
  const [visiteFiles, setVisiteFiles] = useState<File[]>([]);

  const enregistrerVisite = async () => {
    if (!clientId || !visiteForm.plantation_id) {
      toast.error("Sélectionnez une plantation");
      return;
    }
    const medias: string[] = [];
    for (const f of visiteFiles) {
      const up = await uploadAgriPlanFile(clientId, "suivi", f);
      if (up.path) medias.push(up.path);
    }
    const photos = medias.filter((p) => !/\.(mp4|mov|avi|webm)$/i.test(p));
    const videos = medias.filter((p) => /\.(mp4|mov|avi|webm)$/i.test(p));

    const { data, error } = await (supabase as any)
      .from("agriplan_visites")
      .insert({
        client_id: clientId,
        plantation_id: visiteForm.plantation_id,
        technicien_id: user?.id || null,
        technicien_nom: profile?.nom_complet || null,
        date_prevue: visiteForm.date_prevue || null,
        date_visite: visiteForm.date_visite || null,
        type_visite: visiteForm.type_visite,
        statut: visiteForm.statut,
        observations: visiteForm.observations || null,
        etat_plantation: visiteForm.etat_plantation || null,
        travaux_realises: visiteForm.travaux_realises || null,
        recommandations: visiteForm.recommandations || null,
        intrants: visiteForm.intrants || null,
        quantites: visiteForm.quantites || null,
        prochaine_intervention: visiteForm.prochaine_intervention || null,
        date_prochaine_intervention: visiteForm.date_prochaine_intervention || null,
        photos: photos as never,
        videos: videos as never,
        publie: visiteForm.publie,
        created_by: user?.id || null,
      })
      .select("id, numero_visite")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await trace("visite", data.id, "visite_enregistree", `Visite ${data.numero_visite} — ${visiteForm.type_visite}`, true);
    toast.success("Rapport de visite enregistré");
    setVisiteOpen(false);
    setVisiteFiles([]);
    load();
  };

  /* ---------------- Documents ---------------- */
  const [docType, setDocType] = useState("autre");
  const uploadDoc = async (file?: File | null) => {
    if (!file || !clientId) return;
    const up = await uploadAgriPlanFile(clientId, docType, file);
    if (!up.path) {
      toast.error("Upload impossible");
      return;
    }
    await supabase.from("agriplan_documents").insert({
      client_id: clientId, type_document: docType, nom: file.name, fichier_url: up.path, uploaded_by: user?.id || null,
    });
    await trace("document", null, "document_ajoute", `${docType} — ${file.name}`, true);
    toast.success("Document ajouté");
    load();
  };

  /* ---------------- Échanges ---------------- */
  const [msg, setMsg] = useState("");
  const envoyerMessage = async () => {
    if (!msg.trim() || !clientId) return;
    const { error } = await supabase.from("agriplan_messages").insert({
      client_id: clientId, auteur_user_id: user?.id || null, auteur_type: "interne",
      auteur_nom: profile?.nom_complet || "Équipe AgriCapital", message: msg.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMsg("");
    load();
  };

  /* ---------------- Dossier ---------------- */
  const majStatutDossier = async (statut: string) => {
    if (!clientId) return;
    await supabase.from("agriplan_clients").update({ statut_dossier: statut }).eq("id", clientId);
    await trace("client", clientId, "statut_dossier", labelOf(AGRIPLAN_ETAPES as never, statut), true);
    load();
    onChanged();
  };

  const changerStatutCompte = async (nouveau: "actif" | "suspendu" | "archive") => {
    if (!clientId) return;
    const ancien = client?.statut || "actif";
    const { error } = await supabase
      .from("agriplan_clients")
      .update({
        statut: nouveau,
        archived_at: nouveau === "archive" ? new Date().toISOString() : null,
        archived_by: nouveau === "archive" ? user?.id || null : null,
      })
      .eq("id", clientId);
    if (error) {
      toast.error(error.message);
      return;
    }
    const actions: Record<string, string> = { actif: "compte_reactive", suspendu: "compte_suspendu", archive: "compte_archive" };
    await logAdminAction({
      action: actions[nouveau],
      entite: "agriplan_clients",
      entite_id: clientId,
      cible_libelle: `${client?.nom_complet || ""} (${client?.numero_client || ""})`,
      ancienne_valeur: { statut: ancien },
      nouvelle_valeur: { statut: nouveau },
      details: `Compte client AgriPlan ${nouveau}`,
    });
    await trace("client", clientId, actions[nouveau], `Statut du compte : ${ancien} → ${nouveau}`);
    toast.success(
      nouveau === "archive" ? "Compte archivé (données conservées)" : nouveau === "suspendu" ? "Compte suspendu" : "Compte réactivé",
    );
    load();
    onChanged();
  };

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ telephone: "", whatsapp: "", email: "", contact_nom: "", contact_telephone: "" });

  const ouvrirContact = () => {
    setContactForm({
      telephone: client?.telephone || "",
      whatsapp: client?.whatsapp || "",
      email: client?.email || "",
      contact_nom: client?.contact_nom || "",
      contact_telephone: client?.contact_telephone || "",
    });
    setContactOpen(true);
  };

  const enregistrerContact = async () => {
    if (!clientId) return;
    const ancien = {
      telephone: client?.telephone, whatsapp: client?.whatsapp, email: client?.email,
      contact_nom: client?.contact_nom, contact_telephone: client?.contact_telephone,
    };
    const nouveau = {
      telephone: contactForm.telephone.trim(),
      whatsapp: contactForm.whatsapp.trim() || null,
      email: contactForm.email.trim() || null,
      contact_nom: contactForm.contact_nom.trim() || null,
      contact_telephone: contactForm.contact_telephone.trim() || null,
    };
    const { error } = await supabase.from("agriplan_clients").update(nouveau).eq("id", clientId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAdminAction({
      action: "contact_modifie",
      entite: "agriplan_clients",
      entite_id: clientId,
      cible_libelle: `${client?.nom_complet || ""} (${client?.numero_client || ""})`,
      ancienne_valeur: ancien,
      nouvelle_valeur: nouveau,
      details: "Coordonnées du client AgriPlan modifiées",
    });
    await trace("client", clientId, "contact_modifie", "Coordonnées mises à jour", true);
    toast.success("Coordonnées mises à jour");
    setContactOpen(false);
    load();
    onChanged();
  };


  const totalPaye = ventes.reduce((s, v) => s + Number(v.total_paye || 0), 0);
  const totalDu = ventes.reduce((s, v) => s + Number(v.montant_total || 0), 0);

  return (
    <Sheet open={!!clientId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {client?.nom_complet || "Dossier AgriPlan"}
            <Badge variant="outline">{client?.numero_client}</Badge>
            {client?.statut === "archive" && <Badge variant="secondary">Archivé</Badge>}
          </SheetTitle>
          <SheetDescription>
            {loading ? "Chargement..." : `${formatFCFA(totalPaye)} payé sur ${formatFCFA(totalDu)} — ${labelOf(AGRIPLAN_ETAPES as never, client?.statut_dossier)}`}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="dossier" className="mt-4">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="dossier">Dossier</TabsTrigger>
            <TabsTrigger value="paiements">Paiements</TabsTrigger>
            <TabsTrigger value="plantations">Plantations</TabsTrigger>
            <TabsTrigger value="suivi">Suivi technique</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="echanges">Échanges</TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
          </TabsList>

          {/* DOSSIER */}
          <TabsContent value="dossier" className="space-y-4 pt-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Téléphone : </span>{client?.telephone}</div>
              <div><span className="text-muted-foreground">WhatsApp : </span>{client?.whatsapp || "—"}</div>
              <div><span className="text-muted-foreground">Email : </span>{client?.email || "—"}</div>
              <div><span className="text-muted-foreground">Région : </span>{nomRegion(client?.region_id)}</div>
              <div><span className="text-muted-foreground">Sous-préfecture : </span>{nomSousPrefecture(client?.sous_prefecture_id)}</div>
              <div><span className="text-muted-foreground">Localité : </span>{client?.localite || "—"}</div>
              <div><span className="text-muted-foreground">Contact : </span>{client?.contact_nom || "—"} {client?.contact_telephone || ""}</div>
              <div><span className="text-muted-foreground">Pièce : </span>{client?.type_piece || "—"} {client?.numero_piece || ""}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {client?.piece_identite_url && (
                <Button variant="outline" size="sm" onClick={() => openAgriPlanFile(client.piece_identite_url)}><FileText className="mr-1 h-4 w-4" />Pièce d'identité</Button>
              )}
              {client?.contrat_url && (
                <Button variant="outline" size="sm" onClick={() => openAgriPlanFile(client.contrat_url)}><FileText className="mr-1 h-4 w-4" />Contrat</Button>
              )}
            </div>

            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Progression du dossier</Label>
                <Select value={client?.statut_dossier || ""} onValueChange={majStatutDossier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AGRIPLAN_ETAPES.map((e) => <SelectItem key={e.code} value={e.code}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {canArchive && (
              <div className="rounded-lg border p-3">
                <p className="mb-1 text-sm font-semibold">Actions sur le compte client</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Statut actuel : <Badge variant="outline">{client?.statut || "actif"}</Badge> — chaque action est journalisée (qui, quoi, quand).
                </p>
                <div className="flex flex-wrap gap-2">
                  {client?.statut !== "archive" && (
                    <Button size="sm" variant="secondary" onClick={() => changerStatutCompte("archive")}>
                      <Archive className="mr-1 h-4 w-4" />Archiver
                    </Button>
                  )}
                  {client?.statut !== "suspendu" && client?.statut !== "archive" && (
                    <Button size="sm" variant="outline" onClick={() => changerStatutCompte("suspendu")}>
                      <PauseCircle className="mr-1 h-4 w-4" />Suspendre
                    </Button>
                  )}
                  {client?.statut !== "actif" && (
                    <Button size="sm" onClick={() => changerStatutCompte("actif")}>
                      <PlayCircle className="mr-1 h-4 w-4" />Réactiver
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={ouvrirContact}>
                    <UserCog className="mr-1 h-4 w-4" />Modifier le contact
                  </Button>
                </div>
              </div>
            )}

            <Dialog open={contactOpen} onOpenChange={setContactOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Modifier les coordonnées</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Téléphone</Label><Input value={contactForm.telephone} onChange={(e) => setContactForm({ ...contactForm, telephone: e.target.value })} /></div>
                  <div><Label>WhatsApp</Label><Input value={contactForm.whatsapp} onChange={(e) => setContactForm({ ...contactForm, whatsapp: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div>
                  <div><Label>Personne à contacter</Label><Input value={contactForm.contact_nom} onChange={(e) => setContactForm({ ...contactForm, contact_nom: e.target.value })} /></div>
                  <div><Label>Téléphone du contact</Label><Input value={contactForm.contact_telephone} onChange={(e) => setContactForm({ ...contactForm, contact_telephone: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setContactOpen(false)}>Annuler</Button>
                  <Button onClick={enregistrerContact}>Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>


            <Separator />
            <p className="text-sm font-semibold">Ventes</p>
            <Table>
              <TableHeader><TableRow><TableHead>Référence</TableHead><TableHead>Superficie</TableHead><TableHead>Total</TableHead><TableHead>Payé</TableHead><TableHead>Solde</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {ventes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.reference}</TableCell>
                    <TableCell>{v.superficie_ha} ha</TableCell>
                    <TableCell>{formatFCFA(v.montant_total)}</TableCell>
                    <TableCell>{formatFCFA(v.total_paye)}</TableCell>
                    <TableCell>{formatFCFA(v.solde)}</TableCell>
                    <TableCell><Badge variant="outline">{v.statut}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* PAIEMENTS */}
          <TabsContent value="paiements" className="space-y-4 pt-4">
            {canPay && (
              <Button size="sm" onClick={() => setPayOpen(true)}><Plus className="mr-1 h-4 w-4" />Enregistrer un paiement</Button>
            )}
            <p className="text-sm font-semibold">Échéancier</p>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Libellé</TableHead><TableHead>Échéance</TableHead><TableHead>Montant</TableHead><TableHead>Payé</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {echeances.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.numero_echeance}</TableCell>
                    <TableCell>{e.libelle}</TableCell>
                    <TableCell>{e.date_echeance || "—"}</TableCell>
                    <TableCell>{formatFCFA(e.montant)}</TableCell>
                    <TableCell>{formatFCFA(e.montant_paye)}</TableCell>
                    <TableCell><Badge variant={e.statut === "paye" ? "default" : e.statut === "en_retard" ? "destructive" : "outline"}>{e.statut}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <p className="text-sm font-semibold">Transactions AgriPlan</p>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Parcours</TableHead><TableHead>Montant</TableHead><TableHead>Mode</TableHead><TableHead>Référence</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {paiements.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date_paiement ? new Date(p.date_paiement).toLocaleDateString("fr-FR") : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{p.parcours}</Badge></TableCell>
                    <TableCell>{formatFCFA(p.montant_paye ?? p.montant)}</TableCell>
                    <TableCell>{p.mode_paiement || "—"}</TableCell>
                    <TableCell>{p.reference || p.id_transaction || "—"}</TableCell>
                    <TableCell><Badge variant={p.statut === "valide" ? "default" : "outline"}>{p.statut}</Badge></TableCell>
                  </TableRow>
                ))}
                {paiements.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucune transaction</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          {/* PLANTATIONS */}
          <TabsContent value="plantations" className="space-y-4 pt-4">
            <Button size="sm" onClick={() => setPlantOpen(true)}><Plus className="mr-1 h-4 w-4" />Ajouter une plantation</Button>
            <Table>
              <TableHeader><TableRow><TableHead>Plantation</TableHead><TableHead>Localité</TableHead><TableHead>Superficie</TableHead><TableHead>Statut</TableHead><TableHead>Dernière visite</TableHead><TableHead>Prochaine</TableHead></TableRow></TableHeader>
              <TableBody>
                {plantations.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nom}</TableCell>
                    <TableCell>{p.localite || "—"}</TableCell>
                    <TableCell>{p.superficie_ha ? `${p.superficie_ha} ha` : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{p.statut}</Badge></TableCell>
                    <TableCell>{p.derniere_visite || "—"}</TableCell>
                    <TableCell>{p.prochaine_visite || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* SUIVI TECHNIQUE */}
          <TabsContent value="suivi" className="space-y-4 pt-4">
            {canTech ? (
              <Button size="sm" onClick={() => setVisiteOpen(true)}><Plus className="mr-1 h-4 w-4" />Nouvelle fiche de visite</Button>
            ) : (
              <p className="text-sm text-muted-foreground">Consultation seule : la création des rapports est réservée aux techniciens autorisés.</p>
            )}
            <div className="space-y-3">
              {visites.map((v) => (
                <div key={v.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Visite {String(v.numero_visite).padStart(2, "0")}</span>
                    <span>— {v.date_visite || v.date_prevue || "date à définir"}</span>
                    <Badge variant="outline">{v.type_visite}</Badge>
                    <Badge variant={v.statut === "realisee" ? "default" : "outline"}>{labelOf(AGRIPLAN_VISITE_STATUTS as never, v.statut)}</Badge>
                    {v.publie && <Badge variant="secondary">Publiée au client</Badge>}
                  </div>
                  <div className="mt-2 grid gap-1">
                    <div><span className="text-muted-foreground">Technicien : </span>{v.technicien_nom || "—"}</div>
                    {v.etat_plantation && <div><span className="text-muted-foreground">État : </span>{v.etat_plantation}</div>}
                    {v.observations && <div><span className="text-muted-foreground">Constat : </span>{v.observations}</div>}
                    {v.travaux_realises && <div><span className="text-muted-foreground">Interventions : </span>{v.travaux_realises}</div>}
                    {v.intrants && <div><span className="text-muted-foreground">Intrants : </span>{v.intrants} {v.quantites ? `(${v.quantites})` : ""}</div>}
                    {v.recommandations && <div><span className="text-muted-foreground">Recommandation : </span>{v.recommandations}</div>}
                    {(v.prochaine_intervention || v.date_prochaine_intervention) && (
                      <div><span className="text-muted-foreground">Prochaine intervention : </span>{v.prochaine_intervention || "—"} {v.date_prochaine_intervention ? `— ${v.date_prochaine_intervention}` : ""}</div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...((v.photos as string[]) || []), ...((v.videos as string[]) || [])].map((p) => (
                      <Button key={p} size="sm" variant="outline" onClick={() => openAgriPlanFile(p)}>Média</Button>
                    ))}
                  </div>
                </div>
              ))}
              {visites.length === 0 && <p className="text-sm text-muted-foreground">Aucune visite enregistrée.</p>}
            </div>
          </TabsContent>

          {/* DOCUMENTS */}
          <TabsContent value="documents" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["piece_identite", "contrat", "rapport_technique", "photo", "video", "autre"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1"><Upload className="h-4 w-4" />Fichier</Label>
                <Input type="file" onChange={(e) => uploadDoc(e.target.files?.[0])} />
              </div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Nom</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {documents.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.type_document}</TableCell>
                    <TableCell>{d.nom}</TableCell>
                    <TableCell>{new Date(d.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => openAgriPlanFile(d.fichier_url)}>Ouvrir</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ÉCHANGES */}
          <TabsContent value="echanges" className="space-y-3 pt-4">
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`rounded-md border p-2 text-sm ${m.auteur_type === "client" ? "bg-muted/40" : ""}`}>
                  <div className="text-xs text-muted-foreground">{m.auteur_nom || m.auteur_type} — {new Date(m.created_at).toLocaleString("fr-FR")}</div>
                  <div>{m.message}</div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-sm text-muted-foreground">Aucun échange.</p>}
            </div>
            <div className="flex gap-2">
              <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Répondre au client..." />
              <Button onClick={envoyerMessage}><Send className="h-4 w-4" /></Button>
            </div>
          </TabsContent>

          {/* HISTORIQUE */}
          <TabsContent value="historique" className="space-y-2 pt-4">
            {evenements.map((e) => (
              <div key={e.id} className="rounded-md border p-2 text-sm">
                <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR")} — {e.entity_type}</div>
                <div><span className="font-medium">{e.action}</span> {e.details ? `— ${e.details}` : ""}</div>
              </div>
            ))}
            {evenements.length === 0 && <p className="text-sm text-muted-foreground">Aucun événement.</p>}
          </TabsContent>
        </Tabs>

        {/* Dialog paiement */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Paiement AgriPlan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Échéance</Label>
                <Select value={payForm.echeance_id} onValueChange={(v) => {
                  const e = echeances.find((x) => x.id === v);
                  setPayForm((f) => ({ ...f, echeance_id: v, montant: String(Math.max(Number(e?.montant || 0) - Number(e?.montant_paye || 0), 0)) }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {echeances.filter((e) => e.statut !== "paye").map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.numero_echeance}. {e.libelle} — {formatFCFA(e.montant)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Montant</Label><Input type="number" value={payForm.montant} onChange={(e) => setPayForm((f) => ({ ...f, montant: e.target.value }))} /></div>
              <div>
                <Label>Mode de paiement</Label>
                <Select value={payForm.mode} onValueChange={(v) => setPayForm((f) => ({ ...f, mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["mobile_money", "especes", "virement", "cheque", "kkiapay"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Référence</Label><Input value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOpen(false)}>Annuler</Button>
              <Button onClick={enregistrerPaiement}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog plantation */}
        <Dialog open={plantOpen} onOpenChange={setPlantOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle plantation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Localité</Label><Input value={plantForm.localite} onChange={(e) => setPlantForm((f) => ({ ...f, localite: e.target.value }))} /></div>
              <div><Label>Superficie (ha)</Label><Input type="number" step="0.1" value={plantForm.superficie_ha} onChange={(e) => setPlantForm((f) => ({ ...f, superficie_ha: e.target.value }))} /></div>
              <div><Label>Variété</Label><Input value={plantForm.variete} onChange={(e) => setPlantForm((f) => ({ ...f, variete: e.target.value }))} /></div>
              <div><Label>Date de plantation</Label><Input type="date" value={plantForm.date_plantation} onChange={(e) => setPlantForm((f) => ({ ...f, date_plantation: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPlantOpen(false)}>Annuler</Button>
              <Button onClick={ajouterPlantation}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog visite technique */}
        <Dialog open={visiteOpen} onOpenChange={setVisiteOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>Fiche de visite technique</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Plantation</Label>
                <Select value={visiteForm.plantation_id} onValueChange={(v) => setVisiteForm((f) => ({ ...f, plantation_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{plantations.map((p) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de visite</Label>
                <Select value={visiteForm.type_visite} onValueChange={(v) => setVisiteForm((f) => ({ ...f, type_visite: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AGRIPLAN_TYPES_VISITE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date prévue</Label><Input type="date" value={visiteForm.date_prevue} onChange={(e) => setVisiteForm((f) => ({ ...f, date_prevue: e.target.value }))} /></div>
              <div><Label>Date réelle de visite</Label><Input type="date" value={visiteForm.date_visite} onChange={(e) => setVisiteForm((f) => ({ ...f, date_visite: e.target.value }))} /></div>
              <div>
                <Label>Statut</Label>
                <Select value={visiteForm.statut} onValueChange={(v) => setVisiteForm((f) => ({ ...f, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AGRIPLAN_VISITE_STATUTS.map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>État de la plantation</Label><Input value={visiteForm.etat_plantation} onChange={(e) => setVisiteForm((f) => ({ ...f, etat_plantation: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Observations / constat</Label><Textarea rows={2} value={visiteForm.observations} onChange={(e) => setVisiteForm((f) => ({ ...f, observations: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Travaux / interventions réalisés</Label><Textarea rows={2} value={visiteForm.travaux_realises} onChange={(e) => setVisiteForm((f) => ({ ...f, travaux_realises: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Recommandations</Label><Textarea rows={2} value={visiteForm.recommandations} onChange={(e) => setVisiteForm((f) => ({ ...f, recommandations: e.target.value }))} /></div>
              <div><Label>Intrants utilisés</Label><Input value={visiteForm.intrants} onChange={(e) => setVisiteForm((f) => ({ ...f, intrants: e.target.value }))} /></div>
              <div><Label>Quantités utilisées</Label><Input value={visiteForm.quantites} onChange={(e) => setVisiteForm((f) => ({ ...f, quantites: e.target.value }))} /></div>
              <div><Label>Prochaine intervention</Label><Input value={visiteForm.prochaine_intervention} onChange={(e) => setVisiteForm((f) => ({ ...f, prochaine_intervention: e.target.value }))} /></div>
              <div><Label>Date prochaine intervention</Label><Input type="date" value={visiteForm.date_prochaine_intervention} onChange={(e) => setVisiteForm((f) => ({ ...f, date_prochaine_intervention: e.target.value }))} /></div>
              <div className="sm:col-span-2">
                <Label>Photos / vidéos / pièces jointes</Label>
                <Input type="file" multiple onChange={(e) => setVisiteFiles(Array.from(e.target.files || []))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVisiteOpen(false)}>Annuler</Button>
              <Button onClick={enregistrerVisite}>Enregistrer le rapport</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
