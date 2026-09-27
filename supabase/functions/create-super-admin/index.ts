import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const ALLOWED_ORIGINS = new Set((Deno.env.get("ALLOWED_ORIGINS") || "https://agricapital.ci,https://www.agricapital.ci,https://app.agricapital.ci,https://portail.agricapital.ci").split(",").map((v) => v.trim()).filter(Boolean));
const cors = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string,string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!bearer) return json(req, { error: "Non authentifié" }, 401);
    const { data: callerData } = await admin.auth.getUser(bearer);
    const caller = callerData?.user;
    if (!caller) return json(req, { error: "Session invalide" }, 401);
    const { data: allowed } = await admin.rpc("is_admin", { _user_id: caller.id });
    if (!allowed) return json(req, { error: "Accès réservé aux administrateurs" }, 403);

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const nom_complet = String(body.nom_complet || "").trim();
    const telephone = body.telephone ? String(body.telephone) : null;
    const photo_url = body.photo_url ? String(body.photo_url) : null;
    if (!email || !password || !nom_complet) return json(req, { error: "Données obligatoires manquantes" }, 400);
    if (password.length < 12 || password.length > 128) return json(req, { error: "Mot de passe trop faible" }, 400);

    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nom_complet },
    });
    if (error || !created.user) return json(req, { error: "Impossible de créer le compte" }, 400);

    const userId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId, user_id: userId, email, nom_complet, telephone, photo_url, actif: true, role: "super_admin",
    }, { onConflict: "id" });
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return json(req, { error: "Impossible de créer le profil" }, 400);
    }
    const { error: roleError } = await admin.from("user_roles").upsert(
      { user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" }
    );
    if (roleError) {
      await admin.auth.admin.deleteUser(userId);
      return json(req, { error: "Impossible d'attribuer le rôle" }, 400);
    }
    return json(req, { success: true, user_id: userId });
  } catch (error) {
    console.error("create-super-admin error", error);
    return json(req, { error: "Erreur interne" }, 500);
  }
});