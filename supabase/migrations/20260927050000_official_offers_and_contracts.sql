-- 2026-09-27 : bascule commerciale officielle AgriCapital
-- Remplace le parcours AgriPlan par 3 offres / 6 formules :
-- PalmInvest, PalmInvest+, TerraPalm, TerraPalm+, PalmTerroir Essentielle, PalmTerroir Flexible.

alter table public.offres
  add column if not exists famille_offre text,
  add column if not exists formule_code text,
  add column if not exists formule_nom text,
  add column if not exists contrat_acquisition_requis boolean not null default true,
  add column if not exists contrat_accompagnement_requis boolean not null default true,
  add column if not exists necessite_foncier_client boolean not null default false,
  add column if not exists necessite_cotitulaire boolean not null default true,
  add column if not exists parcours_code text;

-- Désactivation des anciennes références commerciales : elles restent en historique
-- pour ne pas casser les anciens dossiers, mais ne sont plus proposées.
update public.offres
set actif=false, updated_at=now()
where lower(code) in ('palmelite','palm-elite','agriplan','agri-plan');

-- PalmInvest / PalmInvest+
insert into public.offres (
  code,nom,description,actif,ordre,type_offre,gestion_type,famille_offre,formule_code,formule_nom,
  contrat_acquisition_requis,contrat_accompagnement_requis,necessite_foncier_client,necessite_cotitulaire,parcours_code,
  montant_da_par_ha,montant_depot_initial_par_ha,contribution_mensuelle_par_ha,montant_cash_par_ha,montant_total_par_ha,
  duree_paiement_mois,duree_installation_mois,duree_production_ans,tranches_paiement,avantages
) values
(
  'palm-invest','PalmInvest',
  'Plantation clé en main, sans terre préalable, remise après 36 mois — propriété 28 ans.',
  true,1,'sans_terre','propre','PALMINVEST','PALMINVEST','PalmInvest',
  true,true,false,true,'PALMINVEST',
  90700,90700,83800,2266000,2465200,40,36,28,
  '[{"libelle":"Paiement initial","montant":90700,"mois":"M1"},{"libelle":"Année 1","montant":350900,"mensualite":31900,"mois":"M2-M12"},{"libelle":"Année 2","montant":682800,"mensualite":56900,"mois":"M13-M24"},{"libelle":"Année 3","montant":1340800,"mensualite":83800,"mois":"M25-M40"}]',
  '["Plantation clé en main","Sans terre préalable","Patrimoine actif à 36 mois","Gestion par vos soins","Exploitation autonome","Reporting et suivi digital","Revenus sur votre compte"]'::jsonb
)
on conflict(code) do update set
  nom=excluded.nom,description=excluded.description,actif=true,ordre=excluded.ordre,type_offre=excluded.type_offre,
  gestion_type=excluded.gestion_type,famille_offre=excluded.famille_offre,formule_code=excluded.formule_code,
  formule_nom=excluded.formule_nom,contrat_acquisition_requis=excluded.contrat_acquisition_requis,
  contrat_accompagnement_requis=excluded.contrat_accompagnement_requis,necessite_foncier_client=excluded.necessite_foncier_client,
  necessite_cotitulaire=excluded.necessite_cotitulaire,parcours_code=excluded.parcours_code,montant_da_par_ha=excluded.montant_da_par_ha,
  montant_depot_initial_par_ha=excluded.montant_depot_initial_par_ha,contribution_mensuelle_par_ha=excluded.contribution_mensuelle_par_ha,
  montant_cash_par_ha=excluded.montant_cash_par_ha,montant_total_par_ha=excluded.montant_total_par_ha,
  duree_paiement_mois=excluded.duree_paiement_mois,duree_installation_mois=excluded.duree_installation_mois,
  duree_production_ans=excluded.duree_production_ans,tranches_paiement=excluded.tranches_paiement,avantages=excluded.avantages,updated_at=now();

