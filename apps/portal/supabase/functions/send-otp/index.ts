import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sanitizePhone(input: string): string {
  if (typeof input !== 'string') throw new Error("Format invalide");
  const cleaned = input.replace(/\D/g, '');
  if (cleaned.length < 8 || cleaned.length > 15) throw new Error("Numéro invalide");
  return cleaned;
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
}

function maskEmail(email?: string | null): string | null {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  const domainParts = domain.split('.');
  const domainName = domainParts[0] || '';
  const suffix = domainParts.slice(1).join('.');
  return `${local.slice(0, 1)}***@${domainName.slice(0, 1)}***${suffix ? `.${suffix}` : ''}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { telephone, action, code } = body;
    const cleanPhone = sanitizePhone(telephone || '');
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // NOTE: The `send_custom` action has been removed. It was an unauthenticated
    // SMS broadcast endpoint that let any caller send arbitrary messages billed
    // to AgriCapital. Payment-confirmation SMS is now sent server-side from
    // within `create-payment` after KKiaPay verification.

    // ===== STATUS (panneau sécurité du portail) =====
    // Ne renvoie JAMAIS le code : uniquement des métadonnées de diagnostic
    // (horodatage, expiration, tentatives, numéro et e-mail masqués).
    if (action === 'status') {
      const tenMinAgo0 = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const [{ data: last }, { count: recent }, { data: sous }] = await Promise.all([
        supabase.from('otp_codes')
          .select('created_at, expires_at, verified, attempts')
          .eq('telephone', cleanPhone)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('otp_codes')
          .select('*', { count: 'exact', head: true })
          .eq('telephone', cleanPhone)
          .gt('created_at', tenMinAgo0),
        supabase.from('souscripteurs')
          .select('email')
          .eq('telephone', cleanPhone)
          .limit(1)
          .maybeSingle(),
      ]);

      const expiresAt = last?.expires_at ? new Date(last.expires_at).getTime() : 0;

      return new Response(
        JSON.stringify({
          success: true,
          status: {
             telephone_masque: maskPhone(cleanPhone),
            email_masque: maskEmail(sous?.email),
            created_at: last?.created_at ?? null,
            expires_at: last?.expires_at ?? null,
            verified: !!last?.verified,
            attempts: last?.attempts ?? 0,
            expired: expiresAt ? expiresAt < Date.now() : true,
            seconds_restantes: expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 0,
            demandes_10min: recent || 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LEGACY SEND OTP — DÉSACTIVÉ =====
    // Le portail actuel n'utilise plus SMS/OTP pour la connexion.
    // - Numéro inconnu : le parcours portal-access fournit un code démo affiché.
    // - Numéro connu : création/validation d'un code personnel à 4 chiffres.
    // Cette ancienne route reste uniquement pour éviter une rupture brutale avec
    // d'anciens clients déployés, mais elle ne contacte PLUS Infobip et n'envoie
    // aucun SMS.
    if (action === 'send') {
      return new Response(
        JSON.stringify({
          success: false,
          legacy: true,
          error: "L'ancien parcours SMS/OTP a été remplacé. Utilisez le portail AgriCapital avec votre numéro puis votre code d'accès à 4 chiffres.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 410 }
      );
    }

    // ===== VERIFY OTP =====
    if (action === 'verify') {
      if (!code || typeof code !== 'string' || code.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: "Code invalide" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Get latest valid OTP for this phone
      const { data: otpRecord } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('telephone', cleanPhone)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) {
        return new Response(
          JSON.stringify({ success: false, error: "Code expiré ou inexistant. Demandez un nouveau code." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Trop de tentatives : on N'INVALIDE PAS le code, on demande simplement
      // de patienter puis de redemander un code — la connexion reste possible.
      if (otpRecord.attempts >= 10) {
        return new Response(
          JSON.stringify({ success: false, error: "Trop de tentatives sur ce code. Demandez un nouveau code d'accès." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }


      // Increment attempts
      await supabase.from('otp_codes')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      if (otpRecord.code !== code) {
        return new Response(
          JSON.stringify({ success: false, error: `Code incorrect. ${Math.max(0, 9 - otpRecord.attempts)} tentative(s) restante(s).` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Mark as verified
      await supabase.from('otp_codes')
        .update({ verified: true })
        .eq('id', otpRecord.id);

      await supabase.from('historique_activites').insert({
        table_name: 'otp_codes',
         record_id: maskPhone(cleanPhone),
        action: 'OTP_VERIFIED',
        details: `Code OTP vérifié pour ${cleanPhone.slice(0, 4)}****`,
        ip_address: clientIP,
        user_agent: req.headers.get('user-agent') || 'unknown',
      });

      return new Response(
        JSON.stringify({ success: true, message: "Code vérifié" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Action invalide. Utilisez 'send', 'verify' ou 'status'." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error: any) {
    console.error("OTP error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erreur serveur" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
