
-- 1. Remove public/anon SELECT policies on documents bucket
DROP POLICY IF EXISTS "Public read documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read docs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;

-- Add staff-only read for documents bucket (signed URLs still work via service role)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Staff read documents bucket') THEN
    CREATE POLICY "Staff read documents bucket" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'documents' AND public.is_staff(auth.uid()));
  END IF;
END $$;

-- 2. Restrict souscripteurs refund updates via trigger (column-level enforcement)
CREATE OR REPLACE FUNCTION public.enforce_souscripteur_refund_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If caller is staff, allow any change
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-staff (subscriber): only allow refund_requested_at and refund_reason to change
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

DROP TRIGGER IF EXISTS enforce_souscripteur_refund_update_trg ON public.paiements;
CREATE TRIGGER enforce_souscripteur_refund_update_trg
  BEFORE UPDATE ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_souscripteur_refund_update();

-- 3. activity_notes: require staff
DROP POLICY IF EXISTS "Staff create notes" ON public.activity_notes;
CREATE POLICY "Staff create notes" ON public.activity_notes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_staff(auth.uid()));

-- 4. historique_activites: require staff
DROP POLICY IF EXISTS "Authenticated insert history" ON public.historique_activites;
CREATE POLICY "Staff insert history" ON public.historique_activites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_staff(auth.uid()));

-- 5. retraits_portefeuille: restrict non-admin update to staff
DROP POLICY IF EXISTS "Staff update own retraits or admins" ON public.retraits_portefeuille;
CREATE POLICY "Staff update own retraits or admins" ON public.retraits_portefeuille
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.is_staff(auth.uid()) AND user_id = auth.uid()));
