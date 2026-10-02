create or replace function private.can_view_team_performance(_user_id uuid,_team_id uuid,_team_type text)
returns boolean language plpgsql security definer set search_path='' stable as $$
declare p record;
begin
 if _user_id is null then return false; end if;
 if private.is_global_admin(_user_id) or private.has_role(_user_id,'responsable_operations') then return true; end if;
 select * into p from public.profiles where user_id=_user_id limit 1;
 if private.has_role(_user_id,'responsable_commercial') and lower(coalesce(_team_type,''))='commercial' then return true; end if;
 if p.equipe_id=_team_id and ((private.has_role(_user_id,'chef_equipe_commercial') and lower(coalesce(_team_type,''))='commercial') or (private.has_role(_user_id,'chef_equipe_technique') and lower(coalesce(_team_type,''))='technique')) then return true; end if;
 return false;
end; $$;
create or replace view public.v_performance_equipes with(security_barrier=true) as
select e.id,e.nom,e.type_equipe,e.region_id,
case when lower(coalesce(e.type_equipe,'')) like '%commercial%' then (select count(*) from public.clients c join public.profiles p on p.user_id=c.created_by where p.equipe_id=e.id) else 0 end as clients,
case when lower(coalesce(e.type_equipe,'')) like '%commercial%' then coalesce((select sum(coalesce(c.total_hectares,0)) from public.clients c join public.profiles p on p.user_id=c.created_by where p.equipe_id=e.id),0) else 0 end as hectares,
case when lower(coalesce(e.type_equipe,'')) like '%technique%' then (select count(*) from public.interventions_techniques i join public.profiles p on p.id=i.agent_technique_id where p.equipe_id=e.id) else 0 end as interventions
from public.equipes e where e.actif=true and private.can_view_team_performance(auth.uid(),e.id,e.type_equipe);
grant select on public.v_performance_equipes to authenticated;