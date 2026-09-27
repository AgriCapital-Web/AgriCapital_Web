import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoGreen from "@/assets/logo-green.png";
import { User, Mail, Phone, Briefcase, MapPin, FileText, KeyRound, AtSign, Camera, Loader2, CheckCircle2, Image as ImageIcon, X } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/safeError";

const ROLES = [
  { value: "commercial", label: "Commercial (Comm)" },
  { value: "technicien", label: "Technicien (Tech)" },
  { value: "chef_equipe_commercial", label: "Chef d'Équipe Commercial (CEC)" },
  { value: "chef_equipe_technique", label: "Chef d'Équipe Technique (CET)" },
  { value: "responsable_commercial", label: "Responsable Commercial (RCom)" },
  { value: "responsable_technique_agronomique", label: "Responsable Technique & Agronomique (RTA)" },
  { value: "responsable_zone", label: "Responsable de zone" },
  { value: "comptable", label: "Comptable" },
  { value: "service_client", label: "Service client / Support" },
  { value: "operations", label: "Opérations" },
];

const compressPhoto = async (file: File): Promise<{ data: string; mime: string }> => {
  if (!file.type.startsWith("image/")) throw new Error("Sélectionnez une image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La photo originale ne doit pas dépasser 10 Mo.");

  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Impossible de lire la photo."));
      img.src = source;
    });

    const maxW = 1200;
    const maxH = 1500;
    const scale = Math.min(1, maxW / image.naturalWidth, maxH / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Préparation de la photo impossible.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.84;
    let data = canvas.toDataURL("image/webp", quality);
    if (data.length > 2_400_000) {
      quality = 0.68;
      data = canvas.toDataURL("image/webp", quality);
    }
    if (data.length > 2_700_000) {
      const small = document.createElement("canvas");
      small.width = Math.min(900, canvas.width);
      small.height = Math.round((small.width / canvas.width) * canvas.height);
      small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
      data = small.toDataURL("image/webp", 0.65);
    }
    return { data, mime: "image/webp" };
  } finally {
    URL.revokeObjectURL(source);
  }
};

