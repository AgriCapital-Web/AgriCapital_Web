import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-kkiapay-secret, x-kkiapay-signature",
};

// Constant-time string compare
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  console.log("=== KKiaPay Webhook ===", req.method);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const rawBody = await req.text();
  const webhookSecret = Deno.env.get("KKIAPAY_SECRET");

  // === 1. Signature verification ===
  let signatureValid = false;
  const sigHeader = req.headers.get("x-kkiapay-signature") || req.headers.get("x-kkiapay-secret");
  if (!webhookSecret) {
    console.error("KKIAPAY_SECRET is not configured");
    return new Response(JSON.stringify({ error: "webhook unavailable" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (sigHeader) {
    const expected = await hmacSha256Hex(webhookSecret, rawBody);
    signatureValid = safeEqual(expected, sigHeader.replace(/^sha256=/, ""));
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { status, transactionId, amount, fees, source, data, performed_at } = body;
  const reference = data?.reference;
  const paiementId = data?.paiement_id;

  console.log(`Txn ${transactionId} | status=${status} | sig_valid=${signatureValid} | ref=${reference}`);

  // === 2. Find payment ===
  let paiement: any = null;
  if (reference) {
    const { data: rows } = await supabase.from("paiements").select("*").eq("reference", reference).limit(1);
    paiement = rows?.[0];
  }
  if (!paiement && paiementId) {
    const { data: rows } = await supabase.from("paiements").select("*").eq("id", paiementId).limit(1);
    paiement = rows?.[0];
  }
  if (!paiement && transactionId) {
    const { data: rows } = await supabase.from("paiements").select("*").eq("kkiapay_transaction_id", transactionId).limit(1);
    paiement = rows?.[0];
  }

  // === 3. Map status ===
  const statusMap: Record<string, string> = {
    SUCCESS: "valide", FAILED: "echoue", PENDING: "en_attente",
    REFUNDED: "rembourse", CANCELLED: "annule", CREATED: "en_attente",
  };
  const evtStatus = (status || "").toString().toUpperCase();
  const newStatut = statusMap[evtStatus] || "en_attente";

  // === 4. Log event (idempotent via UNIQUE(transaction_id, status)) ===
  const { error: evtErr } = await supabase.from("kkiapay_events").upsert({
    transaction_id: transactionId, reference, paiement_id: paiement?.id,
    status: ["SUCCESS","FAILED","PENDING","REFUNDED","CANCELLED","CREATED"].includes(evtStatus) ? evtStatus : "PENDING",
    amount, fees: fees || 0, source: source || data?.method,
    signature_valid: signatureValid, raw_payload: body,
    processed: !!paiement, processed_at: new Date().toISOString(),
  }, { onConflict: "transaction_id,status", ignoreDuplicates: true });
  if (evtErr) console.error("Event insert error:", evtErr);

  // === 5. If signature invalid AND secret configured -> reject side-effects but ack ===
  if (!signatureValid) {
    console.warn("⚠️ Invalid signature — payment update skipped");
    return new Response(JSON.stringify({ acknowledged: true, signature: "invalid" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!paiement) {
    return new Response(JSON.stringify({ acknowledged: true, message: "no matching payment" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // === 6. Protect terminal success from late PENDING/FAILED/CREATED webhooks.
  // A successful payment must never be downgraded by an out-of-order event.
  if (paiement.statut === "valide" && newStatut !== "valide") {
    return new Response(JSON.stringify({
      acknowledged: true,
      paiement_id: paiement.id,
      new_status: "valide",
      ignored_status: newStatut,
      reason: "payment_already_validated",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // === 6. Update payment ===
  const updateData: any = {
    statut: newStatut,
    kkiapay_transaction_id: transactionId,
    updated_at: new Date().toISOString(),
    metadata: {
      ...(paiement.metadata || {}),
      kkiapay_transaction_id: transactionId,
      kkiapay_status: evtStatus,
      method: source || data?.method,
      fees: fees || 0,
      performed_at: performed_at || new Date().toISOString(),
      webhook_received_at: new Date().toISOString(),
      signature_valid: signatureValid,
    },
  };

  if (newStatut === "valide") {
    updateData.date_paiement = new Date().toISOString();
    updateData.montant_paye = paiement.metadata?.client_debit_amount || paiement.montant;
    updateData.metadata = {
      ...updateData.metadata,
      kkiapay_amount: amount || null,
      client_debit_amount: paiement.metadata?.client_debit_amount || paiement.montant,
      fee_absorption_rate: paiement.metadata?.fee_absorption_rate || 0,
    };

  } else if (newStatut === "rembourse") {
    updateData.refunded_at = new Date().toISOString();
  } else if (newStatut === "annule") {
    updateData.cancelled_at = new Date().toISOString();
  }

  let updErr: any = null;
  if (newStatut === "valide") {
    const rpc = await supabase.rpc("finalize_portal_payment", {
      _paiement_id: paiement.id,
      _transaction_id: transactionId,
      _provider_amount: typeof amount === "number" ? amount : null,
      _metadata: updateData.metadata,
      _validated_at: new Date().toISOString(),
    });
    updErr = rpc.error;
  } else {
    const result = await supabase.from("paiements").update(updateData).eq("id", paiement.id);
    updErr = result.error;
  }
  if (updErr) console.error("Update error:", updErr);

  return new Response(JSON.stringify({
    success: true, paiement_id: paiement.id, new_status: newStatut, signature_valid: signatureValid,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
