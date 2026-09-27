-- Canonical commercial vocabulary: PI = Paiement Initial, CG = Cout Global.
-- Legacy database columns such as est_depot_initial remain as compatibility fields.

ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_cible_check;

CREATE OR REPLACE FUNCTION public.validate_promotion_cible()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.cible IS NULL OR btrim(NEW.cible)='' THEN NEW.cible:='paiement_initial'; END IF;
  IF lower(NEW.cible) IN ('depot_initial','dépôt_initial','da','di') THEN NEW.cible:='paiement_initial'; END IF;
  IF lower(NEW.cible) IN ('total_contrat','cout_global','coût_global','cg','special') THEN NEW.cible:='cout_global'; END IF;
  IF NEW.cible NOT IN ('paiement_initial','cout_global') THEN RAISE EXCEPTION 'promotions.cible invalide: %',NEW.cible; END IF;
  NEW.type_promotion:=NEW.cible;
  RETURN NEW;
END $$;

UPDATE public.promotions SET
  cible=CASE
    WHEN lower(coalesce(cible,'')) IN ('depot_initial','dépôt_initial','da','di') THEN 'paiement_initial'
    WHEN lower(coalesce(cible,'')) IN ('total_contrat','cout_global','coût_global','cg','special') THEN 'cout_global'
    ELSE coalesce(cible,'paiement_initial')
  END,
  type_promotion=CASE
    WHEN lower(coalesce(type_promotion,'')) IN ('depot_initial','dépôt_initial','da','di') THEN 'paiement_initial'
    WHEN lower(coalesce(type_promotion,'')) IN ('total_contrat','cout_global','coût_global','cg','special') THEN 'cout_global'
    ELSE coalesce(type_promotion,'paiement_initial')
  END;

ALTER TABLE public.promotions ADD CONSTRAINT promotions_cible_check CHECK(cible IN ('paiement_initial','cout_global'));

