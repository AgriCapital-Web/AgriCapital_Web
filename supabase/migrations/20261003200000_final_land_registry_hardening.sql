-- Final hardening after land-registry audit.
-- 143 plants/ha everywhere; client-owned parcels are created when a realized
-- technical intervention is recorded; PalmInvest lot pairing is idempotent.

CREATE OR REPLACE FUNCTION public.trg_prepare_parcelle_plante_partage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  NEW.plantation_partagee_activee := CASE
    WHEN lower(coalesce(NEW.mode_surface,'')) IN ('propriete_client','propriete','client') THEN false
    ELSE coalesce(NEW.plantation_partagee_activee,true)
  END;
  NEW.plantation_surface_cible_ha := coalesce(NEW.plantation_surface_cible_ha,NEW.surface_totale_ha);
  NEW.plantation_type_culture := coalesce(nullif(NEW.plantation_type_culture,''),'Palmier à huile');
  NEW.plantation_densite_plants := coalesce(NEW.plantation_densite_plants,143);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_client_parcel_from_technical()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client public.clients%rowtype; v_parcelle uuid; v_formula text;
BEGIN
  IF NEW.client_id IS NULL OR NEW.statut<>'realisee' THEN RETURN NEW; END IF;
  SELECT * INTO v_client FROM public.clients WHERE id=NEW.client_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_formula:=upper(coalesce(v_client.formule_code,''));
  IF v_formula NOT LIKE 'PALMTERROIR%' AND v_formula NOT LIKE 'TERRAPALM%' THEN RETURN NEW; END IF;
  v_parcelle:=v_client.parcelle_id;

  IF v_parcelle IS NULL THEN
    INSERT INTO public.parcelles(
      nom,surface_totale_ha,surface_attribuee_ha,district_id,region_id,departement_id,sous_prefecture_id,village,
      localisation_gps_lat,localisation_gps_lng,statut,mode_surface,notes,plantation_partagee_activee,
      plantation_surface_cible_ha,plantation_type_culture,plantation_densite_plants,plantation_date_activation,created_by,updated_by
    ) VALUES (
      coalesce(nullif(v_client.localite,''),v_client.nom_complet,'Parcelle client'),
      coalesce(v_client.total_hectares,0),0,v_client.district_id,v_client.region_id,v_client.departement_id,v_client.sous_prefecture_id,v_client.localite,
      null,null,'a_valider','propriete_client',
      'Parcelle créée automatiquement lors de la réalisation d’une intervention technique. Propriété déclarée du Client.',
      false,coalesce(v_client.total_hectares,0),'Palmier à huile',143,null,v_client.created_by,v_client.updated_by
    ) RETURNING id INTO v_parcelle;
    UPDATE public.clients SET parcelle_id=v_parcelle,updated_at=now() WHERE id=v_client.id;
  ELSE
    UPDATE public.parcelles
    SET statut=case when NEW.type_intervention='validation_parcelle' then 'validee' else statut end,
        mode_surface='propriete_client',plantation_partagee_activee=false,
        plantation_surface_cible_ha=coalesce(v_client.total_hectares,plantation_surface_cible_ha),
        plantation_type_culture='Palmier à huile',plantation_densite_plants=143,
        plantation_date_activation=case when NEW.type_intervention='validation_parcelle' then NEW.date_intervention::date else plantation_date_activation end,
        updated_at=now()
    WHERE id=v_parcelle;
  END IF;
  NEW.parcelle_id:=v_parcelle;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_client_parcel_from_technical ON public.interventions_techniques;
CREATE TRIGGER trg_ensure_client_parcel_from_technical
BEFORE INSERT OR UPDATE OF statut,type_intervention,client_id ON public.interventions_techniques
FOR EACH ROW EXECUTE FUNCTION public.ensure_client_parcel_from_technical();

