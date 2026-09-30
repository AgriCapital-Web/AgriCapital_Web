-- Client-specific payment exceptions and global person-name normalization.
-- PalmTerroir offers remain canonical; exceptions live on the client record.

alter table public.clients
  add column if not exists paiement_personnalise jsonb not null default '{}'::jsonb,
  add column if not exists profession text,
  add column if not exists nom_pere text,
  add column if not exists nom_mere text,
  add column if not exists contact_urgence_nom text,
  add column if not exists contact_urgence_telephone text,
  add column if not exists lieu_delivrance_piece text,
  add column if not exists piece_validite_at date;

create or replace function public.normalize_person_names()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'clients' then
    new.nom_famille := upper(trim(coalesce(nullif(new.nom_famille,''), new.nom,'')));
    new.nom := new.nom_famille;
    new.prenoms := upper(trim(coalesce(new.prenoms,'')));
    new.nom_complet := upper(trim(concat_ws(' ', nullif(new.nom_famille,''), nullif(new.prenoms,''))));
    new.profession := nullif(upper(trim(coalesce(new.profession,''))), '');
    new.nom_pere := nullif(upper(trim(coalesce(new.nom_pere,''))), '');
    new.nom_mere := nullif(upper(trim(coalesce(new.nom_mere,''))), '');
    new.contact_urgence_nom := nullif(upper(trim(coalesce(new.contact_urgence_nom,''))), '');
  elsif tg_table_name = 'leads' then
    new.nom := upper(trim(coalesce(new.nom,'')));
    new.prenoms := upper(trim(coalesce(new.prenoms,'')));
  elsif tg_table_name in ('client_cotitulaires_mandataires','cotitulaires_mandataires') then
    new.nom := upper(trim(coalesce(new.nom,'')));
    new.prenoms := upper(trim(coalesce(new.prenoms,'')));
  elsif tg_table_name = 'proprietaires_terres' then
    new.nom := upper(trim(coalesce(new.nom,'')));
    new.prenoms := upper(trim(coalesce(new.prenoms,'')));
    new.nom_complet := upper(trim(coalesce(nullif(new.nom_complet,''), concat_ws(' ', nullif(new.nom,''), nullif(new.prenoms,'')))));
    new.nom_pere := nullif(upper(trim(coalesce(new.nom_pere,''))), '');
    new.nom_mere := nullif(upper(trim(coalesce(new.nom_mere,''))), '');
    new.denomination_sociale := nullif(upper(trim(coalesce(new.denomination_sociale,''))), '');
    new.nom_representant := nullif(upper(trim(coalesce(new.nom_representant,''))), '');
  elsif tg_table_name = 'profiles' then
    new.nom_complet := upper(trim(coalesce(new.nom_complet,'')));
    new.contact_urgence_nom := nullif(upper(trim(coalesce(new.contact_urgence_nom,''))), '');
    new.contact_urgence_prenom := nullif(upper(trim(coalesce(new.contact_urgence_prenom,''))), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clients_normalize_person_names on public.clients;
create trigger trg_clients_normalize_person_names
before insert or update of nom_famille,nom,prenoms,nom_complet,profession,nom_pere,nom_mere,contact_urgence_nom
on public.clients for each row execute function public.normalize_person_names();

drop trigger if exists trg_leads_normalize_person_names on public.leads;
create trigger trg_leads_normalize_person_names
before insert or update of nom,prenoms
on public.leads for each row execute function public.normalize_person_names();

drop trigger if exists trg_client_cotitulaires_normalize_person_names on public.client_cotitulaires_mandataires;
create trigger trg_client_cotitulaires_normalize_person_names
before insert or update of nom,prenoms
on public.client_cotitulaires_mandataires for each row execute function public.normalize_person_names();

drop trigger if exists trg_cotitulaires_normalize_person_names on public.cotitulaires_mandataires;
create trigger trg_cotitulaires_normalize_person_names
before insert or update of nom,prenoms
on public.cotitulaires_mandataires for each row execute function public.normalize_person_names();

drop trigger if exists trg_proprietaires_normalize_person_names on public.proprietaires_terres;
create trigger trg_proprietaires_normalize_person_names
before insert or update of nom,prenoms,nom_complet,nom_pere,nom_mere,denomination_sociale,nom_representant
on public.proprietaires_terres for each row execute function public.normalize_person_names();

drop trigger if exists trg_profiles_normalize_person_names on public.profiles;
create trigger trg_profiles_normalize_person_names
before insert or update of nom_complet,contact_urgence_nom,contact_urgence_prenom
on public.profiles for each row execute function public.normalize_person_names();

create or replace function public.ensure_client_repayment_schedule(_client_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c record;
  e record;
  idx int := 0;
  start_date date;
  custom jsonb;
  monthly jsonb;
  custom_enabled boolean := false;
  monthly_amount numeric := 0;
  monthly_count integer := 0;
  defer_months integer := 0;
begin
  select * into c from public.clients where id=_client_id;
  if c is null or c.offre_id is null or coalesce(c.mode_paiement,'echeancier')='comptant' then return; end if;

  custom := coalesce(c.paiement_personnalise,'{}'::jsonb);
  monthly := coalesce(custom->'mensualite','{}'::jsonb);
  custom_enabled := coalesce((monthly->>'active')::boolean,false);
  monthly_amount := coalesce((monthly->>'montant')::numeric,0);
  monthly_count := greatest(0,coalesce((monthly->>'nombre')::integer,0));
  defer_months := greatest(0,coalesce((monthly->>'decalage_mois')::integer,0));

  if custom ? 'mensualite' then
    if not custom_enabled or monthly_amount <= 0 or monthly_count <= 0 then return; end if;
    if exists(select 1 from public.paiements where client_id=_client_id and type_paiement='REDEVANCE') then return; end if;

    start_date := coalesce(c.contrat_debut_at::date,current_date);
    for idx in 1..monthly_count loop
      insert into public.paiements(
        client_id,type_paiement,statut,montant,montant_theorique,numero_echeance,
        date_echeance,annee,phase,est_depot_initial,est_paiement_initial,metadata
      )
      values(
        _client_id,'REDEVANCE','en_attente',monthly_amount,monthly_amount,idx,
        (start_date+((defer_months+idx)||' months')::interval)::date,
        greatest(1,ceil(idx/12.0)::int),'personnalise',false,false,
        jsonb_build_object(
          'echeancier_personnalise',true,
          'montant',monthly_amount,
          'numero',idx,
          'total',monthly_count,
          'decalage_mois',defer_months
        )
      );
    end loop;
    return;
  end if;

  if exists(select 1 from public.paiements where client_id=_client_id and type_paiement='REDEVANCE') then return; end if;
  start_date := coalesce(c.contrat_debut_at::date,current_date);

  for e in select * from public.offre_echeancier_effectif(c.offre_id) loop
    for idx2 in 1..e.mois loop
      idx:=idx+1;
      insert into public.paiements(
        client_id,type_paiement,statut,montant,montant_theorique,numero_echeance,
        date_echeance,annee,phase,est_depot_initial,est_paiement_initial
      )
      values(
        _client_id,'REDEVANCE','en_attente',
        e.mensualite_par_ha*coalesce(c.total_hectares,0),
        e.mensualite_par_ha*coalesce(c.total_hectares,0),
        idx,(start_date+(idx||' months')::interval)::date,e.annee,
        'annee_'||e.annee,false,false
      );
    end loop;
  end loop;
end;
$$;

create or replace function public.portal_client_daily_rate(_client_id uuid,_at_date date default current_date)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_client record;
  v_custom jsonb;
  v_monthly jsonb;
  v_start date;
  v_defer integer;
  v_amount numeric;
  v_active boolean;
  v_contract_day integer;
  v_cursor integer:=0;
  v_months integer;
  v_rate numeric:=0;
  v_tranche jsonb;
begin
  select c.*,o.tranches_paiement,o.contribution_mensuelle_par_ha
    into v_client
  from public.clients c left join public.offres o on o.id=c.offre_id
  where c.id=_client_id;

  if v_client is null then return 0; end if;

  v_custom:=coalesce(v_client.paiement_personnalise,'{}'::jsonb);
  if v_custom ? 'mensualite' then
    v_monthly:=coalesce(v_custom->'mensualite','{}'::jsonb);
    v_active:=coalesce((v_monthly->>'active')::boolean,false);
    v_amount:=coalesce((v_monthly->>'montant')::numeric,0);
    v_defer:=greatest(0,coalesce((v_monthly->>'decalage_mois')::integer,0));
    v_start:=(coalesce(v_client.contrat_debut_at,current_date)+(v_defer||' months')::interval)::date;
    if not v_active or v_amount<=0 or _at_date<v_start then return 0; end if;
    return greatest(v_amount/coalesce(nullif(v_client.total_hectares,0),1),0)/30;
  end if;

  if v_client.contrat_debut_at is null then return coalesce(v_client.taux_journalier_ha,0); end if;
  v_contract_day:=greatest(0,(_at_date-v_client.contrat_debut_at));

  if jsonb_typeof(v_client.tranches_paiement)='array' then
    for v_tranche in select value from jsonb_array_elements(v_client.tranches_paiement) loop
      v_months:=coalesce((v_tranche->>'mois')::integer,0);
      if coalesce(v_tranche->>'type','')='paiement_initial' then continue; end if;
      if v_months<=0 then continue; end if;
      if v_contract_day<v_cursor+v_months*30 then
        v_rate:=coalesce((v_tranche->>'mensualite_par_ha')::numeric,0)/30;
        exit;
      end if;
      v_cursor:=v_cursor+v_months*30;
    end loop;
  end if;

  if v_rate<=0 then v_rate:=coalesce(v_client.contribution_mensuelle_par_ha,0)/30; end if;
  return greatest(v_rate,0);
end;
$$;

create or replace function public.portal_quote_payment(_client_id uuid,_plantation_id uuid,_days integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_client record;
  v_plantation record;
  v_offer record;
  v_custom jsonb;
  v_monthly jsonb;
  v_start date;
  v_defer integer;
  v_amount_monthly numeric;
  v_count integer;
  v_active boolean;
  v_remaining integer;
  v_offset integer;
  v_start_date date;
  v_end_date date;
  v_amount numeric;
begin
  if _days is null or _days<=0 then raise exception 'Le nombre de jours doit être supérieur à 0'; end if;

  select c.id,c.contrat_debut_at,c.jours_payes,c.jours_contrat_total,c.total_hectares,c.offre_id,c.paiement_personnalise
    into v_client
  from public.clients c
  where c.id=_client_id and c.compte_actif=true and c.statut_global='actif';

  if v_client is null then raise exception 'Client introuvable ou inactif'; end if;

  select p.id,p.client_id,p.superficie_activee,p.date_activation
    into v_plantation
  from public.plantations p
  where p.id=_plantation_id and p.client_id=_client_id and coalesce(p.superficie_activee,0)>0;

  if v_plantation is null then raise exception 'Plantation introuvable ou inactive'; end if;

  v_custom:=coalesce(v_client.paiement_personnalise,'{}'::jsonb);

  if v_custom ? 'mensualite' then
    v_monthly:=coalesce(v_custom->'mensualite','{}'::jsonb);
    v_active:=coalesce((v_monthly->>'active')::boolean,false);
    v_amount_monthly:=coalesce((v_monthly->>'montant')::numeric,0);
    v_count:=greatest(0,coalesce((v_monthly->>'nombre')::integer,0));
    v_defer:=greatest(0,coalesce((v_monthly->>'decalage_mois')::integer,0));
    v_start:=(coalesce(v_client.contrat_debut_at,current_date)+(v_defer||' months')::interval)::date;

    if not v_active or v_amount_monthly<=0 or v_count<=0 then
      return jsonb_build_object(
        'montant',0,'jours',0,'periode_debut',v_start,'periode_fin',null,
        'segments','[]'::jsonb,'personnalise',true
      );
    end if;

    v_remaining:=least(_days,v_count*30);
    v_start_date:=v_start;
    v_end_date:=v_start_date+(v_remaining-1);
    v_amount:=(v_amount_monthly/30)*v_remaining*coalesce(v_plantation.superficie_activee,0);

    return jsonb_build_object(
      'montant',round(v_amount,2),
      'jours',v_remaining,
      'periode_debut',v_start_date,
      'periode_fin',v_end_date,
      'segments','[]'::jsonb,
      'personnalise',true
    );
  end if;

  select o.* into v_offer from public.offres o where o.id=v_client.offre_id;
  if v_offer is null then raise exception 'Offre du client introuvable'; end if;

  v_offset:=greatest(coalesce(v_client.jours_payes,0),0);
  v_remaining:=least(
    _days,
    greatest(coalesce(v_client.jours_contrat_total,coalesce(v_offer.duree_paiement_mois,0)*30)-v_offset,0)
  );

  if v_remaining<=0 then
    return jsonb_build_object(
      'montant',0,'jours',0,
      'periode_debut',(coalesce(v_client.contrat_debut_at,current_date)+v_offset),
      'periode_fin',null,'segments','[]'::jsonb
    );
  end if;

  v_start_date:=coalesce(v_client.contrat_debut_at,current_date)+v_offset;
  v_end_date:=v_start_date+(v_remaining-1);
  v_amount:=(coalesce(v_offer.contribution_mensuelle_par_ha,0)/30)
    *v_remaining*coalesce(v_plantation.superficie_activee,0);

  return jsonb_build_object(
    'montant',round(v_amount,2),
    'jours',v_remaining,
    'periode_debut',v_start_date,
    'periode_fin',v_end_date,
    'segments','[]'::jsonb
  );
end;
$$;
