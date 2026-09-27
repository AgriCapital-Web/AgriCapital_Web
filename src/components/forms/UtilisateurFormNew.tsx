import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/safeError";
import { useAppRoles, useDepartementsEntreprise } from "@/hooks/useReferentiels";
import { normalizeRoles, TERRITORIAL_ROLES, ROLES as APP_ROLES } from "@/lib/roles";
import { logAdminAction } from "@/lib/audit";


const userFormSchema = z.object({
  username: z.string()
    .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
    .max(50, "Le nom d'utilisateur ne peut pas dépasser 50 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscore"),
  email: z.string()
    .email("Email invalide")
    .max(255, "L'email ne peut pas dépasser 255 caractères"),
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128, "Le mot de passe ne peut pas dépasser 128 caractères")
    .optional(),
  nom_complet: z.string()
    .min(2, "Le nom complet doit contenir au moins 2 caractères")
    .max(100, "Le nom complet ne peut pas dépasser 100 caractères"),
  telephone: z.string()
    .regex(/^\d{10}$/, "Le téléphone doit contenir exactement 10 chiffres")
    .optional()
    .or(z.literal("")),
  whatsapp: z.string()
    .regex(/^\d{10}$/, "Le WhatsApp doit contenir exactement 10 chiffres")
    .optional()
    .or(z.literal("")),
});

