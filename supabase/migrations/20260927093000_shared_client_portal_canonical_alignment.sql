-- 2026-09-27 : canonical shared DB alignment for CRM + client portal.
-- The production schema is canonicalized on clients / documents_acquisition / client_id.
-- No AgriPlan business object remains active.

create or replace function public.ensure_client_repayment_schedule(_client_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  c record; o record; t jsonb; idx int:=0; m int; monthly numeric; year_no int; start_date date;
begin
  select * into c from public.clients where id=_client_id;
  if c is null or c.offre_id is null or coalesce(c.mode_paiement,'echeancier')='comptant' then return; end if;
  select * into o from public.offres where id=c.offre_id;
  if o is null or exists(select 1 from public.paiements where client_id=_client_id and type_paiement='REDEVANCE') then return; end if;
  start_date:=coalesce(c.contrat_debut_at::date,current_date);
  for t in select value from jsonb_array_elements(coalesce(o.tranches_paiement,'[]'::jsonb)) loop
    if coalesce(t->>'type','') in ('paiement_initial','apres_trouaison','paiement_apres_trouaison') then continue; end if;
    if coalesce((t->>'mensualite_par_ha')::numeric,0)<=0 or coalesce((t->>'mois')::int,0)<=0 then continue; end if;
    year_no:=coalesce((t->>'annee')::int,1);
    monthly:=(t->>'mensualite_par_ha')::numeric*coalesce(c.total_hectares,0);
    for m in 1..(t->>'mois')::int loop
      idx:=idx+1;
      insert into public.paiements(client_id,type_paiement,statut,montant,montant_theorique,numero_echeance,date_echeance,annee,phase,est_depot_initial,est_paiement_initial)
      values(_client_id,'REDEVANCE','en_attente',monthly,monthly,idx,(start_date+(idx||' months')::interval)::date,year_no,'annee_'||year_no,false,false);
    end loop;
  end loop;
end $$;

create or replace function public.handle_paiement_valide()
returns trigger language plpgsql security definer set search_path=public as $$
declare c record; o record; v_active boolean;
begin
  if new.statut<>'valide' or coalesce(old.statut,'')='valide' then return new; end if;
  if coalesce(new.est_paiement_initial,new.est_depot_initial,false) then
    update public.clients set paiement_initial_paye_at=coalesce(paiement_initial_paye_at,now()),updated_at=now() where id=new.client_id;
    perform public.refresh_client_account_activation(new.client_id);
    select * into c from public.clients where id=new.client_id;
    v_active:=coalesce(c.compte_actif,false);
    if v_active then
      select * into o from public.offres where id=c.offre_id;
      update public.clients set da_paye_at=coalesce(da_paye_at,now()),contrat_debut_at=coalesce(contrat_debut_at,current_date),contrat_fin_at=coalesce(contrat_fin_at,current_date+(coalesce(o.duree_paiement_mois,36)||' months')::interval),phase_actuelle=coalesce(phase_actuelle,'annee_1'),prochaine_echeance=case when coalesce(c.mode_paiement,'echeancier')='comptant' then null else coalesce(prochaine_echeance,current_date+interval '1 month') end where id=new.client_id;
      perform public.ensure_client_repayment_schedule(new.client_id);
    end if;
  elsif new.type_paiement='REDEVANCE' then
    update public.clients c set prochaine_echeance=(select min(date_echeance) from public.paiements where client_id=c.id and type_paiement='REDEVANCE' and statut<>'valide'),phase_actuelle=case when not exists(select 1 from public.paiements where client_id=c.id and type_paiement='REDEVANCE' and statut<>'valide') then 'termine_construction' else c.phase_actuelle end where id=new.client_id;
  end if;
  return new;
end $$;

create or replace function public.trg_refresh_activation_payment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(new.est_paiement_initial,new.est_depot_initial,false) and lower(coalesce(new.statut,'')) in ('valide','paye','paid','success','successful','completed') then
    update public.clients set paiement_initial_paye_at=coalesce(paiement_initial_paye_at,now()),updated_at=now() where id=new.client_id;
    perform public.refresh_client_account_activation(new.client_id);
  end if;
  return new;
end $$;

create or replace function public.refresh_client_account_activation(_client_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_active boolean; v_secret text;
begin
  if auth.uid() is not null and not public.is_staff(auth.uid()) then raise exception 'Accès refusé'; end if;
  v_active:=public.client_should_be_active(_client_id);
  update public.clients set compte_actif=v_active,statut_global=case when v_active then 'actif' else statut_global end,updated_at=now() where id=_client_id;
  if v_active then
    insert into public.client_account_provision_outbox(client_id) values(_client_id) on conflict do nothing;
    perform public.ensure_client_repayment_schedule(_client_id);
    select decrypted_secret into v_secret from vault.decrypted_secrets where name='notification_cron_secret' limit 1;
    if v_secret is not null then
      perform net.http_post(url:='https://rfzfsmpsuempafhkqhra.supabase.co/functions/v1/provision-client-account',headers:=jsonb_build_object('Content-Type','application/json','x-agricapital-account-secret',v_secret),body:=jsonb_build_object('client_id',_client_id),timeout_milliseconds:=5000);
    end if;
  end if;
end $$;

drop trigger if exists trigger_validate_paiement on public.paiements;
drop trigger if exists validate_paiement_trigger on public.paiements;
drop trigger if exists trg_compute_jours_couverts on public.paiements;
drop trigger if exists trg_paiements_reverse_refund on public.paiements;

update public.notification_templates
set actif=false,updated_at=now()
where lower(code) like 'agriplan%' or lower(evenement) like 'agriplan%' or lower(nom) like '%agriplan%';
