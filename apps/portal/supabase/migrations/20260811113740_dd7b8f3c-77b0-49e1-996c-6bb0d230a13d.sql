CREATE OR REPLACE FUNCTION public.finalize_portal_payment(
  _paiement_id uuid,
  _transaction_id text DEFAULT NULL,
  _provider_amount numeric DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _validated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.paiements%ROWTYPE;
  v_plantation public.plantations%ROWTYPE;
  v_paid numeric;
  v_was_valid boolean;
BEGIN
  SELECT * INTO v_payment FROM public.paiements WHERE id = _paiement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable'; END IF;

  IF _transaction_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.paiements
    WHERE kkiapay_transaction_id = _transaction_id AND id <> v_payment.id
  ) THEN
    RAISE EXCEPTION 'Transaction déjà rattachée à un autre paiement';
  END IF;

  v_was_valid := v_payment.statut = 'valide';
  v_paid := CASE
    WHEN COALESCE(v_payment.est_depot_initial, false) AND COALESCE(v_payment.montant, 0) = 0 THEN 0
    ELSE COALESCE(_provider_amount, v_payment.montant_paye, v_payment.montant, 0)
  END;

  IF NOT v_was_valid THEN
    UPDATE public.paiements
    SET statut = 'valide', montant_paye = v_paid,
        date_paiement = COALESCE(date_paiement, _validated_at),
        date_validation = COALESCE(date_validation, _validated_at),
        kkiapay_transaction_id = COALESCE(_transaction_id, kkiapay_transaction_id),
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(_metadata, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_payment.id;
  ELSE
    UPDATE public.paiements
    SET kkiapay_transaction_id = COALESCE(_transaction_id, kkiapay_transaction_id),
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(_metadata, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_payment.id;
  END IF;

  IF COALESCE(v_payment.est_depot_initial, false) AND v_payment.plantation_id IS NOT NULL THEN
    SELECT * INTO v_plantation FROM public.plantations
    WHERE id = v_payment.plantation_id AND souscripteur_id = v_payment.souscripteur_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plantation du paiement introuvable'; END IF;

    UPDATE public.plantations
    SET superficie_activee = superficie_ha,
        montant_da_paye = GREATEST(COALESCE(montant_da_paye, 0), v_paid),
        date_activation = COALESCE(date_activation, _validated_at::date),
        statut = 'active', statut_global = 'actif', updated_at = now()
    WHERE id = v_plantation.id;

    UPDATE public.souscripteurs
    SET compte_actif = true,
        statut = CASE WHEN COALESCE(statut, '') IN ('', 'en_attente_da', 'en_attente') THEN 'actif' ELSE statut END,
        statut_global = 'actif',
        da_paye_at = COALESCE(da_paye_at, _validated_at), updated_at = now()
    WHERE id = v_payment.souscripteur_id;
  END IF;

  IF NOT v_was_valid THEN
    INSERT INTO public.historique_activites(table_name, record_id, action, details, nouvelles_valeurs)
    VALUES (
      'paiements', v_payment.id::text,
      CASE WHEN COALESCE(v_payment.est_depot_initial, false) THEN 'PORTAL_DI_VALIDATED' ELSE 'PORTAL_MONTHLY_PAYMENT_VALIDATED' END,
      CASE WHEN COALESCE(v_payment.est_depot_initial, false)
        THEN 'Dépôt Initial validé et activation propagée au compte et à la plantation'
        ELSE 'Mensualité validée et propagée au compte client' END,
      jsonb_build_object('reference', v_payment.reference, 'transaction_id', _transaction_id,
        'montant_paye', v_paid, 'validated_at', _validated_at,
        'souscripteur_id', v_payment.souscripteur_id, 'plantation_id', v_payment.plantation_id)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'already_validated', v_was_valid,
    'paiement_id', v_payment.id, 'souscripteur_id', v_payment.souscripteur_id,
    'plantation_id', v_payment.plantation_id, 'montant_paye', v_paid,
    'activated', COALESCE(v_payment.est_depot_initial, false));
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_portal_payment(uuid, text, numeric, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_portal_payment(uuid, text, numeric, jsonb, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_paiement_valide()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s RECORD; v_o RECORD; v_debut date; v_tranche jsonb; v_idx int := 0;
  v_mois int; v_mensualite numeric; v_annee_offre int;
BEGIN
  IF NEW.statut <> 'valide' OR COALESCE(OLD.statut,'') = 'valide' THEN RETURN NEW; END IF;
  IF NEW.est_depot_initial = true THEN
    SELECT * INTO v_s FROM public.souscripteurs WHERE id = NEW.souscripteur_id;
    IF v_s IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO v_o FROM public.offres WHERE id = v_s.offre_id;
    IF v_o IS NULL THEN RETURN NEW; END IF;
    v_debut := current_date;
    UPDATE public.souscripteurs SET compte_actif = true, statut_global = 'actif',
      da_paye_at = COALESCE(da_paye_at, now()), contrat_debut_at = COALESCE(contrat_debut_at, v_debut),
      contrat_fin_at = COALESCE(contrat_fin_at, v_debut + (COALESCE(v_o.duree_paiement_mois,35) || ' months')::interval),
      phase_actuelle = 'annee_1', prochaine_echeance = COALESCE(prochaine_echeance, v_debut + interval '1 month')
    WHERE id = NEW.souscripteur_id;
    PERFORM public.recompute_contrat_totaux(NEW.souscripteur_id);
    IF NOT EXISTS (SELECT 1 FROM public.paiements WHERE souscripteur_id=NEW.souscripteur_id AND type_paiement='REDEVANCE') THEN
      FOR v_tranche IN SELECT * FROM jsonb_array_elements(COALESCE(v_o.tranches_paiement,'[]'::jsonb)) LOOP
        v_annee_offre := (v_tranche->>'annee')::int;
        v_mensualite := (v_tranche->>'mensualite_par_ha')::numeric * COALESCE(v_s.total_hectares,0);
        FOR v_mois IN 1..((v_tranche->>'mois')::int) LOOP
          v_idx := v_idx + 1;
          INSERT INTO public.paiements(souscripteur_id,type_paiement,statut,montant,montant_theorique,numero_echeance,date_echeance,annee,phase,est_depot_initial)
          VALUES(NEW.souscripteur_id,'REDEVANCE','en_attente',v_mensualite,v_mensualite,v_idx,
            (v_debut+(v_idx||' months')::interval)::date,
            EXTRACT(YEAR FROM v_debut+(v_idx||' months')::interval)::int,'annee_'||v_annee_offre,false);
        END LOOP;
      END LOOP;
    END IF;
    IF v_s.user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,message,data)
      VALUES(v_s.user_id,'compte','Compte activé',
        'Votre compte est activé. Vos mensualités sont désormais disponibles.',
        jsonb_build_object('debut',v_debut,'duree_mois',COALESCE(v_o.duree_paiement_mois,35),'paiement_id',NEW.id));
    END IF;
  ELSIF NEW.type_paiement = 'REDEVANCE' THEN
    UPDATE public.souscripteurs s SET prochaine_echeance=(SELECT MIN(date_echeance) FROM public.paiements WHERE souscripteur_id=s.id AND type_paiement='REDEVANCE' AND statut<>'valide'),
      phase_actuelle=CASE WHEN NOT EXISTS(SELECT 1 FROM public.paiements WHERE souscripteur_id=s.id AND type_paiement='REDEVANCE' AND statut<>'valide') THEN 'termine_construction' ELSE s.phase_actuelle END
    WHERE id=NEW.souscripteur_id;
  END IF;
  RETURN NEW;
END;
$$;