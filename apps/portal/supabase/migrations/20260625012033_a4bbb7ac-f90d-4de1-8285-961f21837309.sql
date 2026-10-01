-- Synchronise toutes les offres existantes avec le nouveau barème progressif
-- An3 = 11 mois (au lieu de 10), durée totale = 35 mois, totaux et cash recalés.

UPDATE public.offres SET
  montant_depot_initial_par_ha = 90700,
  montant_da_par_ha = 90700,
  contribution_mensuelle_par_ha = 60000,
  montant_total_par_ha = 4384700,
  montant_cash_par_ha = 4070812,
  duree_paiement_mois = 35,
  tranches_paiement = '[
    {"annee":1,"mois":12,"mensualite_par_ha":60000},
    {"annee":2,"mois":12,"mensualite_par_ha":120000},
    {"annee":3,"mois":11,"mensualite_par_ha":194000}
  ]'::jsonb,
  updated_at = now()
WHERE upper(replace(replace(code,'-',''),'_','')) IN ('PALMINVEST','PALMINVESTPLUS');

UPDATE public.offres SET
  montant_depot_initial_par_ha = 84700,
  montant_da_par_ha = 84700,
  contribution_mensuelle_par_ha = 54000,
  montant_total_par_ha = 2690900,
  montant_cash_par_ha = 2379777,
  duree_paiement_mois = 35,
  tranches_paiement = '[
    {"annee":1,"mois":12,"mensualite_par_ha":54000},
    {"annee":2,"mois":12,"mensualite_par_ha":75000},
    {"annee":3,"mois":11,"mensualite_par_ha":96200}
  ]'::jsonb,
  updated_at = now()
WHERE upper(replace(replace(code,'-',''),'_','')) IN ('TERRAPALM','TERRAPALMPLUS');

-- Garde-fou DB : un trigger qui rejette toute mise à jour d'offre où la somme
-- tranches_paiement × mois + dépôt initial diverge de montant_total_par_ha.
CREATE OR REPLACE FUNCTION public.validate_offre_pricing_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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

  v_total := v_total + COALESCE(NEW.montant_depot_initial_par_ha, NEW.montant_da_par_ha, 0);

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
$$;

DROP TRIGGER IF EXISTS trg_validate_offre_pricing ON public.offres;
CREATE TRIGGER trg_validate_offre_pricing
  BEFORE INSERT OR UPDATE OF tranches_paiement, montant_total_par_ha, duree_paiement_mois,
                             montant_depot_initial_par_ha, montant_da_par_ha
  ON public.offres
  FOR EACH ROW EXECUTE FUNCTION public.validate_offre_pricing_consistency();
