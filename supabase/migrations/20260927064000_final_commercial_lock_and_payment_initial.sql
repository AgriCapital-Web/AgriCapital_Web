-- 2026-09-27 : verrouillage commercial final et terminologie Paiement initial.
alter table public.paiements
  add column if not exists est_paiement_initial boolean not null default false;

update public.paiements
set est_paiement_initial=true
where coalesce(est_depot_initial,false)=true
  and coalesce(est_paiement_initial,false)=false;

update public.offres set
  montant_da_par_ha=0,
  montant_depot_initial_par_ha=90700,
  contribution_mensuelle_par_ha=83800,
  montant_cash_par_ha=2266000,
  montant_total_par_ha=2465200,
  duree_paiement_mois=40,
  tranches_paiement='[
    {"libelle":"Paiement initial","montant":90700,"mensualite_par_ha":90700,"mois":1},
    {"libelle":"Année 1","montant":350900,"mensualite_par_ha":31900,"mois":11},
    {"libelle":"Année 2","montant":682800,"mensualite_par_ha":56900,"mois":12},
    {"libelle":"Année 3","montant":1340800,"mensualite_par_ha":83800,"mois":16}
  ]'::jsonb,
  updated_at=now()
where code in ('palm-invest','palm-invest-plus');

update public.offres set
  montant_da_par_ha=0,
  montant_depot_initial_par_ha=84700,
  contribution_mensuelle_par_ha=49800,
  montant_cash_par_ha=1466200,
  montant_total_par_ha=1620200,
  duree_paiement_mois=40,
  tranches_paiement='[
    {"libelle":"Paiement initial","montant":84700,"mensualite_par_ha":84700,"mois":1},
    {"libelle":"Année 1","montant":295900,"mensualite_par_ha":26900,"mois":11},
    {"libelle":"Année 2","montant":442800,"mensualite_par_ha":36900,"mois":12},
    {"libelle":"Année 3","montant":796800,"mensualite_par_ha":49800,"mois":16}
  ]'::jsonb,
  updated_at=now()
where code in ('terra-palm','terra-palm-plus');

update public.offres set
  montant_da_par_ha=50000,
  montant_depot_initial_par_ha=50000,
  contribution_mensuelle_par_ha=3500,
  montant_cash_par_ha=356000,
  montant_total_par_ha=356000,
  duree_paiement_mois=37,
  tranches_paiement='[
    {"libelle":"Paiement après trouaison","montant":180000,"mensualite_par_ha":180000,"mois":1},
    {"libelle":"Encadrement technique","montant":126000,"mensualite_par_ha":3500,"mois":36}
  ]'::jsonb,
  updated_at=now()
where code='palm-terroir-essentielle';

update public.offres set
  montant_da_par_ha=65000,
  montant_depot_initial_par_ha=65000,
  contribution_mensuelle_par_ha=12600,
  montant_cash_par_ha=453600,
  montant_total_par_ha=518600,
  duree_paiement_mois=36,
  tranches_paiement='[
    {"libelle":"Paiement initial","montant":65000,"mensualite_par_ha":65000,"mois":1},
    {"libelle":"Mensualité","montant":453600,"mensualite_par_ha":12600,"mois":36}
  ]'::jsonb,
  updated_at=now()
where code='palm-terroir-flexible';

update public.paiements
set est_paiement_initial=true
where lower(coalesce(type_paiement,'')) in ('paiement_initial','paiement initial');

create or replace function public.client_should_be_active(_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  with s as (
    select s.*,o.contrat_acquisition_requis,o.contrat_accompagnement_requis
    from public.souscripteurs s
    left join public.offres o on o.id=s.offre_id
    where s.id=_id
  ),
  contracts as (
    select
      bool_and(type_contrat='acquisition_client' and statut='valide') filter (where type_contrat='acquisition_client') as acquisition_ok,
      bool_and(type_contrat='accompagnement_agricole' and statut='valide') filter (where type_contrat='accompagnement_agricole') as accompagnement_ok
    from public.client_contracts
    where souscripteur_id=_id
  ),
  pi as (
    select exists(
      select 1 from public.paiements p
      where p.souscripteur_id=_id
        and coalesce(p.est_paiement_initial,p.est_depot_initial,false)=true
        and lower(coalesce(p.statut,'')) in ('valide','paye','paid','success','successful','completed')
    ) as payment_ok
  )
  select coalesce((s.contrat_acquisition_requis=false or c.acquisition_ok=true),false)
     and coalesce((s.contrat_accompagnement_requis=false or c.accompagnement_ok=true),false)
     and s.documents_valides_at is not null
     and coalesce(pi.payment_ok,false)
  from s cross join contracts c cross join pi;
$$;

create or replace function public.refresh_client_account_activation(_souscripteur_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare should_activate boolean;
begin
  should_activate := public.client_should_be_active(_souscripteur_id);
  update public.souscripteurs
  set compte_actif=should_activate,
      statut_global=case when should_activate then 'actif' else statut_global end,
      updated_at=now()
  where id=_souscripteur_id;

  if should_activate then
    insert into public.client_account_provision_outbox(souscripteur_id)
    values(_souscripteur_id)
    on conflict do nothing;
  end if;
exception when others then
  raise warning 'refresh_client_account_activation failed for %: %',_souscripteur_id,sqlerrm;
end $$;
