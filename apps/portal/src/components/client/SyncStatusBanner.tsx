import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  status: string;
  lastSync?: Date | null;
  /** Masque la bannière verte "à jour" après quelques secondes */
  autoHideWhenLive?: boolean;
}

const relative = (d: Date | null | undefined): string => {
  if (!d) return "jamais";
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return `il y a ${h} h`;
};

/**
 * Bannière de statut temps réel : indique si la synchronisation CRM est
 * active, en reconnexion ou interrompue, avec un compteur de dernière
 * mise à jour rafraîchi chaque seconde.
 */
export const SyncStatusBanner = ({ status, lastSync, autoHideWhenLive = true }: Props) => {
  const [, tick] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (status !== "live") { setHidden(false); return; }
    if (!autoHideWhenLive) return;
    const t = setTimeout(() => setHidden(true), 4000);
    return () => clearTimeout(t);
  }, [status, autoHideWhenLive]);

  if (status === "live" && hidden) return null;

  const meta = (() => {
    switch (status) {
      case "live":
        return { Icon: CheckCircle2, cls: "border-primary/30 bg-primary/10 text-primary", title: "Synchronisation CRM active", spin: false };
      case "offline":
        return { Icon: CloudOff, cls: "border-destructive/30 bg-destructive/10 text-destructive", title: "Connexion interrompue", spin: false };
      case "error":
        return { Icon: AlertCircle, cls: "border-destructive/30 bg-destructive/10 text-destructive", title: "Actualisation impossible", spin: false };
      case "reconnecting":
        return { Icon: Loader2, cls: "border-gold/40 bg-gold/10 text-gold-dark", title: "Reconnexion en cours…", spin: true };
      default:
        return { Icon: Loader2, cls: "border-border bg-muted text-muted-foreground", title: "Chargement des données CRM…", spin: true };
    }
  })();

  const { Icon, cls, title, spin } = meta;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-3 right-3 top-3 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-xl border px-3 py-2 shadow-lg backdrop-blur ${cls}`}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${spin ? "animate-spin" : ""}`} />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight">{title}</p>
        <p className="text-[10px] opacity-80">Dernière mise à jour : {relative(lastSync)}</p>
      </div>
    </div>
  );
};

export default SyncStatusBanner;
