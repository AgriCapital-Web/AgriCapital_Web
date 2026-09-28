-- Correctif métier : le commercial ne gère jamais la quote-part propriétaire.
-- L'activation Planté-Partagé est 100% arrière-plan et ne démarre qu'après paiement initial validé.
-- 2026-09-28

-- Toute nouvelle parcelle foncière est automatiquement éligible au Planté-Partagé.
-- Aucun bouton d'activation de plantation n'est exposé dans le formulaire propriétaire.
create or replace function public.trg_prepare_parcelle_plante_partage()
returns trigger
language plpgsql
security definer
set search_path='public'
as $function$
begin
  new.plantation_partagee_activee := true;
  new.plantation_surface_cible_ha := coalesce(new.plantation_surface_cible_ha,new.surface_totale_ha);
  new.plantation_type_culture := coalesce(nullif(new.plantation_type_culture,''),'Palmier à huile');
  new.plantation_densite_plants := coalesce(new.plantation_densite_plants,140);
  return new;
end;
$function$;

drop trigger if exists trg_prepare_parcelle_plante_partage on public.parcelles;
create trigger trg_prepare_parcelle_plante_partage
before insert or update of surface_totale_ha,proprietaire_id on public.parcelles
for each row execute function public.trg_prepare_parcelle_plante_partage();

-- L'activation système ne déclenche plus de notification à l'attribution du lot.
-- Elle est déclenchée uniquement par le paiement initial validé.
create or replace function public.activate_shared_plantation_from_lot(
  p_lot_id uuid,
  p_client_id uuid,
  p_date_activation date default current_date
)
returns jsonb
language plpgsql security definer set search_path='public'
as $function$
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
  v_client_plantation uuid;
  v_owner_plantation uuid;
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

  v_surface := coalesce(v_lot.surface_ha,1);
  v_agri_share := greatest(0,coalesce(v_parcelle.surface_agricapital_ha,v_parcelle.surface_totale_ha/2,0));

  select coalesce(sum(l.surface_ha),0) into v_allocated
  from public.lots_hectares l
  where l.parcelle_id=v_parcelle.id and l.id<>v_lot.id
    and l.client_id is not null and l.statut='attribue';

  if v_allocated + v_surface > v_agri_share then
    raise exception 'La part AgriCapital disponible de la parcelle est insuffisante';
  end if;

  if coalesce(v_parcelle.plantation_surface_cible_ha,v_parcelle.surface_totale_ha) < (2 * (v_allocated + v_surface)) then
    raise exception 'La superficie cible Planté-Partagé serait dépassée';
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

  insert into public.plantations(
    client_id,parcelle_id,activation_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,
    nombre_plants,densite_plants,region_id,departement_id,sous_prefecture_id,village,village_nom,localite,
    latitude,longitude,date_plantation,date_activation,statut,statut_global,type_culture,notes,created_by,updated_by
  )
  select p_client_id,v_parcelle.id,v_activation.id,'beneficiaire',
    coalesce('Plantation '||v_client.nom_complet,'Plantation bénéficiaire'),
    coalesce('Plantation '||v_client.nom_complet,'Plantation bénéficiaire'),
    v_surface,v_surface,
    (v_surface::numeric * coalesce(v_parcelle.plantation_densite_plants,140))::integer,
    coalesce(v_parcelle.plantation_densite_plants,140),
    v_parcelle.region_id,v_parcelle.departement_id,v_parcelle.sous_prefecture_id,
    v_parcelle.village,v_parcelle.village,v_parcelle.village,
    v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
    coalesce(v_parcelle.plantation_date_activation,p_date_activation),
    coalesce(p_date_activation,current_date),
    'active','active',coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),
    'Activation automatique après paiement initial validé. Lot '||coalesce(v_lot.reference,v_lot.id::text),
    v_user,v_user
  where not exists (
    select 1 from public.plantations p
    where p.activation_id=v_activation.id and p.role_attribution='beneficiaire'
  )
  returning id into v_client_plantation;

  insert into public.plantations(
    client_id,parcelle_id,activation_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,
    nombre_plants,densite_plants,region_id,departement_id,sous_prefecture_id,village,village_nom,localite,
    latitude,longitude,date_plantation,date_activation,statut,statut_global,type_culture,notes,created_by,updated_by
  )
  select null,v_parcelle.id,v_activation.id,'proprietaire',
    'Plantation propriétaire — '||coalesce(v_owner.nom_complet,'Propriétaire'),
    'Plantation propriétaire — '||coalesce(v_owner.nom_complet,'Propriétaire'),
    v_surface,v_surface,
    (v_surface::numeric * coalesce(v_parcelle.plantation_densite_plants,140))::integer,
    coalesce(v_parcelle.plantation_densite_plants,140),
    v_parcelle.region_id,v_parcelle.departement_id,v_parcelle.sous_prefecture_id,
    v_parcelle.village,v_parcelle.village,v_parcelle.village,
    v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
    coalesce(v_parcelle.plantation_date_activation,p_date_activation),
    coalesce(p_date_activation,current_date),
    'active','active',coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),
    'Plantation propriétaire créée automatiquement en contrepartie de la quote-part foncière. Lot '||coalesce(v_lot.reference,v_lot.id::text),
    v_user,v_user
  where not exists (
    select 1 from public.plantations p
    where p.activation_id=v_activation.id and p.role_attribution='proprietaire'
  )
  returning id into v_owner_plantation;

  update public.lots_hectares
  set statut='attribue',date_attribution=coalesce(date_attribution,p_date_activation)
  where id=v_lot.id;

  update public.parcelles
  set surface_attribuee_ha=(
    select coalesce(sum(l.surface_ha),0) from public.lots_hectares l
    where l.parcelle_id=v_parcelle.id and l.client_id is not null and l.statut='attribue'
  ),updated_at=now()
  where id=v_parcelle.id;

  return jsonb_build_object(
    'activation_id',v_activation.id,'lot_id',v_lot.id,'parcelle_id',v_parcelle.id,
    'client_plantation_id',v_client_plantation,'owner_plantation_id',v_owner_plantation,
    'surface_client_ha',v_surface,'surface_proprietaire_ha',v_surface
  );
