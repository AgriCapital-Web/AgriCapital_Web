import { useState, useEffect, useMemo } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  CreditCard, 
  Coins, 
  ArrowRightLeft, 
  RefreshCcw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  TrendingUp,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentRate, formatCFA } from "@/utils/pricing";

// Tarifs par défaut (PalmInvest An 1 par hectare) si aucune offre n'est liée au souscripteur
const FALLBACK_RATE_PER_HA = { jour: 2000, mois: 60000, trimestre: 180000, semestre: 360000, annee: 720000 };

const computeTarifs = (souscripteur: any) => {
  const rate = getCurrentRate(
    souscripteur?.offres?.code,
    null, // pas de plantation -> An 1 par défaut
    souscripteur?.offres?.contribution_mensuelle_par_ha || 0,
    souscripteur?.offres?.montant_da_par_ha || 0,
  );
  if (rate) {
    return {
      jour: rate.jour_par_ha,
      mois: rate.mensuel_par_ha,
      trimestre: rate.trimestre_par_ha,
      semestre: rate.semestre_par_ha,
      annee: rate.annuel_par_ha,
      label: rate.label,
    };
  }
  return { ...FALLBACK_RATE_PER_HA, label: 'Tarif standard' };
};

interface Paiement {
  id: string;
  souscripteur_id: string;
  plantation_id: string;
  montant: number;
  montant_paye: number | null;
  type_paiement: string;
  statut: string;
  reference: string;
  date_paiement: string | null;
  created_at: string;
  metadata: any;
  souscripteurs?: { nom_complet: string; telephone: string };
  plantations?: { id_unique: string; nom_plantation: string };
}

