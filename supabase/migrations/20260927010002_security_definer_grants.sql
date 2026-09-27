REVOKE ALL ON FUNCTION public.is_finance_staff(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_finance_staff(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_rh(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_rh(uuid) TO service_role;
