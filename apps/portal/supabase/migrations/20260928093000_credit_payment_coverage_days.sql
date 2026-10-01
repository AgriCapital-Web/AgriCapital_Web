create or replace function public.portal_days_for_amount(_client_id uuid,_plantation_id uuid,_amount numeric)
returns integer language plpgsql security definer set search_path=public as $$
declare v_client record; v_plantation record; v_offer record; v_remaining numeric:=greatest(coalesce(_amount,0),0); v_offset integer:=0; v_cursor integer:=0; v_days integer:=0; v_day_cost numeric; v_tranche jsonb; v_months integer; v_monthly numeric; v_available integer; v_take integer;
begin
 if v_remaining<=0 then return 0; end if;
 select c.* into v_client from public.clients c where c.id=_client_id;
 if v_client is null then raise exception 'Client introuvable'; end if;
 select p.* into v_plantation from public.plantations p where p.id=_plantation_id and p.client_id=_client_id;
 if v_plantation is null then raise exception 'Plantation introuvable'; end if;
 select o.* into v_offer from public.offres o where o.id=v_client.offre_id;
 if v_offer is null then raise exception 'Offre introuvable'; end if;
 v_offset:=greatest(coalesce(v_client.jours_payes,0),0);
 if jsonb_typeof(v_offer.tranches_paiement)='array' then
  for v_tranche in select value from jsonb_array_elements(v_offer.tranches_paiement) loop
   if coalesce(v_tranche->>'type','')='paiement_initial' then continue; end if;
   v_months:=coalesce((v_tranche->>'mois')::integer,0); v_monthly:=coalesce((v_tranche->>'mensualite_par_ha')::numeric,0);
   if v_months<=0 or v_monthly<=0 then continue; end if;
   if v_offset>=v_cursor+v_months*30 then v_cursor:=v_cursor+v_months*30; continue; end if;
   v_available:=(v_cursor+v_months*30)-v_offset; v_day_cost:=(v_monthly/30)*coalesce(v_plantation.superficie_activee,0);
   if v_day_cost<=0 then exit; end if;
   v_take:=least(v_available,ceil(v_remaining/v_day_cost)::integer); v_days:=v_days+v_take; v_remaining:=greatest(0,v_remaining-(v_take*v_day_cost)); v_offset:=v_offset+v_take; v_cursor:=v_cursor+v_months*30;
   if v_remaining<=0 then exit; end if;
  end loop;
 end if;
 if v_remaining>0 then v_day_cost:=(coalesce(v_offer.contribution_mensuelle_par_ha,0)/30)*coalesce(v_plantation.superficie_activee,0); if v_day_cost>0 then v_days:=v_days+ceil(v_remaining/v_day_cost)::integer; end if; end if;
 return greatest(v_days,0);
