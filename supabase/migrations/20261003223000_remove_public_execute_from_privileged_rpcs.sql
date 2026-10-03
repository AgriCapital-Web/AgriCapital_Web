-- SECURITY DEFINER RPCs must not inherit PUBLIC EXECUTE.
-- Keep these internal RPCs available to authenticated CRM users only.
REVOKE EXECUTE ON FUNCTION public.calculate_convention_parts_and_lots() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_client_parcel_from_technical() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_can_manage() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_can_view() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_can_view_payroll() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_sync_commission() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_sync_payment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_sync_salary_payment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_convention_lots() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_default_commercial_for_client(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_lead_commercial_for_conversion(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_lead_form_values() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_user_role_coverage_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_technicien_zone(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_palminvest_lot_activation() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.calculate_convention_parts_and_lots() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_client_parcel_from_technical() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_can_manage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_can_view() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_can_view_payroll() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_sync_commission() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_sync_payment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_sync_salary_payment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_convention_lots() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_commercial_for_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_commercial_for_conversion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_lead_form_values() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_user_role_coverage_trigger() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_technicien_zone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_palminvest_lot_activation() TO authenticated;
