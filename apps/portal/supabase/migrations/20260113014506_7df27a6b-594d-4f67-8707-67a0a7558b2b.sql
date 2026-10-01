-- Enable realtime for key tables (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'paiements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.paiements;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'souscripteurs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.souscripteurs;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'plantations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plantations;
  END IF;
END $$;

-- Updated_at triggers (missing in project)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_paiements_updated_at') THEN
    CREATE TRIGGER trg_paiements_updated_at
    BEFORE UPDATE ON public.paiements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_plantations_updated_at') THEN
    CREATE TRIGGER trg_plantations_updated_at
    BEFORE UPDATE ON public.plantations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_souscripteurs_updated_at') THEN
    CREATE TRIGGER trg_souscripteurs_updated_at
    BEFORE UPDATE ON public.souscripteurs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_promotions_updated_at') THEN
    CREATE TRIGGER trg_promotions_updated_at
    BEFORE UPDATE ON public.promotions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_offres_updated_at') THEN
    CREATE TRIGGER trg_offres_updated_at
    BEFORE UPDATE ON public.offres
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_equipes_updated_at') THEN
    CREATE TRIGGER trg_equipes_updated_at
    BEFORE UPDATE ON public.equipes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_configurations_systeme_updated_at') THEN
    CREATE TRIGGER trg_configurations_systeme_updated_at
    BEFORE UPDATE ON public.configurations_systeme
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_champs_personnalises_updated_at') THEN
    CREATE TRIGGER trg_champs_personnalises_updated_at
    BEFORE UPDATE ON public.champs_personnalises
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notes_updated_at') THEN
    CREATE TRIGGER trg_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_documents_updated_at') THEN
    CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tickets_support_updated_at') THEN
    CREATE TRIGGER trg_tickets_support_updated_at
    BEFORE UPDATE ON public.tickets_support
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_parametres_notifications_updated_at') THEN
    CREATE TRIGGER trg_parametres_notifications_updated_at
    BEFORE UPDATE ON public.parametres_notifications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_paiements_created_at ON public.paiements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paiements_statut_created_at ON public.paiements (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paiements_souscripteur_created_at ON public.paiements (souscripteur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paiements_plantation_created_at ON public.paiements (plantation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paiements_type_statut ON public.paiements (type_paiement, statut);

CREATE INDEX IF NOT EXISTS idx_plantations_souscripteur ON public.plantations (souscripteur_id);
CREATE INDEX IF NOT EXISTS idx_plantations_statut_global ON public.plantations (statut_global);
CREATE INDEX IF NOT EXISTS idx_plantations_region ON public.plantations (region_id);

CREATE INDEX IF NOT EXISTS idx_souscripteurs_telephone ON public.souscripteurs (telephone);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_id_unique ON public.souscripteurs (id_unique);

CREATE INDEX IF NOT EXISTS idx_transferts_created_at ON public.transferts_paiements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transferts_source_dest ON public.transferts_paiements (souscripteur_source_id, souscripteur_dest_id);

CREATE INDEX IF NOT EXISTS idx_remboursements_created_at ON public.remboursements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remboursements_statut ON public.remboursements (statut);
