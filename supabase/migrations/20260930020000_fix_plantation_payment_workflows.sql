-- Fixes discovered while exercising the technical and payment workflows.
-- No business offer is changed; these are generic workflow corrections.

create or replace function public.create_plantation_after_mise_en_terre()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_client public.clients%rowtype; v_parcelle public.parcelles%rowtype; v_existing uuid;
  v_surface numeric; v_density integer; v_date date; v_name text; v_role text:='beneficiaire';
  v_active boolean; v_actor uuid;
begin
  if new.type_intervention<>'mise_en_terre' or new.statut<>'realisee' then return new; end if;
  if new.client_id is null or new.parcelle_id is null then raise exception 'La mise en terre doit être rattachée à un Client et à une parcelle'; end if;
  select * into v_client from public.clients where id=new.client_id;
  if v_client.id is null then raise exception 'Client du parcours technique introuvable'; end if;
  select * into v_parcelle from public.parcelles where id=new.parcelle_id for update;
  if v_parcelle.id is null then raise exception 'Parcelle introuvable pour la mise en terre'; end if;

  v_surface:=greatest(0,coalesce(v_client.total_hectares,0));
  if v_client.type_client='beneficiaire_particulier' then
    select coalesce(max(ba.surface_attribuee_ha),v_surface),coalesce(max(ba.role_attribution),'beneficiaire')
      into v_surface,v_role
    from public.beneficiaire_attributions ba
    where ba.client_id=v_client.id and ba.parcelle_id=v_parcelle.id and ba.statut='active';
  end if;
  if v_surface<=0 then raise exception 'La superficie du dossier Client doit être renseignée avant la mise en terre'; end if;

  v_active:=coalesce(v_client.compte_actif,false) or v_client.paiement_initial_paye_at is not null or v_client.pi_paye_at is not null;
  v_density:=coalesce(v_parcelle.plantation_densite_plants,140); v_date:=new.date_intervention::date;
  v_name:='Plantation '||coalesce(nullif(v_client.nom_complet,''),v_client.id_unique);
  v_actor:=coalesce(auth.uid(),v_client.created_by);

  select p.id into v_existing from public.plantations p where p.client_id=v_client.id and p.parcelle_id=v_parcelle.id order by p.created_at desc limit 1;
  if v_existing is null then
    insert into public.plantations(client_id,parcelle_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,nombre_plants,densite_plants,district_id,region_id,departement_id,sous_prefecture_id,village,village_nom,localite,localisation_gps_lat,localisation_gps_lng,latitude,longitude,date_plantation,date_activation,statut,statut_global,type_culture,notes,created_by,updated_by)
    values(v_client.id,v_parcelle.id,v_role,v_name,v_name,v_surface,case when v_active then v_surface else 0 end,(v_surface*v_density)::integer,v_density,v_parcelle.district_id,v_parcelle.region_id,v_parcelle.departement_id,v_parcelle.sous_prefecture_id,v_parcelle.village,v_parcelle.village,v_parcelle.village,v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,v_date,case when v_active then v_date else null end,case when v_active then 'actif' else 'en_attente_pi' end,case when v_active then 'actif' else 'en_attente_pi' end,coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),case when v_active then 'Créée automatiquement après validation technique de la mise en terre.' else 'Créée automatiquement après validation technique de la mise en terre ; activation après validation du paiement initial.' end,v_actor,v_actor)
    returning id into v_existing;
  else
    update public.plantations set date_plantation=coalesce(date_plantation,v_date),date_activation=case when v_active then coalesce(date_activation,v_date) else null end,superficie_activee=case when v_active then superficie_ha else 0 end,statut=case when v_active then 'actif' else 'en_attente_pi' end,statut_global=case when v_active then 'actif' else 'en_attente_pi' end,updated_at=now() where id=v_existing;
  end if;

  update public.clients set parcelle_id=coalesce(parcelle_id,v_parcelle.id),nombre_plantations=(select count(*) from public.plantations where client_id=v_client.id and statut not in ('archive','supprime')),phase_actuelle='plantation',updated_at=now() where id=v_client.id;

  if v_client.type_client='beneficiaire_particulier' then
    insert into public.beneficiaire_attributions(client_id,parcelle_id,plantation_id,surface_attribuee_ha,role_attribution,statut,notes)
    select v_client.id,v_parcelle.id,v_existing,v_surface,v_role,'active','Rattachement automatique de la plantation individuelle à la parcelle.'
    where not exists(select 1 from public.beneficiaire_attributions ba where ba.client_id=v_client.id and ba.parcelle_id=v_parcelle.id and ba.plantation_id=v_existing and ba.statut='active');
  end if;
  return new;
end;
$function$;

