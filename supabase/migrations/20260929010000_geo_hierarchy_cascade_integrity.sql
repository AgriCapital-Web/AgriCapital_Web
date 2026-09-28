-- Canonical geographic hierarchy and downward activation cascade
-- Source of administrative hierarchy: official Côte d'Ivoire / ANStat / Ministry references.
-- Rule: disabling a parent disables every descendant. Re-enabling a parent does NOT
-- automatically re-enable descendants that were previously disabled individually.

create or replace function public.cascade_geo_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'districts' and (to_jsonb(new)->>'est_actif')::boolean = false and (to_jsonb(old)->>'est_actif')::boolean is distinct from false then
    update public.regions set est_active = false where district_id = new.id;
    update public.departements d set est_actif = false
      where d.region_id in (select r.id from public.regions r where r.district_id = new.id);
    update public.sous_prefectures s set est_active = false
      where s.departement_id in (
        select d.id from public.departements d
        join public.regions r on r.id = d.region_id
        where r.district_id = new.id
      );
    update public.villages v set est_actif = false
      where v.sous_prefecture_id in (
        select s.id from public.sous_prefectures s
        join public.departements d on d.id = s.departement_id
        join public.regions r on r.id = d.region_id
        where r.district_id = new.id
      );
  elsif tg_table_name = 'regions' and (to_jsonb(new)->>'est_active')::boolean = false and (to_jsonb(old)->>'est_active')::boolean is distinct from false then
    update public.departements set est_actif = false where region_id = new.id;
    update public.sous_prefectures s set est_active = false
      where s.departement_id in (select d.id from public.departements d where d.region_id = new.id);
    update public.villages v set est_actif = false
      where v.sous_prefecture_id in (
        select s.id from public.sous_prefectures s
        join public.departements d on d.id = s.departement_id
        where d.region_id = new.id
      );
  elsif tg_table_name = 'departements' and new.est_actif = false and old.est_actif is distinct from false then
    update public.sous_prefectures set est_active = false where departement_id = new.id;
    update public.villages v set est_actif = false
      where v.sous_prefecture_id in (select s.id from public.sous_prefectures s where s.departement_id = new.id);
  elsif tg_table_name = 'sous_prefectures' and new.est_active = false and old.est_active is distinct from false then
    update public.villages set est_actif = false where sous_prefecture_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_geo_cascade_district on public.districts;
create trigger trg_geo_cascade_district
after update of est_actif on public.districts
for each row execute function public.cascade_geo_deactivation();

drop trigger if exists trg_geo_cascade_region on public.regions;
create trigger trg_geo_cascade_region
after update of est_active on public.regions
for each row execute function public.cascade_geo_deactivation();

drop trigger if exists trg_geo_cascade_departement on public.departements;
create trigger trg_geo_cascade_departement
after update of est_actif on public.departements
for each row execute function public.cascade_geo_deactivation();

drop trigger if exists trg_geo_cascade_sous_prefecture on public.sous_prefectures;
create trigger trg_geo_cascade_sous_prefecture
after update of est_active on public.sous_prefectures
for each row execute function public.cascade_geo_deactivation();

-- Effective status views: a child is usable only when its whole ancestry is active.
create or replace view public.v_geo_regions as
select r.*, d.est_actif as district_actif,
       (coalesce(d.est_actif,false) and coalesce(r.est_active,false)) as est_active_effectif
from public.regions r
join public.districts d on d.id = r.district_id;

create or replace view public.v_geo_departements as
select dep.*, r.est_active as region_actif, d.est_actif as district_actif,
       (coalesce(d.est_actif,false) and coalesce(r.est_active,false) and coalesce(dep.est_actif,false)) as est_actif_effectif
from public.departements dep
join public.regions r on r.id = dep.region_id
join public.districts d on d.id = r.district_id;

create or replace view public.v_geo_sous_prefectures as
select sp.*, dep.est_actif as departement_actif, r.est_active as region_actif,
       d.est_actif as district_actif,
       (coalesce(d.est_actif,false) and coalesce(r.est_active,false)
        and coalesce(dep.est_actif,false) and coalesce(sp.est_active,false)) as est_active_effectif
from public.sous_prefectures sp
join public.departements dep on dep.id = sp.departement_id
join public.regions r on r.id = dep.region_id
join public.districts d on d.id = r.district_id;

create or replace view public.v_geo_villages as
select v.*, sp.est_active as sous_prefecture_active, dep.est_actif as departement_actif,
       r.est_active as region_actif, d.est_actif as district_actif,
       (coalesce(d.est_actif,false) and coalesce(r.est_active,false)
        and coalesce(dep.est_actif,false) and coalesce(sp.est_active,false)
        and coalesce(v.est_actif,false)) as est_actif_effectif
from public.villages v
join public.sous_prefectures sp on sp.id = v.sous_prefecture_id
join public.departements dep on dep.id = sp.departement_id
join public.regions r on r.id = dep.region_id
join public.districts d on d.id = r.district_id;

