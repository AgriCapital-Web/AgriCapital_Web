import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret, x-cron-secret, x-api-key",
};

export const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

export const json = (p: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(p), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });


/**
 * Résolution identifiant → email.
 * L'adresse email n'est JAMAIS renvoyée sans preuve de possession du compte :
 *  - mode "login"    : le mot de passe est vérifié côté serveur avant de renvoyer l'email.
 *  - mode "recovery" : l'email de réinitialisation est envoyé côté serveur, aucune donnée renvoyée.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const mode = body?.mode === "recovery" ? "recovery" : "login";

    if (!username || username.length < 2 || username.length > 64 || /[\\u0000-\\u001F\\u007F]/.test(username)) {
      return json({ error: "Identifiant invalide" }, 400);
    }

    const admin = adminClient();
    const { data: email, error } = await admin.rpc("resolve_username_email", { _username: username });

    if (mode === "recovery") {
      // Réponse identique que l'identifiant existe ou non (pas d'énumération de comptes).
      if (!error && email) {
        const siteUrl = Deno.env.get("SITE_URL") ?? "https://app.agricapital.ci";
        const anon = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { auth: { autoRefreshToken: false, persistSession: false } },
        );
        await anon.auth.resetPasswordForEmail(String(email), {
          redirectTo: `${siteUrl}/reset-password`,
        });
      }
      return json({ sent: true });
    }

    if (!password) return json({ error: "Identifiants incorrects" }, 401);
    if (error || !email) return json({ error: "Identifiants incorrects" }, 401);

    // Vérification des identifiants côté serveur avant toute divulgation de l'email.
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email: String(email),
      password,
    });
    if (signInErr || !signIn?.user) {
      return json({ error: "Identifiants incorrects" }, 401);
    }
    await anon.auth.signOut().catch(() => {});

    return json({ email: String(email) });
  } catch (_e) {
    return json({ error: "Requête invalide" }, 400);
  }
});
