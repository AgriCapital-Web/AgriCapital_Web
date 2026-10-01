-- =====================================================
-- MIGRATION DE SÉCURITÉ: RLS Policies basées sur rôles
-- =====================================================

-- 1. Supprimer les anciennes policies trop permissives
DROP POLICY IF EXISTS "read_profiles" ON profiles;
DROP POLICY IF EXISTS "write_profiles" ON profiles;
DROP POLICY IF EXISTS "read_souscripteurs" ON souscripteurs;
DROP POLICY IF EXISTS "write_souscripteurs" ON souscripteurs;
DROP POLICY IF EXISTS "read_plantations" ON plantations;
DROP POLICY IF EXISTS "write_plantations" ON plantations;
DROP POLICY IF EXISTS "read_paiements" ON paiements;
DROP POLICY IF EXISTS "write_paiements" ON paiements;
DROP POLICY IF EXISTS "read_fedapay_events" ON fedapay_events;
DROP POLICY IF EXISTS "write_fedapay_events" ON fedapay_events;
DROP POLICY IF EXISTS "read_commissions" ON commissions;
DROP POLICY IF EXISTS "write_commissions" ON commissions;
DROP POLICY IF EXISTS "read_portefeuilles" ON portefeuilles;
DROP POLICY IF EXISTS "write_portefeuilles" ON portefeuilles;
DROP POLICY IF EXISTS "read_retraits" ON retraits_portefeuille;
DROP POLICY IF EXISTS "write_retraits" ON retraits_portefeuille;
DROP POLICY IF EXISTS "read_documents" ON documents;
DROP POLICY IF EXISTS "write_documents" ON documents;
DROP POLICY IF EXISTS "read_notes" ON notes;
DROP POLICY IF EXISTS "write_notes" ON notes;
DROP POLICY IF EXISTS "read_tickets" ON tickets_support;
DROP POLICY IF EXISTS "write_tickets" ON tickets_support;
DROP POLICY IF EXISTS "read_historique" ON historique_activites;
DROP POLICY IF EXISTS "write_historique" ON historique_activites;
DROP POLICY IF EXISTS "read_brouillons" ON souscriptions_brouillon;
DROP POLICY IF EXISTS "write_brouillons" ON souscriptions_brouillon;
DROP POLICY IF EXISTS "read_configurations" ON configurations_systeme;
DROP POLICY IF EXISTS "write_configurations" ON configurations_systeme;
DROP POLICY IF EXISTS "read_equipes" ON equipes;
DROP POLICY IF EXISTS "write_equipes" ON equipes;
DROP POLICY IF EXISTS "read_champs" ON champs_personnalises;
DROP POLICY IF EXISTS "write_champs" ON champs_personnalises;
DROP POLICY IF EXISTS "read_statuts" ON statuts_personnalises;
DROP POLICY IF EXISTS "write_statuts" ON statuts_personnalises;
DROP POLICY IF EXISTS "read_promotions" ON promotions;
DROP POLICY IF EXISTS "write_promotions" ON promotions;
DROP POLICY IF EXISTS "read_offres" ON offres;
DROP POLICY IF EXISTS "write_offres" ON offres;
DROP POLICY IF EXISTS "read_account_requests" ON account_requests;
DROP POLICY IF EXISTS "insert_account_requests" ON account_requests;
DROP POLICY IF EXISTS "update_account_requests" ON account_requests;

-- 2. Fonction helper pour vérifier si l'utilisateur est authentifié et a un rôle admin
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = public.current_profile_id()
      AND ur.role IN ('super_admin', 'directeur_tc', 'responsable_zone', 'comptable', 'commercial', 'service_client', 'operations')
  )
$$;

-- 3. Fonction pour vérifier si l'utilisateur est super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = public.current_profile_id()
      AND ur.role = 'super_admin'
  )
$$;

-- ===================
-- PROFILES TABLE
-- ===================
CREATE POLICY "authenticated_read_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (is_admin_or_staff() OR id = current_profile_id());

CREATE POLICY "authenticated_write_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = current_profile_id());

