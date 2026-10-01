import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Eye } from "lucide-react";

const AccountRequests = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const { hasRole, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (hasRole('super_admin')) {
      fetchRequests();
    }
  }, [hasRole]);

  const fetchRequests = async () => {
    const { data, error } = await (supabase as any)
      .from('account_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
      return;
    }

    setRequests(data || []);
  };

  const handleAction = async () => {
    if (!selectedRequest || !user) return;

    try {
      if (actionType === 'approve') {
        // Create user account via edge function
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            username: selectedRequest.email.split('@')[0],
            email: selectedRequest.email,
            password: 'TempPassword123!', // Temporary password
            nom_complet: selectedRequest.nom_complet,
            telephone: selectedRequest.telephone,
            roles: [selectedRequest.role_souhaite]
          }
        });

        if (error) throw error;

        // Update request status
        await (supabase as any)
          .from('account_requests')
          .update({
            statut: 'approuve',
            traite_par: user.id,
            traite_le: new Date().toISOString()
          })
          .eq('id', selectedRequest.id);

        toast({
          title: "Demande approuvée",
          description: "Le compte a été créé avec succès",
        });
      } else if (actionType === 'reject') {
        await (supabase as any)
          .from('account_requests')
          .update({
            statut: 'rejete',
            motif_rejet: rejectReason,
            traite_par: user.id,
            traite_le: new Date().toISOString()
          })
          .eq('id', selectedRequest.id);

        toast({
          title: "Demande rejetée",
          description: "La demande a été rejetée",
        });
      }

      fetchRequests();
      setDialogOpen(false);
      setRejectReason("");
      setActionType(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_attente':
        return <Badge variant="outline">En attente</Badge>;
      case 'approuve':
        return <Badge className="bg-green-500">Approuvé</Badge>;
      case 'rejete':
        return <Badge variant="destructive">Rejeté</Badge>;
      default:
        return null;
    }
  };

  if (!hasRole('super_admin')) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Accès réservé aux super administrateurs</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Demandes de Création de Compte</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des Demandes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    {new Date(request.created_at).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>{request.nom_complet}</TableCell>
                  <TableCell>{request.email}</TableCell>
                  <TableCell>{request.poste_souhaite}</TableCell>
                  <TableCell>{request.role_souhaite}</TableCell>
                  <TableCell>{getStatusBadge(request.statut)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setActionType(null);
                          setDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {request.statut === 'en_attente' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType('approve');
                              setDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType('reject');
                              setDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approuver la demande' : 
               actionType === 'reject' ? 'Rejeter la demande' : 
               'Détails de la demande'}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nom complet</Label>
                  <p className="text-sm">{selectedRequest.nom_complet}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm">{selectedRequest.email}</p>
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <p className="text-sm">{selectedRequest.telephone}</p>
                </div>
                <div>
                  <Label>Poste souhaité</Label>
                  <p className="text-sm">{selectedRequest.poste_souhaite}</p>
                </div>
                <div>
                  <Label>Rôle souhaité</Label>
                  <p className="text-sm">{selectedRequest.role_souhaite}</p>
                </div>
                <div>
                  <Label>Département</Label>
                  <p className="text-sm">{selectedRequest.departement || 'N/A'}</p>
                </div>
              </div>

              <div>
                <Label>Justification</Label>
                <p className="text-sm mt-1">{selectedRequest.justification}</p>
              </div>

              {selectedRequest.photo_url && (
                <div>
                  <Label>Photo</Label>
                  <img
                    src={selectedRequest.photo_url}
                    alt="Photo"
                    className="w-32 h-32 object-cover rounded-full mt-2"
                  />
                </div>
              )}

              {actionType === 'reject' && (
                <div>
                  <Label>Motif du rejet *</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    placeholder="Expliquez pourquoi la demande est rejetée..."
                  />
                </div>
              )}

              {actionType && (
                <div className="flex gap-4 justify-end">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleAction}
                    disabled={actionType === 'reject' && !rejectReason}
                    variant={actionType === 'approve' ? 'default' : 'destructive'}
                  >
                    {actionType === 'approve' ? 'Approuver' : 'Rejeter'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountRequests;
