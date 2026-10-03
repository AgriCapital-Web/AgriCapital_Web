CREATE OR REPLACE FUNCTION public.calculate_convention_parts_and_lots()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_max_lots numeric;
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
  v_max_lots:=floor(NEW.part_agricapital_ha);
  IF NEW.type_convention='plante_partage' THEN
    v_max_lots:=least(floor(NEW.part_agricapital_ha),floor(NEW.part_proprietaire_ha));
  END IF;
  IF NEW.nombre_lots_agricapital>v_max_lots THEN
    RAISE EXCEPTION 'Le nombre de lots AgriCapital dépasse la surface appariable disponible (%) ha.',v_max_lots;
  END IF;
  RETURN NEW;
END;
$function$;