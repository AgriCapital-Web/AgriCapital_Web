-- Global access for Super Admin and PDG plus permanent-account protection.
create schema if not exists private;
create or replace function private.is_global_admin(_user_id uuid)
returns boolean language sql security definer stable set search_path=''
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role in ('super_admin','pdg')); $$;
revoke all on function private.is_global_admin(uuid) from public;
grant execute on function private.is_global_admin(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['clients','plantations','paiements','beneficiaire_attributions','interventions_techniques'] loop
    execute format('drop policy if exists "global_admin_full_access" on public.%I',t);
    execute format('create policy "global_admin_full_access" on public.%I for all to authenticated using ((select private.is_global_admin(auth.uid()))) with check ((select private.is_global_admin(auth.uid())))',t);
  end loop;
end $$;

insert into public.role_permissions(role_code,permission_code)
select r.role_code,p.permission_code
from (values ('super_admin'),('pdg')) r(role_code)
cross join (values ('clients.view'),('clients.create'),('clients.update'),('clients.archive'),('paiements.view'),('paiements.create'),('paiements.validate'),('plantations.view'),('plantations.create'),('plantations.update'),('commissions.view'),('commissions.manage_payouts'),('portefeuilles.view'),('portefeuilles.manage_payouts'),('parametres.view'),('parametres.manage_users')) p(permission_code)
where not exists(select 1 from public.role_permissions x where x.role_code=r.role_code and x.permission_code=p.permission_code);

create or replace function private.protect_immutable_admin()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(NEW.id,OLD.id) in ('8d616fdc-6f25-43e9-baaa-51ead746222e'::uuid,'bd9579fd-1d07-4431-9cc4-b57dfeeab593'::uuid) then
    if TG_TABLE_NAME='profiles' and TG_OP='DELETE' then raise exception 'Compte administratif permanent protégé'; end if;
    if TG_TABLE_NAME='profiles' and TG_OP='UPDATE' and coalesce(NEW.actif,true)=false then raise exception 'Compte administratif permanent : révocation interdite'; end if;
    if TG_TABLE_NAME='user_roles' then raise exception 'Rôles du compte administratif permanent protégés'; end if;
  end if;
  return coalesce(NEW,OLD);
end $$;
drop trigger if exists trg_protect_immutable_profiles on public.profiles;
create trigger trg_protect_immutable_profiles before update or delete on public.profiles for each row execute function private.protect_immutable_admin();
drop trigger if exists trg_protect_immutable_user_roles on public.user_roles;
create trigger trg_protect_immutable_user_roles before insert or update or delete on public.user_roles for each row execute function private.protect_immutable_admin();
