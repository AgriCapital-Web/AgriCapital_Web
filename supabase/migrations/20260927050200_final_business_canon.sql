-- Final canonical business rules. Applied 2026-09-27.
UPDATE public.offres SET montant_depot_initial_par_ha=230000,montant_da_par_ha=230000,montant_total_par_ha=356000,montant_cash_par_ha=356000,duree_paiement_mois=36,duree_installation_mois=36,contribution_mensuelle_par_ha=3500,tranches_paiement='[{"annee":1,"mois_debut":1,"mois_fin":12,"mois":12,"mensualite_par_ha":3500,"total_periode_par_ha":42000},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":3500,"total_periode_par_ha":42000},{"annee":3,"mois_debut":25,"mois_fin":36,"mois":12,"mensualite_par_ha":3500,"total_periode_par_ha":42000}]'::jsonb WHERE code='palm-terroir-essentielle';
UPDATE public.offres SET montant_depot_initial_par_ha=65000,montant_da_par_ha=65000,montant_total_par_ha=518600,montant_cash_par_ha=518600,duree_paiement_mois=36,duree_installation_mois=36,contribution_mensuelle_par_ha=12600,tranches_paiement='[{"annee":1,"mois_debut":1,"mois_fin":12,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200},{"annee":3,"mois_debut":25,"mois_fin":36,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200}]'::jsonb WHERE code='palm-terroir-flexible';
UPDATE public.offres SET montant_total_par_ha=2465200,montant_depot_initial_par_ha=90700,montant_da_par_ha=90700,contribution_mensuelle_par_ha=83800,duree_paiement_mois=40,montant_cash_par_ha=2266000,tranches_paiement='[{"type":"paiement_initial","mois":1,"mensualite_par_ha":0,"montant":90700},{"annee":1,"mois_debut":2,"mois_fin":12,"mois":11,"mensualite_par_ha":31900,"total_periode_par_ha":350900},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":56900,"total_periode_par_ha":682800},{"annee":3,"mois_debut":25,"mois_fin":40,"mois":16,"mensualite_par_ha":83800,"total_periode_par_ha":1340800}]'::jsonb WHERE code IN ('palm-invest','palm-invest-plus');
UPDATE public.offres SET montant_total_par_ha=1620200,montant_depot_initial_par_ha=84700,montant_da_par_ha=84700,contribution_mensuelle_par_ha=49800,duree_paiement_mois=40,montant_cash_par_ha=1466200,tranches_paiement='[{"type":"paiement_initial","mois":1,"mensualite_par_ha":0,"montant":84700},{"annee":1,"mois_debut":2,"mois_fin":12,"mois":11,"mensualite_par_ha":26900,"total_periode_par_ha":295900},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":36900,"total_periode_par_ha":442800},{"annee":3,"mois_debut":25,"mois_fin":40,"mois":16,"mensualite_par_ha":49800,"total_periode_par_ha":796800}]'::jsonb WHERE code IN ('terra-palm','terra-palm-plus');

UPDATE public.user_roles SET role='responsable_commercial' WHERE role IN ('responsable_zone','superviseur_tc');
UPDATE public.user_roles SET role='responsable_operations' WHERE role IN ('operations','responsable_technique_agronomique');
UPDATE public.user_roles SET role='chef_equipe_commercial' WHERE role='chef_equipe';
UPDATE public.user_roles SET role='chef_equipe_technique' WHERE role='agent_technique';
UPDATE public.user_roles SET role='service_client' WHERE role='agent_service_client';
UPDATE public.user_roles SET role='assistant_administratif' WHERE role IN ('assistant','assistante','secretaire');
UPDATE public.user_roles SET role='comptable' WHERE role='raf';
UPDATE public.user_roles SET role='service_client' WHERE role='client';

