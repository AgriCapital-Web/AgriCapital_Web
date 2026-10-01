CREATE OR REPLACE FUNCTION public.get_subscriber_effective_di(_souscripteur_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.souscripteurs%ROWTYPE;
  v_o public.offres%ROWTYPE;
  v_p public.promotions%ROWTYPE;
  v_di numeric;
  v_cible text;
  v_offer_match boolean;
BEGIN
  SELECT * INTO v_s FROM public.souscripteurs WHERE id = _souscripteur_id;
  IF NOT FOUND OR v_s.offre_id IS NULL THEN RAISE EXCEPTION 'Souscripteur ou offre introuvable'; END IF;
  SELECT * INTO v_o FROM public.offres WHERE id = v_s.offre_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable'; END IF;

  SELECT di_effectif INTO v_di FROM public.v_prix_effectif_offres WHERE offre_id = v_s.offre_id;
  v_di := COALESCE(v_di, v_o.montant_da_par_ha, v_o.montant_depot_initial_par_ha, 0);

  IF v_s.promotion_id IS NOT NULL THEN
    SELECT * INTO v_p FROM public.promotions WHERE id = v_s.promotion_id;
    IF FOUND AND COALESCE(v_p.active, false)
      AND now() BETWEEN v_p.date_debut AND v_p.date_fin THEN
      v_cible := lower(trim(COALESCE(v_p.cible, '')));
      v_offer_match := COALESCE(v_p.applique_toutes_offres, false)
        OR COALESCE(v_p.offre_ids, '[]'::jsonb) @> to_jsonb(ARRAY[v_s.offre_id::text]);
      IF v_offer_match AND v_cible IN ('depot_initial','dépôt_initial','da','di','total_contrat','toutes','all') THEN
        IF COALESCE(v_p.montant_fixe_reduction, 0) > 0 THEN
          v_di := GREATEST(0, v_di - v_p.montant_fixe_reduction);
        ELSIF COALESCE(v_p.pourcentage_reduction, 0) > 0 THEN
          v_di := GREATEST(0, v_di * (1 - v_p.pourcentage_reduction / 100));
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_di;
END;
$$;
REVOKE ALL ON FUNCTION public.get_subscriber_effective_di(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscriber_effective_di(uuid) TO service_role;