const AccountRequest = () => {
  const [formData, setFormData] = useState({
    nom_complet: "", email: "", telephone: "", poste: "",
    region: "", departement: "", district: "", message: "",
    username: "", password: "", password_confirm: "",
  });
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [errorDetail, setErrorDetail] = useState<any>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any).from("districts").select("*").eq("est_actif", true).order("nom");
      setDistricts(data || []);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      if (!formData.district) { setRegions([]); return; }
      const { data } = await (supabase as any).from("regions").select("*")
        .eq("district_id", formData.district).eq("est_active", true).order("nom");
      setRegions(data || []);
      setFormData((prev) => ({ ...prev, region: "", departement: "" }));
      setDepartements([]);
    })();
  }, [formData.district]);

  useEffect(() => {
    void (async () => {
      if (!formData.region) { setDepartements([]); return; }
      const { data } = await (supabase as any).from("departements").select("*")
        .eq("region_id", formData.region).eq("est_actif", true).order("nom");
      setDepartements(data || []);
      setFormData((prev) => ({ ...prev, departement: "" }));
    })();
  }, [formData.region]);

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
  };

  const openCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("La caméra n'est pas disponible dans ce navigateur.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setCameraStream(stream);
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          void cameraVideoRef.current.play();
        }
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Caméra indisponible", description: getSafeErrorMessage(error) || "Autorisez l'accès à la caméra puis réessayez." });
    }
  };

  const captureCameraPhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast({ variant: "destructive", title: "Caméra en préparation", description: "Attendez que l'image apparaisse puis réessayez." });
      return;
    }
    const canvas = document.createElement("canvas");
    const maxW = 1200;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      void handlePhoto(new File([blob], "photo-camera.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  useEffect(() => () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  const deletePendingPhoto = async (pathToDelete: string) => {
    if (!pathToDelete) return;
    await supabase.functions.invoke("upload-account-request-photo", {
      body: { mode: "delete", path: pathToDelete },
    }).catch(() => undefined);
  };

  const handlePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      if (photoPath) await deletePendingPhoto(photoPath);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoPath("");

      const compressed = await compressPhoto(file);
      const { data, error } = await supabase.functions.invoke("upload-account-request-photo", {
        body: compressed,
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Upload impossible");
      setPhotoPath(String(data.path));
      toast({ title: "Photo prête", description: "La photo a été enregistrée avant la validation du formulaire." });
    } catch (error: any) {
      setPhotoPreview("");
      setPhotoPath("");
      toast({ variant: "destructive", title: "Photo non enregistrée", description: getSafeErrorMessage(error) });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorDetail(null);
    if (!photoPath) {
      toast({ variant: "destructive", title: "Photo obligatoire", description: "Ajoutez une photo et attendez la fin de son enregistrement avant de valider." });
      return;
    }
    if (formData.password !== formData.password_confirm) {
      toast({ variant: "destructive", title: "Erreur", description: "Les mots de passe ne correspondent pas." });
      return;
    }
    if (formData.password.length < 8) {
      toast({ variant: "destructive", title: "Erreur", description: "Le mot de passe doit contenir au moins 8 caractères." });
      return;
    }

    setIsSubmitting(true);
    try {
      const regionName = regions.find((r) => r.id === formData.region)?.nom || "";
      const deptName = departements.find((d) => d.id === formData.departement)?.nom || "";
      const { data, error } = await supabase.functions.invoke("submit-account-request", {
        body: {
          nom_complet: formData.nom_complet.trim(),
          email: formData.email.trim(),
          telephone: formData.telephone.trim(),
          username: formData.username,
          password: formData.password,
          poste_souhaite: ROLES.find((role) => role.value === formData.poste)?.label || formData.poste,
          role_souhaite: formData.poste,
          region_id: formData.region || null,
          departement_geo_id: formData.departement || null,
          district_id: formData.district || null,
          departement: deptName || null,
          region: regionName || null,
          justification: formData.message || null,
          photo_url: photoPath,
        },
      });
      const payload: any = data;
      if (error || payload?.error) {
        let functionMessage = error?.message;
        let contextPayload: any = null;
        if (error && typeof (error as any).context?.json === "function") {
          try {
            contextPayload = await (error as any).context.json();
            functionMessage = contextPayload?.message || contextPayload?.error || functionMessage;
          } catch { /* non JSON */ }
        }
        const detail = contextPayload || payload || {};
        setErrorDetail({
          etape: detail?.step || "inconnue",
          raison: detail?.message || detail?.error || functionMessage || "Erreur inconnue",
          statut_http: (error as any)?.context?.status ?? null,
          horodatage: new Date().toISOString(),
        });
        throw new Error(payload?.message || payload?.error || functionMessage || "Envoi impossible");
      }

      toast({
        title: "Demande envoyée",
        description: "Votre photo et vos informations ont bien été enregistrées. L'adresse email doit être confirmée avant le traitement de la demande.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) || "Impossible d'envoyer la demande" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-primary-hover p-3 sm:p-4">
      <Card className="w-full max-w-[95%] sm:max-w-2xl shadow-strong my-4 min-w-0">
        <CardHeader className="text-center px-4 sm:px-6 pb-4">
          <div className="flex justify-center mb-2 sm:mb-4">
            <img src={logoGreen} alt="AgriCapital Logo" className="h-16 sm:h-24 w-auto max-w-full" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">Demande de Création de Compte</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Remplissez ce formulaire pour demander un accès à AgriCapital.</CardDescription>
        </CardHeader>

        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Field label="Nom complet *" icon={<User />}><Input required value={formData.nom_complet} onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })} placeholder="Ex: KOUASSI Jean" /></Field>
              <Field label="Email *" icon={<Mail />}><Input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="votre@email.com" /></Field>
              <Field label="Téléphone *" icon={<Phone />}><Input required type="tel" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} placeholder="07 XX XX XX XX" /></Field>
              <Field label="Poste souhaité *" icon={<Briefcase />}><Select value={formData.poste} onValueChange={(value) => setFormData({ ...formData, poste: value })}><SelectTrigger><SelectValue placeholder="Sélectionner un poste" /></SelectTrigger><SelectContent>{ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent></Select></Field>
            </div>

            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                <div className="min-w-0">
                  <Label className="text-sm font-semibold">Photo de profil *</Label>
                  <p className="text-xs text-muted-foreground">La photo est téléversée automatiquement dès sa sélection, avant même l'envoi du formulaire.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[150px_1fr] sm:items-center">
                <div className="mx-auto flex h-36 w-28 items-center justify-center overflow-hidden rounded-xl border bg-background sm:mx-0">
                  {photoPreview ? <img src={photoPreview} alt="Aperçu de la photo" className="h-full w-full object-cover" /> : <ImageIcon className="h-10 w-10 text-muted-foreground" />}
                </div>
                <div className="min-w-0 space-y-3">
                  <Button type="button" variant="default" onClick={() => void openCamera()} disabled={photoUploading} className="min-h-11"><Camera className="mr-2 h-4 w-4" />Prendre avec la caméra</Button>\n                  <label className="inline-flex cursor-pointer">
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void handlePhoto(e.target.files?.[0])} />
                    <span className="inline-flex min-h-11 items-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"><ImageIcon className="mr-2 h-4 w-4" />Choisir dans les fichiers</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {photoUploading ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</span> : photoPath ? <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" />Photo enregistrée</span> : <span className="text-muted-foreground">JPG, PNG ou WebP · 10 Mo maximum avant compression</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2"><MapPin className="h-4 w-4" /> Localisation</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select value={formData.district} onValueChange={(value) => setFormData({ ...formData, district: value })}><SelectTrigger><SelectValue placeholder="District" /></SelectTrigger><SelectContent>{districts.map((dist) => <SelectItem key={dist.id} value={dist.id}>{dist.nom}</SelectItem>)}</SelectContent></Select>
                <Select value={formData.region} onValueChange={(value) => setFormData({ ...formData, region: value })} disabled={!formData.district}><SelectTrigger><SelectValue placeholder="Région" /></SelectTrigger><SelectContent>{regions.map((region) => <SelectItem key={region.id} value={region.id}>{region.nom}</SelectItem>)}</SelectContent></Select>
                <Select value={formData.departement} onValueChange={(value) => setFormData({ ...formData, departement: value })} disabled={!formData.region}><SelectTrigger><SelectValue placeholder="Département" /></SelectTrigger><SelectContent>{departements.map((dept) => <SelectItem key={dept.id} value={dept.id}>{dept.nom}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <Label className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" /> Identifiants de connexion *</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Nom d'utilisateur *" icon={<AtSign />}><Input required autoComplete="username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="ex: kouassi.jean" /></Field>
                <Field label="Mot de passe *"><Input required minLength={8} type="password" autoComplete="new-password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="8 caractères minimum" /></Field>
                <Field label="Confirmer *"><Input required type="password" autoComplete="new-password" value={formData.password_confirm} onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })} placeholder="Répéter le mot de passe" /></Field>
              </div>
              <p className="text-xs text-muted-foreground">L'accès reste inactif jusqu'au traitement de la demande et à la confirmation de l'adresse email.</p>
            </div>

            {errorDetail && (
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 space-y-2">
                <p className="text-sm font-semibold text-destructive">Échec de la demande — diagnostic</p>
                <p className="break-anywhere text-sm"><span className="font-medium">Étape :</span> {errorDetail.etape}</p>
                <p className="break-anywhere text-sm"><span className="font-medium">Raison :</span> {errorDetail.raison}</p>
                {errorDetail.statut_http && <p className="text-sm"><span className="font-medium">Code HTTP :</span> {errorDetail.statut_http}</p>}
                <p className="text-[10px] text-muted-foreground">{errorDetail.horodatage}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-sm flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Message / Justification</Label>
              <Textarea id="message" rows={3} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="Expliquez pourquoi vous souhaitez rejoindre AgriCapital..." />
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => navigate("/login")} className="w-full sm:flex-1">Annuler</Button>
              <Button type="submit" disabled={isSubmitting || photoUploading} className="w-full sm:flex-1">{isSubmitting ? "Envoi en cours..." : photoUploading ? "Photo en cours..." : "Envoyer la demande"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) => (
  <div className="min-w-0 space-y-1.5">
    <Label className="flex items-center gap-2 text-sm">{icon && <span className="shrink-0">{icon}</span>}{label}</Label>
    {children}
  </div>
);

export default AccountRequest;
