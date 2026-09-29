-- 2026-09-29 — Portail unifié : propriétaires fonciers, bénéficiaires particuliers,
-- messagerie CRM ↔ portail et notifications sans doublons.
--
-- Principe : le portail reste centré sur public.clients. Les propriétaires fonciers
-- reçoivent un dossier client technique (sans offre ni paiement) lié à proprietaires_terres.
-- Les bénéficiaires particuliers conservent leur dossier client et deviennent actifs portail.
-- Aucun accès direct anon/authenticated aux tables de session : les Edge Functions utilisent
-- le service role après vérification du téléphone + code.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS proprietaire_id uuid REFERENCES public.proprietaires_terres(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_proprietaire_portal
  ON public.clients(proprietaire_id)
  WHERE proprietaire_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_portal_phone ON public.clients(telephone);
CREATE INDEX IF NOT EXISTS idx_clients_type_client ON public.clients(type_client);

-- Les bénéficiaires particuliers sont des utilisateurs du portail même sans paiement.
CREATE OR REPLACE FUNCTION public.ensure_beneficiaire_portal_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.type_client = 'beneficiaire_particulier' THEN
    NEW.compte_actif := true;
    NEW.statut_global := 'actif';
    NEW.statut := 'actif';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_beneficiaire_portal_active ON public.clients;
CREATE TRIGGER trg_beneficiaire_portal_active
BEFORE INSERT OR UPDATE OF type_client, compte_actif ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.ensure_beneficiaire_portal_active();

UPDATE public.clients
SET compte_actif = true, statut_global = 'actif', statut = 'actif'
WHERE type_client = 'beneficiaire_particulier';

-- Dossier portail technique du propriétaire foncier.
CREATE OR REPLACE FUNCTION public.sync_proprietaire_portal_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client_id uuid;
  v_phone text;
  v_name text;
BEGIN
  v_phone := NULLIF(TRIM(COALESCE(NEW.telephone, NEW.whatsapp, '')), '');
  v_name := COALESCE(NULLIF(TRIM(NEW.nom_complet), ''), NULLIF(TRIM(CONCAT_WS(' ', NEW.nom, NEW.prenoms)), ''), 'Propriétaire foncier');

  SELECT id INTO v_client_id
  FROM public.clients
  WHERE proprietaire_id = NEW.id
  LIMIT 1;

  IF v_client_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT c.id INTO v_client_id
    FROM public.clients c
    WHERE regexp_replace(COALESCE(c.telephone,''),'\\D','','g') =
          regexp_replace(v_phone,'\\D','','g')
    ORDER BY CASE WHEN c.type_client='beneficiaire_particulier' THEN 0 ELSE 1 END, c.created_at
    LIMIT 1;
  END IF;

  IF v_phone IS NULL THEN
    IF v_client_id IS NOT NULL THEN
      UPDATE public.clients
      SET proprietaire_id = NEW.id,
          updated_by = NEW.updated_by,
          updated_at = now()
      WHERE id = v_client_id;
    END IF;
    RETURN NEW;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients(
      user_id, civilite, nom_famille, prenoms, nom_complet, nom,
      type_client, type_client_foncier, telephone, whatsapp, email,
      statut, statut_global, compte_actif, total_hectares, nombre_plantations,
      parcours_code, contrat_acquisition_statut, contrat_accompagnement_statut,
      proprietaire_id, created_by, updated_by
    )
    VALUES(
      NULL, NEW.civilite, NEW.nom, NEW.prenoms, v_name, NEW.nom,
      'proprietaire_foncier', 'EXT', v_phone, NEW.whatsapp, NEW.email,
      'actif', 'actif', true, COALESCE(NEW.surface_totale_ha,0), COALESCE(NEW.nombre_parcelles,0),
      'proprietaire_foncier', 'non_requis', 'non_requis',
      NEW.id, NEW.created_by, NEW.updated_by
    )
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clients
    SET civilite = COALESCE(NEW.civilite,civilite),
        nom_famille = COALESCE(NEW.nom,nom_famille),
        prenoms = COALESCE(NEW.prenoms,prenoms),
        nom_complet = CASE WHEN type_client='proprietaire_foncier' THEN v_name ELSE nom_complet END,
        nom = COALESCE(NEW.nom,nom),
        telephone = v_phone,
        whatsapp = COALESCE(NEW.whatsapp,whatsapp),
        email = COALESCE(NEW.email,email),
        statut_global = 'actif',
        compte_actif = true,
        proprietaire_id = NEW.id,
        updated_by = NEW.updated_by,
        updated_at = now()
    WHERE id = v_client_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proprietaire_portal_client ON public.proprietaires_terres;
CREATE TRIGGER trg_proprietaire_portal_client
AFTER INSERT OR UPDATE OF civilite,nom,prenoms,nom_complet,telephone,whatsapp,email,surface_totale_ha,nombre_parcelles,statut
ON public.proprietaires_terres
FOR EACH ROW EXECUTE FUNCTION public.sync_proprietaire_portal_client();

-- Backfill : réutilise un dossier client existant lorsque le téléphone correspond.
UPDATE public.clients c
SET proprietaire_id = p.id,
    updated_by = COALESCE(p.updated_by,c.updated_by),
    updated_at = now()
FROM public.proprietaires_terres p
WHERE c.proprietaire_id IS NULL
  AND NULLIF(TRIM(COALESCE(p.telephone,p.whatsapp,'')),'') IS NOT NULL
  AND regexp_replace(COALESCE(c.telephone,''),'\\D','','g') =
      regexp_replace(COALESCE(p.telephone,p.whatsapp,''),'\\D','','g')
  AND NOT EXISTS (
    SELECT 1 FROM public.clients x WHERE x.proprietaire_id = p.id
  );

INSERT INTO public.clients(
  user_id, civilite, nom_famille, prenoms, nom_complet, nom,
  type_client, type_client_foncier, telephone, whatsapp, email,
  statut, statut_global, compte_actif, total_hectares, nombre_plantations,
  parcours_code, contrat_acquisition_statut, contrat_accompagnement_statut,
  proprietaire_id, created_by, updated_by
)
SELECT
  NULL, p.civilite, p.nom, p.prenoms,
  COALESCE(NULLIF(TRIM(p.nom_complet),''),NULLIF(TRIM(CONCAT_WS(' ',p.nom,p.prenoms)),''),'Propriétaire foncier'),
  p.nom, 'proprietaire_foncier','EXT',
  NULLIF(TRIM(COALESCE(p.telephone,p.whatsapp,'')),''),
  p.whatsapp,p.email,'actif','actif',true,
  COALESCE(p.surface_totale_ha,0),COALESCE(p.nombre_parcelles,0),
  'proprietaire_foncier','non_requis','non_requis',
  p.id,p.created_by,p.updated_by
FROM public.proprietaires_terres p
WHERE NULLIF(TRIM(COALESCE(p.telephone,p.whatsapp,'')),'') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.proprietaire_id=p.id);

