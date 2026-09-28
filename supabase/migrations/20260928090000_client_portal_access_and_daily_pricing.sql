create table if not exists public.client_portal_access_codes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  code_hash text not null,
  code_salt text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  set_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_portal_access_codes_locked_until on public.client_portal_access_codes(locked_until);
alter table public.client_portal_access_codes enable row level security;
revoke all on public.client_portal_access_codes from anon, authenticated;

create table if not exists public.client_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz
);
create index if not exists idx_client_portal_sessions_client on public.client_portal_sessions(client_id);
create index if not exists idx_client_portal_sessions_expires on public.client_portal_sessions(expires_at);
alter table public.client_portal_sessions enable row level security;
revoke all on public.client_portal_sessions from anon, authenticated;

create or replace function public.portal_client_daily_rate(_client_id uuid,_at_date date default current_date)
returns numeric language plpgsql stable security definer set search_path=public as $$
declare v_client record; v_contract_day integer; v_cursor integer:=0; v_rate numeric:=0; v_tranche jsonb; v_months integer;
begin
 select c.*,o.tranches_paiement,o.contribution_mensuelle_par_ha into v_client from public.clients c left join public.offres o on o.id=c.offre_id where c.id=_client_id;
 if v_client is null then return 0; end if;
 if v_client.contrat_debut_at is null then return coalesce(v_client.taux_journalier_ha,0); end if;
 v_contract_day:=greatest(0,(_at_date-v_client.contrat_debut_at));
 if jsonb_typeof(v_client.tranches_paiement)='array' then
  for v_tranche in select value from jsonb_array_elements(v_client.tranches_paiement) loop
   v_months:=coalesce((v_tranche->>'mois')::integer,0);
   if coalesce(v_tranche->>'type','')='paiement_initial' or v_months<=0 then continue; end if;
   if v_contract_day < v_cursor+v_months*30 then v_rate:=coalesce((v_tranche->>'mensualite_par_ha')::numeric,0)/30; exit; end if;
   v_cursor:=v_cursor+v_months*30;
  end loop;
 end if;
 if v_rate<=0 then v_rate:=coalesce(v_client.contribution_mensuelle_par_ha,0)/30; end if;
 return greatest(v_rate,0);
end; $$;
revoke execute on function public.portal_client_daily_rate(uuid,date) from public,anon,authenticated;
grant execute on function public.portal_client_daily_rate(uuid,date) to service_role;

create or replace function public.portal_quote_payment(_client_id uuid,_plantation_id uuid,_days integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_client record; v_plantation record; v_offer record; v_remaining integer:=greatest(coalesce(_days,0),0); v_offset integer:=0; v_cursor integer:=0; v_rate numeric; v_amount numeric:=0; v_start date; v_end date; v_segments jsonb:='[]'::jsonb; v_tranche jsonb; v_months integer; v_days integer; v_available integer; v_monthly numeric; v_contract_days integer;
begin
 if _days is null or _days<=0 then raise exception 'Le nombre de jours doit être supérieur à 0'; end if;
 select c.id,c.contrat_debut_at,c.jours_payes,c.jours_contrat_total,c.total_hectares,c.offre_id into v_client from public.clients c where c.id=_client_id and c.compte_actif=true and c.statut_global='actif';
 if v_client is null then raise exception 'Client introuvable ou inactif'; end if;
 select p.id,p.client_id,p.superficie_activee,p.date_activation into v_plantation from public.plantations p where p.id=_plantation_id and p.client_id=_client_id and coalesce(p.superficie_activee,0)>0;
 if v_plantation is null then raise exception 'Plantation introuvable ou inactive'; end if;
 select o.* into v_offer from public.offres o where o.id=v_client.offre_id;
 if v_offer is null then raise exception 'Offre du client introuvable'; end if;
 v_offset:=greatest(coalesce(v_client.jours_payes,0),0);
 v_contract_days:=coalesce(v_client.jours_contrat_total,coalesce(v_offer.duree_paiement_mois,0)*30);
 if v_contract_days>0 then v_remaining:=least(v_remaining,greatest(v_contract_days-v_offset,0)); end if;
 if v_remaining<=0 then return jsonb_build_object('montant',0,'jours',0,'periode_debut',(coalesce(v_client.contrat_debut_at,current_date)+v_offset)::date,'periode_fin',null,'segments','[]'::jsonb); end if;
 v_start:=coalesce(v_client.contrat_debut_at,current_date)+v_offset;
 if jsonb_typeof(v_offer.tranches_paiement)='array' then
  for v_tranche in select value from jsonb_array_elements(v_offer.tranches_paiement) loop
   if coalesce(v_tranche->>'type','')='paiement_initial' then continue; end if;
   v_months:=coalesce((v_tranche->>'mois')::integer,0); v_monthly:=coalesce((v_tranche->>'mensualite_par_ha')::numeric,0);
   if v_months<=0 or v_monthly<=0 then continue; end if;
   if v_offset>=v_cursor+v_months*30 then v_cursor:=v_cursor+v_months*30; continue; end if;
   v_available:=(v_cursor+v_months*30)-v_offset; v_days:=least(v_remaining,v_available); v_rate:=v_monthly/30;
   v_amount:=v_amount+(v_rate*v_days*coalesce(v_plantation.superficie_activee,0));
   v_segments:=v_segments||jsonb_build_array(jsonb_build_object('annee',coalesce((v_tranche->>'annee')::integer,1),'jours',v_days,'mensuel_par_ha',v_monthly,'taux_journalier_par_ha',v_rate,'montant',round(v_rate*v_days*coalesce(v_plantation.superficie_activee,0),2)));
   v_remaining:=v_remaining-v_days; v_offset:=v_offset+v_days; v_cursor:=v_cursor+v_months*30; if v_remaining<=0 then exit; end if;
  end loop;
 end if;
 if v_remaining>0 then v_monthly:=coalesce(v_offer.contribution_mensuelle_par_ha,0); v_rate:=v_monthly/30; v_days:=v_remaining; v_amount:=v_amount+(v_rate*v_days*coalesce(v_plantation.superficie_activee,0)); v_segments:=v_segments||jsonb_build_array(jsonb_build_object('annee',null,'jours',v_days,'mensuel_par_ha',v_monthly,'taux_journalier_par_ha',v_rate,'montant',round(v_rate*v_days*coalesce(v_plantation.superficie_activee,0),2))); v_remaining:=0; end if;
 v_end:=v_start+(greatest(0,(select coalesce(sum((s->>'jours')::integer),0) from jsonb_array_elements(v_segments) s))-1);
 return jsonb_build_object('montant',round(v_amount,2),'jours',greatest(0,(select coalesce(sum((s->>'jours')::integer),0) from jsonb_array_elements(v_segments) s)),'periode_debut',v_start,'periode_fin',v_end,'segments',v_segments);
end; $$;
revoke execute on function public.portal_quote_payment(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.portal_quote_payment(uuid,uuid,integer) to service_role;