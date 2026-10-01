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
    const { amount, description, reference, customer, callback_url, sandbox } = await req.json();

    const publicKey = Deno.env.get("KKIAPAY_PUBLIC_KEY");
    const privateKey = Deno.env.get("KKIAPAY_PRIVATE_KEY");
    const secret = Deno.env.get("KKIAPAY_SECRET");

    if (!publicKey || !privateKey) {
      throw new Error("KKiaPay keys not configured");
    }

    console.log("Creating KKiaPay transaction:", { amount, reference, description });

    // KKiaPay doesn't have a server-side API for creating transactions
    // Instead, we return the configuration for the client-side widget
    // The actual payment is initiated client-side with the widget
    
    // Generate a unique payment ID for tracking
    const paymentId = `KKIA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentId,
        config: {
          amount: Math.round(amount),
          key: publicKey,
          sandbox: sandbox ?? false,
          reference: reference,
          callback: callback_url,
          data: {
            description,
            customer_name: customer?.firstname ? `${customer.firstname} ${customer.lastname}` : 'Client',
            customer_phone: customer?.phone || '',
            customer_email: customer?.email || ''
          }
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("KKiaPay error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Une erreur est survenue" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
