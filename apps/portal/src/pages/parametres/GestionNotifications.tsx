import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Mail, MessageSquare, Edit, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Template {
  id: string;
  nom: string;
  type: "email" | "sms" | "whatsapp";
  evenement: string;
  sujet?: string;
  contenu: string;
  variables: string[];
  actif: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: "1",
    nom: "Bienvenue Planteur",
    type: "email",
    evenement: "creation_planteur",
    sujet: "Bienvenue chez AgriCapital",
    contenu: "Bonjour {nom_complet}, bienvenue dans la famille AgriCapital...",
    variables: ["nom_complet", "id_unique"],
    actif: true,
  },
  {
    id: "2",
    nom: "Paiement validé",
    type: "sms",
    evenement: "validation_paiement",
    contenu: "Paiement de {montant} FCFA validé pour {plantation_nom}",
    variables: ["montant", "plantation_nom"],
    actif: true,
  },
  {
    id: "3",
    nom: "Rappel paiement",
    type: "whatsapp",
    evenement: "rappel_paiement",
    contenu: "Rappel: Paiement à effectuer pour {plantation_nom}. Montant: {montant} FCFA",
    variables: ["plantation_nom", "montant", "date_echeance"],
    actif: true,
  },
];

const EVENEMENTS = [
  { value: "creation_planteur", label: "Création planteur" },
  { value: "validation_paiement", label: "Validation paiement" },
  { value: "rappel_paiement", label: "Rappel paiement" },
  { value: "nouvelle_plantation", label: "Nouvelle plantation" },
  { value: "visite_technique", label: "Visite technique" },
  { value: "recolte_enregistree", label: "Récolte enregistrée" },
];

const GestionNotifications = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const handleSaveTemplate = () => {
    toast({
      title: "Template enregistré",
      description: "Le template de notification a été enregistré avec succès",
    });
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleTestTemplate = (template: Template) => {
    toast({
      title: "Test envoyé",
      description: `Notification de test envoyée via ${template.type}`,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "sms":
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "email":
        return <Badge variant="default">Email</Badge>;
      case "sms":
        return <Badge variant="secondary">SMS</Badge>;
      case "whatsapp":
        return <Badge variant="outline">WhatsApp</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Gestion des Notifications
              </CardTitle>
              <CardDescription>
                Templates et configuration des notifications automatiques
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? "Modifier le template" : "Nouveau template"}
                  </DialogTitle>
                  <DialogDescription>
                    Créer un template de notification pour un événement
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom du template</Label>
                      <Input placeholder="Ex: Bienvenue Planteur" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type de notification</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Événement déclencheur</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un événement" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENEMENTS.map((evt) => (
                          <SelectItem key={evt.value} value={evt.value}>
                            {evt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sujet (pour email)</Label>
                    <Input placeholder="Ex: Bienvenue chez AgriCapital" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contenu du message</Label>
                    <Textarea 
                      placeholder="Utilisez {variable} pour insérer des variables dynamiques"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables disponibles: {"{nom_complet}"}, {"{id_unique}"}, {"{montant}"}, {"{date}"}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleSaveTemplate}>
                    Enregistrer
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
                  <TableHead>Template</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Événement</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(template.type)}
                        <span className="font-medium">{template.nom}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(template.type)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {EVENEMENTS.find(e => e.value === template.evenement)?.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 2).map((variable, idx) => (
                          <code key={idx} className="text-xs bg-muted px-1 py-0.5 rounded">
                            {"{" + variable + "}"}
                          </code>
                        ))}
                        {template.variables.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{template.variables.length - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.actif ? "default" : "secondary"}>
                        {template.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleTestTemplate(template)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setEditingTemplate(template);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionNotifications;
