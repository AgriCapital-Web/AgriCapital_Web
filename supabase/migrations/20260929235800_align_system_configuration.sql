-- Les durées contractuelles ne sont pas globales : elles sont portées par chaque offre.
-- PalmInvest/TerraPalm : 36 mois d'installation, 40 mois de paiement.
-- PalmTerroir : 36 mois d'installation et 36 mois de paiement.
-- Suppression de l'ancien paramètre global qui pouvait imposer à tort 36 mois à toutes les offres.
delete from public.configurations_systeme where cle='acquisition_duree_contrat_mois';
update public.configurations_systeme set valeur='CI-DAL-01-2025-B12-13435' where cle='societe_rccm';