CREATE POLICY "admin_manage_profiles" ON profiles
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ===================
-- SOUSCRIPTEURS TABLE
-- ===================
CREATE POLICY "staff_read_souscripteurs" ON souscripteurs
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "staff_write_souscripteurs" ON souscripteurs
  FOR ALL TO authenticated
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ===================
-- PLANTATIONS TABLE
-- ===================
CREATE POLICY "staff_read_plantations" ON plantations
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "staff_write_plantations" ON plantations
  FOR ALL TO authenticated
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ===================
-- PAIEMENTS TABLE (garder les policies pour anon pour le portail client)
-- ===================
CREATE POLICY "staff_read_paiements" ON paiements
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "staff_write_paiements" ON paiements
  FOR ALL TO authenticated
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ===================
-- FEDAPAY_EVENTS TABLE
-- ===================
CREATE POLICY "admin_read_fedapay_events" ON fedapay_events
  FOR SELECT TO authenticated
  USING (is_super_admin() OR has_role(current_profile_id(), 'comptable'));

CREATE POLICY "admin_write_fedapay_events" ON fedapay_events
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ===================
-- COMMISSIONS TABLE
-- ===================
CREATE POLICY "user_read_own_commissions" ON commissions
  FOR SELECT TO authenticated
  USING (profile_id = current_profile_id() OR is_admin_or_staff());

CREATE POLICY "admin_write_commissions" ON commissions
  FOR ALL TO authenticated
  USING (is_super_admin() OR has_role(current_profile_id(), 'comptable'))
  WITH CHECK (is_super_admin() OR has_role(current_profile_id(), 'comptable'));

-- ===================
-- PORTEFEUILLES TABLE
-- ===================
CREATE POLICY "user_read_own_portefeuille" ON portefeuilles
  FOR SELECT TO authenticated
  USING (user_id = current_profile_id() OR is_admin_or_staff());

CREATE POLICY "admin_write_portefeuilles" ON portefeuilles
  FOR ALL TO authenticated
  USING (is_super_admin() OR has_role(current_profile_id(), 'comptable'))
  WITH CHECK (is_super_admin() OR has_role(current_profile_id(), 'comptable'));

-- ===================
-- RETRAITS_PORTEFEUILLE TABLE
-- ===================
CREATE POLICY "user_read_own_retraits" ON retraits_portefeuille
  FOR SELECT TO authenticated
  USING (user_id = current_profile_id() OR is_admin_or_staff());

CREATE POLICY "user_insert_own_retrait" ON retraits_portefeuille
  FOR INSERT TO authenticated
  WITH CHECK (user_id = current_profile_id());

CREATE POLICY "admin_write_retraits" ON retraits_portefeuille
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR has_role(current_profile_id(), 'comptable'));

-- ===================
-- DOCUMENTS TABLE
-- ===================
CREATE POLICY "staff_read_documents" ON documents
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "staff_write_documents" ON documents
  FOR ALL TO authenticated
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ===================
-- NOTES TABLE
-- ===================
CREATE POLICY "staff_read_notes" ON notes
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "staff_write_notes" ON notes
  FOR ALL TO authenticated
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ===================
-- TICKETS_SUPPORT TABLE
-- ===================
CREATE POLICY "staff_read_tickets" ON tickets_support
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "staff_write_tickets" ON tickets_support
  FOR ALL TO authenticated
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ===================
-- HISTORIQUE_ACTIVITES TABLE
-- ===================
CREATE POLICY "admin_read_historique" ON historique_activites
  FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE POLICY "staff_insert_historique" ON historique_activites
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_staff());

-- ===================
-- SOUSCRIPTIONS_BROUILLON TABLE
-- ===================
CREATE POLICY "user_read_own_brouillons" ON souscriptions_brouillon
  FOR SELECT TO authenticated
  USING (created_by = current_profile_id() OR is_admin_or_staff());

CREATE POLICY "user_write_own_brouillons" ON souscriptions_brouillon
  FOR ALL TO authenticated
  USING (created_by = current_profile_id() OR is_super_admin())
  WITH CHECK (created_by = current_profile_id() OR is_super_admin());

-- ===================
-- CONFIGURATIONS_SYSTEME TABLE
-- ===================
CREATE POLICY "staff_read_configurations" ON configurations_systeme
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "admin_write_configurations" ON configurations_systeme
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ===================
-- EQUIPES TABLE
-- ===================
CREATE POLICY "staff_read_equipes" ON equipes
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "admin_write_equipes" ON equipes
  FOR ALL TO authenticated
  USING (is_super_admin() OR has_role(current_profile_id(), 'directeur_tc'))
  WITH CHECK (is_super_admin() OR has_role(current_profile_id(), 'directeur_tc'));

