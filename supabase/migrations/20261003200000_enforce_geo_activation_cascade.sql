-- Geographic activation is hierarchical and mandatory across the CRM.
CREATE OR REPLACE FUNCTION public.enforce_geo_effective_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_parent_active boolean;
BEGIN
  IF TG_TABLE_NAME='regions' THEN
    SELECT d.est_actif INTO v_parent_active FROM public.districts d WHERE d.id=NEW.district_id;
    IF coalesce(v_parent_active,false)=false THEN NEW.est_active:=false; END IF;
  ELSIF TG_TABLE_NAME='departements' THEN
    SELECT r.est_active INTO v_parent_active FROM public.regions r WHERE r.id=NEW.region_id;
    IF coalesce(v_parent_active,false)=false THEN NEW.est_actif:=false; END IF;
  ELSIF TG_TABLE_NAME='sous_prefectures' THEN
    SELECT d.est_actif INTO v_parent_active FROM public.departements d WHERE d.id=NEW.departement_id;
    IF coalesce(v_parent_active,false)=false THEN NEW.est_active:=false; END IF;
  ELSIF TG_TABLE_NAME='villages' THEN
    SELECT s.est_active INTO v_parent_active FROM public.sous_prefectures s WHERE s.id=NEW.sous_prefecture_id;
    IF coalesce(v_parent_active,false)=false THEN NEW.est_actif:=false; END IF;
  ELSIF TG_TABLE_NAME='campements' THEN
    IF NEW.village_noyau_id IS NOT NULL THEN
      SELECT v.est_actif INTO v_parent_active FROM public.villages v WHERE v.id=NEW.village_noyau_id;
    ELSE
      SELECT s.est_active INTO v_parent_active FROM public.sous_prefectures s WHERE s.id=NEW.sous_prefecture_id;
    END IF;
    IF coalesce(v_parent_active,false)=false THEN NEW.est_actif:=false; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_geo_effective_activation_regions ON public.regions;
CREATE TRIGGER trg_geo_effective_activation_regions
BEFORE INSERT OR UPDATE OF est_active,district_id ON public.regions
FOR EACH ROW EXECUTE FUNCTION public.enforce_geo_effective_activation();

DROP TRIGGER IF EXISTS trg_geo_effective_activation_departements ON public.departements;
CREATE TRIGGER trg_geo_effective_activation_departements
BEFORE INSERT OR UPDATE OF est_actif,region_id ON public.departements
FOR EACH ROW EXECUTE FUNCTION public.enforce_geo_effective_activation();

DROP TRIGGER IF EXISTS trg_geo_effective_activation_sous_prefectures ON public.sous_prefectures;
CREATE TRIGGER trg_geo_effective_activation_sous_prefectures
BEFORE INSERT OR UPDATE OF est_active,departement_id ON public.sous_prefectures
FOR EACH ROW EXECUTE FUNCTION public.enforce_geo_effective_activation();

DROP TRIGGER IF EXISTS trg_geo_effective_activation_villages ON public.villages;
CREATE TRIGGER trg_geo_effective_activation_villages
BEFORE INSERT OR UPDATE OF est_actif,sous_prefecture_id ON public.villages
FOR EACH ROW EXECUTE FUNCTION public.enforce_geo_effective_activation();

DROP TRIGGER IF EXISTS trg_geo_effective_activation_campements ON public.campements;
CREATE TRIGGER trg_geo_effective_activation_campements
BEFORE INSERT OR UPDATE OF est_actif,sous_prefecture_id,village_noyau_id ON public.campements
FOR EACH ROW EXECUTE FUNCTION public.enforce_geo_effective_activation();

-- Existing cascade_geo_status() remains the single deactivation cascade.
-- Only active parents may have active children; disabled parents propagate down automatically.
