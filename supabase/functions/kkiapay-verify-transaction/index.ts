import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, json, requireUser } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = adminClient();

    // 1) Authentification obligatoire
    const { user, error: authError } = await requireUser(req, admin);
    if (authError) return authError;

    const body = await req.json();
    const transactionId = body?.transactionId;
    const paiementId = body?.paiementId ?? null;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!transactionId || typeof transactionId !== "string" || transactionId.length > 128) {
      return json({ success: false, error: "Identifiant de transaction invalide" }, 400);
    }
    if (paiementId !== null && (typeof paiementId !== "string" || !UUID_RE.test(paiementId))) {
      return json({ success: false, error: "Identifiant de paiement invalide" }, 400);
    }

    // 2) Autorisation : staff, ou client propriétaire du paiement ciblé/lié
    const { data: isStaff } = await admin.rpc("is_staff", { _user_id: user!.id });

    // Paiement ciblé (le cas échéant) : chargé côté serveur, jamais fourni par le client
    let target: {
      id: string;
      client_id: string | null;
      montant: number | null;
      statut: string | null;
      kkiapay_transaction_id: string | null;
    } | null = null;

    if (paiementId) {
      const { data } = await admin
        .from("paiements")
        .select("id, client_id, montant, statut, kkiapay_transaction_id")
        .eq("id", paiementId)
        .maybeSingle();
      if (!data) return json({ success: false, error: "Paiement introuvable" }, 404);
      target = data as typeof target;
    }

    if (!isStaff) {
      const { data: client } = await admin
        .from("clients")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      let allowed = false;
      if (client?.id) {
        if (target) {
          allowed = target.client_id === client.id;
        } else {
          const { data: paiement } = await admin
            .from("paiements")
            .select("id")
            .eq("client_id", client.id)
            .contains("metadata", { kkiapay_transaction_id: transactionId })
            .maybeSingle();
          allowed = !!paiement;
        }
      }

      if (!allowed) {
        return json({ success: false, error: "Accès non autorisé à cette transaction" }, 403);
      }
    }

    // Une transaction ne peut jamais servir à valider deux paiements différents
    {
      const { data: reused } = await admin
        .from("paiements")
        .select("id")
        .eq("kkiapay_transaction_id", transactionId)
        .maybeSingle();
      if (reused && (!target || reused.id !== target.id)) {
        return json({ success: false, error: "Transaction déjà rattachée à un autre paiement" }, 409);
      }
    }

    const privateKey = Deno.env.get("KKIAPAY_PRIVATE_KEY");
    if (!privateKey) {
      console.error("KKIAPAY_PRIVATE_KEY missing");
      return json({ success: false, error: "Service de paiement indisponible" }, 500);
    }

    const response = await fetch(`https://api.kkiapay.me/api/v1/transactions/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-private-key": privateKey,
      },
      body: JSON.stringify({ transactionId }),
    });

    const result = await response.json();

    // KKiaPay status: SUCCESS, PENDING, FAILED
    const status = result.status?.toUpperCase();
    const isSuccess = status === "SUCCESS";

    const providerAmount = Number(result.amount ?? 0);
    let applied = false;

    // 3) Validation du paiement ciblé : uniquement côté serveur, montant vérifié
    if (target && isSuccess) {
      const due = Number(target.montant ?? 0);
      if (!Number.isFinite(providerAmount) || providerAmount + 0.01 < due) {
        return json({
          success: false,
          error: "Le montant de la transaction ne correspond pas au paiement",
        }, 409);
      }

      const { error: rpcError } = await admin.rpc("finalize_portal_payment", {
        _paiement_id: target.id,
        _transaction_id: transactionId,
        _provider_amount: providerAmount,
        _metadata: {
          kkiapay_transaction_id: transactionId,
          kkiapay_method: result.source ?? "mobile_money",
          kkiapay_fees: result.fees ?? 0,
          verified_at: new Date().toISOString(),
        },
        _validated_at: new Date().toISOString(),
      });
      if (rpcError) {
        console.error("finalize_portal_payment error", rpcError.message);
        return json({ success: false, error: "Le paiement n'a pas pu être enregistré" }, 409);
      }
      applied = true;
    }

    return json({
      success: true,
      applied,
      transaction: {
        id: transactionId,
        status,
        isPaymentSuccessful: isSuccess,
        amount: result.amount,
        fees: result.fees || 0,
        source: result.source,
        performedAt: result.performed_at || result.createdAt,
        failureMessage: result.failureMessage || null,
      },
    });
  } catch (error) {
    console.error("KKiaPay verify error:", error);
    return json({ success: false, error: "Une erreur est survenue lors de la vérification" }, 400);
  }
});
