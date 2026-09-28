-- RPC bénéficiaire particulier conforme au modèle Planté-Partagé.
-- p_parcelle.surface_totale_ha = superficie physique de la parcelle.
-- p_plantation.superficie_ha = quote-part du bénéficiaire.
-- Le système calcule automatiquement la quote-part propriétaire équivalente.
-- 2026-09-29

create or replace function public.register_beneficiaire_particulier(
  p_beneficiaire jsonb,
  p_proprietaire jsonb,
  p_parcelle jsonb,
  p_plantation jsonb,
  p_documents jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_client public.clients%rowtype;
  v_owner public.proprietaires_terres%rowtype;
  v_parcelle public.parcelles%rowtype;
  v_plantation public.plantations%rowtype;
  v_doc jsonb;
  v_physical numeric:=coalesce((p_parcelle->>'surface_totale_ha')::numeric,0);
  v_beneficiary_surface numeric:=coalesce((p_plantation->>'superficie_ha')::numeric,0);
  v_owner_surface numeric;
  v_nom_famille text:=nullif(trim(coalesce(p_beneficiaire->>'nom_famille','')),'');
  v_prenoms text:=nullif(trim(coalesce(p_beneficiaire->>'prenoms','')),'');
  v_nom_complet text:=coalesce(nullif(trim(coalesce(p_beneficiaire->>'nom_complet','')),''),trim(concat_ws(' ',v_nom_famille,v_prenoms)));
begin
  if v_uid is not null and not public.is_staff(v_uid) then
    raise exception 'Accès réservé au personnel AgriCapital';
  end if;
  if v_nom_complet is null then raise exception 'Nom du bénéficiaire obligatoire'; end if;
  if v_physical<=0 or v_beneficiary_surface<=0 then raise exception 'Les superficies doivent être positives'; end if;
  if v_beneficiary_surface > v_physical/2 then
    raise exception 'La quote-part bénéficiaire ne peut pas dépasser 50%% de la parcelle';
  end if;
  v_owner_surface:=v_physical/2;

  select * into v_owner from public.proprietaires_terres
  where (nullif(trim(coalesce(p_proprietaire->>'numero_piece','')),'') is not null and numero_piece=nullif(trim(p_proprietaire->>'numero_piece'),''))
     or lower(coalesce(nom_complet,''))=lower(nullif(trim(coalesce(p_proprietaire->>'nom_complet','')),''))
  order by created_at limit 1;

  if v_owner.id is null then
    insert into public.proprietaires_terres(
      civilite,nom,prenoms,nom_complet,date_naissance,lieu_naissance,telephone,whatsapp,email,
      type_piece,numero_piece,date_delivrance_piece,domicile,district_id,region_id,departement_id,
      sous_prefecture_id,village,statut,type_proprietaire,statut_foncier,reference_cadastrale,notes,created_by,updated_by,
      part_proprietaire_pct,part_agricapital_pct,part_proprietaire_ha,part_agricapital_ha,surface_totale_declaree_ha
    ) values(
      nullif(trim(p_proprietaire->>'civilite'),''),
      coalesce(nullif(trim(p_proprietaire->>'nom'),''),split_part(coalesce(p_proprietaire->>'nom_complet','Propriétaire'),' ',1)),
      nullif(trim(p_proprietaire->>'prenoms'),''),nullif(trim(p_proprietaire->>'nom_complet'),''),
      nullif(p_proprietaire->>'date_naissance','')::date,nullif(trim(p_proprietaire->>'lieu_naissance'),''),
      nullif(trim(p_proprietaire->>'telephone'),''),
      nullif(trim(p_proprietaire->>'whatsapp'),''),
      nullif(trim(p_proprietaire->>'email'),''),
      nullif(trim(p_proprietaire->>'type_piece'),''),
      nullif(trim(p_proprietaire->>'numero_piece'),''),
      nullif(p_proprietaire->>'date_delivrance_piece','')::date,
      nullif(trim(p_proprietaire->>'domicile'),''),
      nullif(p_proprietaire->>'district_id','')::uuid,
      nullif(p_proprietaire->>'region_id','')::uuid,
      nullif(p_proprietaire->>'departement_id','')::uuid,
      nullif(p_proprietaire->>'sous_prefecture_id','')::uuid,
      nullif(trim(p_proprietaire->>'village'),''),
      'actif','personne_physique',coalesce(nullif(trim(p_proprietaire->>'statut_foncier'),''),'coutumier'),
      nullif(trim(p_proprietaire->>'reference_cadastrale'),''),
      'Fiche propriétaire créée avec les informations disponibles.',
      v_uid,v_uid,50,50,v_owner_surface,v_owner_surface,v_physical
    ) returning * into v_owner;
  else
    update public.proprietaires_terres
    set telephone=coalesce(nullif(trim(p_proprietaire->>'telephone'),''),telephone),
        whatsapp=coalesce(nullif(trim(p_proprietaire->>'whatsapp'),''),whatsapp),
        part_proprietaire_pct=50,part_agricapital_pct=50,
        part_proprietaire_ha=v_owner_surface,part_agricapital_ha=v_owner_surface,
        surface_totale_declaree_ha=v_physical,updated_by=v_uid,updated_at=now()
    where id=v_owner.id returning * into v_owner;
  end if;

  select * into v_parcelle from public.parcelles
  where (nullif(trim(coalesce(p_parcelle->>'code_parc','')),'') is not null and code_parc=nullif(trim(p_parcelle->>'code_parc'),''))
     or (nullif(trim(coalesce(p_parcelle->>'reference_convention','')),'') is not null and reference_convention=nullif(trim(p_parcelle->>'reference_convention'),''))
  order by created_at limit 1;

  if v_parcelle.id is null then
    insert into public.parcelles(
      proprietaire_id,nom,surface_totale_ha,surface_proprietaire_ha,surface_agricapital_ha,
      surface_attribuee_ha,surface_disponible_ha,mode_surface,district_id,region_id,departement_id,
      sous_prefecture_id,village,localisation_gps_lat,localisation_gps_lng,duree_convention,date_convention,
      statut,notes,created_by,updated_by,code_parc,reference_convention,
      plantation_partagee_activee,plantation_surface_cible_ha,plantation_type_culture,plantation_densite_plants
    ) values(
      v_owner.id,
      coalesce(nullif(trim(p_parcelle->>'nom'),''),'Parcelle Planté-Partagé'),
      v_physical,v_owner_surface,v_owner_surface,v_beneficiary_surface,
      greatest(0,v_owner_surface-v_beneficiary_surface),'foncier',
      nullif(p_parcelle->>'district_id','')::uuid,nullif(p_parcelle->>'region_id','')::uuid,
      nullif(p_parcelle->>'departement_id','')::uuid,nullif(p_parcelle->>'sous_prefecture_id','')::uuid,
      nullif(trim(p_parcelle->>'village'),''),
      nullif(p_parcelle->>'localisation_gps_lat','')::numeric,
      nullif(p_parcelle->>'localisation_gps_lng','')::numeric,
      nullif(p_parcelle->>'duree_convention','')::integer,
      nullif(p_parcelle->>'date_convention','')::date,
      case when v_beneficiary_surface>=v_owner_surface then 'partiellement_attribuee' else 'disponible' end,
      coalesce(nullif(trim(p_parcelle->>'notes'),''),'Actif agricole partagé.'),
      v_uid,v_uid,nullif(trim(p_parcelle->>'code_parc'),''),nullif(trim(p_parcelle->>'reference_convention'),''),
      true,v_physical,'Palmier à huile',coalesce(nullif(p_parcelle->>'plantation_densite_plants','')::integer,140)
    ) returning * into v_parcelle;
  else
    update public.parcelles
    set proprietaire_id=v_owner.id,surface_totale_ha=v_physical,surface_proprietaire_ha=v_owner_surface,
        surface_agricapital_ha=v_owner_surface,surface_attribuee_ha=v_beneficiary_surface,
        surface_disponible_ha=greatest(0,v_owner_surface-v_beneficiary_surface),mode_surface='foncier',
        village=coalesce(nullif(trim(p_parcelle->>'village'),''),village),
        plantation_partagee_activee=true,plantation_surface_cible_ha=v_physical,
        plantation_type_culture='Palmier à huile',plantation_densite_plants=coalesce(plantation_densite_plants,140),
        updated_by=v_uid,updated_at=now()
    where id=v_parcelle.id returning * into v_parcelle;
  end if;

  select * into v_client from public.clients
  where numero_piece=nullif(trim(p_beneficiaire->>'numero_piece'),'')
  order by created_at limit 1;

  if v_client.id is null then
    insert into public.clients(
      offre_id,parcelle_id,user_id,type_client,type_client_foncier,nom,nom_famille,prenoms,nom_complet,civilite,
      date_naissance,lieu_naissance,nationalite,type_piece,numero_piece,date_delivrance_piece,telephone,whatsapp,email,
      domicile,localite,statut,statut_global,compte_actif,total_hectares,nombre_plantations,
      paiement_initial_montant,montant_total_contrat,montant_promo_applique,parcours_code,
      contrat_acquisition_statut,contrat_accompagnement_statut,created_by,updated_by
    ) values(
      null,v_parcelle.id,null,'beneficiaire_particulier','EXT',
      v_nom_famille,v_nom_famille,v_prenoms,v_nom_complet,
      coalesce(nullif(trim(p_beneficiaire->>'civilite'),''),'M'),
      nullif(p_beneficiaire->>'date_naissance','')::date,
      nullif(trim(p_beneficiaire->>'lieu_naissance'),''),
      coalesce(nullif(trim(p_beneficiaire->>'nationalite'),''),'Ivoirienne'),
      nullif(trim(p_beneficiaire->>'type_piece'),''),
      nullif(trim(p_beneficiaire->>'numero_piece'),''),
      nullif(p_beneficiaire->>'date_delivrance_piece','')::date,
      nullif(trim(p_beneficiaire->>'telephone'),''),
      nullif(trim(p_beneficiaire->>'whatsapp'),''),
      nullif(trim(p_beneficiaire->>'email'),''),
      nullif(trim(p_beneficiaire->>'domicile'),''),
      nullif(trim(p_parcelle->>'village'),''),
      'actif','actif',false,v_beneficiary_surface,1,0,0,0,
      'beneficiaire_particulier','non_requis','non_requis',v_uid,v_uid
    ) returning * into v_client;
  else
    update public.clients
    set parcelle_id=v_parcelle.id,type_client='beneficiaire_particulier',type_client_foncier='EXT',
        user_id=null,compte_actif=false,total_hectares=v_beneficiary_surface,nombre_plantations=1,
        paiement_initial_montant=0,montant_total_contrat=0,parcours_code='beneficiaire_particulier',
        contrat_acquisition_statut='non_requis',contrat_accompagnement_statut='non_requis',
        updated_by=v_uid,updated_at=now()
    where id=v_client.id returning * into v_client;
  end if;

  select * into v_plantation from public.plantations
  where parcelle_id=v_parcelle.id and role_attribution='partage'
  order by created_at limit 1;

  if v_plantation.id is null then
    insert into public.plantations(
      client_id,parcelle_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,
      nombre_plants,densite_plants,region_id,departement_id,sous_prefecture_id,village,village_nom,localite,
      latitude,longitude,date_plantation,date_activation,statut,statut_global,type_culture,notes,created_by,updated_by
    ) values(
      null,v_parcelle.id,'partage',
      coalesce(nullif(trim(p_plantation->>'nom'),''),'Plantation partagée — '||coalesce(v_parcelle.village,'Parcelle')),
      coalesce(nullif(trim(p_plantation->>'nom_plantation'),''),'Plantation partagée — '||coalesce(v_parcelle.village,'Parcelle')),
      v_physical,v_physical,(v_physical*coalesce(v_parcelle.plantation_densite_plants,140))::integer,
      coalesce(v_parcelle.plantation_densite_plants,140),
      v_parcelle.region_id,v_parcelle.departement_id,v_parcelle.sous_prefecture_id,
      v_parcelle.village,v_parcelle.village,v_parcelle.village,
      v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
      nullif(p_plantation->>'date_plantation','')::date,
      nullif(p_plantation->>'date_activation','')::date,
      coalesce(nullif(trim(p_plantation->>'statut'),''),'active'),
      coalesce(nullif(trim(p_plantation->>'statut_global'),''),'active'),
      'Palmier à huile',
      'Actif agricole partagé de '||v_physical||' ha. Quote-part bénéficiaire : '||v_beneficiary_surface||' ha.',
      v_uid,v_uid
    ) returning * into v_plantation;
  end if;

  delete from public.beneficiaire_attributions where client_id=v_client.id and parcelle_id=v_parcelle.id;
  insert into public.beneficiaire_attributions(
    client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,reference_acte,notes,created_by,updated_by
  ) values(
    v_client.id,v_parcelle.id,v_plantation.id,v_beneficiary_surface,'beneficiaire','active',
    nullif(p_plantation->>'reference_acte',''),
    'Bénéficiaire particulier sans paiement : quote-part dans un actif agricole partagé.',
    v_uid,v_uid
  );

  for v_doc in select value from jsonb_array_elements(coalesce(p_documents,'[]'::jsonb)) loop
    if not exists(
      select 1 from public.beneficiaire_documents d
      where d.client_id=v_client.id and d.document_type=v_doc->>'document_type'
    ) then
      insert into public.beneficiaire_documents(
        client_id,proprietaire_id,parcelle_id,plantation_id,document_type,libelle,categorie,
        fichier_url,storage_bucket,storage_path,statut,source_reference,metadata,created_by,updated_by
      ) values(
        v_client.id,v_owner.id,v_parcelle.id,v_plantation.id,v_doc->>'document_type',
        coalesce(v_doc->>'libelle',v_doc->>'document_type'),coalesce(v_doc->>'categorie','beneficiaire'),
        nullif(v_doc->>'fichier_url',''),nullif(v_doc->>'storage_bucket',''),nullif(v_doc->>'storage_path',''),
        coalesce(nullif(v_doc->>'statut',''),'a_ajouter'),nullif(v_doc->>'source_reference',''),
        coalesce(v_doc->'metadata','{}'::jsonb'),v_uid,v_uid
      );
    end if;
  end loop;

  return jsonb_build_object(
    'client_id',v_client.id,'proprietaire_id',v_owner.id,'parcelle_id',v_parcelle.id,
    'plantation_id',v_plantation.id,'surface_parcelle_ha',v_physical,
    'surface_beneficiaire_ha',v_beneficiary_surface,'surface_proprietaire_ha',v_owner_surface
  );
end;
$function$;

revoke execute on function public.register_beneficiaire_particulier(jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.register_beneficiaire_particulier(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
