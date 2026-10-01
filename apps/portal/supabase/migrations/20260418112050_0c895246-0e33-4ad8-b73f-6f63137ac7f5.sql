-- Tighten user_roles SELECT: only own role or staff/admin can read
DROP POLICY IF EXISTS "Authenticated can read roles" ON public.user_roles;

CREATE POLICY "Users read own roles or staff read all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_staff(auth.uid())
);

-- Tighten equipes SELECT: only internal staff can view team structure
DROP POLICY IF EXISTS "Staff can view equipes" ON public.equipes;

CREATE POLICY "Staff can view equipes"
ON public.equipes
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));