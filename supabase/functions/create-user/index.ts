import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const ALLOWED_ORIGINS = new Set((Deno.env.get("ALLOWED_ORIGINS") || "https://agricapital.ci,https://www.agricapital.ci,https://app.agricapital.ci,https://portail.agricapital.ci,http://localhost:5173,http://localhost:8080").split(",").map((v) => v.trim()).filter(Boolean));
const corsHeaders = (req: Request) => {
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

const VALID_ROLES = [
  "super_admin","responsable_operations","directeur_tc","responsable_commercial","comptable","commercial",
  "service_client","assistant_administratif","chef_equipe_commercial","chef_equipe_technique",
  "chef_equipe_service_client","associe_actionnaire",
];

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const findAuthUserByEmail = async (supabase: any, email: string) => {
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data?.users?.find(
      (user: any) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (match || !data?.users || data.users.length < perPage) {
      return match || null;
    }
  }

  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // --- Authentification et autorisation du caller (admin uniquement) ---
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return jsonResponse({ success: false, error: "Non authentifié" }, 401);
    const { data: callerData } = await supabase.auth.getUser(token);
    const caller = callerData?.user;
    if (!caller) return jsonResponse({ success: false, error: "Session invalide" }, 401);
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) {
      return jsonResponse({ success: false, error: "Accès réservé aux administrateurs" }, 403);
    }
    const { data: isSuperAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "super_admin" });



    const { 
      email: rawEmail, 
      password, 
      nom_complet,
      telephone,
      equipe_id,
      photo_url,
      roles,
      username,
      whatsapp,
      departement,
      relation_rh,
      taux_commission,
      district_id,
      region_id,
      poste
    } = await req.json();
    const email = String(rawEmail || "").trim().toLowerCase();
    const requestedRoles = Array.isArray(roles) ? roles : [];
    const invalidRoles = requestedRoles.filter((role: string) => !VALID_ROLES.includes(role));
    const roleInserts = [...new Set(requestedRoles)]
      .filter((role: string) => VALID_ROLES.includes(role))
      .map((role: string) => ({ role }));

    // Input validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return jsonResponse({ success: false, error: "Email invalide" }, 400);
    }

    if (!password || password.length < 12 || password.length > 128) {
      return jsonResponse({ 
        success: false, 
        error: "Mot de passe invalide. Doit contenir entre 12 et 128 caractères." 
      }, 400);
    }

    if (!nom_complet || nom_complet.length < 2 || nom_complet.length > 100) {
      return jsonResponse({ 
        success: false, 
        error: "Nom complet invalide. Doit contenir entre 2 et 100 caractères." 
      }, 400);
    }

    if (requestedRoles.length === 0) {
      return jsonResponse({
        success: false,
        error: "Aucun rôle fourni. La création doit passer par user_roles avec au moins un rôle valide.",
      }, 400);
    }

    if (requestedRoles.includes("super_admin") && !isSuperAdmin) {
      return jsonResponse({ success: false, error: "Seul le super administrateur peut attribuer le rôle super_admin." }, 403);
    }

    if (invalidRoles.length > 0 || roleInserts.length === 0) {
      return jsonResponse({
        success: false,
        error: `Configuration des rôles invalide: ${invalidRoles.join(", ") || "aucun rôle reconnu"}`,
      }, 400);
    }

    console.log("User creation initiated for:", email);

    // Never overwrite an existing account's password from the creation flow.
    const { data: existingProfiles, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id,user_id,email")
      .ilike("email", email)
      .limit(1);

    if (existingProfileError) {
      console.error("Existing profile lookup error:", existingProfileError);
      throw new Error("Impossible de vérifier l'existence du profil utilisateur");
    }

    const existingProfile = existingProfiles?.[0] || null;

    if (existingProfile) {
      return jsonResponse({
        success: false,
        error: "Un compte existe déjà avec cet email. Utilisez la gestion des utilisateurs ou la réinitialisation du mot de passe.",
      }, 409);
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nom_complet },
    });

    if (authError) {
      const duplicateAuthUser = /already|registered|exists|duplicate/i.test(authError.message || "")
        ? await findAuthUserByEmail(supabase, email)
        : null;

      if (duplicateAuthUser) {
        return jsonResponse({
          success: false,
          error: "Un compte de connexion existe déjà avec cet email. Réinitialisez son mot de passe au lieu de le recréer.",
        }, 409);
      }

      console.error("Auth error:", authError);
      throw authError;
    }

    const authUser = authData.user;
    console.log("User authentication record created:", authUser.id);

    if (!authUser?.id) {
      throw new Error("Compte Auth introuvable après création ou mise à jour");
    }

    // Upsert profile (handle_new_user trigger may have already created a base row)
    const profilePayload = {
        id: authUser.id,
        user_id: authUser.id,
        email,
        nom_complet,
        telephone: telephone || null,
        whatsapp: whatsapp || null,
        departement: departement || null,
        relation_rh: relation_rh || 'Employé',
        taux_commission: taux_commission ? Number(taux_commission) : null,
        district_id: district_id || null,
        region_id: region_id || null,
        poste: poste || null,
        equipe_id: equipe_id || null,
        photo_url: photo_url || null,
        username: username || email.split('@')[0],
        actif: true,
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileError) {
      console.error("Profile error:", profileError);
      await supabase.auth.admin.deleteUser(authUser.id);
      throw profileError;
    }

    console.log("Profile created successfully");

    // Roles are managed only through user_roles. Replace stale roles, then upsert the requested set.
    const { error: deleteRolesError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", authUser.id);

    if (deleteRolesError) {
      console.error("Roles delete error:", deleteRolesError);
      throw new Error("Configuration user_roles manquante ou inaccessible: impossible de réinitialiser les rôles.");
    }

    const { error: rolesError } = await supabase
      .from("user_roles")
      .upsert(
        roleInserts.map((role: { role: string }) => ({ user_id: authUser.id, role: role.role })),
        { onConflict: "user_id,role" },
      );

    if (rolesError) {
      console.error("Roles error:", rolesError);
      throw new Error("Configuration user_roles manquante ou invalide: impossible d'attribuer les rôles.");
    }

    console.log("User roles assigned successfully");

    return jsonResponse({
      success: true,
      message: "Utilisateur créé avec succès",
      user_id: authUser.id,
      email,
      user_already_existed: false,
    });
  } catch (error: any) {
    console.error("Error:", error);
    return jsonResponse({ 
      success: false, 
      error: error?.message || "Une erreur est survenue lors de la création de l'utilisateur" 
    }, 400);
  }
});
