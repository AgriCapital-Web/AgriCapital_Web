
-- 1) Owner SELECT for documents bucket (own folder)
DROP POLICY IF EXISTS "Owner read own folder documents" ON storage.objects;
CREATE POLICY "Owner read own folder documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 2) Rate-limit account_requests inserts per email
CREATE OR REPLACE FUNCTION public.rate_limit_account_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recent_email INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_recent_email
  FROM public.account_requests
  WHERE lower(email) = lower(NEW.email)
    AND created_at > now() - interval '1 hour';

  IF v_recent_email >= 3 THEN
    RAISE EXCEPTION 'Trop de demandes pour cet email. Veuillez réessayer plus tard.'
      USING ERRCODE = '42901';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_account_requests ON public.account_requests;
CREATE TRIGGER trg_rate_limit_account_requests
BEFORE INSERT ON public.account_requests
FOR EACH ROW
EXECUTE FUNCTION public.rate_limit_account_requests();
