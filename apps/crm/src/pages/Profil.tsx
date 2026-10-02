import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, UserPlus, Shield, Lock } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { formatUserProfileName } from "@/lib/utils";

const ReadonlyValue = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="rounded-xl border bg-muted/20 p-3 min-w-0">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold">{value || "—"}</p>
  </div>
);

const Profil = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile(data);
    })();
  }, [user]);

  const photoUrl = useSignedUrl("photos-profils", profile.photo_url);
  const rectoUrl = useSignedUrl("pieces-identite", profile.piece_identite_recto_url || profile.piece_identite_url);
  const versoUrl = useSignedUrl("pieces-identite", profile.piece_identite_verso_url);
  const passportUrl = useSignedUrl("pieces-identite", profile.piece_identite_page_principale_url);

  const initials = formatUserProfileName(profile.nom_complet)
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((x: string) => x[0])
    .join("")
    .slice(0, 2);

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="mx-auto w-full max-w-4xl space-y-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Mon profil</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Lock className="h-4 w-4" /> Les informations du profil sont gérées par l'administration.</p>
          </div>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <Avatar className="h-24 w-24 shrink-0">
                  <AvatarImage src={photoUrl || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials || "AG"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-center sm:text-left">
                  <h2 className="text-xl sm:text-2xl font-bold break-words">{formatUserProfileName(profile.nom_complet)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground break-all">{profile.email || user?.email || "—"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{profile.telephone || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="personnel" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personnel"><User className="mr-1 h-4 w-4" />Personnel</TabsTrigger>
              <TabsTrigger value="identite"><Shield className="mr-1 h-4 w-4" />Identité</TabsTrigger>
              <TabsTrigger value="urgence"><UserPlus className="mr-1 h-4 w-4" />Urgence</TabsTrigger>
            </TabsList>

            <TabsContent value="personnel">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Informations personnelles</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ReadonlyValue label="Nom affiché" value={formatUserProfileName(profile.nom_complet)} />
                  <ReadonlyValue label="Email principal" value={profile.email || user?.email} />
                  <ReadonlyValue label="Email secondaire" value={profile.adresse_mail_secondaire} />
                  <ReadonlyValue label="Téléphone principal" value={profile.telephone} />
                  <ReadonlyValue label="Téléphone secondaire" value={profile.telephone_secondaire} />
                  <ReadonlyValue label="WhatsApp" value={profile.whatsapp} />
                  <ReadonlyValue label="Ville" value={profile.ville} />
                  <ReadonlyValue label="Quartier" value={profile.quartier} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="identite">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Pièce d'identité</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ReadonlyValue label="Type de pièce" value={profile.type_piece_identite} />
                    <ReadonlyValue label="Numéro de pièce" value={profile.numero_piece_identite} />
                  </div>
                  {profile.type_piece_identite === "passeport" ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Page principale du passeport</p>
                      {passportUrl ? <img src={passportUrl} alt="Page principale du passeport" className="max-h-72 w-auto max-w-full rounded-lg border object-contain" /> : <p className="text-sm text-muted-foreground">Aucun document disponible.</p>}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Recto</p>
                        {rectoUrl ? <img src={rectoUrl} alt="Recto de la pièce" className="max-h-72 w-full rounded-lg border object-contain bg-muted/20" /> : <p className="text-sm text-muted-foreground">Aucun recto disponible.</p>}
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Verso</p>
                        {versoUrl ? <img src={versoUrl} alt="Verso de la pièce" className="max-h-72 w-full rounded-lg border object-contain bg-muted/20" /> : <p className="text-sm text-muted-foreground">Aucun verso disponible.</p>}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Aucun bouton de téléversement n'est disponible pour l'utilisateur.</div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="urgence">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Personne à contacter en cas d'urgence</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ReadonlyValue label="Nom" value={profile.contact_urgence_nom} />
                  <ReadonlyValue label="Prénom" value={profile.contact_urgence_prenom} />
                  <ReadonlyValue label="Contact 1" value={profile.contact_urgence_telephone1} />
                  <ReadonlyValue label="Contact 2" value={profile.contact_urgence_telephone2} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default Profil;
