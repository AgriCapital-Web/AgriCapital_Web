create or replace function public.validate_formula_technical_intervention()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_formula text; v_plantation_date date; v_allowed boolean:=true;
begin
 select p.date_plantation,c.formule_code into v_plantation_date,v_formula from public.plantations p join public.clients c on c.id=p.client_id where p.id=new.plantation_id;
 if coalesce(v_formula,'') like 'PALMTERROIR%' and v_plantation_date is not null and new.date_intervention::date >= v_plantation_date then
   v_allowed:=new.type_intervention in ('suivi_mensuel','autre');
 elsif coalesce(v_formula,'') like 'PALMTERROIR%' then
   v_allowed:=new.type_intervention in ('piquetage','trouaison','mise_en_terre','autre');
 end if;
 if not v_allowed then raise exception 'Intervention non autorisée pour PalmTerroir après la mise en terre : %',new.type_intervention; end if;
 return new;
end; $$;
drop trigger if exists trg_validate_formula_technical_intervention on public.interventions_techniques;
create trigger trg_validate_formula_technical_intervention before insert or update on public.interventions_techniques for each row execute function public.validate_formula_technical_intervention();
revoke execute on function public.validate_formula_technical_intervention() from public,anon,authenticated;
grant execute on function public.validate_formula_technical_intervention() to service_role;