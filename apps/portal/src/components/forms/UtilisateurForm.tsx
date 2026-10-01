import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UtilisateurFormProps {
  utilisateur?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

interface UtilisateurFormValues {
  nom_complet: string;
  email: string;
  telephone?: string;
  password?: string;
  equipe_id?: string;
}

interface EquipeOption {
  id: string;
  nom: string;
}

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "directeur_tc", label: "Directeur T&C" },
  { value: "responsable_zone", label: "Responsable Zone" },
  { value: "comptable", label: "Comptable" },
  { value: "commercial", label: "Commercial" },
  { value: "service_client", label: "Service Client" },
  { value: "operations", label: "Opérations" },
  { value: "user", label: "Utilisateur" },
];

const UtilisateurForm = ({ utilisateur, onSuccess, onCancel }: UtilisateurFormProps) => {
  const { register, handleSubmit, setValue } = useForm<UtilisateurFormValues>({
    defaultValues: {
      nom_complet: utilisateur?.nom_complet ?? "",
      email: utilisateur?.email ?? "",
      telephone: utilisateur?.telephone ?? "",
      equipe_id: utilisateur?.equipe_id ?? "",
    },
  });
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    utilisateur?.user_roles?.map((r: any) => r.role) || []
  );
  const [equipes, setEquipes] = useState<EquipeOption[]>([]);

  useEffect(() => {
    fetchEquipes();
  }, []);

  const fetchEquipes = async () => {
    const { data } = await supabase.from("equipes").select("*").eq("actif", true);
    if (data) setEquipes(data);
  };

  const onSubmit = async (data: UtilisateurFormValues) => {
    setLoading(true);
    try {
      if (utilisateur) {
        // Update existing user
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            nom_complet: data.nom_complet,
            email: data.email,
            telephone: data.telephone,
            equipe_id: data.equipe_id || null,
          })
          .eq("id", utilisateur.id);

        if (profileError) throw profileError;

        // Update roles
        await supabase.from("user_roles").delete().eq("user_id", utilisateur.id);
        
        if (selectedRoles.length > 0) {
          const roleInserts = selectedRoles.map(role => ({
            user_id: utilisateur.id,
            role: role as any,
          }));
          await supabase.from("user_roles").insert(roleInserts);
        }

        toast({ title: "Succès", description: "Utilisateur modifié" });
      } else {
        // Create new user via edge function
        const { data: result, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: data.email,
            password: data.password || '@AgriCapital2026',
            nom_complet: data.nom_complet,
            telephone: data.telephone,
            equipe_id: data.equipe_id || null,
            photo_url: null,
            roles: selectedRoles,
          }
        });

        if (error) throw error;
        if (!result.success) throw new Error(result.error);

        toast({ 
          title: "Succès", 
          description: `Utilisateur créé. Mot de passe par défaut: @AgriCapital2026` 
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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom Complet *</Label>
            <Input {...register("nom_complet", { required: true })} placeholder="KOFFI Inocent" />
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" {...register("email", { required: true })} placeholder="email@agricapital.ci" />
          </div>

          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input {...register("telephone")} placeholder="0701020304" />
          </div>

          {!utilisateur && (
            <div className="space-y-2">
              <Label>Mot de passe</Label>
              <Input type="password" {...register("password")} placeholder="Par défaut: @AgriCapital2026" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Équipe</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rôles et Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg">
            {ROLES.map(({ value, label }) => (
              <div key={value} className="flex items-center space-x-2">
                <Checkbox
                  id={value}
                  checked={selectedRoles.includes(value)}
                  onCheckedChange={() => toggleRole(value)}
                />
                <label htmlFor={value} className="text-sm cursor-pointer">
                  {label}
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

export default UtilisateurForm;
