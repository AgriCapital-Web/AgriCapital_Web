CREATE OR REPLACE FUNCTION public.handle_paiement_valide() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_s RECORD; v_o RECORD; v_debut date; v_tranche jsonb; v_idx int:=0; v_mois int; v_mensualite numeric; v_annee_offre int; v_mode text;
BEGIN
 IF NEW.statut<>'valide' OR COALESCE(OLD.statut,'')='valide' THEN RETURN NEW; END IF;
 IF NEW.est_depot_initial=true THEN
  SELECT * INTO v_s FROM public.souscripteurs WHERE id=NEW.souscripteur_id; IF v_s IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_o FROM public.offres WHERE id=v_s.offre_id; IF v_o IS NULL THEN RETURN NEW; END IF;
  v_mode:=COALESCE(v_s.mode_paiement,'echeancier'); v_debut:=current_date;
  UPDATE public.souscripteurs SET compte_actif=true,statut_global='actif',da_paye_at=COALESCE(da_paye_at,now()),contrat_debut_at=COALESCE(contrat_debut_at,v_debut),contrat_fin_at=COALESCE(contrat_fin_at,v_debut+(COALESCE(v_o.duree_paiement_mois,40)||' months')::interval),phase_actuelle='annee_1',prochaine_echeance=CASE WHEN v_mode='comptant' THEN NULL ELSE COALESCE(prochaine_echeance,v_debut+interval '1 month') END WHERE id=NEW.souscripteur_id;
  PERFORM public.recompute_contrat_totaux(NEW.souscripteur_id);
  IF v_mode <> 'comptant' AND NOT EXISTS(SELECT 1 FROM public.paiements WHERE souscripteur_id=NEW.souscripteur_id AND type_paiement='REDEVANCE') THEN
   FOR v_tranche IN SELECT value FROM jsonb_array_elements(COALESCE(v_o.tranches_paiement,'[]'::jsonb)) LOOP
    IF COALESCE(v_tranche->>'type','')='paiement_initial' OR COALESCE((v_tranche->>'mensualite_par_ha')::numeric,0)<=0 THEN CONTINUE; END IF;
    v_annee_offre:=COALESCE((v_tranche->>'annee')::int,1); v_mensualite:=(v_tranche->>'mensualite_par_ha')::numeric*COALESCE(v_s.total_hectares,0);
    FOR v_mois IN 1..COALESCE((v_tranche->>'mois')::int,0) LOOP
     v_idx:=v_idx+1;
     INSERT INTO public.paiements(souscripteur_id,type_paiement,statut,montant,montant_theorique,numero_echeance,date_echeance,annee,phase,est_depot_initial)
     VALUES(NEW.souscripteur_id,'REDEVANCE','en_attente',v_mensualite,v_mensualite,v_idx,(v_debut+(v_idx||' months')::interval)::date,EXTRACT(YEAR FROM v_debut+(v_idx||' months')::interval)::int,'annee_'||v_annee_offre,false);
    END LOOP;
   END LOOP;
  END IF;
  IF v_s.user_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,message,data)
    VALUES(v_s.user_id,'compte','Compte activé',CASE WHEN v_mode='comptant' THEN 'Votre paiement comptant est enregistré. Votre compte est activé.' ELSE 'Votre compte est activé. Vos mensualités sont désormais disponibles.' END,jsonb_build_object('debut',v_debut,'duree_mois',COALESCE(v_o.duree_paiement_mois,40),'mode_paiement',v_mode,'paiement_id',NEW.id));
  END IF;
 ELSIF NEW.type_paiement='REDEVANCE' THEN
  UPDATE public.souscripteurs s SET prochaine_echeance=(SELECT MIN(date_echeance) FROM public.paiements WHERE souscripteur_id=s.id AND type_paiement='REDEVANCE' AND statut<>'valide'),phase_actuelle=CASE WHEN NOT EXISTS(SELECT 1 FROM public.paiements WHERE souscripteur_id=s.id AND type_paiement='REDEVANCE' AND statut<>'valide') THEN 'termine_construction' ELSE s.phase_actuelle END WHERE id=NEW.souscripteur_id;
 END IF; RETURN NEW;
END $$;