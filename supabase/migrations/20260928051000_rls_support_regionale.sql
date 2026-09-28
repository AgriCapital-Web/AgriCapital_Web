drop policy if exists "Staff manage tickets" on public.tickets_techniques;

create policy "Support staff read tickets" on public.tickets_techniques for select to authenticated
using (private.has_role((select auth.uid()),'service_client') or private.has_role((select auth.uid()),'chef_equipe_service_client') or private.has_role((select auth.uid()),'technicien') or private.has_role((select auth.uid()),'chef_equipe_technique') or private.has_role((select auth.uid()),'responsable_operations') or private.has_role((select auth.uid()),'directeur_tc') or private.is_admin((select auth.uid())));

create policy "Support create client requests" on public.tickets_techniques for insert to authenticated
with check (private.has_role((select auth.uid()),'service_client') or private.has_role((select auth.uid()),'chef_equipe_service_client') or private.has_role((select auth.uid()),'responsable_operations') or private.has_role((select auth.uid()),'directeur_tc') or private.is_admin((select auth.uid())));

create policy "Support managers update requests" on public.tickets_techniques for update to authenticated
using (private.has_role((select auth.uid()),'service_client') or private.has_role((select auth.uid()),'chef_equipe_service_client') or private.has_role((select auth.uid()),'responsable_operations') or private.has_role((select auth.uid()),'directeur_tc') or private.is_admin((select auth.uid())))
with check (private.has_role((select auth.uid()),'service_client') or private.has_role((select auth.uid()),'chef_equipe_service_client') or private.has_role((select auth.uid()),'responsable_operations') or private.has_role((select auth.uid()),'directeur_tc') or private.is_admin((select auth.uid())));

create policy "Technician update assigned requests" on public.tickets_techniques for update to authenticated
using (private.has_role((select auth.uid()),'technicien') and exists (select 1 from profiles p where p.id=tickets_techniques.assigne_a and p.user_id=(select auth.uid())))
with check (private.has_role((select auth.uid()),'technicien') and exists (select 1 from profiles p where p.id=tickets_techniques.assigne_a and p.user_id=(select auth.uid())));