-- ===================
-- CHAMPS_PERSONNALISES TABLE
-- ===================
CREATE POLICY "staff_read_champs" ON champs_personnalises
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "admin_write_champs" ON champs_personnalises
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ===================
-- STATUTS_PERSONNALISES TABLE
-- ===================
CREATE POLICY "staff_read_statuts" ON statuts_personnalises
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "admin_write_statuts" ON statuts_personnalises
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ===================
-- PROMOTIONS TABLE
-- ===================
CREATE POLICY "public_read_promotions" ON promotions
  FOR SELECT
  USING (active = true);

CREATE POLICY "staff_read_all_promotions" ON promotions
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "admin_write_promotions" ON promotions
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ===================
-- PROMOTIONS_OFFRES TABLE
-- ===================
DROP POLICY IF EXISTS "read_promotions_offres" ON promotions_offres;
DROP POLICY IF EXISTS "write_promotions_offres" ON promotions_offres;

CREATE POLICY "public_read_promotions_offres" ON promotions_offres
  FOR SELECT
  USING (true);

CREATE POLICY "admin_write_promotions_offres" ON promotions_offres
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ===================
-- OFFRES TABLE
-- ===================
CREATE POLICY "public_read_active_offres" ON offres
  FOR SELECT
  USING (actif = true);

CREATE POLICY "staff_read_all_offres" ON offres
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "admin_write_offres" ON offres
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ===================
-- ACCOUNT_REQUESTS TABLE
-- ===================
CREATE POLICY "public_insert_account_requests" ON account_requests
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "staff_read_account_requests" ON account_requests
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

CREATE POLICY "admin_update_account_requests" ON account_requests
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR has_role(current_profile_id(), 'directeur_tc'));

-- ===================
-- REGIONS, DISTRICTS, DEPARTEMENTS, SOUS_PREFECTURES, VILLAGES (lecture publique, écriture admin)
-- ===================
DROP POLICY IF EXISTS "read_regions" ON regions;
DROP POLICY IF EXISTS "write_regions" ON regions;
DROP POLICY IF EXISTS "read_districts" ON districts;
DROP POLICY IF EXISTS "write_districts" ON districts;
DROP POLICY IF EXISTS "read_departements" ON departements;
DROP POLICY IF EXISTS "write_departements" ON departements;
DROP POLICY IF EXISTS "read_sous_prefectures" ON sous_prefectures;
DROP POLICY IF EXISTS "write_sous_prefectures" ON sous_prefectures;
DROP POLICY IF EXISTS "read_villages" ON villages;
DROP POLICY IF EXISTS "write_villages" ON villages;

CREATE POLICY "public_read_regions" ON regions FOR SELECT USING (true);
CREATE POLICY "admin_write_regions" ON regions FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "public_read_districts" ON districts FOR SELECT USING (true);
CREATE POLICY "admin_write_districts" ON districts FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "public_read_departements" ON departements FOR SELECT USING (true);
CREATE POLICY "admin_write_departements" ON departements FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "public_read_sous_prefectures" ON sous_prefectures FOR SELECT USING (true);
CREATE POLICY "admin_write_sous_prefectures" ON sous_prefectures FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "public_read_villages" ON villages FOR SELECT USING (true);
CREATE POLICY "admin_write_villages" ON villages FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ===================
-- PARAMETRES_NOTIFICATIONS TABLE
-- ===================
DROP POLICY IF EXISTS "read_params_notif" ON parametres_notifications;
DROP POLICY IF EXISTS "write_params_notif" ON parametres_notifications;

CREATE POLICY "user_read_own_params" ON parametres_notifications
  FOR SELECT TO authenticated
  USING (user_id = current_profile_id() OR user_id IS NULL);

CREATE POLICY "user_write_own_params" ON parametres_notifications
  FOR ALL TO authenticated
  USING (user_id = current_profile_id() OR is_super_admin())
  WITH CHECK (user_id = current_profile_id() OR is_super_admin());

-- Enable Realtime for tables that aren't already added
DO $$
BEGIN
  -- Only add paiements if not already in realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'paiements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.paiements;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'souscripteurs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.souscripteurs;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'plantations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plantations;
  END IF;
END $$;