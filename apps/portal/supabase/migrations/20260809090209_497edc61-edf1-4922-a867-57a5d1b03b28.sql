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
BEGIN
  SELECT * INTO v_payment
  FROM public.paiements
  WHERE id = _paiement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement introuvable';
  END IF;

  IF v_payment.statut = 'valide' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_validated', true,
      'paiement_id', v_payment.id,
      'souscripteur_id', v_payment.souscripteur_id,
      'plantation_id', v_payment.plantation_id
    );
  END IF;

  IF _transaction_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.paiements
    WHERE kkiapay_transaction_id = _transaction_id
      AND id <> v_payment.id
  ) THEN
    RAISE EXCEPTION 'Transaction déjà rattachée à un autre paiement';
  END IF;

  v_paid := CASE
    WHEN COALESCE(v_payment.est_depot_initial, false) AND COALESCE(v_payment.montant, 0) = 0 THEN 0
    ELSE COALESCE(_provider_amount, v_payment.montant_paye, v_payment.montant, 0)
  END;

  UPDATE public.paiements
  SET statut = 'valide',
      montant_paye = v_paid,
      date_paiement = COALESCE(date_paiement, _validated_at),
      date_validation = COALESCE(date_validation, _validated_at),
      kkiapay_transaction_id = COALESCE(_transaction_id, kkiapay_transaction_id),
      metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(_metadata, '{}'::jsonb),
      updated_at = now()
  WHERE id = v_payment.id;

  IF COALESCE(v_payment.est_depot_initial, false) AND v_payment.plantation_id IS NOT NULL THEN
    SELECT * INTO v_plantation
    FROM public.plantations
    WHERE id = v_payment.plantation_id
      AND souscripteur_id = v_payment.souscripteur_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plantation du paiement introuvable';
    END IF;

    UPDATE public.plantations
    SET superficie_activee = superficie_ha,
        montant_da_paye = GREATEST(COALESCE(montant_da_paye, 0), v_paid),
        date_activation = COALESCE(date_activation, _validated_at::date),
        statut = 'active',
        statut_global = 'actif',
        updated_at = now()
    WHERE id = v_plantation.id;

    UPDATE public.souscripteurs
    SET compte_actif = true,
        statut = CASE WHEN COALESCE(statut, '') IN ('', 'en_attente_da', 'en_attente') THEN 'actif' ELSE statut END,
        statut_global = 'actif',
        da_paye_at = COALESCE(da_paye_at, _validated_at),
        updated_at = now()
    WHERE id = v_payment.souscripteur_id;
  END IF;

  INSERT INTO public.historique_activites(
    table_name, record_id, action, details, nouvelles_valeurs
  ) VALUES (
    'paiements',
    v_payment.id::text,
    CASE WHEN COALESCE(v_payment.est_depot_initial, false) THEN 'PORTAL_DI_VALIDATED' ELSE 'PORTAL_MONTHLY_PAYMENT_VALIDATED' END,
    CASE WHEN COALESCE(v_payment.est_depot_initial, false)
      THEN 'Dépôt Initial validé et activation propagée au compte et à la plantation'
      ELSE 'Mensualité validée et propagée au compte client'
    END,
    jsonb_build_object(
      'reference', v_payment.reference,
      'transaction_id', _transaction_id,
      'montant_paye', v_paid,
      'validated_at', _validated_at,
      'souscripteur_id', v_payment.souscripteur_id,
      'plantation_id', v_payment.plantation_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_validated', false,
    'paiement_id', v_payment.id,
    'souscripteur_id', v_payment.souscripteur_id,
    'plantation_id', v_payment.plantation_id,
    'montant_paye', v_paid,
    'activated', COALESCE(v_payment.est_depot_initial, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_portal_payment(uuid, text, numeric, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_portal_payment(uuid, text, numeric, jsonb, timestamptz) TO service_role;