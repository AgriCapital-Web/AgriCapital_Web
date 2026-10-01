
-- 1) Table d'événements webhook KKiaPay (audit + idempotence + suivi d'état)
CREATE TABLE IF NOT EXISTS public.kkiapay_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  reference TEXT,
  paiement_id UUID,
  status TEXT NOT NULL CHECK (status IN ('CREATED','PENDING','SUCCESS','FAILED','REFUNDED','CANCELLED')),
  amount NUMERIC,
  fees NUMERIC DEFAULT 0,
  source TEXT,
  signature_valid BOOLEAN DEFAULT false,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (transaction_id, status)
);

CREATE INDEX IF NOT EXISTS idx_kkiapay_events_paiement ON public.kkiapay_events(paiement_id);
CREATE INDEX IF NOT EXISTS idx_kkiapay_events_txn ON public.kkiapay_events(transaction_id);

ALTER TABLE public.kkiapay_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access kkiapay_events"
  ON public.kkiapay_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Staff read kkiapay_events"
  ON public.kkiapay_events FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Souscripteurs read own kkiapay_events"
  ON public.kkiapay_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.paiements p
    JOIN public.souscripteurs s ON s.id = p.souscripteur_id
    WHERE p.id = kkiapay_events.paiement_id AND s.user_id = auth.uid()
  ));

-- 2) Élargir les statuts paiements et ajouter colonnes de suivi
ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS kkiapay_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_paiements_kkiapay_txn ON public.paiements(kkiapay_transaction_id);

-- 3) Trigger : si un paiement DA passe à 'annule' ou 'rembourse' -> reverse l'activation plantation
CREATE OR REPLACE FUNCTION public.reverse_plantation_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  IF NEW.statut IN ('annule','rembourse') 
     AND OLD.statut NOT IN ('annule','rembourse')
     AND NEW.type_paiement = 'DA' 
     AND NEW.plantation_id IS NOT NULL THEN
    
    v_amount := COALESCE(NEW.montant_paye, NEW.montant, 0);
    
    UPDATE public.plantations
    SET 
      superficie_activee = GREATEST(0, COALESCE(superficie_activee,0) - COALESCE(superficie_ha,0)),
      montant_da = GREATEST(0, COALESCE(montant_da,0) - v_amount),
      statut_global = CASE 
        WHEN GREATEST(0, COALESCE(superficie_activee,0) - COALESCE(superficie_ha,0)) <= 0 
        THEN 'en_attente_da' 
        ELSE statut_global 
      END,
      date_activation = CASE 
        WHEN GREATEST(0, COALESCE(superficie_activee,0) - COALESCE(superficie_ha,0)) <= 0 
        THEN NULL 
        ELSE date_activation 
      END,
      updated_at = now()
    WHERE id = NEW.plantation_id;

    -- Marquer les timestamps
    IF NEW.statut = 'annule' AND NEW.cancelled_at IS NULL THEN
      NEW.cancelled_at := now();
    END IF;
    IF NEW.statut = 'rembourse' AND NEW.refunded_at IS NULL THEN
      NEW.refunded_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_plantation_on_refund ON public.paiements;
CREATE TRIGGER trg_reverse_plantation_on_refund
BEFORE UPDATE OF statut ON public.paiements
FOR EACH ROW
EXECUTE FUNCTION public.reverse_plantation_on_refund();

-- 4) Permettre au client de demander un remboursement sur ses propres paiements valides
CREATE POLICY "Souscripteurs request own refund"
  ON public.paiements FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.souscripteurs s
      WHERE s.id = paiements.souscripteur_id AND s.user_id = auth.uid()
    )
    AND statut = 'valide'
    AND refund_requested_at IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.souscripteurs s
      WHERE s.id = paiements.souscripteur_id AND s.user_id = auth.uid()
    )
  );

-- 5) Permettre au client de créer une demande dans `remboursements` pour ses paiements
CREATE POLICY "Souscripteurs create own refund request"
  ON public.remboursements FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.souscripteurs s
      WHERE s.id = remboursements.souscripteur_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Souscripteurs read own refunds"
  ON public.remboursements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.souscripteurs s
      WHERE s.id = remboursements.souscripteur_id AND s.user_id = auth.uid()
    )
  );