CREATE OR REPLACE FUNCTION public.handle_paiement_valide() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_s RECORD; v_o RECORD; v_debut date; v_tranche jsonb; v_idx int:=0; v_mois int; v_mensualite numeric; v_annee_offre int;
BEGIN
 IF NEW.statut<>'valide' OR COALESCE(OLD.statut,'')='valide' THEN RETURN NEW; END IF;
 IF NEW.est_depot_initial=true THEN
  SELECT * INTO v_s FROM public.clients WHERE id=NEW.client_id; IF v_s IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_o FROM public.offres WHERE id=v_s.offre_id; IF v_o IS NULL THEN RETURN NEW; END IF;
  v_debut:=current_date;
  UPDATE public.clients SET compte_actif=true,statut_global='actif',da_paye_at=COALESCE(da_paye_at,now()),contrat_debut_at=COALESCE(contrat_debut_at,v_debut),contrat_fin_at=COALESCE(contrat_fin_at,v_debut+(COALESCE(v_o.duree_paiement_mois,40)||' months')::interval),phase_actuelle='annee_1',prochaine_echeance=COALESCE(prochaine_echeance,v_debut+interval '1 month') WHERE id=NEW.client_id;
  PERFORM public.recompute_contrat_totaux(NEW.client_id);
  IF NOT EXISTS(SELECT 1 FROM public.paiements WHERE client_id=NEW.client_id AND type_paiement='REDEVANCE') THEN
   FOR v_tranche IN SELECT value FROM jsonb_array_elements(COALESCE(v_o.tranches_paiement,'[]'::jsonb)) LOOP
    IF COALESCE(v_tranche->>'type','')='paiement_initial' OR COALESCE((v_tranche->>'mensualite_par_ha')::numeric,0)<=0 THEN CONTINUE; END IF;
    v_annee_offre:=COALESCE((v_tranche->>'annee')::int,1); v_mensualite:=(v_tranche->>'mensualite_par_ha')::numeric*COALESCE(v_s.total_hectares,0);
    FOR v_mois IN 1..COALESCE((v_tranche->>'mois')::int,0) LOOP
     v_idx:=v_idx+1;
     INSERT INTO public.paiements(client_id,type_paiement,statut,montant,montant_theorique,numero_echeance,date_echeance,annee,phase,est_depot_initial)
     VALUES(NEW.client_id,'REDEVANCE','en_attente',v_mensualite,v_mensualite,v_idx,(v_debut+(v_idx||' months')::interval)::date,EXTRACT(YEAR FROM v_debut+(v_idx||' months')::interval)::int,'annee_'||v_annee_offre,false);
    END LOOP;
   END LOOP;
  END IF;
  IF v_s.user_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(v_s.user_id,'compte','Compte activé','Votre compte est activé. Vos mensualités sont désormais disponibles.',jsonb_build_object('debut',v_debut,'duree_mois',COALESCE(v_o.duree_paiement_mois,40),'paiement_id',NEW.id)); END IF;
 ELSIF NEW.type_paiement='REDEVANCE' THEN
  UPDATE public.clients s SET prochaine_echeance=(SELECT MIN(date_echeance) FROM public.paiements WHERE client_id=s.id AND type_paiement='REDEVANCE' AND statut<>'valide'),phase_actuelle=CASE WHEN NOT EXISTS(SELECT 1 FROM public.paiements WHERE client_id=s.id AND type_paiement='REDEVANCE' AND statut<>'valide') THEN 'termine_construction' ELSE s.phase_actuelle END WHERE id=NEW.client_id;
 END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_contrat_totaux(_client_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s RECORD;p RECORD;total numeric;pi numeric;days int;rate numeric;monthly numeric;
BEGIN
 SELECT * INTO s FROM public.clients WHERE id=_client_id; IF s IS NULL OR s.offre_id IS NULL THEN RETURN; END IF;
 SELECT * INTO p FROM public.offre_prix_effectif() WHERE offre_id=s.offre_id LIMIT 1; IF p IS NULL THEN RETURN; END IF;
 total:=COALESCE(p.montant_total_effectif,0)*COALESCE(s.total_hectares,0);
 pi:=LEAST(COALESCE(p.depot_initial_effectif,0)*COALESCE(s.total_hectares,0),total);
 days:=COALESCE((SELECT duree_paiement_mois FROM public.offres WHERE id=s.offre_id),40)*30;
 rate:=CASE WHEN days>0 AND COALESCE(s.total_hectares,0)>0 THEN total/days/s.total_hectares ELSE 0 END;
 SELECT COALESCE((t->>'mensualite_par_ha')::numeric,0)*COALESCE(s.total_hectares,0) INTO monthly FROM public.offres o,LATERAL jsonb_array_elements(COALESCE(o.tranches_paiement,'[]'::jsonb)) t WHERE o.id=s.offre_id AND COALESCE(t->>'type','')<>'paiement_initial' AND COALESCE((t->>'mensualite_par_ha')::numeric,0)>0 ORDER BY COALESCE((t->>'mois_debut')::int,999999) LIMIT 1;
 UPDATE public.clients SET montant_total_contrat=total,montant_promo_applique=GREATEST(COALESCE(p.montant_total_base,0)*COALESCE(s.total_hectares,0)-total,0),mensualite_montant=COALESCE(monthly,0),jours_contrat_total=days,taux_journalier_ha=rate,updated_at=now() WHERE id=_client_id;
END $$;

UPDATE public.clients s SET contrat_fin_at=s.contrat_debut_at+(o.duree_paiement_mois||' months')::interval FROM public.offres o WHERE s.offre_id=o.id AND s.contrat_debut_at IS NOT NULL;