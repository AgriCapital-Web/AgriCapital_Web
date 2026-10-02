-- Service Client may create a lead for a commercial terrain.
create or replace function private.can_service_assign_lead(_actor uuid, _target uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    exists (
      select 1 from public.user_roles ur
      where ur.user_id=_actor and ur.role in ('service_client','chef_equipe_service_client')
    )
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id=_target and ur.role in ('commercial','chef_equipe_commercial','responsable_commercial','super_admin')
    );
$$;

revoke all on function private.can_service_assign_lead(uuid,uuid) from public;
grant execute on function private.can_service_assign_lead(uuid,uuid) to authenticated;

drop policy if exists "Staff create owned leads" on public.leads;
create policy "Staff create owned leads"
on public.leads for insert to authenticated
with check (
  private.is_staff(auth.uid())
  and created_by=auth.uid()
  and (
    assigned_to is null
    or assigned_to=auth.uid()
    or private.can_supervise_leads(auth.uid())
    or private.can_service_assign_lead(auth.uid(), assigned_to)
  )
);