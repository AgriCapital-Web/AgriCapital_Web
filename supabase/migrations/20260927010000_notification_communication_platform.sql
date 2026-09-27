CREATE TABLE IF NOT EXISTS public.notification_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  description text,
  criteres jsonb NOT NULL DEFAULT '{}'::jsonb,
  actif boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  description text,
  canal text NOT NULL DEFAULT 'app' CHECK (canal IN ('app','email','sms','email_sms')),
  sujet text,
  contenu text NOT NULL,
  segment_id uuid REFERENCES public.notification_segments(id) ON DELETE SET NULL,
  criteres jsonb NOT NULL DEFAULT '{}'::jsonb,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','programme','en_cours','termine','partiel','echoue','annule')),
  programme_le timestamptz,
  demarre_le timestamptz,
  termine_le timestamptz,
  total_destinataires integer NOT NULL DEFAULT 0,
  total_envoyes integer NOT NULL DEFAULT 0,
  total_echecs integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (canal NOT IN ('sms','email_sms') OR (length(contenu) <= 150 AND contenu !~ '[^ -~]'))
);

CREATE TABLE IF NOT EXISTS public.notification_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  description text,
  evenement text NOT NULL,
  canal text NOT NULL DEFAULT 'app' CHECK (canal IN ('app','email','sms','email_sms')),
  sujet text,
  contenu text NOT NULL,
  criteres jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actif boolean NOT NULL DEFAULT false,
  cooldown_minutes integer NOT NULL DEFAULT 0 CHECK (cooldown_minutes >= 0),
  derniere_execution_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (canal NOT IN ('sms','email_sms') OR (length(contenu) <= 150 AND contenu !~ '[^ -~]'))
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.notification_automations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_type text,
  source_id uuid,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  canal text NOT NULL CHECK (canal IN ('app','email','sms')),
  fournisseur text,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','envoye','livre','echoue','ignore')),
  provider_message_id text,
  erreur text,
  contenu text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fournisseur text NOT NULL,
  canal text,
  event_type text NOT NULL,
  provider_message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_statut ON public.notification_campaigns(statut, programme_le);
CREATE INDEX IF NOT EXISTS idx_notification_automations_event ON public.notification_automations(evenement, actif);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_campaign ON public.notification_deliveries(campaign_id, canal, statut);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_automation ON public.notification_deliveries(automation_id, canal, statut);

