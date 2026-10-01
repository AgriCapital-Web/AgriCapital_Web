import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  readJournal,
  clearJournal,
  SYNC_JOURNAL_EVENT,
  type SyncJournalEntry,
  type SyncJournalKind,
} from "@/utils/syncJournal";
import { Activity, Trash2, Wifi, AlertTriangle, Tag, Ban, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const KIND_META: Record<SyncJournalKind, { label: string; className: string; Icon: any }> = {
  sync: { label: "Sync", className: "bg-primary/10 text-primary border-primary/20", Icon: RefreshCw },
  sync_error: { label: "Erreur", className: "bg-destructive/10 text-destructive border-destructive/20", Icon: AlertTriangle },
  crm_change: { label: "CRM", className: "bg-gold/15 text-foreground border-gold/30", Icon: Tag },
  di_cancel: { label: "DI annulé", className: "bg-destructive/10 text-destructive border-destructive/20", Icon: Ban },
  price_source: { label: "Prix", className: "bg-secondary text-secondary-foreground border-border", Icon: Tag },
  connection: { label: "Connexion", className: "bg-muted text-muted-foreground border-border", Icon: Wifi },
};

interface Props {
  account: string | null | undefined;
  lastSync?: Date | null;
  status?: string;
  trigger?: React.ReactNode;
}

export const SyncJournalDialog = ({ account, lastSync, status, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SyncJournalEntry[]>([]);

  const reload = useCallback(() => setEntries(readJournal(account)), [account]);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener(SYNC_JOURNAL_EVENT, handler);
    return () => window.removeEventListener(SYNC_JOURNAL_EVENT, handler);
  }, [reload]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reload(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 h-9 w-9" aria-label="Journal de synchronisation">
            <Activity className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Journal de synchronisation</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Compte</span><span className="font-medium">{account || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">État temps réel</span><span className="font-medium">{status || "—"}</span></div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dernière synchronisation</span>
            <span className="font-medium">{lastSync ? format(lastSync, "dd/MM/yyyy HH:mm:ss", { locale: fr }) : "—"}</span>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Entrées</span><span className="font-medium">{entries.length}</span></div>
        </div>

        <ScrollArea className="h-[45vh] pr-3">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun évènement enregistré pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => {
                const meta = KIND_META[e.kind] || KIND_META.sync;
                const Icon = meta.Icon;
                return (
                  <li key={e.id} className="rounded-lg border border-border bg-card p-2.5">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.className}`}>{meta.label}</Badge>
                          <span className="text-xs font-semibold">{e.label}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {format(new Date(e.at), "dd/MM HH:mm:ss", { locale: fr })}
                          </span>
                        </div>
                        {e.details && <p className="mt-1 text-[11px] text-muted-foreground break-words">{e.details}</p>}
                        {(e.before !== undefined || e.after !== undefined) && (
                          <p className="mt-1 text-[11px] break-words">
                            <span className="text-muted-foreground line-through">{e.before ?? "—"}</span>
                            <span className="mx-1 text-muted-foreground">→</span>
                            <span className="font-semibold text-primary">{e.after ?? "—"}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => { clearJournal(account); reload(); }} disabled={entries.length === 0}>
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Vider le journal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SyncJournalDialog;
