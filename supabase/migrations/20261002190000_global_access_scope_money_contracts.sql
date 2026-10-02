-- CRM access scope, internal client money and canonical contract totals.
create or replace function private.can_access_client(_user_id uuid, _client_id uuid)
returns boolean language plpgsql security definer set search_path='' stable as $$
declare c record; p record;
begin
 if _user_id is null or _client_id is null then return false; end if;
 if private.is_global_admin(_user_id) or private.has_role(_user_id,'responsable_operations') or private.has_role(_user_id,'service_client') or private.has_role(_user_id,'chef_equipe_service_client') or private.has_role(_user_id,'comptable') then return true; end if;
 select * into c from public.clients where id=_client_id; if not found then return false; end if;
 if c.user_id=_user_id or c.created_by=_user_id then return true; end if;
 select * into p from public.profiles where user_id=_user_id limit 1; if not found then return false; end if;
 if c.district_id is not null and p.district_id=c.district_id then return true; end if;
 if c.region_id is not null and p.region_id=c.region_id then return true; end if;
 if exists(select 1 from public.zone_assignments z where z.user_id=_user_id and ((z.zone_type='district' and z.zone_id=c.district_id) or (z.zone_type='region' and z.zone_id=c.region_id) or (z.zone_type='departement' and z.zone_id=c.departement_id) or (z.zone_type='sous_prefecture' and z.zone_id=c.sous_prefecture_id))) then return true; end if;
 if p.equipe_id is not null and (private.has_role(_user_id,'chef_equipe_commercial') or private.has_role(_user_id,'chef_equipe_technique') or private.has_role(_user_id,'responsable_commercial')) then
   if exists(select 1 from public.profiles member where member.equipe_id=p.equipe_id and (member.user_id=c.created_by or (c.region_id is not null and member.region_id=c.region_id) or (c.district_id is not null and member.district_id=c.district_id) or exists(select 1 from public.zone_assignments z where z.user_id=member.user_id and ((z.zone_type='district' and z.zone_id=c.district_id) or (z.zone_type='region' and z.zone_id=c.region_id) or (z.zone_type='departement' and z.zone_id=c.departement_id) or (z.zone_type='sous_prefecture' and z.zone_id=c.sous_prefecture_id))))) then return true; end if;
 end if;
 return false;
end; $$;

create or replace function private.can_manage_client_money(_user_id uuid)
returns boolean language sql security definer set search_path='' stable as $$
select _user_id is not null and (private.is_global_admin(_user_id) or private.has_role(_user_id,'responsable_operations') or private.has_role(_user_id,'service_client') or private.has_role(_user_id,'chef_equipe_service_client') or private.has_role(_user_id,'comptable')); $$;

drop policy if exists "Client monnaie read own" on public.client_monnaie_mouvements;
drop policy if exists "Staff manage client monnaie" on public.client_monnaie_mouvements;
create policy "Client monnaie internal read" on public.client_monnaie_mouvements for select to authenticated using ((select private.can_manage_client_money((select auth.uid()))));
create policy "Client monnaie internal manage" on public.client_monnaie_mouvements for all to authenticated using ((select private.can_manage_client_money((select auth.uid())))) with check ((select private.can_manage_client_money((select auth.uid()))));
alter view public.v_monnaie_clients set (security_invoker=true);

drop function if exists public.rachater_monnaie_client(uuid,integer);
drop function if exists public.racheter_monnaie_client(uuid,integer);
create function public.rachater_monnaie_client(p_client_id uuid,p_jours integer)
returns numeric language plpgsql security definer set search_path='' as $$
declare rate numeric; balance numeric; amount numeric; uid uuid:=auth.uid();
begin
 if not private.can_manage_client_money(uid) then raise exception 'Opération non autorisée'; end if;
 if p_client_id is null or p_jours is null or p_jours<=0 then raise exception 'Paramètres invalides'; end if;
 select coalesce(taux_journalier_ha,0) into rate from public.clients where id=p_client_id;
 if coalesce(rate,0)<=0 then raise exception 'Tarif journalier indisponible'; end if;
 select coalesce(monnaie_client,0) into balance from public.v_monnaie_clients where client_id=p_client_id;
 amount:=rate*p_jours;
 if amount>coalesce(balance,0) then raise exception 'Monnaie client insuffisante'; end if;
 insert into public.client_monnaie_mouvements(client_id,type_mouvement,montant,taux_journalier,jours_equivalents,motif,created_by) values(p_client_id,'debit',amount,rate,p_jours,'Rachat de monnaie client',uid);
 return greatest(0,coalesce(balance,0)-amount);
end; $$;
create function public.racheter_monnaie_client(p_client_id uuid,p_jours integer)
returns numeric language sql security definer set search_path='' as $$ select public.rachater_monnaie_client(p_client_id,p_jours); $$;
revoke execute on function public.rachater_monnaie_client(uuid,integer) from public,anon;
revoke execute on function public.racheter_monnaie_client(uuid,integer) from public,anon;
grant execute on function public.rachater_monnaie_client(uuid,integer) to authenticated;
grant execute on function public.racheter_monnaie_client(uuid,integer) to authenticated;

