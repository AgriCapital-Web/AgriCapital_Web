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
import { Search, Wallet, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Portefeuilles = () => {
  const [portefeuilles, setPortefeuilles] = useState<any[]>([]);
  const [retraits, setRetraits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const { data: portData, error: portError } = await (supabase as any)
        .from("portefeuilles")
        .select(`
          *,
          user:profiles!portefeuilles_user_id_fkey(nom_complet, telephone, email)
        `)
        .order("created_at", { ascending: false });

      const { data: retraitData, error: retraitError } = await (supabase as any)
        .from("retraits_portefeuille")
        .select(`
          *,
          user:profiles!retraits_portefeuille_user_id_fkey(nom_complet)
        `)
        .order("date_demande", { ascending: false });

      if (portError) throw portError;
      if (retraitError) throw retraitError;

      setPortefeuilles(portData || []);
      setRetraits(retraitData || []);
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
    fetchData();
  }, []);

  useRealtime({ table: "portefeuilles", onChange: fetchData });
  useRealtime({ table: "retraits_portefeuille", onChange: fetchData });

  const handleApprouverRetrait = async (retraitId: string, montant: number, portefeuilleId: string) => {
    try {
      const { data: profileId, error: profileErr } = await (supabase as any).rpc("current_profile_id");
      if (profileErr) throw profileErr;

      const { error: retraitError } = await (supabase as any)
        .from("retraits_portefeuille")
        .update({
          statut: "approuve",
          date_traitement: new Date().toISOString(),
          traite_par: profileId,
        })
        .eq("id", retraitId);

      if (retraitError) throw retraitError;

      // Mettre à jour le portefeuille
      const portefeuille = portefeuilles.find(p => p.id === portefeuilleId);
      const { error: portError } = await (supabase as any)
        .from("portefeuilles")
        .update({
          solde_commissions: Number(portefeuille.solde_commissions) - montant,
          total_retire: Number(portefeuille.total_retire) + montant,
        })
        .eq("id", portefeuilleId);

      if (portError) throw portError;

      toast({
        title: "Succès",
        description: "Retrait approuvé avec succès",
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  const filteredPortefeuilles = portefeuilles.filter((p) =>
    p.user?.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalSoldes: portefeuilles.reduce((sum, p) => sum + Number(p.solde_commissions), 0),
    totalGagne: portefeuilles.reduce((sum, p) => sum + Number(p.total_gagne), 0),
    totalRetire: portefeuilles.reduce((sum, p) => sum + Number(p.total_retire), 0),
    retraitsEnAttente: retraits.filter(r => r.statut === "en_attente").reduce((sum, r) => sum + Number(r.montant), 0),
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
      approuve: "bg-blue-500",
      paye: "bg-green-500",
      rejete: "bg-red-500",
    };
    return colors[statut] || "bg-gray-500";
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Gestion des Portefeuilles</h1>
            <p className="text-muted-foreground mt-1">
              {portefeuilles.length} portefeuille(s) actif(s)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Soldes Totaux
                </CardTitle>
                <Wallet className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMontant(stats.totalSoldes)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Gagné
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMontant(stats.totalGagne)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Retiré
                </CardTitle>
                <TrendingDown className="h-5 w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMontant(stats.totalRetire)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Retraits en Attente
                </CardTitle>
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMontant(stats.retraitsEnAttente)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou email..."
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
                  <TableHead>Contact</TableHead>
                  <TableHead>Solde Actuel</TableHead>
                  <TableHead>Total Gagné</TableHead>
                  <TableHead>Total Retiré</TableHead>
                  <TableHead>Dernier Versement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredPortefeuilles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Aucun portefeuille trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPortefeuilles.map((portefeuille) => (
                    <TableRow key={portefeuille.id}>
                      <TableCell className="font-medium">
                        {portefeuille.user?.nom_complet}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{portefeuille.user?.telephone}</div>
                          <div className="text-muted-foreground">{portefeuille.user?.email}</div>
                        </div>
                      </TableCell>
                       <TableCell className="font-bold text-primary">
                         {formatMontant(portefeuille.solde_commissions)}
                       </TableCell>
                      <TableCell>{formatMontant(portefeuille.total_gagne)}</TableCell>
                      <TableCell>{formatMontant(portefeuille.total_retire)}</TableCell>
                      <TableCell>
                        {portefeuille.dernier_versement_date ? (
                          <div className="text-sm">
                            <div>{formatMontant(portefeuille.dernier_versement_montant)}</div>
                            <div className="text-muted-foreground">
                              {format(new Date(portefeuille.dernier_versement_date), "dd MMM yyyy", { locale: fr })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Aucun</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Demandes de Retrait en Attente</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Mode de Paiement</TableHead>
                    <TableHead>Date Demande</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retraits.filter(r => r.statut === "en_attente").length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Aucune demande en attente
                      </TableCell>
                    </TableRow>
                  ) : (
                    retraits.filter(r => r.statut === "en_attente").map((retrait) => (
                      <TableRow key={retrait.id}>
                        <TableCell className="font-medium">
                          {retrait.user?.nom_complet}
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatMontant(retrait.montant)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{retrait.mode_paiement}</div>
                            <div className="text-muted-foreground">{retrait.numero_compte}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(retrait.date_demande), "dd MMM yyyy HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatutBadge(retrait.statut)}>
                            {retrait.statut.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleApprouverRetrait(retrait.id, retrait.montant, retrait.portefeuille_id)}
                          >
                            Approuver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default Portefeuilles;
