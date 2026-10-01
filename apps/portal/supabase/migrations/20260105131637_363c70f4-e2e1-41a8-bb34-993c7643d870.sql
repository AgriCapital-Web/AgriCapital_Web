-- Index pour optimiser les requêtes fréquentes sur paiements
CREATE INDEX IF NOT EXISTS idx_paiements_souscripteur_id ON paiements(souscripteur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_plantation_id ON paiements(plantation_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON paiements(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_reference ON paiements(reference);
CREATE INDEX IF NOT EXISTS idx_paiements_created_at ON paiements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paiements_type_statut ON paiements(type_paiement, statut);

-- Index pour optimiser les requêtes sur souscripteurs
CREATE INDEX IF NOT EXISTS idx_souscripteurs_telephone ON souscripteurs(telephone);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_statut ON souscripteurs(statut);
CREATE INDEX IF NOT EXISTS idx_souscripteurs_offre_id ON souscripteurs(offre_id);

-- Index pour optimiser les requêtes sur plantations
CREATE INDEX IF NOT EXISTS idx_plantations_souscripteur_id ON plantations(souscripteur_id);
CREATE INDEX IF NOT EXISTS idx_plantations_statut ON plantations(statut);
CREATE INDEX IF NOT EXISTS idx_plantations_statut_global ON plantations(statut_global);
CREATE INDEX IF NOT EXISTS idx_plantations_id_unique ON plantations(id_unique);

-- Index composite pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_paiements_souscripteur_type ON paiements(souscripteur_id, type_paiement);
CREATE INDEX IF NOT EXISTS idx_plantations_souscripteur_statut ON plantations(souscripteur_id, statut_global);

-- Mise à jour de la politique RLS pour permettre les lectures anonymes pour le portail abonné
-- Permettre la lecture des souscripteurs par téléphone sans authentification
DROP POLICY IF EXISTS "anon_read_souscripteurs_by_phone" ON souscripteurs;
CREATE POLICY "anon_read_souscripteurs_by_phone" 
ON souscripteurs 
FOR SELECT 
USING (true);

-- Permettre la lecture des plantations liées au souscripteur
DROP POLICY IF EXISTS "anon_read_plantations" ON plantations;
CREATE POLICY "anon_read_plantations" 
ON plantations 
FOR SELECT 
USING (true);

-- Permettre la lecture des paiements liés
DROP POLICY IF EXISTS "anon_read_paiements" ON paiements;
CREATE POLICY "anon_read_paiements" 
ON paiements 
FOR SELECT 
USING (true);

-- Permettre lecture des régions, départements, etc. (déjà public normalement)
DROP POLICY IF EXISTS "anon_read_regions" ON regions;
CREATE POLICY "anon_read_regions" 
ON regions 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "anon_read_departements" ON departements;
CREATE POLICY "anon_read_departements" 
ON departements 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "anon_read_districts" ON districts;
CREATE POLICY "anon_read_districts" 
ON districts 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "anon_read_villages" ON villages;
CREATE POLICY "anon_read_villages" 
ON villages 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "anon_read_sous_prefectures" ON sous_prefectures;
CREATE POLICY "anon_read_sous_prefectures" 
ON sous_prefectures 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "anon_read_offres" ON offres;
CREATE POLICY "anon_read_offres" 
ON offres 
FOR SELECT 
USING (actif = true);