end;
$function$;

revoke execute on function public.activate_shared_plantation_from_lot(uuid,uuid,date) from public,anon;
grant execute on function public.activate_shared_plantation_from_lot(uuid,uuid,date) to authenticated;

-- Paiement initial validé = déclencheur unique de l'activation arrière-plan.
create or replace function public.trg_activate_shared_plantation_after_initial_payment()
returns trigger
language plpgsql security definer set search_path='public'
as $function$
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
      where l.client_id=new.client_id and l.statut='attribue'
        and not exists(select 1 from public.plantation_activations a where a.lot_id=l.id)
      order by l.created_at
    loop
      v_activation := public.activate_shared_plantation_from_lot(
        v_lot.id,v_lot.client_id,coalesce(new.date_paiement::date,current_date)
      );

      select p.proprietaire_id into v_owner_id
      from public.parcelles p where p.id=v_lot.parcelle_id;

      -- Notification propriétaire seulement maintenant : après paiement initial validé.
      perform public.notification_emit_event(
        'lot_attribue',
        jsonb_build_object(
          'lot_id',v_lot.id,'client_id',v_lot.client_id,'parcelle_id',v_lot.parcelle_id,
          'proprietaire_id',v_owner_id,'surface',coalesce(v_lot.surface_ha,1),
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
$function$;

drop trigger if exists trg_activate_shared_plantation_after_initial_payment on public.paiements;
create trigger trg_activate_shared_plantation_after_initial_payment
after insert or update of statut on public.paiements
for each row execute function public.trg_activate_shared_plantation_after_initial_payment();

-- Si un lot est simplement attribué, aucune plantation propriétaire n'est créée.
-- Le trigger de notification lot_attribue reste désactivé : il est désormais émis
-- exclusivement depuis le déclencheur de paiement initial.
drop trigger if exists trg_lot_attribution_notification on public.lots_hectares;
