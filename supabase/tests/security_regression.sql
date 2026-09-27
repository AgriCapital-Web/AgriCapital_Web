-- AgriCapital security regression checks.
DO $$
DECLARE v_count integer;
BEGIN
  IF to_regclass('public.clients') IS NULL THEN RAISE EXCEPTION 'Canonical client table missing'; END IF;

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