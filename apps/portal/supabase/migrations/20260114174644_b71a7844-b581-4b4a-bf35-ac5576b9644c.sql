-- ==========================================
-- Tables et indexes (sans realtime car déjà activé)
-- ==========================================

-- Table cotitulaires pour stocker les co-titulaires
CREATE TABLE IF NOT EXISTS public.cotitulaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  souscripteur_id UUID REFERENCES public.souscripteurs(id) ON DELETE CASCADE,
  civilite TEXT,
  nom TEXT NOT NULL,
  prenoms TEXT,
  date_naissance DATE,
  relation TEXT,
  type_piece TEXT,
  numero_piece TEXT,
  date_delivrance DATE,
  photo_cni_recto_url TEXT,
  photo_cni_verso_url TEXT,
  photo_profil_url TEXT,
  telephone TEXT,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cotitulaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_cotitulaires" ON public.cotitulaires
  FOR SELECT USING (is_admin_or_staff());

CREATE POLICY "staff_write_cotitulaires" ON public.cotitulaires
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- Table backups_historique
CREATE TABLE IF NOT EXISTS public.backups_historique (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  type_backup TEXT DEFAULT 'manuel',
  format TEXT DEFAULT 'json',
  taille_octets BIGINT,
  tables_incluses JSONB DEFAULT '[]'::jsonb,
  url_stockage TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.backups_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_backups" ON public.backups_historique
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "staff_read_backups" ON public.backups_historique
  FOR SELECT USING (is_admin_or_staff());

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_paiements_souscripteur ON public.paiements(souscripteur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON public.paiements(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON public.paiements(date_paiement);
CREATE INDEX IF NOT EXISTS idx_plantations_souscripteur ON public.plantations(souscripteur_id);
CREATE INDEX IF NOT EXISTS idx_plantations_statut ON public.plantations(statut_global);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_statut ON public.souscripteurs(statut_global);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_telephone ON public.souscripteurs(telephone);
CREATE INDEX IF NOT EXISTS idx_regions_district ON public.regions(district_id);
CREATE INDEX IF NOT EXISTS idx_departements_region ON public.departements(region_id);
CREATE INDEX IF NOT EXISTS idx_sous_prefectures_departement ON public.sous_prefectures(departement_id);

-- Fonction pour mettre à jour automatiquement le statut du souscripteur après paiement
CREATE OR REPLACE FUNCTION public.update_souscripteur_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  total_da NUMERIC;
BEGIN
  SELECT COALESCE(SUM(montant), 0) INTO total_da
  FROM public.paiements
  WHERE souscripteur_id = NEW.souscripteur_id
    AND statut = 'valide'
    AND type_paiement = 'DA';

  UPDATE public.souscripteurs
  SET total_da_verse = total_da,
      statut_global = CASE 
        WHEN total_da >= 30000 THEN 'actif'
        WHEN total_da > 0 THEN 'en_cours'
        ELSE 'en_attente'
      END,
      updated_at = now()
  WHERE id = NEW.souscripteur_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_souscripteur_on_payment ON public.paiements;
CREATE TRIGGER trigger_update_souscripteur_on_payment
  AFTER INSERT OR UPDATE OF statut ON public.paiements
  FOR EACH ROW
  WHEN (NEW.statut = 'valide')
  EXECUTE FUNCTION public.update_souscripteur_status_on_payment();

-- Fonction pour mettre à jour le nombre de plantations du souscripteur
CREATE OR REPLACE FUNCTION public.update_souscripteur_plantations_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.souscripteurs
  SET nombre_plantations = (
    SELECT COUNT(*) FROM public.plantations WHERE souscripteur_id = COALESCE(NEW.souscripteur_id, OLD.souscripteur_id)
  ),
  total_hectares = (
    SELECT COALESCE(SUM(superficie_ha), 0) FROM public.plantations WHERE souscripteur_id = COALESCE(NEW.souscripteur_id, OLD.souscripteur_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.souscripteur_id, OLD.souscripteur_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_souscripteur_plantations ON public.plantations;
CREATE TRIGGER trigger_update_souscripteur_plantations
  AFTER INSERT OR UPDATE OR DELETE ON public.plantations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_souscripteur_plantations_count();