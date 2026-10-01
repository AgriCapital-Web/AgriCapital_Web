-- 2026-10-01 — cohérence foncière : une parcelle CRM appartient au référentiel foncier.
-- Une personne qui exploite sa propre terre reste liée à son dossier Client ;
-- elle ne crée pas une parcelle dans le registre des Propriétaires.

UPDATE public.plantations p
SET parcelle_id = NULL,
    updated_at = now()
FROM public.clients c
JOIN public.parcelles pa ON pa.id = p.parcelle_id
WHERE p.client_id = c.id
  AND c.type_client_foncier = 'OWN'
  AND c.proprietaire_id IS NULL
  AND pa.proprietaire_id IS NULL;

DELETE FROM public.beneficiaire_attributions a
USING public.clients c
WHERE a.client_id = c.id
  AND c.type_client_foncier = 'OWN'
  AND c.proprietaire_id IS NULL;

DELETE FROM public.parcelles pa
WHERE pa.proprietaire_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.parcelle_id = pa.id
      AND c.type_client_foncier = 'OWN'
      AND c.proprietaire_id IS NULL
  );

UPDATE public.clients c
SET parcelle_id = NULL,
    type_client = CASE WHEN c.type_client = 'beneficiaire_particulier' THEN 'avec_terre' ELSE c.type_client END,
    updated_at = now()
WHERE c.type_client_foncier = 'OWN'
  AND c.proprietaire_id IS NULL;

UPDATE public.proprietaires_terres p
SET nombre_parcelles = (
      SELECT count(*) FROM public.parcelles pa WHERE pa.proprietaire_id = p.id
    ),
    surface_totale_ha = COALESCE((
      SELECT sum(pa.surface_totale_ha) FROM public.parcelles pa WHERE pa.proprietaire_id = p.id
    ), p.surface_totale_ha),
    updated_at = now()
WHERE EXISTS (SELECT 1 FROM public.parcelles pa WHERE pa.proprietaire_id = p.id)
   OR COALESCE(p.nombre_parcelles,0) <> 0;

CREATE INDEX IF NOT EXISTS idx_parcelles_proprietaire_id ON public.parcelles(proprietaire_id);
