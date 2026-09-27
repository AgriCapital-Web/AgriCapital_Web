-- 2026-09-27 : recalcul du parcours financier avec Paiement Initial.
-- Le premier palier peut être le Paiement Initial ; la mensualité doit utiliser
-- le premier palier mensuel suivant.
create or replace function public.trg_souscripteur_recompute()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_di numeric; v_total numeric; v_duree int; v_taux numeric;
  v_tranches jsonb; v_mens numeric := 0; v_ha numeric; v_amount numeric; v_tranche jsonb;
begin
  if coalesce(new.compte_actif,false)=true or new.offre_id is null then return new; end if;
  if tg_op='UPDATE' and new.offre_id is not distinct from old.offre_id and new.promotion_id is not distinct from old.promotion_id and new.total_hectares is not distinct from old.total_hectares then return new; end if;
  select di_effectif,total_effectif into v_di,v_total from public.v_prix_effectif_offres where offre_id=new.offre_id;
  select duree_paiement_mois,tranches_paiement into v_duree,v_tranches from public.offres where id=new.offre_id;
  v_ha:=coalesce(new.total_hectares,0);
  if v_di is null or v_ha<=0 then return new; end if;
  v_amount:=v_di*v_ha;
  v_taux:=case when coalesce(v_duree,0)>0 then coalesce(v_total,0)/(v_duree*30) else 0 end;
  if v_tranches is not null and jsonb_typeof(v_tranches)='array' then
    for v_tranche in select * from jsonb_array_elements(v_tranches) loop
      if coalesce((v_tranche->>'mois')::int,0)>1 and coalesce((v_tranche->>'mensualite_par_ha')::numeric,0)>0 then
        v_mens:=(v_tranche->>'mensualite_par_ha')::numeric*v_ha; exit;
      end if;
    end loop;
  end if;
  new.montant_total_contrat:=coalesce(v_total,0)*v_ha;
  new.jours_contrat_total:=coalesce(v_duree,34)*30;
  new.taux_journalier_ha:=v_taux;
  new.mensualite_montant:=v_mens;
  if v_amount<=0 then
    update public.paiements set statut='annule',montant_theorique=0,cancelled_at=coalesce(cancelled_at,now()),notes=concat_ws(' — ',nullif(notes,''),'Paiement initial annulé automatiquement : tarif CRM à 0 F'),updated_at=now()
    where souscripteur_id=new.id and est_depot_initial=true and statut='en_attente';
  else
    update public.paiements set montant=v_amount,montant_paye=0,montant_theorique=v_amount,updated_at=now()
    where souscripteur_id=new.id and est_depot_initial=true and statut='en_attente';
  end if;
  return new;
end $$;