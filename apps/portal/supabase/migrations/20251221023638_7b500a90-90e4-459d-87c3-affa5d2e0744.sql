-- Activer le Realtime sur les tables principales
ALTER PUBLICATION supabase_realtime ADD TABLE public.souscripteurs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plantations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.paiements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_support;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;

-- S'assurer que REPLICA IDENTITY est FULL pour les mises à jour complètes
ALTER TABLE public.souscripteurs REPLICA IDENTITY FULL;
ALTER TABLE public.plantations REPLICA IDENTITY FULL;
ALTER TABLE public.paiements REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.tickets_support REPLICA IDENTITY FULL;
ALTER TABLE public.documents REPLICA IDENTITY FULL;

-- Ajouter colonne superficie_activee et date_activation si manquantes sur plantations
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plantations' AND column_name = 'superficie_activee') THEN
    ALTER TABLE public.plantations ADD COLUMN superficie_activee numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plantations' AND column_name = 'date_activation') THEN
    ALTER TABLE public.plantations ADD COLUMN date_activation timestamp with time zone;
  END IF;
END $$;