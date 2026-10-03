-- Automatically pair every PalmInvest 1-ha Client share with 1 ha of the landowner share.
CREATE OR REPLACE FUNCTION public.sync_palminvest_lot_activation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_formula text; v_parcelle public.parcelles%ROWTYPE; v_client public.clients%ROWTYPE;
  v_units integer; v_existing integer; v_lot record; v_activation uuid; v_done integer:=0;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id=NEW.client_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_formula:=upper(coalesce(v_client.formule_code,''));
  IF v_formula NOT LIKE 'PALMINVEST%' OR NEW.parcelle_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_parcelle FROM public.parcelles WHERE id=NEW.parcelle_id;
  IF NOT FOUND OR v_parcelle.convention_id IS NULL OR NOT v_parcelle.plantation_partagee_activee THEN
    RAISE EXCEPTION 'La plantation PalmInvest doit être rattachée à une parcelle AgriCapital sous convention active';
  END IF;
  IF mod(coalesce(NEW.superficie_ha,0)::numeric,2)<>0 THEN
    RAISE EXCEPTION 'Une activation partagée doit être composée de 1 ha Client + 1 ha propriétaire. La superficie totale doit donc être un multiple de 2 ha.';
  END IF;
  v_units:=floor(coalesce(NEW.superficie_ha,0)/2);
  IF v_units<=0 THEN RAISE EXCEPTION 'Superficie PalmInvest invalide pour une activation partagée'; END IF;
  SELECT count(*),min(id) INTO v_existing,v_activation
  FROM public.plantation_activations
  WHERE client_id=NEW.client_id AND parcelle_id=NEW.parcelle_id AND statut='active';
  IF v_existing>=v_units THEN
    IF NEW.activation_id IS NULL THEN NEW.activation_id:=v_activation; END IF;
    RETURN NEW;
  END IF;
  FOR v_lot IN
    SELECT lh.* FROM public.lots_hectares lh
    WHERE lh.parcelle_id=NEW.parcelle_id AND lh.convention_id=v_parcelle.convention_id
      AND lh.surface_ha=1 AND (lh.client_id=NEW.client_id OR lh.statut='disponible')
      AND NOT EXISTS (
        SELECT 1 FROM public.plantation_activations pa
        WHERE pa.lot_id=lh.id AND pa.client_id=NEW.client_id AND pa.statut='active'
      )
    ORDER BY CASE WHEN lh.client_id=NEW.client_id THEN 0 ELSE 1 END,lh.numero_h
    LIMIT (v_units-v_existing)
  LOOP
    UPDATE public.lots_hectares SET client_id=NEW.client_id,statut='attribue',
      date_attribution=coalesce(date_attribution,current_date),
      notes=concat_ws(' ',notes,'Activation PalmInvest rattachée automatiquement.')
    WHERE id=v_lot.id;
    INSERT INTO public.acquisition_lots(client_id,lot_id,date_attribution,surface_ha,notes)
    VALUES(NEW.client_id,v_lot.id,current_date,1,'Attribution automatique : 1 ha Client + 1 ha propriétaire.')
    ON CONFLICT (client_id,lot_id) DO NOTHING;
    INSERT INTO public.plantation_activations(
      lot_id,parcelle_id,proprietaire_id,client_id,surface_client_ha,surface_proprietaire_ha,
      statut,date_activation,notes,created_by
    )
    VALUES(v_lot.id,NEW.parcelle_id,v_parcelle.proprietaire_id,NEW.client_id,1,1,'active',
      coalesce(NEW.date_activation::date,current_date),
      'Activation automatique : 1 ha pour le Client + 1 ha correspondant pour le propriétaire.',NEW.created_by)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_activation;
    v_done:=v_done+1;
    IF v_activation IS NOT NULL AND NEW.activation_id IS NULL THEN NEW.activation_id:=v_activation; END IF;
  END LOOP;
  IF v_existing+v_done<v_units THEN
    RAISE EXCEPTION 'Lots AgriCapital insuffisants sur la parcelle % : % requis, % disponible(s).',v_parcelle.id_unique,v_units,v_existing+v_done;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_sync_palminvest_lot_activation ON public.plantations;
CREATE TRIGGER trg_sync_palminvest_lot_activation
BEFORE INSERT OR UPDATE OF client_id,parcelle_id,superficie_ha,date_activation,statut ON public.plantations
FOR EACH ROW EXECUTE FUNCTION public.sync_palminvest_lot_activation();