-- CRM coherence: monnaie client, statuts métier, rôles DG, accès métiers,
-- paramètres financiers personnalisés et affectation technique par zone.

alter view public.v_client_synthese set (security_invoker=true);

create or replace function private.is_global_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role in ('super_admin','pdg','dg')); $$;

create or replace function private.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role in ('super_admin','pdg','dg','responsable_operations')); $$;

create or replace function private.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role in ('super_admin','pdg','dg','responsable_operations','comptable','commercial','service_client','responsable_commercial','assistant_administratif','chef_equipe_commercial','chef_equipe_technique','technicien','chef_equipe_service_client','associe_actionnaire')); $$;

drop policy if exists "Staff create owned leads" on public.leads;
create policy "Staff create owned leads" on public.leads for insert to authenticated
with check (private.is_staff(auth.uid()) and created_by=auth.uid() and (assigned_to is null or assigned_to=auth.uid() or private.can_supervise_leads(auth.uid())));

create table if not exists public.client_monnaie_mouvements (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 paiement_source_id uuid references public.paiements(id) on delete set null,
 paiement_rachats_id uuid references public.paiements(id) on delete set null,
 type_mouvement text not null check(type_mouvement in ('credit','debit')),
 montant numeric(14,2) not null check(montant>0),
 taux_journalier numeric(14,4) not null check(taux_journalier>0),
 jours_equivalents integer not null default 0 check(jours_equivalents>=0),
 motif text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists idx_client_monnaie_client_created on public.client_monnaie_mouvements(client_id,created_at desc);
create index if not exists idx_client_monnaie_created_by on public.client_monnaie_mouvements(created_by);
create index if not exists idx_client_monnaie_rachats_payment on public.client_monnaie_mouvements(paiement_rachats_id);
create unique index if not exists uq_client_monnaie_credit_payment on public.client_monnaie_mouvements(paiement_source_id) where type_mouvement='credit' and paiement_source_id is not null;

create or replace view public.v_monnaie_clients with (security_invoker=true) as
select c.id client_id,coalesce(sum(case when m.type_mouvement='credit' then m.montant else -m.montant end),0)::numeric(14,2) monnaie_client
from public.clients c left join public.client_monnaie_mouvements m on m.client_id=c.id group by c.id;

create or replace function public.calculer_monnaie_client_paiement() returns trigger language plpgsql set search_path=public as $$
declare v_rate numeric;v_amount numeric;v_days integer;v_surplus numeric;
begin
 if new.statut<>'valide' or coalesce(new.est_paiement_initial,false) or coalesce(new.est_depot_initial,false) then return new; end if;
 if exists(select 1 from public.client_monnaie_mouvements where paiement_source_id=new.id and type_mouvement='credit') then return new; end if;
 select coalesce(nullif(cl.taux_journalier_ha,0),case when coalesce(cl.mensualite_montant,0)>0 then cl.mensualite_montant/30 else 0 end) into v_rate from public.clients cl where cl.id=new.client_id;
 v_amount:=coalesce(new.montant_paye,new.montant,0); if v_rate is null or v_rate<=0 or v_amount<=0 then return new; end if;
 v_days:=floor(v_amount/v_rate); v_surplus:=round(v_amount-(v_days*v_rate),2);
 if v_surplus>0 then insert into public.client_monnaie_mouvements(client_id,paiement_source_id,type_mouvement,montant,taux_journalier,jours_equivalents,motif,created_by) values(new.client_id,new.id,'credit',v_surplus,v_rate,0,'Surplus de paiement',new.created_by); end if;
 return new;
end $$;
drop trigger if exists trg_calcul_monnaie_client on public.paiements;
create trigger trg_calcul_monnaie_client after insert or update of statut,montant,montant_paye,est_paiement_initial,est_depot_initial on public.paiements for each row execute function public.calculer_monnaie_client_paiement();

create or replace function public.rachater_monnaie_client(p_client_id uuid,p_jours integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_rate numeric;v_balance numeric;v_debit numeric;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 if not (exists(select 1 from public.clients c where c.id=p_client_id and c.user_id=auth.uid()) or private.is_admin(auth.uid()) or exists(select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.role in ('comptable','responsable_operations'))) then raise exception 'Accès non autorisé'; end if;
 if p_jours is null or p_jours<=0 then raise exception 'Nombre de jours invalide'; end if;
 select coalesce(nullif(c.taux_journalier_ha,0),case when coalesce(c.mensualite_montant,0)>0 then c.mensualite_montant/30 else 0 end) into v_rate from public.clients c where c.id=p_client_id;
 if v_rate is null or v_rate<=0 then raise exception 'Taux journalier indisponible pour ce client'; end if;
 select coalesce(monnaie_client,0) into v_balance from public.v_monnaie_clients where client_id=p_client_id;
 v_debit:=round(p_jours*v_rate,2); if v_debit>v_balance then raise exception 'Monnaie client insuffisante'; end if;
 insert into public.client_monnaie_mouvements(client_id,type_mouvement,montant,taux_journalier,jours_equivalents,motif,created_by) values(p_client_id,'debit',v_debit,v_rate,p_jours,'Rachat de monnaie client',auth.uid());
 return jsonb_build_object('client_id',p_client_id,'jours',p_jours,'taux_journalier',v_rate,'montant_utilise',v_debit,'monnaie_restante',round(v_balance-v_debit,2));
end $$;
create or replace function public.racheter_monnaie_client(p_client_id uuid,p_jours integer) returns jsonb language sql security definer set search_path=public as $$ select public.rachater_monnaie_client(p_client_id,p_jours); $$;
revoke all on function public.rachater_monnaie_client(uuid,integer) from anon;
revoke all on function public.racheter_monnaie_client(uuid,integer) from anon;
grant execute on function public.rachater_monnaie_client(uuid,integer) to authenticated;
grant execute on function public.racheter_monnaie_client(uuid,integer) to authenticated;

alter table public.client_monnaie_mouvements enable row level security;
drop policy if exists "Client monnaie read own" on public.client_monnaie_mouvements;
create policy "Client monnaie read own" on public.client_monnaie_mouvements for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()) or private.is_staff(auth.uid()));
drop policy if exists "Staff manage client monnaie" on public.client_monnaie_mouvements;
create policy "Staff manage client monnaie" on public.client_monnaie_mouvements for all to authenticated using(private.is_admin(auth.uid()) or private.is_finance_staff(auth.uid())) with check(private.is_admin(auth.uid()) or private.is_finance_staff(auth.uid()));

