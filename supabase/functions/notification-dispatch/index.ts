import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agricapital-automation-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey);

type Contact = {
  source_type: string; source_id: string; user_id?: string | null;
  nom_complet?: string | null; email?: string | null; telephone?: string | null; whatsapp?: string | null;
  role_code?: string | null; offre_id?: string | null; offre_code?: string | null; offre_nom?: string | null;
};

const normalizeSms = (value: string) => value.normalize("NFD")
  .replace(/\p{Diacritic}/gu, "").replace(/[^\x20-\x7E]/g, "")
  .replace(/\s+/g, " ").trim().slice(0, 150);

const render = (template: string, contact: Contact, context: Record<string, unknown> = {}) => {
  const name = contact.nom_complet || "Client";
  const vars: Record<string, string> = {
    nom: name, nom_complet: name, prenom: name.split(/\s+/)[0] || "Client",
    email: contact.email || "", telephone: contact.telephone || "", whatsapp: contact.whatsapp || "",
    role: contact.role_code || "", offre: contact.offre_nom || contact.offre_code || "",
    offre_code: contact.offre_code || "", date: new Date().toLocaleDateString("fr-FR"),
    ...Object.fromEntries(Object.entries(context).map(([k, v]) => [k, v == null ? "" : String(v)])),
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? "");
};

const html = (text: string) => text.replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)
).replace(/\n/g, "<br />");

const isCiNumber = (value?: string | null) => {
  const digits = (value || "").replace(/\D/g, "");
  return digits.startsWith("225") || digits.startsWith("00225") || digits.startsWith("0");
};

const toE164 = (value?: string | null) => {
  const raw = (value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00225")) return "+" + digits.slice(2);
  if (digits.startsWith("225")) return "+" + digits;
  if (digits.startsWith("0")) return "+225" + digits.slice(1);
  return "+" + digits;
};

async function authorized(req: Request) {
  const internal = req.headers.get("x-agricapital-automation-secret");
  const expected = Deno.env.get("NOTIFICATION_CRON_SECRET");
  if (internal && (internal === expected || internal === serviceKey)) return true;
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return false;
  const { data } = await admin.auth.getUser(bearer);
  if (!data.user) return false;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
  return (roles || []).some((r) => ["super_admin","admin","directeur_tc","directeur_technico_commercial","responsable_operations","responsable_commercial","chef_equipe_commercial","service_client","chef_equipe_service_client","comptable"].includes(r.role));
}

async function sendEmail(contact: Contact, subject: string, body: string, key: string) {
  if (!contact.email) throw new Error("Email absent");
  const from = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "notification@agricapital.ci";
  const name = Deno.env.get("NOTIFICATION_FROM_NAME") || "AgriCapital";
  const resend = Deno.env.get("RESEND_API_KEY");
  const brevo = Deno.env.get("BREVO_API_KEY");

  if (resend) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resend, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ from: name + " <" + from + ">", to: [contact.email], subject, html: /<[^>]+>/.test(body) ? body : html(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || "Resend HTTP " + response.status);
    return { provider: "resend", messageId: data?.id || null };
  }
  if (brevo) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevo, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: { name, email: from }, to: [{ email: contact.email, name: contact.nom_complet || undefined }], subject, htmlContent: /<[^>]+>/.test(body) ? body : html(body), textContent: body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || "Brevo email HTTP " + response.status);
    return { provider: "brevo", messageId: data?.messageId || null };
  }
  throw new Error("Aucun fournisseur email configuré");
}

async function sendSms(contact: Contact, body: string, key: string) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY absent");
  const recipient = toE164(contact.telephone || contact.whatsapp);
  if (!recipient) throw new Error("Téléphone absent");
  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/send", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: Deno.env.get("BREVO_SMS_SENDER") || "AgriCapital",
      recipient, content: normalizeSms(body), type: "transactional", unicodeEnabled: false,
      tag: ["AgriCapital", key.slice(0, 30)],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Brevo SMS HTTP " + response.status);
  return { provider: "brevo", messageId: data?.messageId || null };
}

