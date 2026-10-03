CREATE OR REPLACE FUNCTION public.calculate_parcelle_surfaces()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  ELSE
    NEW.surface_proprietaire_ha:=NEW.surface_totale_ha/2;
    NEW.surface_agricapital_ha:=NEW.surface_totale_ha/2;
    NEW.surface_disponible_ha:=NEW.surface_agricapital_ha-coalesce(NEW.surface_attribuee_ha,0);
    IF NEW.surface_disponible_ha<0 THEN RAISE EXCEPTION 'Surface disponible insuffisante sur cette parcelle'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;