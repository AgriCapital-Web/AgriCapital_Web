-- Création des tables manquantes pour les rapports techniques
-- 1. Table interventions_techniques
CREATE TABLE IF NOT EXISTS public.interventions_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id UUID REFERENCES public.plantations(id) ON DELETE CASCADE,
  technicien_id UUID REFERENCES public.profiles(id),
  type_intervention TEXT NOT NULL DEFAULT 'suivi_mensuel',
  date_intervention TIMESTAMP WITH TIME ZONE DEFAULT now(),
  observations TEXT,
  recommandations TEXT,
  photos_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Table tickets_techniques
CREATE TABLE IF NOT EXISTS public.tickets_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id UUID REFERENCES public.plantations(id) ON DELETE CASCADE,
  cree_par UUID REFERENCES public.profiles(id),
  assigne_a UUID REFERENCES public.profiles(id),
  priorite TEXT DEFAULT 'moyenne',
  statut TEXT DEFAULT 'ouvert',
  description TEXT,
  resolution TEXT,
  date_resolution TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Table photos_plantation
CREATE TABLE IF NOT EXISTS public.photos_plantation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id UUID REFERENCES public.plantations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type_photo TEXT DEFAULT 'generale',
  phase TEXT DEFAULT 'croissance',
  description TEXT,
  date_prise TIMESTAMP WITH TIME ZONE DEFAULT now(),
  prise_par UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.interventions_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos_plantation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interventions_techniques
CREATE POLICY "staff_read_interventions" ON public.interventions_techniques
  FOR SELECT USING (is_admin_or_staff());

CREATE POLICY "staff_write_interventions" ON public.interventions_techniques
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- RLS Policies for tickets_techniques
CREATE POLICY "staff_read_tickets_tech" ON public.tickets_techniques
  FOR SELECT USING (is_admin_or_staff());

CREATE POLICY "staff_write_tickets_tech" ON public.tickets_techniques
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- RLS Policies for photos_plantation
CREATE POLICY "staff_read_photos" ON public.photos_plantation
  FOR SELECT USING (is_admin_or_staff());

CREATE POLICY "staff_write_photos" ON public.photos_plantation
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- 4. Ajouter les sous-préfectures manquantes du Haut-Sassandra
INSERT INTO public.sous_prefectures (nom, departement_id, code, est_active)
SELECT 'Gonaté', d.id, 'GONATE', true
FROM public.departements d WHERE d.nom = 'Daloa'
ON CONFLICT DO NOTHING;

INSERT INTO public.sous_prefectures (nom, departement_id, code, est_active)
SELECT 'Gadouan', d.id, 'GADOUAN', true
FROM public.departements d WHERE d.nom = 'Daloa'
ON CONFLICT DO NOTHING;

-- 5. Mise à jour colonnes commissions pour correspondre aux requêtes
ALTER TABLE public.commissions 
ADD COLUMN IF NOT EXISTS montant_base NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS taux_commission NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS montant_commission NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS periode TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS date_calcul TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS date_validation TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS valide_par UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS plantation_id UUID REFERENCES public.plantations(id);

-- Renommer colonnes existantes si nécessaire
UPDATE public.commissions SET montant_commission = montant WHERE montant_commission = 0 OR montant_commission IS NULL;
UPDATE public.commissions SET taux_commission = taux WHERE taux_commission IS NULL AND taux IS NOT NULL;

-- 6. Création de la table pour les remboursements
CREATE TABLE IF NOT EXISTS public.remboursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id UUID REFERENCES public.paiements(id),
  souscripteur_id UUID REFERENCES public.souscripteurs(id),
  montant NUMERIC NOT NULL,
  motif TEXT,
  statut TEXT DEFAULT 'en_attente',
  traite_par UUID REFERENCES public.profiles(id),
  date_traitement TIMESTAMP WITH TIME ZONE,
  mode_remboursement TEXT DEFAULT 'Mobile Money',
  numero_compte TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.remboursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_remboursements" ON public.remboursements
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- 7. Création de la table pour les transferts de paiements
CREATE TABLE IF NOT EXISTS public.transferts_paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_source_id UUID REFERENCES public.paiements(id),
  souscripteur_source_id UUID REFERENCES public.souscripteurs(id),
  souscripteur_dest_id UUID REFERENCES public.souscripteurs(id),
  montant NUMERIC NOT NULL,
  motif TEXT,
  effectue_par UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.transferts_paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_transferts" ON public.transferts_paiements
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- 8. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_interventions_plantation ON public.interventions_techniques(plantation_id);
CREATE INDEX IF NOT EXISTS idx_interventions_technicien ON public.interventions_techniques(technicien_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tech_plantation ON public.tickets_techniques(plantation_id);
CREATE INDEX IF NOT EXISTS idx_photos_plantation ON public.photos_plantation(plantation_id);
CREATE INDEX IF NOT EXISTS idx_remboursements_paiement ON public.remboursements(paiement_id);
CREATE INDEX IF NOT EXISTS idx_transferts_source ON public.transferts_paiements(souscripteur_source_id);
CREATE INDEX IF NOT EXISTS idx_transferts_dest ON public.transferts_paiements(souscripteur_dest_id);
CREATE INDEX IF NOT EXISTS idx_commissions_profile ON public.commissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_commissions_plantation ON public.commissions(plantation_id);