-- Cover foreign keys identified by the database performance advisor.
CREATE INDEX IF NOT EXISTS idx_finance_associate_transactions_associate_id ON public.finance_associate_transactions (associate_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_client_id ON public.finance_expenses (client_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_plantation_id ON public.finance_expenses (plantation_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_profile_id ON public.finance_expenses (profile_id);
CREATE INDEX IF NOT EXISTS idx_finance_payroll_items_profile_id ON public.finance_payroll_items (profile_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_profile_id ON public.finance_transactions (profile_id);
CREATE INDEX IF NOT EXISTS idx_leads_departement_id ON public.leads (departement_id);
CREATE INDEX IF NOT EXISTS idx_leads_region_id ON public.leads (region_id);
CREATE INDEX IF NOT EXISTS idx_leads_sous_prefecture_id ON public.leads (sous_prefecture_id);
CREATE INDEX IF NOT EXISTS idx_leads_village_id ON public.leads (village_id);
