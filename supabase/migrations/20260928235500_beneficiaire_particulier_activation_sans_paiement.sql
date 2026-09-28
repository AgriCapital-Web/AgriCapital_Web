-- Finaliser le parcours des bénéficiaires particuliers :
-- aucun paiement, attribution et activation gérées par le dossier.
-- 2026-09-28

create or replace function public.trg_particular_beneficiary_attribution_notification()
returns trigger
language plpgsql security definer set search_path='public'
as $function$
declare
  v_type text;
  v_plantation record;
  v_parcelle record;
begin
  if new.statut='active' then
    select type_client into v_type from public.clients where id=new.client_id;
    if v_type='beneficiaire_particulier' then
      select * into v_plantation from public.plantations where id=new.plantation_id;
      select * into v_parcelle from public.parcelles where id=new.parcelle_id;
      perform public.notification_emit_event(
        'plantation_activee',
        jsonb_build_object(
          'client_id',new.client_id,
          'plantation_id',new.plantation_id,
          'parcelle_id',new.parcelle_id,
          'surface',new.surface_attribuee_ha,
          'village',coalesce(v_parcelle.village,''),
          'lot_reference','',
          'date_activation',coalesce(v_plantation.date_activation,current_date)
        )
      );
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_particular_beneficiary_attribution_notification on public.beneficiaire_attributions;
create trigger trg_particular_beneficiary_attribution_notification
after insert on public.beneficiaire_attributions
for each row execute function public.trg_particular_beneficiary_attribution_notification();

-- Le module propriétaire ne doit pas piloter les plantations.
-- Les valeurs Planté-Partagé sont des attributs système de la parcelle.
update public.parcelles
set plantation_partagee_activee=true,
    plantation_surface_cible_ha=coalesce(plantation_surface_cible_ha,surface_totale_ha),
    plantation_type_culture=coalesce(nullif(plantation_type_culture,''),'Palmier à huile'),
    plantation_densite_plants=coalesce(plantation_densite_plants,140)
where proprietaire_id is not null;
