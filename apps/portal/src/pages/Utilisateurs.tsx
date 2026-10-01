import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Users, Plus, Search, Edit, Shield, MoreHorizontal, UserCheck, UserX, Archive } from "lucide-react";
import UtilisateurFormNew from "@/components/forms/UtilisateurFormNew";

const Utilisateurs = () => {
  const [utilisateurs, setUtilisateurs] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { hasRole } = useAuth();
  const { toast } = useToast();

  const fetchUtilisateurs = async () => {
    try {
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await (supabase as any)
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      const profilesWithRoles = profiles?.map((profile: any) => ({
        ...profile,
        user_roles: roles?.filter((role: any) => role.user_id === profile.id) || []
      })) || [];

      setUtilisateurs(profilesWithRoles);
      setFilteredUsers(profilesWithRoles);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  useEffect(() => {
    fetchUtilisateurs();
  }, []);

  useRealtime({ table: "profiles", onChange: fetchUtilisateurs });
  useRealtime({ table: "user_roles", onChange: fetchUtilisateurs });

  useEffect(() => {
    const filtered = utilisateurs.filter(
      (u) =>
        u.nom_complet?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [search, utilisateurs]);

  const getRoles = (user: any) => {
    return user.user_roles?.map((r: any) => r.role) || [];
  };

  const handleStatusChange = async (userId: string, newStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ actif: newStatus })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: `Utilisateur ${newStatus ? "activé" : "suspendu"} avec succès`,
      });
      fetchUtilisateurs();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Gestion des Utilisateurs</h1>
            <p className="text-muted-foreground">{utilisateurs.length} utilisateur(s)</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedUser(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel Utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedUser ? "Modifier l'Utilisateur" : "Créer un Utilisateur"}
              </DialogTitle>
            </DialogHeader>
            <UtilisateurFormNew
              utilisateur={selectedUser}
              onSuccess={() => {
                setDialogOpen(false);
                setSelectedUser(null);
                fetchUtilisateurs();
              }}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des Utilisateurs</CardTitle>
          <div className="flex items-center gap-2 mt-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom Complet</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.nom_complet}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.telephone || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {getRoles(user).map((role: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {role.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={user.actif ? "bg-green-500" : "bg-red-500"}>
                      {user.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedUser(user);
                          setDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        {user.actif ? (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(user.id, false)}
                            className="text-orange-600"
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Suspendre
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(user.id, true)}
                            className="text-green-600"
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Activer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Utilisateurs;
