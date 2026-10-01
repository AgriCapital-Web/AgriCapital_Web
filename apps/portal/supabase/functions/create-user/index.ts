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
    // Authenticate caller and ensure they are an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const callerId = claimsData.claims.sub as string;

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

    // Verify caller has admin role
    const { data: isAdminData, error: isAdminError } = await supabase.rpc("is_admin", {
      _user_id: callerId,
    });
    if (isAdminError || isAdminData !== true) {
      return new Response(
        JSON.stringify({ success: false, error: "Accès refusé : privilèges administrateur requis" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const { 
      email, 
      password, 
      nom_complet,
      telephone,
      equipe_id,
      photo_url,
      roles 
    } = await req.json();

    // Input validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email invalide" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!password || password.length < 8 || password.length > 128) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Mot de passe invalide. Doit contenir entre 8 et 128 caractères." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!nom_complet || nom_complet.length < 2 || nom_complet.length > 100) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nom complet invalide. Doit contenir entre 2 et 100 caractères." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("User creation initiated for:", email);

    // Check if user already exists by email
    const { data: existingEmail } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingEmail) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Un utilisateur avec cet email existe déjà" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw authError;
    }

    console.log("User authentication record created:", authData.user.id);

    // Create profile
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        user_id: authData.user.id,
        email,
        nom_complet,
        telephone: telephone || null,
        role: (roles && roles.length > 0) ? roles[0] : 'user',
        equipe_id: equipe_id || null,
        photo_url: photo_url || null,
        actif: true,
      });

    if (profileError) {
      console.error("Profile error:", profileError);
      // Try to delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    console.log("Profile created successfully");

    // Create roles in user_roles table
    if (roles && roles.length > 0) {
      const validRoles = ['super_admin', 'directeur_tc', 'responsable_zone', 'comptable', 'commercial', 'service_client', 'operations', 'user'];
      const roleInserts = roles
        .filter((role: string) => validRoles.includes(role))
        .map((role: string) => ({
          user_id: authData.user.id,
          role: role,
        }));

      if (roleInserts.length > 0) {
        const { error: rolesError } = await supabase
          .from("user_roles")
          .insert(roleInserts);

        if (rolesError) {
          console.error("Roles error:", rolesError);
          // Don't throw - profile is already created, just log the error
          console.log("Warning: Could not assign roles, but user was created");
        } else {
          console.log("User roles assigned successfully");
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Utilisateur créé avec succès",
        user_id: authData.user.id,
        email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || "Une erreur est survenue lors de la création de l'utilisateur" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