const GestionPaiements = () => {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaiement, setSelectedPaiement] = useState<Paiement | null>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Transfer state
  const [sourcePhone, setSourcePhone] = useState("");
  const [targetAccount, setTargetAccount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [sourceSouscripteur, setSourceSouscripteur] = useState<any>(null);
  const [targetSouscripteur, setTargetSouscripteur] = useState<any>(null);

  // Refund state
  const [refundSourcePhone, setRefundSourcePhone] = useState("");
  const [refundPaiementId, setRefundPaiementId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [refundMode, setRefundMode] = useState("Mobile Money");
  const [refundNumero, setRefundNumero] = useState("");
  const [sourcePaiements, setSourcePaiements] = useState<Paiement[]>([]);

  // Convert state
  const [convertPeriod, setConvertPeriod] = useState<'jour' | 'mois' | 'trimestre' | 'semestre' | 'annee'>('mois');
  const [convertCount, setConvertCount] = useState(1);
  const [selectedSouscripteurId, setSelectedSouscripteurId] = useState("");

  const canManage = hasRole('super_admin') || hasRole('service_client') || hasRole('comptable');

  // Realtime refresh: when a payment changes (webhooks / validation), refresh lists + stats
  useRealtime({
    table: 'paiements',
    event: '*',
    onChange: () => {
      queryClient.invalidateQueries({ queryKey: ['gestion-paiements'] });
      queryClient.invalidateQueries({ queryKey: ['souscripteurs-monnaie'] });
    }
  });

  const { data: paiements = [], isLoading, refetch } = useQuery({
    queryKey: ['gestion-paiements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select(`
          *,
          souscripteurs (nom_complet, telephone),
          plantations (id_unique, nom_plantation)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as Paiement[];
    }
  });

  // Fetch souscripteurs with monnaie (solde positif)
  const { data: souscripteursMonnaie = [] } = useQuery({
    queryKey: ['souscripteurs-monnaie'],
    queryFn: async () => {
      // Calculer la monnaie pour chaque souscripteur
      const { data: souscripteurs, error: sError } = await supabase
        .from('souscripteurs')
        .select(`
          id, nom_complet, telephone,
          offres ( id, code, nom, montant_da_par_ha, contribution_mensuelle_par_ha ),
          plantations (id, superficie_activee, date_activation, montant_contribution_mensuelle)
        `)
        .eq('statut', 'actif')
        .limit(500);

      if (sError) throw sError;

      // Pour chaque souscripteur, calculer le solde
      const result = await Promise.all((souscripteurs || []).map(async (sous: any) => {
        const plantationIds = sous.plantations?.map((p: any) => p.id) || [];
        if (plantationIds.length === 0) return null;

        const { data: paiments } = await supabase
          .from('paiements')
          .select('montant_paye, plantation_id, type_paiement')
          .in('plantation_id', plantationIds)
          .eq('statut', 'valide')
          .eq('type_paiement', 'REDEVANCE');

        const totalPaye = paiments?.reduce((sum, p) => sum + (p.montant_paye || 0), 0) || 0;

        // Calcul du montant attendu via grille progressive
        let montantAttendu = 0;
        for (const plant of (sous.plantations || [])) {
          if (plant.date_activation) {
            const rate = getCurrentRate(
              sous.offres?.code,
              plant.date_activation,
              sous.offres?.contribution_mensuelle_par_ha || 0,
              sous.offres?.montant_da_par_ha || 0,
            );
            const tarifJour = rate?.jour_par_ha ?? ((plant.montant_contribution_mensuelle || 60000) / 30);
            const joursActifs = Math.floor((new Date().getTime() - new Date(plant.date_activation).getTime()) / (1000 * 60 * 60 * 24));
            montantAttendu += joursActifs * tarifJour * (plant.superficie_activee || 0);
          }
        }

        const solde = totalPaye - montantAttendu;
        
        return {
          id: sous.id,
          nom_complet: sous.nom_complet,
          telephone: sous.telephone,
          totalPaye,
          montantAttendu: Math.round(montantAttendu),
          monnaie: solde > 0 ? Math.round(solde) : 0,
          arrieres: solde < 0 ? Math.round(Math.abs(solde)) : 0
        };
      }));

      return result.filter(r => r !== null && r.monnaie > 0);
    }
  });

  // Stats
  const stats = useMemo(() => {
    const valides = paiements.filter(p => p.statut === 'valide');
    const enAttente = paiements.filter(p => p.statut === 'en_attente');
    const totalValide = valides.reduce((sum, p) => sum + (p.montant_paye || p.montant), 0);
    const totalMonnaie = souscripteursMonnaie.reduce((sum, s: any) => sum + (s?.monnaie || 0), 0);

    return {
      totalPaiements: paiements.length,
      paiementsValides: valides.length,
      paiementsEnAttente: enAttente.length,
      montantTotal: totalValide,
      monnaieDisponible: totalMonnaie
    };
  }, [paiements, souscripteursMonnaie]);

  // Filtered paiements
  const filteredPaiements = useMemo(() => {
    if (!searchTerm) return paiements;
    const term = searchTerm.toLowerCase();
    return paiements.filter(p => 
      p.reference?.toLowerCase().includes(term) ||
      p.souscripteurs?.nom_complet?.toLowerCase().includes(term) ||
      p.souscripteurs?.telephone?.includes(term) ||
      p.plantations?.id_unique?.toLowerCase().includes(term)
    );
  }, [paiements, searchTerm]);

  const formatMontant = (m: number) => {
    return new Intl.NumberFormat("fr-FR").format(m) + " F CFA";
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'valide':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Validé</Badge>;
      case 'en_attente':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case 'echoue':
      case 'rejete':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Échoué</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  // Search souscripteur by phone
  const searchSouscripteur = async (phone: string, target: 'source' | 'target') => {
    if (phone.length < 8) return;
    const { data } = await supabase
      .from('souscripteurs')
      .select('id, nom_complet, telephone, id_unique')
      .or(`telephone.ilike.%${phone}%,id_unique.ilike.%${phone}%`)
      .eq('statut', 'actif')
      .limit(5);
    
    if (data && data.length > 0) {
      if (target === 'source') {
        setSourceSouscripteur(data[0]);
        // Fetch paiements for this souscripteur
        const { data: paiements } = await supabase
          .from('paiements')
          .select('*')
          .eq('souscripteur_id', data[0].id)
          .eq('statut', 'valide')
          .order('created_at', { ascending: false })
          .limit(10);
        setSourcePaiements(paiements || []);
      } else {
        setTargetSouscripteur(data[0]);
      }
    }
  };

  // Handle transfer between accounts
  const handleTransfer = async () => {
    if (!sourceSouscripteur || !targetSouscripteur || !transferAmount) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez remplir tous les champs" });
      return;
    }
    setLoading(true);
    
    try {
      const amount = parseFloat(transferAmount);
      
      // Create transfer record
      const { error: transferError } = await supabase
        .from('transferts_paiements')
        .insert({
          souscripteur_source_id: sourceSouscripteur.id,
          souscripteur_dest_id: targetSouscripteur.id,
          montant: amount,
          motif: transferNotes
        });

      if (transferError) throw transferError;

      // Create new payment for target
      const { error: insertError } = await supabase
        .from('paiements')
        .insert({
          souscripteur_id: targetSouscripteur.id,
          montant: amount,
          montant_paye: amount,
          type_paiement: 'REDEVANCE',
          statut: 'valide',
          mode_paiement: 'Transfert interne',
          reference: `TRF-${Date.now()}`,
          date_paiement: new Date().toISOString(),
          metadata: {
            transfert_entrant: {
              depuis: sourceSouscripteur.id,
              depuis_nom: sourceSouscripteur.nom_complet,
              montant: amount,
              date: new Date().toISOString(),
              notes: transferNotes
            }
          }
        });

      if (insertError) throw insertError;

      toast({
        title: "Transfert effectué",
        description: `${formatMontant(amount)} transféré de ${sourceSouscripteur.nom_complet} vers ${targetSouscripteur.nom_complet}`
      });

      setIsTransferDialogOpen(false);
      resetForms();
      refetch();
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

  // Handle refund
  const handleRefund = async () => {
    if (!sourceSouscripteur || !refundPaiementId || !refundAmount) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez remplir tous les champs" });
      return;
    }
    setLoading(true);

    try {
      const amount = parseFloat(refundAmount);
      const sourcePaiement = sourcePaiements.find(p => p.id === refundPaiementId);
      
      if (!sourcePaiement) throw new Error("Paiement source non trouvé");
      
      // Create refund record
      const { error: refundError } = await supabase
        .from('remboursements')
        .insert({
          paiement_id: refundPaiementId,
          souscripteur_id: sourceSouscripteur.id,
          montant: amount,
          motif: refundNotes,
          mode_remboursement: refundMode,
          numero_compte: refundNumero,
          statut: 'en_attente'
        });

      if (refundError) throw refundError;

      // Update payment with refund info
      await supabase
        .from('paiements')
        .update({
          montant_paye: (sourcePaiement.montant_paye || sourcePaiement.montant) - amount,
          metadata: {
            ...sourcePaiement.metadata,
            remboursement: {
              montant: amount,
              date: new Date().toISOString(),
              notes: refundNotes,
              mode: refundMode
            }
          }
        })
        .eq('id', refundPaiementId);

      toast({
        title: "Remboursement enregistré",
        description: `${formatMontant(amount)} à rembourser à ${sourceSouscripteur.nom_complet}`
      });

      setIsRefundDialogOpen(false);
      resetForms();
      refetch();
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

  // Handle convert monnaie to payment
  const handleConvertMonnaie = async () => {
    if (!selectedSouscripteurId || convertCount <= 0) return;
    setLoading(true);

    try {
      const souscripteur = souscripteursMonnaie.find((s: any) => s?.id === selectedSouscripteurId);
      if (!souscripteur) throw new Error('Souscripteur non trouvé');

      // Calcul du montant basé sur la grille progressive de l'offre
      const tarifs = computeTarifs(souscripteur);
      const montant = (tarifs as any)[convertPeriod] * convertCount;

      if (montant > (souscripteur as any).monnaie) {
        throw new Error('Monnaie insuffisante pour cette conversion');
      }

      // Create a new payment record for the conversion
      const { error } = await supabase
        .from('paiements')
        .insert({
          souscripteur_id: selectedSouscripteurId,
          montant: montant,
          montant_paye: montant,
          type_paiement: 'REDEVANCE',
          statut: 'valide',
          mode_paiement: 'Conversion monnaie',
          reference: `CONV-${Date.now()}`,
          date_paiement: new Date().toISOString(),
          metadata: {
            conversion: {
              periode: convertPeriod,
              nombre: convertCount,
              montant_converti: montant,
              date: new Date().toISOString()
            }
          }
        });

      if (error) throw error;

      toast({
        title: "Conversion effectuée",
        description: `${formatMontant(montant)} de monnaie convertis en ${convertCount} ${convertPeriod}(s)`
      });

      setIsConvertDialogOpen(false);
      resetForms();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['souscripteurs-monnaie'] });
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

  const resetForms = () => {
    setSelectedPaiement(null);
    setSourcePhone("");
    setTargetAccount("");
    setTransferAmount("");
    setTransferNotes("");
    setSourceSouscripteur(null);
    setTargetSouscripteur(null);
    setRefundSourcePhone("");
    setRefundPaiementId("");
    setRefundAmount("");
    setRefundNotes("");
    setRefundMode("Mobile Money");
    setRefundNumero("");
    setSourcePaiements([]);
    setSelectedSouscripteurId("");
    setConvertCount(1);
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <CreditCard className="h-7 w-7 text-primary" />
                Gestion des Paiements
              </h1>
              <p className="text-muted-foreground mt-1">
                Suivi, transferts, remboursements et conversion de monnaie
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{stats.totalPaiements}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Validés</p>
                    <p className="text-lg font-bold">{stats.paiementsValides}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">En attente</p>
                    <p className="text-lg font-bold">{stats.paiementsEnAttente}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Montant total</p>
                    <p className="text-sm font-bold">{formatMontant(stats.montantTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Coins className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">Monnaie dispo</p>
                    <p className="text-sm font-bold text-amber-800">{formatMontant(stats.monnaieDisponible)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="paiements" className="space-y-4">
            <TabsList className="grid w-full md:w-auto grid-cols-3 gap-2">
              <TabsTrigger value="paiements" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Paiements
              </TabsTrigger>
              <TabsTrigger value="monnaie" className="gap-2">
                <Coins className="h-4 w-4" />
                Monnaie
              </TabsTrigger>
              <TabsTrigger value="operations" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Opérations
              </TabsTrigger>
            </TabsList>

            {/* Paiements Tab */}
            <TabsContent value="paiements" className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom, téléphone, référence..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Souscripteur</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredPaiements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Aucun paiement trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPaiements.slice(0, 100).map((paiement) => (
                        <TableRow key={paiement.id}>
                          <TableCell className="text-sm">
                            {new Date(paiement.date_paiement || paiement.created_at).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{paiement.souscripteurs?.nom_complet || '-'}</p>
                              <p className="text-xs text-muted-foreground">{paiement.souscripteurs?.telephone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {paiement.type_paiement === 'DA' ? "Droit d'Accès" : 'Redevance'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">
                            {formatMontant(paiement.montant_paye || paiement.montant)}
                          </TableCell>
                          <TableCell>{getStatutBadge(paiement.statut)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPaiement(paiement);
                                  setIsDetailsDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canManage && paiement.statut === 'valide' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPaiement(paiement);
                                      setIsTransferDialogOpen(true);
                                    }}
                                    title="Transférer"
                                  >
                                    <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPaiement(paiement);
                                      setRefundAmount(String(paiement.montant_paye || paiement.montant));
                                      setIsRefundDialogOpen(true);
                                    }}
                                    title="Rembourser"
                                  >
                                    <ArrowDownLeft className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Monnaie Tab */}
            <TabsContent value="monnaie" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-600" />
                    Souscripteurs avec monnaie disponible
                  </CardTitle>
                  <CardDescription>
                    Les montants excédentaires payés par les souscripteurs peuvent être convertis en jours/mois de redevance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Souscripteur</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Total payé</TableHead>
                          <TableHead>Attendu</TableHead>
                          <TableHead>Monnaie</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {souscripteursMonnaie.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Aucun souscripteur avec monnaie disponible
                            </TableCell>
                          </TableRow>
                        ) : (
                          souscripteursMonnaie.map((sous: any) => (
                            <TableRow key={sous?.id}>
                              <TableCell className="font-medium">{sous?.nom_complet}</TableCell>
                              <TableCell>{sous?.telephone}</TableCell>
                              <TableCell>{formatMontant(sous?.totalPaye || 0)}</TableCell>
                              <TableCell>{formatMontant(sous?.montantAttendu || 0)}</TableCell>
                              <TableCell>
                                <Badge className="bg-amber-100 text-amber-800">
                                  {formatMontant(sous?.monnaie || 0)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {canManage && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSouscripteurId(sous?.id);
                                      setIsConvertDialogOpen(true);
                                    }}
                                  >
                                    <Wallet className="h-4 w-4 mr-1" />
                                    Convertir
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Operations Tab */}
            <TabsContent value="operations" className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setIsTransferDialogOpen(true)}>
                  <CardContent className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                      <ArrowRightLeft className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-lg">Transfert</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Transférer un paiement vers un autre compte
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setIsRefundDialogOpen(true)}>
                  <CardContent className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                      <ArrowDownLeft className="h-8 w-8 text-red-600" />
                    </div>
                    <h3 className="font-semibold text-lg">Remboursement</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Effectuer un remboursement partiel ou total
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setIsConvertDialogOpen(true)}>
                  <CardContent className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
                      <Coins className="h-8 w-8 text-amber-600" />
                    </div>
                    <h3 className="font-semibold text-lg">Conversion monnaie</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Convertir la monnaie en jours/mois de redevance
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Details Dialog */}
          <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Détails du paiement</DialogTitle>
              </DialogHeader>
              {selectedPaiement && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Référence</p>
                      <p className="font-mono text-sm">{selectedPaiement.reference}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Statut</p>
                      {getStatutBadge(selectedPaiement.statut)}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p>{selectedPaiement.type_paiement === 'DA' ? "Droit d'Accès" : 'Redevance'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Montant</p>
                      <p className="font-bold text-primary">{formatMontant(selectedPaiement.montant_paye || selectedPaiement.montant)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Souscripteur</p>
                      <p>{selectedPaiement.souscripteurs?.nom_complet}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Plantation</p>
                      <p>{selectedPaiement.plantations?.nom_plantation || selectedPaiement.plantations?.id_unique}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p>{new Date(selectedPaiement.date_paiement || selectedPaiement.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                  {selectedPaiement.metadata && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Métadonnées</p>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(selectedPaiement.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Transfer Dialog */}
          <Dialog open={isTransferDialogOpen} onOpenChange={(open) => { setIsTransferDialogOpen(open); if (!open) resetForms(); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                  Transférer un paiement
                </DialogTitle>
                <DialogDescription>
                  Transférer un montant d'un compte vers un autre
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Source - Débiteur */}
                <div className="space-y-2">
                  <Label>Numéro téléphone du débiteur (source)</Label>
                  <Input
                    type="tel"
                    placeholder="Ex: 0759566087"
                    value={sourcePhone}
                    onChange={(e) => {
                      setSourcePhone(e.target.value);
                      searchSouscripteur(e.target.value, 'source');
                    }}
                  />
                  {sourceSouscripteur && (
                    <div className="bg-green-50 p-2 rounded border border-green-200">
                      <p className="text-sm font-medium text-green-800">✓ {sourceSouscripteur.nom_complet}</p>
                      <p className="text-xs text-green-600">ID: {sourceSouscripteur.id_unique}</p>
                    </div>
                  )}
                </div>

                {/* Destination - Bénéficiaire */}
                <div className="space-y-2">
                  <Label>Numéro de compte du bénéficiaire (destination)</Label>
                  <Input
                    type="text"
                    placeholder="Ex: AC-2025-000123 ou téléphone"
                    value={targetAccount}
                    onChange={(e) => {
                      setTargetAccount(e.target.value);
                      searchSouscripteur(e.target.value, 'target');
                    }}
                  />
                  {targetSouscripteur && (
                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                      <p className="text-sm font-medium text-blue-800">✓ {targetSouscripteur.nom_complet}</p>
                      <p className="text-xs text-blue-600">ID: {targetSouscripteur.id_unique}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Montant à transférer (F CFA)</Label>
                  <Input
                    type="number"
                    placeholder="Montant"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Motif du transfert (optionnel)</Label>
                  <Textarea
                    placeholder="Raison du transfert..."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleTransfer} disabled={loading || !sourceSouscripteur || !targetSouscripteur || !transferAmount}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                  Transférer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Refund Dialog */}
          <Dialog open={isRefundDialogOpen} onOpenChange={(open) => { setIsRefundDialogOpen(open); if (!open) resetForms(); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowDownLeft className="h-5 w-5 text-red-600" />
                  Effectuer un remboursement
                </DialogTitle>
                <DialogDescription>
                  Sélectionnez le paiement source et le montant à rembourser
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Source - Souscripteur */}
                <div className="space-y-2">
                  <Label>Numéro téléphone du souscripteur</Label>
                  <Input
                    type="tel"
                    placeholder="Ex: 0759566087"
                    value={refundSourcePhone}
                    onChange={(e) => {
                      setRefundSourcePhone(e.target.value);
                      searchSouscripteur(e.target.value, 'source');
                    }}
                  />
                  {sourceSouscripteur && (
                    <div className="bg-muted p-2 rounded">
                      <p className="text-sm font-medium">✓ {sourceSouscripteur.nom_complet}</p>
                    </div>
                  )}
                </div>

                {/* Sélection du paiement source */}
                {sourcePaiements.length > 0 && (
                  <div className="space-y-2">
                    <Label>Paiement source à rembourser</Label>
                    <Select value={refundPaiementId} onValueChange={setRefundPaiementId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le paiement" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourcePaiements.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.reference} - {formatMontant(p.montant_paye || p.montant)} ({new Date(p.date_paiement || p.created_at).toLocaleDateString('fr-FR')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Montant à rembourser (F CFA)</Label>
                  <Input
                    type="number"
                    placeholder="Montant"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mode de remboursement</Label>
                    <Select value={refundMode} onValueChange={setRefundMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                        <SelectItem value="Wave">Wave</SelectItem>
                        <SelectItem value="Orange Money">Orange Money</SelectItem>
                        <SelectItem value="Virement">Virement bancaire</SelectItem>
                        <SelectItem value="Espèces">Espèces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Numéro de compte</Label>
                    <Input
                      placeholder="Numéro du compte"
                      value={refundNumero}
                      onChange={(e) => setRefundNumero(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Motif du remboursement</Label>
                  <Textarea
                    placeholder="Raison du remboursement..."
                    value={refundNotes}
                    onChange={(e) => setRefundNotes(e.target.value)}
                  />
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Le remboursement sera enregistré. Le paiement effectif doit être fait manuellement.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRefundDialogOpen(false)}>Annuler</Button>
                <Button variant="destructive" onClick={handleRefund} disabled={loading || !sourceSouscripteur || !refundPaiementId || !refundAmount}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownLeft className="h-4 w-4 mr-2" />}
                  Rembourser
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Convert Monnaie Dialog */}
          <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-600" />
                  Convertir la monnaie
                </DialogTitle>
                <DialogDescription>
                  Convertir le solde excédentaire en jours/mois de redevance
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {!selectedSouscripteurId && (
                  <div className="space-y-2">
                    <Label>Sélectionner un souscripteur</Label>
                    <Select value={selectedSouscripteurId} onValueChange={setSelectedSouscripteurId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un souscripteur" />
                      </SelectTrigger>
                      <SelectContent>
                        {souscripteursMonnaie.map((sous: any) => (
                          <SelectItem key={sous?.id} value={sous?.id}>
                            {sous?.nom_complet} - {formatMontant(sous?.monnaie || 0)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {selectedSouscripteurId && (
                  <>
                    <div className="bg-amber-50 p-3 rounded-lg">
                      <p className="text-sm">
                        Monnaie disponible: <strong className="text-amber-800">
                          {formatMontant(souscripteursMonnaie.find((s: any) => s?.id === selectedSouscripteurId)?.monnaie || 0)}
                        </strong>
                      </p>
                    </div>
                    
                    {(() => {
                      const sousObj = souscripteursMonnaie.find((s: any) => s?.id === selectedSouscripteurId);
                      const tarifs = computeTarifs(sousObj);
                      const montantConv = (tarifs as any)[convertPeriod] * convertCount;
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Période ({tarifs.label})</Label>
                              <Select value={convertPeriod} onValueChange={(v) => setConvertPeriod(v as any)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="jour">Jour ({formatMontant(tarifs.jour)} F)</SelectItem>
                                  <SelectItem value="mois">Mois ({formatMontant(tarifs.mois)} F)</SelectItem>
                                  <SelectItem value="trimestre">Trimestre ({formatMontant(tarifs.trimestre)} F)</SelectItem>
                                  <SelectItem value="semestre">Semestre ({formatMontant(tarifs.semestre)} F)</SelectItem>
                                  <SelectItem value="annee">Année ({formatMontant(tarifs.annee)} F)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Nombre</Label>
                              <Input
                                type="number"
                                min="1"
                                value={convertCount}
                                onChange={(e) => setConvertCount(parseInt(e.target.value) || 1)}
                              />
                            </div>
                          </div>

                          <div className="bg-muted p-3 rounded-lg">
                            <p className="text-sm">
                              Montant à convertir: <strong>{formatMontant(montantConv)}</strong>
                              <span className="text-xs text-muted-foreground ml-2">(par hectare · {tarifs.label})</span>
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsConvertDialogOpen(false); setSelectedSouscripteurId(''); }}>
                  Annuler
                </Button>
                <Button onClick={handleConvertMonnaie} disabled={loading || !selectedSouscripteurId}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Coins className="h-4 w-4 mr-2" />}
                  Convertir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default GestionPaiements;