create or replace function public.recalculer_parametres_financiers_client(p_client_id uuid) returns void language plpgsql set search_path=public as $$
declare v_initial numeric:=0;v_monthly numeric:=0;v_duration integer:=36;v_ha numeric:=0;v_total numeric:=0;v_daily numeric:=0;
begin
 select coalesce(c.paiement_initial_montant,0),coalesce(c.mensualite_montant,0),coalesce(nullif(o.duree_paiement_mois,0),36),coalesce(c.total_hectares,0) into v_initial,v_monthly,v_duration,v_ha from public.clients c left join public.offres o on o.id=c.offre_id where c.id=p_client_id;
 v_total:=v_initial+(v_monthly*v_duration); if v_monthly>0 and v_ha>0 then v_daily:=v_monthly/(30*v_ha); end if;
 update public.clients set montant_total_contrat=case when v_total>0 then v_total else coalesce(montant_total_contrat,0) end,taux_journalier_ha=v_daily,jours_contrat_total=case when v_total>0 and v_daily>0 then floor(v_total/v_daily) else jours_contrat_total end where id=p_client_id;
end $$;
create or replace function public.trg_recalculer_parametres_financiers_client() returns trigger language plpgsql set search_path=public as $$ begin perform public.recalculer_parametres_financiers_client(new.id);return new;end $$;
drop trigger if exists trg_recalculer_parametres_financiers_client on public.clients;
create trigger trg_recalculer_parametres_financiers_client after insert or update of offre_id,total_hectares,paiement_initial_montant,mensualite_montant on public.clients for each row execute function public.trg_recalculer_parametres_financiers_client();

update public.clients set statut_global='a_jour' where statut_global='actif';
update public.clients set montant_total_contrat=356000,taux_journalier_ha=116.6666667 where id_unique in ('AGC-000003','AGC-000004');
update public.clients set montant_total_contrat=200000,taux_journalier_ha=0 where id_unique='AGC-000005';
update public.clients set montant_total_contrat=317000,taux_journalier_ha=233.3333333 where id_unique='AGC-000006';