create or replace function public.compute_commission_for_paiement(p_paiement_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare p record; v_s record; v_com uuid; v_taux numeric:=0; v_montant numeric:=0; v_type text:='recouvrement'; v_annee int:=1; v_mois int;
begin
  select * into p from public.paiements where id=p_paiement_id;
  if not found or coalesce(p.statut,'')<>'valide' then return; end if;
  select s.id,s.created_by,s.total_hectares,s.created_at into v_s from public.clients s where s.id=p.client_id;
  if not found or v_s.created_by is null then return; end if;
  if not exists(select 1 from public.user_roles ur where ur.user_id=v_s.created_by and lower(ur.role::text) like '%commercial%') then return; end if;
  v_com:=v_s.created_by;
  v_mois:=greatest(0,(extract(year from age(p.date_paiement,coalesce(v_s.created_at,now())))*12+extract(month from age(p.date_paiement,coalesce(v_s.created_at,now()))))::int);
  if v_mois<12 then v_annee:=1; elsif v_mois<24 then v_annee:=2; else v_annee:=3; end if;
  if lower(coalesce(p.type_paiement,'')) in ('depot_initial','pi') then
    v_type:='signature';
    select montant into v_montant from public.grille_remuneration where role_cible='commercial' and type_remuneration='commission_ha_signature' and actif limit 1;
    v_montant:=coalesce(v_montant,10000)*coalesce(v_s.total_hectares,1);
  elsif lower(coalesce(p.type_paiement,''))='cash' then
    v_type:='cash';
    select taux_pourcentage into v_taux from public.grille_remuneration where role_cible='commercial' and type_remuneration='commission_cash' and actif limit 1;
    v_montant:=p.montant*coalesce(v_taux,2)/100.0;
  else
    select taux_pourcentage into v_taux from public.grille_remuneration where role_cible='commercial' and type_remuneration='commission_recouvrement' and annee_application=v_annee and actif limit 1;
    v_montant:=p.montant*coalesce(v_taux,1)/100.0;
  end if;
  if v_montant>0 then
    insert into public.commissions(commercial_id,paiement_id,client_id,type_commission,montant,taux_applique,annee_contrat,statut) values(v_com,p.id,p.client_id,v_type,v_montant,coalesce(v_taux,0),v_annee,'calculee') on conflict do nothing;
  end if;
end;
$function$;

create or replace function public.ensure_client_repayment_schedule(_client_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c record; e record; idx int:=0; start_date date; custom jsonb; monthly jsonb; custom_enabled boolean:=false; monthly_amount numeric:=0; monthly_count integer:=0; defer_months integer:=0;
begin
  select * into c from public.clients where id=_client_id;
  if c is null or c.offre_id is null or coalesce(c.mode_paiement,'echeancier')='comptant' then return; end if;
  custom:=coalesce(c.paiement_personnalise,'{}'::jsonb); monthly:=coalesce(custom->'mensualite','{}'::jsonb);
  custom_enabled:=coalesce((monthly->>'active')::boolean,false); monthly_amount:=coalesce((monthly->>'montant')::numeric,0);
  monthly_count:=greatest(0,coalesce((monthly->>'nombre')::integer,0)); defer_months:=greatest(0,coalesce((monthly->>'decalage_mois')::integer,0));
  if custom ? 'mensualite' then
    if not custom_enabled or monthly_amount<=0 or monthly_count<=0 then return; end if;
    if exists(select 1 from public.paiements where client_id=_client_id and type_paiement='REDEVANCE') then return; end if;
    start_date:=coalesce(c.contrat_debut_at::date,current_date);
    for idx in 1..monthly_count loop
      insert into public.paiements(client_id,type_paiement,statut,montant,montant_theorique,numero_echeance,date_echeance,annee,phase,est_depot_initial,est_paiement_initial,metadata)
      values(_client_id,'REDEVANCE','en_attente',monthly_amount,monthly_amount,idx,(start_date+((defer_months+idx-1)||' months')::interval)::date,greatest(1,ceil(idx/12.0)::int),'personnalise',false,false,jsonb_build_object('echeancier_personnalise',true,'montant',monthly_amount,'numero',idx,'total',monthly_count,'decalage_mois',defer_months));
    end loop;
    return;
  end if;
  if exists(select 1 from public.paiements where client_id=_client_id and type_paiement='REDEVANCE') then return; end if;
  start_date:=coalesce(c.contrat_debut_at::date,current_date);
  for e in select * from public.offre_echeancier_effectif(c.offre_id) loop
    for idx2 in 1..e.mois loop
      idx:=idx+1;
      insert into public.paiements(client_id,type_paiement,statut,montant,montant_theorique,numero_echeance,date_echeance,annee,phase,est_depot_initial,est_paiement_initial)
      values(_client_id,'REDEVANCE','en_attente',e.mensualite_par_ha*coalesce(c.total_hectares,0),e.mensualite_par_ha*coalesce(c.total_hectares,0),idx,(start_date+(idx||' months')::interval)::date,e.annee,'annee_'||e.annee,false,false);
    end loop;
  end loop;
end;
$$;