CREATE OR REPLACE FUNCTION public.offre_prix_effectif()
RETURNS TABLE(offre_id uuid,code text,nom text,montant_total_base numeric,depot_initial_base numeric,mensualite_base numeric,montant_total_effectif numeric,depot_initial_effectif numeric,mensualite_effective numeric,promotion_id uuid,promotion_nom text,promotion_cible text,reduction_pct numeric,reduction_montant numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH promo AS (
 SELECT o.id oid,p.id pid,p.nom pnom,p.cible,COALESCE(p.pourcentage_reduction,0) pct,COALESCE(p.montant_fixe_reduction,0) fixe,
 row_number() over(partition by o.id order by COALESCE(p.pourcentage_reduction,0) desc,COALESCE(p.montant_fixe_reduction,0) desc,p.created_at desc) rn
 FROM public.offres o JOIN public.promotions p ON p.active=true
 AND (p.date_debut is null or p.date_debut<=now()) AND (p.date_fin is null or p.date_fin>=now())
 AND (p.applique_toutes_offres=true or p.offre_ids @> to_jsonb(o.id::text))
),best AS (select * from promo where rn=1)
SELECT o.id,o.code,o.nom,COALESCE(o.montant_total_par_ha,0),COALESCE(o.montant_depot_initial_par_ha,o.montant_da_par_ha,0),COALESCE(o.contribution_mensuelle_par_ha,0),
t.total_eff,least(t.pi_eff,t.total_eff),
case when COALESCE(o.duree_paiement_mois,0)>0 then round(greatest(t.total_eff-least(t.pi_eff,t.total_eff),0)/o.duree_paiement_mois) else COALESCE(o.contribution_mensuelle_par_ha,0) end,
b.pid,b.pnom,b.cible,COALESCE(b.pct,0),
greatest((COALESCE(o.montant_total_par_ha,0)-t.total_eff)+(COALESCE(o.montant_depot_initial_par_ha,o.montant_da_par_ha,0)-least(t.pi_eff,t.total_eff)),0)
FROM public.offres o LEFT JOIN best b ON b.oid=o.id
CROSS JOIN LATERAL (
 SELECT
  case when b.pid is null then COALESCE(o.montant_total_par_ha,0)
       when b.cible='cout_global' then greatest(COALESCE(o.montant_total_par_ha,0)*(1-b.pct/100.0)-b.fixe,0)
       else COALESCE(o.montant_total_par_ha,0) end total_eff,
  case when b.pid is null then COALESCE(o.montant_depot_initial_par_ha,o.montant_da_par_ha,0)
       when b.cible='paiement_initial' then greatest(COALESCE(o.montant_depot_initial_par_ha,o.montant_da_par_ha,0)*(1-b.pct/100.0)-b.fixe,0)
       else COALESCE(o.montant_depot_initial_par_ha,o.montant_da_par_ha,0) end pi_eff
) t WHERE o.actif=true;
$$;

CREATE OR REPLACE FUNCTION public.get_subscriber_effective_di(_souscripteur_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(p.depot_initial_effectif,0)
 FROM public.offre_prix_effectif() p JOIN public.souscripteurs s ON s.offre_id=p.offre_id
 WHERE s.id=_souscripteur_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.recompute_contrat_totaux(_souscripteur_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s RECORD;p RECORD;total numeric;pi numeric;days int;rate numeric;monthly numeric;
BEGIN
 SELECT * INTO s FROM public.souscripteurs WHERE id=_souscripteur_id;
 IF s IS NULL OR s.offre_id IS NULL THEN RETURN; END IF;
 SELECT * INTO p FROM public.offre_prix_effectif() WHERE offre_id=s.offre_id LIMIT 1;
 IF p IS NULL THEN RETURN; END IF;
 total=COALESCE(p.montant_total_effectif,0)*COALESCE(s.total_hectares,0);
 pi=least(COALESCE(p.depot_initial_effectif,0)*COALESCE(s.total_hectares,0),total);
 days=COALESCE((select duree_paiement_mois from public.offres where id=s.offre_id),34)*30;
 rate=case when days>0 and COALESCE(s.total_hectares,0)>0 then total/days/s.total_hectares else 0 end;
 monthly=case when days>0 then round(greatest(total-pi,0)/(days/30.0)) else COALESCE(p.mensualite_effective,0)*COALESCE(s.total_hectares,0) end;
 update public.souscripteurs set montant_total_contrat=total,montant_promo_applique=greatest(COALESCE(p.montant_total_base,0)*COALESCE(s.total_hectares,0)-total,0),mensualite_montant=monthly,jours_contrat_total=days,taux_journalier_ha=rate,updated_at=now() where id=_souscripteur_id;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_pending_di()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD;p RECORD;pi numeric;total numeric;monthly numeric;ha numeric;months int;
BEGIN
 FOR r IN SELECT s.id sid,s.offre_id,s.total_hectares FROM public.souscripteurs s WHERE COALESCE(s.compte_actif,false)=false AND s.offre_id is not null LOOP
  SELECT * INTO p FROM public.offre_prix_effectif() WHERE offre_id=r.offre_id LIMIT 1;
  IF p IS NULL THEN CONTINUE; END IF;
  ha=COALESCE(r.total_hectares,0);pi=COALESCE(p.depot_initial_effectif,0)*ha;total=COALESCE(p.montant_total_effectif,0)*ha;monthly=COALESCE(p.mensualite_effective,0)*ha;
  months=COALESCE((select duree_paiement_mois from public.offres where id=r.offre_id),34);
  update public.souscripteurs set montant_total_contrat=total,mensualite_montant=monthly,jours_contrat_total=months*30,taux_journalier_ha=case when months>0 then total/(months*30*greatest(ha,1)) else 0 end,updated_at=now() where id=r.sid;
  update public.paiements set montant=pi,montant_paye=pi,montant_theorique=pi,updated_at=now() where souscripteur_id=r.sid and est_depot_initial=true and statut='en_attente';
  if pi<=0 then update public.paiements set statut='annule',montant=0,montant_paye=0,montant_theorique=0,cancelled_at=COALESCE(cancelled_at,now()),notes=concat_ws(' — ',nullif(notes,''),'Paiement Initial annule automatiquement : montant a 0 F'),updated_at=now() where souscripteur_id=r.sid and est_depot_initial=true and statut='en_attente'; end if;
 END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_validate_promotion_cible ON public.promotions;
CREATE TRIGGER trg_validate_promotion_cible BEFORE INSERT OR UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.validate_promotion_cible();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('account-request-photos','account-request-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS "Staff read account request photos" ON storage.objects;
CREATE POLICY "Staff read account request photos" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='account-request-photos' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff delete account request photos" ON storage.objects;
CREATE POLICY "Staff delete account request photos" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='account-request-photos' AND public.is_staff(auth.uid()));

ALTER TABLE public.account_requests DROP CONSTRAINT IF EXISTS account_requests_photo_path_check;
ALTER TABLE public.account_requests ADD CONSTRAINT account_requests_photo_path_check CHECK(photo_url is null or photo_url like 'pending/%' or photo_url like 'profiles/%');

DO $$
BEGIN
 IF NOT EXISTS(select 1 from pg_trigger where tgrelid='public.account_requests'::regclass and tgname='trg_audit_account_requests' and not tgisinternal) THEN
  CREATE TRIGGER trg_audit_account_requests AFTER INSERT OR UPDATE OR DELETE ON public.account_requests FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
 END IF;
END $$;