async function sendWhatsApp(contact: Contact, body: string, key: string) {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || Deno.env.get("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) throw new Error("WhatsApp Cloud API non configurée");
  const recipient = toE164(contact.whatsapp || contact.telephone).replace("+", "");
  if (!recipient) throw new Error("Numéro WhatsApp absent");

  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
  const language = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "fr";
  const payload = templateName ? {
    messaging_product: "whatsapp", to: recipient, type: "template",
    template: { name: templateName, language: { code: language }, components: [] },
  } : {
    messaging_product: "whatsapp", to: recipient, type: "text", text: { preview_url: false, body },
  };
  const version = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v23.0";
  const response = await fetch("https://graph.facebook.com/" + version + "/" + phoneId + "/messages", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "WhatsApp HTTP " + response.status);
  return { provider: "whatsapp-cloud", messageId: data?.messages?.[0]?.id || key };
}

async function contacts(criteria: Record<string, unknown>) {
  const { data, error } = await admin.rpc("notification_resolve_recipients", { _criteres: criteria });
  if (error) throw error;
  const seen = new Set<string>();
  return ((data || []) as Contact[]).filter((c) => {
    const key = c.user_id || c.email?.toLowerCase() || c.telephone || c.whatsapp || c.source_id;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}

async function recordDelivery(args: any) {
  const { data, error } = await admin.from("notification_deliveries").upsert({
    campaign_id: args.campaignId || null, automation_id: args.automationId || null,
    user_id: args.contact.user_id || null, source_type: args.contact.source_type, source_id: args.contact.source_id,
    recipient_name: args.contact.nom_complet || null, recipient_email: args.contact.email || null,
    recipient_phone: args.contact.telephone || args.contact.whatsapp || null, canal: args.channel,
    statut: "en_attente", contenu: args.body, dedupe_key: args.key,
    metadata: { fallback: args.fallback || false, event: args.eventKey || null },
  }, { onConflict: "dedupe_key" }).select("id").single();
  if (error) throw error;
  return data;
}

async function deliverPrimary(contact: Contact, channel: string, subject: string, body: string, key: string, campaignId?: string, automationId?: string, eventKey?: string) {
  const delivery = await recordDelivery({ contact, channel, body, key, campaignId, automationId, eventKey });
  try {
    let result: any;
    if (channel === "app") {
      if (!contact.user_id) throw new Error("Destinataire app sans user_id");
      const { error } = await admin.from("notifications").insert({ user_id: contact.user_id, type: "communication", title: subject, message: body, data: { event: eventKey || null } });
      if (error) throw error;
      result = { provider: "supabase", messageId: delivery.id };
    } else if (channel === "email") result = await sendEmail(contact, subject, body, key);
    else if (channel === "sms") result = await sendSms(contact, body, key);
    else result = await sendWhatsApp(contact, body, key);

    await admin.from("notification_deliveries").update({ statut: "envoye", fournisseur: result.provider, provider_message_id: String(result.messageId || ""), sent_at: new Date().toISOString() }).eq("id", delivery.id);
    return { ok: true, channel, result };
  } catch (error) {
    await admin.from("notification_deliveries").update({ statut: "echoue", erreur: error instanceof Error ? error.message : String(error) }).eq("id", delivery.id);
    return { ok: false, channel, error: error instanceof Error ? error.message : String(error) };
  }
}

async function deliver(contact: Contact, channel: string, subject: string, body: string, key: string, meta: { campaignId?: string; automationId?: string; eventKey?: string } = {}) {
  const preferred = channel === "auto"
    ? (isCiNumber(contact.telephone || contact.whatsapp) ? "sms" : "whatsapp")
    : channel;
  const primary = await deliverPrimary(contact, preferred, subject, body, key + ":" + preferred, meta.campaignId, meta.automationId, meta.eventKey);
  if (primary.ok) return { sent: 1, failed: 0, primary };

  if (contact.email) {
    const fallback = await deliverPrimary(contact, "email", subject, body, key + ":email", meta.campaignId, meta.automationId, meta.eventKey);
    return { sent: fallback.ok ? 1 : 0, failed: fallback.ok ? 0 : 1, primary, fallback };
  }
  return { sent: 0, failed: 1, primary };
}

async function runEvent(eventCode: string, context: Record<string, unknown>) {
  const { data, error } = await admin.from("notification_automations").select("*").eq("evenement", eventCode).eq("actif", true);
  if (error) throw error;
  const results = [];
  for (const automation of data || []) {
    let list = await contacts(automation.criteres || {});
    if (context.souscripteur_id) list = list.filter((c) => c.source_id === context.souscripteur_id && c.source_type === "client");
    if (context.user_id) list = list.filter((c) => c.user_id === context.user_id);
    for (const contact of list) {
      const subject = render(automation.sujet || "Information AgriCapital", contact, context);
      const body = render(automation.contenu, contact, context);
      results.push(await deliver(contact, automation.canal, subject, body,
        automation.id + ":" + eventCode + ":" + (context.paiement_id || context.account_request_id || context.user_id || contact.source_id),
        { automationId: automation.id, eventKey: eventCode }));
    }
    await admin.from("notification_automations").update({ derniere_execution_at: new Date().toISOString() }).eq("id", automation.id);
  }
  return results;
}

async function runCampaign(id: string) {
  const { data: campaign, error } = await admin.from("notification_campaigns").select("*").eq("id", id).single();
  if (error) throw error;
  const list = await contacts(campaign.criteres || {});
  let sent = 0, failed = 0;
  for (const contact of list) {
    const body = render(campaign.contenu, contact);
    const subject = render(campaign.sujet || "Information AgriCapital", contact);
    const result = await deliver(contact, campaign.canal, subject, body, campaign.id + ":" + contact.source_id, { campaignId: campaign.id });
    sent += result.sent; failed += result.failed;
  }
  await admin.from("notification_campaigns").update({ statut: failed ? (sent ? "partiel" : "echoue") : "termine", total_destinataires: list.length, total_envoyes: sent, total_echecs: failed, termine_le: new Date().toISOString() }).eq("id", id);
  return { campaign_id: id, contacts: list.length, sent, failed };
}

async function runScheduled() {
  const today = new Date().toISOString().slice(0,10);
  const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10);
  const { data: autos } = await admin.from("notification_automations").select("*").eq("actif", true).in("evenement", ["paiement_echeance","paiement_retard"]);
  const results = [];
  for (const automation of autos || []) {
    if (automation.derniere_execution_at && Date.now() - new Date(automation.derniere_execution_at).getTime() < automation.cooldown_minutes * 60000) continue;
    const { data: rows } = automation.evenement === "paiement_retard"
      ? await admin.from("souscripteurs").select("id").gt("jours_retard", 0).eq("compte_actif", true).limit(1000)
      : await admin.from("souscripteurs").select("id").gte("prochaine_echeance", today).lte("prochaine_echeance", inThreeDays).eq("compte_actif", true).limit(1000);
    const ids = new Set((rows || []).map((r: any) => r.id));
    const list = (await contacts(automation.criteres || {})).filter((c) => c.source_type === "client" && ids.has(c.source_id));
    for (const contact of list) {
      const body = render(automation.contenu, contact, { date_echeance: automation.evenement === "paiement_echeance" ? inThreeDays : today });
      const subject = render(automation.sujet || "Information AgriCapital", contact);
      results.push(await deliver(contact, automation.canal, subject, body, automation.id + ":" + automation.evenement + ":" + today + ":" + contact.source_id, { automationId: automation.id, eventKey: automation.evenement }));
    }
    await admin.from("notification_automations").update({ derniere_execution_at: new Date().toISOString() }).eq("id", automation.id);
  }
  const { data: campaigns } = await admin.from("notification_campaigns").select("id").eq("statut","programme").lte("programme_le",new Date().toISOString()).limit(20);
  for (const campaign of campaigns || []) results.push(await runCampaign(campaign.id));
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "status";
    if (mode === "run_automations") {
      if (!(await authorized(req))) return json({ error: "Non autorisé" }, 401);
      return json({ ok: true, results: await runScheduled() });
    }
    if (!(await authorized(req))) return json({ error: "Non autorisé" }, 401);
    if (mode === "status") return json({ ok: true, providers: {
      resend_email: Boolean(Deno.env.get("RESEND_API_KEY")),
      brevo_email: Boolean(Deno.env.get("BREVO_API_KEY")),
      brevo_sms: Boolean(Deno.env.get("BREVO_API_KEY") && (Deno.env.get("BREVO_SMS_SENDER") || "AgriCapital")),
      whatsapp: Boolean(Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_TOKEN")),
      sender_id: Deno.env.get("BREVO_SMS_SENDER") || "AgriCapital",
      from_email: Deno.env.get("NOTIFICATION_FROM_EMAIL") || "notification@agricapital.ci",
    }});
    if (mode === "preview") {
      const list = await contacts(body.criteria || {});
      return json({ ok: true, count: list.length, sample: list.slice(0,20).map((c) => ({ nom_complet:c.nom_complet,email:c.email,telephone:c.telephone,whatsapp:c.whatsapp,offre_nom:c.offre_nom,offre_code:c.offre_code })) });
    }
    if (mode === "event") return json({ ok: true, result: await runEvent(body.event_code, body.context || {}) });
    if (mode === "campaign") return json({ ok: true, result: await runCampaign(body.campaign_id) });
    return json({ error: "Mode inconnu" }, 400);
  } catch (error) {
    console.error("notification-dispatch error", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
