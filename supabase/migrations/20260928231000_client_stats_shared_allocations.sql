-- Align client hectare statistics with shared beneficiary allocations
-- 2026-09-28

create or replace function public.update_client_stats()
returns trigger
language plpgsql security definer set search_path='public'
as $function$
declare
  v_sid uuid;
  v_count integer;
  v_total numeric;
  v_has_allocations boolean;
begin
  v_sid := coalesce(new.client_id,old.client_id);
  if v_sid is null then return coalesce(new,old); end if;

  select exists(
    select 1 from public.beneficiaire_attributions
    where client_id=v_sid and statut='active'
  ) into v_has_allocations;

  if v_has_allocations then
    select count(distinct coalesce(plantation_id,id)), coalesce(sum(surface_attribuee_ha),0)
      into v_count,v_total
    from public.beneficiaire_attributions
    where client_id=v_sid and statut='active';
  else
    select count(*), coalesce(sum(superficie_ha),0)
      into v_count,v_total
    from public.plantations
    where client_id=v_sid;
  end if;

  update public.clients
  set nombre_plantations=v_count,total_hectares=v_total
  where id=v_sid;

  return coalesce(new,old);
end;
$function$;

revoke execute on function public.update_client_stats() from public,anon;
