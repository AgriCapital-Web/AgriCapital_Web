import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, RefreshCw, ShieldCheck, Smartphone, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { trackEvent } from "@/utils/errorTracker";

interface Props {
  telephone?: string | null;
  email?: string | null;
  account?: string | null;
  trigger?: React.ReactNode;
}

interface AccessStatus {
  telephone?: string | null;
  nom_complet?: string | null;
  needs_access_code_setup?: boolean;
  locked_until?: string | null;
  success?: boolean;
}

const mask = (v?: string | null) => {
  if (!v) return "—";
  if (v.includes("@")) {
    const [u, d] = v.split("@");
    return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
  }
  return `${v.slice(0, 4)}****${v.slice(-2)}`;
};

export const AccessCodePanel = ({ telephone, email, account, trigger }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccessStatus | null>(null);

  const load = useCallback(async () => {
    if (!telephone) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("portal-access", {
        body: { action: "inspect", telephone },
      });
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error || "Statut du code d'accès indisponible.");
      setData(res as AccessStatus);
    } catch (e: any) {
      trackEvent({
        level: "error",
        scope: "auth",
        message: "Lecture du statut du code d'accès impossible",
        account,
        context: { error: e?.message },
      });
      toast({ variant: "destructive", title: "Erreur", description: e?.message || "Statut du code d'accès indisponible." });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [telephone, account, toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const locked = !!data?.locked_until && new Date(data.locked_until).getTime() > Date.now();
  const configured = data?.needs_access_code_setup === false;

  const Row = ({ label, value, Icon }: { label: string; value: React.ReactNode; Icon?: any }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 min-w-0">
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      <span className="min-w-0 text-right text-xs font-semibold break-words">{value}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/15" aria-label="Code d'accès">
            <KeyRound className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Sécurité — Code d'accès
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 rounded-xl border border-border bg-muted/40 p-3">
          <Row label="Téléphone enregistré" Icon={Smartphone} value={mask(data?.telephone || telephone)} />
          <Row label="E-mail rattaché" Icon={Mail} value={mask(email)} />
          <Row
            label="Code d'accès"
            Icon={configured ? CheckCircle2 : AlertCircle}
            value={
              !data ? "—" :
              locked ? <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">Verrouillé</Badge> :
              configured ? <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Configuré</Badge> :
              <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">À créer</Badge>
            }
          />
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground">
          Le portail utilise maintenant un code personnel à 4 chiffres. La création se fait lors de la première connexion ;
          la réinitialisation est effectuée par l'équipe habilitée depuis le CRM.
        </p>

        <Button variant="outline" size="sm" className="w-full" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default AccessCodePanel;
