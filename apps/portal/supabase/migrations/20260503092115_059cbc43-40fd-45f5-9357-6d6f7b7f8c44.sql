
-- 1. Make sensitive buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('documents', 'documents-fonciers');

-- 2. Add scoped policies for 'documents' bucket
DROP POLICY IF EXISTS "Anyone can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;

CREATE POLICY "Authenticated upload to documents"
ON storage.objects FOR INSERT TO authenticated, anon
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Staff read documents bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.is_staff(auth.uid()));

-- 3. Fix is_staff() to use an allowlist instead of denylist (privilege escalation)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN (
      'super_admin','directeur_tc','directeur_technico_commercial',
      'responsable_zone','superviseur_tc','chef_equipe','comptable',
      'commercial','service_client','operations','agent_terrain','admin'
    )
  )
$$;

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated
-- Keep only those that must be callable (none directly from PostgREST here; called from triggers/policies)
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_hierarchy(text, text, text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otp() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_souscripteur_id() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_plantation_id() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_parcelle_id() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_proprietaire_id() FROM anon, authenticated, public;

-- 5. Explicit deny policies on otp_codes and rate_limits for authenticated users
CREATE POLICY "Deny authenticated otp_codes" ON public.otp_codes
AS RESTRICTIVE FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated rate_limits" ON public.rate_limits
AS RESTRICTIVE FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