insert into public.offres (
  code,nom,description,actif,ordre,type_offre,gestion_type,famille_offre,formule_code,formule_nom,
  contrat_acquisition_requis,contrat_accompagnement_requis,necessite_foncier_client,necessite_cotitulaire,parcours_code,
  montant_da_par_ha,montant_depot_initial_par_ha,contribution_mensuelle_par_ha,montant_cash_par_ha,montant_total_par_ha,
  duree_paiement_mois,duree_installation_mois,duree_production_ans,tranches_paiement,avantages
) values
(
  'palm-invest-plus','PalmInvest+',
  'Plantation clé en main, sans terre préalable, gestion intégrale déléguée — propriété 28 ans.',
  true,2,'sans_terre','deleguee','PALMINVEST','PALMINVEST_PLUS','PalmInvest+',
  true,true,false,true,'PALMINVEST',
  90700,90700,83800,2266000,2465200,40,36,28,
  '[{"libelle":"Paiement initial","montant":90700,"mois":"M1"},{"libelle":"Année 1","montant":350900,"mensualite":31900,"mois":"M2-M12"},{"libelle":"Année 2","montant":682800,"mensualite":56900,"mois":"M13-M24"},{"libelle":"Année 3","montant":1340800,"mensualite":83800,"mois":"M25-M40"}]',
  '["Plantation clé en main","Gestion intégrale déléguée","Patrimoine actif à 36 mois","Reporting et suivi digital","Revenus sur votre compte"]'::jsonb
)
on conflict(code) do update set
  nom=excluded.nom,description=excluded.description,actif=true,ordre=excluded.ordre,type_offre=excluded.type_offre,
  gestion_type=excluded.gestion_type,famille_offre=excluded.famille_offre,formule_code=excluded.formule_code,formule_nom=excluded.formule_nom,
  contrat_acquisition_requis=excluded.contrat_acquisition_requis,contrat_accompagnement_requis=excluded.contrat_accompagnement_requis,
  necessite_foncier_client=excluded.necessite_foncier_client,necessite_cotitulaire=excluded.necessite_cotitulaire,parcours_code=excluded.parcours_code,
  montant_da_par_ha=excluded.montant_da_par_ha,montant_depot_initial_par_ha=excluded.montant_depot_initial_par_ha,
  contribution_mensuelle_par_ha=excluded.contribution_mensuelle_par_ha,montant_cash_par_ha=excluded.montant_cash_par_ha,
  montant_total_par_ha=excluded.montant_total_par_ha,duree_paiement_mois=excluded.duree_paiement_mois,
  duree_installation_mois=excluded.duree_installation_mois,duree_production_ans=excluded.duree_production_ans,
  tranches_paiement=excluded.tranches_paiement,avantages=excluded.avantages,updated_at=now();

-- TerraPalm / TerraPalm+
insert into public.offres (
  code,nom,description,actif,ordre,type_offre,gestion_type,famille_offre,formule_code,formule_nom,
  contrat_acquisition_requis,contrat_accompagnement_requis,necessite_foncier_client,necessite_cotitulaire,parcours_code,
  montant_da_par_ha,montant_depot_initial_par_ha,contribution_mensuelle_par_ha,montant_cash_par_ha,montant_total_par_ha,
  duree_paiement_mois,duree_installation_mois,duree_production_ans,tranches_paiement,avantages
) values
(
  'terra-palm','TerraPalm',
  'Vous avez la terre, nous en faisons une plantation productive en 36 mois — 100% propriété.',
  true,3,'avec_terre','propre','TERRAPALM','TERRAPALM','TerraPalm',
  true,true,true,true,'TERRAPALM',
  84700,84700,49800,1466200,1620200,40,36,28,
  '[{"libelle":"Paiement initial","montant":84700,"mois":"M1"},{"libelle":"Année 1","montant":295900,"mensualite":26900,"mois":"M2-M12"},{"libelle":"Année 2","montant":442800,"mensualite":36900,"mois":"M13-M24"},{"libelle":"Année 3","montant":796800,"mensualite":49800,"mois":"M25-M40"}]',
  '["Votre terre reste la vôtre","Plantation clé en main","Exploitation autonome","Reporting et suivi digital","Revenus sur votre compte"]'::jsonb
)
on conflict(code) do update set
  nom=excluded.nom,description=excluded.description,actif=true,ordre=excluded.ordre,type_offre=excluded.type_offre,
  gestion_type=excluded.gestion_type,famille_offre=excluded.famille_offre,formule_code=excluded.formule_code,formule_nom=excluded.formule_nom,
  contrat_acquisition_requis=excluded.contrat_acquisition_requis,contrat_accompagnement_requis=excluded.contrat_accompagnement_requis,
  necessite_foncier_client=excluded.necessite_foncier_client,necessite_cotitulaire=excluded.necessite_cotitulaire,parcours_code=excluded.parcours_code,
  montant_da_par_ha=excluded.montant_da_par_ha,montant_depot_initial_par_ha=excluded.montant_depot_initial_par_ha,
  contribution_mensuelle_par_ha=excluded.contribution_mensuelle_par_ha,montant_cash_par_ha=excluded.montant_cash_par_ha,
  montant_total_par_ha=excluded.montant_total_par_ha,duree_paiement_mois=excluded.duree_paiement_mois,
  duree_installation_mois=excluded.duree_installation_mois,duree_production_ans=excluded.duree_production_ans,
  tranches_paiement=excluded.tranches_paiement,avantages=excluded.avantages,updated_at=now();

