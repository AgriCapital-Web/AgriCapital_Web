-- Canonicalize the global lifecycle status of plantations.
-- 'active' and activated rows using 'en_attente_pi' previously mixed the global
-- status with an operational/payment stage. Activated/planted plantations are
-- globally active; the operational stage remains in the separate statut column.

UPDATE public.plantations
SET statut_global = 'actif'
WHERE statut_global = 'active';

UPDATE public.plantations
SET statut_global = 'actif'
WHERE date_activation IS NOT NULL
  AND COALESCE(surface_reellement_plantee, 0) > 0
  AND statut_global = 'en_attente_pi';

COMMENT ON COLUMN public.plantations.statut_global IS
'Canonical global plantation status. An activated/planted plantation uses actif; operational/payment stage remains in statut.';