CREATE OR REPLACE FUNCTION public.create_plantation_after_mise_en_terre()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client public.clients%rowtype; v_parcelle public.parcelles%rowtype; v_existing uuid;
v_surface numeric; v_density integer; v_date date; v_name text; v_role text; v_active boolean; v_actor uuid;
BEGIN
  IF NEW.type_intervention<>'mise_en_terre' OR NEW.statut<>'realisee' THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL OR NEW.parcelle_id IS NULL THEN RAISE EXCEPTION 'La mise en terre doit être rattachée à un Client et à une parcelle'; END IF;
  SELECT * INTO v_client FROM public.clients WHERE id=NEW.client_id;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Client du parcours technique introuvable'; END IF;
  SELECT * INTO v_parcelle FROM public.parcelles WHERE id=NEW.parcelle_id FOR UPDATE;
  IF v_parcelle.id IS NULL THEN RAISE EXCEPTION 'Parcelle introuvable pour la mise en terre'; END IF;
  v_surface:=greatest(0,coalesce(v_client.total_hectares,0)); v_role:='beneficiaire';
  IF v_client.type_client='beneficiaire_particulier' THEN
    SELECT coalesce(max(ba.surface_attribuee_ha),v_surface),coalesce(max(ba.role_attribution),'beneficiaire')
    INTO v_surface,v_role FROM public.beneficiaire_attributions ba
    WHERE ba.client_id=v_client.id AND ba.parcelle_id=v_parcelle.id AND ba.statut='active';
  END IF;
  IF v_surface<=0 THEN RAISE EXCEPTION 'La superficie du dossier Client doit être renseignée avant la mise en terre'; END IF;
  v_active:=coalesce(v_client.compte_actif,false) OR v_client.paiement_initial_paye_at IS NOT NULL OR v_client.pi_paye_at IS NOT NULL;
  v_density:=coalesce(v_parcelle.plantation_densite_plants,143); v_date:=NEW.date_intervention::date;
  v_name:='Plantation '||coalesce(nullif(v_client.nom_complet,''),v_client.id_unique); v_actor:=coalesce(auth.uid(),v_client.created_by);
  SELECT p.id INTO v_existing FROM public.plantations p WHERE p.client_id=v_client.id AND p.parcelle_id=v_parcelle.id ORDER BY p.created_at DESC LIMIT 1;
  IF v_existing IS NULL THEN
    INSERT INTO public.plantations(
      client_id,parcelle_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,nombre_plants,densite_plants,
      district_id,region_id,departement_id,sous_prefecture_id,village,village_nom,localite,localisation_gps_lat,localisation_gps_lng,
      latitude,longitude,date_plantation,date_activation,statut,statut_global,type_culture,notes,created_by,updated_by
    ) VALUES (
      v_client.id,v_parcelle.id,v_role,v_name,v_name,v_surface,case when v_active then v_surface else 0 end,(v_surface*v_density)::integer,v_density,
      v_parcelle.district_id,v_parcelle.region_id,v_parcelle.departement_id,v_parcelle.sous_prefecture_id,v_parcelle.village,v_parcelle.village,v_parcelle.village,
      v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,v_date,
      case when v_active then v_date else null end,case when v_active then 'actif' else 'en_attente_pi' end,case when v_active then 'actif' else 'en_attente_pi' end,
      coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),
      case when v_active then 'Créée automatiquement après validation technique de la mise en terre.' else 'Créée automatiquement après validation technique de la mise en terre ; activation après validation du paiement initial.' end,
      v_actor,v_actor
    ) RETURNING id INTO v_existing;
  ELSE
    UPDATE public.plantations SET date_plantation=coalesce(date_plantation,v_date),
      date_activation=case when v_active then coalesce(date_activation,v_date) else null end,
      superficie_activee=case when v_active then superficie_ha else 0 end,
      nombre_plants=coalesce(nombre_plants,(superficie_ha*v_density)::integer),densite_plants=coalesce(densite_plants,v_density),
      statut=case when v_active then 'actif' else 'en_attente_pi' end,statut_global=case when v_active then 'actif' else 'en_attente_pi' end,updated_at=now()
    WHERE id=v_existing;
  END IF;
  UPDATE public.clients SET parcelle_id=coalesce(parcelle_id,v_parcelle.id),
    nombre_plantations=(select count(*) from public.plantations where client_id=v_client.id and statut not in ('archive','supprime')),
    phase_actuelle='plantation',updated_at=now() WHERE id=v_client.id;
  IF v_client.type_client='beneficiaire_particulier' THEN
    INSERT INTO public.beneficiaire_attributions(client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,notes)
    SELECT v_client.id,v_parcelle.id,v_existing,v_surface,v_role,'active','Rattachement automatique de la plantation individuelle à la parcelle.'
    WHERE NOT EXISTS(select 1 from public.beneficiaire_attributions ba where ba.client_id=v_client.id and ba.parcelle_id=v_parcelle.id and ba.plantation_id=v_existing and ba.statut='active');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_palminvest_lot_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_formula text; v_parcelle public.parcelles%rowtype; v_client public.clients%rowtype;