-- Repair duplicate/orphan department rows before enforcing the unique hierarchy.
-- Remove six orphan sub-prefecture duplicates attached to the orphan department rows.
delete from public.sous_prefectures
where id in (
 'd3f3b407-569e-446e-97f6-54a9f811b04b',
 '0a0ac80f-b365-444e-9a35-2e4999341f44',
 '5c17c2d0-708e-4938-97f7-9f76f76ffa47',
 '1318afbb-8ac3-4ac9-b90b-e85b2da5b459',
 'd3132fe8-b29b-4f3b-bfe6-11b95985ae7e',
 '0e9cd15b-935a-4108-b3b6-9f74747b2771'
);

-- Dabakala and Katiola had orphan duplicates with NULL region_id.
update public.account_requests set departement_geo_id = 'ed623e3a-5a42-40ec-96a7-35d097bc9e31'
where departement_geo_id = 'e096eb86-9593-4bf5-afc0-a824e5748758';
update public.client_cotitulaires_mandataires set departement_id = 'ed623e3a-5a42-40ec-96a7-35d097bc9e31'
where departement_id = 'e096eb86-9593-4bf5-afc0-a824e5748758';
update public.clients set departement_id = 'ed623e3a-5a42-40ec-96a7-35d097bc9e31'
where departement_id = 'e096eb86-9593-4bf5-afc0-a824e5748758';
update public.parcelles set departement_id = 'ed623e3a-5a42-40ec-96a7-35d097bc9e31'
where departement_id = 'e096eb86-9593-4bf5-afc0-a824e5748758';
update public.plantations set departement_id = 'ed623e3a-5a42-40ec-96a7-35d097bc9e31'
where departement_id = 'e096eb86-9593-4bf5-afc0-a824e5748758';
update public.proprietaires_terres set departement_id = 'ed623e3a-5a42-40ec-96a7-35d097bc9e31'
where departement_id = 'e096eb86-9593-4bf5-afc0-a824e5748758';
update public.sous_prefectures set departement_id = 'ed623e3a-5a42-40ec-96a7-35d097bc9e31'
where departement_id = 'e096eb86-9593-4bf5-afc0-a824e5748758';
delete from public.departements where id = 'e096eb86-9593-4bf5-afc0-a824e5748758';

update public.account_requests set departement_geo_id = 'ea517b5a-056d-469e-ba0b-db8cc5078719'
where departement_geo_id = 'e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7';
update public.client_cotitulaires_mandataires set departement_id = 'ea517b5a-056d-469e-ba0b-db8cc5078719'
where departement_id = 'e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7';
update public.clients set departement_id = 'ea517b5a-056d-469e-ba0b-db8cc5078719'
where departement_id = 'e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7';
update public.parcelles set departement_id = 'ea517b5a-056d-469e-ba0b-db8cc5078719'
where departement_id = 'e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7';
update public.plantations set departement_id = 'ea517b5a-056d-469e-ba0b-db8cc5078719'
where departement_id = 'e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7';
update public.proprietaires_terres set departement_id = 'ea517b5a-056d-469e-ba0b-db8cc5078719'
where departement_id = 'e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7';
update public.sous_prefectures set departement_id = 'ea517b5a-056d-469e-ba0b-db8cc5078719'
where departement_id = 'e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7';
delete from public.departements where id = 'e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7';

-- Repair known hierarchy defects found in the live database.
update public.regions r
set district_id = d.id
from public.districts d
where lower(r.nom) = 'moronou'
  and lower(d.nom) = 'district de la comoé';

update public.departements dep
set region_id = r.id
from public.regions r
where dep.region_id is null
  and lower(r.nom) = 'hambol'
  and lower(dep.nom) in ('dabakala','katiola','niakaramandougou');

-- Normalize descendants currently marked active under inactive ancestors.
update public.regions r
set est_active = false
where not exists (
  select 1 from public.districts d
  where d.id = r.district_id and d.est_actif = true
);

update public.departements dep
set est_actif = false
where not exists (
  select 1 from public.regions r
  join public.districts d on d.id = r.district_id
  where r.id = dep.region_id and r.est_active = true and d.est_actif = true
);

update public.sous_prefectures sp
set est_active = false
where not exists (
  select 1
  from public.departements dep
  join public.regions r on r.id = dep.region_id
  join public.districts d on d.id = r.district_id
  where dep.id = sp.departement_id
    and dep.est_actif = true and r.est_active = true and d.est_actif = true
);

update public.villages v
set est_actif = false
where not exists (
  select 1
  from public.sous_prefectures sp
  join public.departements dep on dep.id = sp.departement_id
  join public.regions r on r.id = dep.region_id
  join public.districts d on d.id = r.district_id
  where sp.id = v.sous_prefecture_id
    and sp.est_active = true and dep.est_actif = true
    and r.est_active = true and d.est_actif = true
);
