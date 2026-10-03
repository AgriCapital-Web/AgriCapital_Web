-- Finance RLS hardening: governance may see authorized finance indicators but not payroll details.
create or replace function public.finance_can_view() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role in ('super_admin','pdg','dg','comptable','responsable_operations','associe_actionnaire'));
$$;
create or replace function public.finance_can_manage() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role in ('super_admin','pdg','dg','comptable'));
$$;
create or replace function public.finance_can_view_payroll() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role in ('super_admin','pdg','dg','comptable'));
$$;
drop policy if exists finance_salary_profiles_select on public.finance_salary_profiles;
create policy finance_salary_profiles_select on public.finance_salary_profiles for select to authenticated using ((select public.finance_can_view_payroll()));
drop policy if exists finance_salary_profiles_manage on public.finance_salary_profiles;
create policy finance_salary_profiles_manage on public.finance_salary_profiles for all to authenticated using ((select public.finance_can_manage())) with check ((select public.finance_can_manage()));
drop policy if exists finance_payroll_runs_select on public.finance_payroll_runs;
create policy finance_payroll_runs_select on public.finance_payroll_runs for select to authenticated using ((select public.finance_can_view_payroll()));
drop policy if exists finance_payroll_runs_manage on public.finance_payroll_runs;
create policy finance_payroll_runs_manage on public.finance_payroll_runs for all to authenticated using ((select public.finance_can_manage())) with check ((select public.finance_can_manage()));
drop policy if exists finance_payroll_items_select on public.finance_payroll_items;
create policy finance_payroll_items_select on public.finance_payroll_items for select to authenticated using ((select public.finance_can_view_payroll()));
drop policy if exists finance_payroll_items_manage on public.finance_payroll_items;
create policy finance_payroll_items_manage on public.finance_payroll_items for all to authenticated using ((select public.finance_can_manage())) with check ((select public.finance_can_manage()));
