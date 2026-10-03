-- Single source of truth for user identity, role and territorial coverage.
-- A role-bearing profile must always be linked to an Auth user.
-- Coverage is derived from the user's current official role and zone_assignments.

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=_user_id
      AND role IN ('super_admin','pdg','dg','responsable_operations')
  );
$$;

CREATE OR REPLACE FUNCTION public.zone_assignment_expected_type(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='responsable_commercial') THEN 'region'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('chef_equipe_commercial','chef_equipe_technique')) THEN 'departement'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('commercial','technicien')) THEN 'sous_prefecture'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_profile_coverage(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
DECLARE
  expected text;
  a record;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  expected := public.zone_assignment_expected_type(_user_id);

  -- Profiles store the effective primary coverage for display/filtering.
  -- zone_assignments remains the complete source of truth when several zones exist.
  UPDATE public.profiles
  SET district_id=NULL, region_id=NULL
  WHERE user_id=_user_id;

  IF expected IS NULL THEN RETURN; END IF;

  SELECT * INTO a
  FROM public.zone_assignments
  WHERE user_id=_user_id AND zone_type=expected
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 1;

  IF a IS NULL THEN RETURN; END IF;

  IF expected='region' THEN
    UPDATE public.profiles p
    SET region_id=a.zone_id,
        district_id=(SELECT r.district_id FROM public.regions r WHERE r.id=a.zone_id)
    WHERE p.user_id=_user_id;

  ELSIF expected='departement' THEN
    UPDATE public.profiles p
    SET region_id=(SELECT d.region_id FROM public.departements d WHERE d.id=a.zone_id),
        district_id=(SELECT r.district_id
                     FROM public.regions r
                     WHERE r.id=(SELECT d.region_id FROM public.departements d WHERE d.id=a.zone_id))
    WHERE p.user_id=_user_id;

  ELSIF expected='sous_prefecture' THEN
    UPDATE public.profiles p
    SET region_id=(SELECT d.region_id
                   FROM public.departements d
                   WHERE d.id=(SELECT sp.departement_id FROM public.sous_prefectures sp WHERE sp.id=a.zone_id)),
        district_id=(SELECT r.district_id
                     FROM public.regions r
                     WHERE r.id=(SELECT d.region_id
                                 FROM public.departements d
                                 WHERE d.id=(SELECT sp.departement_id FROM public.sous_prefectures sp WHERE sp.id=a.zone_id)))
    WHERE p.user_id=_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_user_role_coverage(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
DECLARE expected text;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  expected := public.zone_assignment_expected_type(_user_id);

  -- A role change invalidates coverage of the previous level.
  IF expected IS NULL THEN
    DELETE FROM public.zone_assignments WHERE user_id=_user_id;
  ELSE
    DELETE FROM public.zone_assignments
    WHERE user_id=_user_id AND zone_type<>expected;
  END IF;

  PERFORM public.recompute_profile_coverage(_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_user_role_coverage_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $
BEGIN
  PERFORM public.reconcile_user_role_coverage(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$;

DROP TRIGGER IF EXISTS trg_reconcile_role_coverage ON public.user_roles;
CREATE TRIGGER trg_reconcile_role_coverage
AFTER INSERT OR DELETE OR UPDATE OF role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_user_role_coverage_trigger();

CREATE OR REPLACE FUNCTION public.validate_zone_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
DECLARE expected text;
BEGIN
  expected := public.zone_assignment_expected_type(NEW.user_id);
  IF expected IS NULL OR NEW.zone_type<>expected THEN
    RAISE EXCEPTION 'Affectation de zone incohérente : le rôle actuel exige le niveau %.', COALESCE(expected,'aucune couverture');
  END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by=auth.uid(); END IF;
  RETURN NEW;
END;
$$;

-- Governance roles are database roles, not a second UI-only concept.
CREATE OR REPLACE FUNCTION public.normalize_profile_org_scope()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
BEGIN
  IF NEW.relation_rh IN ('PDG','DG','Associé / Actionnaire') THEN
    NEW.departement=NULL; NEW.equipe_id=NULL; NEW.district_id=NULL; NEW.region_id=NULL; NEW.taux_commission=NULL;
  ELSIF COALESCE(NEW.departement,'') NOT IN ('Commercial','Technique') THEN
    NEW.equipe_id=NULL; NEW.district_id=NULL; NEW.region_id=NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_governance_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.relation_rh='PDG' THEN
    DELETE FROM public.user_roles WHERE user_id=NEW.user_id AND role NOT IN ('super_admin','pdg');
    INSERT INTO public.user_roles(user_id,role)
    SELECT NEW.user_id,'pdg'
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role='pdg');

  ELSIF NEW.relation_rh='DG' THEN
    DELETE FROM public.user_roles WHERE user_id=NEW.user_id AND role<>'dg';
    INSERT INTO public.user_roles(user_id,role)
    SELECT NEW.user_id,'dg'
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role='dg');

  ELSIF NEW.relation_rh='Associé / Actionnaire' THEN
    DELETE FROM public.user_roles WHERE user_id=NEW.user_id;
    INSERT INTO public.user_roles(user_id,role)
    SELECT NEW.user_id,'associe_actionnaire'
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role='associe_actionnaire');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.zone_assignment_expected_type(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_profile_coverage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_user_role_coverage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_zone_assignment() FROM PUBLIC, anon;

-- Existing role assignments are reconciled once so stale coverage cannot survive the migration.
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.user_roles LOOP
    PERFORM public.reconcile_user_role_coverage(u);
  END LOOP;
END $$;