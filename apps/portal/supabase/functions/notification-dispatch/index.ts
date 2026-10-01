import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { sendPushNotification, WebPushError } from "npm:@mmmike/web-push@1.3.0/send";

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") || "https://agricapital.ci,https://www.agricapital.ci,https://app.agricapital.ci,https://portail.agricapital.ci,http://localhost:5173,http://localhost:8080")
    .split(",").map((v) => v.trim()).filter(Boolean),
);
const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agricapital-automation-secret",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
});
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

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)
);

const render = (template: string, contact: Contact, context: Record<string, unknown> = {}) => {
  const fullName = contact.nom_complet || "Client";
  const firstName = fullName.split(/\s+/)[0] || "Client";
  const vars: Record<string, string> = {
    nom: fullName, nom_complet: fullName, prenom: firstName,
    email: contact.email || "", telephone: contact.telephone || "",
    role: contact.role_code || "", offre: contact.offre_nom || contact.offre_code || "",
    offre_code: contact.offre_code || "", date: new Date().toLocaleDateString("fr-FR"),
    ...Object.fromEntries(Object.entries(context).map(([k, v]) => [k, v == null ? "" : String(v)])),
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? "");
};

async function internalAuthorized(req: Request) {
  const expected = Deno.env.get("NOTIFICATION_CRON_SECRET");
  const supplied = req.headers.get("x-agricapital-automation-secret");
  if (supplied && supplied === serviceKey) return true;
  if (expected && supplied && supplied === expected) return true;
  if (!supplied) return false;
  const { data, error } = await admin.rpc("notification_get_internal_secret");
  return !error && data === supplied;
}

async function staffAuthorized(req: Request) {
  if (await internalAuthorized(req)) return true;
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const { data } = await admin.auth.getUser(auth.slice(7));
  if (!data.user) return false;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
  return (roles || []).some((r) => [
    "super_admin","directeur_tc","responsable_operations","responsable_commercial",
    "chef_equipe_commercial","chef_equipe_technique","service_client","chef_equipe_service_client","comptable"
  ].includes(r.role));
}

async function sendPushToOwner(owner: { user_id?: string | null; client_id?: string | null }, payload: { title: string; body: string; url?: string; tag?: string; dedupe_key?: string | null }) {
  const { data: vapid, error: vapidError } = await admin.rpc("notification_vapid_config");
  if (vapidError || !vapid?.public_key || !vapid?.private_key) {
    throw new Error("Configuration VAPID indisponible.");
  }
  const publicKey = vapid.public_key;
  const privateKey = vapid.private_key;
  const subject = vapid.subject || "mailto:contact@agricapital.ci";

  let query = admin.from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,content_encoding")
    .eq("active", true);

  if (owner.user_id) query = query.eq("user_id", owner.user_id);
  else if (owner.client_id) query = query.eq("client_id", owner.client_id);
  else return { delivered: 0, gone: 0, failed: 0, configured: true };

  const { data: subscriptions, error } = await query;
  if (error) throw error;

  let delivered = 0, gone = 0, failed = 0;
  const vapid = { publicKey, privateKey, subject };

  for (const sub of subscriptions || []) {
    try {
      const ok = await sendPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        {
          title: payload.title,
          body: payload.body,
          url: payload.url || "/",
          tag: payload.tag || payload.dedupe_key || "agricapital",
        },
        vapid,
        { ttl: 86400, urgency: "high" },
      );
      if (ok === false) {
        gone++;
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        delivered++;
        await admin.from("push_subscriptions").update({ last_seen_at: new Date().toISOString() }).eq("id", sub.id);
      }
    } catch (error) {
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        gone++;
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        failed++;
      }
    }
  }
  return { delivered, gone, failed, configured: true };
}

