import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SyncStatusBadge, OnlineBadge, type SyncState } from "@/components/offline/SyncStatusBadge";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { getAllItems, STORES } from "@/lib/offlineDb";
import {
  getAllQueuedFiles, retryQueuedFile, retryAllQueuedFiles, discardQueuedFile,
  getFileQueueStats, startFileQueueResume,
} from "@/lib/offlineFiles";
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react";

/** Écran de suivi des opérations hors ligne en attente (données + pièces jointes). */
export function SyncQueueContent() {

  const { isOnline, isSyncing, syncNow, pendingCount, pendingFiles, lastSync } = useOfflineSync();
  const [ops, setOps] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [fileStats, setFileStats] = useState({ pending: 0, error: 0, waiting: 0, total: 0 });

  const load = useCallback(async () => {
    const queue = await getAllItems(STORES.SYNC_QUEUE);
    setOps((queue as any[]).filter((o) => o.status !== "synced"));
    setFiles(await getAllQueuedFiles());
    setFileStats(await getFileQueueStats());
  }, []);

  useEffect(() => {
    load();
    const stopResume = startFileQueueResume();
    const onDone = () => load();
    window.addEventListener("offline-sync-complete", onDone);
    const t = setInterval(load, 10000);
    return () => {
      stopResume();
      window.removeEventListener("offline-sync-complete", onDone);
      clearInterval(t);
    };
  }, [load]);

  const stateOf = (status: string): SyncState =>
    status === "error" ? "error" : status === "syncing" ? "syncing" : "queued";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Synchronisation</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount} opération(s) et {pendingFiles} fichier(s) en attente
            {lastSync ? ` • dernière synchro : ${new Date(lastSync).toLocaleString("fr-FR")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OnlineBadge isOnline={isOnline} />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => { await retryAllQueuedFiles(); await syncNow(); load(); }}
            disabled={!isOnline || fileStats.error + fileStats.waiting === 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Relancer les échecs ({fileStats.error + fileStats.waiting})
          </Button>
          <Button onClick={syncNow} disabled={!isOnline || isSyncing} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            Synchroniser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Fichiers en file", v: fileStats.total },
          { l: "Prêts à envoyer", v: fileStats.pending },
          { l: "En attente de reprise", v: fileStats.waiting },
          { l: "En échec", v: fileStats.error },
        ].map((s) => (
          <Card key={s.l}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.l}</p>
              <p className="text-xl font-bold">{s.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Opérations de données</CardTitle></CardHeader>
        <CardContent>
          {ops.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune opération en attente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Enregistrement</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>État</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ops.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>{op.table}</TableCell>
                    <TableCell>{op.operation}</TableCell>
                    <TableCell className="font-mono text-xs">{String(op.record_id).slice(0, 12)}…</TableCell>
                    <TableCell className="text-xs">{new Date(op.timestamp).toLocaleString("fr-FR")}</TableCell>
                    <TableCell>
                      <SyncStatusBadge state={stateOf(op.status)} />
                      {op.error && <p className="text-xs text-destructive mt-1">{op.error}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pièces jointes en attente</CardTitle></CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun fichier en attente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Chemin</TableHead>
                  <TableHead>Rattachement</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.bucket}</TableCell>
                    <TableCell className="text-xs break-all">{f.path}</TableCell>
                    <TableCell className="text-xs">
                      {f.table ? `${f.table}.${f.column || "—"}` : "en attente d'ID"}
                      <br />
                      <span className="text-muted-foreground">{f.record_id ? String(f.record_id).slice(0, 8) + "…" : f.form_id || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <SyncStatusBadge state={f.status === "error" ? "error" : "queued"} />
                      {f.error && <p className="text-xs text-destructive mt-1">{f.error}</p>}
                      {f.retries > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Tentative {f.retries}
                          {f.nextRetryAt > Date.now() ? ` • reprise à ${new Date(f.nextRetryAt).toLocaleTimeString("fr-FR")}` : " • reprise automatique"}
                        </p>
                      )}
                      {(f.form_id || f.field) && <p className="text-xs text-muted-foreground mt-1">Formulaire {f.form_id || "—"} • {f.field || "pièce jointe"}</p>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={async () => { await retryQueuedFile(f.id); await syncNow(); load(); }} disabled={!isOnline}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async () => { await discardQueuedFile(f.id); load(); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
/** Page complète avec menu latéral et contrôle d'accès. */
export default function SyncQueue() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <SyncQueueContent />
      </MainLayout>
    </ProtectedRoute>
  );
}
