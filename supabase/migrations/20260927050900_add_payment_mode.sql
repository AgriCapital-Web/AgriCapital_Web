ALTER TABLE public.souscripteurs ADD COLUMN IF NOT EXISTS mode_paiement text NOT NULL DEFAULT 'echeancier';
DO $$ BEGIN
  ALTER TABLE public.souscripteurs ADD CONSTRAINT souscripteurs_mode_paiement_check CHECK (mode_paiement IN ('echeancier','comptant'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_contrat_totaux(_souscripteur_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s RECORD;p RECORD;total numeric;pi numeric;days int;rate numeric;monthly numeric;
BEGIN
 SELECT * INTO s FROM public.souscripteurs WHERE id=_souscripteur_id; IF s IS NULL OR s.offre_id IS NULL THEN RETURN; END IF;
 SELECT * INTO p FROM public.offre_prix_effectif() WHERE offre_id=s.offre_id LIMIT 1; IF p IS NULL THEN RETURN; END IF;
 IF COALESCE(s.mode_paiement,'echeancier')='comptant' THEN
   total:=COALESCE((SELECT montant_cash_par_ha FROM public.offres WHERE id=s.offre_id),p.montant_total_effectif)*COALESCE(s.total_hectares,0);
   pi:=total; days:=0; rate:=0; monthly:=0;
 ELSE
   total:=COALESCE(p.montant_total_effectif,0)*COALESCE(s.total_hectares,0);
   pi:=LEAST(COALESCE(p.depot_initial_effectif,0)*COALESCE(s.total_hectares,0),total);
   days:=COALESCE((SELECT duree_paiement_mois FROM public.offres WHERE id=s.offre_id),40)*30;
   rate:=CASE WHEN days>0 AND COALESCE(s.total_hectares,0)>0 THEN total/days/s.total_hectares ELSE 0 END;
   SELECT COALESCE((t->>'mensualite_par_ha')::numeric,0)*COALESCE(s.total_hectares,0)
   INTO monthly FROM public.offres o,LATERAL jsonb_array_elements(COALESCE(o.tranches_paiement,'[]'::jsonb)) t
   WHERE o.id=s.offre_id AND COALESCE(t->>'type','')<>'paiement_initial'
     AND COALESCE((t->>'mensualite_par_ha')::numeric,0)>0
   ORDER BY COALESCE((t->>'mois_debut')::int,999999) LIMIT 1;
 END IF;
 UPDATE public.souscripteurs SET montant_total_contrat=total,montant_promo_applique=GREATEST(COALESCE(p.montant_total_base,0)*COALESCE(s.total_hectares,0)-total,0),mensualite_montant=COALESCE(monthly,0),jours_contrat_total=days,taux_journalier_ha=rate,paiement_initial_montant=pi,updated_at=now() WHERE id=_souscripteur_id;
END $$;