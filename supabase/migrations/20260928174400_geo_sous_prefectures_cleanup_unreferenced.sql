-- Nettoyage sécurisé du référentiel des sous-préfectures
-- Conserve toute ligne inactive encore référencée par les données métier.
-- Supprime uniquement les anciennes lignes administratives inactives sans aucune référence.
-- Le référentiel canonique actif reste celui validé RGPH 2021/ANStat.

BEGIN;

DELETE FROM public.sous_prefectures sp
WHERE sp.est_active = false
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.sous_prefecture_id = sp.id)
  AND NOT EXISTS (SELECT 1 FROM public.parcelles p WHERE p.sous_prefecture_id = sp.id)
  AND NOT EXISTS (SELECT 1 FROM public.plantations p WHERE p.sous_prefecture_id = sp.id)
  AND NOT EXISTS (SELECT 1 FROM public.proprietaires_terres pt WHERE pt.sous_prefecture_id = sp.id)
  AND NOT EXISTS (SELECT 1 FROM public.conventions_foncieres cf WHERE cf.sous_prefecture_id = sp.id)
  AND NOT EXISTS (SELECT 1 FROM public.domaines d WHERE d.sous_prefecture_id = sp.id)
  AND NOT EXISTS (SELECT 1 FROM public.villages v WHERE v.sous_prefecture_id = sp.id)
  AND NOT EXISTS (SELECT 1 FROM public.campements c WHERE c.sous_prefecture_id = sp.id)
  AND NOT EXISTS (SELECT 1 FROM public.client_cotitulaires_mandataires ccm WHERE ccm.sous_prefecture_id = sp.id);

COMMIT;
