-- Remove the last legacy 140 plants/ha fallback.
CREATE OR REPLACE FUNCTION public.trg_normalize_particular_plantation_shared()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_type text; v_parcelle public.parcelles%rowtype; v_beneficiary numeric; v_physical numeric; v_density integer;
BEGIN
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;
  SELECT type_client INTO v_type FROM public.clients WHERE id=NEW.client_id;
  IF v_type <> 'beneficiaire_particulier' THEN RETURN NEW; END IF;
  SELECT * INTO v_parcelle FROM public.parcelles WHERE id=NEW.parcelle_id;
  IF v_parcelle.id IS NULL THEN RETURN NEW; END IF;
  v_beneficiary:=coalesce(NEW.superficie_ha,0);
  IF v_beneficiary<=0 THEN RETURN NEW; END IF;
  v_physical:=greatest(coalesce(v_parcelle.surface_totale_ha,0),2*v_beneficiary);
  v_density:=coalesce(v_parcelle.plantation_densite_plants,NEW.densite_plants,143);
  UPDATE public.parcelles SET mode_surface='foncier',surface_totale_ha=v_physical,surface_proprietaire_ha=v_physical/2,
    surface_agricapital_ha=v_physical/2,surface_attribuee_ha=v_beneficiary,surface_disponible_ha=greatest(0,v_physical/2-v_beneficiary),
    plantation_partagee_activee=true,plantation_surface_cible_ha=v_physical,plantation_type_culture=coalesce(plantation_type_culture,'Palmier à huile'),
    plantation_densite_plants=v_density,updated_at=now() WHERE id=v_parcelle.id;
  UPDATE public.plantations SET client_id=null,role_attribution='partage',superficie_ha=v_physical,superficie_activee=v_physical,
    nombre_plants=(v_physical*v_density)::integer,densite_plants=v_density,statut=coalesce(nullif(statut,''),'actif'),
    statut_global=coalesce(nullif(statut_global,''),'actif'),updated_at=now() WHERE id=NEW.id;
  IF NOT EXISTS(select 1 from public.beneficiaire_attributions where client_id=NEW.client_id and parcelle_id=NEW.parcelle_id and statut='active') THEN
    INSERT INTO public.beneficiaire_attributions(client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,notes)
    VALUES(NEW.client_id,NEW.parcelle_id,NEW.id,v_beneficiary,'beneficiaire','active','Quote-part bénéficiaire particulier dans un actif agricole partagé. Aucun paiement requis.');
  END IF;
  RETURN NEW;
END;
$function$;