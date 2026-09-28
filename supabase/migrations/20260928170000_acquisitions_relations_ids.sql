-- Canonical acquisition/plantation relations and monotonic identifiers.
-- A dossier is identified independently of its type (client officiel, bénéficiaire particulier, etc.).
-- A plantation always belongs to exactly one client/dossier and one parcel.

begin;

-- 1) Monotonic AGC identifiers for all client/dossier records.
create sequence if not exists public.clients_agc_id_seq;

update public.clients
set id_unique = 'AGC-TEMP-' || id::text
where id_unique is null or id_unique like 'AGC-%';

with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.clients
)
update public.clients c
set id_unique = 'AGC-' || lpad(o.rn::text, 6, '0')
from ordered o
where o.id = c.id;

select setval(
  'public.clients_agc_id_seq',
  greatest(coalesce((select max(nullif(substring(id_unique from 5), '')::integer) from public.clients where id_unique like 'AGC-%'), 1), 1),
  true
);

create or replace function public.generate_client_id()
returns text
language plpgsql
security definer
set search_path=public
as $$
begin
  return 'AGC-' || lpad(nextval('public.clients_agc_id_seq')::text, 6, '0');
end;
$$;

-- 2) Monotonic PLT identifiers for plantations.
create sequence if not exists public.plantations_plt_id_seq;

update public.plantations
set id_unique = 'PLT-TEMP-' || id::text
where id_unique is null or id_unique like 'PLT-%';

with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.plantations
)
update public.plantations p
set id_unique = 'PLT-' || lpad(o.rn::text, 6, '0')
from ordered o
where o.id = p.id;

select setval(
  'public.plantations_plt_id_seq',
  greatest(coalesce((select max(nullif(substring(id_unique from 5), '')::integer) from public.plantations where id_unique like 'PLT-%'), 1), 1),
  true
);

create or replace function public.generate_plantation_id()
returns text
language plpgsql
security definer
set search_path=public
as $$
begin
  return 'PLT-' || lpad(nextval('public.plantations_plt_id_seq')::text, 6, '0');
end;
$$;

-- 3) A plantation is never a shared/anonymous asset.
alter table public.plantations
  alter column client_id set not null,
  alter column parcelle_id set not null;

-- 4) Canonical naming for payment activation: payment activates the client/lot/parcelle.
create or replace function public.activate_client_lot_from_lot(
  p_lot_id uuid,
  p_client_id uuid,
  p_date_activation date default current_date
) returns jsonb
language plpgsql
security definer
set search_path=public
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
  if v_user is not null and not public.is_staff(v_user) then
    raise exception 'Accès réservé au personnel AgriCapital';
  end if;

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
  where l.parcelle_id=v_parcelle.id
    and l.id<>v_lot.id
    and l.client_id is not null
    and l.statut='attribue';

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
    set client_id=p_client_id,
        statut='active',
        date_activation=coalesce(p_date_activation,date_activation),
        updated_by=v_user,
        updated_at=now()
    where id=v_activation.id
    returning * into v_activation;
  end if;

  update public.lots_hectares
  set statut='attribue',
      date_attribution=coalesce(date_attribution,p_date_activation)
  where id=v_lot.id;

  update public.parcelles
  set surface_attribuee_ha=(
    select coalesce(sum(l.surface_ha),0)
    from public.lots_hectares l
    where l.parcelle_id=v_parcelle.id and l.client_id is not null and l.statut='attribue'
  ),
  updated_at=now()
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
    'activation_id',v_activation.id,
    'lot_id',v_lot.id,
    'parcelle_id',v_parcelle.id,
    'client_id',p_client_id,
    'surface_client_ha',v_surface,
    'plantation_created',false
  );
end;
$$;

create or replace function public.trg_activate_client_lot_after_initial_payment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_lot record;
  v_activation jsonb;
  v_owner_id uuid;