end; $$;
revoke execute on function public.portal_days_for_amount(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.portal_days_for_amount(uuid,uuid,numeric) to service_role;

create or replace function public.finalize_portal_payment(_paiement_id uuid,_transaction_id text default null,_provider_amount numeric default null,_metadata jsonb default '{}'::jsonb,_validated_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_payment public.paiements%rowtype; v_plantation public.plantations%rowtype; v_client public.clients%rowtype; v_paid numeric; v_was_valid boolean; v_days integer:=0; v_new_days integer;
begin
 select * into v_payment from public.paiements where id=_paiement_id for update;
 if not found then raise exception 'Paiement introuvable'; end if;
 select * into v_client from public.clients where id=v_payment.client_id for update;
 if not found then raise exception 'Client du paiement introuvable'; end if;
 if _provider_amount is not null and abs(_provider_amount-coalesce(v_payment.montant,0))>1 then raise exception 'Montant fournisseur incohérent'; end if;
 if _transaction_id is not null and exists(select 1 from public.paiements where kkiapay_transaction_id=_transaction_id and id<>v_payment.id) then raise exception 'Transaction déjà rattachée à un autre paiement'; end if;
 v_was_valid:=v_payment.statut='valide';
 v_paid:=case when coalesce(v_payment.est_depot_initial,false) and coalesce(v_payment.montant,0)=0 then 0 else coalesce(_provider_amount,v_payment.montant_paye,v_payment.montant,0) end;
 if not v_was_valid then update public.paiements set statut='valide',montant_paye=v_paid,date_paiement=coalesce(date_paiement,_validated_at),date_validation=coalesce(date_validation,_validated_at),kkiapay_transaction_id=coalesce(_transaction_id,kkiapay_transaction_id),metadata=coalesce(metadata,'{}'::jsonb)||coalesce(_metadata,'{}'::jsonb),updated_at=now() where id=v_payment.id; else update public.paiements set kkiapay_transaction_id=coalesce(_transaction_id,kkiapay_transaction_id),metadata=coalesce(metadata,'{}'::jsonb)||coalesce(_metadata,'{}'::jsonb),updated_at=now() where id=v_payment.id; end if;
 if coalesce(v_payment.est_depot_initial,false) and v_payment.plantation_id is not null then
  select * into v_plantation from public.plantations where id=v_payment.plantation_id and client_id=v_payment.client_id for update;
  if not found then raise exception 'Plantation du paiement introuvable'; end if;
  update public.plantations set superficie_activee=superficie_ha,montant_pi_paye=greatest(coalesce(montant_pi_paye,0),v_paid),date_activation=coalesce(date_activation,_validated_at::date),statut='active',statut_global='actif',updated_at=now() where id=v_plantation.id;
  update public.clients set compte_actif=true,statut=case when coalesce(statut,'') in ('','en_attente_pi','en_attente') then 'actif' else statut end,statut_global='actif',pi_paye_at=coalesce(pi_paye_at,_validated_at),updated_at=now() where id=v_payment.client_id;
 elsif not v_was_valid and v_payment.plantation_id is not null and v_paid>0 then
  v_days:=public.portal_days_for_amount(v_payment.client_id,v_payment.plantation_id,v_paid);
  v_new_days:=least(coalesce(v_client.jours_contrat_total,2147483647),coalesce(v_client.jours_payes,0)+v_days);
  update public.clients set jours_payes=v_new_days,taux_journalier_ha=public.portal_client_daily_rate(v_payment.client_id,_validated_at::date),prochaine_echeance=case when contrat_debut_at is not null then (contrat_debut_at+v_new_days)::date else prochaine_echeance end,jours_retard=case when contrat_debut_at is not null then greatest(0,current_date-(contrat_debut_at+v_new_days)::date) else jours_retard end,updated_at=now() where id=v_payment.client_id;
 end if;
 if not v_was_valid then insert into public.historique_activites(table_name,record_id,action,details,nouvelles_valeurs) values('paiements',v_payment.id::text,case when coalesce(v_payment.est_depot_initial,false) then 'PORTAL_PI_VALIDATED' else 'PORTAL_MONTHLY_PAYMENT_VALIDATED' end,case when coalesce(v_payment.est_depot_initial,false) then 'Paiement initial (PI) validé et activation propagée au compte et à la plantation' else 'Paiement validé et jours couverts crédités automatiquement' end,jsonb_build_object('reference',v_payment.reference,'transaction_id',_transaction_id,'montant_paye',v_paid,'jours_credites',v_days,'jours_payes_apres',case when coalesce(v_payment.est_depot_initial,false) then v_client.jours_payes else v_new_days end,'validated_at',_validated_at,'client_id',v_payment.client_id,'plantation_id',v_payment.plantation_id)); end if;
 return jsonb_build_object('success',true,'already_validated',v_was_valid,'paiement_id',v_payment.id,'client_id',v_payment.client_id,'plantation_id',v_payment.plantation_id,'montant_paye',v_paid,'jours_credites',v_days,'jours_payes',case when coalesce(v_payment.est_depot_initial,false) then v_client.jours_payes else coalesce(v_new_days,v_client.jours_payes) end,'activated',coalesce(v_payment.est_depot_initial,false));
end; $$;