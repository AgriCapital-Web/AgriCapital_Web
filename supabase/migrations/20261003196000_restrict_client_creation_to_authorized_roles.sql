DROP POLICY IF EXISTS "Staff can insert clients" ON public.clients;
CREATE POLICY "Authorized staff can insert clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_global_admin(auth.uid())
  OR private.has_role(auth.uid(),'responsable_operations')
  OR private.has_role(auth.uid(),'responsable_commercial')
  OR private.has_role(auth.uid(),'chef_equipe_commercial')
  OR private.has_role(auth.uid(),'commercial')
  OR private.has_role(auth.uid(),'service_client')
  OR private.has_role(auth.uid(),'chef_equipe_service_client')
);