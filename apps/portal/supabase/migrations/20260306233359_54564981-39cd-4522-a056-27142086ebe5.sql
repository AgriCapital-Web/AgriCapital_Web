
-- ===== 1. MISSING FOREIGN KEYS =====
-- Ensure proper FK constraints exist (most already exist, adding missing ones)

-- commissions.valide_par -> profiles.id (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_valide_par_fkey') THEN
    ALTER TABLE public.commissions ADD CONSTRAINT commissions_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES auth.users(id);
  END IF;
END $$;

-- paiements.created_by -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paiements_created_by_fkey') THEN
    ALTER TABLE public.paiements ADD CONSTRAINT paiements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- paiements.valide_par -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paiements_valide_par_fkey') THEN
    ALTER TABLE public.paiements ADD CONSTRAINT paiements_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES auth.users(id);
  END IF;
END $$;

-- souscripteurs.created_by -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'souscripteurs_created_by_fkey') THEN
    ALTER TABLE public.souscripteurs ADD CONSTRAINT souscripteurs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- souscripteurs.user_id -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'souscripteurs_user_id_fkey') THEN
    ALTER TABLE public.souscripteurs ADD CONSTRAINT souscripteurs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- profiles.user_id -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_roles.user_id -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- tickets_techniques.cree_par -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_techniques_cree_par_fkey') THEN
    ALTER TABLE public.tickets_techniques ADD CONSTRAINT tickets_techniques_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES auth.users(id);
  END IF;
END $$;

-- tickets_techniques.assigne_a -> profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_techniques_assigne_a_fkey') THEN
    ALTER TABLE public.tickets_techniques ADD CONSTRAINT tickets_techniques_assigne_a_fkey FOREIGN KEY (assigne_a) REFERENCES public.profiles(id);
  END IF;
END $$;

-- notifications.user_id -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- historique_activites.user_id -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'historique_activites_user_id_fkey') THEN
    ALTER TABLE public.historique_activites ADD CONSTRAINT historique_activites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- portefeuilles.user_id -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portefeuilles_user_id_fkey') THEN
    ALTER TABLE public.portefeuilles ADD CONSTRAINT portefeuilles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- retraits_portefeuille.user_id -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retraits_portefeuille_user_id_fkey') THEN
    ALTER TABLE public.retraits_portefeuille ADD CONSTRAINT retraits_portefeuille_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- retraits_portefeuille.traite_par -> auth.users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retraits_portefeuille_traite_par_fkey') THEN
    ALTER TABLE public.retraits_portefeuille ADD CONSTRAINT retraits_portefeuille_traite_par_fkey FOREIGN KEY (traite_par) REFERENCES auth.users(id);
  END IF;
END $$;

-- villages.sous_prefecture_id FK already exists

-- ===== 2. PERFORMANCE INDEXES =====

