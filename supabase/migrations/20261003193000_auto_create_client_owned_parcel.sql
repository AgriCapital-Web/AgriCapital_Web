-- Ensure every new Client who owns land receives a dossier parcel before technical activation.
CREATE OR REPLACE FUNCTION public.ensure_client_owned_parcel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_parcelle uuid;
BEGIN
  IF NEW.parcelle_id IS NULL
     AND coalesce(NEW.type_client_foncier,'')='OWN'
     AND coalesce(NEW.total_hectares,0)>0 THEN
    INSERT INTO public.parcelles(
      nom,surface_totale_ha,surface_attribuee_ha,district_id,region_id,departement_id,
      sous_prefecture_id,village,localisation_gps_lat,localisation_gps_lng,statut,
      mode_surface,notes,plantation_partagee_activee,plantation_surface_cible_ha,
      plantation_type_culture,plantation_densite_plants,plantation_date_activation,created_by,updated_by
    )
    VALUES(
      coalesce(nullif(trim(NEW.localite),''),nullif(trim(NEW.nom_complet),''),'Parcelle client'),
      NEW.total_hectares,0,NEW.district_id,NEW.region_id,NEW.departement_id,
      NEW.sous_prefecture_id,NEW.localite,NEW.parcelle_latitude,NEW.parcelle_longitude,
      'a_valider','propriete_client',
      'Parcelle créée automatiquement avec le dossier Client. Validation technique requise avant activation de la plantation.',
      false,NEW.total_hectares,'Palmier à huile',140,NULL,NEW.created_by,NEW.updated_by
    )
    RETURNING id INTO v_parcelle;
    NEW.parcelle_id:=v_parcelle;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_client_owned_parcel ON public.clients;
CREATE TRIGGER trg_ensure_client_owned_parcel
BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.ensure_client_owned_parcel();