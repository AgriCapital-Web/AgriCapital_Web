import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactionId } = await req.json();

    if (!transactionId) {
      throw new Error("Transaction ID is required");
    }

    const privateKey = Deno.env.get("KKIAPAY_PRIVATE_KEY");
    
    if (!privateKey) {
      throw new Error("KKiaPay private key not configured");
    }

    console.log("Verifying KKiaPay transaction:", transactionId);

    // Verify the transaction via KKiaPay API
    const response = await fetch(`https://api.kkiapay.me/api/v1/transactions/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-private-key": privateKey
      },
      body: JSON.stringify({ transactionId })
    });

    const result = await response.json();
    
    console.log("KKiaPay verification result:", result);

    // KKiaPay status: SUCCESS, PENDING, FAILED
    const status = result.status?.toUpperCase();
    const isSuccess = status === "SUCCESS";
    
    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: transactionId,
          status: status,
          isPaymentSuccessful: isSuccess,
          amount: result.amount,
          fees: result.fees || 0,
          source: result.source,
          performedAt: result.performed_at || result.createdAt,
          failureMessage: result.failureMessage || null
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("KKiaPay verify error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Une erreur est survenue lors de la vérification" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
