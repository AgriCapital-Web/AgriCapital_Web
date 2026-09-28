-- Initialisation du dossier Planté-Partagé Zakaria
-- Données fournies et validées par l'utilisateur.
do $$
declare
  v_owner uuid;
  v_parcelle uuid;
  v_yao uuid;
  v_bolou uuid;
  v_plantation uuid;
  v_lot uuid;
begin
  select id into v_owner from public.proprietaires_terres
  where lower(coalesce(nom_complet,''))=lower('ZAGBLE BOLOU JEAN-JACQUES')
     or telephone in ('+2250556834077','0556834077')
  order by created_at limit 1;

  if v_owner is null then
    insert into public.proprietaires_terres(
      nom,prenoms,nom_complet,telephone,whatsapp,statut,type_proprietaire,statut_foncier,
      region_id,departement_id,sous_prefecture_id,village,notes,
      part_proprietaire_pct,part_agricapital_pct,part_proprietaire_ha,part_agricapital_ha,surface_totale_declaree_ha
    ) values(
      'ZAGBLE','BOLOU JEAN-JACQUES','ZAGBLE BOLOU JEAN-JACQUES',
      '+2250556834077','+2250556834077','actif','personne_physique','coutumier',
      'd7738144-14cf-43f6-be4d-500f21a9cee5','f6903743-4dc4-4554-8be5-c751ab2ffb28',
      'ffdb4050-1b54-49fb-b5ec-faf338b58b19','Zakaria',
      'Propriétaire foncier ; quote-part agricole gérée automatiquement.',
      50,50,2,2,4
    ) returning id into v_owner;
  else
    update public.proprietaires_terres
    set telephone='+2250556834077',whatsapp='+2250556834077',village='Zakaria',
        part_proprietaire_pct=50,part_agricapital_pct=50,part_proprietaire_ha=2,part_agricapital_ha=2,
        surface_totale_declaree_ha=4,updated_at=now()
    where id=v_owner;
  end if;

  select id into v_parcelle from public.parcelles where code_parc='AC-PP-SP001-DOM001-PARC001' order by created_at limit 1;
  if v_parcelle is null then
    insert into public.parcelles(
      proprietaire_id,nom,surface_totale_ha,surface_proprietaire_ha,surface_agricapital_ha,
      surface_attribuee_ha,surface_disponible_ha,mode_surface,region_id,departement_id,sous_prefecture_id,
      village,statut,code_parc,notes,plantation_partagee_activee,plantation_surface_cible_ha,plantation_type_culture,plantation_densite_plants
    ) values(
      v_owner,'Parcelle Planté-Partagé — Zakaria',4,2,2,2,0,'foncier',
      'd7738144-14cf-43f6-be4d-500f21a9cee5','f6903743-4dc4-4554-8be5-c751ab2ffb28',
      'ffdb4050-1b54-49fb-b5ec-faf338b58b19','Zakaria','partiellement_attribuee',
      'AC-PP-SP001-DOM001-PARC001','Parcelle physique unique de 4 ha.',true,4,'Palmier à huile',140
    ) returning id into v_parcelle;
  else
    update public.parcelles set proprietaire_id=v_owner,surface_totale_ha=4,surface_proprietaire_ha=2,
      surface_agricapital_ha=2,surface_attribuee_ha=2,surface_disponible_ha=0,mode_surface='foncier',
      village='Zakaria',statut='partiellement_attribuee',plantation_partagee_activee=true,
      plantation_surface_cible_ha=4,plantation_type_culture='Palmier à huile',plantation_densite_plants=140,updated_at=now()
    where id=v_parcelle;
  end if;

  select id into v_yao from public.clients where numero_piece='CI002985359'
     or lower(coalesce(nom_complet,''))=lower('YAO KONAN EMMANUEL') order by created_at limit 1;
  if v_yao is null then
    insert into public.clients(
      parcelle_id,type_client,type_client_foncier,nom,nom_famille,prenoms,nom_complet,civilite,
      date_naissance,lieu_naissance,nationalite,type_piece,numero_piece,date_delivrance_piece,
      telephone,whatsapp,domicile,localite,statut,statut_global,compte_actif,total_hectares,nombre_plantations,
      paiement_initial_montant,montant_total_contrat,parcours_code,contrat_acquisition_statut,contrat_accompagnement_statut
    ) values(
      v_parcelle,'beneficiaire_particulier','EXT','YAO','YAO','KONAN EMMANUEL','YAO KONAN EMMANUEL','M',
      '1971-12-27','GONATE','Ivoirienne','cni','CI002985359','2022-01-17',
      '0708084321','0708084321','KOUASSIKANKRO – CAMP BETHEL, GONATE','Zakaria','actif','actif',false,2,1,0,0,
      'beneficiaire_particulier','non_requis','non_requis'
    ) returning id into v_yao;
  else
    update public.clients set parcelle_id=v_parcelle,type_client='beneficiaire_particulier',type_client_foncier='EXT',
      user_id=null,compte_actif=false,telephone='0708084321',whatsapp='0708084321',
      domicile='KOUASSIKANKRO – CAMP BETHEL, GONATE',localite='Zakaria',total_hectares=2,nombre_plantations=1,
      paiement_initial_montant=0,montant_total_contrat=0,parcours_code='beneficiaire_particulier',
      contrat_acquisition_statut='non_requis',contrat_accompagnement_statut='non_requis',updated_at=now()
    where id=v_yao;
  end if;

  select id into v_bolou from public.clients where lower(coalesce(nom_complet,''))=lower('ZAGBLE BOLOU JEAN-JACQUES')
     or telephone in ('+2250556834077','0556834077') order by created_at limit 1;
  if v_bolou is null then
    insert into public.clients(
      parcelle_id,type_client,type_client_foncier,nom,nom_famille,prenoms,nom_complet,civilite,nationalite,
      telephone,whatsapp,localite,statut,statut_global,compte_actif,total_hectares,nombre_plantations,
      paiement_initial_montant,montant_total_contrat,parcours_code,contrat_acquisition_statut,contrat_accompagnement_statut
    ) values(
      v_parcelle,'beneficiaire_particulier','EXT','ZAGBLE','ZAGBLE','BOLOU JEAN-JACQUES','ZAGBLE BOLOU JEAN-JACQUES','M','Ivoirienne',
      '+2250556834077','+2250556834077','Zakaria','actif','actif',false,2,1,0,0,
      'beneficiaire_particulier','non_requis','non_requis'
    ) returning id into v_bolou;
  else
    update public.clients set parcelle_id=v_parcelle,type_client='beneficiaire_particulier',type_client_foncier='EXT',
      user_id=null,compte_actif=false,telephone='+2250556834077',whatsapp='+2250556834077',localite='Zakaria',
      total_hectares=2,nombre_plantations=1,paiement_initial_montant=0,montant_total_contrat=0,
      parcours_code='beneficiaire_particulier',contrat_acquisition_statut='non_requis',
      contrat_accompagnement_statut='non_requis',updated_at=now()
    where id=v_bolou;
  end if;

  select id into v_lot from public.lots_hectares where parcelle_id=v_parcelle and client_id=v_yao and surface_ha=2 order by created_at limit 1;
  if v_lot is null then
    insert into public.lots_hectares(reference,parcelle_id,numero_h,surface_ha,statut,client_id,date_attribution,notes)
    values('AC-PP-SP001-DOM001-PARC001-L01',v_parcelle,1,2,'attribue',v_yao,current_date,
      'Attribution particulière de 2 ha à YAO KONAN EMMANUEL ; aucun paiement.');
  else
    update public.lots_hectares set client_id=v_yao,statut='attribue',surface_ha=2,date_attribution=coalesce(date_attribution,current_date)
    where id=v_lot;
  end if;

  select id into v_plantation from public.plantations where parcelle_id=v_parcelle and role_attribution='partage' order by created_at limit 1;
  if v_plantation is null then
    insert into public.plantations(
      client_id,parcelle_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,nombre_plants,densite_plants,
      region_id,departement_id,sous_prefecture_id,village,village_nom,localite,date_plantation,date_activation,statut,statut_global,type_culture,notes
    ) values(
      null,v_parcelle,'partage','Plantation partagée — Zakaria','Plantation partagée — Zakaria',4,4,560,140,
      'd7738144-14cf-43f6-be4d-500f21a9cee5','f6903743-4dc4-4554-8be5-c751ab2ffb28',
      'ffdb4050-1b54-49fb-b5ec-faf338b58b19','Zakaria','Zakaria','Zakaria',current_date,current_date,'active','active','Palmier à huile',
      'Actif agricole partagé de 4 ha : 2 ha YAO KONAN EMMANUEL et 2 ha ZAGBLE BOLOU JEAN-JACQUES.'
    ) returning id into v_plantation;
  end if;

  delete from public.beneficiaire_attributions where parcelle_id=v_parcelle;
  insert into public.beneficiaire_attributions(client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,reference_acte,notes)
  values
    (v_yao,v_parcelle,v_plantation,2,'beneficiaire','active',
     'ACTE DE REMISE D’ACTIF AGRICOLE A TITRE GRACIEUX - prophète Emmanuel.pdf',
     'Quote-part bénéficiaire de 2 ha.'),
    (v_bolou,v_parcelle,v_plantation,2,'proprietaire_beneficiaire','active',
     null,'Quote-part propriétaire-bénéficiaire de 2 ha.');

  update public.parcelles set surface_attribuee_ha=2,surface_disponible_ha=0,updated_at=now() where id=v_parcelle;
  update public.clients set total_hectares=2,nombre_plantations=1,updated_at=now() where id in(v_yao,v_bolou);
end $$;