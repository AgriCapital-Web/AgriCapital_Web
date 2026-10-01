import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS, hasPermission } from "@/lib/roles";

type Row = Record<string, any>;

const ACTION_LABELS: Record<string, string> = {
  insert: "Création",
  update: "Modification",
  delete: "Suppression",
};

const JournalAudit = () => {
  const { userRoles } = useAuth();
  const autorise = hasPermission(userRoles, PERMISSIONS.VIEW_AUDIT);
  const [logs, setLogs] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [entite, setEntite] = useState("toutes");
  const [action, setAction] = useState("toutes");
  const [detail, setDetail] = useState<Row | null>(null);


  const load = async () => {
    if (!autorise) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [autorise]);

  const entites = useMemo(
    () => Array.from(new Set(logs.map((l) => l.entite))).sort(),
    [logs],
  );

  const visibles = useMemo(() => logs.filter((l) => {
    if (entite !== "toutes" && l.entite !== entite) return false;
    if (action !== "toutes" && l.action !== action) return false;
    if (!q.trim()) return true;
    return [l.acteur_libelle, l.cible_libelle, l.entite, l.details, l.entite_id]
      .filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());
  }), [logs, q, entite, action]);

  if (!autorise) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Accès restreint</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Le journal de traçabilité est réservé au Super Admin et au Responsable des Opérations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Traçabilité des actions</CardTitle>
              <CardDescription>
                Qui a fait quoi, quand : toutes les créations, modifications et suppressions sur les données sensibles.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Rechercher un utilisateur, une fiche..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={entite} onValueChange={setEntite}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les tables</SelectItem>
                {entites.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les actions</SelectItem>
                <SelectItem value="insert">Création</SelectItem>
                <SelectItem value="update">Modification</SelectItem>
                <SelectItem value="delete">Suppression</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Fiche concernée</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm">{l.acteur_libelle || l.acteur_user_id || "Système"}</TableCell>
                    <TableCell>
                      <Badge variant={l.action === "delete" ? "destructive" : l.action === "insert" ? "default" : "secondary"}>
                        {ACTION_LABELS[l.action] || l.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{l.entite}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm">{l.cible_libelle || l.entite_id || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(l)}>Détails</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && visibles.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucune action enregistrée</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Détail de l'action</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <p><b>Quand :</b> {format(new Date(detail.created_at), "dd MMMM yyyy à HH:mm:ss", { locale: fr })}</p>
              <p><b>Qui :</b> {detail.acteur_libelle || detail.acteur_user_id || "Système"}</p>
              <p><b>Quoi :</b> {ACTION_LABELS[detail.action] || detail.action} sur {detail.entite} ({detail.entite_id})</p>
              {detail.details && <p><b>Résumé :</b> {detail.details}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-semibold">Avant</p>
                  <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(detail.ancienne_valeur, null, 2)}</pre>
                </div>
                <div>
                  <p className="mb-1 font-semibold">Après</p>
                  <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(detail.nouvelle_valeur, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JournalAudit;
