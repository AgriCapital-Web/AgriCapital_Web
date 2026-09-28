-- Foncier : le propriétaire tiers est optionnel.
-- TerraPalm / PalmTerroir utilisent une parcelle appartenant au Client ;
-- PalmInvest utilise le foncier mis à disposition par AgriCapital.
begin;

-- La parcelle reste une relation agricole, mais un propriétaire foncier tiers
-- n'est jamais obligatoire. La suppression d'une parcelle peut laisser une
-- plantation sans parcelle historique si nécessaire.
alter table public.plantations
  alter column parcelle_id drop not null;

-- Le champ historique plantation_partagee_activee ne doit pas être utilisé
-- pour les parcelles propres au Client.
create or replace function public.activate_plantation_after_initial_payment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_date date;
  v_parcelle_id uuid;
  v_has_external_owner boolean;
begin
  if not coalesce(new.est_paiement_initial,new.est_depot_initial,false)
     or lower(coalesce(new.statut,'')) not in ('valide','paye','paid','success','successful','completed')
     or new.plantation_id is null then
    return new;
  end if;

  v_date:=coalesce(new.date_paiement::date,current_date);

  select p.parcelle_id into v_parcelle_id
  from public.plantations p
  where p.id=new.plantation_id
    and p.client_id=new.client_id;

  update public.plantations
  set superficie_activee=superficie_ha,
      montant_pi_paye=greatest(coalesce(montant_pi_paye,0),coalesce(new.montant_paye,new.montant,0)),
      date_activation=coalesce(date_activation,v_date),
      statut='actif',
      statut_global='actif',
      updated_at=now()
  where id=new.plantation_id
    and client_id=new.client_id;

  if v_parcelle_id is not null then
    select (proprietaire_id is not null) into v_has_external_owner
    from public.parcelles
    where id=v_parcelle_id;

    update public.parcelles
    set plantation_date_activation=coalesce(plantation_date_activation,v_date),
        statut=case when coalesce(statut,'') in ('','en_attente','reservee','bloquee') then 'active' else statut end,
        updated_at=now()
    where id=v_parcelle_id;

    -- Pour une parcelle avec propriétaire tiers, la relation foncière externe
    -- peut être traitée par les mécanismes d'attribution dédiés.
    -- Pour une parcelle propre au Client, aucune attribution/propriétaire
    -- supplémentaire n'est créée ici.
    if coalesce(v_has_external_owner,false)=false then
      null;
    end if;
  end if;

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

commit;