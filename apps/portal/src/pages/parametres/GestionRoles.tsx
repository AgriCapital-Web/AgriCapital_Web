import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Edit, Users, Building2, Briefcase, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PERMISSIONS = [
  { id: "view_dashboard", label: "Voir le tableau de bord", category: "Général" },
  { id: "manage_users", label: "Gérer les utilisateurs", category: "Utilisateurs" },
  { id: "manage_planteurs", label: "Gérer les planteurs", category: "Planteurs" },
  { id: "manage_plantations", label: "Gérer les plantations", category: "Plantations" },
  { id: "manage_paiements", label: "Gérer les paiements", category: "Paiements" },
  { id: "validate_documents", label: "Valider les documents", category: "Documents" },
  { id: "view_reports", label: "Voir les rapports", category: "Rapports" },
  { id: "manage_commissions", label: "Gérer les commissions", category: "Finances" },
  { id: "manage_tickets", label: "Gérer les tickets", category: "Support" },
  { id: "manage_settings", label: "Gérer les paramètres", category: "Paramètres" },
  { id: "view_analytics", label: "Voir les statistiques avancées", category: "Rapports" },
  { id: "export_data", label: "Exporter les données", category: "Général" },
];

const AVAILABLE_ROLES = [
  { value: "super_admin", label: "Super Administrateur" },
  { value: "directeur_tc", label: "Directeur Technico-Commercial" },
  { value: "responsable_zone", label: "Responsable de Zone" },
  { value: "comptable", label: "Comptable" },
  { value: "commercial", label: "Commercial" },
  { value: "service_client", label: "Agent Service Client" },
  { value: "operations", label: "Opérations" },
  { value: "user", label: "Utilisateur" },
];

const ROLES_DEFINITIONS = [
  { 
    role: "super_admin",
    nom: "Super Administrateur",
    description: "Accès complet à toutes les fonctionnalités",
    color: "destructive",
    niveau: 1
  },
  { 
    role: "directeur_tc",
    nom: "Directeur Technico-Commercial",
    description: "Direction de l'activité technico-commerciale",
    color: "secondary",
    niveau: 4
  },
  { 
    role: "responsable_zone",
    nom: "Responsable de Zone",
    description: "Gestion d'une zone géographique",
    color: "outline",
    niveau: 6
  },
  { 
    role: "comptable",
    nom: "Comptable",
    description: "Gestion financière et comptabilité",
    color: "secondary",
    niveau: 5
  },
  { 
    role: "commercial",
    nom: "Commercial",
    description: "Acquisition et suivi des planteurs",
    color: "outline",
    niveau: 8
  },
  { 
    role: "service_client",
    nom: "Agent Service Client",
    description: "Support et assistance client",
    color: "outline",
    niveau: 8
  },
  { 
    role: "operations",
    nom: "Opérations",
    description: "Gestion des opérations terrain",
    color: "secondary",
    niveau: 5
  },
  { 
    role: "user",
    nom: "Utilisateur",
    description: "Accès de base",
    color: "outline",
    niveau: 10
  },
];

const GestionRoles = () => {
  const { toast } = useToast();
  const [roles] = useState(ROLES_DEFINITIONS);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nom_complet, email, role, actif")
        .eq("actif", true)
        .order("nom_complet");

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("*");

      setProfiles(profilesData || []);
      setUserRoles(rolesData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getUserRoles = (profileId: string) => {
    return userRoles.filter(ur => ur.user_id === profileId);
  };

  const handleAssignRole = async () => {
    if (!selectedProfile || !selectedRole) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner un utilisateur et un rôle"
      });
      return;
    }

    setSaving(true);
    try {
      // Vérifier si le rôle existe déjà
      const existing = userRoles.find(
        ur => ur.user_id === selectedProfile && ur.role === selectedRole
      );

      if (existing) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Ce rôle est déjà assigné à cet utilisateur"
        });
        return;
      }

      const { error } = await (supabase as any)
        .from("user_roles")
        .insert({
          user_id: selectedProfile,
          role: selectedRole
        });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Rôle assigné avec succès"
      });

      setAssignDialogOpen(false);
      setSelectedProfile("");
      setSelectedRole("");
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRole = async (userRoleId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("user_roles")
        .delete()
        .eq("id", userRoleId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Rôle retiré avec succès"
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    }
  };

  const groupedPermissions = PERMISSIONS.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, typeof PERMISSIONS>);

  const getNiveauLabel = (niveau: number) => {
    switch(niveau) {
      case 1: return "Direction Suprême";
      case 2: case 3: return "Direction";
      case 4: case 5: return "Management";
      case 6: case 7: return "Encadrement";
      case 8: return "Opérationnel";
      default: return "Autre";
    }
  };

  const getRoleLabel = (role: string) => {
    return AVAILABLE_ROLES.find(r => r.value === role)?.label || role;
  };

  return (
    <div className="space-y-6">
      {/* Section Attribution des rôles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Attribution des Rôles aux Utilisateurs
              </CardTitle>
              <CardDescription>
                Assignez les rôles aux utilisateurs de la plateforme
              </CardDescription>
            </div>
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Assigner un rôle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assigner un rôle</DialogTitle>
                  <DialogDescription>
                    Sélectionnez un utilisateur et le rôle à lui attribuer
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Utilisateur</label>
                    <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un utilisateur" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.nom_complet || profile.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rôle</label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleAssignRole} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Assigner
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôles assignés</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Aucun utilisateur
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((profile) => {
                    const profileRoles = getUserRoles(profile.id);
                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">
                          {profile.nom_complet || "Non renseigné"}
                        </TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {profileRoles.length === 0 ? (
                              <span className="text-muted-foreground text-sm">Aucun rôle</span>
                            ) : (
                              profileRoles.map((ur) => (
                                <Badge 
                                  key={ur.id} 
                                  variant={ur.role === 'super_admin' ? 'destructive' : 'secondary'}
                                  className="cursor-pointer hover:opacity-80"
                                  onClick={() => handleRemoveRole(ur.id)}
                                  title="Cliquer pour retirer"
                                >
                                  {getRoleLabel(ur.role)} ×
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedProfile(profile.id);
                              setAssignDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Section Définition des rôles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Définition des Rôles
              </CardTitle>
              <CardDescription>
                Rôles disponibles et leurs permissions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Permissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.role}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={role.color as any}>{role.nom}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getNiveauLabel(role.niveau)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{role.description}</span>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Voir les permissions
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Permissions - {role.nom}</DialogTitle>
                              <DialogDescription>
                                Configuration des permissions pour ce rôle
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              {Object.entries(groupedPermissions).map(([category, perms]) => (
                                <div key={category} className="space-y-2">
                                  <h4 className="font-medium text-sm">{category}</h4>
                                  <div className="space-y-2 pl-4">
                                    {perms.map((permission) => (
                                      <div key={permission.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                          id={`${role.role}-${permission.id}`}
                                          checked={role.role === "super_admin"}
                                          disabled={role.role === "super_admin"}
                                        />
                                        <label
                                          htmlFor={`${role.role}-${permission.id}`}
                                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                          {permission.label}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Hiérarchie des Rôles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-4 border-destructive pl-4 py-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-destructive" />
                      <p className="font-semibold">Direction Suprême</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Super Admin</p>
                  </div>
                  <div className="border-l-4 border-primary pl-4 py-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <p className="font-semibold">Management</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Directeur TC, Comptable, Opérations</p>
                  </div>
                  <div className="border-l-4 border-secondary pl-4 py-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-secondary-foreground" />
                      <p className="font-semibold">Terrain</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Responsable de Zone → Commercial / Agent Service Client
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionRoles;