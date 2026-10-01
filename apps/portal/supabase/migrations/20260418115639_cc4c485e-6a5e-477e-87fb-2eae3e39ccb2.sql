
-- 1) Fix overly permissive uploads to sensitive buckets (pieces-identite must be staff-only)
DROP POLICY IF EXISTS "Auth upload docs" ON storage.objects;

-- Allow any authenticated user to upload to non-sensitive buckets only
CREATE POLICY "Auth upload non-sensitive docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('documents', 'photos-profils')
);

-- Restrict uploads to pieces-identite to staff only
CREATE POLICY "Staff upload pieces-identite"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pieces-identite'
  AND public.is_staff(auth.uid())
);

-- 2) Restrict SELECT on pieces-identite to staff only (currently any authenticated user can read)
DROP POLICY IF EXISTS "Staff read pieces" ON storage.objects;

CREATE POLICY "Staff read pieces-identite"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pieces-identite'
  AND public.is_staff(auth.uid())
);

-- Allow staff to update/delete pieces-identite
CREATE POLICY "Staff manage pieces-identite"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'pieces-identite' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'pieces-identite' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete pieces-identite"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'pieces-identite' AND public.is_staff(auth.uid()));

-- 3) Remove sensitive tables from Realtime publication to prevent broadcast leaks
-- Keep public reference tables (districts, regions, villages, offres, promotions) and notifications (already user-scoped)
ALTER PUBLICATION supabase_realtime DROP TABLE public.souscripteurs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.paiements;
ALTER PUBLICATION supabase_realtime DROP TABLE public.commissions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.portefeuilles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.retraits_portefeuille;
ALTER PUBLICATION supabase_realtime DROP TABLE public.account_requests;
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.equipes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.plantations;
ALTER PUBLICATION supabase_realtime DROP TABLE public.tickets_techniques;