-- Paiements: most queried table
CREATE INDEX IF NOT EXISTS idx_paiements_souscripteur_id ON public.paiements(souscripteur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_plantation_id ON public.paiements(plantation_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON public.paiements(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_type_paiement ON public.paiements(type_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_date_paiement ON public.paiements(date_paiement DESC);
CREATE INDEX IF NOT EXISTS idx_paiements_reference ON public.paiements(reference);
CREATE INDEX IF NOT EXISTS idx_paiements_composite_souscripteur_statut ON public.paiements(souscripteur_id, statut, type_paiement);

-- Plantations
CREATE INDEX IF NOT EXISTS idx_plantations_souscripteur_id ON public.plantations(souscripteur_id);
CREATE INDEX IF NOT EXISTS idx_plantations_statut ON public.plantations(statut);
CREATE INDEX IF NOT EXISTS idx_plantations_region_id ON public.plantations(region_id);
CREATE INDEX IF NOT EXISTS idx_plantations_date_activation ON public.plantations(date_activation);

-- Souscripteurs
CREATE INDEX IF NOT EXISTS idx_souscripteurs_telephone ON public.souscripteurs(telephone);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_user_id ON public.souscripteurs(user_id);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_offre_id ON public.souscripteurs(offre_id);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_statut ON public.souscripteurs(statut);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_id_unique ON public.souscripteurs(id_unique);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- User roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_equipe_id ON public.profiles(equipe_id);

-- Historique
CREATE INDEX IF NOT EXISTS idx_historique_table_record ON public.historique_activites(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_historique_user_id ON public.historique_activites(user_id);
CREATE INDEX IF NOT EXISTS idx_historique_created_at ON public.historique_activites(created_at DESC);

-- Commissions
CREATE INDEX IF NOT EXISTS idx_commissions_profile_id ON public.commissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_commissions_plantation_id ON public.commissions(plantation_id);
CREATE INDEX IF NOT EXISTS idx_commissions_statut ON public.commissions(statut);

-- Geo tables
CREATE INDEX IF NOT EXISTS idx_regions_district_id ON public.regions(district_id);
CREATE INDEX IF NOT EXISTS idx_departements_region_id ON public.departements(region_id);
CREATE INDEX IF NOT EXISTS idx_sous_prefectures_departement_id ON public.sous_prefectures(departement_id);
CREATE INDEX IF NOT EXISTS idx_villages_sous_prefecture_id ON public.villages(sous_prefecture_id);

-- Account requests
CREATE INDEX IF NOT EXISTS idx_account_requests_statut ON public.account_requests(statut);
CREATE INDEX IF NOT EXISTS idx_account_requests_email ON public.account_requests(email);

-- ===== 3. UNIQUE CONSTRAINTS =====
-- Ensure no duplicate souscripteurs by phone
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'souscripteurs_telephone_unique') THEN
    ALTER TABLE public.souscripteurs ADD CONSTRAINT souscripteurs_telephone_unique UNIQUE (telephone);
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate telephones exist, skipping unique constraint';
END $$;

-- Unique id_unique for souscripteurs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'souscripteurs_id_unique_unique') THEN
    ALTER TABLE public.souscripteurs ADD CONSTRAINT souscripteurs_id_unique_unique UNIQUE (id_unique);
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate id_unique exist, skipping';
END $$;

-- Unique id_unique for plantations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plantations_id_unique_unique') THEN
    ALTER TABLE public.plantations ADD CONSTRAINT plantations_id_unique_unique UNIQUE (id_unique);
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate id_unique exist, skipping';
END $$;

-- Unique user_id for profiles (one profile per user)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate user_id in profiles, skipping';
END $$;

-- Unique user_id for portefeuilles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portefeuilles_user_id_unique') THEN
    ALTER TABLE public.portefeuilles ADD CONSTRAINT portefeuilles_user_id_unique UNIQUE (user_id);
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate user_id in portefeuilles, skipping';
END $$;

-- ===== 4. TRIGGERS: updated_at automation =====
-- Ensure all tables with updated_at have the trigger

DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'souscripteurs', 'plantations', 'paiements', 'profiles', 'commissions',
    'offres', 'equipes', 'notifications', 'promotions', 'tickets_techniques',
    'account_requests', 'portefeuilles'
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'set_updated_at_' || tbl 
      AND tgrelid = ('public.' || tbl)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ===== 5. RATE LIMITING TABLE =====
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL DEFAULT 'login',
  attempts integer NOT NULL DEFAULT 1,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits(identifier, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON public.rate_limits(blocked_until);

-- RLS for rate_limits - only edge functions (service role) should access
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate limits" ON public.rate_limits
  FOR ALL USING (true) WITH CHECK (true);

-- Cleanup function for old rate limit entries
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE first_attempt_at < now() - interval '1 hour';
$$;

-- ===== 6. VALIDATION TRIGGER: paiements.montant > 0 =====
CREATE OR REPLACE FUNCTION public.validate_paiement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du paiement doit être positif';
  END IF;
  IF NEW.montant_paye IS NOT NULL AND NEW.montant_paye < 0 THEN
    RAISE EXCEPTION 'Le montant payé ne peut pas être négatif';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_paiement_trigger ON public.paiements;
CREATE TRIGGER validate_paiement_trigger
  BEFORE INSERT OR UPDATE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION validate_paiement();

-- ===== 7. VALIDATION TRIGGER: plantations.superficie_ha >= 0 =====
CREATE OR REPLACE FUNCTION public.validate_plantation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.superficie_ha IS NOT NULL AND NEW.superficie_ha < 0 THEN
    RAISE EXCEPTION 'La superficie ne peut pas être négative';
  END IF;
  IF NEW.superficie_activee IS NOT NULL AND NEW.superficie_activee < 0 THEN
    RAISE EXCEPTION 'La superficie activée ne peut pas être négative';
  END IF;
  IF NEW.superficie_activee IS NOT NULL AND NEW.superficie_ha IS NOT NULL AND NEW.superficie_activee > NEW.superficie_ha THEN
    RAISE EXCEPTION 'La superficie activée ne peut pas dépasser la superficie totale';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_plantation_trigger ON public.plantations;
CREATE TRIGGER validate_plantation_trigger
  BEFORE INSERT OR UPDATE ON public.plantations
  FOR EACH ROW EXECUTE FUNCTION validate_plantation();