insert into public.offres (
  code,nom,description,actif,ordre,type_offre,gestion_type,famille_offre,formule_code,formule_nom,
  contrat_acquisition_requis,contrat_accompagnement_requis,necessite_foncier_client,necessite_cotitulaire,parcours_code,
  montant_da_par_ha,montant_depot_initial_par_ha,contribution_mensuelle_par_ha,montant_cash_par_ha,montant_total_par_ha,
  duree_paiement_mois,duree_installation_mois,duree_production_ans,tranches_paiement,avantages
) values
(
  'terra-palm-plus','TerraPalm+',
  'Vous avez la terre, nous en faisons une plantation productive — gestion intégrale déléguée, propriété 28 ans.',
  true,4,'avec_terre','deleguee','TERRAPALM','TERRAPALM_PLUS','TerraPalm+',
  true,true,true,true,'TERRAPALM',
  84700,84700,49800,1466200,1620200,40,36,28,
  '[{"libelle":"Paiement initial","montant":84700,"mois":"M1"},{"libelle":"Année 1","montant":295900,"mensualite":26900,"mois":"M2-M12"},{"libelle":"Année 2","montant":442800,"mensualite":36900,"mois":"M13-M24"},{"libelle":"Année 3","montant":796800,"mensualite":49800,"mois":"M25-M40"}]',
  '["Votre terre reste la vôtre","Gestion intégrale déléguée","Reporting et suivi digital","Revenus sur votre compte"]'::jsonb
)
on conflict(code) do update set
  nom=excluded.nom,description=excluded.description,actif=true,ordre=excluded.ordre,type_offre=excluded.type_offre,
  gestion_type=excluded.gestion_type,famille_offre=excluded.famille_offre,formule_code=excluded.formule_code,formule_nom=excluded.formule_nom,
  contrat_acquisition_requis=excluded.contrat_acquisition_requis,contrat_accompagnement_requis=excluded.contrat_accompagnement_requis,
  necessite_foncier_client=excluded.necessite_foncier_client,necessite_cotitulaire=excluded.necessite_cotitulaire,parcours_code=excluded.parcours_code,
  montant_da_par_ha=excluded.montant_da_par_ha,montant_depot_initial_par_ha=excluded.montant_depot_initial_par_ha,
  contribution_mensuelle_par_ha=excluded.contribution_mensuelle_par_ha,montant_cash_par_ha=excluded.montant_cash_par_ha,
  montant_total_par_ha=excluded.montant_total_par_ha,duree_paiement_mois=excluded.duree_paiement_mois,
  duree_installation_mois=excluded.duree_installation_mois,duree_production_ans=excluded.duree_production_ans,
  tranches_paiement=excluded.tranches_paiement,avantages=excluded.avantages,updated_at=now();

