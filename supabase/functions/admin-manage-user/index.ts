import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function privateProtectedTarget(admin: any, userId: string) {
  const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  return ["innocentkoffi1@gmail.com","admin@agricapital.ci"].includes(String(data?.email || "").toLowerCase());
}
\nconst VALID_ROLES = new Set(["super_admin","responsable_operations","directeur_tc","responsable_commercial","comptable","commercial","service_client","assistant_administratif","chef_equipe_commercial","chef_equipe_technique","chef_equipe_service_client","associe_actionnaire"]);
const json = (p: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(p), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let step = "init";
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    step = "auth_caller";
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Non authentifié", step }, 401);
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return json({ error: "Session invalide", step }, 401);
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: caller.user.id });
    const { data: isSuperAdmin } = await admin.rpc("has_role", { _user_id: caller.user.id, _role: "super_admin" });
    if (!isAdmin) return json({ error: "Accès réservé aux administrateurs", step }, 403);

    step = "parse_body";
    const { action, user_id, password, username, roles } = await req.json();
    if (!action || !user_id) return json({ error: "action et user_id requis", step }, 400);

    const protectedRootIds = new Set([
      "8d616fdc-6f25-43e9-baaa-51ead746222e",
      "bd9579fd-1d07-4431-9cc4-b57dfeeab593",
    ]);
    const isProtectedRoot = protectedRootIds.has(String(user_id));
    if (isProtectedRoot && (action === "delete_user" || action === "set_roles")) {
      return json({ error: "Ce compte racine est protégé : suppression, révocation ou modification des rôles interdite.", step }, 403);
    }

    if (action === "set_password") {
      step = "set_password";
      if (!password || String(password).length < 12 || String(password).length > 128) {
        return json({ error: "Mot de passe : 12 à 128 caractères", step }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, { password: String(password) });
      if (error) return json({ error: error.message, step }, 400);
      return json({ success: true, action });
    }

    if (action === "set_username") {
      step = "set_username";
      const clean = String(username ?? "").trim().toLowerCase();
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(clean)) {
        return json({ error: "Identifiant invalide (3 à 30 caractères : lettres, chiffres, . _ -)", step }, 400);
      }
      const { data: taken } = await admin
        .from("profiles").select("id").eq("username", clean).neq("id", user_id).maybeSingle();
      if (taken) return json({ error: "Cet identifiant est déjà utilisé", step }, 409);
      const { error } = await admin.from("profiles").update({ username: clean }).eq("id", user_id);
      if (error) return json({ error: error.message, step }, 400);
      return json({ success: true, action, username: clean });
    }

    if (action === "set_roles") {
      step = "set_roles";
      const list: string[] = Array.isArray(roles) ? [...new Set(roles.filter(Boolean))] : [];
      if (list.length === 0) return json({ error: "Au moins un rôle est requis", step }, 400);
      const invalid = list.filter((r) => !VALID_ROLES.has(r));
      if (invalid.length) return json({ error: `Rôle(s) invalide(s): ${invalid.join(", ")}`, step }, 400);
      if (list.includes("super_admin") && !isSuperAdmin) {
        return json({ error: "Seul le super administrateur peut attribuer le rôle super_admin", step }, 403);
      }
      if (user_id === caller.user.id && !list.includes("super_admin")) {
        return json({ error: "Vous ne pouvez pas retirer votre propre rôle administrateur", step }, 403);
      }
      step = "delete_old_roles";
      const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", user_id);
      if (delErr) return json({ error: delErr.message, step }, 400);
      step = "insert_roles";
      const { error: insErr } = await admin
        .from("user_roles")
        .upsert(list.map((r) => ({ user_id, role: r })), { onConflict: "user_id,role" });
      if (insErr) return json({ error: insErr.message, step }, 400);
      step = "verify_roles";
      const { data: check } = await admin.from("user_roles").select("role").eq("user_id", user_id);
      await admin.from("profiles").update({ actif: true }).eq("id", user_id);
      return json({ success: true, action, roles: (check ?? []).map((r: any) => r.role) });
    }

    if ((action === "delete_user" || action === "set_roles") && await privateProtectedTarget(admin, user_id)) {
      return json({ error: "Ce compte administratif permanent est protégé et ne peut pas être supprimé, révoqué ou rétrogradé.", step }, 403);
    }

    if (action === "delete_user") {
      step = "delete_user";
      const { data: targetSuperAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "super_admin" });
      if (targetSuperAdmin && !isSuperAdmin) return json({ error: "Seul le super administrateur peut supprimer un autre super administrateur", step }, 403);
      if (user_id === caller.user.id) {
        return json({ error: "Impossible de supprimer votre propre compte", step }, 400);
      }
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("account_requests").delete().eq("auth_user_id", user_id);
      await admin.from("profiles").delete().eq("id", user_id);
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message, step }, 400);
      return json({ success: true, action });
    }

    return json({ error: `Action inconnue: ${action}`, step }, 400);
  } catch (e) {
    console.error("admin-manage-user error", step, e);
    return json({ error: (e as Error).message, step }, 500);
  }
});
