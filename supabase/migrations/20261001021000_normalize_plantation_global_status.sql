-- Normalize the canonical global plantation status.
-- The application uses public.plantations.statut_global as the global lifecycle status.
-- Historical rows used both 'active' and 'actif', which caused pages filtering by
-- the canonical French value to hide otherwise active plantations.
UPDATE public.plantations
SET statut_global = 'actif'
WHERE statut_global = 'active';

COMMENT ON COLUMN public.plantations.statut_global IS
'Canonical global plantation status. Active plantations use actif; operational stage remains in statut.';