interface UtilisateurFormProps {
  utilisateur?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const UtilisateurFormNew = ({ utilisateur, onSuccess, onCancel }: UtilisateurFormProps) => {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(userFormSchema),
    defaultValues: utilisateur || {},
  });
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    normalizeRoles(utilisateur?.user_roles?.map((r: any) => r.role) || []),
  );
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string>(utilisateur?.photo_url || "");
  const relationRH = watch("relation_rh");
  const departementSelectionne = watch("departement") ?? utilisateur?.departement;

  // Référentiels dynamiques (base de données, repli statique avant migration)
  const { departements: departementsEntreprise, requiresCoverage } = useDepartementsEntreprise();
  const { roles: rolesDisponibles } = useAppRoles();

  // Affichage conditionnel : couverture territoriale pour Commercial / Technique
  // ou pour tout rôle disposant d'une couverture terrain.
  const governanceOnly = relationRH === "PDG" || relationRH === "Associé / Actionnaire";
  const needsCoverage = useMemo(
    () => !governanceOnly && (departementSelectionne === "Commercial" || departementSelectionne === "Technique"),
    [departementSelectionne, governanceOnly],
  );

  const isCommercialProfile = departementSelectionne === "Commercial";

  const isTechniqueProfile = departementSelectionne === "Technique";
  const showEquipe = isCommercialProfile || isTechniqueProfile;

  const equipesFiltrees = useMemo(() => {
    if (isCommercialProfile) return equipes.filter((e) => !e.type_equipe || e.type_equipe === "commerciale");
    if (isTechniqueProfile) return equipes.filter((e) => !e.type_equipe || e.type_equipe === "technique");
    return equipes;
  }, [equipes, isCommercialProfile, isTechniqueProfile]);

  useEffect(() => {
    fetchDistricts();
    fetchEquipes();
    if (utilisateur?.district_id) fetchRegions(utilisateur.district_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDistricts = async () => {
    const { data } = await (supabase as any).from("districts").select("*").eq("est_actif", true).order("nom");
    setDistricts(data || []);
  };

  const fetchRegions = async (districtId: string) => {
    const { data } = await (supabase as any)
      .from("regions")
      .select("*")
      .eq("district_id", districtId)
      .eq("est_active", true)
      .order("nom");
    setRegions(data || []);
  };

  const fetchEquipes = async () => {
    const { data } = await (supabase as any).from("equipes").select("*").order("nom");
    if (data) setEquipes(data);
  };


  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: any) => {
    if (selectedRoles.length === 0) {
      toast({ variant: "destructive", title: "Rôle requis", description: "Sélectionnez au moins un rôle officiel." });
      return;
    }
    if (needsCoverage && !data.region_id && !utilisateur?.region_id) {
      toast({
        variant: "destructive",
        title: "Couverture requise",
        description: "Les profils Commercial et Technique doivent avoir un district et une région de couverture.",
      });
      return;
    }
    setLoading(true);
    try {

      let photoUrl = utilisateur?.photo_url;

      // Upload photo si présent
      const photoInput = document.querySelector('input[name="photo"]') as HTMLInputElement;
      if (photoInput?.files?.[0]) {
        const file = photoInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('photos-profils')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Stocke uniquement le chemin; l'URL signée courte est générée à l'affichage
        photoUrl = fileName;
      }

      if (utilisateur) {
        // Update existing user
        const { error: profileError } = await (supabase as any)
          .from("profiles")
          .update({
            nom_complet: data.nom_complet,
            username: data.username,
            email: data.email,
            telephone: data.telephone || null,
            whatsapp: data.whatsapp || null,
            departement: data.departement || null,
            relation_rh: data.relation_rh || null,
            taux_commission: data.taux_commission ? Number(data.taux_commission) : null,
            district_id: data.district_id || null,
            region_id: data.region_id || null,
            equipe_id: showEquipe ? (data.equipe_id || null) : null,
            photo_url: photoUrl || null,
          })
          .eq("id", utilisateur.id);

        if (profileError) throw profileError;

        // Update roles
        const uid = utilisateur.user_id || utilisateur.id;
        const anciensRoles = normalizeRoles(utilisateur?.user_roles?.map((r: any) => r.role) || []);
        await (supabase as any).from("user_roles").delete().eq("user_id", uid);

        for (const role of selectedRoles) {
          await (supabase as any).from("user_roles").insert({
            user_id: uid,
            role: role,
          });
        }

        await logAdminAction({
          action: "MODIFICATION_UTILISATEUR",
          entite: "profiles",
          entite_id: utilisateur.id,
          cible_user_id: uid,
          cible_libelle: data.nom_complet,
          ancienne_valeur: { roles: anciensRoles, departement: utilisateur?.departement },
          nouvelle_valeur: { roles: selectedRoles, departement: data.departement },
        });

        toast({ title: "Succès", description: "Utilisateur modifié" });

      } else {
        const tempPassword = data.password || (
          crypto.randomUUID().replace(/-/g, '').slice(0, 16) + 'A1!'
        );
        const { data: result, error } = await supabase.functions.invoke('create-user', {
          body: {
            username: data.username,
            email: data.email,
            password: tempPassword,
            nom_complet: data.nom_complet,
            telephone: data.telephone || null,
            whatsapp: data.whatsapp || null,
            departement: data.departement || null,
            equipe_id: data.equipe_id || null,
            relation_rh: data.relation_rh || 'Employé',
            taux_commission: data.taux_commission || null,
            region_id: data.region_id || null,
            photo_url: photoUrl,
            roles: selectedRoles,
          }
        });

        if (error) throw error;
        if (!result.success) throw new Error(result.error);

        toast({
          title: "Utilisateur créé",
          description: `Mot de passe temporaire (à communiquer en privé): ${tempPassword}`,
          duration: 20000,
        });
      }
      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations Personnelles</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom Complet *</Label>
            <Input {...register("nom_complet", { required: true })} />
            {errors.nom_complet?.message && <p className="text-sm text-destructive">{String(errors.nom_complet.message)}</p>}
          </div>

          <div className="space-y-2">
            <Label>Username *</Label>
            <Input {...register("username", { required: true })} />
            {errors.username?.message && <p className="text-sm text-destructive">{String(errors.username.message)}</p>}
          </div>

          {!utilisateur && (
            <div className="space-y-2">
              <Label>Mot de passe *</Label>
              <Input 
                type="password" 
                {...register("password", { required: !utilisateur })} 
                placeholder="@AgriCapital2025"
              />
              {errors.password?.message && <p className="text-sm text-destructive">{String(errors.password.message)}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" {...register("email", { required: true })} />
            {errors.email?.message && <p className="text-sm text-destructive">{String(errors.email.message)}</p>}
          </div>

          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input {...register("telephone")} placeholder="0XXXXXXXXX" />
            {errors.telephone?.message && <p className="text-sm text-destructive">{String(errors.telephone.message)}</p>}
          </div>

          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input {...register("whatsapp")} placeholder="0XXXXXXXXX" />
            {errors.whatsapp?.message && <p className="text-sm text-destructive">{String(errors.whatsapp.message)}</p>}
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Photo de Profil</Label>
            <Input type="file" name="photo" accept="image/*" onChange={handlePhotoChange} />
            {photoPreview && (
              <div className="mt-2 relative inline-block">
                <img
                  src={photoPreview}
                  alt="Aperçu"
                  className="w-24 h-24 object-cover rounded-full border-2 border-primary"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => setPhotoPreview("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relation RH et Département</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Relation RH *</Label>
            <Select
              defaultValue={utilisateur?.relation_rh}
              onValueChange={(value) => {
                setValue("relation_rh", value);
                if (value === "PDG") setSelectedRoles([APP_ROLES.SUPER_ADMIN]);
                else if (value === "Associé / Actionnaire") setSelectedRoles([APP_ROLES.ASSOCIE_ACTIONNAIRE]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Employé">Employé</SelectItem>
                <SelectItem value="Prestataire">Prestataire</SelectItem>
                <SelectItem value="PDG">PDG</SelectItem>
                <SelectItem value="Associé / Actionnaire">Associé / Actionnaire</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!governanceOnly && <div className="space-y-2">
            <Label>Département *</Label>
            <Select
              defaultValue={utilisateur?.departement}
              onValueChange={(value) => {
                setValue("departement", value);
                if (value !== "Commercial" && value !== "Technique") {
                  setValue("equipe_id", null);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {departementsEntreprise.map((d) => (
                  <SelectItem key={d.id} value={d.nom}>
                    {d.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>}

          {!governanceOnly && showEquipe && <div className="space-y-2">
            <Label>Équipe</Label>
            <Select
              defaultValue={utilisateur?.equipe_id}
              onValueChange={(value) => setValue("equipe_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une équipe" />
              </SelectTrigger>
              <SelectContent>
                {equipesFiltrees.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>}

          {relationRH === "Prestataire" && !governanceOnly && (
            <div className="space-y-2">
              <Label>Taux Commission (FCFA par ha)</Label>
              <Input 
                type="number" 
                step="1" 
                {...register("taux_commission")}
                placeholder="Ex: 2500"
              />
            </div>
          )}

          {needsCoverage && (
            <>
              <div className="space-y-2">
                <Label>District de Couverture *</Label>
                <Select
                  defaultValue={utilisateur?.district_id}
                  onValueChange={(value) => {
                    setValue("district_id", value);
                    fetchRegions(value);
                    setValue("region_id", undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Région de Couverture *</Label>
                <Select
                  defaultValue={utilisateur?.region_id}
                  onValueChange={(value) => setValue("region_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={regions.length ? "Sélectionner une région" : "Choisir d'abord un district"} />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rôles officiels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg">
            {rolesDisponibles.map((role) => (
              <div key={role.code} className="flex items-start space-x-2">
                <Checkbox
                  id={role.code}
                  checked={selectedRoles.includes(role.code)}
                  onCheckedChange={() => !governanceOnly && toggleRole(role.code)}
                  disabled={governanceOnly}
                />
                <label htmlFor={role.code} className="text-sm cursor-pointer leading-tight">
                  <span className="font-medium">{role.nom}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Niveau {role.niveau}
                  </Badge>
                  <span className="block text-xs text-muted-foreground">{role.description}</span>
                </label>
              </div>
            ))}
          </div>
          {selectedRoles.length === 0 && (
            <p className="text-sm text-destructive">Au moins un rôle officiel doit être attribué.</p>
          )}
        </CardContent>
      </Card>


      <div className="flex justify-end gap-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : utilisateur ? "Modifier" : "Créer"}
        </Button>
      </div>
    </form>
  );
};

export default UtilisateurFormNew;
