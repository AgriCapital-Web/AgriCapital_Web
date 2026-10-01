-- Restrict profiles SELECT: users see own profile, staff see all
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;

CREATE POLICY "Users read own profile or staff read all"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_staff(auth.uid()));