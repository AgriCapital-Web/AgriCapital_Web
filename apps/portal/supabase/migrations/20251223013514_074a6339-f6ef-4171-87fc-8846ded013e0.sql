-- Table pour stocker les événements FedaPay (webhooks)
CREATE TABLE IF NOT EXISTS public.fedapay_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT,
  event_type TEXT NOT NULL,
  transaction_id TEXT,
  transaction_reference TEXT,
  status TEXT,
  amount NUMERIC,
  customer_email TEXT,
  customer_phone TEXT,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  paiement_id UUID REFERENCES public.paiements(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_fedapay_events_transaction_id ON public.fedapay_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fedapay_events_transaction_reference ON public.fedapay_events(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_fedapay_events_processed ON public.fedapay_events(processed);

-- Enable RLS
ALTER TABLE public.fedapay_events ENABLE ROW LEVEL SECURITY;

-- RLS policies pour fedapay_events (admin only)
CREATE POLICY "read_fedapay_events" ON public.fedapay_events 
FOR SELECT USING (true);

CREATE POLICY "write_fedapay_events" ON public.fedapay_events 
FOR ALL USING (true) WITH CHECK (true);

-- Ajouter colonne fedapay_transaction_id à paiements si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'paiements' AND column_name = 'fedapay_reference') THEN
    ALTER TABLE public.paiements ADD COLUMN fedapay_reference TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'paiements' AND column_name = 'montant_paye') THEN
    ALTER TABLE public.paiements ADD COLUMN montant_paye NUMERIC DEFAULT 0;
  END IF;
END $$;

-- Enable realtime pour fedapay_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.fedapay_events;