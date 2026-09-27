-- 2026-09-27 : activation automatique du compte client après validation complète.

alter table public.souscripteurs
  add column if not exists documents_valides_at timestamptz;

create or replace function public.client_should_be_active(_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  with s as (
    select s.*,o.contrat_acquisition_requis,o.contrat_accompagnement_requis
    from public.souscripteurs s left join public.offres o on o.id=s.offre_id where s.id=_id
  ),
  contracts as (
    select
      bool_and(type_contrat='acquisition_client' and statut='valide') filter (where type_contrat='acquisition_client') as acquisition_ok,
      bool_and(type_contrat='accompagnement_agricole' and statut='valide') filter (where type_contrat='accompagnement_agricole') as accompagnement_ok
    from public.client_contracts where souscripteur_id=_id
  ),
  pi as (
    select exists(
      select 1 from public.paiements p
      where p.souscripteur_id=_id
        and p.est_depot_initial=true
        and lower(coalesce(p.statut,'')) in ('valide','paye','paid','success','successful','completed')
    ) as payment_ok
  )
  select coalesce((s.contrat_acquisition_requis=false or c.acquisition_ok=true),false)
     and coalesce((s.contrat_accompagnement_requis=false or c.accompagnement_ok=true),false)
     and s.documents_valides_at is not null
     and coalesce(pi.payment_ok, false)
  from s cross join contracts c cross join pi;
$$;

create or replace function public.refresh_client_account_activation(_souscripteur_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare should_activate boolean;
begin
  should_activate := public.client_should_be_active(_souscripteur_id);
  update public.souscripteurs
  set compte_actif=should_activate, statut_global=case when should_activate then 'actif' else statut_global end, updated_at=now()
  where id=_souscripteur_id;

  if should_activate then
    perform net.http_post(
      url:='https://rfzfsmpsuempafhkqhra.supabase.co/functions/v1/provision-client-account',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'x-agricapital-account-secret',(select decrypted_secret from vault.decrypted_secrets where name='notification_cron_secret' limit 1)
      ),
      body:=jsonb_build_object('souscripteur_id',_souscripteur_id),
      timeout_milliseconds:=5000
    );
  end if;
exception when others then
  raise warning 'refresh_client_account_activation failed for %: %',_souscripteur_id,sqlerrm;
end $$;

create or replace function public.trg_refresh_activation_contract()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_client_account_activation(new.souscripteur_id);
  return new;
end $$;

drop trigger if exists trg_refresh_activation_contract on public.client_contracts;
create trigger trg_refresh_activation_contract after insert or update of statut on public.client_contracts
for each row execute function public.trg_refresh_activation_contract();

create or replace function public.trg_refresh_activation_payment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.est_depot_initial=true then
    if lower(coalesce(new.statut,'')) in ('valide','paye','paid','success','successful','completed') then
      update public.souscripteurs set paiement_initial_paye_at=coalesce(paiement_initial_paye_at,now()),updated_at=now() where id=new.souscripteur_id;
    end if;
    perform public.refresh_client_account_activation(new.souscripteur_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_refresh_activation_payment on public.paiements;
create trigger trg_refresh_activation_payment after insert or update of statut on public.paiements
for each row execute function public.trg_refresh_activation_payment();
