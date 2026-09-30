-- Harden trigger-only functions: fixed search_path and no direct RPC execution.
ALTER FUNCTION public.normalize_person_names() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.protect_root_accounts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_root_user_roles() FROM PUBLIC, anon, authenticated;