begin
  if coalesce(new.est_paiement_initial,new.est_depot_initial,false)
     and lower(coalesce(new.statut,'')) in ('valide','paye','paid','success','successful','completed')
     and (
       tg_op='INSERT'
       or lower(coalesce(old.statut,'')) not in ('valide','paye','paid','success','successful','completed')
     )
  then
    for v_lot in
      select l.id,l.client_id,l.parcelle_id,l.surface_ha,l.reference
      from public.lots_hectares l
      where l.client_id=new.client_id
        and l.statut='attribue'
        and not exists(select 1 from public.plantation_activations a where a.lot_id=l.id)
      order by l.created_at
    loop
      v_activation := public.activate_client_lot_from_lot(
        v_lot.id,
        v_lot.client_id,
        coalesce(new.date_paiement::date,current_date)
      );

      select p.proprietaire_id into v_owner_id
      from public.parcelles p where p.id=v_lot.parcelle_id;

      perform public.notification_emit_event(
        'lot_attribue',
        jsonb_build_object(
          'lot_id',v_lot.id,
          'client_id',v_lot.client_id,
          'parcelle_id',v_lot.parcelle_id,
          'proprietaire_id',v_owner_id,
          'surface',coalesce(v_lot.surface_ha,1),
          'surface_client',coalesce(v_lot.surface_ha,1),
          'surface_proprietaire',coalesce(v_lot.surface_ha,1),
          'lot_reference',coalesce(v_lot.reference,v_lot.id::text),
          'date_activation',coalesce(new.date_paiement::date,current_date)
        )
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activate_shared_plantation_after_initial_payment on public.paiements;
create trigger trg_activate_client_lot_after_initial_payment
after insert or update on public.paiements
for each row execute function public.trg_activate_client_lot_after_initial_payment();

drop function if exists public.trg_activate_shared_plantation_after_initial_payment();
drop function if exists public.activate_shared_plantation_from_lot(uuid,uuid,date);

-- 5) Before a technical intervention, derive client/parcelle from an existing plantation when possible.
--    Mise en terre without an existing plantation remains valid: client + parcel are the source relation.
create or replace function public.validate_formula_technical_intervention()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_formula text;
  v_plantation_date date;
  v_client_id uuid;
begin
  if new.plantation_id is not null then
    select p.client_id,p.parcelle_id,p.date_plantation,c.formule_code
    into v_client_id,new.parcelle_id,v_plantation_date,v_formula
    from public.plantations p
    join public.clients c on c.id=p.client_id
    where p.id=new.plantation_id;

    if v_client_id is null then
      raise exception 'Plantation introuvable pour l’intervention';
    end if;

    if new.client_id is null then new.client_id:=v_client_id; end if;
    if new.client_id is distinct from v_client_id then
      raise exception 'Le Client de l’intervention ne correspond pas à la plantation sélectionnée';
    end if;
  else
    v_client_id:=new.client_id;
    if v_client_id is not null then
      select c.formule_code into v_formula from public.clients c where c.id=v_client_id;
      select p.date_plantation into v_plantation_date
      from public.plantations p
      where p.client_id=v_client_id
        and p.parcelle_id=new.parcelle_id
      order by p.date_plantation desc nulls last
      limit 1;
    end if;
  end if;

  if new.type_intervention='mise_en_terre' and new.statut='realisee' then
    if new.client_id is null or new.parcelle_id is null then
      raise exception 'La mise en terre réalisée doit être rattachée à un Client et à une parcelle';
    end if;
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

-- 6) Canonical automatic plantation creation: one plantation per client/dossier, linked to its parcel.
create or replace function public.create_plantation_after_mise_en_terre()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_client public.clients%rowtype;
  v_parcelle public.parcelles%rowtype;
  v_existing uuid;
  v_surface numeric;
  v_density integer;
  v_date date;
  v_name text;
  v_role text;
