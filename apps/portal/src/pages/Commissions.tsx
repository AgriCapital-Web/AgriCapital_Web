import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, DollarSign, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Commissions = () => {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchCommissions = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("commissions")
        .select(`
          *,
          profile:profiles!commissions_profile_id_fkey(nom_complet, telephone),
          plantation:plantations(id_unique, nom_plantation)
        `)
        .order("date_calcul", { ascending: false });

      if (error) throw error;
      setCommissions(data || []);
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
    fetchCommissions();
  }, []);

  useRealtime({ table: "commissions", onChange: fetchCommissions });

  const handleValider = async (commissionId: string) => {
    try {
      const { data: profileId, error: profileErr } = await (supabase as any).rpc("current_profile_id");
      if (profileErr) throw profileErr;

      const { error } = await (supabase as any)
        .from("commissions")
        .update({
          statut: "valide",
          date_validation: new Date().toISOString(),
          valide_par: profileId,
        })
        .eq("id", commissionId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Commission validée avec succès",
      });
      fetchCommissions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };
  const handleRejeter = async (commissionId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("commissions")
        .update({ statut: "annule" })
        .eq("id", commissionId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Commission annulée",
      });
      fetchCommissions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  const filteredCommissions = commissions.filter((c) =>
    c.profile?.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.plantation?.id_unique?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.type_commission?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: commissions.reduce((sum, c) => sum + Number(c.montant_commission), 0),
    enAttente: commissions.filter(c => c.statut === "en_attente").reduce((sum, c) => sum + Number(c.montant_commission), 0),
    validees: commissions.filter(c => c.statut === "valide").reduce((sum, c) => sum + Number(c.montant_commission), 0),
    payees: commissions.filter(c => c.statut === "paye").reduce((sum, c) => sum + Number(c.montant_commission), 0),
  };

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
    }).format(montant);
  };

  const getStatutBadge = (statut: string) => {
    const colors: any = {
      en_attente: "bg-yellow-500",
      valide: "bg-blue-500",
      paye: "bg-green-500",
      annule: "bg-red-500",
    };
    return colors[statut] || "bg-gray-500";
  };

  const getTypeLabel = (type: string) => {
    const labels: any = {
      souscription: "Souscription",
      suivi: "Suivi",
      recolte: "Récolte",
      paiement: "Paiement",
    };
    return labels[type] || type;
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Gestion des Commissions</h1>
            <p className="text-muted-foreground mt-1">
              {commissions.length} commission(s) enregistrée(s)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Commissions
                </CardTitle>
                <DollarSign className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMontant(stats.total)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  En Attente
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMontant(stats.enAttente)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Validées
                </CardTitle>
                <CheckCircle className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMontant(stats.validees)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Payées
                </CardTitle>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMontant(stats.payees)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, plantation, type..."
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
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Plantation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredCommissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Aucune commission trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCommissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="font-medium">
                        {commission.profile?.nom_complet}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {commission.plantation?.id_unique}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTypeLabel(commission.type_commission)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatMontant(commission.montant_base)}</TableCell>
                      <TableCell>{commission.taux_commission}%</TableCell>
                      <TableCell className="font-bold">
                        {formatMontant(commission.montant_commission)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(commission.periode), "MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatutBadge(commission.statut)}>
                          {commission.statut.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {commission.statut === "en_attente" && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleValider(commission.id)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejeter(commission.id)}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
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

export default Commissions;
