import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Plus, Eye } from "lucide-react";
import TicketForm from "@/components/forms/TicketForm";

const Tickets = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const { toast } = useToast();

  const fetchTickets = async () => {
    const { data, error } = await (supabase as any)
      .from("tickets_techniques")
      .select(`
        *,
        plantation:plantations(id_unique, nom_plantation),
        cree_par_profile:profiles!tickets_techniques_cree_par_fkey(nom_complet),
        assigne_a_profile:profiles!tickets_techniques_assigne_a_fkey(nom_complet)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } else {
      setTickets(data || []);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useRealtime({ table: "tickets_techniques", onChange: fetchTickets });

  const getPrioriteColor = (priorite: string) => {
    switch (priorite) {
      case "urgente": return "bg-red-500";
      case "haute": return "bg-orange-500";
      case "moyenne": return "bg-yellow-500";
      case "basse": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case "ouvert": return "bg-blue-500";
      case "en_cours": return "bg-yellow-500";
      case "resolu": return "bg-green-500";
      case "ferme": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Tickets Techniques</h1>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedTicket(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTicket ? "Modifier le Ticket" : "Créer un Ticket"}
                  </DialogTitle>
                </DialogHeader>
                <TicketForm
                  ticket={selectedTicket}
                  onSuccess={() => {
                    setDialogOpen(false);
                    setSelectedTicket(null);
                    fetchTickets();
                  }}
                  onCancel={() => setDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liste des Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Plantation</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé par</TableHead>
                    <TableHead>Assigné à</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>{new Date(ticket.created_at).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="font-medium">{ticket.titre}</TableCell>
                      <TableCell>{ticket.plantation?.nom_plantation || "N/A"}</TableCell>
                      <TableCell>
                        <Badge className={getPrioriteColor(ticket.priorite)}>
                          {ticket.priorite}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatutColor(ticket.statut)}>
                          {ticket.statut?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{ticket.cree_par_profile?.nom_complet || "N/A"}</TableCell>
                      <TableCell>{ticket.assigne_a_profile?.nom_complet || "Non assigné"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
};

export default Tickets;