v_units integer; v_existing_units integer; v_lot record; v_activation uuid; v_done integer:=0;
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
    RAISE EXCEPTION 'Une activation PalmInvest doit représenter un multiple de 2 ha : 1 ha Client + 1 ha propriétaire.';
  END IF;
  v_units:=floor(coalesce(NEW.superficie_ha,0)/2);
  IF v_units<=0 THEN RAISE EXCEPTION 'Superficie PalmInvest invalide pour une activation partagée'; END IF;
  SELECT count(*) INTO v_existing_units FROM public.plantation_activations pa
  WHERE pa.client_id=NEW.client_id AND pa.parcelle_id=NEW.parcelle_id AND pa.statut='active';
  IF v_existing_units>=v_units THEN RETURN NEW; END IF;
  FOR v_lot IN
    SELECT lh.* FROM public.lots_hectares lh
    WHERE lh.parcelle_id=NEW.parcelle_id AND lh.convention_id=v_parcelle.convention_id AND lh.surface_ha=1
      AND (lh.client_id=NEW.client_id OR lh.statut='disponible')
      AND NOT EXISTS (SELECT 1 FROM public.plantation_activations pa WHERE pa.lot_id=lh.id AND pa.client_id=NEW.client_id AND pa.statut='active')
    ORDER BY CASE WHEN lh.client_id=NEW.client_id THEN 0 ELSE 1 END,lh.numero_h
    LIMIT (v_units-v_existing_units)
  LOOP
    UPDATE public.lots_hectares SET client_id=NEW.client_id,statut='attribue',date_attribution=coalesce(date_attribution,current_date),
      notes=concat_ws(' ',notes,'Activation PalmInvest rattachée automatiquement.') WHERE id=v_lot.id;
    INSERT INTO public.acquisition_lots(client_id,lot_id,date_attribution,surface_ha,notes)
    VALUES(NEW.client_id,v_lot.id,current_date,1,'Attribution automatique : 1 ha Client + 1 ha propriétaire.') ON CONFLICT (client_id,lot_id) DO NOTHING;
    INSERT INTO public.plantation_activations(lot_id,parcelle_id,proprietaire_id,client_id,surface_client_ha,surface_proprietaire_ha,statut,date_activation,notes,created_by)
    VALUES(v_lot.id,NEW.parcelle_id,v_parcelle.proprietaire_id,NEW.client_id,1,1,'active',coalesce(NEW.date_activation::date,current_date),
      'Activation automatique : 1 ha pour le Client + 1 ha correspondant pour le propriétaire.',NEW.created_by)
    ON CONFLICT DO NOTHING RETURNING id INTO v_activation;
    v_done:=v_done+1;
    IF v_activation IS NOT NULL AND NEW.activation_id IS NULL THEN NEW.activation_id:=v_activation; END IF;
  END LOOP;
  IF v_existing_units+v_done<v_units THEN RAISE EXCEPTION 'Lots AgriCapital insuffisants sur la parcelle % : % lot(s) requis, % disponible(s).',v_parcelle.id_unique,v_units,v_existing_units+v_done; END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.parcelles SET mode_surface='plante_partage',plantation_partagee_activee=true,plantation_densite_plants=143
WHERE id='6d00d15d-f7aa-4b31-ad6f-2b7d4a14c9e4';
UPDATE public.parcelles SET plantation_densite_plants=143 WHERE mode_surface='propriete_client';