async function providerStatus() {
  const resend = Boolean(Deno.env.get("RESEND_API_KEY"));
  const brevo = Boolean(Deno.env.get("BREVO_API_KEY"));
  return {
    resend_email: resend, brevo_email: brevo,
    brevo_sms: brevo && Boolean(Deno.env.get("BREVO_SMS_SENDER")),
    whatsapp: Boolean(Deno.env.get("WHATSAPP_ACCESS_TOKEN")) && Boolean(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")),
    push: true,
    email_provider: resend ? "resend" : brevo ? "brevo" : null,
  };
}

async function sendEmail(contact: Contact, subject: string, content: string, dedupeKey: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "contact@agricapital.ci";
  const fromName = Deno.env.get("NOTIFICATION_FROM_NAME") || "AgriCapital";
  if (!contact.email) throw new Error("Email absent");
  const html = /<[^>]+>/.test(content) ? content : "<p>" + escapeHtml(content).replace(/\n/g, "<br />") + "</p>";

  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json", "Idempotency-Key": dedupeKey },
      body: JSON.stringify({ from: fromName + " <" + fromEmail + ">", to: [contact.email], subject, html }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || "Resend HTTP " + response.status);
    return { provider: "resend", messageId: payload?.id || null };
  }

  if (brevoKey) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: contact.email, name: contact.nom_complet || undefined }],
        subject, htmlContent: html, textContent: content.replace(/<[^>]*>/g, " "),
        tags: ["agricapital", "notification"],
        headers: { "Idempotency-Key": dedupeKey },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || "Brevo HTTP " + response.status);
    return { provider: "brevo", messageId: payload?.messageId || null };
  }
  throw new Error("Aucun fournisseur email configure");
}

async function sendSms(contact: Contact, content: string, dedupeKey: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SMS_SENDER") || "AgriCapital";
  if (!key) throw new Error("BREVO_API_KEY absent");
  if (!contact.telephone) throw new Error("Telephone absent");
  const recipient = contact.telephone.replace(/[^0-9+]/g, "");
  const message = normalizeSms(content);
  if (!message) throw new Error("SMS vide apres normalisation");
  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/send", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ sender, recipient, content: message, type: "transactional", unicodeEnabled: false,
      tag: ["agricapital", "notification", dedupeKey.slice(0, 40)] }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Brevo SMS HTTP " + response.status);
  return { provider: "brevo", messageId: payload?.messageId || null, content: message };
}

async function sendWhatsApp(contact: Contact, content: string, dedupeKey: string) {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const version = Deno.env.get("WHATSAPP_API_VERSION") || "v23.0";
  if (!token || !phoneNumberId) throw new Error("WhatsApp Cloud API non configure");
  const recipient = (contact.whatsapp || contact.telephone || "").replace(/[^0-9]/g, "");
  if (!recipient) throw new Error("Numero WhatsApp invalide");
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
  const language = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "fr";
  const body = templateName
    ? {
        messaging_product: "whatsapp", to: recipient, type: "template",
        template: {
          name: templateName, language: { code: language },
          components: [{ type: "body", parameters: [{ type: "text", text: content.slice(0, 1024) }] }],
        },
      }
    : {
        messaging_product: "whatsapp", to: recipient, type: "text",
        text: { preview_url: false, body: content.slice(0, 4096) },
      };
  const response = await fetch("https://graph.facebook.com/" + version + "/" + phoneNumberId + "/messages", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "WhatsApp HTTP " + response.status);
  return { provider: "whatsapp_cloud", messageId: payload?.messages?.[0]?.id || null };
}