-- PalmTerroir : offre d'accompagnement progressif sur terrain du client.
insert into public.offres (
  code,nom,description,actif,ordre,type_offre,gestion_type,famille_offre,formule_code,formule_nom,
  contrat_acquisition_requis,contrat_accompagnement_requis,necessite_foncier_client,necessite_cotitulaire,parcours_code,
  montant_da_par_ha,montant_depot_initial_par_ha,contribution_mensuelle_par_ha,montant_cash_par_ha,montant_total_par_ha,
  duree_paiement_mois,duree_installation_mois,duree_production_ans,tranches_paiement,avantages
) values
(
  'palm-terroir-essentielle','PalmTerroir — Formule Essentielle',
  'Votre plantation de palmier à huile accessible progressivement. La parcelle est à la charge du client.',
  true,5,'avec_terre','propre','PALMTERROIR','PALMTERROIR_ESSENTIELLE','Essentielle',
  false,true,true,false,'PALMTERROIR',
  230000,50000,3500,356000,356000,36,36,0,
  '[{"libelle":"Paiement à la signature","montant":50000},{"libelle":"Paiement après trouaison","montant":180000},{"libelle":"Encadrement technique","montant":126000,"mensualite":3500,"mois":"36 mois"}]',
  '["Inspection et validation de la parcelle","Piquetage","Trouaison","Transport des plants jusqu’à 10 km","Mise en terre","Suivi technique continu"]'::jsonb
)
on conflict(code) do update set
  nom=excluded.nom,description=excluded.description,actif=true,ordre=excluded.ordre,type_offre=excluded.type_offre,gestion_type=excluded.gestion_type,
  famille_offre=excluded.famille_offre,formule_code=excluded.formule_code,formule_nom=excluded.formule_nom,
  contrat_acquisition_requis=excluded.contrat_acquisition_requis,contrat_accompagnement_requis=excluded.contrat_accompagnement_requis,
  necessite_foncier_client=excluded.necessite_foncier_client,necessite_cotitulaire=excluded.necessite_cotitulaire,parcours_code=excluded.parcours_code,
  montant_da_par_ha=excluded.montant_da_par_ha,montant_depot_initial_par_ha=excluded.montant_depot_initial_par_ha,
  contribution_mensuelle_par_ha=excluded.contribution_mensuelle_par_ha,montant_cash_par_ha=excluded.montant_cash_par_ha,montant_total_par_ha=excluded.montant_total_par_ha,
  duree_paiement_mois=excluded.duree_paiement_mois,duree_installation_mois=excluded.duree_installation_mois,duree_production_ans=excluded.duree_production_ans,
  tranches_paiement=excluded.tranches_paiement,avantages=excluded.avantages,updated_at=now();

insert into public.offres (
  code,nom,description,actif,ordre,type_offre,gestion_type,famille_offre,formule_code,formule_nom,
  contrat_acquisition_requis,contrat_accompagnement_requis,necessite_foncier_client,necessite_cotitulaire,parcours_code,
  montant_da_par_ha,montant_depot_initial_par_ha,contribution_mensuelle_par_ha,montant_cash_par_ha,montant_total_par_ha,
  duree_paiement_mois,duree_installation_mois,duree_production_ans,tranches_paiement,avantages
) values
(
  'palm-terroir-flexible','PalmTerroir — Formule Flexible',
  'Votre plantation de palmier à huile accessible progressivement avec un paiement mensuel adapté.',
  true,6,'avec_terre','propre','PALMTERROIR','PALMTERROIR_FLEXIBLE','Flexible',
  false,true,true,false,'PALMTERROIR',
  518000,65000,12600,518000,518000,36,36,0,
  '[{"libelle":"Paiement à la signature","montant":65000},{"libelle":"Mensualité","montant":453600,"mensualite":12600,"mois":"36 mois"}]',
  '["Inspection et validation de la parcelle","Piquetage","Trouaison","Transport des plants jusqu’à 10 km","Mise en terre","Suivi technique continu"]'::jsonb
)
on conflict(code) do update set
  nom=excluded.nom,description=excluded.description,actif=true,ordre=excluded.ordre,type_offre=excluded.type_offre,gestion_type=excluded.gestion_type,
  famille_offre=excluded.famille_offre,formule_code=excluded.formule_code,formule_nom=excluded.formule_nom,
  contrat_acquisition_requis=excluded.contrat_acquisition_requis,contrat_accompagnement_requis=excluded.contrat_accompagnement_requis,
  necessite_foncier_client=excluded.necessite_foncier_client,necessite_cotitulaire=excluded.necessite_cotitulaire,parcours_code=excluded.parcours_code,
  montant_da_par_ha=excluded.montant_da_par_ha,montant_depot_initial_par_ha=excluded.montant_depot_initial_par_ha,
  contribution_mensuelle_par_ha=excluded.contribution_mensuelle_par_ha,montant_cash_par_ha=excluded.montant_cash_par_ha,montant_total_par_ha=excluded.montant_total_par_ha,
  duree_paiement_mois=excluded.duree_paiement_mois,duree_installation_mois=excluded.duree_installation_mois,duree_production_ans=excluded.duree_production_ans,
  tranches_paiement=excluded.tranches_paiement,avantages=excluded.avantages,updated_at=now();

