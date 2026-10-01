-- Insertion des départements manquants pour les régions sans départements
-- Bafing (District du Woroba)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Touba', id, true FROM regions WHERE nom = 'Bafing'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Koro', id, true FROM regions WHERE nom = 'Bafing'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Ouaninou', id, true FROM regions WHERE nom = 'Bafing'
ON CONFLICT DO NOTHING;

-- Bagoué (District des Savanes)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Boundiali', id, true FROM regions WHERE nom = 'Bagoué'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Kouto', id, true FROM regions WHERE nom = 'Bagoué'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Tengréla', id, true FROM regions WHERE nom = 'Bagoué'
ON CONFLICT DO NOTHING;

-- Bélier (District des Lacs)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Dimbokro', id, true FROM regions WHERE nom = 'Bélier'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Toumodi', id, true FROM regions WHERE nom = 'Bélier'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Tiébissou', id, true FROM regions WHERE nom = 'Bélier'
ON CONFLICT DO NOTHING;

-- Béré (District du Woroba)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Mankono', id, true FROM regions WHERE nom = 'Béré'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Dianra', id, true FROM regions WHERE nom = 'Béré'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Kounahiri', id, true FROM regions WHERE nom = 'Béré'
ON CONFLICT DO NOTHING;

-- Bounkani (District du Zanzan)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Bouna', id, true FROM regions WHERE nom = 'Bounkani'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Doropo', id, true FROM regions WHERE nom = 'Bounkani'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Nassian', id, true FROM regions WHERE nom = 'Bounkani'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Téhini', id, true FROM regions WHERE nom = 'Bounkani'
ON CONFLICT DO NOTHING;

-- Folon (District du Denguélé)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Minignan', id, true FROM regions WHERE nom = 'Folon'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Kaniasso', id, true FROM regions WHERE nom = 'Folon'
ON CONFLICT DO NOTHING;

-- Gbêkê (District de la Vallée du Bandama)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Bouaké', id, true FROM regions WHERE nom = 'Gbêkê'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Sakassou', id, true FROM regions WHERE nom = 'Gbêkê'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Béoumi', id, true FROM regions WHERE nom = 'Gbêkê'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Botro', id, true FROM regions WHERE nom = 'Gbêkê'
ON CONFLICT DO NOTHING;

-- Gontougo (District du Zanzan)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Bondoukou', id, true FROM regions WHERE nom = 'Gontougo'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Tanda', id, true FROM regions WHERE nom = 'Gontougo'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Koun-Fao', id, true FROM regions WHERE nom = 'Gontougo'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Transua', id, true FROM regions WHERE nom = 'Gontougo'
ON CONFLICT DO NOTHING;

-- Hambol (District de la Vallée du Bandama)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Katiola', id, true FROM regions WHERE nom = 'Hambol'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Dabakala', id, true FROM regions WHERE nom = 'Hambol'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Niakaramandougou', id, true FROM regions WHERE nom = 'Hambol'
ON CONFLICT DO NOTHING;

-- Iffou (District des Lacs)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Daoukro', id, true FROM regions WHERE nom = 'Iffou'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'M''Bahiakro', id, true FROM regions WHERE nom = 'Iffou'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Prikro', id, true FROM regions WHERE nom = 'Iffou'
ON CONFLICT DO NOTHING;

-- Kabadougou (District du Denguélé)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Odienné', id, true FROM regions WHERE nom = 'Kabadougou'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Madinani', id, true FROM regions WHERE nom = 'Kabadougou'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Gbéléban', id, true FROM regions WHERE nom = 'Kabadougou'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Séguélon', id, true FROM regions WHERE nom = 'Kabadougou'
ON CONFLICT DO NOTHING;

-- Moronou (District des Lacs)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Bongouanou', id, true FROM regions WHERE nom = 'Moronou'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'M''Batto', id, true FROM regions WHERE nom = 'Moronou'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Arrah', id, true FROM regions WHERE nom = 'Moronou'
ON CONFLICT DO NOTHING;

-- N'Zi (District des Lacs)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Dimbokro', id, true FROM regions WHERE nom = 'N''Zi'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Bocanda', id, true FROM regions WHERE nom = 'N''Zi'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Kouassi-Kouassikro', id, true FROM regions WHERE nom = 'N''Zi'
ON CONFLICT DO NOTHING;

-- Poro (District des Savanes)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Korhogo', id, true FROM regions WHERE nom = 'Poro'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Sinématiali', id, true FROM regions WHERE nom = 'Poro'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Dikodougou', id, true FROM regions WHERE nom = 'Poro'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'M''Bengué', id, true FROM regions WHERE nom = 'Poro'
ON CONFLICT DO NOTHING;

-- Tchologo (District des Savanes)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Ferkessédougou', id, true FROM regions WHERE nom = 'Tchologo'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Kong', id, true FROM regions WHERE nom = 'Tchologo'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Ouangolodougou', id, true FROM regions WHERE nom = 'Tchologo'
ON CONFLICT DO NOTHING;

-- Tonkpi (District des Montagnes)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Man', id, true FROM regions WHERE nom = 'Tonkpi'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Biankouma', id, true FROM regions WHERE nom = 'Tonkpi'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Danané', id, true FROM regions WHERE nom = 'Tonkpi'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Zouan-Hounien', id, true FROM regions WHERE nom = 'Tonkpi'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Sipilou', id, true FROM regions WHERE nom = 'Tonkpi'
ON CONFLICT DO NOTHING;

-- Worodougou (District du Woroba)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Séguéla', id, true FROM regions WHERE nom = 'Worodougou'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Kani', id, true FROM regions WHERE nom = 'Worodougou'
ON CONFLICT DO NOTHING;

-- Yamoussoukro (District Autonome)
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Yamoussoukro', id, true FROM regions WHERE nom = 'Yamoussoukro'
ON CONFLICT DO NOTHING;
INSERT INTO departements (nom, region_id, est_actif) 
SELECT 'Attiégouakro', id, true FROM regions WHERE nom = 'Yamoussoukro'
ON CONFLICT DO NOTHING;