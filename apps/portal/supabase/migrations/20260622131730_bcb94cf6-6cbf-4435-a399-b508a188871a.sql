CREATE OR REPLACE FUNCTION public.enforce_souscripteur_refund_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres')
     OR current_role IN ('service_role', 'postgres')
     OR session_user IN ('service_role', 'postgres')
     OR current_setting('request.jwt.claim.role', true) = 'service_role'
     OR public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.montant IS DISTINCT FROM OLD.montant
     OR NEW.montant_paye IS DISTINCT FROM OLD.montant_paye
     OR NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.valide_par IS DISTINCT FROM OLD.valide_par
     OR NEW.date_validation IS DISTINCT FROM OLD.date_validation
     OR NEW.souscripteur_id IS DISTINCT FROM OLD.souscripteur_id
     OR NEW.plantation_id IS DISTINCT FROM OLD.plantation_id
     OR NEW.type_paiement IS DISTINCT FROM OLD.type_paiement
     OR NEW.mode_paiement IS DISTINCT FROM OLD.mode_paiement
     OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.id_transaction IS DISTINCT FROM OLD.id_transaction
     OR NEW.kkiapay_transaction_id IS DISTINCT FROM OLD.kkiapay_transaction_id
     OR NEW.date_paiement IS DISTINCT FROM OLD.date_paiement
     OR NEW.date_echeance IS DISTINCT FROM OLD.date_echeance
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.preuve_paiement_url IS DISTINCT FROM OLD.preuve_paiement_url
     OR NEW.fichier_preuve_url IS DISTINCT FROM OLD.fichier_preuve_url
  THEN
    RAISE EXCEPTION 'Seuls les champs de demande de remboursement peuvent être modifiés';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_non_staff_payment_field_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres')
     OR current_role IN ('service_role', 'postgres')
     OR session_user IN ('service_role', 'postgres')
     OR current_setting('request.jwt.claim.role', true) = 'service_role'
     OR public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.statut IS DISTINCT FROM 'valide' OR OLD.refund_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized payment update' USING ERRCODE = '42501';
  END IF;

  IF NEW.refund_requested_at IS NULL THEN
    RAISE EXCEPTION 'Refund request timestamp is required' USING ERRCODE = '23514';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.souscripteur_id IS DISTINCT FROM OLD.souscripteur_id
    OR NEW.plantation_id IS DISTINCT FROM OLD.plantation_id
    OR NEW.montant IS DISTINCT FROM OLD.montant
    OR NEW.montant_paye IS DISTINCT FROM OLD.montant_paye
    OR NEW.type_paiement IS DISTINCT FROM OLD.type_paiement
    OR NEW.mode_paiement IS DISTINCT FROM OLD.mode_paiement
    OR NEW.statut IS DISTINCT FROM OLD.statut
    OR NEW.reference IS DISTINCT FROM OLD.reference
    OR NEW.date_paiement IS DISTINCT FROM OLD.date_paiement
    OR NEW.date_echeance IS DISTINCT FROM OLD.date_echeance
    OR NEW.preuve_paiement_url IS DISTINCT FROM OLD.preuve_paiement_url
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.valide_par IS DISTINCT FROM OLD.valide_par
    OR NEW.date_validation IS DISTINCT FROM OLD.date_validation
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.kkiapay_transaction_id IS DISTINCT FROM OLD.kkiapay_transaction_id
    OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at
    OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
    OR NEW.montant_theorique IS DISTINCT FROM OLD.montant_theorique
    OR NEW.annee IS DISTINCT FROM OLD.annee
    OR NEW.type_preuve IS DISTINCT FROM OLD.type_preuve
    OR NEW.id_transaction IS DISTINCT FROM OLD.id_transaction
    OR NEW.operateur_mobile_money IS DISTINCT FROM OLD.operateur_mobile_money
    OR NEW.fichier_preuve_url IS DISTINCT FROM OLD.fichier_preuve_url
    OR NEW.date_upload_preuve IS DISTINCT FROM OLD.date_upload_preuve
    OR NEW.observations IS DISTINCT FROM OLD.observations
  THEN
    RAISE EXCEPTION 'Only refund request fields can be updated by clients' USING ERRCODE = '42501';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;