drop policy if exists "Staff can view clients" on public.clients;
drop policy if exists "Staff can update clients" on public.clients;
create policy "Scoped staff can view clients" on public.clients for select to authenticated using ((select private.can_access_client((select auth.uid()),id)));
create policy "Scoped staff can update clients" on public.clients for update to authenticated using ((select private.can_access_client((select auth.uid()),id))) with check ((select private.can_access_client((select auth.uid()),id)));

drop policy if exists "Staff can view plantations" on public.plantations;
drop policy if exists "Staff can update plantations" on public.plantations;
create policy "Scoped staff can view plantations" on public.plantations for select to authenticated using ((select private.can_access_client((select auth.uid()),client_id)));
create policy "Scoped staff can update plantations" on public.plantations for update to authenticated using ((select private.can_access_client((select auth.uid()),client_id))) with check ((select private.can_access_client((select auth.uid()),client_id)));

drop policy if exists "Staff can view paiements" on public.paiements;
drop policy if exists "Staff can update paiements" on public.paiements;
create policy "Scoped staff can view paiements" on public.paiements for select to authenticated using ((select private.can_access_client((select auth.uid()),client_id)));
create policy "Scoped staff can update paiements" on public.paiements for update to authenticated using ((select private.can_access_client((select auth.uid()),client_id))) with check ((select private.can_access_client((select auth.uid()),client_id)) and ((statut is distinct from 'valide') or private.is_finance_staff((select auth.uid()))));

insert into public.districts(nom,code,est_actif) select 'Diaspora','15',true where not exists(select 1 from public.districts where lower(nom)=lower('Diaspora'));

update public.clients c set offre_id=o.id,famille_offre=o.famille_offre,formule_code=o.formule_code,formule_nom=o.formule_nom,paiement_initial_montant=o.montant_pi_par_ha*c.total_hectares,mensualite_montant=o.contribution_mensuelle_par_ha*c.total_hectares,montant_total_contrat=o.montant_total_par_ha*c.total_hectares,taux_journalier_ha=case when c.total_hectares>0 then (o.montant_total_par_ha*c.total_hectares)/(36*30*c.total_hectares) else 0 end,jours_contrat_total=36*30,updated_at=now()
from public.offres o where c.id_unique in('AGC-000001','AGC-000002') and o.formule_code='PALMINVEST' and coalesce(c.montant_total_contrat,0)=0;

drop function if exists public.recalculer_parametres_financiers_client(uuid);
create function public.recalculer_parametres_financiers_client(_client_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c record;o record;months integer;total numeric;initial numeric;monthly numeric;daily numeric;
begin
 select * into c from public.clients where id=_client_id;if not found then return;end if; select * into o from public.offres where id=c.offre_id;
 months:=greatest(1,coalesce(o.duree_paiement_mois,36)); initial:=coalesce(c.paiement_initial_montant,0); monthly:=coalesce(c.mensualite_montant,0);
 if o.id is not null and coalesce(c.paiement_personnalise,'{}'::jsonb)='{}'::jsonb and monthly=coalesce(o.contribution_mensuelle_par_ha,0)*coalesce(c.total_hectares,0) and initial=coalesce(o.montant_pi_par_ha,0)*coalesce(c.total_hectares,0) and coalesce(o.montant_total_par_ha,0)>0 then total:=o.montant_total_par_ha*coalesce(c.total_hectares,0); else total:=initial+monthly*months; end if;
 daily:=case when coalesce(c.total_hectares,0)>0 and total>0 then total/(greatest(months,1)*30*coalesce(c.total_hectares,0)) else 0 end;
 update public.clients set montant_total_contrat=round(total,2),taux_journalier_ha=round(daily,6),jours_contrat_total=greatest(months,1)*30,updated_at=now() where id=_client_id;
end; $$;

select public.recalculer_parametres_financiers_client(id) from public.clients where coalesce(montant_total_contrat,0)=0 and offre_id is not null;

create or replace view public.v_cycle_installation_dashboard with(security_invoker=true) as
select i.type_intervention,count(distinct i.client_id) filter(where lower(coalesce(i.statut,'')) in('realisee','terminee','termine','validee','valide','complete','complet','realise','achevee','acheve')) clients_realises,count(distinct i.client_id) clients_concernes
from public.interventions_techniques i where i.client_id is not null group by i.type_intervention;

create index if not exists idx_clients_scope_geo on public.clients(district_id,region_id,departement_id,sous_prefecture_id);
create index if not exists idx_clients_created_by on public.clients(created_by);
create index if not exists idx_profiles_scope_geo on public.profiles(district_id,region_id,equipe_id);
create index if not exists idx_zone_assignments_user_zone on public.zone_assignments(user_id,zone_type,zone_id);
create index if not exists idx_paiements_client_scope on public.paiements(client_id,created_at desc);