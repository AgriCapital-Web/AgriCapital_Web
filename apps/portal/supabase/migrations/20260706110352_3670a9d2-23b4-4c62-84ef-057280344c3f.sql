CREATE OR REPLACE VIEW public.v_prix_effectif_offres AS
SELECT
  o.id AS offre_id,
  o.code,
  o.nom,
  COALESCE(o.montant_da_par_ha, o.montant_depot_initial_par_ha, 0::numeric) AS di_base,
  o.montant_total_par_ha AS total_base,
  GREATEST(
    0::numeric,
    COALESCE(o.montant_da_par_ha, o.montant_depot_initial_par_ha, 0::numeric)
      - COALESCE((
          SELECT sum(
            COALESCE(p.montant_fixe_reduction, 0::numeric)
            + COALESCE(o.montant_da_par_ha, o.montant_depot_initial_par_ha, 0::numeric)
              * COALESCE(p.pourcentage_reduction, 0::numeric) / 100.0
          )
          FROM public.promotions p
          WHERE p.active = true
            AND p.cible = 'depot_initial'::text
            AND (p.date_debut IS NULL OR p.date_debut <= now())
            AND (p.date_fin IS NULL OR p.date_fin >= now())
            AND (
              p.applique_toutes_offres = true
              OR p.offre_ids ? o.id::text
              OR p.offre_ids ? o.code
            )
        ), 0::numeric)
  ) AS di_effectif,
  GREATEST(
    0::numeric,
    o.montant_total_par_ha
      - COALESCE((
          SELECT sum(
            COALESCE(p.montant_fixe_reduction, 0::numeric)
            + o.montant_total_par_ha * COALESCE(p.pourcentage_reduction, 0::numeric) / 100.0
          )
          FROM public.promotions p
          WHERE p.active = true
            AND (p.cible = ANY (ARRAY['total_contrat'::text, 'special'::text]))
            AND (p.date_debut IS NULL OR p.date_debut <= now())
            AND (p.date_fin IS NULL OR p.date_fin >= now())
            AND (
              p.applique_toutes_offres = true
              OR p.offre_ids ? o.id::text
              OR p.offre_ids ? o.code
            )
        ), 0::numeric)
  ) AS total_effectif
FROM public.offres o
WHERE o.actif = true;

CREATE OR REPLACE FUNCTION public.create_depot_initial(_souscripteur_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid; v_s RECORD; v_o RECORD; v_p RECORD;
  v_montant numeric; v_paiement_id uuid;
BEGIN
  SELECT id INTO v_existing FROM public.paiements
    WHERE souscripteur_id = _souscripteur_id AND est_depot_initial = true LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT * INTO v_s FROM public.souscripteurs WHERE id = _souscripteur_id;
  IF v_s IS NULL THEN RAISE EXCEPTION 'Souscripteur introuvable'; END IF;

  SELECT * INTO v_o FROM public.offres WHERE id = v_s.offre_id;
  IF v_o IS NULL THEN RETURN NULL; END IF;

  SELECT di_effectif INTO v_montant FROM public.v_prix_effectif_offres WHERE offre_id = v_s.offre_id;
  v_montant := COALESCE(v_montant, COALESCE(v_o.montant_da_par_ha, v_o.montant_depot_initial_par_ha, 0))
               * COALESCE(v_s.total_hectares, 0);

  IF v_s.promotion_id IS NOT NULL THEN
    SELECT * INTO v_p FROM public.promotions WHERE id = v_s.promotion_id;
    IF v_p IS NOT NULL AND v_p.cible = 'depot_initial' THEN
      IF COALESCE(v_p.montant_fixe_reduction,0) > 0 THEN
        v_montant := GREATEST(0, v_montant - v_p.montant_fixe_reduction);
      ELSIF COALESCE(v_p.pourcentage_reduction,0) > 0 THEN
        v_montant := v_montant - (v_montant * v_p.pourcentage_reduction / 100.0);
      END IF;
    END IF;
  END IF;

  IF v_montant <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.paiements(
    souscripteur_id, type_paiement, est_depot_initial, statut, montant, montant_theorique,
    date_echeance, notes
  ) VALUES (
    _souscripteur_id, 'DA', true, 'en_attente', v_montant, v_montant,
    (current_date + interval '7 days')::date,
    'Dépôt initial généré automatiquement après validation des documents'
  ) RETURNING id INTO v_paiement_id;

  IF v_s.user_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, message, data)
    VALUES (v_s.user_id, 'paiement', 'Dépôt initial disponible',
      'Votre dépôt initial de ' || v_montant::text || ' FCFA est prêt.',
      jsonb_build_object('paiement_id', v_paiement_id, 'montant', v_montant));
  END IF;

  RETURN v_paiement_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_offre_pricing_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := 0;
  v_duree int := 0;
  v_tranche jsonb;
BEGIN
  IF NEW.tranches_paiement IS NULL OR jsonb_typeof(NEW.tranches_paiement) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR v_tranche IN SELECT * FROM jsonb_array_elements(NEW.tranches_paiement) LOOP
    v_total := v_total + COALESCE((v_tranche->>'mensualite_par_ha')::numeric, 0)
                       * COALESCE((v_tranche->>'mois')::int, 0);
    v_duree := v_duree + COALESCE((v_tranche->>'mois')::int, 0);
  END LOOP;

  v_total := v_total + COALESCE(NEW.montant_da_par_ha, NEW.montant_depot_initial_par_ha, 0);

  IF NEW.montant_total_par_ha IS NOT NULL AND abs(NEW.montant_total_par_ha - v_total) > 1 THEN
    RAISE EXCEPTION 'Offre %: montant_total_par_ha (%) ≠ somme tranches + dépôt (%)',
      NEW.code, NEW.montant_total_par_ha, v_total;
  END IF;

  IF NEW.duree_paiement_mois IS NOT NULL AND NEW.duree_paiement_mois <> v_duree AND v_duree > 0 THEN
    RAISE EXCEPTION 'Offre %: duree_paiement_mois (%) ≠ somme tranches (% mois)',
      NEW.code, NEW.duree_paiement_mois, v_duree;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recompute_di_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.recompute_pending_di();
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS recompute_pending_di_after_offres_change ON public.offres;
CREATE TRIGGER recompute_pending_di_after_offres_change
AFTER INSERT OR UPDATE OF montant_da_par_ha, montant_depot_initial_par_ha, montant_total_par_ha, tranches_paiement, duree_paiement_mois, actif OR DELETE
ON public.offres
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_di_on_change();

DROP TRIGGER IF EXISTS recompute_pending_di_after_promotions_change ON public.promotions;
CREATE TRIGGER recompute_pending_di_after_promotions_change
AFTER INSERT OR UPDATE OF active, cible, pourcentage_reduction, montant_fixe_reduction, date_debut, date_fin, applique_toutes_offres, offre_ids OR DELETE
ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_di_on_change();

DROP TRIGGER IF EXISTS recompute_pending_di_after_souscripteurs_change ON public.souscripteurs;
CREATE TRIGGER recompute_pending_di_after_souscripteurs_change
BEFORE INSERT OR UPDATE OF offre_id, promotion_id, total_hectares, compte_actif
ON public.souscripteurs
FOR EACH ROW
EXECUTE FUNCTION public.trg_souscripteur_recompute();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plantations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plantations;
  END IF;
END $$;

SELECT public.recompute_pending_di();