-- Terminologie officielle.
update public.promotions set cible='paiement_initial',type_promotion='paiement_initial'
where lower(coalesce(cible,'')) in ('depot_initial','dépôt_initial','da','di');

-- Contrats séparés : acquisition client et accompagnement agricole.
create table if not exists public.client_contracts (
  id uuid primary key default gen_random_uuid(),
  souscripteur_id uuid not null references public.souscripteurs(id) on delete cascade,
  type_contrat text not null check(type_contrat in ('acquisition_client','accompagnement_agricole')),
  statut text not null default 'a_preparer' check(statut in ('a_preparer','a_signer','signe','en_verification','valide','refuse','annule')),
  reference text,
  fichier_url text,
  date_signature date,
  valide_par uuid,
  valide_at timestamptz,
  observations text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(souscripteur_id,type_contrat)
);
create index if not exists idx_client_contracts_subscriber on public.client_contracts(souscripteur_id,type_contrat);

alter table public.souscripteurs
  add column if not exists famille_offre text,
  add column if not exists formule_code text,
  add column if not exists formule_nom text,
  add column if not exists contrat_acquisition_statut text not null default 'a_preparer',
  add column if not exists contrat_accompagnement_statut text not null default 'a_preparer',
  add column if not exists paiement_initial_montant numeric not null default 0,
  add column if not exists paiement_initial_paye_at timestamptz,
  add column if not exists parcours_code text;

create or replace function public.sync_offre_fields_on_subscriber()
returns trigger language plpgsql security definer set search_path=public as $$
declare o record;
begin
  if new.offre_id is not null then
    select * into o from public.offres where id=new.offre_id;
    new.famille_offre=o.famille_offre;
    new.formule_code=o.formule_code;
    new.formule_nom=o.formule_nom;
    new.parcours_code=o.parcours_code;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_offre_fields_on_subscriber on public.souscripteurs;
create trigger trg_sync_offre_fields_on_subscriber before insert or update of offre_id on public.souscripteurs
for each row execute function public.sync_offre_fields_on_subscriber();

-- Initialisation des champs pour les dossiers déjà existants.
update public.souscripteurs s
set famille_offre=o.famille_offre,formule_code=o.formule_code,formule_nom=o.formule_nom,parcours_code=o.parcours_code
from public.offres o where s.offre_id=o.id and o.famille_offre is not null;

-- Création automatique des deux fiches contractuelles selon l'offre.
create or replace function public.ensure_client_contracts(_souscripteur_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s record;o record;
begin
 select * into s from public.souscripteurs where id=_souscripteur_id;
 if s is null then return; end if;
 select * into o from public.offres where id=s.offre_id;
 if o is null then return; end if;
 if o.contrat_acquisition_requis then
   insert into public.client_contracts(souscripteur_id,type_contrat,statut)
   values(s.id,'acquisition_client','a_preparer') on conflict(souscripteur_id,type_contrat) do nothing;
 end if;
 if o.contrat_accompagnement_requis then
   insert into public.client_contracts(souscripteur_id,type_contrat,statut)
   values(s.id,'accompagnement_agricole','a_preparer') on conflict(souscripteur_id,type_contrat) do nothing;
 end if;
end $$;

create or replace function public.sync_subscriber_contract_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.souscripteurs s set
   contrat_acquisition_statut=coalesce((select statut from public.client_contracts c where c.souscripteur_id=s.id and c.type_contrat='acquisition_client'),'non_requis'),
   contrat_accompagnement_statut=coalesce((select statut from public.client_contracts c where c.souscripteur_id=s.id and c.type_contrat='accompagnement_agricole'),'non_requis'),
   updated_at=now()
 where s.id=new.souscripteur_id;
 return new;
end $$;

drop trigger if exists trg_sync_subscriber_contract_status on public.client_contracts;
create trigger trg_sync_subscriber_contract_status after insert or update on public.client_contracts
for each row execute function public.sync_subscriber_contract_status();

-- L'ancien code AgriPlan n'est plus une offre commerciale active.
update public.notification_segments set actif=false,updated_at=now()
where code='agriplan';
delete from public.notification_automations where criteres @> '{"audience":"agriplan"}'::jsonb;
