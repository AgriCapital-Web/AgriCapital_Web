-- Plantation lifecycle: payment activates the dossier/parcelle; technical validation of mise_en_terre creates the plantation.
alter table public.interventions_techniques
  add column if not exists client_id uuid references public.clients(id),
  add column if not exists parcelle_id uuid references public.parcelles(id);

create index if not exists idx_interventions_client_parcelle
  on public.interventions_techniques(client_id, parcelle_id);

drop trigger if exists trg_normalize_particular_plantation_shared on public.plantations;

create or replace function public.activate_shared_plantation_from_lot(
  p_lot_id uuid, p_client_id uuid, p_date_activation date default current_date
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_lot public.lots_hectares%rowtype;
  v_parcelle public.parcelles%rowtype;
  v_owner public.proprietaires_terres%rowtype;
  v_client public.clients%rowtype;
  v_activation public.plantation_activations%rowtype;
  v_surface numeric;
  v_agri_share numeric;
  v_allocated numeric;
  v_user uuid := auth.uid();
begin
  if v_user is not null and not public.is_staff(v_user) then raise exception 'Accès réservé au personnel AgriCapital'; end if;
  select * into v_lot from public.lots_hectares where id=p_lot_id for update;
  if v_lot.id is null then raise exception 'Lot introuvable'; end if;
  if v_lot.client_id is distinct from p_client_id then raise exception 'Le lot n''est pas attribué à ce client'; end if;
  select * into v_client from public.clients where id=p_client_id;
  if v_client.id is null then raise exception 'Client introuvable'; end if;
  select * into v_parcelle from public.parcelles where id=v_lot.parcelle_id for update;
  if v_parcelle.id is null then raise exception 'Parcelle du lot introuvable'; end if;
  select * into v_owner from public.proprietaires_terres where id=v_parcelle.proprietaire_id;
  if v_owner.id is null then raise exception 'Propriétaire foncier introuvable'; end if;

  v_surface := coalesce(v_lot.surface_ha,v_client.total_hectares,1);
  v_agri_share := greatest(0,coalesce(v_parcelle.surface_agricapital_ha,v_parcelle.surface_totale_ha/2,0));
  select coalesce(sum(l.surface_ha),0) into v_allocated
  from public.lots_hectares l
  where l.parcelle_id=v_parcelle.id and l.id<>v_lot.id
    and l.client_id is not null and l.statut='attribue';
  if v_agri_share > 0 and v_allocated+v_surface > v_agri_share then
    raise exception 'La part AgriCapital disponible de la parcelle est insuffisante';
  end if;

  select * into v_activation from public.plantation_activations where lot_id=v_lot.id;
  if v_activation.id is null then
    insert into public.plantation_activations(
      lot_id,parcelle_id,proprietaire_id,client_id,surface_client_ha,surface_proprietaire_ha,
      statut,date_activation,created_by,updated_by
    ) values (
      v_lot.id,v_parcelle.id,v_owner.id,p_client_id,v_surface,v_surface,
      'active',coalesce(p_date_activation,current_date),v_user,v_user
    ) returning * into v_activation;
  else
    update public.plantation_activations
    set client_id=p_client_id,statut='active',
        date_activation=coalesce(p_date_activation,date_activation),
        updated_by=v_user,updated_at=now()
    where id=v_activation.id returning * into v_activation;
  end if;

  update public.lots_hectares
  set statut='attribue',date_attribution=coalesce(date_attribution,p_date_activation)
  where id=v_lot.id;

  update public.parcelles
  set surface_attribuee_ha=(
    select coalesce(sum(l.surface_ha),0) from public.lots_hectares l
    where l.parcelle_id=v_parcelle.id and l.client_id is not null and l.statut='attribue'
  ), updated_at=now()
  where id=v_parcelle.id;

  update public.clients
  set parcelle_id=coalesce(parcelle_id,v_parcelle.id),
      compte_actif=true,
      statut=case when lower(coalesce(statut,'')) in ('inactif','en_attente_pi','en_attente_paiement') then 'actif' else statut end,
      statut_global=case when lower(coalesce(statut_global,'')) in ('inactif','en_attente_pi','en_attente_paiement') then 'actif' else statut_global end,
      pi_paye_at=coalesce(pi_paye_at,coalesce(p_date_activation,current_date)::timestamptz),
      updated_at=now()
  where id=p_client_id;

  return jsonb_build_object(
    'activation_id',v_activation.id,'lot_id',v_lot.id,'parcelle_id',v_parcelle.id,
    'client_id',p_client_id,'surface_client_ha',v_surface,'plantation_created',false
  );
end;
$$;

create or replace function public.create_plantation_after_mise_en_terre()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  v_client public.clients%rowtype;
  v_parcelle public.parcelles%rowtype;
  v_existing uuid;
  v_surface numeric;
  v_density integer;
  v_date date;
  v_name text;
begin
  if new.type_intervention<>'mise_en_terre' or new.statut<>'realisee' then return new; end if;
  if new.client_id is null then
    raise exception 'La mise en terre doit être rattachée à un client/dossier avant création automatique de la plantation';
  end if;

  select * into v_client from public.clients where id=new.client_id;
  if v_client.id is null then raise exception 'Client du parcours technique introuvable'; end if;

  select * into v_parcelle from public.parcelles
  where id=coalesce(new.parcelle_id,v_client.parcelle_id) for update;
  if v_parcelle.id is null then raise exception 'Parcelle introuvable pour la mise en terre'; end if;

  v_surface:=greatest(0,coalesce(v_client.total_hectares,0));
  if v_surface<=0 then raise exception 'La superficie du dossier client doit être renseignée avant la mise en terre'; end if;
  v_density:=coalesce(v_parcelle.plantation_densite_plants,140);
  v_date:=new.date_intervention::date;
  v_name:='Plantation '||coalesce(nullif(v_client.nom_complet,''),v_client.id_unique);

  select p.id into v_existing from public.plantations p
  where p.client_id=v_client.id and p.parcelle_id=v_parcelle.id
  order by p.created_at desc limit 1;

  if v_existing is null then
    insert into public.plantations(
      client_id,parcelle_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,
      nombre_plants,densite_plants,district_id,region_id,departement_id,sous_prefecture_id,
      village,village_nom,localite,localisation_gps_lat,localisation_gps_lng,latitude,longitude,
      date_plantation,date_activation,statut,statut_global,type_culture,notes,created_by,updated_by
    ) values (
      v_client.id,v_parcelle.id,'beneficiaire',v_name,v_name,v_surface,v_surface,
      (v_surface*v_density)::integer,v_density,v_parcelle.district_id,v_parcelle.region_id,
      v_parcelle.departement_id,v_parcelle.sous_prefecture_id,v_parcelle.village,v_parcelle.village,
      v_parcelle.village,v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
      v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,v_date,v_date,
      'active','active',coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),
      'Créée automatiquement après validation technique de la mise en terre.',
      new.created_by,new.created_by
    ) returning id into v_existing;
  else
    update public.plantations
    set date_plantation=coalesce(date_plantation,v_date),date_activation=coalesce(date_activation,v_date),
        statut='active',statut_global='active',updated_at=now()
    where id=v_existing;
  end if;

  update public.clients
  set parcelle_id=coalesce(parcelle_id,v_parcelle.id),
      nombre_plantations=(select count(*) from public.plantations where client_id=v_client.id and statut not in ('archive','supprime')),
      phase_actuelle='plantation',updated_at=now()
  where id=v_client.id;

  insert into public.beneficiaire_attributions(
    client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,notes
  )
  select v_client.id,v_parcelle.id,v_existing,v_surface,'beneficiaire','active',
         'Rattachement automatique de la plantation individuelle à la parcelle.'
  where v_client.type_client='beneficiaire_particulier'
    and not exists(
      select 1 from public.beneficiaire_attributions ba
      where ba.client_id=v_client.id and ba.parcelle_id=v_parcelle.id
        and ba.plantation_id=v_existing and ba.statut='active'
    );

  return new;
