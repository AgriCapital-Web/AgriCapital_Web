import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Eye, Users, Sprout, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const PortefeuilleClients = () => {
  const [planteurs, setPlanteurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchPlanteurs = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("souscripteurs")
        .select(`
          *,
          plantations (
            id,
            id_unique,
            statut_global,
            superficie_ha
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlanteurs(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanteurs();
  }, []);

  useRealtime({
    table: "souscripteurs",
    onChange: () => fetchPlanteurs(),
  });

  const filteredPlanteurs = planteurs.filter((p) =>
    p.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id_unique?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.telephone?.includes(searchTerm)
  );

  const stats = {
    totalPlanteurs: planteurs.length,
    totalPlantations: planteurs.reduce((sum, p) => sum + (p.plantations?.length || 0), 0),
    totalSuperficie: planteurs.reduce((sum, p) => 
      sum + (p.plantations?.reduce((s: number, pl: any) => s + Number(pl.superficie_ha || 0), 0) || 0), 0
    ),
  };

  const getStatutBadge = (statut: string) => {
    const colors: any = {
      actif: "bg-green-500",
      inactif: "bg-gray-500",
      suspendu: "bg-red-500",
    };
    return colors[statut] || "bg-gray-500";
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Mon Portefeuille Clients</h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos planteurs et leurs plantations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Planteurs
                </CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPlanteurs}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Plantations
                </CardTitle>
                <Sprout className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPlantations}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Superficie Totale
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSuperficie.toFixed(2)} ha</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, ID ou téléphone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Unique</TableHead>
                  <TableHead>Nom Complet</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Plantations</TableHead>
                  <TableHead>Superficie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredPlanteurs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Aucun planteur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlanteurs.map((planteur) => (
                    <TableRow key={planteur.id}>
                      <TableCell className="font-mono text-sm">
                        {planteur.id_unique}
                      </TableCell>
                      <TableCell className="font-medium">
                        {planteur.nom_complet}
                      </TableCell>
                      <TableCell>{planteur.telephone}</TableCell>
                      <TableCell>{planteur.plantations?.length || 0}</TableCell>
                      <TableCell>
                        {planteur.plantations?.reduce((sum: number, pl: any) => 
                          sum + Number(pl.superficie_ha || 0), 0
                        ).toFixed(2)} ha
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatutBadge(planteur.statut_global)}>
                          {planteur.statut_global}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/planteur/${planteur.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir détails
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default PortefeuilleClients;
