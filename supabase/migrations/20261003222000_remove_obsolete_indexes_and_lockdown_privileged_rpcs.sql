-- Remove confirmed duplicate indexes.
DROP INDEX IF EXISTS public.idx_clients_created_by;
DROP INDEX IF EXISTS public.idx_paiements_client_scope;

-- Ensure this reporting view evaluates with the querying user's privileges/RLS.
ALTER VIEW public.v_performance_equipes SET (security_invoker = true);

-- No privileged SECURITY DEFINER RPC should be callable by anonymous users.
REVOKE EXECUTE ON FUNCTION public.calculate_convention_parts_and_lots() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_client_parcel_from_technical() FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_can_manage() FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_can_view() FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_can_view_payroll() FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_sync_commission() FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_sync_payment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_sync_salary_payment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_convention_lots() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_default_commercial_for_client(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_lead_commercial_for_conversion(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.normalize_lead_form_values() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_user_role_coverage_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_technicien_zone(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_palminvest_lot_activation() FROM anon;
