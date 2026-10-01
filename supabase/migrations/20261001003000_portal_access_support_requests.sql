-- Public portal support requests: unauthenticated access-help form -> CRM messaging inbox.
CREATE TABLE IF NOT EXISTS public.portail_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nom_complet text NOT NULL,
  telephone text NOT NULL,
  objet text NOT NULL DEFAULT 'Espace client inaccessible',
  message text NOT NULL,
  canal text NOT NULL DEFAULT 'portail_public',
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','en_cours','resolu','ferme')),
  assigne_a uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_portail_support_requests_client ON public.portail_support_requests(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portail_support_requests_status ON public.portail_support_requests(statut, created_at DESC);

ALTER TABLE public.portail_support_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portail_support_requests FROM anon;
GRANT SELECT, UPDATE ON public.portail_support_requests TO authenticated;
GRANT ALL ON public.portail_support_requests TO service_role;

DROP POLICY IF EXISTS "staff can view portal support requests" ON public.portail_support_requests;
CREATE POLICY "staff can view portal support requests"
ON public.portail_support_requests FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff can update portal support requests" ON public.portail_support_requests;
CREATE POLICY "staff can update portal support requests"
ON public.portail_support_requests FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_portail_support_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.statut IN ('resolu','ferme') AND OLD.statut NOT IN ('resolu','ferme') THEN
    NEW.resolved_at := now();
  ELSIF NEW.statut NOT IN ('resolu','ferme') THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_portail_support_request ON public.portail_support_requests;
CREATE TRIGGER trg_touch_portail_support_request
BEFORE UPDATE ON public.portail_support_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_portail_support_request();

CREATE OR REPLACE FUNCTION public.notify_portail_support_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_client_name text;
BEGIN
  SELECT COALESCE(NULLIF(nom_complet,''),'Client') INTO v_client_name
  FROM public.clients WHERE id = NEW.client_id;

  IF NEW.statut = 'ouvert' THEN
    FOR v_user_id IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('service_client','chef_equipe_service_client')
        AND ur.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications(user_id,type,title,message,data,dedupe_key)
      VALUES(
        v_user_id,
        'support_portail',
        'Demande d''accès au portail',
        COALESCE(NEW.nom_complet,v_client_name) || ' signale un espace client inaccessible.',
        jsonb_build_object('route','/messagerie','support_request_id',NEW.id,'client_id',NEW.client_id),
        'support_portail:' || NEW.id::text || ':user:' || v_user_id::text
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_portail_support_request ON public.portail_support_requests;
CREATE TRIGGER trg_notify_portail_support_request
AFTER INSERT ON public.portail_support_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_portail_support_request();

REVOKE EXECUTE ON FUNCTION public.touch_portail_support_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_portail_support_request() FROM PUBLIC, anon, authenticated;
