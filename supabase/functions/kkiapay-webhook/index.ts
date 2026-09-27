import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-kkiapay-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getStatus = async (transactionId: string) => {
  const privateKey = Deno.env.get("KKIAPAY_PRIVATE_KEY");
  if (!privateKey) throw new Error("KKIAPAY_PRIVATE_KEY non configure");
  const response = await fetch("https://api.kkiapay.me/api/v1/transactions/status", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-private-key": privateKey },
    body: JSON.stringify({ transactionId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Verification KKiaPay impossible");
  return payload;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Methode non autorisee" }, 405);

  try {
    const body = await req.json();
    const transactionId = String(body?.transactionId || body?.transaction_id || "").trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(transactionId)) {
      return json({ success: false, error: "Transaction invalide" }, 400);
    }

    // Le webhook ne fait jamais confiance au statut transmis par le navigateur/provider.
    // La transaction est relue directement chez KKiaPay avec la clé privée serveur.
    const transaction = await getStatus(transactionId);
    const status = String(transaction?.status || "").toUpperCase();

    // FAILED, PENDING, CANCELLED et tout statut inconnu sont acknowledges mais ne modifient rien.
    if (status !== "SUCCESS") {
      return json({ success: true, ignored: true, status });
    }

    const providerAmount = Number(transaction?.amount);
    if (!Number.isFinite(providerAmount) || providerAmount <= 0) {
      return json({ success: false, error: "Montant fournisseur invalide" }, 422);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const sourceIp = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 120);
    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recent } = await admin.from("rate_limits").select("*", { count: "exact", head: true })
      .eq("identifier", sourceIp).eq("action", "kkiapay_webhook").gt("first_attempt_at", since);
    if ((recent || 0) >= 120) return json({ success: false, error: "Trop de requêtes" }, 429);
    await admin.from("rate_limits").insert({ identifier: sourceIp, action: "kkiapay_webhook" });

    // Le webhook doit retrouver le paiement par transaction, reference ou paiement_id.
    let payment: any = null;
    const reference = body?.data?.reference ?? body?.reference ?? null;
    const paiementId = body?.data?.paiement_id ?? body?.paiement_id ?? null;

    if (paiementId) {
      const { data } = await admin.from("paiements").select("*").eq("id", paiementId).maybeSingle();
      payment = data;
    }
    if (!payment && reference) {
      const { data } = await admin.from("paiements").select("*").eq("reference", reference).maybeSingle();
      payment = data;
    }
    if (!payment) {
      const { data } = await admin.from("paiements").select("*").eq("kkiapay_transaction_id", transactionId).maybeSingle();
      payment = data;
    }
    if (!payment) {
      const { data } = await admin.from("paiements")
        .select("*")
        .contains("metadata", { kkiapay_transaction_id: transactionId })
        .maybeSingle();
      payment = data;
    }

    // Toujours journaliser le webhook valide, meme lorsqu'aucun paiement local n'est encore retrouve.
    const { data: existingEvent } = await admin.from("kkiapay_events")
      .select("id,processed").eq("transaction_id", transactionId).eq("status", "SUCCESS").maybeSingle();
    if (existingEvent?.processed && payment) {
      return json({ success: true, already_processed: true, paiement_id: payment.id });
    }

    if (!payment) {
      await admin.from("kkiapay_events").insert({
        transaction_id: transactionId,
        reference,
        status: "SUCCESS",
        amount: providerAmount,
        fees: Number(transaction?.fees || 0),
        source: transaction?.source || "kkiapay",
        signature_valid: true,
        raw_payload: body,
        processed: false,
      });
      return json({ success: true, acknowledged: true, matched: false });
    }

    const expectedAmount = Number(payment.montant || 0);
    if (!Number.isFinite(expectedAmount) || providerAmount + 0.01 < expectedAmount) {
      await admin.from("kkiapay_events").insert({
        transaction_id: transactionId,
        reference: payment.reference,
        paiement_id: payment.id,
        status: "SUCCESS",
        amount: providerAmount,
        fees: Number(transaction?.fees || 0),
        source: transaction?.source || "kkiapay",
        signature_valid: true,
        raw_payload: body,
        processed: false,
      });
      return json({ success: false, error: "Montant de transaction insuffisant" }, 409);
    }

    // Point unique de vérité métier: cette RPC ne passe le paiement à valide
    // qu'après confirmation SUCCESS et contrôle du montant.
    const { data: finalized, error: finalizeError } = await admin.rpc("finalize_portal_payment", {
      _paiement_id: payment.id,
      _transaction_id: transactionId,
      _provider_amount: providerAmount,
      _metadata: {
        kkiapay_transaction_id: transactionId,
        kkiapay_status: "SUCCESS",
        kkiapay_method: transaction?.source || null,
        kkiapay_fees: Number(transaction?.fees || 0),
        webhook_received_at: new Date().toISOString(),
      },
      _validated_at: new Date().toISOString(),
    });
    if (finalizeError) throw finalizeError;

    await admin.from("kkiapay_events").insert({
      transaction_id: transactionId,
      reference: payment.reference,
      paiement_id: payment.id,
      status: "SUCCESS",
      amount: providerAmount,
      fees: Number(transaction?.fees || 0),
      source: transaction?.source || "kkiapay",
      signature_valid: true,
      raw_payload: body,
      processed: true,
      processed_at: new Date().toISOString(),
    });

    // Declenche les notifications configurees uniquement apres confirmation SUCCESS.
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notification-dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          mode: "event",
          event_code: "paiement_recu",
          context: {
            paiement_id: payment.id,
            client_id: payment.client_id,
            montant: providerAmount,
            reference: payment.reference,
            transaction_id: transactionId,
          },
        }),
      });
    } catch (notificationError) {
      console.error("Notification paiement non declenchee", notificationError);
    }

    await admin.from("historique_activites").insert({
      table_name: "paiements",
      record_id: payment.id,
      action: "WEBHOOK_KKIAPAY_SUCCESS",
      details: "Paiement KKiaPay confirme et enregistre automatiquement.",
      nouvelles_valeurs: {
        transaction_id: transactionId,
        amount: providerAmount,
        status: "SUCCESS",
      },
    });

    return json({
      success: true,
      paiement_id: payment.id,
      status: "valide",
      finalized,
    });
  } catch (error) {
    console.error("kkiapay-webhook error", error);
    // 5xx: KKiaPay peut retenter et le paiement ne doit pas etre marque comme traite a tort.
    return json({ success: false, error: "Erreur interne de traitement" }, 500);
  }
});
