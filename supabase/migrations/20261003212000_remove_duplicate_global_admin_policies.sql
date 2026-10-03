-- Remove the duplicate global_admin_total_access policy.
-- global_admin_full_access is the single canonical global-admin RLS policy.
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname,tablename,policyname
    FROM pg_policies
    WHERE schemaname='public' AND policyname='global_admin_total_access'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$do$;