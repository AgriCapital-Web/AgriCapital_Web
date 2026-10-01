DROP INDEX IF EXISTS public.uq_paiement_depot_initial;

CREATE UNIQUE INDEX IF NOT EXISTS uq_paiement_depot_initial_par_plantation
ON public.paiements (souscripteur_id, plantation_id)
WHERE est_depot_initial = true AND plantation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_paiement_depot_initial_sans_plantation
ON public.paiements (souscripteur_id)
WHERE est_depot_initial = true AND plantation_id IS NULL;