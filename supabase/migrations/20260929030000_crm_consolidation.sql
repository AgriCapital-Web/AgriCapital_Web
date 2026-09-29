-- AgriCapital CRM consolidation: geography, commissions, portfolios and technical planting
create or replace view public.v_geo_districts as
select id,nom,code,est_actif,created_at,est_actif as est_actif_effectif from public.districts;

alter table public.plantations
  add column if not exists densite_cible integer not null default 143,
  add column if not exists nombre_plants_prevus integer,
  add column if not exists nombre_plants_mis_en_terre integer,
  add column if not exists nombre_plants_remplaces integer not null default 0,
  add column if not exists taux_reussite numeric,
  add column if not exists surface_reellement_plantee numeric;

alter table public.interventions_techniques
  add column if not exists nombre_plants_prevus integer,
  add column if not exists nombre_plants_realises integer,
  add column if not exists nombre_plants_remplaces integer,
  add column if not exists densite_plants integer;

create table if not exists public.portefeuille_versements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  periode_debut date not null, periode_fin date not null,
  montant_brut numeric not null default 0, montant_paye numeric not null default 0,
  statut text not null default 'brouillon' check (statut in ('brouillon','valide','paye','annule')),
  mode_paiement text, reference text, notes text,
  valide_par uuid references public.profiles(id), date_validation timestamptz,
  paye_par uuid references public.profiles(id), date_paiement timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(profile_id,periode_debut,periode_fin)
);

