import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Phone, Mail, MapPin, Shield, Camera, UserPlus, Save } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/safeError";
import CountryPhoneInput from "@/components/common/CountryPhoneInput";
import { useSignedUrl } from "@/hooks/useSignedUrl";

const Profil = () => {
  const { user, profile: authProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [phoneCountries, setPhoneCountries] = useState({ telephone: "+225", telephone_secondaire: "+225", whatsapp: "+225", contact1: "+225", contact2: "+225" });
  const photoUrl = useSignedUrl('photos-profils', profile.photo_url);
  const pieceIdentiteUrl = useSignedUrl('pieces-identite', profile.piece_identite_url);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    // Try by user_id first, then by id as fallback
    let { data } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .maybeSingle();
    
    if (!data) {
      const res = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();
      data = res.data;
    }
    if (data) {
      setProfile(data);
      setPhoneCountries({
        telephone: data.telephone_indicatif || "+225",
        telephone_secondaire: data.telephone_secondaire_indicatif || "+225",
        whatsapp: data.whatsapp_indicatif || "+225",
        contact1: data.contact_urgence_telephone1_indicatif || "+225",
        contact2: data.contact_urgence_telephone2_indicatif || "+225",
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (!user?.id) throw new Error("Session invalide");
      const payload: any = {
        id: profile.id || user.id,
        user_id: user.id,
        email: profile.email || user.email,
        nom_complet: profile.nom_complet || (user.email || '').split('@')[0],
        telephone: profile.telephone || null,
        telephone_indicatif: phoneCountries.telephone || "+225",
        telephone_local: profile.telephone_local || null,
        telephone_secondaire: profile.telephone_secondaire || null,
        telephone_secondaire_indicatif: phoneCountries.telephone_secondaire || "+225",
        telephone_secondaire_local: profile.telephone_secondaire_local || null,
        whatsapp: profile.whatsapp || null,
        whatsapp_indicatif: phoneCountries.whatsapp || "+225",
        whatsapp_local: profile.whatsapp_local || null,
        adresse_mail_secondaire: profile.adresse_mail_secondaire || null,
        ville: profile.ville || null,
        quartier: profile.quartier || null,
        type_piece_identite: profile.type_piece_identite || null,
        numero_piece_identite: profile.numero_piece_identite || null,
        contact_urgence_nom: profile.contact_urgence_nom || null,
        contact_urgence_prenom: profile.contact_urgence_prenom || null,
        contact_urgence_telephone1: profile.contact_urgence_telephone1 || null,
        contact_urgence_telephone2: profile.contact_urgence_telephone2 || null,
        actif: true,
      };
      const { error } = await (supabase as any)
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      await fetchProfile();
      toast({ title: "Profil mis à jour", description: "Vos informations ont été enregistrées." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    }
    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (!user?.id) throw new Error("Session invalide");
      const ext = file.name.split('.').pop();
      const bucket = field === 'piece_identite_url' ? 'pieces-identite' : 'photos-profils';
      const path = field === 'piece_identite_url'
        ? `${user.id}/${field}-${Date.now()}.${ext}`
        : `profiles/${user.id}/${field}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadError) throw uploadError;

      // Stocke uniquement le chemin; l'URL signée courte est générée à l'affichage
      const { error: profileError } = await (supabase as any)
        .from('profiles')
        .update({ [field]: path })
        .eq('user_id', user.id);
      if (profileError) throw profileError;
      setProfile({ ...profile, [field]: path });
      toast({ title: "Photo mise à jour" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur upload", description: getSafeErrorMessage(error) });
    }
    setUploading(false);
  };

  const update = (field: string, value: string) => setProfile({ ...profile, [field]: value });

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold">Mon Profil</h1>

          {/* Photo & Info principale */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={photoUrl || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {profile.nom_complet?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'US'}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:bg-primary/90">
                    <Camera className="h-4 w-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'photo_url')} disabled={uploading} />
                  </label>
                </div>
                <div>
                  <h2 className="text-xl font-bold">{profile.nom_complet || 'Utilisateur'}</h2>
                  <p className="text-muted-foreground">{profile.email}</p>
                  <p className="text-sm text-muted-foreground">{profile.telephone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="personnel" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personnel" className="gap-1"><User className="h-4 w-4" /> Personnel</TabsTrigger>
              <TabsTrigger value="identite" className="gap-1"><Shield className="h-4 w-4" /> Identité</TabsTrigger>
              <TabsTrigger value="urgence" className="gap-1"><UserPlus className="h-4 w-4" /> Urgence</TabsTrigger>
            </TabsList>

            <TabsContent value="personnel">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Informations personnelles</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label>Nom complet</Label><Input value={profile.nom_complet || ''} onChange={(e) => update('nom_complet', e.target.value)} /></div>
                    <div><Label>Email principal</Label><Input type="email" value={profile.email || ''} onChange={(e) => update('email', e.target.value)} /></div>
                    <div><Label>Email secondaire</Label><Input type="email" value={profile.adresse_mail_secondaire || ''} onChange={(e) => update('adresse_mail_secondaire', e.target.value)} /></div>
                    <CountryPhoneInput label="Téléphone principal" countryCode={phoneCountries.telephone} localValue={String(profile.telephone_local || profile.telephone || "").replace(/^\+\d{1,4}/, "")} onChange={(v) => { setPhoneCountries(x => ({ ...x, telephone: v.callingCode })); update("telephone", v.internationalValue); }} />
                    <CountryPhoneInput label="Téléphone secondaire" countryCode={phoneCountries.telephone_secondaire} localValue={String(profile.telephone_secondaire_local || profile.telephone_secondaire || "").replace(/^\+\d{1,4}/, "")} onChange={(v) => { setPhoneCountries(x => ({ ...x, telephone_secondaire: v.callingCode })); setProfile(x => ({ ...x, telephone_secondaire: v.internationalValue, telephone_secondaire_indicatif: v.callingCode, telephone_secondaire_local: v.localValue })); }} />
                    <CountryPhoneInput label="WhatsApp" countryCode={phoneCountries.whatsapp} localValue={String(profile.whatsapp_local || profile.whatsapp || "").replace(/^\+\d{1,4}/, "")} onChange={(v) => { setPhoneCountries(x => ({ ...x, whatsapp: v.callingCode })); setProfile(x => ({ ...x, whatsapp: v.internationalValue, whatsapp_indicatif: v.callingCode, whatsapp_local: v.localValue })); }} />
                    <div><Label>Ville</Label><Input value={profile.ville || ''} onChange={(e) => update('ville', e.target.value)} /></div>
                    <div><Label>Quartier</Label><Input value={profile.quartier || ''} onChange={(e) => update('quartier', e.target.value)} /></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="identite">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Pièce d'identité</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Type de pièce</Label>
                      <Select value={profile.type_piece_identite || ''} onValueChange={(v) => update('type_piece_identite', v)}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cni">CNI</SelectItem>
                          <SelectItem value="permis">Permis de conduire</SelectItem>
                          <SelectItem value="passeport">Passeport</SelectItem>
                          <SelectItem value="carte_cedeao">Carte CEDEAO</SelectItem>
                          <SelectItem value="carte_consulaire">Carte consulaire</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Numéro de pièce</Label><Input value={profile.numero_piece_identite || ''} onChange={(e) => update('numero_piece_identite', e.target.value)} /></div>
                  </div>
                  <div>
                    <Label>Photo de la pièce d'identité</Label>
                    <div className="mt-2 flex items-center gap-4">
                      {pieceIdentiteUrl && <img src={pieceIdentiteUrl} alt="Pièce" className="h-32 rounded-lg border object-cover" />}
                      <label className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
                        <Camera className="h-4 w-4" /> Télécharger
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'piece_identite_url')} disabled={uploading} />
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="urgence">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Personne à contacter en cas d'urgence</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label>Nom</Label><Input value={profile.contact_urgence_nom || ''} onChange={(e) => update('contact_urgence_nom', e.target.value)} /></div>
                    <div><Label>Prénom</Label><Input value={profile.contact_urgence_prenom || ''} onChange={(e) => update('contact_urgence_prenom', e.target.value)} /></div>
                    <CountryPhoneInput label="Contact 1" countryCode={phoneCountries.contact1} localValue={String(profile.contact_urgence_telephone1 || "").replace(/^\\+\\d{1,4}/, "")} onChange={(v) => { setPhoneCountries(x => ({ ...x, contact1: v.callingCode })); update("contact_urgence_telephone1", v.internationalValue); }} />
                    <CountryPhoneInput label="Contact 2" countryCode={phoneCountries.contact2} localValue={String(profile.contact_urgence_telephone2 || "").replace(/^\\+\\d{1,4}/, "")} onChange={(v) => { setPhoneCountries(x => ({ ...x, contact2: v.callingCode })); update("contact_urgence_telephone2", v.internationalValue); }} />
                  </div>
                  <div>
                    <Label>Photo de la personne</Label>
                    <div className="mt-2 flex items-center gap-4">
                      {profile.contact_urgence_photo_url && <img src={profile.contact_urgence_photo_url} alt="Contact urgence" className="h-24 w-24 rounded-full border object-cover" />}
                      <label className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
                        <Camera className="h-4 w-4" /> Télécharger
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'contact_urgence_photo_url')} disabled={uploading} />
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default Profil;
