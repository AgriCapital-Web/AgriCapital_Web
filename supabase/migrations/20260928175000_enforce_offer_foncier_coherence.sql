-- Keep the offer as the source of truth for the Client's land mode.
-- TerraPalm / PalmTerroir => Client-owned land (OWN).
-- PalmInvest / PalmInvest+ => AgriCapital/external land (EXT).
begin;

create or replace function public.sync_client_foncier_from_offer()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_need_client_land boolean;
begin
  if new.offre_id is null then
    return new;
  end if;

  select coalesce(o.necessite_foncier_client,false)
    into v_need_client_land
  from public.offres o
  where o.id=new.offre_id;

  if not found then
    raise exception 'Offre % introuvable',new.offre_id;
  end if;

  new.type_client_foncier := case when v_need_client_land then 'OWN' else 'EXT' end;
  new.type_client := case
    when coalesce(new.type_client,'') in ('sans_terre','avec_terre')
      then case when v_need_client_land then 'avec_terre' else 'sans_terre' end
    else new.type_client
  end;

  return new;
end;
$$;

drop trigger if exists trg_sync_client_foncier_from_offer on public.clients;
create trigger trg_sync_client_foncier_from_offer
before insert or update of offre_id
on public.clients
for each row
execute function public.sync_client_foncier_from_offer();

-- Repair existing commercial Client dossiers according to their current offer.
update public.clients c
set type_client_foncier=case when coalesce(o.necessite_foncier_client,false) then 'OWN' else 'EXT' end,
    type_client=case
      when c.type_client in ('sans_terre','avec_terre')
        then case when coalesce(o.necessite_foncier_client,false) then 'avec_terre' else 'sans_terre' end
      else c.type_client
    end,
    updated_at=now()
from public.offres o
where o.id=c.offre_id;

commit;