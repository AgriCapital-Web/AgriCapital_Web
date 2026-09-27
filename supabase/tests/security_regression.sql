-- AgriCapital security regression checks.
-- Run against a linked/staging database before production release.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema='public'
    AND table_name IN ('souscripteurs','documents_souscription','souscription_lots','souscriptions_brouillon');
  IF v_count <> 0 THEN RAISE EXCEPTION 'Legacy business tables remain: %',v_count; END IF;

  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema='public'
    AND column_name IN ('souscripteur_id','souscripteur_dest_id','souscripteur_source_id','type_souscripteur','type_souscripteur_foncier','technicien_id','technicien_nom');
  IF v_count <> 0 THEN RAISE EXCEPTION 'Legacy business columns remain: %',v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef=true
    AND has_function_privilege('authenticated',p.oid,'EXECUTE');
  IF v_count <> 0 THEN RAISE EXCEPTION 'SECURITY DEFINER functions executable by authenticated: %',v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Public tables without RLS: %',v_count; END IF;
END $$;