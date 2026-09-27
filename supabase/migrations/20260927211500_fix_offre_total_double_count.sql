-- Le PI inclut déjà les paiements ponctuels de mise en place.
-- Le total contractuel est donc PI + mensualités, sans double comptage.
create or replace function public.validate_offre_pricing_consistency()
returns trigger language plpgsql set search_path=public
as $function$
declare v_total numeric:=0; v_duree int:=0; v_tranche jsonb;
begin
  if new.tranches_paiement is null or jsonb_typeof(new.tranches_paiement)<>'array' then return new; end if;
  for v_tranche in select * from jsonb_array_elements(new.tranches_paiement) loop
    v_total:=v_total+coalesce((v_tranche->>'mensualite_par_ha')::numeric,0)*coalesce((v_tranche->>'mois')::int,0);
    v_duree:=v_duree+coalesce((v_tranche->>'mois')::int,0);
  end loop;
  v_total:=v_total+coalesce(new.montant_pi_par_ha,0);
  if new.montant_total_par_ha is not null and abs(new.montant_total_par_ha-v_total)>1 then
    raise exception 'Offre %: montant_total_par_ha (%) ≠ PI + mensualités (%)',new.code,new.montant_total_par_ha,v_total;
  end if;
  if new.duree_paiement_mois is not null and new.duree_paiement_mois<>v_duree and v_duree>0 then
    raise exception 'Offre %: duree_paiement_mois (%) ≠ somme tranches (% mois)',new.code,new.duree_paiement_mois,v_duree;
  end if;
  return new;
end $function$;

update public.offres
set montant_total_par_ha=356000
where code='palm-terroir-essentielle'
  and montant_pi_par_ha=230000;