async function resolveContacts(criteria: Record<string, unknown>) {
  const { data, error } = await admin.rpc("notification_resolve_recipients", { _criteres: criteria });
  if (error) throw error;
  const map = new Map<string, Contact>();
  for (const row of (data || []) as Contact[]) {
    const key = row.user_id || row.email?.toLowerCase() || row.telephone || row.source_type + ":" + row.source_id;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

async function deliver(args: {
  campaignId?: string | null; automationId?: string | null; canal: string;
  subject?: string | null; content: string; contacts: Contact[];
  context?: Record<string, unknown>; eventKey?: string;
}) {
  let sent = 0, failed = 0;
  for (const contact of args.contacts) {
    const primaryAutoChannel = (() => {
      if (args.canal !== "auto") return null;
      const phone = (contact.telephone || contact.whatsapp || "").replace(/\s+/g, "");
      const digits = phone.replace(/[^0-9]/g, "");
      return phone.startsWith("+225") || phone.startsWith("225") || /^0\d{9}$/.test(phone) || digits.startsWith("225") ? "sms" : "whatsapp";
    })();
    const channels = args.canal === "email_sms"
      ? ["email", "sms"]
      : args.canal === "auto"
        ? [primaryAutoChannel || "email", "email"]
        : [args.canal];
    for (const channel of [...new Set(channels)]) {
      if (channel === "app" && !contact.user_id) continue;
      const dedupeKey = (args.campaignId || args.automationId || "manual") + ":" +
        (args.eventKey || "") + ":" + (contact.user_id || contact.source_id) + ":" + channel;
      const { data: existing } = await admin.from("notification_deliveries")
        .select("id,statut").eq("dedupe_key", dedupeKey).maybeSingle();
      if (existing?.statut === "envoye" || existing?.statut === "livre") continue;

      const rendered = render(args.content, contact, args.context || {});
      const renderedSubject = render(args.subject || "Information AgriCapital", contact, args.context || {});
      const { data: delivery, error: insertError } = await admin.from("notification_deliveries").upsert({
        campaign_id: args.campaignId || null, automation_id: args.automationId || null,
        user_id: contact.user_id || null, source_type: contact.source_type, source_id: contact.source_id,
        recipient_name: contact.nom_complet || null, recipient_email: contact.email || null,
        recipient_phone: contact.telephone || null, canal: channel, statut: "en_attente",
        contenu: channel === "sms" ? normalizeSms(rendered) : rendered, dedupe_key: dedupeKey,
        metadata: { event_key: args.eventKey || null },
      }, { onConflict: "dedupe_key" }).select("id").single();
      if (insertError) { failed++; continue; }

      try {
        if (channel === "app") {
          if (!contact.user_id) throw new Error("Destinataire app sans user_id");
          const { error } = await admin.from("notifications").insert({
            user_id: contact.user_id, type: "communication", title: renderedSubject,
            message: rendered, data: { campaign_id: args.campaignId, automation_id: args.automationId, dedupe_key: dedupeKey }, dedupe_key: dedupeKey,
          });
          if (error) throw error;
          await admin.from("notification_deliveries").update({ statut: "envoye", sent_at: new Date().toISOString() }).eq("id", delivery.id);
        } else if (channel === "email") {
          const result = await sendEmail(contact, renderedSubject, rendered, dedupeKey);
          await admin.from("notification_deliveries").update({
            statut: "envoye", fournisseur: result.provider, provider_message_id: result.messageId, sent_at: new Date().toISOString(),
          }).eq("id", delivery.id);
        } else if (channel === "whatsapp") {
          const result = await sendWhatsApp(contact, rendered, dedupeKey);
          await admin.from("notification_deliveries").update({
            statut: "envoye", fournisseur: result.provider, provider_message_id: result.messageId, sent_at: new Date().toISOString(),
          }).eq("id", delivery.id);
        } else {
          const result = await sendSms(contact, rendered, dedupeKey);
          await admin.from("notification_deliveries").update({
            statut: "envoye", fournisseur: result.provider, provider_message_id: String(result.messageId || ""),
            contenu: result.content, sent_at: new Date().toISOString(),
          }).eq("id", delivery.id);
        }
        sent++;
        if (args.canal === "auto") break;
      } catch (error) {
        failed++;
        await admin.from("notification_deliveries").update({
          statut: "echoue", erreur: error instanceof Error ? error.message : String(error),
        }).eq("id", delivery.id);
      }
    }
  }
  return { sent, failed };
}

async function runCampaign(campaignId: string) {
  const { data: campaign, error } = await admin.from("notification_campaigns")
    .select("*, segment:notification_segments(criteres)").eq("id", campaignId).single();
  if (error) throw error;
  if (["annule","termine"].includes(campaign.statut)) return { skipped: true, reason: campaign.statut };
  if (campaign.programme_le && new Date(campaign.programme_le).getTime() > Date.now()) return { skipped: true, reason: "programme" };

  const criteria = campaign.segment?.criteres || campaign.criteres || {};
  const contacts = await resolveContacts(criteria);
  await admin.from("notification_campaigns").update({
    statut: "en_cours", demarre_le: new Date().toISOString(), total_destinataires: contacts.length,
  }).eq("id", campaign.id);
  const result = await deliver({
    campaignId: campaign.id, canal: campaign.canal, subject: campaign.sujet,
    content: campaign.contenu, contacts,
  });
  await admin.from("notification_campaigns").update({
    statut: result.failed ? (result.sent ? "partiel" : "echoue") : "termine",
    total_envoyes: result.sent, total_echecs: result.failed, termine_le: new Date().toISOString(),
  }).eq("id", campaign.id);
  return { campaign_id: campaign.id, contacts: contacts.length, ...result };
}

async function runEvent(eventCode: string, context: Record<string, unknown>) {
  if (eventCode === "plantation_activee") {
    const clientId = String(context.client_id || "");
    const plantationId = String(context.plantation_id || "");
    if (!clientId || !plantationId) return [];
    const dedupeKey = `plantation_activee:${clientId}:${plantationId}`;
    const title = "Plantation activée";
    const body = `Votre plantation de ${Number(context.surface || 0).toLocaleString("fr-FR")} ha est activée. ${context.village ? `Localisation : ${context.village}.` : ""}`;
    const { data: notification, error } = await admin.from("portail_notifications").upsert({
      client_id: clientId,
      type: "plantation_activee",
      title,
      message: body,
      data: { plantation_id: plantationId, parcelle_id: context.parcelle_id || null, route: "/client/plantations" },
      dedupe_key: dedupeKey,
    }, { onConflict: "dedupe_key" }).select("id,client_id,title,message,dedupe_key,data").single();
    if (error) throw error;
    return [{ event: eventCode, portal_notification_id: notification.id, dedupe_key: dedupeKey }];
  }

  if (eventCode === "notification_push") {
    const notificationId = String(context.notification_id || "");
    if (!notificationId) return [];
    const { data: notification } = await admin.from("notifications")
      .select("id,user_id,title,message,dedupe_key,data").eq("id", notificationId).maybeSingle();
    if (!notification) return [];
    const result = await sendPushToOwner(
      { user_id: notification.user_id },
      {
        title: notification.title,
        body: notification.message,
        url: notification.data?.route || "/",
        tag: notification.dedupe_key || notification.id,
        dedupe_key: notification.dedupe_key || notification.id,
      },
    );
    return [{ event: eventCode, notification_id: notification.id, ...result }];
  }

  if (eventCode === "portail_notification_push") {
    const portalNotificationId = String(context.portal_notification_id || "");
    if (!portalNotificationId) return [];
    const { data: notification } = await admin.from("portail_notifications")
      .select("id,client_id,title,message,dedupe_key,data").eq("id", portalNotificationId).maybeSingle();
    if (!notification) return [];
    const result = await sendPushToOwner(
      { client_id: notification.client_id },
      {
        title: notification.title,
        body: notification.message,
        url: notification.data?.route || "/",
        tag: notification.dedupe_key || notification.id,
        dedupe_key: notification.dedupe_key || notification.id,
      },
    );
    return [{ event: eventCode, portal_notification_id: notification.id, ...result }];
  }
  const { data: automations, error } = await admin.from("notification_automations")
    .select("*").eq("evenement", eventCode).eq("actif", true);
  if (error) throw error;
  const results = [];
  for (const automation of automations || []) {
    let contacts = await resolveContacts(automation.criteres || {});
    if (context.client_id) {
      contacts = contacts.filter((c) => c.source_id === context.client_id && c.source_type === "client");
    }
    if (context.proprietaire_id) {
      contacts = contacts.filter((c) => c.source_id === context.proprietaire_id && c.source_type === "proprietaire_foncier");
    }
    if (context.user_id) contacts = contacts.filter((c) => c.user_id === context.user_id);
    const result = await deliver({
      automationId: automation.id, canal: automation.canal, subject: automation.sujet,
      content: automation.contenu, contacts, context,
      eventKey: eventCode + ":" + (context.paiement_id || context.client_id || context.proprietaire_id || context.user_id || "global"),
    });
    await admin.from("notification_automations").update({ derniere_execution_at: new Date().toISOString() }).eq("id", automation.id);
    results.push({ automation_id: automation.id, ...result });
  }
  return results;
}

async function runScheduledAutomations() {
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const results = [];

  // Les rappels sont ciblés par client et par échéance : aucun envoi massif à toute la base.
  const { data: duePayments, error: dueError } = await admin.from("paiements")
    .select("id,client_id,montant,date_echeance,statut")
    .eq("type_paiement", "REDEVANCE")
    .neq("statut", "valide")
    .gte("date_echeance", now.toISOString().slice(0, 10))
    .lte("date_echeance", inThreeDays.toISOString().slice(0, 10))
    .limit(500);
  if (dueError) throw dueError;

  for (const paiement of duePayments || []) {
    results.push(await runEvent("paiement_echeance", {
      client_id: paiement.client_id,
      paiement_id: paiement.id,
      montant: paiement.montant,
      date_echeance: paiement.date_echeance,
    }));
  }

  const { data: overduePayments, error: overdueError } = await admin.from("paiements")
    .select("id,client_id,montant,date_echeance,statut")
    .eq("type_paiement", "REDEVANCE")
    .neq("statut", "valide")
    .lt("date_echeance", now.toISOString().slice(0, 10))
    .limit(500);
  if (overdueError) throw overdueError;

  for (const paiement of overduePayments || []) {
    results.push(await runEvent("paiement_retard", {
      client_id: paiement.client_id,
      paiement_id: paiement.id,
      montant: paiement.montant,
      date_echeance: paiement.date_echeance,
    }));
  }

  const { data: scheduled } = await admin.from("notification_campaigns").select("id")
    .eq("statut", "programme").lte("programme_le", now.toISOString()).limit(20);
  for (const campaign of scheduled || []) results.push(await runCampaign(campaign.id));

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "status";
    if (mode === "run_automations") {
      if (!(await internalAuthorized(req))) return json(req, { error: "Non autorise" }, 401);
      return json(req, { ok: true, results: await runScheduledAutomations() });
    }
    if (!(await staffAuthorized(req))) return json(req, { error: "Non autorise" }, 401);
    if (mode === "status") return json(req, { ok: true, providers: await providerStatus() });
    if (mode === "preview") {
      const contacts = await resolveContacts(body.criteria || {});
      return json(req, { ok: true, count: contacts.length, sample: contacts.slice(0,20).map((c) => ({
        nom_complet:c.nom_complet,email:c.email,telephone:c.telephone,offre_nom:c.offre_nom,role_code:c.role_code
      }))});
    }
    if (mode === "event") {
      if (!body.event_code) return json(req, { error: "event_code requis" }, 400);
      return json(req, { ok: true, results: await runEvent(body.event_code, body.context || {}) });
    }
    if (mode === "campaign") {
      if (!body.campaign_id) return json(req, { error: "campaign_id requis" }, 400);
      return json(req, { ok: true, result: await runCampaign(body.campaign_id) });
    }
    return json(req, { error: "Mode non reconnu" }, 400);
  } catch (error) {
    console.error("notification-dispatch error", error);
    return json(req, { error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
