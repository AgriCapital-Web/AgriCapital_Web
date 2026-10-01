UPDATE public.plantations SET statut='actif' WHERE lower(coalesce(statut,''))='active';
UPDATE public.plantations SET statut_global='actif' WHERE lower(coalesce(statut_global,''))='active';

CREATE OR REPLACE FUNCTION public.trg_sync_technical_plantation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare p record; target_count integer;
begin
  if new.plantation_id is null or new.statut <> 'realisee' then return new; end if;
  select * into p from public.plantations where id=new.plantation_id;
  if p.id is null then return new; end if;
  if new.type_intervention='mise_en_terre' then
    target_count := coalesce(new.nombre_plants_realises, round(coalesce(p.superficie_ha,0)*coalesce(new.densite_plants,p.densite_cible,143)));
    update public.plantations
      set date_plantation=coalesce(date_plantation,new.date_intervention),
          date_activation=coalesce(date_activation,new.date_intervention),
          statut_global='actif',
          densite_cible=coalesce(new.densite_plants,densite_cible,143),
          densite_plants=coalesce(new.densite_plants,densite_cible,143),
          nombre_plants_prevus=coalesce(new.nombre_plants_prevus,nombre_plants_prevus,round(superficie_ha*coalesce(new.densite_plants,densite_cible,143))),
          nombre_plants_mis_en_terre=target_count,
          nombre_plants=target_count,
          surface_reellement_plantee=coalesce(surface_reellement_plantee,superficie_ha),
          taux_reussite=coalesce(taux_reussite,100),
          updated_at=now()
    where id=new.plantation_id;
  elsif new.type_intervention='remplacement' then
    update public.plantations set nombre_plants_remplaces=coalesce(nombre_plants_remplaces,0)+coalesce(new.nombre_plants_remplaces,0),updated_at=now() where id=new.plantation_id;
  end if;
  return new;
end; $$;

CREATE OR REPLACE FUNCTION public.trg_normalize_particular_plantation_shared()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare
  v_type text;
  v_parcelle public.parcelles%rowtype;
  v_beneficiary numeric;
  v_physical numeric;
  v_density integer;
begin
  if new.client_id is null then return new; end if;
  select type_client into v_type from public.clients where id=new.client_id;
  if v_type <> 'beneficiaire_particulier' then return new; end if;
  select * into v_parcelle from public.parcelles where id=new.parcelle_id;
  if v_parcelle.id is null then return new; end if;
  v_beneficiary:=coalesce(new.superficie_ha,0);
  if v_beneficiary<=0 then return new; end if;
  v_physical:=greatest(coalesce(v_parcelle.surface_totale_ha,0),2*v_beneficiary);
  v_density:=coalesce(v_parcelle.plantation_densite_plants,new.densite_plants,140);
  update public.parcelles
  set mode_surface='foncier',
      surface_totale_ha=v_physical,
      surface_proprietaire_ha=v_physical/2,
      surface_agricapital_ha=v_physical/2,
      surface_attribuee_ha=v_beneficiary,
      surface_disponible_ha=greatest(0,v_physical/2-v_beneficiary),
      plantation_partagee_activee=true,
      plantation_surface_cible_ha=v_physical,
      plantation_type_culture=coalesce(plantation_type_culture,'Palmier à huile'),
      plantation_densite_plants=v_density,
      updated_at=now()
  where id=v_parcelle.id;

  update public.plantations
  set client_id=null,
      role_attribution='partage',
      superficie_ha=v_physical,
      superficie_activee=v_physical,
      nombre_plants=(v_physical*v_density)::integer,
      densite_plants=v_density,
      statut=coalesce(nullif(statut,''),'actif'),
      statut_global=coalesce(nullif(statut_global,''),'actif'),
      updated_at=now()
  where id=new.id;

  if not exists(
    select 1 from public.beneficiaire_attributions
    where client_id=new.client_id and parcelle_id=new.parcelle_id and statut='active'
  ) then
    insert into public.beneficiaire_attributions(
      client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,notes
    ) values(
      new.client_id,new.parcelle_id,new.id,v_beneficiary,'beneficiaire','active',
      'Quote-part bénéficiaire particulier dans un actif agricole partagé. Aucun paiement requis.'
    );
  end if;
  return new;
end; $$;