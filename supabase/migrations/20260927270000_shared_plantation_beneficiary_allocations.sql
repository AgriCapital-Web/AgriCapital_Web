-- Shared agricultural block / multiple beneficiary allocations
-- 2026-09-27
create table if not exists public.beneficiaire_attributions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  parcelle_id uuid not null references public.parcelles(id) on delete restrict,
  plantation_id uuid references public.plantations(id) on delete set null,
  surface_attribuee_ha numeric(12,4) not null check (surface_attribuee_ha > 0),
  role_attribution text not null default 'beneficiaire',
  statut text not null default 'active',
  reference_acte text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_beneficiaire_attributions_client on public.beneficiaire_attributions(client_id);
create index if not exists idx_beneficiaire_attributions_parcelle on public.beneficiaire_attributions(parcelle_id);
create index if not exists idx_beneficiaire_attributions_plantation on public.beneficiaire_attributions(plantation_id);

alter table public.beneficiaire_attributions enable row level security;

drop policy if exists "staff_manage_beneficiaire_attributions" on public.beneficiaire_attributions;
create policy "staff_manage_beneficiaire_attributions"
on public.beneficiaire_attributions
for all to authenticated
using ((select public.is_staff(auth.uid())))
with check ((select public.is_staff(auth.uid())));

create or replace function public.validate_beneficiaire_attribution()
returns trigger
language plpgsql
security definer
set search_path='public'
as $function$
declare v_total numeric;
begin
  select coalesce(sum(surface_attribuee_ha),0) into v_total
  from public.beneficiaire_attributions
  where parcelle_id=new.parcelle_id and id<>new.id and statut='active';

  if v_total + new.surface_attribuee_ha >
     (select surface_totale_ha from public.parcelles where id=new.parcelle_id) then
    raise exception 'La somme des superficies attribuées dépasse la superficie de la parcelle';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_beneficiaire_attribution on public.beneficiaire_attributions;
create trigger trg_validate_beneficiaire_attribution
before insert or update on public.beneficiaire_attributions
for each row execute function public.validate_beneficiaire_attribution();
