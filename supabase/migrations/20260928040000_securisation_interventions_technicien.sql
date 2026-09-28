-- Sécurisation du module terrain : les interventions suivent la même matrice d'accès que les rapports.
drop policy if exists "interv_select_staff" on public.interventions_techniques;
drop policy if exists "interv_write_staff" on public.interventions_techniques;

create policy "Technical staff read interventions"
on public.interventions_techniques
for select
to authenticated
using (
  private.has_role((select auth.uid()), 'technicien')
  or private.has_role((select auth.uid()), 'chef_equipe_technique')
  or private.has_role((select auth.uid()), 'responsable_operations')
  or private.has_role((select auth.uid()), 'directeur_tc')
  or private.is_admin((select auth.uid()))
);

create policy "Technician insert interventions"
on public.interventions_techniques
for insert
to authenticated
with check (
  (
    private.has_role((select auth.uid()), 'technicien')
    or private.has_role((select auth.uid()), 'chef_equipe_technique')
    or private.has_role((select auth.uid()), 'responsable_operations')
    or private.has_role((select auth.uid()), 'directeur_tc')
    or private.is_admin((select auth.uid()))
  )
  and (
    agent_technique_id is null
    or exists (
      select 1
      from public.profiles p
      where p.id = interventions_techniques.agent_technique_id
        and p.user_id = (select auth.uid())
    )
    or private.has_role((select auth.uid()), 'chef_equipe_technique')
    or private.has_role((select auth.uid()), 'responsable_operations')
    or private.has_role((select auth.uid()), 'directeur_tc')
    or private.is_admin((select auth.uid()))
  )
);

create policy "Technician update own interventions"
on public.interventions_techniques
for update
to authenticated
using (
  (
    private.has_role((select auth.uid()), 'technicien')
    and exists (
      select 1
      from public.profiles p
      where p.id = interventions_techniques.agent_technique_id
        and p.user_id = (select auth.uid())
    )
  )
  or private.has_role((select auth.uid()), 'chef_equipe_technique')
  or private.has_role((select auth.uid()), 'responsable_operations')
  or private.has_role((select auth.uid()), 'directeur_tc')
  or private.is_admin((select auth.uid()))
)
with check (
  (
    private.has_role((select auth.uid()), 'technicien')
    and exists (
      select 1
      from public.profiles p
      where p.id = interventions_techniques.agent_technique_id
        and p.user_id = (select auth.uid())
    )
  )
  or private.has_role((select auth.uid()), 'chef_equipe_technique')
  or private.has_role((select auth.uid()), 'responsable_operations')
  or private.has_role((select auth.uid()), 'directeur_tc')
  or private.is_admin((select auth.uid()))
);

create index if not exists idx_interventions_techniques_agent_date
  on public.interventions_techniques(agent_technique_id, date_intervention desc);
