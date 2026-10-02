drop policy if exists "Technical staff read interventions" on public.interventions_techniques;
create policy "Technical staff read scoped interventions" on public.interventions_techniques for select to authenticated using (
  private.is_global_admin(auth.uid())
  or private.has_role(auth.uid(),'responsable_operations')
  or ((private.has_role(auth.uid(),'technicien') or private.has_role(auth.uid(),'chef_equipe_technique')) and (
    (agent_technique_id is not null and exists(select 1 from public.profiles p where p.id=interventions_techniques.agent_technique_id and p.user_id=auth.uid()))
    or (client_id is not null and private.can_access_client(auth.uid(),client_id))
  ))
);