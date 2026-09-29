import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send, Loader2, Headphones } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function ClientMessagingPanel({ clientId, plantationId }: { clientId: string; plantationId?: string | null }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    const { data, error } = await (supabase as any).from("portail_messages")
      .select("id,client_id,plantation_id,auteur_user_id,auteur_type,auteur_nom,message,lu,created_at")
      .eq("client_id", clientId).order("created_at", { ascending: true });
    if (!error) {
      setMessages(data || []);
      const unread = (data || []).filter((m: any) => m.auteur_type === "client" && !m.lu).map((m: any) => m.id);
      if (unread.length) await (supabase as any).from("portail_messages").update({ lu: true }).in("id", unread);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
    const channel = supabase.channel(`crm-client-messages-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "portail_messages", filter: `client_id=eq.${clientId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, load]);

  const send = async () => {
    const message = draft.trim();
    if (!message) return;
    setSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Session CRM introuvable.");
      const { data: profile } = await (supabase as any).from("profiles").select("nom_complet").eq("user_id", userId).maybeSingle();
      const { error } = await (supabase as any).from("portail_messages").insert({
        client_id: clientId, plantation_id: plantationId || null, auteur_user_id: userId,
        auteur_type: "staff", auteur_nom: profile?.nom_complet || "AgriCapital", message, lu: false,
      });
      if (error) throw error;
      setDraft("");
      await load();
    } finally { setSending(false); }
  };

  const visible = messages.filter((m) => !plantationId || !m.plantation_id || m.plantation_id === plantationId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Messagerie client</CardTitle>
        <p className="text-sm text-muted-foreground">Échange direct avec le client depuis son dossier CRM.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[500px] min-h-[260px] overflow-y-auto rounded-xl bg-muted/20 p-4 space-y-3">
          {loading ? <div className="h-40 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> :
            visible.length === 0 ? <div className="h-40 flex flex-col items-center justify-center text-center"><Headphones className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="font-medium">Aucun message</p><p className="text-xs text-muted-foreground">Envoyez le premier message au client.</p></div> :
            visible.map((m: any) => {
              const mine = m.auteur_type !== "client";
              return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                  <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-semibold">{mine ? (m.auteur_nom || "AgriCapital") : (m.auteur_nom || "Client")}</span><Badge variant="outline" className="text-[8px] h-4">{mine ? "Équipe" : "Client"}</Badge></div>
                  <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  <p className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{new Date(m.created_at).toLocaleString("fr-FR")}</p>
                </div>
              </div>;
            })}
        </div>
        <div className="flex gap-2">
          <Textarea value={draft} maxLength={4000} rows={3} placeholder="Répondre au client…" onChange={(e) => setDraft(e.target.value)} disabled={sending} />
          <Button onClick={send} disabled={sending || !draft.trim()} className="self-end">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
