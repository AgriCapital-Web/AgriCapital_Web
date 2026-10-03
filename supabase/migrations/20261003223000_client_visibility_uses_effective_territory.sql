-- Client visibility always uses the effective territorial source.
-- If a client has not yet denormalized geography, resolve it from its parcel.
CREATE OR REPLACE FUNCTION private.can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE c record; p record; g record;
BEGIN
 IF _user_id IS NULL OR _client_id IS NULL THEN RETURN false; END IF;
 IF private.is_global_admin(_user_id)
    OR private.has_role(_user_id,'responsable_operations')
    OR private.has_role(_user_id,'service_client')
    OR private.has_role(_user_id,'chef_equipe_service_client')
    OR private.has_role(_user_id,'comptable') THEN RETURN true; END IF;

 SELECT * INTO c FROM public.clients WHERE id=_client_id;
 IF NOT FOUND THEN RETURN false; END IF;
 IF c.commercial_id=_user_id OR c.user_id=_user_id OR c.created_by=_user_id THEN RETURN true; END IF;

 SELECT * INTO p FROM public.profiles WHERE user_id=_user_id LIMIT 1;
 IF NOT FOUND THEN RETURN false; END IF;

 SELECT
   COALESCE(c.district_id, pa.district_id) AS district_id,
   COALESCE(c.region_id, pa.region_id) AS region_id,
   COALESCE(c.departement_id, pa.departement_id) AS departement_id,
   COALESCE(c.sous_prefecture_id, pa.sous_prefecture_id) AS sous_prefecture_id
 INTO g
 FROM (SELECT 1) x
 LEFT JOIN public.parcelles pa ON pa.id=c.parcelle_id;

 IF g.district_id IS NOT NULL AND p.district_id=g.district_id THEN RETURN true; END IF;
 IF g.region_id IS NOT NULL AND p.region_id=g.region_id THEN RETURN true; END IF;

 IF EXISTS (
   SELECT 1 FROM public.zone_assignments z
   WHERE z.user_id=_user_id
     AND ((z.zone_type='district' AND z.zone_id=g.district_id)
       OR (z.zone_type='region' AND z.zone_id=g.region_id)
       OR (z.zone_type='departement' AND z.zone_id=g.departement_id)
       OR (z.zone_type='sous_prefecture' AND z.zone_id=g.sous_prefecture_id))
 ) THEN RETURN true; END IF;

 IF p.equipe_id IS NOT NULL
    AND (private.has_role(_user_id,'chef_equipe_commercial')
      OR private.has_role(_user_id,'chef_equipe_technique')
      OR private.has_role(_user_id,'responsable_commercial')) THEN
   IF EXISTS (
     SELECT 1 FROM public.profiles member
     WHERE member.equipe_id=p.equipe_id
       AND (member.user_id=c.commercial_id
         OR member.user_id=c.created_by
         OR (g.region_id IS NOT NULL AND member.region_id=g.region_id)
         OR (g.district_id IS NOT NULL AND member.district_id=g.district_id)
         OR EXISTS (
           SELECT 1 FROM public.zone_assignments z
           WHERE z.user_id=member.user_id
             AND ((z.zone_type='district' AND z.zone_id=g.district_id)
               OR (z.zone_type='region' AND z.zone_id=g.region_id)
               OR (z.zone_type='departement' AND z.zone_id=g.departement_id)
               OR (z.zone_type='sous_prefecture' AND z.zone_id=g.sous_prefecture_id))
         ))
   ) THEN RETURN true; END IF;
 END IF;
 RETURN false;
END;
$function$;