-- 2026-10-01 — cohérence foncière : une parcelle CRM appartient au référentiel foncier.
-- Une personne qui exploite sa propre terre reste liée à son dossier Client ;
-- elle ne crée pas une parcelle dans le registre des Propriétaires.

ALTER TABLE public.interventions_techniques DROP CONSTRAINT IF EXISTS interventions_techniques_parcelle_id_fkey;
ALTER TABLE public.interventions_techniques DISABLE TRIGGER trg_create_plantation_after_mise_en_terre;
ALTER TABLE public.interventions_techniques DISABLE TRIGGER trg_validate_formula_technical_intervention;

UPDATE public.plantations p
SET parcelle_id = NULL, updated_at = now()
FROM public.clients c, public.parcelles pa
WHERE p.client_id = c.id AND pa.id = p.parcelle_id
  AND c.type_client_foncier = 'OWN' AND c.proprietaire_id IS NULL AND pa.proprietaire_id IS NULL;

UPDATE public.interventions_techniques i
SET parcelle_id = NULL, updated_at = now()
WHERE i.parcelle_id IN (
  SELECT pa.id FROM public.parcelles pa
  WHERE pa.proprietaire_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.parcelle_id = pa.id AND c.type_client_foncier = 'OWN' AND c.proprietaire_id IS NULL
    )
);

ALTER TABLE public.interventions_techniques ENABLE TRIGGER trg_validate_formula_technical_intervention;
ALTER TABLE public.interventions_techniques ENABLE TRIGGER trg_create_plantation_after_mise_en_terre;

UPDATE public.beneficiaire_documents d
SET parcelle_id = NULL
WHERE d.parcelle_id IN (
  SELECT pa.id FROM public.parcelles pa
  WHERE pa.proprietaire_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.parcelle_id = pa.id AND c.type_client_foncier = 'OWN' AND c.proprietaire_id IS NULL
    )
);

DELETE FROM public.beneficiaire_attributions a
USING public.clients c
WHERE a.client_id = c.id AND c.type_client_foncier = 'OWN' AND c.proprietaire_id IS NULL;

DELETE FROM public.parcelles pa
WHERE pa.proprietaire_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.parcelle_id = pa.id AND c.type_client_foncier = 'OWN' AND c.proprietaire_id IS NULL
  );

UPDATE public.clients c
SET parcelle_id = NULL,
    type_client = CASE WHEN c.type_client = 'beneficiaire_particulier' THEN 'avec_terre' ELSE c.type_client END,
    updated_at = now()
WHERE c.type_client_foncier = 'OWN' AND c.proprietaire_id IS NULL;

UPDATE public.proprietaires_terres p
SET nombre_parcelles = (SELECT count(*) FROM public.parcelles pa WHERE pa.proprietaire_id = p.id),
    surface_totale_ha = COALESCE((SELECT sum(pa.surface_totale_ha) FROM public.parcelles pa WHERE pa.proprietaire_id = p.id), p.surface_totale_ha),
    updated_at = now()
WHERE EXISTS (SELECT 1 FROM public.parcelles pa WHERE pa.proprietaire_id = p.id)
   OR COALESCE(p.nombre_parcelles,0) <> 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='interventions_techniques_parcelle_id_fkey'
  ) THEN
    ALTER TABLE public.interventions_techniques
      ADD CONSTRAINT interventions_techniques_parcelle_id_fkey
      FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_parcelles_proprietaire_id ON public.parcelles(proprietaire_id);
