-- Bénéficiaire particulier / actif agricole remis à titre gracieux
-- 2026-09-27

alter table public.proprietaires_terres
  alter column telephone drop not null;

create table if not exists public.beneficiaire_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  proprietaire_id uuid references public.proprietaires_terres(id) on delete set null,
  parcelle_id uuid references public.parcelles(id) on delete set null,
  plantation_id uuid references public.plantations(id) on delete set null,
  document_type text not null,
  libelle text not null,
  categorie text not null default 'beneficiaire',
  fichier_url text,
  storage_bucket text,
  storage_path text,
  statut text not null default 'a_ajouter',
  source_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_beneficiaire_documents_client on public.beneficiaire_documents(client_id);
create index if not exists idx_beneficiaire_documents_proprietaire on public.beneficiaire_documents(proprietaire_id);
create index if not exists idx_beneficiaire_documents_parcelle on public.beneficiaire_documents(parcelle_id);

alter table public.beneficiaire_documents enable row level security;

drop policy if exists "staff_manage_beneficiaire_documents" on public.beneficiaire_documents;
create policy "staff_manage_beneficiaire_documents"
on public.beneficiaire_documents for all to authenticated
using ((select public.is_staff(auth.uid())))
with check ((select public.is_staff(auth.uid())));

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
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_client public.clients%rowtype;
  v_owner public.proprietaires_terres%rowtype;
  v_parcelle public.parcelles%rowtype;
  v_plantation public.plantations%rowtype;
  v_doc jsonb;
  v_nom_famille text := nullif(trim(coalesce(p_beneficiaire->>'nom_famille','')), '');
  v_prenoms text := nullif(trim(coalesce(p_beneficiaire->>'prenoms','')), '');
  v_nom_complet text := coalesce(nullif(trim(coalesce(p_beneficiaire->>'nom_complet','')), ''), trim(concat_ws(' ',v_nom_famille,v_prenoms)));
