import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error("Numéro de téléphone invalide.");
  return digits.replace(/^00/, "").replace(/^225(?=\d{8,})/, "").replace(/^0+/, "");
}

function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map(x => x.toString(16).padStart(2, "0")).join("");
}

function randomCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(1000 + (a[0] % 9000));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function codeHash(code: string, salt: string) {
  const secret = Deno.env.get("PORTAL_ACCESS_CODE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return sha256(code + ":" + salt + ":" + secret);
}

async function sessionTokenHash(token: string) {
  return sha256(token);
}

async function demoToken(phone: string, code: string) {
  const secret = Deno.env.get("PORTAL_ACCESS_CODE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return sha256(`demo:${phone}:${code}:${secret}`);
}

async function issueSession(supabase: any, clientId: string) {
  const raw = randomHex(32) + "." + randomHex(16);
  const token_hash = await sessionTokenHash(raw);
  await supabase.from("client_portal_sessions").insert({
    client_id: clientId,
    token_hash,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return raw;
}

async function findClient(supabase: any, phone: string) {
  const candidates = [phone, "0" + phone, "225" + phone, phone.slice(-8)];
  for (const candidate of candidates) {
    const { data } = await supabase
      .from("clients")
      .select("id,telephone,email,nom_complet,compte_actif,statut_global")
      .or(`telephone.eq.${candidate},telephone.ilike.%${candidate.slice(-8)}`)
      .limit(10);
    const found = (data || []).find((c: any) => normalizePhone(c.telephone) === phone);
    if (found) return found;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body?.action || "inspect";
    const phone = normalizePhone(body?.telephone || "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default
    );

    const client = await findClient(supabase, phone);

    if (!client) {
      return json({
        success: false,
        code: "CLIENT_NOT_FOUND",
        error: "Ce numéro n'est pas enregistré dans votre dossier client AgriCapital. Si vous avez déjà contractualisé, utilisez le numéro fourni lors de votre contractualisation ou contactez-nous.",
      }, 404);
    }
    if (!client.compte_actif || client.statut_global !== "actif") {
      return json({ success: false, error: "Votre compte client n'est pas encore activé. Veuillez contacter AgriCapital." }, 403);
    }

    const { data: access } = await supabase
      .from("client_portal_access_codes")
      .select("id,locked_until,last_verified_at")
      .eq("client_id", client.id)
      .maybeSingle();

    if (action === "inspect") {
      return json({
        success: true,
        demo: false,
        client_id: client.id,
        telephone: client.telephone,
        nom_complet: client.nom_complet,
        needs_access_code_setup: !access,
        locked_until: access?.locked_until || null,
      });
    }

    if (action === "setup") {
      if (access) {
        return json({
          success: false,
          error: "Un code d'accès existe déjà pour ce compte. Utilisez-le pour vous connecter.",
          needs_access_code_setup: false,
        }, 409);
      }

      const code = String(body?.code || "");
      const confirm = String(body?.confirm_code || "");
      if (!/^\d{4}$/.test(code) || code !== confirm) {
        return json({ success: false, error: "Le code doit contenir exactement 4 chiffres et les deux champs doivent être identiques." }, 400);
      }

      const salt = randomHex(16);
      const hash = await codeHash(code, salt);
      const { error } = await supabase.from("client_portal_access_codes").insert({
        client_id: client.id,
        code_hash: hash,
        code_salt: salt,
        failed_attempts: 0,
        locked_until: null,
        set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) {
        if (error.code === "23505") {
          return json({
            success: false,
            error: "Un code d'accès vient d'être enregistré pour ce compte. Utilisez-le pour vous connecter.",
            needs_access_code_setup: false,
          }, 409);
        }
        throw error;
      }

      const token = await issueSession(supabase, client.id);
      await supabase.from("historique_activites").insert({
        table_name: "clients",
        record_id: client.id,
        action: "PORTAL_ACCESS_CODE_CREATED",
        details: "Code d'accès portail client à 4 chiffres créé.",
      });

      return json({ success: true, first_connection: true, access_token: token });
    }

    if (action === "login") {
      const code = String(body?.code || "");
      if (!/^\d{4}$/.test(code)) return json({ success: false, error: "Code d'accès invalide." }, 400);
      if (!access) return json({ success: false, needs_access_code_setup: true }, 409);

      if (access.locked_until && new Date(access.locked_until).getTime() > Date.now()) {
        return json({ success: false, error: "Trop de tentatives. Veuillez réessayer plus tard.", locked_until: access.locked_until }, 429);
      }

      const { data: fullAccess } = await supabase.from("client_portal_access_codes").select("*").eq("client_id", client.id).single();
      const expected = await codeHash(code, fullAccess.code_salt);
      if (expected !== fullAccess.code_hash) {
        const attempts = Number(fullAccess.failed_attempts || 0) + 1;
        const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await supabase.from("client_portal_access_codes").update({
          failed_attempts: attempts >= 5 ? 0 : attempts,
          locked_until: lockedUntil,
          updated_at: new Date().toISOString(),
        }).eq("client_id", client.id);
        return json({ success: false, error: lockedUntil ? "Trop de tentatives. Réessayez dans 15 minutes." : "Code d'accès incorrect." }, 401);
      }

      await supabase.from("client_portal_access_codes").update({
        failed_attempts: 0,
        locked_until: null,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("client_id", client.id);

      const token = await issueSession(supabase, client.id);
      return json({ success: true, access_token: token });
    }

    if (action === "logout") {
      const token = String(body?.access_token || "");
      if (token) await supabase.from("client_portal_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", await sessionTokenHash(token));
      return json({ success: true });
    }

    return json({ success: false, error: "Action invalide." }, 400);
  } catch (error: any) {
    console.error("portal-access:", error);
    return json({ success: false, error: error?.message || "Erreur serveur." }, 500);
  }
});
