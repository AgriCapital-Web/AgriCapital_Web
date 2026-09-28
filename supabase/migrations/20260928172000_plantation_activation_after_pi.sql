-- Plantation lifecycle: creation follows mise en terre; activation follows valid Payment initial.
begin;

create or replace function public.activate_plantation_after_initial_payment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_date date;
begin
  if not coalesce(new.est_paiement_initial,new.est_depot_initial,false)
     or lower(coalesce(new.statut,'')) not in ('valide','paye','paid','success','successful','completed')
     or new.plantation_id is null then
    return new;
  end if;

  v_date:=coalesce(new.date_paiement::date,current_date);

  update public.plantations
  set superficie_activee=superficie_ha,
      montant_pi_paye=greatest(coalesce(montant_pi_paye,0),coalesce(new.montant_paye,new.montant,0)),
      date_activation=coalesce(date_activation,v_date),
      statut='actif',
      statut_global='actif',
      updated_at=now()
  where id=new.plantation_id
    and client_id=new.client_id;

  update public.parcelles pa
  set plantation_partagee_activee=true,
      plantation_date_activation=coalesce(plantation_date_activation,v_date),
      statut=case when coalesce(statut,'') in ('','en_attente','reservee','bloquee') then 'active' else statut end,
      updated_at=now()
  from public.plantations p
  where p.id=new.plantation_id
    and p.parcelle_id=pa.id
    and p.client_id=new.client_id;

  update public.clients
  set compte_actif=true,
      statut=case when coalesce(statut,'') in ('','en_attente_pi','en_attente') then 'actif' else statut end,
      statut_global='actif',
      paiement_initial_paye_at=coalesce(paiement_initial_paye_at,now()),
      pi_paye_at=coalesce(pi_paye_at,now()),
      updated_at=now()
  where id=new.client_id;

  return new;
end;
$$;

drop trigger if exists trg_activate_plantation_after_initial_payment on public.paiements;
create trigger trg_activate_plantation_after_initial_payment
after insert or update on public.paiements
for each row execute function public.activate_plantation_after_initial_payment();

-- Reassert the automatic plantation lifecycle with payment-aware activation.
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
  v_active boolean;
begin
  if new.type_intervention<>'mise_en_terre' or new.statut<>'realisee' then return new; end if;
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
    where ba.client_id=v_client.id and ba.parcelle_id=v_parcelle.id and ba.statut='active'
    order by ba.created_at limit 1;
  end if;

  if v_surface<=0 then raise exception 'La superficie du dossier Client doit être renseignée avant la mise en terre'; end if;

  v_active:=coalesce(v_client.compte_actif,false)
             or v_client.paiement_initial_paye_at is not null
             or v_client.pi_paye_at is not null;
  v_role:=coalesce(v_role,'beneficiaire');
  v_density:=coalesce(v_parcelle.plantation_densite_plants,140);
  v_date:=new.date_intervention::date;
  v_name:='Plantation '||coalesce(nullif(v_client.nom_complet,''),v_client.id_unique);

  select p.id into v_existing
  from public.plantations p
  where p.client_id=v_client.id and p.parcelle_id=v_parcelle.id
  order by p.created_at desc limit 1;

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
      v_surface,case when v_active then v_surface else 0 end,(v_surface*v_density)::integer,v_density,
      v_parcelle.district_id,v_parcelle.region_id,v_parcelle.departement_id,v_parcelle.sous_prefecture_id,
      v_parcelle.village,v_parcelle.village,v_parcelle.village,
      v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
      v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
      v_date,case when v_active then v_date else null end,
      case when v_active then 'actif' else 'en_attente_pi' end,
      case when v_active then 'actif' else 'en_attente_pi' end,
      coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),
      case when v_active
        then 'Créée automatiquement après validation technique de la mise en terre.'
        else 'Créée automatiquement après validation technique de la mise en terre ; activation après validation du paiement initial.'
      end,
      new.created_by,new.created_by
    ) returning id into v_existing;
  else
    update public.plantations
    set date_plantation=coalesce(date_plantation,v_date),
        date_activation=case when v_active then coalesce(date_activation,v_date) else null end,
        superficie_activee=case when v_active then superficie_ha else 0 end,
        statut=case when v_active then 'actif' else 'en_attente_pi' end,
        statut_global=case when v_active then 'actif' else 'en_attente_pi' end,
        updated_at=now()
    where id=v_existing;
  end if;

  update public.clients
  set parcelle_id=coalesce(parcelle_id,v_parcelle.id),
      nombre_plantations=(select count(*) from public.plantations where client_id=v_client.id and statut not in ('archive','supprime')),
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
      where ba.client_id=v_client.id and ba.parcelle_id=v_parcelle.id
        and ba.plantation_id=v_existing and ba.statut='active'
    );
  end if;

  return new;
end;
$$;

commit;