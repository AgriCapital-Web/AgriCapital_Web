import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

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
  departement: z.string().optional(),
  equipe_id: z.string().uuid().optional().or(z.literal("")),
  relation_rh: z.enum(["Employé", "Prestataire"]).optional(),
  taux_commission: z.coerce.number().min(0).nullable().optional(),
  district_id: z.string().uuid().optional().or(z.literal("")),
  region_id: z.string().uuid().optional().or(z.literal("")),
});

type UtilisateurFormValues = z.infer<typeof userFormSchema>;

interface UserRoleRecord {
  role: string;
}

interface UtilisateurRecord extends Partial<UtilisateurFormValues> {
  id: string;
  photo_url?: string | null;
  user_roles?: UserRoleRecord[];
}

interface SelectOption {
  id: string;
  nom: string;
}

interface UtilisateurFormProps {
  utilisateur?: UtilisateurRecord | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "directeur_tc", label: "Directeur TC" },
  { value: "responsable_zone", label: "Responsable Zone" },
  { value: "comptable", label: "Comptable" },
  { value: "commercial", label: "Commercial" },
  { value: "service_client", label: "Service Client" },
  { value: "operations", label: "Opérations" },
  { value: "user", label: "Utilisateur" }
];

const isRelationRh = (value: string): value is "Employé" | "Prestataire" =>
  value === "Employé" || value === "Prestataire";

const UtilisateurFormNew = ({ utilisateur, onSuccess, onCancel }: UtilisateurFormProps) => {
  const defaultValues: Partial<UtilisateurFormValues> = utilisateur
    ? {
        username: utilisateur.username ?? "",
        email: utilisateur.email ?? "",
        nom_complet: utilisateur.nom_complet ?? "",
        telephone: utilisateur.telephone ?? "",
        whatsapp: utilisateur.whatsapp ?? "",
        departement: utilisateur.departement ?? "",
        equipe_id: utilisateur.equipe_id ?? "",
        relation_rh: utilisateur.relation_rh,
        taux_commission: utilisateur.taux_commission ?? null,
        district_id: utilisateur.district_id ?? "",
        region_id: utilisateur.region_id ?? "",
      }
    : {
        username: "",
        email: "",
        password: "",
        nom_complet: "",
        telephone: "",
        whatsapp: "",
        relation_rh: "Employé",
      };

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<UtilisateurFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues,
  });
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    utilisateur?.user_roles?.map((r) => r.role) || []
  );
  const [districts, setDistricts] = useState<SelectOption[]>([]);
  const [regions, setRegions] = useState<SelectOption[]>([]);
  const [equipes, setEquipes] = useState<SelectOption[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string>(utilisateur?.photo_url || "");
  const relationRH = watch("relation_rh");

  useEffect(() => {
    fetchDistricts();
    fetchEquipes();
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

  // Liste des départements de l'entreprise (statique)
  const departementsEntreprise = [
    { id: "1", nom: "Direction Générale" },
    { id: "2", nom: "Commercial" },
    { id: "3", nom: "Technique" },
    { id: "4", nom: "Finance & Comptabilité" },
    { id: "5", nom: "Opérations" },
    { id: "6", nom: "Service Client" },
    { id: "7", nom: "Ressources Humaines" }
  ];

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

  const onSubmit = async (data: UtilisateurFormValues) => {
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

        const { data: { publicUrl } } = supabase.storage
          .from('photos-profils')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
      }

      if (utilisateur) {
        // Update existing user
        const { error: profileError } = await (supabase as any)
          .from("profiles")
          .update({
            nom_complet: data.nom_complet,
            email: data.email,
            telephone: data.telephone,
            whatsapp: data.whatsapp,
            departement: data.departement,
            equipe_id: data.equipe_id,
            relation_rh: data.relation_rh,
            taux_commission: data.taux_commission,
            region_id: data.region_id,
            photo_url: photoUrl,
          })
          .eq("id", utilisateur.id);

        if (profileError) throw profileError;

        // Update roles
        await (supabase as any).from("user_roles").delete().eq("user_id", utilisateur.id);
        
        for (const role of selectedRoles) {
          await (supabase as any).from("user_roles").insert({
            user_id: utilisateur.id,
            role: role,
          });
        }

        toast({ title: "Succès", description: "Utilisateur modifié" });
      } else {
        // Create new user via edge function
        const { data: result, error } = await supabase.functions.invoke('create-user', {
          body: {
            username: data.username,
            email: data.email,
            password: data.password || '@AgriCapital2025',
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
          title: "Succès", 
          description: `Utilisateur créé. Mot de passe par défaut: @AgriCapital2025` 
        });
      }
      onSuccess();
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue" });
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
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom Complet *</Label>
            <Input {...register("nom_complet", { required: true })} />
            {errors.nom_complet?.message && <p className="text-sm text-destructive">{String(errors.nom_complet.message)}</p>}
          </div>

          <div className="space-y-2">
            <Label>Username *</Label>
            <Input {...register("username", { required: true })} disabled={!!utilisateur} />
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
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Relation RH *</Label>
            <Select
              defaultValue={utilisateur?.relation_rh}
              onValueChange={(value) => {
                if (isRelationRh(value)) setValue("relation_rh", value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Employé">Employé</SelectItem>
                <SelectItem value="Prestataire">Prestataire</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Département *</Label>
            <Select
              defaultValue={utilisateur?.departement}
              onValueChange={(value) => setValue("departement", value)}
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
          </div>

          <div className="space-y-2">
            <Label>Équipe</Label>
            <Select
              defaultValue={utilisateur?.equipe_id}
              onValueChange={(value) => setValue("equipe_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une équipe" />
              </SelectTrigger>
              <SelectContent>
                {equipes.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {relationRH === "Prestataire" && (
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

          <div className="space-y-2">
            <Label>District de Couverture</Label>
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
            <Label>Région de Couverture</Label>
            <Select
              defaultValue={utilisateur?.region_id}
              onValueChange={(value) => setValue("region_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une région" />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rôles et Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg">
            {ROLES.map((role) => (
              <div key={role.value} className="flex items-center space-x-2">
                <Checkbox
                  id={role.value}
                  checked={selectedRoles.includes(role.value)}
                  onCheckedChange={() => toggleRole(role.value)}
                />
                <label htmlFor={role.value} className="text-sm cursor-pointer">
                  {role.label}
                </label>
              </div>
            ))}
          </div>
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
