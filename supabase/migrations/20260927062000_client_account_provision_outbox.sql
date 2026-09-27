-- 2026-09-27 : provisionnement du compte client via worker interne.
create table if not exists public.client_account_provision_outbox (
  id uuid primary key default gen_random_uuid(),
  souscripteur_id uuid not null references public.souscripteurs(id) on delete cascade,
  statut text not null default 'en_attente' check(statut in ('en_attente','traite','echoue')),
  tentatives integer not null default 0,
  derniere_erreur text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index if not exists uq_client_account_provision_pending on public.client_account_provision_outbox(souscripteur_id) where statut='en_attente';

create or replace function public.refresh_client_account_activation(_souscripteur_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare should_activate boolean;
begin
  should_activate := public.client_should_be_active(_souscripteur_id);
  update public.souscripteurs
  set compte_actif=should_activate, statut_global=case when should_activate then 'actif' else statut_global end, updated_at=now()
  where id=_souscripteur_id;

  if should_activate then
    insert into public.client_account_provision_outbox(souscripteur_id)
    values(_souscripteur_id)
    on conflict do nothing;
  end if;
exception when others then
  raise warning 'refresh_client_account_activation failed for %: %',_souscripteur_id,sqlerrm;
end $$;
