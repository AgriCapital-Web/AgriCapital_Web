-- Land registry v2: 143 density, client-owned parcel creation at technical validation,
-- owner percentage split, automatic 1-ha AgriCapital lots, and lead conversion helper.

ALTER TABLE public.conventions_foncieres
  ADD COLUMN IF NOT EXISTS nombre_lots_agricapital integer NOT NULL DEFAULT 0;
ALTER TABLE public.proprietaires_terres
  ADD COLUMN IF NOT EXISTS nombre_lots_agricapital integer NOT NULL DEFAULT 0;
ALTER TABLE public.parcelles
  ALTER COLUMN plantation_densite_plants SET DEFAULT 143;
ALTER TABLE public.interventions_techniques
  ALTER COLUMN densite_plants SET DEFAULT 143;
ALTER TABLE public.plantations
  ALTER COLUMN densite_cible SET DEFAULT 143;

CREATE OR REPLACE FUNCTION public.calculate_parcelle_surfaces()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(NEW.mode_surface,'foncier')='actif_agricole' THEN
    NEW.surface_proprietaire_ha:=NEW.surface_totale_ha;
    NEW.surface_agricapital_ha:=NEW.surface_totale_ha;
    NEW.surface_disponible_ha:=greatest(NEW.surface_agricapital_ha-coalesce(NEW.surface_attribuee_ha,0),0);
  ELSIF lower(coalesce(NEW.mode_surface,'')) IN ('propriete_client','propriete','client') THEN
    NEW.surface_proprietaire_ha:=NEW.surface_totale_ha;
    NEW.surface_agricapital_ha:=0;
    NEW.surface_attribuee_ha:=least(coalesce(NEW.surface_attribuee_ha,0),NEW.surface_totale_ha);
    NEW.surface_disponible_ha:=0;
  ELSIF lower(coalesce(NEW.mode_surface,'')) IN ('plante_partage','achat') THEN
    NEW.surface_proprietaire_ha:=greatest(coalesce(NEW.surface_proprietaire_ha,0),0);
    NEW.surface_agricapital_ha:=greatest(coalesce(NEW.surface_agricapital_ha,0),0);
    NEW.surface_attribuee_ha:=least(coalesce(NEW.surface_attribuee_ha,0),NEW.surface_agricapital_ha);
    NEW.surface_disponible_ha:=greatest(NEW.surface_agricapital_ha-NEW.surface_attribuee_ha,0);
  ELSE
    NEW.surface_proprietaire_ha:=NEW.surface_totale_ha/2;
    NEW.surface_agricapital_ha:=NEW.surface_totale_ha/2;
    NEW.surface_disponible_ha:=NEW.surface_agricapital_ha-coalesce(NEW.surface_attribuee_ha,0);
    IF NEW.surface_disponible_ha<0 THEN RAISE EXCEPTION 'Surface disponible insuffisante sur cette parcelle'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_convention_parts_and_lots()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type_convention IN ('achat','vente') THEN
    NEW.part_agricapital_pct:=100; NEW.part_proprietaire_pct:=0;
  ELSE
    NEW.type_convention:=coalesce(nullif(NEW.type_convention,''),'plante_partage');
    IF NEW.part_agricapital_pct IS NULL THEN NEW.part_agricapital_pct:=50; END IF;
    IF NEW.part_agricapital_pct<0 OR NEW.part_agricapital_pct>100 THEN
      RAISE EXCEPTION 'Le pourcentage AgriCapital doit être compris entre 0 et 100';
    END IF;
    NEW.part_proprietaire_pct:=100-NEW.part_agricapital_pct;
  END IF;
  NEW.part_agricapital_ha:=round((coalesce(NEW.surface_totale_ha,0)*NEW.part_agricapital_pct/100)::numeric,6);
  NEW.part_proprietaire_ha:=round((coalesce(NEW.surface_totale_ha,0)*NEW.part_proprietaire_pct/100)::numeric,6);
  IF NEW.nombre_lots_agricapital<0 THEN RAISE EXCEPTION 'Le nombre de lots AgriCapital ne peut pas être négatif'; END IF;
  IF NEW.nombre_lots_agricapital>floor(NEW.part_agricapital_ha) THEN
    RAISE EXCEPTION 'Le nombre de lots AgriCapital dépasse la part AgriCapital disponible (% ha)',NEW.part_agricapital_ha;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_calculate_convention_parts_and_lots ON public.conventions_foncieres;
CREATE TRIGGER trg_calculate_convention_parts_and_lots BEFORE INSERT OR UPDATE ON public.conventions_foncieres
FOR EACH ROW EXECUTE FUNCTION public.calculate_convention_parts_and_lots();

