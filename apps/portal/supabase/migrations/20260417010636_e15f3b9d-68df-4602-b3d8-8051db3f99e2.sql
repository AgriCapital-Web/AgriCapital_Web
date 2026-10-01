-- Update Dépôt Initial for TerraPalm offers to 84700 F/ha as per the flyer
UPDATE public.offres SET montant_da_par_ha = 84700 WHERE code IN ('TERRAPALM', 'TERRAPALM_PLUS');

-- Ensure PalmInvest offers are at 90700 F/ha
UPDATE public.offres SET montant_da_par_ha = 90700 WHERE code IN ('PALMINVEST', 'PALMINVEST_PLUS');