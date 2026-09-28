-- Compatibilité : le RPC historique du bénéficiaire particulier crée encore une plantation client.
-- Ce trigger convertit automatiquement cette création en actif partagé 50/50.
-- 2026-09-29

create or replace function public.trg_normalize_particular_plantation_shared()
returns trigger
language plpgsql
security definer
set search_path='public'
as $function$
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
      statut=coalesce(nullif(statut,''),'active'),
      statut_global=coalesce(nullif(statut_global,''),'active'),
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
end;
$function$;

drop trigger if exists trg_normalize_particular_plantation_shared on public.plantations;
create trigger trg_normalize_particular_plantation_shared
after insert on public.plantations
for each row execute function public.trg_normalize_particular_plantation_shared();