CREATE OR REPLACE FUNCTION public.notification_resolve_recipients(_criteres jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE (
  source_type text, source_id uuid, user_id uuid, nom_complet text, email text, telephone text,
  role_code text, offre_id uuid, offre_code text, offre_nom text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH contacts AS (
    SELECT 'equipe'::text source_type, p.id source_id, p.user_id, p.nom_complet, p.email,
      COALESCE(p.telephone,p.whatsapp) telephone, ur.role role_code,
      NULL::uuid offre_id, NULL::text offre_code, NULL::text offre_nom
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT r.role FROM public.user_roles r WHERE r.user_id=p.user_id ORDER BY r.created_at LIMIT 1
    ) ur ON true
    WHERE COALESCE(p.actif,true) AND public.is_staff(p.user_id)

    UNION ALL

    SELECT 'client'::text, s.id, s.user_id,
      COALESCE(NULLIF(s.nom_complet,''),concat_ws(' ',s.prenoms,s.nom_famille)),
      s.email, COALESCE(s.telephone,s.whatsapp), NULL::text,
      s.offre_id, o.code, o.nom
    FROM public.souscripteurs s
    LEFT JOIN public.offres o ON o.id=s.offre_id
    WHERE COALESCE(s.statut,'actif') NOT IN ('archive','supprime')

    UNION ALL

    SELECT 'client'::text, a.id, a.user_id, a.nom_complet, a.email,
      COALESCE(a.telephone,a.whatsapp), NULL::text, NULL::uuid, 'agriplan', 'AgriPlan'
    FROM public.agriplan_clients a
    WHERE COALESCE(a.statut,'actif') NOT IN ('archive','supprime')

    UNION ALL

    SELECT 'prospect'::text, l.id, NULL::uuid, concat_ws(' ',l.prenoms,l.nom),
      l.email, COALESCE(l.telephone,l.whatsapp), NULL::text, NULL::uuid, NULL::text, NULL::text
    FROM public.leads l
    WHERE COALESCE(l.statut,'nouveau') NOT IN ('archive','supprime')

    UNION ALL

    SELECT 'prospect'::text, l.id, NULL::uuid, l.nom_complet, NULL::text,
      COALESCE(l.telephone,l.whatsapp), NULL::text, NULL::uuid, 'agriplan', 'AgriPlan'
    FROM public.agriplan_leads l
    WHERE COALESCE(l.statut,'nouveau') NOT IN ('archive','supprime')
  )
  SELECT c.* FROM contacts c
  WHERE (
    COALESCE(_criteres->>'audience','tous') IN ('tous','all')
    OR (COALESCE(_criteres->>'audience','') IN ('clients','client') AND c.source_type='client')
    OR (COALESCE(_criteres->>'audience','') IN ('prospects','prospect') AND c.source_type='prospect')
    OR (COALESCE(_criteres->>'audience','') IN ('equipe','equipe_interne','staff','team') AND c.source_type='equipe')
    OR (COALESCE(_criteres->>'audience','') IN ('commerciaux','commercial')
        AND c.role_code IN ('commercial','responsable_commercial','chef_equipe_commercial','directeur_tc','directeur_technico_commercial'))
    OR (COALESCE(_criteres->>'audience','')='agriplan' AND c.offre_code='agriplan')
    OR (COALESCE(_criteres->>'audience','')='palminvest' AND lower(coalesce(c.offre_code,'')) IN ('palm-invest','palm-invest-plus'))
    OR (COALESCE(_criteres->>'audience','')='terrapalm' AND lower(coalesce(c.offre_code,'')) IN ('terra-palm','terra-palm-plus'))
    OR (COALESCE(_criteres->>'audience','') IN ('palmterroir','palmterroir_plus') AND lower(coalesce(c.offre_code,'')) LIKE 'palm-terroir%')
  )
  AND (NULLIF(_criteres->>'offer_code','') IS NULL OR lower(coalesce(c.offre_code,''))=lower(_criteres->>'offer_code'))
  AND (NULLIF(_criteres->>'role_code','') IS NULL OR c.role_code=_criteres->>'role_code')
  AND (NULLIF(_criteres->>'has_email','') IS NULL OR
       CASE WHEN (_criteres->>'has_email')::boolean THEN nullif(trim(c.email),'') IS NOT NULL ELSE nullif(trim(c.email),'') IS NULL END)
  AND (NULLIF(_criteres->>'has_phone','') IS NULL OR
       CASE WHEN (_criteres->>'has_phone')::boolean THEN nullif(trim(c.telephone),'') IS NOT NULL ELSE nullif(trim(c.telephone),'') IS NULL END)
  AND (NULLIF(_criteres->>'payment_status','') IS NULL OR
       (c.source_type='client' AND EXISTS (
         SELECT 1 FROM public.paiements pa
         WHERE (pa.souscripteur_id=c.source_id OR pa.agriplan_client_id=c.source_id)
           AND pa.statut=_criteres->>'payment_status'
       )));
$$;

REVOKE ALL ON FUNCTION public.notification_resolve_recipients(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_resolve_recipients(jsonb) TO service_role;

ALTER TABLE public.notification_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_provider_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notification_segments,public.notification_campaigns,public.notification_automations,public.notification_deliveries,public.notification_provider_events FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_segments,public.notification_campaigns,public.notification_automations TO authenticated;
GRANT SELECT ON public.notification_deliveries,public.notification_provider_events TO authenticated;
GRANT ALL ON public.notification_segments,public.notification_campaigns,public.notification_automations,public.notification_deliveries,public.notification_provider_events TO service_role;

DROP POLICY IF EXISTS "Staff manage notification segments" ON public.notification_segments;
CREATE POLICY "Staff manage notification segments" ON public.notification_segments FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff manage notification campaigns" ON public.notification_campaigns;
CREATE POLICY "Staff manage notification campaigns" ON public.notification_campaigns FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff manage notification automations" ON public.notification_automations;
CREATE POLICY "Staff manage notification automations" ON public.notification_automations FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff read notification deliveries" ON public.notification_deliveries;
CREATE POLICY "Staff read notification deliveries" ON public.notification_deliveries FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff read notification provider events" ON public.notification_provider_events;
CREATE POLICY "Staff read notification provider events" ON public.notification_provider_events FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

INSERT INTO public.notification_segments(code,nom,description,criteres) VALUES
('tous','Tous les contacts','Clients, prospects et equipes internes','{"audience":"tous"}'),
('clients','Tous les clients','Tous les clients actifs connus de la plateforme','{"audience":"clients"}'),
('prospects','Tous les prospects','Prospects issus des parcours commerciaux','{"audience":"prospects"}'),
('equipe','Equipe interne','Tous les collaborateurs AgriCapital','{"audience":"equipe"}'),
('commerciaux','Commerciaux','Equipe commerciale et encadrement commercial','{"audience":"commerciaux"}'),
('palminvest','Clients PalmInvest','Clients PalmInvest et PalmInvest+','{"audience":"palminvest"}'),
('terrapalm','Clients TerraPalm','Clients TerraPalm et TerraPalm+','{"audience":"terrapalm"}'),
('palmterroir','Clients PalmTerroir','Clients PalmTerroir','{"audience":"palmterroir"}'),
('palmterroir_plus','Clients PalmTerroir+','Clients PalmTerroir+','{"audience":"palmterroir_plus"}')
ON CONFLICT(code) DO UPDATE SET nom=excluded.nom,description=excluded.description,criteres=excluded.criteres,updated_at=now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='notification_cron_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'notification_cron_secret','Secret interne du moteur de notifications AgriCapital');
  END IF;
END $$;

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('daily-payment-reminders','payment-reminders-daily','agricapital-notification-automation')
  LOOP PERFORM cron.unschedule(j.jobid); END LOOP;
END $$;

SELECT cron.schedule(
  'agricapital-notification-automation','*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url:='https://rfzfsmpsuempafhkqhra.supabase.co/functions/v1/notification-dispatch',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'x-agricapital-automation-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='notification_cron_secret')
      ),
      body:='{"mode":"run_automations"}'::jsonb,
      timeout_milliseconds:=10000
    );
  $cron$
);
