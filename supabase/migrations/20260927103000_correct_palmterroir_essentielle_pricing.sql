-- Canon commercial 2026-09-27 : PalmTerroir Essentielle
-- Paiement initial à la signature : 230 000 F/ha
-- Après trouaison : 180 000 F/ha
-- Puis 3 500 F/ha/mois pendant 36 mois
-- Total mathématique : 536 000 F/ha

create or replace function public.validate_offre_pricing_consistency()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_total numeric:=0;
  v_duree int:=0;
  v_tranche jsonb;
begin
  if new.tranches_paiement is null or jsonb_typeof(new.tranches_paiement)<>'array' then return new; end if;
  for v_tranche in select * from jsonb_array_elements(new.tranches_paiement) loop
    v_total:=v_total
      + coalesce((v_tranche->>'mensualite_par_ha')::numeric,0)*coalesce((v_tranche->>'mois')::int,0)
      + case when v_tranche->>'type'='apres_trouaison' then coalesce((v_tranche->>'montant')::numeric,0) else 0 end;
    v_duree:=v_duree+coalesce((v_tranche->>'mois')::int,0);
  end loop;
  v_total:=v_total+coalesce(new.montant_pi_par_ha,0);
  if new.montant_total_par_ha is not null and abs(new.montant_total_par_ha-v_total)>1 then
    raise exception 'Offre %: montant_total_par_ha (%) ≠ somme tranches + PI (%)',new.code,new.montant_total_par_ha,v_total;
  end if;
  if new.duree_paiement_mois is not null and new.duree_paiement_mois<>v_duree and v_duree>0 then
    raise exception 'Offre %: duree_paiement_mois (%) ≠ somme tranches (% mois)',new.code,new.duree_paiement_mois,v_duree;
  end if;
  return new;
end
$function$;

update public.offres
set montant_pi_par_ha=230000,
    montant_total_par_ha=536000,
    paiement_signature_par_ha=230000,
    paiement_apres_trouaison_par_ha=180000,
    duree_paiement_mois=36,
    tranches_paiement='[
      {"type":"paiement_initial","montant":230000,"mensualite_par_ha":0},
      {"type":"apres_trouaison","montant":180000,"declencheur":"trouaison_validee","mensualite_par_ha":0},
      {"mois":12,"annee":1,"mois_fin":12,"mois_debut":1,"mensualite_par_ha":3500,"total_periode_par_ha":42000},
      {"mois":12,"annee":2,"mois_fin":24,"mois_debut":13,"mensualite_par_ha":3500,"total_periode_par_ha":42000},
      {"mois":12,"annee":3,"mois_fin":36,"mois_debut":25,"mensualite_par_ha":3500,"total_periode_par_ha":42000}
    ]'::jsonb,
    updated_at=now()
where code='palm-terroir-essentielle';
