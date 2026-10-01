
-- Table pour stocker les codes OTP
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telephone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_telephone ON public.otp_codes(telephone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON public.otp_codes(expires_at);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can manage OTP codes
CREATE POLICY "Service role manages OTP" ON public.otp_codes
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-cleanup old OTP codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.otp_codes WHERE expires_at < now() - interval '1 hour';
$$;
