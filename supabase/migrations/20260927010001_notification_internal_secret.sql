CREATE OR REPLACE FUNCTION public.notification_get_internal_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'notification_cron_secret'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.notification_get_internal_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_get_internal_secret() TO service_role;