begin
  if v_uid is not null and not public.is_staff(v_uid) then
    raise exception 'Accès réservé au personnel AgriCapital';
  end if;
  if v_nom_complet is null then raise exception 'Nom du bénéficiaire obligatoire'; end if;

  select * into v_owner from public.proprietaires_terres
  where (nullif(trim(coalesce(p_proprietaire->>'numero_piece','')), '') is not null and numero_piece=nullif(trim(p_proprietaire->>'numero_piece'),''))
     or lower(coalesce(nom_complet,''))=lower(nullif(trim(coalesce(p_proprietaire->>'nom_complet','')), ''))
  order by created_at limit 1;

  if v_owner.id is null then
    insert into public.proprietaires_terres (
      civilite,nom,prenoms,nom_complet,date_naissance,lieu_naissance,telephone,whatsapp,email,
      type_piece,numero_piece,date_delivrance_piece,domicile,district_id,region_id,departement_id,
      sous_prefecture_id,village,statut,type_proprietaire,statut_foncier,reference_cadastrale,notes,created_by,updated_by
    ) values (
      nullif(trim(p_proprietaire->>'civilite'),''),
      coalesce(nullif(trim(p_proprietaire->>'nom'),''),split_part(coalesce(p_proprietaire->>'nom_complet','Propriétaire'),' ',1)),
      nullif(trim(p_proprietaire->>'prenoms'),''),nullif(trim(p_proprietaire->>'nom_complet'),''),
      nullif(p_proprietaire->>'date_naissance','')::date,nullif(trim(p_proprietaire->>'lieu_naissance'),''),
      nullif(trim(p_proprietaire->>'telephone'),''),nullif(trim(p_proprietaire->>'whatsapp'),''),nullif(trim(p_proprietaire->>'email'),''),
      nullif(trim(p_proprietaire->>'type_piece'),''),nullif(trim(p_proprietaire->>'numero_piece'),''),
      nullif(p_proprietaire->>'date_delivrance_piece','')::date,nullif(trim(p_proprietaire->>'domicile'),''),
      nullif(p_proprietaire->>'district_id','')::uuid,nullif(p_proprietaire->>'region_id','')::uuid,
      nullif(p_proprietaire->>'departement_id','')::uuid,nullif(p_proprietaire->>'sous_prefecture_id','')::uuid,
      nullif(trim(p_proprietaire->>'village'),''),'actif','personne_physique',
      coalesce(nullif(trim(p_proprietaire->>'statut_foncier'),''),'coutumier'),
      nullif(trim(p_proprietaire->>'reference_cadastrale'),''),
      'Fiche propriétaire créée initialement avec les seules informations disponibles. Compléter ultérieurement.',
      v_uid,v_uid
    ) returning * into v_owner;
  else
    update public.proprietaires_terres set
      telephone=coalesce(nullif(trim(p_proprietaire->>'telephone'),''),telephone),
      whatsapp=coalesce(nullif(trim(p_proprietaire->>'whatsapp'),''),whatsapp),
      updated_by=v_uid,updated_at=now()
    where id=v_owner.id returning * into v_owner;
  end if;

  select * into v_parcelle from public.parcelles
  where (nullif(trim(coalesce(p_parcelle->>'code_parc','')), '') is not null and code_parc=nullif(trim(p_parcelle->>'code_parc'),''))
     or (nullif(trim(coalesce(p_parcelle->>'reference_convention','')), '') is not null and reference_convention=nullif(trim(p_parcelle->>'reference_convention'),''))
  order by created_at limit 1;

  if v_parcelle.id is null then
    insert into public.parcelles (
      proprietaire_id,nom,surface_totale_ha,surface_proprietaire_ha,surface_agricapital_ha,surface_attribuee_ha,surface_disponible_ha,
      district_id,region_id,departement_id,sous_prefecture_id,village,localisation_gps_lat,localisation_gps_lng,duree_convention,date_convention,
      statut,notes,created_by,updated_by,code_parc,reference_convention
    ) values (
      v_owner.id,coalesce(nullif(trim(p_parcelle->>'nom'),''),'Parcelle Zakaria'),
      coalesce((p_parcelle->>'surface_totale_ha')::numeric,0),
      coalesce((p_parcelle->>'surface_totale_ha')::numeric,0),0,0,coalesce((p_parcelle->>'surface_totale_ha')::numeric,0),
      nullif(p_parcelle->>'district_id','')::uuid,nullif(p_parcelle->>'region_id','')::uuid,
      nullif(p_parcelle->>'departement_id','')::uuid,nullif(p_parcelle->>'sous_prefecture_id','')::uuid,
      nullif(trim(p_parcelle->>'village'),''),
      nullif(p_parcelle->>'localisation_gps_lat','')::numeric,nullif(p_parcelle->>'localisation_gps_lng','')::numeric,
      nullif(p_parcelle->>'duree_convention','')::integer,nullif(p_parcelle->>'date_convention','')::date,
      'disponible',
      coalesce(nullif(trim(p_parcelle->>'notes'),''),'Actif agricole remis à titre gracieux : compléter les données foncières et annexes ultérieurement.'),
      v_uid,v_uid,nullif(trim(p_parcelle->>'code_parc'),''),nullif(trim(p_parcelle->>'reference_convention'),'')
    ) returning * into v_parcelle;
  else
    update public.parcelles set proprietaire_id=coalesce(v_owner.id,proprietaire_id),
      village=coalesce(nullif(trim(p_parcelle->>'village'),''),village),updated_by=v_uid,updated_at=now()
    where id=v_parcelle.id returning * into v_parcelle;
  end if;

  select * into v_client from public.clients
  where numero_piece=nullif(trim(p_beneficiaire->>'numero_piece'),'')
  order by created_at limit 1;

  if v_client.id is null then
    insert into public.clients (
      offre_id,parcelle_id,user_id,type_client,type_client_foncier,nom,nom_famille,prenoms,nom_complet,civilite,
      date_naissance,lieu_naissance,nationalite,type_piece,numero_piece,date_delivrance_piece,telephone,whatsapp,email,domicile,
      localite,statut,statut_global,compte_actif,total_hectares,nombre_plantations,paiement_initial_montant,montant_total_contrat,
      montant_promo_applique,parcours_code,contrat_acquisition_statut,contrat_accompagnement_statut,created_by,updated_by
    ) values (
      null,v_parcelle.id,null,'beneficiaire_particulier','EXT',v_nom_famille,v_nom_famille,v_prenoms,v_nom_complet,
      coalesce(nullif(trim(p_beneficiaire->>'civilite'),''),'M'),nullif(p_beneficiaire->>'date_naissance','')::date,
      nullif(trim(p_beneficiaire->>'lieu_naissance'),''),coalesce(nullif(trim(p_beneficiaire->>'nationalite'),''),'Ivoirienne'),
      nullif(trim(p_beneficiaire->>'type_piece'),''),nullif(trim(p_beneficiaire->>'numero_piece'),''),
      nullif(p_beneficiaire->>'date_delivrance_piece','')::date,nullif(trim(p_beneficiaire->>'telephone'),''),
      nullif(trim(p_beneficiaire->>'whatsapp'),''),nullif(trim(p_beneficiaire->>'email'),''),
      nullif(trim(p_beneficiaire->>'domicile'),''),nullif(trim(p_parcelle->>'village'),''),'actif','actif',false,
      coalesce((p_plantation->>'superficie_ha')::numeric,0),0,0,0,0,'beneficiaire_particulier',
      'non_requis','non_requis',v_uid,v_uid
    ) returning * into v_client;
  else
    update public.clients set parcelle_id=v_parcelle.id,type_client='beneficiaire_particulier',type_client_foncier='EXT',
      user_id=null,compte_actif=false,total_hectares=coalesce((p_plantation->>'superficie_ha')::numeric,total_hectares),
      updated_by=v_uid,updated_at=now()
    where id=v_client.id returning * into v_client;
  end if;

  select * into v_plantation from public.plantations
  where client_id=v_client.id and parcelle_id=v_parcelle.id order by created_at limit 1;

  if v_plantation.id is null then
    insert into public.plantations (
      client_id,parcelle_id,nom,nom_plantation,superficie_ha,superficie_activee,nombre_plants,densite_plants,
      region_id,departement_id,sous_prefecture_id,village,village_nom,localite,latitude,longitude,
      date_plantation,date_activation,statut,statut_global,type_culture,notes,notes_internes,created_by,updated_by
    ) values (
      v_client.id,v_parcelle.id,
      coalesce(nullif(trim(p_plantation->>'nom'),''),'Plantation YAO KONAN EMMANUEL — Zakaria'),
      coalesce(nullif(trim(p_plantation->>'nom_plantation'),''),'Plantation YAO KONAN EMMANUEL — Zakaria'),
      coalesce((p_plantation->>'superficie_ha')::numeric,2),
      coalesce((p_plantation->>'superficie_activee')::numeric,(p_plantation->>'superficie_ha')::numeric,2),
      coalesce((p_plantation->>'nombre_plants')::integer,0),coalesce((p_plantation->>'densite_plants')::integer,0),
      nullif(p_parcelle->>'region_id','')::uuid,nullif(p_parcelle->>'departement_id','')::uuid,nullif(p_parcelle->>'sous_prefecture_id','')::uuid,
      nullif(trim(p_parcelle->>'village'),''),nullif(trim(p_parcelle->>'village'),''),nullif(trim(p_parcelle->>'village'),''),
      nullif(p_parcelle->>'localisation_gps_lat','')::numeric,nullif(p_parcelle->>'localisation_gps_lng','')::numeric,
      nullif(p_plantation->>'date_plantation','')::date,nullif(p_plantation->>'date_activation','')::date,
      coalesce(nullif(trim(p_plantation->>'statut'),''),'en_cours'),coalesce(nullif(trim(p_plantation->>'statut_global'),''),'en_cours'),
      'Palmier à huile',
      'Actif agricole remis à titre gracieux. Les clauses juridiques restent dans l’acte de remise ; compléter les données techniques et annexes ultérieurement.',
      nullif(trim(p_plantation->>'notes_internes'),''),v_uid,v_uid
    ) returning * into v_plantation;
  else
    update public.plantations set superficie_ha=coalesce((p_plantation->>'superficie_ha')::numeric,superficie_ha),
      superficie_activee=coalesce((p_plantation->>'superficie_activee')::numeric,superficie_activee),updated_by=v_uid,updated_at=now()
    where id=v_plantation.id returning * into v_plantation;
  end if;

  for v_doc in select value from jsonb_array_elements(coalesce(p_documents,'[]'::jsonb)) loop
    if not exists (select 1 from public.beneficiaire_documents d where d.client_id=v_client.id and d.document_type=v_doc->>'document_type') then
      insert into public.beneficiaire_documents (
        client_id,proprietaire_id,parcelle_id,plantation_id,document_type,libelle,categorie,fichier_url,storage_bucket,storage_path,
        statut,source_reference,metadata,created_by,updated_by
      ) values (
        v_client.id,v_owner.id,v_parcelle.id,v_plantation.id,v_doc->>'document_type',
        coalesce(v_doc->>'libelle',v_doc->>'document_type'),coalesce(v_doc->>'categorie','beneficiaire'),
        nullif(v_doc->>'fichier_url',''),nullif(v_doc->>'storage_bucket',''),nullif(v_doc->>'storage_path',''),
        coalesce(nullif(v_doc->>'statut',''),'a_ajouter'),nullif(v_doc->>'source_reference',''),
        coalesce(v_doc->'metadata','{}'::jsonb),v_uid,v_uid
      );
    end if;
  end loop;

  return jsonb_build_object('client_id',v_client.id,'proprietaire_id',v_owner.id,'parcelle_id',v_parcelle.id,'plantation_id',v_plantation.id);
end;
$function$;

revoke execute on function public.register_beneficiaire_particulier(jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.register_beneficiaire_particulier(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
