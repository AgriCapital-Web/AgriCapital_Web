-- =============================================
-- TABLES MANQUANTES POUR LE PROJET COMPLET
-- =============================================

-- 1. Table souscriptions_brouillon (pour le formulaire de souscription)
CREATE TABLE IF NOT EXISTS public.souscriptions_brouillon (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etape_actuelle INTEGER DEFAULT 0,
  donnees JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.souscriptions_brouillon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_brouillons" ON public.souscriptions_brouillon
  FOR SELECT USING (true);

CREATE POLICY "write_brouillons" ON public.souscriptions_brouillon
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Table portefeuilles (pour la page Portefeuilles)
CREATE TABLE IF NOT EXISTS public.portefeuilles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  solde_commissions NUMERIC DEFAULT 0,
  total_gagne NUMERIC DEFAULT 0,
  total_retire NUMERIC DEFAULT 0,
  dernier_versement_date TIMESTAMP WITH TIME ZONE,
  dernier_versement_montant NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.portefeuilles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_portefeuilles" ON public.portefeuilles
  FOR SELECT USING (true);

CREATE POLICY "write_portefeuilles" ON public.portefeuilles
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Table retraits_portefeuille
CREATE TABLE IF NOT EXISTS public.retraits_portefeuille (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portefeuille_id UUID NOT NULL REFERENCES public.portefeuilles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  montant NUMERIC NOT NULL,
  mode_paiement TEXT DEFAULT 'Mobile Money',
  numero_compte TEXT,
  statut TEXT DEFAULT 'en_attente',
  date_demande TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date_traitement TIMESTAMP WITH TIME ZONE,
  traite_par UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.retraits_portefeuille ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_retraits" ON public.retraits_portefeuille
  FOR SELECT USING (true);

CREATE POLICY "write_retraits" ON public.retraits_portefeuille
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Table statuts_personnalises (pour GestionStatuts)
CREATE TABLE IF NOT EXISTS public.statuts_personnalises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entite TEXT NOT NULL,
  code TEXT NOT NULL,
  libelle TEXT NOT NULL,
  couleur TEXT DEFAULT '#6b7280',
  description TEXT,
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entite, code)
);

ALTER TABLE public.statuts_personnalises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_statuts" ON public.statuts_personnalises
  FOR SELECT USING (true);

CREATE POLICY "write_statuts" ON public.statuts_personnalises
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Table champs_personnalises (pour ChampsPersonnalises)
CREATE TABLE IF NOT EXISTS public.champs_personnalises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entite TEXT NOT NULL,
  nom_champ TEXT NOT NULL,
  libelle TEXT NOT NULL,
  type_champ TEXT DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  obligatoire BOOLEAN DEFAULT false,
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.champs_personnalises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_champs" ON public.champs_personnalises
  FOR SELECT USING (true);

CREATE POLICY "write_champs" ON public.champs_personnalises
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Table parametres_notifications (pour GestionNotifications)
CREATE TABLE IF NOT EXISTS public.parametres_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  type_notification TEXT NOT NULL,
  canal TEXT DEFAULT 'app',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parametres_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_params_notif" ON public.parametres_notifications
  FOR SELECT USING (true);

CREATE POLICY "write_params_notif" ON public.parametres_notifications
  FOR ALL USING (true) WITH CHECK (true);

-- 7. Ajouter colonnes manquantes à account_requests
ALTER TABLE public.account_requests 
ADD COLUMN IF NOT EXISTS poste_souhaite TEXT,
ADD COLUMN IF NOT EXISTS role_souhaite TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS justification TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS traite_par UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS traite_le TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS motif_rejet TEXT;

-- Policy UPDATE pour account_requests
DROP POLICY IF EXISTS "update_account_requests" ON public.account_requests;
CREATE POLICY "update_account_requests" ON public.account_requests
  FOR UPDATE USING (true) WITH CHECK (true);

-- 8. Fonction pour générer ID souscripteur
CREATE OR REPLACE FUNCTION public.generate_souscripteur_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  year_suffix TEXT;
BEGIN
  SELECT EXTRACT(YEAR FROM now())::TEXT INTO year_suffix;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN id_unique ~ '^AC-[0-9]{4}-[0-9]+$' 
      THEN SPLIT_PART(id_unique, '-', 3)::INTEGER 
      ELSE 0 
    END
  ), 0) + 1 INTO next_num
  FROM souscripteurs
  WHERE id_unique LIKE 'AC-' || year_suffix || '-%';
  
  RETURN 'AC-' || year_suffix || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

-- 9. Insérer des statuts par défaut
INSERT INTO public.statuts_personnalises (entite, code, libelle, couleur, description, ordre)
VALUES 
  ('souscripteur', 'actif', 'Actif', '#22c55e', 'Souscripteur actif', 1),
  ('souscripteur', 'suspendu', 'Suspendu', '#f59e0b', 'Souscripteur temporairement suspendu', 2),
  ('souscripteur', 'archive', 'Archivé', '#6b7280', 'Souscripteur archivé', 3),
  ('plantation', 'en_attente_da', 'En attente DA', '#3b82f6', 'En attente du droit d''accès', 1),
  ('plantation', 'da_partiel', 'DA Partiel', '#f59e0b', 'Droit d''accès partiellement payé', 2),
  ('plantation', 'da_complet', 'DA Complet', '#22c55e', 'Droit d''accès payé intégralement', 3),
  ('plantation', 'actif', 'Actif', '#22c55e', 'Plantation active', 4),
  ('plantation', 'suspendu', 'Suspendu', '#ef4444', 'Plantation suspendue', 5),
  ('paiement', 'en_attente', 'En attente', '#f59e0b', 'Paiement en attente', 1),
  ('paiement', 'valide', 'Validé', '#22c55e', 'Paiement validé', 2),
  ('paiement', 'rejete', 'Rejeté', '#ef4444', 'Paiement rejeté', 3)
ON CONFLICT (entite, code) DO NOTHING;

-- 10. Triggers updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_brouillons_updated_at ON public.souscriptions_brouillon;
CREATE TRIGGER set_brouillons_updated_at
  BEFORE UPDATE ON public.souscriptions_brouillon
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_portefeuilles_updated_at ON public.portefeuilles;
CREATE TRIGGER set_portefeuilles_updated_at
  BEFORE UPDATE ON public.portefeuilles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_statuts_updated_at ON public.statuts_personnalises;
CREATE TRIGGER set_statuts_updated_at
  BEFORE UPDATE ON public.statuts_personnalises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_champs_updated_at ON public.champs_personnalises;
CREATE TRIGGER set_champs_updated_at
  BEFORE UPDATE ON public.champs_personnalises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_params_notif_updated_at ON public.parametres_notifications;
CREATE TRIGGER set_params_notif_updated_at
  BEFORE UPDATE ON public.parametres_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11. Activer Realtime pour les nouvelles tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.souscriptions_brouillon;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portefeuilles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.retraits_portefeuille;
ALTER PUBLICATION supabase_realtime ADD TABLE public.statuts_personnalises;
ALTER PUBLICATION supabase_realtime ADD TABLE public.champs_personnalises;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parametres_notifications;