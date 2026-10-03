-- Backfill current production records into the v2 parcel/lot model.
DO $$
DECLARE v_conv uuid; v_lot1 uuid; v_lot2 uuid; v_parcelle uuid:='6d00d15d-f7aa-4b31-ad6f-2b7d4a14c9e4'; v_prop uuid:='2702d6e0-3860-45a2-aa55-b1b2d3dbfabc';
BEGIN
  UPDATE public.parcelles SET id_unique='PAR-000005',plantation_densite_plants=143 WHERE id='7ca44c42-3158-4583-b855-165dcd8d1248';
  UPDATE public.parcelles SET id_unique='PAR-000004',plantation_densite_plants=143 WHERE id='2cfb5d67-05e3-4c71-bad2-3176f1aa1950';
  UPDATE public.parcelles SET id_unique='PAR-000003',nom='Parcelle client — TIONON MADOU',plantation_densite_plants=143 WHERE id='d63d0afb-4d1f-4277-abd6-580b380a1026';
  UPDATE public.parcelles SET id_unique='PAR-000002',nom='Parcelle client — DADODOUE DARIUS',plantation_densite_plants=143 WHERE id='e00f5bbf-dabc-496d-9175-a3eabf9deac3';

  UPDATE public.parcelles SET mode_surface='propriete_client',plantation_partagee_activee=false,statut='validee',
    plantation_surface_cible_ha=1,plantation_type_culture='Palmier à huile',plantation_densite_plants=143,plantation_date_activation='2026-09-16'
  WHERE id='e00f5bbf-dabc-496d-9175-a3eabf9deac3';
  UPDATE public.parcelles SET mode_surface='propriete_client',plantation_partagee_activee=false,statut='validee',
    plantation_surface_cible_ha=1,plantation_type_culture='Palmier à huile',plantation_densite_plants=143,plantation_date_activation='2026-09-30'
  WHERE id='d63d0afb-4d1f-4277-abd6-580b380a1026';
  UPDATE public.parcelles SET mode_surface='propriete_client',plantation_partagee_activee=false,plantation_densite_plants=143 WHERE id='2cfb5d67-05e3-4c71-bad2-3176f1aa1950';
  UPDATE public.parcelles SET mode_surface='propriete_client',plantation_partagee_activee=false,statut='validee',
    plantation_surface_cible_ha=1,plantation_type_culture='Palmier à huile',plantation_densite_plants=143,plantation_date_activation='2026-10-03'
  WHERE id='7ca44c42-3158-4583-b855-165dcd8d1248';

  UPDATE public.plantations SET parcelle_id='e00f5bbf-dabc-496d-9175-a3eabf9deac3',densite_cible=143,densite_plants=143
  WHERE client_id='99634a04-ab95-4d11-95dd-2f70f375142c';
  UPDATE public.plantations SET parcelle_id='d63d0afb-4d1f-4277-abd6-580b380a1026',densite_cible=143,densite_plants=143
  WHERE client_id='f5c48091-8d42-4d8f-8163-bb9dc05caaaa';
  UPDATE public.plantations SET parcelle_id='7ca44c42-3158-4583-b855-165dcd8d1248',densite_cible=143,densite_plants=143
  WHERE client_id='3d56c89a-6791-4828-a428-0f55cb1b6f5d';

  UPDATE public.clients SET parcelle_id='e00f5bbf-dabc-496d-9175-a3eabf9deac3' WHERE id='99634a04-ab95-4d11-95dd-2f70f375142c';
  UPDATE public.clients SET parcelle_id='d63d0afb-4d1f-4277-abd6-580b380a1026' WHERE id='f5c48091-8d42-4d8f-8163-bb9dc05caaaa';
  UPDATE public.clients SET parcelle_id='2cfb5d67-05e3-4c71-bad2-3176f1aa1950' WHERE id='a4f05608-2ccf-4682-8ece-7b3ceb88f2e6';
  UPDATE public.clients SET parcelle_id='7ca44c42-3158-4583-b855-165dcd8d1248' WHERE id='3d56c89a-6791-4828-a428-0f55cb1b6f5d';

  DELETE FROM public.acquisition_lots WHERE lot_id IN (SELECT id FROM public.lots_hectares WHERE parcelle_id=v_parcelle);
  DELETE FROM public.plantation_activations WHERE parcelle_id=v_parcelle;
  DELETE FROM public.lots_hectares WHERE parcelle_id=v_parcelle;
  DELETE FROM public.conventions_foncieres WHERE parcelle_id=v_parcelle;

  UPDATE public.parcelles SET surface_totale_ha=4,surface_proprietaire_ha=2,surface_agricapital_ha=2,surface_attribuee_ha=2,
    surface_disponible_ha=0,plantation_partagee_activee=true,plantation_surface_cible_ha=4,
    plantation_type_culture='Palmier à huile',plantation_densite_plants=143,plantation_date_activation='2026-09-05',statut='saturee',mode_surface='foncier'
  WHERE id=v_parcelle;

  INSERT INTO public.conventions_foncieres(
    reference,proprietaire_id,parcelle_id,sous_prefecture_id,type_convention,duree_ans,date_signature,date_debut,
    surface_totale_ha,statut,part_proprietaire_pct,part_agricapital_pct,part_proprietaire_ha,part_agricapital_ha,
    caution_par_ha,caution_totale,nombre_lots_agricapital,created_by
  )
  VALUES(
    'CONV-PAR-000001',v_prop,v_parcelle,
    (SELECT sous_prefecture_id FROM public.parcelles WHERE id=v_parcelle),
    'plante_partage',30,'2026-09-05','2026-09-05',4,'active',50,50,2,2,50000,100000,2,
    (SELECT created_by FROM public.proprietaires_terres WHERE id=v_prop)
  )
  RETURNING id INTO v_conv;

  SELECT id INTO v_lot1 FROM public.lots_hectares WHERE convention_id=v_conv AND numero_h=1;
  SELECT id INTO v_lot2 FROM public.lots_hectares WHERE convention_id=v_conv AND numero_h=2;

  UPDATE public.lots_hectares SET client_id='06b2d0c3-940a-45e5-981a-f7534e5553c0',statut='attribue',date_attribution='2026-09-05' WHERE id=v_lot1;
  UPDATE public.lots_hectares SET client_id='ef58c186-e6a9-4fdd-8c6c-21220f42e9cf',statut='attribue',date_attribution='2026-09-05' WHERE id=v_lot2;

  INSERT INTO public.acquisition_lots(client_id,lot_id,date_attribution,surface_ha,notes)
  VALUES
    ('06b2d0c3-940a-45e5-981a-f7534e5553c0',v_lot1,'2026-09-05',1,'Part AgriCapital 1 ha ; contrepartie propriétaire 1 ha.')
    ON CONFLICT (client_id,lot_id) DO NOTHING;
  INSERT INTO public.acquisition_lots(client_id,lot_id,date_attribution,surface_ha,notes)
  VALUES
    ('ef58c186-e6a9-4fdd-8c6c-21220f42e9cf',v_lot2,'2026-09-05',1,'Part AgriCapital 1 ha ; contrepartie propriétaire 1 ha.')
    ON CONFLICT (client_id,lot_id) DO NOTHING;

  INSERT INTO public.plantation_activations(lot_id,parcelle_id,proprietaire_id,client_id,surface_client_ha,surface_proprietaire_ha,statut,date_activation,notes)
  VALUES
    (v_lot1,v_parcelle,v_prop,'06b2d0c3-940a-45e5-981a-f7534e5553c0',1,1,'active','2026-09-05','Activation couplée : 1 ha Client + 1 ha propriétaire.'),
    (v_lot2,v_parcelle,v_prop,'ef58c186-e6a9-4fdd-8c6c-21220f42e9cf',1,1,'active','2026-09-05','Activation couplée : 1 ha Client + 1 ha propriétaire.');

  UPDATE public.proprietaires_terres SET nombre_parcelles=1,nombre_lots_agricapital=2,
    part_proprietaire_pct=50,part_agricapital_pct=50,part_proprietaire_ha=2,part_agricapital_ha=2
  WHERE id=v_prop;
END $$;