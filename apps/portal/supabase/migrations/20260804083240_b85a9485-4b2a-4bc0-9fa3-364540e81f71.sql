CREATE OR REPLACE VIEW public.v_prix_effectif_offres
WITH (security_invoker=on) AS
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

CREATE OR REPLACE FUNCTION public.sync_paiement_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.preuve_paiement_url := COALESCE(NEW.preuve_paiement_url, NEW.fichier_preuve_url);
  NEW.fichier_preuve_url := COALESCE(NEW.fichier_preuve_url, NEW.preuve_paiement_url);
  NEW.reference := COALESCE(NEW.reference, NEW.id_transaction);
  NEW.notes := COALESCE(NEW.notes, NEW.observations);
  NEW.observations := COALESCE(NEW.observations, NEW.notes);
  NEW.montant := COALESCE(NEW.montant, NEW.montant_paye, NEW.montant_theorique, 0);
  NEW.montant_paye := COALESCE(NEW.montant_paye, NEW.montant, NEW.montant_theorique, 0);
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_pending_di()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_di numeric; v_total numeric; v_duree int; v_taux numeric;
  v_tranches jsonb; v_mens numeric; v_ha numeric; v_amount numeric;
BEGIN
  FOR r IN
    SELECT s.id AS sid, s.offre_id, s.total_hectares
      FROM public.souscripteurs s
     WHERE COALESCE(s.compte_actif,false) = false
       AND s.offre_id IS NOT NULL
  LOOP
    SELECT di_effectif, total_effectif INTO v_di, v_total
      FROM public.v_prix_effectif_offres WHERE offre_id = r.offre_id;
    SELECT duree_paiement_mois, tranches_paiement INTO v_duree, v_tranches
      FROM public.offres WHERE id = r.offre_id;

    v_ha := COALESCE(r.total_hectares, 0);
    IF v_di IS NULL OR v_ha <= 0 THEN CONTINUE; END IF;

    v_amount := v_di * v_ha;
    v_taux := CASE WHEN COALESCE(v_duree,0) > 0 THEN COALESCE(v_total,0) / (v_duree * 30) ELSE 0 END;
    v_mens := 0;
    IF v_tranches IS NOT NULL AND jsonb_typeof(v_tranches) = 'array' AND jsonb_array_length(v_tranches) > 0 THEN
      v_mens := COALESCE((v_tranches->0->>'mensualite_par_ha')::numeric, 0) * v_ha;
    END IF;

    UPDATE public.souscripteurs
       SET montant_total_contrat = COALESCE(v_total,0) * v_ha,
           jours_contrat_total = COALESCE(v_duree,34) * 30,
           taux_journalier_ha = v_taux,
           mensualite_montant = v_mens,
           updated_at = now()
     WHERE id = r.sid;

    IF v_amount <= 0 THEN
      UPDATE public.paiements
         SET statut = 'annule',
             montant_theorique = 0,
             cancelled_at = COALESCE(cancelled_at, now()),
             notes = concat_ws(' — ', NULLIF(notes, ''), 'Dépôt Initial annulé automatiquement : tarif CRM à 0 F'),
             updated_at = now()
       WHERE souscripteur_id = r.sid
         AND est_depot_initial = true
         AND statut = 'en_attente';
    ELSE
      UPDATE public.paiements
         SET montant = v_amount,
             montant_paye = v_amount,
             montant_theorique = v_amount,
             updated_at = now()
       WHERE souscripteur_id = r.sid
         AND est_depot_initial = true
         AND statut = 'en_attente';
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_souscripteur_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_di numeric; v_total numeric; v_duree int; v_taux numeric;
  v_tranches jsonb; v_mens numeric; v_ha numeric; v_amount numeric;
BEGIN
  IF COALESCE(NEW.compte_actif,false) = true OR NEW.offre_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.offre_id IS NOT DISTINCT FROM OLD.offre_id
     AND NEW.promotion_id IS NOT DISTINCT FROM OLD.promotion_id
     AND NEW.total_hectares IS NOT DISTINCT FROM OLD.total_hectares THEN
    RETURN NEW;
  END IF;

  SELECT di_effectif, total_effectif INTO v_di, v_total
    FROM public.v_prix_effectif_offres WHERE offre_id = NEW.offre_id;
  SELECT duree_paiement_mois, tranches_paiement INTO v_duree, v_tranches
    FROM public.offres WHERE id = NEW.offre_id;

  v_ha := COALESCE(NEW.total_hectares, 0);
  IF v_di IS NULL OR v_ha <= 0 THEN RETURN NEW; END IF;

  v_amount := v_di * v_ha;
  v_taux := CASE WHEN COALESCE(v_duree,0) > 0 THEN COALESCE(v_total,0) / (v_duree * 30) ELSE 0 END;
  v_mens := 0;
  IF v_tranches IS NOT NULL AND jsonb_typeof(v_tranches) = 'array' AND jsonb_array_length(v_tranches) > 0 THEN
    v_mens := COALESCE((v_tranches->0->>'mensualite_par_ha')::numeric, 0) * v_ha;
  END IF;

  NEW.montant_total_contrat := COALESCE(v_total,0) * v_ha;
  NEW.jours_contrat_total := COALESCE(v_duree,34) * 30;
  NEW.taux_journalier_ha := v_taux;
  NEW.mensualite_montant := v_mens;

  IF v_amount <= 0 THEN
    UPDATE public.paiements
       SET statut = 'annule',
           montant_theorique = 0,
           cancelled_at = COALESCE(cancelled_at, now()),
           notes = concat_ws(' — ', NULLIF(notes, ''), 'Dépôt Initial annulé automatiquement : tarif CRM à 0 F'),
           updated_at = now()
     WHERE souscripteur_id = NEW.id
       AND est_depot_initial = true
       AND statut = 'en_attente';
  ELSE
    UPDATE public.paiements
       SET montant = v_amount,
           montant_paye = v_amount,
           montant_theorique = v_amount,
           updated_at = now()
     WHERE souscripteur_id = NEW.id
       AND est_depot_initial = true
       AND statut = 'en_attente';
  END IF;

  RETURN NEW;
END;
$function$;

SELECT public.recompute_pending_di();