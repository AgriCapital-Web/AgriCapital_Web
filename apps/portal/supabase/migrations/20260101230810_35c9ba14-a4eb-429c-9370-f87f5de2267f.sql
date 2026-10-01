-- Paiements: permettre au portail public (anon) de créer un paiement en attente
-- (nécessaire pour initier un paiement FedaPay depuis /pay sans authentification)

-- Sécurisation minimale: l'anon ne peut pas changer le statut (reste en_attente).

ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Policy INSERT (anon)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paiements'
      AND policyname = 'anon_insert_paiements'
  ) THEN
    CREATE POLICY anon_insert_paiements
      ON public.paiements
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;

  -- Policy UPDATE (anon) - uniquement sur les paiements en attente, sans changement de statut
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paiements'
      AND policyname = 'anon_update_pending_paiements'
  ) THEN
    CREATE POLICY anon_update_pending_paiements
      ON public.paiements
      FOR UPDATE
      TO anon
      USING (statut = 'en_attente')
      WITH CHECK (statut = 'en_attente');
  END IF;
END $$;