-- Génération automatique des commissions techniques à 5 000 F après mise en terre réalisée.
create or replace function public.generer_commission_technique_mise_en_terre()
returns trigger language plpgsql set search_path = public as $$
declare v_client_id uuid; v_plantation_id uuid; v_profile_id uuid;
begin
  if new.statut <> 'realisee' or new.type_intervention <> 'mise_en_terre' then return new; end if;
  v_client_id := new.client_id; v_plantation_id := new.plantation_id;
  if v_plantation_id is null and v_client_id is not null then
    select p.id into v_plantation_id from public.plantations p where p.client_id=v_client_id order by p.date_plantation desc nulls last,p.created_at desc limit 1;
  end if;
  if new.agent_technique_id is not null then v_profile_id := new.agent_technique_id;
  else select id into v_profile_id from public.profiles where lower(trim(nom_complet))=lower('YAO KONAN JEAN-MARIE') limit 1; end if;
  if v_profile_id is null or v_client_id is null then return new; end if;
  if not exists (select 1 from public.commissions c where c.profile_id=v_profile_id and c.client_id=v_client_id and c.type_commission='technique' and ((v_plantation_id is not null and c.plantation_id=v_plantation_id) or (v_plantation_id is null and c.plantation_id is null))) then
    insert into public.commissions(profile_id,plantation_id,client_id,type_commission,montant_base,taux_commission,montant_commission,periode,date_calcul,statut)
    values(v_profile_id,v_plantation_id,v_client_id,'technique',5000,0,5000,coalesce(new.date_intervention,current_date),now(),'validee');
  end if;
  return new;
end $$;

create or replace function public.generer_commission_technique_a_la_creation_plantation()
returns trigger language plpgsql set search_path = public as $$
declare v_profile_id uuid; v_client_id uuid;
begin
  v_client_id := new.client_id; if v_client_id is null then return new; end if;
  select i.agent_technique_id into v_profile_id from public.interventions_techniques i where i.client_id=v_client_id and i.type_intervention='mise_en_terre' and i.statut='realisee' order by i.date_intervention desc nulls last,i.created_at desc limit 1;
  if v_profile_id is null then select id into v_profile_id from public.profiles where lower(trim(nom_complet))=lower('YAO KONAN JEAN-MARIE') limit 1; end if;
  if v_profile_id is null then return new; end if;
  if not exists (select 1 from public.commissions c where c.profile_id=v_profile_id and c.client_id=v_client_id and c.type_commission='technique' and c.plantation_id=new.id) then
    insert into public.commissions(profile_id,plantation_id,client_id,type_commission,montant_base,taux_commission,montant_commission,periode,date_calcul,statut)
    values(v_profile_id,new.id,v_client_id,'technique',5000,0,5000,coalesce(new.date_plantation,current_date),now(),'validee');
  end if;
  return new;
end $$;

drop trigger if exists trg_commission_technique_mise_en_terre on public.interventions_techniques;
create trigger trg_commission_technique_mise_en_terre after insert or update of statut,type_intervention,plantation_id,agent_technique_id on public.interventions_techniques for each row execute function public.generer_commission_technique_mise_en_terre();
drop trigger if exists trg_commission_technique_creation_plantation on public.plantations;
create trigger trg_commission_technique_creation_plantation after insert or update of client_id on public.plantations for each row execute function public.generer_commission_technique_a_la_creation_plantation();
