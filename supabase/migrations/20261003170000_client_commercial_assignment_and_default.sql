-- Attribution commerciale du Client : le responsable commercial est une relation métier
-- persistante, distincte de created_by.
alter table public.clients
  add column if not exists commercial_id uuid;

create index if not exists idx_clients_commercial_id
  on public.clients(commercial_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_commercial_id_fkey'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_commercial_id_fkey
      foreign key (commercial_id) references public.profiles(user_id)
      on delete set null;
  end if;
end $$;

-- Réutilise l'affectation d'un lead lorsqu'une conversion est déjà tracée.
update public.clients c
set commercial_id = l.assigned_to
from public.leads l
where l.client_id = c.id
  and l.assigned_to is not null
  and c.commercial_id is null;

create or replace function private.is_commercial_assignable(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = _user_id
      and p.actif = true
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = p.user_id
          and ur.role in ('commercial','chef_equipe_commercial','responsable_commercial','super_admin')
      )
  );
$$;

create or replace function public.get_default_commercial_for_client(_current_user uuid default auth.uid())
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_default uuid;
begin
  if _current_user is null then
    return null;
  end if;

  -- Un Commercial ou Chef d'équipe Commercial est automatiquement
  -- responsable du dossier qu'il ouvre.
  if private.has_role(_current_user,'commercial')
     or private.has_role(_current_user,'chef_equipe_commercial') then
    if private.is_commercial_assignable(_current_user) then
      return _current_user;
    end if;
  end if;

  -- Pour les autres profils autorisés à ouvrir un dossier Client,
  -- proposer dynamiquement le commercial ayant la plus forte valeur
  -- de contrats attribués, puis le plus grand nombre de Clients,
  -- puis le plus grand nombre de leads convertis.
  select p.user_id
  into v_default
  from public.profiles p
  where p.user_id is not null
    and p.actif = true
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p.user_id
        and ur.role in ('commercial','chef_equipe_commercial','responsable_commercial')
    )
  order by
    coalesce((select sum(coalesce(c.montant_total_contrat,0))
              from public.clients c
              where c.commercial_id = p.user_id),0) desc,
    coalesce((select count(*)
              from public.clients c
              where c.commercial_id = p.user_id),0) desc,
    coalesce((select count(*)
              from public.leads l
              where l.assigned_to = p.user_id
                and l.statut = 'converti'),0) desc,
    p.nom_complet asc
  limit 1;

  return v_default;
end;
$$;

grant execute on function public.get_default_commercial_for_client(uuid) to authenticated;

create or replace function private.validate_client_commercial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.commercial_id is not null
     and not private.is_commercial_assignable(new.commercial_id) then
    raise exception 'Le commercial sélectionné est inactif ou non autorisé à recevoir un Client.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_client_commercial on public.clients;
create trigger trg_validate_client_commercial
before insert or update of commercial_id on public.clients
for each row execute function private.validate_client_commercial();

create or replace function private.can_access_client(_user_id uuid, _client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare c record; p record;
begin
 if _user_id is null or _client_id is null then return false; end if;
 if private.is_global_admin(_user_id)
    or private.has_role(_user_id,'responsable_operations')
    or private.has_role(_user_id,'service_client')
    or private.has_role(_user_id,'chef_equipe_service_client')
    or private.has_role(_user_id,'comptable') then return true; end if;

 select * into c from public.clients where id=_client_id;
 if not found then return false; end if;

 -- Le commercial explicitement responsable doit toujours accéder à son Client.
 if c.commercial_id=_user_id then return true; end if;
 if c.user_id=_user_id or c.created_by=_user_id then return true; end if;

 select * into p from public.profiles where user_id=_user_id limit 1;
 if not found then return false; end if;

 if c.district_id is not null and p.district_id=c.district_id then return true; end if;
 if c.region_id is not null and p.region_id=c.region_id then return true; end if;

 if exists(
   select 1 from public.zone_assignments z
   where z.user_id=_user_id
     and ((z.zone_type='district' and z.zone_id=c.district_id)
       or (z.zone_type='region' and z.zone_id=c.region_id)
       or (z.zone_type='departement' and z.zone_id=c.departement_id)
       or (z.zone_type='sous_prefecture' and z.zone_id=c.sous_prefecture_id))
 ) then return true; end if;

 if p.equipe_id is not null
    and (private.has_role(_user_id,'chef_equipe_commercial')
      or private.has_role(_user_id,'chef_equipe_technique')
      or private.has_role(_user_id,'responsable_commercial')) then
   if exists(
     select 1 from public.profiles member
     where member.equipe_id=p.equipe_id
       and (member.user_id=c.commercial_id
         or member.user_id=c.created_by
         or (c.region_id is not null and member.region_id=c.region_id)
         or (c.district_id is not null and member.district_id=c.district_id)
         or exists(
           select 1 from public.zone_assignments z
           where z.user_id=member.user_id
             and ((z.zone_type='district' and z.zone_id=c.district_id)
               or (z.zone_type='region' and z.zone_id=c.region_id)
               or (z.zone_type='departement' and z.zone_id=c.departement_id)
               or (z.zone_type='sous_prefecture' and z.zone_id=c.sous_prefecture_id))
         )
       )
   ) then return true; end if;
 end if;

 return false;
end;
$function$;
