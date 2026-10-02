create or replace function private.validate_geo_chain(
  p_district_id uuid,p_region_id uuid,p_departement_id uuid,p_sous_prefecture_id uuid,p_village_id uuid
) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_district_id is null then
    if p_region_id is not null or p_departement_id is not null or p_sous_prefecture_id is not null or p_village_id is not null then raise exception 'Localisation administrative invalide : le district est requis avant ses éléments enfants'; end if;
    return;
  end if;
  if not exists(select 1 from public.v_geo_districts d where d.id=p_district_id and d.est_actif_effectif=true) then raise exception 'District inactif ou introuvable'; end if;
  if p_region_id is not null and not exists(select 1 from public.v_geo_regions r where r.id=p_region_id and r.district_id=p_district_id and r.est_active_effective=true) then raise exception 'Région incompatible avec le district sélectionné'; end if;
  if p_departement_id is not null and (p_region_id is null or not exists(select 1 from public.v_geo_departements d where d.id=p_departement_id and d.region_id=p_region_id and d.est_actif_effectif=true)) then raise exception 'Département incompatible avec la région sélectionnée'; end if;
  if p_sous_prefecture_id is not null and (p_departement_id is null or not exists(select 1 from public.v_geo_sous_prefectures s where s.id=p_sous_prefecture_id and s.departement_id=p_departement_id and s.est_active_effectif=true)) then raise exception 'Sous-préfecture incompatible avec le département sélectionné'; end if;
  if p_village_id is not null and (p_sous_prefecture_id is null or not exists(select 1 from public.v_geo_villages v where v.id=p_village_id and v.sous_prefecture_id=p_sous_prefecture_id and v.est_actif_effectif=true)) then raise exception 'Village incompatible avec la sous-préfecture sélectionnée'; end if;
end; $$;

create or replace function private.trg_validate_clients_geo() returns trigger language plpgsql security definer set search_path='' as $$ begin perform private.validate_geo_chain(new.district_id,new.region_id,new.departement_id,new.sous_prefecture_id,new.village_id); return new; end; $$;
create or replace function private.trg_validate_leads_geo() returns trigger language plpgsql security definer set search_path='' as $$ begin perform private.validate_geo_chain(new.district_id,new.region_id,new.departement_id,new.sous_prefecture_id,new.village_id); return new; end; $$;
create or replace function private.trg_validate_parcelles_geo() returns trigger language plpgsql security definer set search_path='' as $$ begin perform private.validate_geo_chain(new.district_id,new.region_id,new.departement_id,new.sous_prefecture_id,null); return new; end; $$;
create or replace function private.trg_validate_plantations_geo() returns trigger language plpgsql security definer set search_path='' as $$ begin perform private.validate_geo_chain(new.district_id,new.region_id,new.departement_id,new.sous_prefecture_id,null); return new; end; $$;
create or replace function private.trg_validate_proprietaires_geo() returns trigger language plpgsql security definer set search_path='' as $$ begin perform private.validate_geo_chain(new.district_id,new.region_id,new.departement_id,new.sous_prefecture_id,null); return new; end; $$;

drop trigger if exists trg_validate_clients_geo on public.clients;
create trigger trg_validate_clients_geo before insert or update of district_id,region_id,departement_id,sous_prefecture_id,village_id on public.clients for each row execute function private.trg_validate_clients_geo();
drop trigger if exists trg_validate_leads_geo on public.leads;
create trigger trg_validate_leads_geo before insert or update of district_id,region_id,departement_id,sous_prefecture_id,village_id on public.leads for each row execute function private.trg_validate_leads_geo();
drop trigger if exists trg_validate_parcelles_geo on public.parcelles;
create trigger trg_validate_parcelles_geo before insert or update of district_id,region_id,departement_id,sous_prefecture_id on public.parcelles for each row execute function private.trg_validate_parcelles_geo();
drop trigger if exists trg_validate_plantations_geo on public.plantations;
create trigger trg_validate_plantations_geo before insert or update of district_id,region_id,departement_id,sous_prefecture_id on public.plantations for each row execute function private.trg_validate_plantations_geo();
drop trigger if exists trg_validate_proprietaires_geo on public.proprietaires_terres;
create trigger trg_validate_proprietaires_geo before insert or update of district_id,region_id,departement_id,sous_prefecture_id on public.proprietaires_terres for each row execute function private.trg_validate_proprietaires_geo();