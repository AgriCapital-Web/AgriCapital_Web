
-- 1. Storage: remove broad anon/authenticated INSERT on documents bucket
DROP POLICY IF EXISTS "Authenticated upload to documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload account-request files" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload non-sensitive docs" ON storage.objects;

-- Replacement: authenticated users upload only to their own user-id folder in documents
CREATE POLICY "Auth upload own folder documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Staff can upload anywhere in documents
CREATE POLICY "Staff upload documents bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND is_staff(auth.uid())
);

-- Authenticated users can also upload profile photos to their own folder
CREATE POLICY "Auth upload own profile photo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos-profils'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. user_roles: explicit RESTRICTIVE deny for INSERT/UPDATE/DELETE by anon/authenticated
CREATE POLICY "Deny authenticated insert user_roles"
ON public.user_roles AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny authenticated update user_roles"
ON public.user_roles AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated delete user_roles"
ON public.user_roles AS RESTRICTIVE FOR DELETE TO anon, authenticated
USING (false);

-- 3. souscriptions_brouillon: restrict to staff drafters only
DROP POLICY IF EXISTS "Users manage own drafts" ON public.souscriptions_brouillon;

CREATE POLICY "Staff manage own drafts"
ON public.souscriptions_brouillon FOR ALL TO authenticated
USING (auth.uid() = created_by AND is_staff(auth.uid()))
WITH CHECK (auth.uid() = created_by AND is_staff(auth.uid()));
