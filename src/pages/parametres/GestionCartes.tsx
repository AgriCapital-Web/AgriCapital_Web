import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS, hasPermission, roleLabel } from "@/lib/roles";
import { logAdminAction } from "@/lib/audit";
import { uploaderPhotoCarte, CARTE_BUCKET } from "@/lib/photoCarte";
import { CarteRecto, CarteVerso, CONTRATS, STATUTS_AGENT, contratLabel, CarteData } from "@/components/cartes/CartePersonnel";
import ScanCarteDialog from "@/components/cartes/ScanCarteDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgeCheck, Ban, Download, IdCard, Printer, QrCode, RefreshCw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import html2canvas from "html2canvas";

type Row = Record<string, any>;

const STATUTS = [
  { v: "en_attente", l: "En attente" },
  { v: "active", l: "Validée / Active" },
  { v: "suspendue", l: "Suspendue" },
  { v: "revoquee", l: "Révoquée" },
];

const matriculeFor = (profile: Row, index: number) =>
  `AC-${String(profile.matricule_seed || index + 1).padStart(4, "0")}`;

const GestionCartes = () => {
  const { userRoles, user } = useAuth();
  const peutGerer = hasPermission(userRoles, PERMISSIONS.VIEW_AUDIT);

  const [profiles, setProfiles] = useState<Row[]>([]);
  const [cartes, setCartes] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [form, setForm] = useState({
    poste: "",
    departement: "",
    type_contrat: "cdi",
    statut_agent: "employe",
    mission: "",
    zone_intervention: "",
    date_delivrance: "",
    date_expiration: "",
    statut: "active",
  });
  const rectoRef = useRef<HTMLDivElement>(null);
  const versoRef = useRef<HTMLDivElement>(null);
  const [carteTab, setCarteTab] = useState("recto");

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c, r] = await Promise.all([
      (supabase as any).from("profils_annuaire").select("id, user_id, nom_complet, email, telephone, poste, departement, photo_url, actif").order("nom_complet"),
      (supabase as any).from("cartes_personnel").select("*"),
      (supabase as any).from("user_roles").select("user_id, role"),
    ]);
    setProfiles((p.data || []) as Row[]);
    setCartes((c.data || []) as Row[]);
    const map: Record<string, string> = {};
    ((r.data || []) as Row[]).forEach((x) => { if (!map[x.user_id]) map[x.user_id] = x.role; });
    setRoles(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const carteDe = useCallback((profileId: string) => cartes.find((c) => c.profile_id === profileId), [cartes]);

  /** Rôles exclus : clients / souscripteurs / démo — la carte est réservée aux équipes AgriCapital. */
  const NON_STAFF = ["user", "souscripteur", "client", "demo", "proprietaire"];

  const lignes = useMemo(() => {
    const t = q.trim().toLowerCase();
    return profiles
      .filter((p) => {
        const r = roles[p.user_id];
        return !!r && !NON_STAFF.includes(r);
      })
      .filter((p) => !t || [p.nom_complet, p.email, p.poste].some((v) => (v || "").toLowerCase().includes(t)))

      .map((p, i) => {
        const c = carteDe(p.id);
        return {
          profile: p,
          carte: c,
          data: {
            id: c?.id,
            matricule: c?.matricule || matriculeFor(p, i),
            code_verification: c?.code_verification || "",
            nom_complet: p.nom_complet,
            poste: c?.poste || p.poste,
            departement: c?.departement || p.departement,
            role_code: c?.role_code || roles[p.user_id],
            type_contrat: c?.type_contrat || "cdi",
            statut_agent: c?.statut_agent || "employe",
            mission: c?.mission || null,
            zone_intervention: c?.zone_intervention || p.departement || null,
            photo_url: c?.photo_url || p.photo_url || null,
            photo_bucket: c?.photo_url ? CARTE_BUCKET : "photos-profils",
            date_delivrance: c?.date_delivrance || null,
            date_expiration: c?.date_expiration || null,
            statut: c?.statut || "active",
            telephone: p.telephone,
            email: p.email,
          } as CarteData,
        };
      });
  }, [profiles, carteDe, q, roles]);

  const nextMatricule = () => {
    const nums = cartes
      .map((c) => Number(String(c.matricule || "").replace(/\D/g, "")))
      .filter((n) => Number.isFinite(n));
    return `AC-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
  };

  const genererCarte = async (profile: Row) => {
    const existante = carteDe(profile.id);
    if (existante) { setSelected(profile); return; }
    const payload = {
      profile_id: profile.id,
      matricule: nextMatricule(),
      poste: profile.poste || roleLabel(roles[profile.user_id]),
      departement: profile.departement || null,
      role_code: roles[profile.user_id] || null,
      type_contrat: "cdi",
      statut_agent: "employe",
      zone_intervention: profile.departement || null,
      statut: "en_attente",
      created_by: user?.id || null,
    };
    const { data, error } = await (supabase as any).from("cartes_personnel").insert(payload).select("*").single();
    if (error) { toast.error(error.message); return; }
    await logAdminAction({
      action: "carte_creee",
      entite: "cartes_personnel",
      entite_id: data.id,
      cible_user_id: profile.user_id,
      cible_libelle: profile.nom_complet,
      nouvelle_valeur: payload,
      details: `Création de la carte ${data.matricule} pour ${profile.nom_complet}`,
    });
    toast.success(`Carte ${data.matricule} générée`);
    await load();
    setSelected(profile);
  };

  const genererToutes = async () => {
    const manquantes = profiles.filter((p) => !carteDe(p.id));
    if (!manquantes.length) { toast.info("Toutes les cartes existent déjà"); return; }
    for (const p of manquantes) await genererCarte(p);
    toast.success(`${manquantes.length} carte(s) générée(s)`);
  };

  const ouvrirEdition = (carte: Row) => {
    setForm({
      poste: carte.poste || "",
      departement: carte.departement || "",
      type_contrat: carte.type_contrat || "cdi",
      statut_agent: carte.statut_agent || "employe",
      mission: carte.mission || "",
      zone_intervention: carte.zone_intervention || "",
      date_delivrance: carte.date_delivrance || "",
      date_expiration: carte.date_expiration || "",
      statut: carte.statut || "active",
    });
    setEditOpen(true);
  };

  const enregistrer = async () => {
    const carte = selected ? carteDe(selected.id) : null;
    if (!carte) return;
    const patch = {
      poste: form.poste || null,
      departement: form.departement || null,
      type_contrat: form.type_contrat,
      statut_agent: form.statut_agent,
      mission: form.mission || null,
      zone_intervention: form.zone_intervention || null,
      date_delivrance: form.date_delivrance || carte.date_delivrance,
      date_expiration: form.date_expiration || carte.date_expiration,
      statut: form.statut,
      updated_by: user?.id || null,
    };
    const { error } = await (supabase as any).from("cartes_personnel").update(patch).eq("id", carte.id);
    if (error) { toast.error(error.message); return; }
    await logAdminAction({
      action: "carte_modifiee",
      entite: "cartes_personnel",
      entite_id: carte.id,
      cible_libelle: selected?.nom_complet,
      ancienne_valeur: carte,
      nouvelle_valeur: patch,
      details: `Modification de la carte ${carte.matricule}`,
    });
    toast.success("Carte mise à jour");
    setEditOpen(false);
    load();
  };

  const changerStatut = async (carte: Row, statut: string) => {
    const { error } = await (supabase as any).from("cartes_personnel").update({ statut, updated_by: user?.id || null }).eq("id", carte.id);
    if (error) { toast.error(error.message); return; }
    await logAdminAction({
      action: statut === "active" ? "carte_validee" : statut === "suspendue" ? "carte_suspendue" : "carte_revoquee",
      entite: "cartes_personnel",
      entite_id: carte.id,
      ancienne_valeur: { statut: carte.statut },
      nouvelle_valeur: { statut },
      details: `Carte ${carte.matricule} → ${statut}`,
    });
    toast.success("Statut de la carte mis à jour");
    load();
  };

  const changerPhoto = async (carte: Row, file: File) => {
    try {
      const path = await uploaderPhotoCarte(carte.profile_id, carte.id, file);
      const { error } = await (supabase as any).from("cartes_personnel").update({ photo_url: path, updated_by: user?.id || null }).eq("id", carte.id);
      if (error) throw error;
      await logAdminAction({
        action: "carte_photo_maj",
        entite: "cartes_personnel",
        entite_id: carte.id,
        details: `Photo traitée et enregistrée pour la carte ${carte.matricule}`,
      });
      toast.success("Photo traitée (recadrage 3:4 + normalisation) et enregistrée");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Échec du traitement de la photo");
    }
  };

  const retraiterPhotosLot = async () => {
    try {
      toast.info("Retraitement des photos en cours…");
      const { data, error } = await supabase.functions.invoke("process-card-photo", {
        body: { mode: "batch" },
      });
      if (error) throw error;
      const processed = Number(data?.processed || 0);
      const failed = Number(data?.failed || 0);
      if (failed > 0) {
        toast.warning(`Retraitement terminé : ${processed} photo(s) traitée(s), ${failed} échec(s).`);
      } else {
        toast.success(
          processed > 0
            ? `Retraitement terminé : ${processed} photo(s) traitée(s).`
            : "Aucune photo existante à retraiter."
        );
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Le retraitement des photos a échoué.");
    }
  };

  const exporter = async (ref: React.RefObject<HTMLDivElement>, nom: string) => {
    const element = ref.current;
    if (!element) {
      toast.error("La carte n'est pas prête à être exportée.");
      return;
    }
    try {
      if (document.fonts?.ready) await document.fonts.ready;

      // Le rendu exporté doit être strictement celui de la prévisualisation :
      // même composant, mêmes dimensions 540 × 856, aucune transformation CSS.
      // On attend explicitement les images asynchrones (notamment les URLs signées
      // Supabase) afin d'éviter qu'une photo ou un asset manque dans le PNG.
      const images = Array.from(element.querySelectorAll("img"));
      await Promise.all(
        images.map(async (img) => {
          if (!img.complete || img.naturalWidth === 0) {
            await new Promise<void>((resolve) => {
              const done = () => {
                img.removeEventListener("load", done);
                img.removeEventListener("error", done);
                resolve();
              };
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            });
          }
          if (img.decode) await img.decode().catch(() => undefined);
        }),
      );

      const canvas = await html2canvas(element, {
        width: 540,
        height: 856,
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        scrollX: 0,
        scrollY: 0,
      });

      // La nouvelle carte est au ratio portrait d'une carte bancaire (54 × 85,6 mm).
      // L'export 1080 × 1712 px conserve ce ratio avec une définition élevée.
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${nom}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`${nom}.png exporté en 1080 × 1712 px.`);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'export de la carte.");
    }
  };

  if (!peutGerer) {
    return <p className="p-6 text-sm text-muted-foreground">Accès réservé à l'administrateur et au responsable des opérations.</p>;
  }

  const carteSelection = selected ? carteDe(selected.id) : null;
  const dataSelection = lignes.find((l) => l.profile.id === selected?.id)?.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><IdCard className="h-5 w-5" />Cartes du personnel</CardTitle>
            <CardDescription>Génération, validation et impression des cartes professionnelles — nouveau format portrait 54 × 85,6 mm, haute résolution 1080 × 1712 px.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="w-full pl-8" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button variant="outline" className="w-full sm:w-auto" onClick={genererToutes}>
              <RefreshCw className="mr-1 h-4 w-4" />Générer toutes
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={retraiterPhotosLot}>
              <RefreshCw className="mr-1 h-4 w-4" />Retraiter les photos
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setScanOpen(true)}>
              <QrCode className="mr-1 h-4 w-4" />Scanner un badge
            </Button>
            <ScanCarteDialog
              open={scanOpen}
              onOpenChange={setScanOpen}
              onCode={(code) => window.open(`/verifier-carte/${code}`, "_blank", "noreferrer")}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Poste / Rôle</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Contrat</TableHead>
                    <TableHead>Validité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map(({ profile, carte, data }) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.nom_complet}
                        <div className="text-xs text-muted-foreground">{profile.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{data.poste || roleLabel(data.role_code)}</TableCell>
                      <TableCell className="text-sm">{carte ? data.matricule : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{carte ? contratLabel(data.type_contrat) : "—"}</TableCell>
                      <TableCell className="text-sm">
                        {data.date_expiration ? format(new Date(data.date_expiration), "dd/MM/yyyy", { locale: fr }) : "—"}
                      </TableCell>
                      <TableCell>
                        {!carte ? (
                          <Badge variant="outline">Sans carte</Badge>
                        ) : data.statut === "en_attente" ? (
                          <Badge variant="outline" className="border-accent text-accent">En attente</Badge>
                        ) : data.statut === "active" ? (
                          <Badge className="bg-primary">Validée</Badge>
                        ) : data.statut === "suspendue" ? (
                          <Badge variant="secondary">Suspendue</Badge>
                        ) : (
                          <Badge variant="destructive">Révoquée</Badge>
                        )}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        {carte ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setSelected(profile)}>Voir la carte</Button>
                            {carte.statut === "active" ? (
                              <Button size="sm" variant="ghost" title="Suspendre" onClick={() => changerStatut(carte, "suspendue")}><Ban className="h-4 w-4" /></Button>
                            ) : (
                              <Button size="sm" variant="ghost" title="Valider" onClick={() => changerStatut(carte, "active")}><BadgeCheck className="h-4 w-4" /></Button>
                            )}
                            {carte.statut !== "revoquee" && (
                              <Button size="sm" variant="ghost" title="Révoquer" onClick={() => changerStatut(carte, "revoquee")}><Ban className="h-4 w-4 text-destructive" /></Button>
                            )}
                          </>
                        ) : (
                          <Button size="sm" onClick={() => genererCarte(profile)}>Générer</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {lignes.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucun utilisateur</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Carte de {selected?.nom_complet}</DialogTitle></DialogHeader>
          {dataSelection && (
            <>
            <Tabs value={carteTab} onValueChange={setCarteTab}>
              <TabsList>
                <TabsTrigger value="recto">Recto</TabsTrigger>
                <TabsTrigger value="verso">Verso</TabsTrigger>
                <TabsTrigger value="both">Recto / Verso</TabsTrigger>
              </TabsList>
              <TabsContent value="recto" className="flex justify-center overflow-x-auto py-4">
                <CarteRecto ref={rectoRef} carte={dataSelection} />
              </TabsContent>
              <TabsContent value="verso" className="flex justify-center overflow-x-auto py-4">
                <CarteVerso ref={versoRef} carte={dataSelection} />
              </TabsContent>
              <TabsContent value="both" className="flex flex-wrap justify-center gap-4 py-4">
                <CarteRecto ref={rectoRef} carte={dataSelection} />
                <CarteVerso ref={versoRef} carte={dataSelection} />
              </TabsContent>
            </Tabs>
            </>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && carteSelection) changerPhoto(carteSelection, f);
                }}
              />
              <Button variant="outline" asChild><span><Upload className="mr-1 h-4 w-4" />Photo</span></Button>
            </label>
            <Button variant="outline" onClick={() => carteSelection && ouvrirEdition(carteSelection)}>Modifier</Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (carteTab !== "recto") {
                  setCarteTab("recto");
                  await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                  });
                }
                await exporter(rectoRef, `carte-recto-${dataSelection?.matricule}`);
              }}
            >
              <Download className="mr-1 h-4 w-4" />Recto
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (carteTab !== "verso") {
                  setCarteTab("verso");
                  await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                  });
                }
                await exporter(versoRef, `carte-verso-${dataSelection?.matricule}`);
              }}
            >
              <Download className="mr-1 h-4 w-4" />Verso
            </Button>
            <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:w-auto">
          <DialogHeader><DialogTitle>Modifier la carte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Poste</Label><Input value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} /></div>
            <div><Label>Département</Label><Input value={form.departement} onChange={(e) => setForm({ ...form, departement: e.target.value })} /></div>
            <div><Label>Mission</Label><Input value={form.mission} placeholder="Ex: Prospection et suivi des souscripteurs" onChange={(e) => setForm({ ...form, mission: e.target.value })} /></div>
            <div><Label>Zone d'intervention</Label><Input value={form.zone_intervention} placeholder="Ex: Daloa – Gonaté" onChange={(e) => setForm({ ...form, zone_intervention: e.target.value })} /></div>
            <div>
              <Label>Statut affiché sur la carte</Label>
              <Select value={form.statut_agent} onValueChange={(v) => setForm({ ...form, statut_agent: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUTS_AGENT.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date de délivrance</Label><Input type="date" value={form.date_delivrance} onChange={(e) => setForm({ ...form, date_delivrance: e.target.value })} /></div>
            <div>
              <Label>Type de contrat</Label>
              <Select value={form.type_contrat} onValueChange={(v) => setForm({ ...form, type_contrat: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRATS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date d'expiration</Label><Input type="date" value={form.date_expiration} onChange={(e) => setForm({ ...form, date_expiration: e.target.value })} /></div>
            <div>
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={enregistrer}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestionCartes;