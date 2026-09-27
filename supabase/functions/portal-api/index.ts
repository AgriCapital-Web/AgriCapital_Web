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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Helper to get souscripteur for current user
    const getSouscripteur = async () => {
      const { data } = await supabase
        .from("souscripteurs")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data;
    };

    switch (action) {
      case "dashboard": {
        const souscripteur = await getSouscripteur();
        if (!souscripteur) {
          return new Response(JSON.stringify({ error: "Souscripteur non trouvé" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const [
          { data: plantations },
          { data: paiements },
          { data: promotions },
          { data: offres },
          { data: remboursements },
          { data: synthese },
          { data: depotInitial },
        ] = await Promise.all([
          supabase.from("plantations")
            .select("*, regions(nom), departements(nom), sous_prefectures(nom), districts(nom)")
            .eq("souscripteur_id", souscripteur.id)
            .order("created_at", { ascending: false }),
          supabase.from("paiements")
            .select("*")
            .eq("souscripteur_id", souscripteur.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase.from("promotions")
            .select("*")
            .eq("active", true)
            .lte("date_debut", new Date().toISOString())
            .gte("date_fin", new Date().toISOString())
            .limit(1),
          supabase.from("offres")
            .select("*")
            .eq("actif", true)
            .order("ordre"),
          supabase.from("remboursements")
            .select("*")
            .eq("souscripteur_id", souscripteur.id)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase.from("v_souscripteur_synthese")
            .select("*")
            .eq("id", souscripteur.id)
            .maybeSingle(),
          supabase.from("paiements")
            .select("*")
            .eq("souscripteur_id", souscripteur.id)
            .eq("est_depot_initial", true)
            .maybeSingle(),
        ]);

        // Calculate summary stats
        const totalDAPaye = (paiements || [])
          .filter((p: any) => p.type_paiement === 'DA' && p.statut === 'valide')
          .reduce((sum: number, p: any) => sum + (p.montant_paye || 0), 0);
        const totalRedevances = (paiements || [])
          .filter((p: any) => p.type_paiement === 'REDEVANCE' && p.statut === 'valide')
          .reduce((sum: number, p: any) => sum + (p.montant_paye || 0), 0);
        const paiementsEnRetard = (paiements || [])
          .filter((p: any) => p.statut === 'en_retard' || (p.statut === 'en_attente' && p.date_echeance && new Date(p.date_echeance) < new Date()));

        return new Response(JSON.stringify({
          souscripteur,
          plantations: plantations || [],
          paiements: paiements || [],
          remboursements: remboursements || [],
          promotion: promotions?.[0] || null,
          offres: offres || [],
          synthese: synthese || null,
          depot_initial: depotInitial || null,
          stats: {
            totalPlantations: (plantations || []).length,
            totalHectares: souscripteur.total_hectares || 0,
            totalDAPaye,
            totalRedevances,
            paiementsEnRetard: paiementsEnRetard.length,
            compteActif: !!souscripteur.compte_actif,
            depotInitialDu: depotInitial && depotInitial.statut !== 'valide' ? depotInitial.montant : 0,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "depot-initial": {
        const souscripteur = await getSouscripteur();
        if (!souscripteur) {
          return new Response(JSON.stringify({ error: "Souscripteur non trouvé" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const { data: depot } = await supabase
          .from("paiements")
          .select("*")
          .eq("souscripteur_id", souscripteur.id)
          .eq("est_depot_initial", true)
          .maybeSingle();
        return new Response(JSON.stringify({ depot_initial: depot || null, souscripteur }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "echeances": {
        const souscripteur = await getSouscripteur();
        if (!souscripteur) {
          return new Response(JSON.stringify({ error: "Souscripteur non trouvé" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const { data: echeances } = await supabase
          .from("paiements")
          .select("*")
          .eq("souscripteur_id", souscripteur.id)
          .eq("type_paiement", "REDEVANCE")
          .order("numero_echeance", { ascending: true });
        return new Response(JSON.stringify({ echeances: echeances || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "synthese": {
        const souscripteur = await getSouscripteur();
        if (!souscripteur) {
          return new Response(JSON.stringify({ error: "Souscripteur non trouvé" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const { data: synthese } = await supabase
          .from("v_souscripteur_synthese")
          .select("*")
          .eq("id", souscripteur.id)
          .maybeSingle();
        return new Response(JSON.stringify({ synthese: synthese || null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "simuler-paiement": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST requis" }), {
            status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const body = await req.json();
        const montant = Number(body?.montant);
        if (!montant || montant <= 0) {
          return new Response(JSON.stringify({ error: "Montant invalide" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const souscripteur = await getSouscripteur();
        if (!souscripteur) {
          return new Response(JSON.stringify({ error: "Souscripteur non trouvé" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const { data, error } = await supabase.rpc("simuler_paiement_fractionne", {
          _souscripteur_id: souscripteur.id,
          _montant: montant,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ simulation: Array.isArray(data) ? data[0] : data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "promotions-actives": {
        const cible = url.searchParams.get("cible"); // depot_initial | total_contrat
        let q = supabase.from("promotions").select("*")
          .eq("active", true)
          .lte("date_debut", new Date().toISOString())
          .gte("date_fin", new Date().toISOString());
        if (cible) q = q.eq("cible", cible);
        const { data: promos } = await q.order("created_at", { ascending: false });
        return new Response(JSON.stringify({ promotions: promos || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "paiement-history": {
        const souscripteur = await getSouscripteur();
        if (!souscripteur) {
          return new Response(JSON.stringify({ error: "Souscripteur non trouvé" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const { data: paiements } = await supabase
          .from("paiements")
          .select("*, plantations(id_unique, nom_plantation)")
          .eq("souscripteur_id", souscripteur.id)
          .order("created_at", { ascending: false })
          .limit(200);

        return new Response(JSON.stringify({ paiements: paiements || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "plantations": {
        const souscripteur = await getSouscripteur();
        if (!souscripteur) {
          return new Response(JSON.stringify({ error: "Souscripteur non trouvé" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const { data: plantations } = await supabase
          .from("plantations")
          .select("*, regions(nom), departements(nom), sous_prefectures(nom), districts(nom)")
          .eq("souscripteur_id", souscripteur.id)
          .order("created_at", { ascending: false });

        return new Response(JSON.stringify({ plantations: plantations || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "geo-data": {
        const [
          { data: districts },
          { data: regions },
          { data: departements },
          { data: sousPrefectures },
          { data: villages },
        ] = await Promise.all([
          supabase.from("districts").select("id, nom, code").eq("est_actif", true).order("nom"),
          supabase.from("regions").select("id, nom, district_id, code").eq("est_active", true).order("nom"),
          supabase.from("departements").select("id, nom, region_id, code").eq("est_actif", true).order("nom"),
          supabase.from("sous_prefectures").select("id, nom, departement_id, code").eq("est_active", true).order("nom"),
          supabase.from("villages").select("id, nom, sous_prefecture_id").eq("est_actif", true).order("nom"),
        ]);

        return new Response(JSON.stringify({
          districts: districts || [],
          regions: regions || [],
          departements: departements || [],
          sous_prefectures: sousPrefectures || [],
          villages: villages || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "notifications": {
        const { data: notifications } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        return new Response(JSON.stringify({ notifications: notifications || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "mark-notification-read": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const body = await req.json();
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", body.notification_id)
          .eq("user_id", user.id);
        
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "rapports-techniques": {
        const souscripteur = await getSouscripteur();
        if (!souscripteur) return new Response(JSON.stringify({ error: "Souscripteur non trouvé" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: rapports } = await supabase.from("rapports_visites_techniques")
          .select("id,plantation_id,date_visite,type_visite,observations,recommandations,statut,client_visible,created_at")
          .eq("souscripteur_id", souscripteur.id).eq("client_visible", true).order("date_visite",{ascending:false}).limit(100);
        const ids=(rapports||[]).map((r:any)=>r.id);
        const { data: medias } = ids.length ? await supabase.from("rapports_visites_medias")
          .select("id,rapport_id,plantation_id,media_type,storage_path,mime_type,nom_fichier,description,client_visible,created_at")
          .in("rapport_id",ids).eq("client_visible",true).order("created_at",{ascending:false}) : { data: [] as any[] };
        const signed = await Promise.all((medias||[]).map(async (m:any) => {
          const { data } = await supabase.storage.from("rapports-techniques").createSignedUrl(m.storage_path, 3600);
          return { ...m, url: data?.signedUrl || null };
        }));
        return new Response(JSON.stringify({ rapports: rapports || [], medias: signed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "tickets": {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (req.method === "POST") {
          const body = await req.json();

          // La plantation référencée doit appartenir au souscripteur connecté.
          let plantationId: string | null = null;
          if (body.plantation_id) {
            const souscripteur = await getSouscripteur();
            const { data: ownedPlantation } = await supabase
              .from("plantations")
              .select("id")
              .eq("id", body.plantation_id)
              .eq("souscripteur_id", souscripteur?.id ?? "00000000-0000-0000-0000-000000000000")
              .maybeSingle();
            if (!ownedPlantation) {
              return new Response(JSON.stringify({ error: "Plantation introuvable" }), {
                status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
              });
            }
            plantationId = ownedPlantation.id;
          }

          const { error } = await supabase.from("tickets_techniques").insert({
            titre: body.titre,
            description: body.description,
            priorite: body.priorite || "moyenne",
            plantation_id: plantationId,
            cree_par: profile?.id || null,
          });

          if (error) throw error;

          // Notify hierarchy
          await supabase.rpc("notify_hierarchy", {
            p_type: "ticket",
            p_title: "Nouveau ticket support",
            p_message: `Ticket créé: ${body.titre}`,
            p_data: { ticket_titre: body.titre },
          });

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const { data: tickets } = await supabase
          .from("tickets_techniques")
          .select("*, plantations(id_unique, nom_plantation)")
          .eq("cree_par", profile?.id)
          .order("created_at", { ascending: false });

        return new Response(JSON.stringify({ tickets: tickets || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "profile": {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        const souscripteur = await getSouscripteur();

        return new Response(JSON.stringify({ profile, souscripteur }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Action non reconnue", actions_disponibles: [
          "dashboard", "paiement-history", "plantations", "geo-data", 
          "notifications", "mark-notification-read", "rapports-techniques", "tickets", "profile"
        ]}), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
  } catch (error: any) {
    console.error("Portal API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
