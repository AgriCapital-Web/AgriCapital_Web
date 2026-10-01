-- Remove unsafe public read policies from the private documents bucket if they still exist
DROP POLICY IF EXISTS "Public read documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read docs" ON storage.objects;

-- Ensure documents bucket remains private and readable only by staff
UPDATE storage.buckets
SET public = false
WHERE id = 'documents';

DROP POLICY IF EXISTS "Staff read documents bucket" ON storage.objects;
CREATE POLICY "Staff read documents bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING ((bucket_id = 'documents') AND public.is_staff(auth.uid()));

-- Ensure activity notes can only be created by staff users
DROP POLICY IF EXISTS "Staff create notes" ON public.activity_notes;
CREATE POLICY "Staff create notes"
ON public.activity_notes
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = user_id) AND public.is_staff(auth.uid()));

-- Ensure audit history can only be written by staff users
DROP POLICY IF EXISTS "Authenticated insert history" ON public.historique_activites;
DROP POLICY IF EXISTS "Staff insert history" ON public.historique_activites;
CREATE POLICY "Staff insert history"
ON public.historique_activites
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = user_id) AND public.is_staff(auth.uid()));

-- Ensure only staff users can update their own withdrawal records, while admins can update all
DROP POLICY IF EXISTS "Staff update own retraits or admins" ON public.retraits_portefeuille;
CREATE POLICY "Staff update own retraits or admins"
ON public.retraits_portefeuille
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR (public.is_staff(auth.uid()) AND (user_id = auth.uid())));

-- Restrict subscriber refund requests to refund-only fields and keep sensitive payment fields immutable for non-staff users
CREATE OR REPLACE FUNCTION public.prevent_non_staff_payment_field_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Staff/admin workflows keep their existing full payment-management capability through RLS.
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-staff users may only create a refund request on an already validated payment.
  IF OLD.statut IS DISTINCT FROM 'valide' OR OLD.refund_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized payment update' USING ERRCODE = '42501';
  END IF;

  IF NEW.refund_requested_at IS NULL THEN
    RAISE EXCEPTION 'Refund request timestamp is required' USING ERRCODE = '23514';
  END IF;

  -- Prevent changes to every sensitive payment column. Only refund_requested_at and refund_reason are client-settable.
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

  -- Keep updated_at controlled by the database, not by the client request.
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_non_staff_payment_field_update_trigger ON public.paiements;
CREATE TRIGGER prevent_non_staff_payment_field_update_trigger
BEFORE UPDATE ON public.paiements
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_staff_payment_field_update();

DROP POLICY IF EXISTS "Souscripteurs request own refund" ON public.paiements;
CREATE POLICY "Souscripteurs request own refund"
ON public.paiements
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.souscripteurs s
    WHERE s.id = paiements.souscripteur_id
      AND s.user_id = auth.uid()
  )
  AND statut = 'valide'
  AND refund_requested_at IS NULL
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.souscripteurs s
    WHERE s.id = paiements.souscripteur_id
      AND s.user_id = auth.uid()
  )
  AND statut = 'valide'
  AND refund_requested_at IS NOT NULL
);