-- Notifications du portail : séparées des notifications Auth du CRM.
CREATE TABLE IF NOT EXISTS public.portail_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.portail_messages(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'communication',
  title text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portail_notifications_client
  ON public.portail_notifications(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portail_notifications_unread
  ON public.portail_notifications(client_id, read, created_at DESC);

ALTER TABLE public.portail_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portail_notifications FROM anon, authenticated;
GRANT ALL ON public.portail_notifications TO service_role;

-- Dédoublonnage durable côté CRM.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe_key
  ON public.notifications(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Une insertion de message est la source unique des notifications.
CREATE OR REPLACE FUNCTION public.notify_portail_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client public.clients%rowtype;
  v_user_id uuid;
  v_role text;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;

  IF NEW.auteur_type = 'staff' THEN
    INSERT INTO public.portail_notifications(client_id,message_id,type,title,message,data,dedupe_key)
    VALUES(
      NEW.client_id, NEW.id, 'message',
      COALESCE(NULLIF(NEW.auteur_nom,''),'AgriCapital'),
      LEFT(NEW.message, 500),
      jsonb_build_object('route','messagerie','message_id',NEW.id),
      'portail_message:' || NEW.id::text
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSE
    -- Priorité au créateur du dossier.
    IF v_client.created_by IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,message,data,dedupe_key)
      VALUES(
        v_client.created_by, 'message_portail',
        'Nouveau message portail',
        COALESCE(v_client.nom_complet,'Un client') || ' vous a écrit.',
        jsonb_build_object('route','/messagerie','client_id',NEW.client_id,'message_id',NEW.id),
        'portail_message:' || NEW.id::text || ':user:' || v_client.created_by::text
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;

    -- Le Service Client reçoit aussi le message pour éviter qu'un dossier reste sans réponse.
    FOR v_user_id IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('service_client','chef_equipe_service_client')
        AND ur.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications(user_id,type,title,message,data,dedupe_key)
      VALUES(
        v_user_id, 'message_portail',
        'Nouveau message portail',
        COALESCE(v_client.nom_complet,'Un client') || ' vous a écrit.',
        jsonb_build_object('route','/messagerie','client_id',NEW.client_id,'message_id',NEW.id),
        'portail_message:' || NEW.id::text || ':user:' || v_user_id::text
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_portail_message ON public.portail_messages;
CREATE TRIGGER trg_notify_portail_message
AFTER INSERT ON public.portail_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_portail_message();

-- Source de vérité unique pour les campagnes/automatisations : public.clients.
-- Les anciennes tables historiques ne sont plus interrogées.
DROP FUNCTION IF EXISTS public.notification_resolve_recipients(jsonb);
CREATE OR REPLACE FUNCTION public.notification_resolve_recipients(_criteres jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE (
  source_type text, source_id uuid, user_id uuid, nom_complet text, email text, telephone text,
  role_code text, offre_id uuid, offre_code text, offre_nom text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH contacts AS (
    SELECT 'equipe'::text AS source_type, p.id AS source_id, p.user_id AS user_id, p.nom_complet AS nom_complet, p.email AS email,
      COALESCE(p.telephone,p.whatsapp) AS telephone, ur.role AS role_code,
      NULL::uuid AS offre_id, NULL::text AS offre_code, NULL::text AS offre_nom
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT r.role FROM public.user_roles r
      WHERE r.user_id=p.user_id ORDER BY r.created_at LIMIT 1
    ) ur ON true
    WHERE COALESCE(p.actif,true) AND public.is_staff(p.user_id)

    UNION ALL

    SELECT
      CASE
        WHEN c.proprietaire_id IS NOT NULL AND c.type_client='beneficiaire_particulier' THEN 'proprietaire_foncier+beneficiaire_particulier'
        WHEN c.proprietaire_id IS NOT NULL THEN 'proprietaire_foncier'
        WHEN c.type_client='beneficiaire_particulier' THEN 'beneficiaire_particulier'
        ELSE 'client'
      END AS source_type,
      c.id AS source_id, c.user_id AS user_id,
      COALESCE(NULLIF(c.nom_complet,''),concat_ws(' ',c.prenoms,c.nom_famille)) AS nom_complet,
      c.email AS email, COALESCE(c.telephone,c.whatsapp) AS telephone,
      NULL::text AS role_code, c.offre_id AS offre_id, o.code AS offre_code, o.nom AS offre_nom
    FROM public.clients c
    LEFT JOIN public.offres o ON o.id=c.offre_id
    WHERE COALESCE(c.statut_global,'actif') NOT IN ('archive','supprime')
      AND COALESCE(c.compte_actif,true)
  )
  SELECT c.*
  FROM contacts c
  WHERE
    COALESCE(_criteres->>'audience','tous') IN ('tous','all')
    OR (COALESCE(_criteres->>'audience','') IN ('clients','client') AND c.source_type='client')
    OR (COALESCE(_criteres->>'audience','') IN ('proprietaires_fonciers','proprietaire_foncier','owners') AND c.source_type LIKE 'proprietaire_foncier%')
    OR (COALESCE(_criteres->>'audience','') IN ('beneficiaires_particuliers','beneficiaire_particulier','beneficiaries') AND c.source_type LIKE '%beneficiaire_particulier%')
    OR (COALESCE(_criteres->>'audience','') IN ('equipe','equipe_interne','staff','team') AND c.source_type='equipe')
    OR (COALESCE(_criteres->>'audience','')='commerciaux' AND c.role_code IN ('commercial','responsable_commercial','chef_equipe_commercial'))
    OR (COALESCE(_criteres->>'audience','')='palminvest' AND lower(coalesce(c.offre_code,'')) LIKE 'palm-invest%')
    OR (COALESCE(_criteres->>'audience','')='terrapalm' AND lower(coalesce(c.offre_code,'')) LIKE 'terra-palm%')
    OR (COALESCE(_criteres->>'audience','') IN ('palmterroir','palmterroir_plus') AND lower(coalesce(c.offre_code,'')) LIKE 'palm-terroir%')
  AND (NULLIF(_criteres->>'offer_code','') IS NULL OR lower(coalesce(c.offre_code,''))=lower(_criteres->>'offer_code'))
  AND (NULLIF(_criteres->>'role_code','') IS NULL OR c.role_code=_criteres->>'role_code')
  AND (NULLIF(_criteres->>'has_email','') IS NULL OR
    CASE WHEN (_criteres->>'has_email')::boolean THEN NULLIF(TRIM(c.email),'') IS NOT NULL ELSE NULLIF(TRIM(c.email),'') IS NULL END)
  AND (NULLIF(_criteres->>'has_phone','') IS NULL OR
    CASE WHEN (_criteres->>'has_phone')::boolean THEN NULLIF(TRIM(c.telephone),'') IS NOT NULL ELSE NULLIF(TRIM(c.telephone),'') IS NULL END);
$$;

REVOKE ALL ON FUNCTION public.notification_resolve_recipients(jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_resolve_recipients(jsonb) TO service_role;

-- Realtime : les équipes CRM reçoivent les nouveaux messages immédiatement.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='portail_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.portail_messages;
  END IF;
END;
$$;

-- Garantit que les dossiers créés par la RPC bénéficiaire sont portail-actifs.
UPDATE public.clients
SET compte_actif=true, statut_global='actif', statut='actif'
WHERE type_client='beneficiaire_particulier';

-- Nettoyage des notifications strictement identiques déjà présentes :
-- on conserve la plus ancienne par clé métier quand elle est disponible.
DELETE FROM public.notifications a
USING public.notifications b
WHERE a.dedupe_key IS NOT NULL
  AND a.dedupe_key = b.dedupe_key
  AND a.created_at > b.created_at;
