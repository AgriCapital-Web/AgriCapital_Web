-- Fix lead creation/assignment for all internal staff roles.
CREATE OR REPLACE FUNCTION private.can_access_lead(_user_id uuid, _lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_assigned uuid; v_created uuid;
BEGIN
  IF _user_id IS NULL OR _lead_id IS NULL THEN RETURN false; END IF;
  IF private.is_global_admin(_user_id)
     OR private.has_role(_user_id,'responsable_operations')
     OR private.has_role(_user_id,'service_client')
     OR private.has_role(_user_id,'chef_equipe_service_client') THEN RETURN true; END IF;
  SELECT assigned_to, created_by INTO v_assigned, v_created FROM public.leads WHERE id=_lead_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_created=_user_id THEN RETURN true; END IF;
  IF private.is_commercial_scope_member(_user_id,v_assigned) THEN RETURN true; END IF;
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.can_assign_lead_to(_actor uuid, _target uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
SELECT _target IS NOT NULL
  AND private.is_commercial_assignable(_target)
  AND (
    private.is_global_admin(_actor)
    OR private.has_role(_actor,'responsable_operations')
    OR private.has_role(_actor,'service_client')
    OR private.has_role(_actor,'chef_equipe_service_client')
    OR private.has_role(_actor,'comptable')
    OR private.is_commercial_scope_member(_actor,_target)
  );
$function$;

CREATE OR REPLACE FUNCTION private.validate_lead_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL
     AND NEW.created_by=auth.uid()
     AND NEW.assigned_to=auth.uid()
     AND private.is_staff(auth.uid()) THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NOT private.can_assign_lead_to(auth.uid(),NEW.assigned_to) THEN
    RAISE EXCEPTION 'Affectation du prospect non autorisée' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.reassign_lead_secure(_lead_id uuid,_new_owner uuid,_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_old uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    private.is_global_admin(auth.uid())
    OR private.has_role(auth.uid(),'responsable_operations')
    OR private.can_assign_lead_to(auth.uid(),_new_owner)
  ) THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à réaffecter ce prospect' USING ERRCODE='42501';
  END IF;
  IF _new_owner IS NULL OR NOT private.is_commercial_assignable(_new_owner) THEN
    RAISE EXCEPTION 'Le nouveau responsable doit être un commercial autorisé' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=_new_owner AND coalesce(p.actif,false)=true) THEN
    RAISE EXCEPTION 'Le nouveau responsable est inactif ou introuvable' USING ERRCODE='22023';
  END IF;
  IF NOT private.can_access_lead(auth.uid(),_lead_id) THEN
    RAISE EXCEPTION 'Vous n''avez pas accès à ce prospect' USING ERRCODE='42501';
  END IF;
  SELECT assigned_to INTO v_old FROM public.leads WHERE id=_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prospect introuvable' USING ERRCODE='P0002'; END IF;
  UPDATE public.leads SET assigned_to=_new_owner,updated_at=now() WHERE id=_lead_id;
  INSERT INTO public.lead_historique(lead_id,action,champ,ancienne_valeur,nouvelle_valeur,commentaire,acteur_id)
  VALUES(_lead_id,'reaffectation','assigned_to',v_old::text,_new_owner::text,left(_motif,1000),auth.uid());
END;
$function$;

INSERT INTO public.role_permissions(role_code,permission_code)
SELECT x.role_code,x.permission_code FROM (VALUES
  ('service_client','clients.create'),
  ('technicien','leads.create')
) x(role_code,permission_code)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_code=x.role_code AND rp.permission_code=x.permission_code
);