create table if not exists public.portefeuille_versement_lignes (
  id uuid primary key default gen_random_uuid(),
  versement_id uuid not null references public.portefeuille_versements(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete restrict,
  montant numeric not null default 0, created_at timestamptz not null default now(),
  unique(versement_id,commission_id)
);

alter table public.portefeuilles add column if not exists total_verse numeric not null default 0;
create index if not exists idx_commissions_profile_statut_periode on public.commissions(profile_id,statut,periode);
create unique index if not exists uq_commissions_payment_type_profile on public.commissions(paiement_id,type_commission,profile_id) where paiement_id is not null;

delete from public.grille_remuneration
where role_cible='commercial' and type_remuneration in ('commission_cash','commission_ha_signature','commission_recouvrement','commission_surplus_pi','cash','acquisition','recouvrement_mensuel');

insert into public.grille_remuneration(role_cible,type_remuneration,montant,taux_pourcentage,description,actif)
values
('commercial','recouvrement_mensuel',null,2.5,'2,5% du prix mensuel par hectare sur chaque paiement validé',true),
('commercial','acquisition',10000,null,'Activation / vente PalmInvest ou TerraPalm',true),
('commercial','acquisition',15000,null,'Activation / vente PalmTerroir — Formule Essentielle',true),
('commercial','acquisition',5000,null,'Activation / vente PalmTerroir — Formule Flexible',true)
on conflict do nothing;

alter table public.portefeuille_versements enable row level security;
alter table public.portefeuille_versement_lignes enable row level security;

create or replace function public.recalculer_portefeuilles_commissions()
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.portefeuilles(user_id,created_at,updated_at)
  select distinct pr.user_id,now(),now()
  from public.profiles pr join public.user_roles ur on ur.user_id=pr.user_id and ur.role in ('commercial','technicien')
  where pr.user_id is not null on conflict(user_id) do nothing;
  update public.portefeuilles pf
  set total_gagne=coalesce((select sum(c.montant_commission) from public.commissions c where c.profile_id=pr.id and c.statut in ('calculee','validee','payee')),0),
      solde_commissions=coalesce((select sum(c.montant_commission) from public.commissions c where c.profile_id=pr.id and c.statut in ('calculee','validee')),0),
      total_verse=coalesce((select sum(v.montant_paye) from public.portefeuille_versements v where v.profile_id=pr.id and v.statut='paye'),0),
      total_retire=coalesce((select sum(v.montant_paye) from public.portefeuille_versements v where v.profile_id=pr.id and v.statut='paye'),0),
      updated_at=now()
  from public.profiles pr where pr.user_id=pf.user_id;
end; $$;

create or replace function public.calculer_commission_paiement(p_paiement_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare pa record; creator_profile uuid; creator_is_commercial boolean; base numeric:=0; commission numeric:=0; type_comm text; taux numeric:=0; periode_date date; offre record;
begin
  select p.*,c.created_by as client_created_by,c.total_hectares,c.famille_offre,c.formule_code,c.offre_id into pa
  from public.paiements p left join public.clients c on c.id=p.client_id where p.id=p_paiement_id;
  if pa.id is null or pa.statut<>'valide' then return; end if;
  select pr.id into creator_profile from public.profiles pr where pr.user_id=pa.client_created_by limit 1;
  if creator_profile is null then return; end if;
  select exists(select 1 from public.user_roles ur where ur.user_id=pa.client_created_by and ur.role='commercial') into creator_is_commercial;
  if not creator_is_commercial then return; end if;
  periode_date:=coalesce(pa.date_paiement::date,current_date);
  select o.* into offre from public.offres o where o.id=pa.offre_id;
  if offre.id is null then select o.* into offre from public.offres o where upper(coalesce(o.famille_offre,''))=upper(coalesce(pa.famille_offre,'')) and upper(coalesce(o.formule_code,''))=upper(coalesce(pa.formule_code,'')) order by o.ordre limit 1; end if;
  if coalesce(pa.est_paiement_initial,false) or coalesce(pa.est_depot_initial,false) or upper(coalesce(pa.type_paiement,'')) in ('PI','PAIEMENT_INITIAL','DEPOT_INITIAL') then
    type_comm:='acquisition';
    if upper(coalesce(pa.famille_offre,offre.famille_offre,''))='PALMTERROIR' then
      if upper(coalesce(pa.formule_code,offre.formule_code,'')) like '%FLEXIBLE%' then commission:=5000; else commission:=15000; end if;
    else commission:=10000; end if;
    base:=commission;
  else
    type_comm:='recouvrement_mensuel'; base:=coalesce(offre.contribution_mensuelle_par_ha,0)*coalesce(pa.total_hectares,0); taux:=2.5; commission:=round(base*taux/100,0);
  end if;
  if commission<=0 then return; end if;
  insert into public.commissions(profile_id,plantation_id,type_commission,montant_base,taux_commission,montant_commission,periode,date_calcul,statut,paiement_id,client_id,taux_applique)
  values(creator_profile,pa.plantation_id,type_comm,base,taux,commission,periode_date,now(),'calculee',pa.id,pa.client_id,taux)
  on conflict(paiement_id,type_commission,profile_id) do update set montant_base=excluded.montant_base,taux_commission=excluded.taux_commission,montant_commission=excluded.montant_commission,date_calcul=now();
  insert into public.portefeuilles(user_id,solde_commissions,total_gagne,total_retire,total_verse,created_at,updated_at) values(pa.client_created_by,0,0,0,0,now(),now()) on conflict(user_id) do nothing;
  perform public.recalculer_portefeuilles_commissions();
end; $$;

create or replace function public.trg_calculer_commission_paiement()
returns trigger language plpgsql security definer set search_path=public as $$
begin if new.statut='valide' then perform public.calculer_commission_paiement(new.id); end if; return new; end; $$;

drop trigger if exists trg_paiements_commission_auto on public.paiements;
create trigger trg_paiements_commission_auto after insert or update of statut on public.paiements for each row execute function public.trg_calculer_commission_paiement();

create or replace function public.trg_sync_technical_plantation()
returns trigger language plpgsql security definer set search_path=public as $$
declare p record; target_count integer;
begin
  if new.plantation_id is null or new.statut<>'realisee' then return new; end if;
  select * into p from public.plantations where id=new.plantation_id; if p.id is null then return new; end if;
  if new.type_intervention='mise_en_terre' then
    target_count:=coalesce(new.nombre_plants_realises,round(coalesce(p.superficie_ha,0)*coalesce(new.densite_plants,p.densite_cible,143)));
    update public.plantations set date_plantation=coalesce(date_plantation,new.date_intervention),date_activation=coalesce(date_activation,new.date_intervention),statut_global='active',densite_cible=coalesce(new.densite_plants,densite_cible,143),densite_plants=coalesce(new.densite_plants,densite_cible,143),nombre_plants_prevus=coalesce(new.nombre_plants_prevus,nombre_plants_prevus,round(superficie_ha*coalesce(new.densite_plants,densite_cible,143))),nombre_plants_mis_en_terre=target_count,nombre_plants=target_count,surface_reellement_plantee=coalesce(surface_reellement_plantee,superficie_ha),taux_reussite=coalesce(taux_reussite,100),updated_at=now() where id=new.plantation_id;
  elsif new.type_intervention='remplacement' then
    update public.plantations set nombre_plants_remplaces=coalesce(nombre_plants_remplaces,0)+coalesce(new.nombre_plants_remplaces,0),updated_at=now() where id=new.plantation_id;
  end if;
  return new;
end; $$;

drop trigger if exists trg_sync_technical_plantation on public.interventions_techniques;
create trigger trg_sync_technical_plantation after insert or update of statut,nombre_plants_realises,nombre_plants_remplaces on public.interventions_techniques for each row execute function public.trg_sync_technical_plantation();

update public.plantations set densite_cible=143,densite_plants=143,nombre_plants_prevus=round(superficie_ha*143),nombre_plants_mis_en_terre=coalesce(nombre_plants_mis_en_terre,round(superficie_ha*143)),surface_reellement_plantee=coalesce(surface_reellement_plantee,superficie_ha),taux_reussite=coalesce(taux_reussite,100) where date_plantation is not null;
with stages as (
  select p.id plantation_id,p.client_id,p.parcelle_id,s.type_intervention
  from public.plantations p
  cross join (values ('validation_parcelle'),('defrichage'),('trouaison'),('mise_en_terre')) s(type_intervention)
  where p.date_plantation is not null
)
insert into public.interventions_techniques(id,plantation_id,client_id,parcelle_id,type_intervention,date_intervention,statut,observations,recommandations,created_at,updated_at)
select gen_random_uuid(),s.plantation_id,s.client_id,s.parcelle_id,s.type_intervention,current_date,'realisee','Étape historique validée lors de la consolidation du suivi technique.','Étape reprise dans la progression du portail.',now(),now()
from stages s
where not exists(select 1 from public.interventions_techniques i where i.plantation_id=s.plantation_id and i.type_intervention=s.type_intervention and i.statut='realisee');

update public.plantations p set date_activation=coalesce(p.date_activation,i.date_intervention),statut_global='active',updated_at=now()
from (select plantation_id,max(date_intervention) date_intervention from public.interventions_techniques where type_intervention='mise_en_terre' and statut='realisee' group by plantation_id) i
where p.id=i.plantation_id;

insert into public.role_permissions(role_code,permission_code)
select * from (values
('comptable','portefeuilles.view'),('comptable','portefeuilles.manage_payouts'),('comptable','commissions.manage_payouts'),
('responsable_operations','portefeuilles.view'),('responsable_operations','commissions.view'),
('responsable_commercial','portefeuilles.view'),('responsable_commercial','commissions.view'),
('chef_equipe_commercial','portefeuilles.view'),('chef_equipe_commercial','commissions.view'),
('chef_equipe_technique','portefeuilles.view'),('chef_equipe_technique','commissions.view'),
('commercial','portefeuilles.view'),('commercial','commissions.view'),
('technicien','portefeuilles.view'),('technicien','commissions.view'),
('super_admin','beneficiaires.create'),('pdg','beneficiaires.create')) x(role_code,permission_code)
on conflict(role_code,permission_code) do nothing;
