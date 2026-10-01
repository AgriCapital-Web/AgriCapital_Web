
-- 1. Add total_contributions_versees to souscripteurs
ALTER TABLE public.souscripteurs ADD COLUMN IF NOT EXISTS total_contributions_versees numeric DEFAULT 0;

-- 2. Enrich historique_activites for traceability (IP, user agent, details)
ALTER TABLE public.historique_activites ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.historique_activites ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.historique_activites ADD COLUMN IF NOT EXISTS details text;

-- 3. Create trigger function for automatic activity logging
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historique_activites (table_name, record_id, action, nouvelles_valeurs, created_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_setting('request.jwt.claims', true)::jsonb->>'sub');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.historique_activites (table_name, record_id, action, ancien_valeurs, nouvelles_valeurs, created_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_setting('request.jwt.claims', true)::jsonb->>'sub');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.historique_activites (table_name, record_id, action, ancien_valeurs, created_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), current_setting('request.jwt.claims', true)::jsonb->>'sub');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. Apply activity logging triggers to key tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'souscripteurs', 'plantations', 'paiements', 'offres', 'commissions',
    'documents', 'tickets_support', 'equipes', 'profiles', 'regions',
    'districts', 'departements', 'sous_prefectures', 'villages',
    'configurations_systeme', 'promotions', 'remboursements',
    'cotitulaires', 'champs_personnalises', 'statuts_personnalises',
    'parametres_notifications'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_activity ON public.%I', tbl);
    EXECUTE format('
      CREATE TRIGGER trg_log_activity
      AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.log_activity()
    ', tbl);
  END LOOP;
END;
$$;

-- 5. Create trigger to auto-update total_contributions_versees on payment changes
CREATE OR REPLACE FUNCTION public.update_souscripteur_contributions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  total_contributions NUMERIC;
  sous_id UUID;
BEGIN
  sous_id := COALESCE(NEW.souscripteur_id, OLD.souscripteur_id);
  IF sous_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  
  SELECT COALESCE(SUM(montant_paye), 0) INTO total_contributions
  FROM public.paiements
  WHERE souscripteur_id = sous_id
    AND statut = 'valide'
    AND type_paiement = 'REDEVANCE';

  UPDATE public.souscripteurs
  SET total_contributions_versees = total_contributions,
      updated_at = now()
  WHERE id = sous_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_contributions ON public.paiements;
CREATE TRIGGER trg_update_contributions
AFTER INSERT OR UPDATE OR DELETE ON public.paiements
FOR EACH ROW EXECUTE FUNCTION public.update_souscripteur_contributions();

-- 6. Allow staff to read all activity history
DROP POLICY IF EXISTS "admin_read_historique" ON public.historique_activites;
CREATE POLICY "staff_read_historique" ON public.historique_activites
FOR SELECT USING (is_admin_or_staff());