create or replace function public.actualiser_statut_client(p_client_id uuid) returns text language plpgsql set search_path=public as $$
declare v_status text;v_reste numeric;v_retard integer;v_compte boolean;
begin select compte_actif,coalesce(reste_a_payer,0),coalesce(jours_retard,0) into v_compte,v_reste,v_retard from public.v_client_synthese where client_id=p_client_id;
 if not coalesce(v_compte,false) then v_status:='ferme'; elsif exists(select 1 from public.clients where id=p_client_id and statut_global='suspendu') then v_status:='suspendu'; elsif v_retard>0 then v_status:='retard'; else v_status:='a_jour'; end if;
 update public.clients set statut_global=v_status where id=p_client_id;return v_status;end $$;

create or replace function public.resolve_technicien_zone(p_plantation_id uuid) returns uuid language sql stable security definer set search_path=public as $$
 select p.id from public.profiles p join public.zone_assignments za on za.user_id=p.user_id where p.actif=true and exists(select 1 from public.user_roles ur where ur.user_id=p.user_id and ur.role='technicien') and ((za.zone_type='sous_prefecture' and za.zone_id=(select sous_prefecture_id from public.plantations where id=p_plantation_id)) or (za.zone_type='departement' and za.zone_id=(select departement_id from public.plantations where id=p_plantation_id)) or (za.zone_type='region' and za.zone_id=(select region_id from public.plantations where id=p_plantation_id)) or (za.zone_type='district' and za.zone_id=(select district_id from public.plantations where id=p_plantation_id))) order by case za.zone_type when 'sous_prefecture' then 1 when 'departement' then 2 when 'region' then 3 when 'district' then 4 else 9 end,p.nom_complet limit 1;
$$;
revoke all on function public.resolve_technicien_zone(uuid) from anon;grant execute on function public.resolve_technicien_zone(uuid) to authenticated;

create or replace function public.auto_assigner_technicien_intervention() returns trigger language plpgsql set search_path=public as $$ declare v_agent uuid;begin if new.agent_technique_id is not null then return new;end if;if new.plantation_id is not null then v_agent:=public.resolve_technicien_zone(new.plantation_id);if v_agent is not null then new.agent_technique_id:=v_agent;end if;end if;return new;end $$;
drop trigger if exists trg_auto_assigner_technicien_intervention on public.interventions_techniques;
create trigger trg_auto_assigner_technicien_intervention before insert on public.interventions_techniques for each row execute function public.auto_assigner_technicien_intervention();

insert into public.role_permissions(role_code,permission_code)
select distinct role,'leads.create' from public.user_roles where role is not null on conflict(role_code,permission_code) do nothing;
insert into public.role_permissions(role_code,permission_code) values('dg','leads.create'),('dg','leads.view'),('dg','clients.view'),('dg','commissions.view'),('dg','portefeuilles.view') on conflict(role_code,permission_code) do nothing;

create index if not exists idx_portail_support_requests_assigne_a on public.portail_support_requests(assigne_a);

insert into public.role_permissions(role_code,permission_code)
select x.role_code,x.permission_code
from (values
 ('service_client','clients.view'),('service_client','leads.create'),('service_client','leads.view'),('service_client','tickets.view'),('service_client','tickets.create'),('service_client','tickets.update'),('service_client','paiements.view'),('service_client','paiements.record'),
 ('commercial','clients.view'),('commercial','clients.create'),('commercial','clients.update'),('commercial','leads.create'),('commercial','leads.view'),('commercial','leads.update'),('commercial','commissions.view'),('commercial','portefeuilles.view'),
 ('chef_equipe_commercial','clients.view'),('chef_equipe_commercial','clients.create'),('chef_equipe_commercial','clients.update'),('chef_equipe_commercial','leads.create'),('chef_equipe_commercial','leads.view'),('chef_equipe_commercial','leads.update'),('chef_equipe_commercial','commissions.view'),('chef_equipe_commercial','portefeuilles.view'),
 ('technicien','clients.view'),('technicien','plantations.view'),('technicien','documents.view'),('technicien','documents.upload'),('technicien','tickets.view'),('technicien','tickets.create'),('technicien','tickets.update'),('technicien','commissions.view'),('technicien','portefeuilles.view'),
 ('chef_equipe_technique','clients.view'),('chef_equipe_technique','plantations.view'),('chef_equipe_technique','documents.view'),('chef_equipe_technique','documents.upload'),('chef_equipe_technique','tickets.view'),('chef_equipe_technique','tickets.create'),('chef_equipe_technique','tickets.update'),('chef_equipe_technique','commissions.view'),('chef_equipe_technique','portefeuilles.view')
) x(role_code,permission_code)
on conflict(role_code,permission_code) do nothing;