begin
  if new.type_intervention<>'mise_en_terre' or new.statut<>'realisee' then
    return new;
  end if;

  if new.client_id is null or new.parcelle_id is null then
    raise exception 'La mise en terre doit être rattachée à un Client et à une parcelle';
  end if;

  select * into v_client from public.clients where id=new.client_id;
  if v_client.id is null then raise exception 'Client du parcours technique introuvable'; end if;

  select * into v_parcelle from public.parcelles where id=new.parcelle_id for update;
  if v_parcelle.id is null then raise exception 'Parcelle introuvable pour la mise en terre'; end if;

  v_surface:=greatest(0,coalesce(v_client.total_hectares,0));

  if v_client.type_client='beneficiaire_particulier' then
    select coalesce(ba.surface_attribuee_ha,0),coalesce(ba.role_attribution,'beneficiaire')
    into v_surface,v_role
    from public.beneficiaire_attributions ba
    where ba.client_id=v_client.id
      and ba.parcelle_id=v_parcelle.id
      and ba.statut='active'
    order by ba.created_at
    limit 1;
  end if;

  if v_surface<=0 then
    raise exception 'La superficie du dossier Client doit être renseignée avant la mise en terre';
  end if;

  v_role:=coalesce(v_role,'beneficiaire');
  v_density:=coalesce(v_parcelle.plantation_densite_plants,140);
  v_date:=new.date_intervention::date;
  v_name:='Plantation '||coalesce(nullif(v_client.nom_complet,''),v_client.id_unique);

  select p.id into v_existing
  from public.plantations p
  where p.client_id=v_client.id
    and p.parcelle_id=v_parcelle.id
  order by p.created_at desc
  limit 1;

  if v_existing is null then
    insert into public.plantations(
      client_id,parcelle_id,role_attribution,nom,nom_plantation,
      superficie_ha,superficie_activee,nombre_plants,densite_plants,
      district_id,region_id,departement_id,sous_prefecture_id,village,village_nom,localite,
      localisation_gps_lat,localisation_gps_lng,latitude,longitude,
      date_plantation,date_activation,statut,statut_global,type_culture,
      notes,created_by,updated_by
    ) values (
      v_client.id,v_parcelle.id,v_role,v_name,v_name,
      v_surface,v_surface,(v_surface*v_density)::integer,v_density,
      v_parcelle.district_id,v_parcelle.region_id,v_parcelle.departement_id,
      v_parcelle.sous_prefecture_id,v_parcelle.village,v_parcelle.village,v_parcelle.village,
      v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
      v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
      v_date,v_date,'active','active',coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),
      'Créée automatiquement après validation technique de la mise en terre.',
      new.created_by,new.created_by
    ) returning id into v_existing;
  else
    update public.plantations
    set date_plantation=coalesce(date_plantation,v_date),
        date_activation=coalesce(date_activation,v_date),
        statut='active',
        statut_global='active',
        updated_at=now()
    where id=v_existing;
  end if;

  update public.clients
  set parcelle_id=coalesce(parcelle_id,v_parcelle.id),
      nombre_plantations=(
        select count(*)
        from public.plantations
        where client_id=v_client.id and statut not in ('archive','supprime')
      ),
      phase_actuelle='plantation',
      updated_at=now()
  where id=v_client.id;

  if v_client.type_client='beneficiaire_particulier' then
    insert into public.beneficiaire_attributions(
      client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,notes
    )
    select v_client.id,v_parcelle.id,v_existing,v_surface,v_role,'active',
           'Rattachement automatique de la plantation individuelle à la parcelle.'
    where not exists(
      select 1 from public.beneficiaire_attributions ba
      where ba.client_id=v_client.id
        and ba.parcelle_id=v_parcelle.id
        and ba.plantation_id=v_existing
        and ba.statut='active'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_create_plantation_after_mise_en_terre on public.interventions_techniques;
create trigger trg_create_plantation_after_mise_en_terre
after insert or update of statut,type_intervention,client_id,parcelle_id
on public.interventions_techniques
for each row execute function public.create_plantation_after_mise_en_terre();

commit;