end;
$$;

drop trigger if exists trg_create_plantation_after_mise_en_terre on public.interventions_techniques;
create trigger trg_create_plantation_after_mise_en_terre
after insert or update of statut,type_intervention,client_id,parcelle_id
on public.interventions_techniques
for each row execute function public.create_plantation_after_mise_en_terre();

create or replace function public.validate_formula_technical_intervention()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare v_formula text; v_plantation_date date; v_client_id uuid;
begin
  v_client_id:=new.client_id;
  if v_client_id is null and new.plantation_id is not null then
    select p.client_id,p.date_plantation,c.formule_code into v_client_id,v_plantation_date,v_formula
    from public.plantations p join public.clients c on c.id=p.client_id where p.id=new.plantation_id;
  else
    select c.formule_code into v_formula from public.clients c where c.id=v_client_id;
    select p.date_plantation into v_plantation_date
    from public.plantations p
    where p.client_id=v_client_id and p.parcelle_id=new.parcelle_id
    order by p.date_plantation desc nulls last limit 1;
  end if;

  if coalesce(v_formula,'') like 'PALMTERROIR%' and v_plantation_date is not null
     and new.date_intervention::date>=v_plantation_date
     and new.type_intervention not in ('suivi_mensuel','autre') then
    raise exception 'Intervention non autorisée pour PalmTerroir après la mise en terre : %',new.type_intervention;
  elsif coalesce(v_formula,'') like 'PALMTERROIR%'
     and (v_plantation_date is null or new.date_intervention::date<v_plantation_date)
     and new.type_intervention not in ('piquetage','trouaison','mise_en_terre','autre') then
    raise exception 'Intervention non autorisée pour PalmTerroir avant la mise en terre : %',new.type_intervention;
  end if;
  return new;