CREATE OR REPLACE FUNCTION public.generate_convention_lots()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_prefix text; v_lot integer; v_existing integer;
BEGIN
  IF NEW.parcelle_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.parcelles
  SET convention_id=NEW.id,surface_totale_ha=coalesce(NEW.surface_totale_ha,surface_totale_ha),
      surface_proprietaire_ha=NEW.part_proprietaire_ha,surface_agricapital_ha=NEW.part_agricapital_ha,
      plantation_partagee_activee=(NEW.type_convention='plante_partage'),plantation_densite_plants=143,updated_at=now()
  WHERE id=NEW.parcelle_id;
  IF NEW.nombre_lots_agricapital<=0 THEN RETURN NEW; END IF;
  SELECT coalesce(id_unique,code_parc,'PAR-'||substr(id::text,1,8)) INTO v_prefix FROM public.parcelles WHERE id=NEW.parcelle_id;
  SELECT count(*) INTO v_existing FROM public.lots_hectares WHERE convention_id=NEW.id AND statut='attribue';
  IF v_existing>NEW.nombre_lots_agricapital THEN
    RAISE EXCEPTION 'Impossible de réduire le nombre de lots: % lot(s) déjà attribué(s)',v_existing;
  END IF;
  FOR v_lot IN 1..NEW.nombre_lots_agricapital LOOP
    INSERT INTO public.lots_hectares(reference,convention_id,parcelle_id,numero_h,surface_ha,statut,notes)
    SELECT v_prefix||'-L'||lpad(v_lot::text,2,'0'),NEW.id,NEW.parcelle_id,v_lot,1,'disponible','Lot de 1 ha — part AgriCapital'
    WHERE NOT EXISTS (SELECT 1 FROM public.lots_hectares WHERE convention_id=NEW.id AND numero_h=v_lot);
  END LOOP;
  UPDATE public.proprietaires_terres SET nombre_lots_agricapital=NEW.nombre_lots_agricapital,updated_at=now()
  WHERE id=NEW.proprietaire_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_generate_convention_lots ON public.conventions_foncieres;
CREATE TRIGGER trg_generate_convention_lots AFTER INSERT OR UPDATE OF nombre_lots_agricapital,parcelle_id,proprietaire_id ON public.conventions_foncieres
FOR EACH ROW EXECUTE FUNCTION public.generate_convention_lots();

CREATE OR REPLACE FUNCTION public.ensure_client_parcel_from_technical()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client public.clients%ROWTYPE; v_parcelle uuid;
BEGIN
  IF NEW.client_id IS NULL OR NEW.type_intervention NOT IN ('validation_parcelle','piquetage','trouaison') OR NEW.statut<>'realisee' THEN RETURN NEW; END IF;
  SELECT * INTO v_client FROM public.clients WHERE id=NEW.client_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF upper(coalesce(v_client.formule_code,'')) LIKE 'PALMINVEST%' THEN RETURN NEW; END IF;
  v_parcelle:=v_client.parcelle_id;
  IF v_parcelle IS NULL THEN
    INSERT INTO public.parcelles(
      nom,surface_totale_ha,surface_attribuee_ha,district_id,region_id,departement_id,sous_prefecture_id,village,
      localisation_gps_lat,localisation_gps_lng,statut,mode_surface,notes,plantation_partagee_activee,
      plantation_surface_cible_ha,plantation_type_culture,plantation_densite_plants,plantation_date_activation,created_by,updated_by
    )
    VALUES(
      coalesce(nullif(v_client.localite,''),v_client.nom_complet,'Parcelle client'),coalesce(v_client.total_hectares,0),0,
      v_client.district_id,v_client.region_id,v_client.departement_id,v_client.sous_prefecture_id,v_client.localite,
      null,null,CASE WHEN NEW.type_intervention='validation_parcelle' THEN 'validee' ELSE 'a_valider' END,'propriete_client',
      'Parcelle créée automatiquement lors de la validation technique. Propriété déclarée du Client.',false,
      coalesce(v_client.total_hectares,0),'Palmier à huile',143,
      CASE WHEN NEW.type_intervention='validation_parcelle' THEN NEW.date_intervention::date ELSE NULL END,
      v_client.created_by,v_client.updated_by
    ) RETURNING id INTO v_parcelle;
    UPDATE public.clients SET parcelle_id=v_parcelle,updated_at=now() WHERE id=v_client.id;
  ELSE
    UPDATE public.parcelles
    SET statut=CASE WHEN NEW.type_intervention='validation_parcelle' THEN 'validee' ELSE statut END,
        plantation_partagee_activee=false,plantation_surface_cible_ha=coalesce(v_client.total_hectares,plantation_surface_cible_ha),
        plantation_type_culture='Palmier à huile',plantation_densite_plants=143,
        plantation_date_activation=CASE WHEN NEW.type_intervention='validation_parcelle' THEN NEW.date_intervention::date ELSE plantation_date_activation END,
        updated_at=now()
    WHERE id=v_parcelle;
  END IF;
  NEW.parcelle_id:=v_parcelle;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_client_parcel_from_technical ON public.interventions_techniques;
CREATE TRIGGER trg_ensure_client_parcel_from_technical BEFORE INSERT ON public.interventions_techniques
FOR EACH ROW EXECUTE FUNCTION public.ensure_client_parcel_from_technical();

DROP TRIGGER IF EXISTS trg_ensure_client_owned_parcel ON public.clients;
DROP FUNCTION IF EXISTS public.ensure_client_owned_parcel();

CREATE OR REPLACE FUNCTION public.get_lead_commercial_for_conversion(_lead_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN private.can_access_lead(auth.uid(),l.id) AND l.assigned_to IS NOT NULL AND private.is_commercial_assignable(l.assigned_to)
    THEN l.assigned_to ELSE NULL END
  FROM public.leads l WHERE l.id=_lead_id;
$function$;

DELETE FROM public.role_permissions WHERE role_code='chef_equipe_technique' AND permission_code='clients.create';
