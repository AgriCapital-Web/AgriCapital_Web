import { useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; initialPhone?: string; };

export default function PortalAccessSupportDialog({ open, onOpenChange, initialPhone = "" }: Props) {
  const { toast } = useToast();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState(initialPhone);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const formatPhone = (value: string) => value.replace(/\D/g, "").slice(0, 10).replace(/(\d{2})(?=\d)/g, "$1 ").trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nom.trim().length < 2 || telephone.replace(/\D/g, "").length < 8 || message.trim().length < 5) {
      toast({ variant: "destructive", title: "Informations incomplètes", description: "Veuillez renseigner votre nom, le numéro utilisé lors de votre contractualisation et votre problème." });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-contact-support", {
        body: { nom_complet: nom.trim(), telephone, message: message.trim() },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Impossible d'envoyer votre demande.");
      onOpenChange(false);
      setMessage("");
      toast({ title: "Demande transmise", description: "Votre demande a été envoyée à l'équipe AgriCapital." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Demande non envoyée", description: e.message || "Impossible d'envoyer votre demande." });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-[#00643C]" />
            Contacter AgriCapital
          </DialogTitle>
          <p className="text-sm text-[#5A6660]">
            Votre demande sera transmise directement à l'équipe dans la messagerie CRM.
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Nom et prénom</label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. KOUASSI Jean" className="h-12 rounded-xl" required />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Numéro utilisé lors de la contractualisation</label>
            <Input type="tel" inputMode="numeric" value={formatPhone(telephone)} onChange={(e) => setTelephone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="07 00 00 00 00" className="h-12 rounded-xl" required />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Objet</label>
            <Input value="Espace client inaccessible" readOnly className="h-12 rounded-xl bg-[#F5F7F5] font-medium" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider">Votre message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={5} required placeholder="Décrivez le problème rencontré…" className="w-full rounded-xl border border-[#E5E7E3] bg-white px-3 py-3 text-sm outline-none focus:border-[#00643C] focus:ring-2 focus:ring-[#00643C]/15" />
          </div>
          <Button type="submit" disabled={sending} className="w-full h-12 rounded-xl bg-[#00643C] hover:bg-[#004D2E] text-white font-semibold">
            {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi…</> : <><Send className="mr-2 h-4 w-4" /> Envoyer à l'équipe</>}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}