end;
$$;

-- Nettoyage des anciennes plantations « partagées » : une ligne individuelle par client,
-- sur la même parcelle foncière.
do $$
declare r record; v_keep uuid;
begin
  for r in
    select ba.id attribution_id,ba.client_id,ba.parcelle_id,ba.surface_attribuee_ha
    from public.beneficiaire_attributions ba
    where ba.statut='active' and ba.client_id is not null and ba.parcelle_id is not null
  loop
    select p.id into v_keep from public.plantations p
    where p.client_id=r.client_id and p.parcelle_id=r.parcelle_id
    order by p.created_at asc limit 1;

    if v_keep is null then
      insert into public.plantations(
        client_id,parcelle_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,
        nombre_plants,densite_plants,region_id,departement_id,sous_prefecture_id,village,
        village_nom,localite,localisation_gps_lat,localisation_gps_lng,latitude,longitude,
        date_plantation,date_activation,statut,statut_global,type_culture,notes
      )
      select r.client_id,r.parcelle_id,'beneficiaire','Plantation '||c.nom_complet,
        'Plantation '||c.nom_complet,coalesce(r.surface_attribuee_ha,c.total_hectares,1),
        coalesce(r.surface_attribuee_ha,c.total_hectares,1),
        (coalesce(r.surface_attribuee_ha,c.total_hectares,1)*coalesce(p.densite_plants,140))::integer,
        coalesce(p.densite_plants,140),p.region_id,p.departement_id,p.sous_prefecture_id,p.village,
        p.village_nom,p.localite,p.localisation_gps_lat,p.localisation_gps_lng,p.latitude,p.longitude,
        p.date_plantation,p.date_activation,coalesce(p.statut,'active'),coalesce(p.statut_global,'active'),
        coalesce(p.type_culture,'Palmier à huile'),'Migration automatique : plantation individuelle par bénéficiaire.'
      from public.clients c
      left join public.plantations p on p.parcelle_id=r.parcelle_id and p.role_attribution='partage'
      where c.id=r.client_id
      limit 1
      returning id into v_keep;
    end if;

    update public.beneficiaire_attributions set plantation_id=v_keep,updated_at=now() where id=r.attribution_id;
  end loop;

  delete from public.plantations p
  where p.role_attribution='partage'
    and not exists(select 1 from public.beneficiaire_attributions ba where ba.plantation_id=p.id and ba.statut='active');
end $$;
