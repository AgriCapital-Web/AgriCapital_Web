CREATE OR REPLACE FUNCTION public.validate_formula_technical_intervention()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_formula text; v_plantation_date date; v_client_id uuid; v_client_parcelle uuid;
BEGIN
  IF NEW.plantation_id IS NOT NULL THEN
    SELECT p.client_id,p.parcelle_id,p.date_plantation,c.formule_code
      INTO v_client_id,NEW.parcelle_id,v_plantation_date,v_formula
    FROM public.plantations p JOIN public.clients c ON c.id=p.client_id WHERE p.id=NEW.plantation_id;
    IF v_client_id IS NULL THEN RAISE EXCEPTION 'Plantation introuvable pour l’intervention'; END IF;
    IF NEW.client_id IS NULL THEN NEW.client_id:=v_client_id; END IF;
    IF NEW.client_id IS DISTINCT FROM v_client_id THEN RAISE EXCEPTION 'Le Client de l’intervention ne correspond pas à la plantation sélectionnée'; END IF;
  ELSE
    v_client_id:=NEW.client_id;
    IF v_client_id IS NOT NULL THEN
      SELECT c.formule_code,c.parcelle_id INTO v_formula,v_client_parcelle FROM public.clients c WHERE c.id=v_client_id;
      IF NEW.parcelle_id IS NULL AND v_client_parcelle IS NOT NULL THEN NEW.parcelle_id:=v_client_parcelle;
      ELSIF NEW.parcelle_id IS NOT NULL AND v_client_parcelle IS NOT NULL AND NEW.parcelle_id IS DISTINCT FROM v_client_parcelle THEN
        RAISE EXCEPTION 'La parcelle de l’intervention ne correspond pas au dossier Client';
      END IF;
      SELECT p.date_plantation INTO v_plantation_date FROM public.plantations p
      WHERE p.client_id=v_client_id AND p.parcelle_id=NEW.parcelle_id
      ORDER BY p.date_plantation DESC NULLS LAST LIMIT 1;
    END IF;
  END IF;
  IF NEW.type_intervention='mise_en_terre' AND NEW.statut='realisee'
     AND (NEW.client_id IS NULL OR NEW.parcelle_id IS NULL) THEN
    RAISE EXCEPTION 'La mise en terre réalisée doit être rattachée à un Client et à une parcelle';
  END IF;
  IF coalesce(v_formula,'') LIKE 'PALMTERROIR%' AND v_plantation_date IS NOT NULL
     AND NEW.date_intervention::date>=v_plantation_date
     AND NEW.type_intervention NOT IN ('suivi_mensuel','autre') THEN
    RAISE EXCEPTION 'Intervention non autorisée pour PalmTerroir après la mise en terre : %',NEW.type_intervention;
  ELSIF coalesce(v_formula,'') LIKE 'PALMTERROIR%'
     AND (v_plantation_date IS NULL OR NEW.date_intervention::date<v_plantation_date)
     AND NEW.type_intervention NOT IN ('validation_parcelle','piquetage','trouaison','mise_en_terre','autre') THEN
    RAISE EXCEPTION 'Intervention non autorisée pour PalmTerroir avant la mise en terre : %',NEW.type_intervention;
  END IF;
  RETURN NEW;
END;
$function$;