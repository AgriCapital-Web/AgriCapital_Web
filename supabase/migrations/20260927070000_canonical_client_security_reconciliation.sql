-- Canonical production reconciliation: Clients / Acquisitions / Équipe technique.
-- This migration is intentionally idempotent so a fresh environment can converge
-- on the same canonical state without retaining the legacy business vocabulary.

ALTER TABLE IF EXISTS public.souscripteurs RENAME TO clients;
ALTER TABLE IF EXISTS public.documents_souscription RENAME TO documents_acquisition;
ALTER TABLE IF EXISTS public.souscription_lots RENAME TO acquisition_lots;
ALTER TABLE IF EXISTS public.souscriptions_brouillon RENAME TO acquisitions_brouillon;
ALTER VIEW IF EXISTS public.v_souscripteur_synthese RENAME TO v_client_synthese;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_schema,table_name,column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND column_name IN ('souscripteur_id','souscripteur_dest_id','souscripteur_source_id','type_souscripteur','type_souscripteur_foncier','technicien_id','technicien_nom')
  LOOP
    IF r.column_name='souscripteur_id' THEN EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO client_id',r.table_schema,r.table_name,r.column_name);
    ELSIF r.column_name='souscripteur_dest_id' THEN EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO client_dest_id',r.table_schema,r.table_name,r.column_name);
    ELSIF r.column_name='souscripteur_source_id' THEN EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO client_source_id',r.table_schema,r.table_name,r.column_name);
    ELSIF r.column_name='type_souscripteur' THEN EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO type_client',r.table_schema,r.table_name,r.column_name);
    ELSIF r.column_name='type_souscripteur_foncier' THEN EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO type_client_foncier',r.table_schema,r.table_name,r.column_name);
    ELSIF r.column_name='technicien_id' THEN EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO agent_technique_id',r.table_schema,r.table_name,r.column_name);
    ELSIF r.column_name='technicien_nom' THEN EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO agent_technique_nom',r.table_schema,r.table_name,r.column_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE r record; new_name text;
BEGIN
  FOR r IN SELECT n.nspname,c.relname,i.relname FROM pg_class i
    JOIN pg_index ix ON ix.indexrelid=i.oid JOIN pg_class c ON c.oid=ix.indrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND i.relname ~* '(souscripteur|souscription|planteur|technicien)'
  LOOP
    new_name:=replace(replace(replace(replace(r.relname,'souscripteur','client'),'souscription','acquisition'),'planteur','client'),'technicien','agent_technique');
    IF new_name<>r.relname AND NOT EXISTS(SELECT 1 FROM pg_class x JOIN pg_namespace nx ON nx.oid=x.relnamespace WHERE nx.nspname='public' AND x.relname=new_name) THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I',r.relname,new_name);
    END IF;
  END LOOP;
  FOR r IN SELECT n.nspname,c.relname,con.conname FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND con.conname ~* '(souscripteur|souscription|planteur|technicien)'
  LOOP
    new_name:=replace(replace(replace(replace(r.conname,'souscripteur','client'),'souscription','acquisition'),'planteur','client'),'technicien','agent_technique');
    BEGIN EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',r.relname,r.conname,new_name); EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;

DO $$
DECLARE r record; d text;
BEGIN
  IF to_regclass('public.souscripteur_global_counter') IS NOT NULL AND to_regclass('public.client_global_counter') IS NULL THEN
    ALTER SEQUENCE public.souscripteur_global_counter RENAME TO client_global_counter;
  END IF;

  IF to_regprocedure('public.agriplant_fill_souscripteur()') IS NOT NULL THEN ALTER FUNCTION public.agriplant_fill_souscripteur() RENAME TO agriplant_fill_client; END IF;
  IF to_regprocedure('public.generate_numero_contrat_souscripteur()') IS NOT NULL THEN ALTER FUNCTION public.generate_numero_contrat_souscripteur() RENAME TO generate_numero_contrat_client; END IF;
  IF to_regprocedure('public.generate_souscripteur_id()') IS NOT NULL THEN ALTER FUNCTION public.generate_souscripteur_id() RENAME TO generate_client_id; END IF;
  IF to_regprocedure('public.sync_subscriber_contract_status()') IS NOT NULL THEN ALTER FUNCTION public.sync_subscriber_contract_status() RENAME TO sync_client_contract_status; END IF;
  IF to_regprocedure('public.trg_souscripteur_recompute()') IS NOT NULL THEN ALTER FUNCTION public.trg_souscripteur_recompute() RENAME TO trg_client_recompute; END IF;
  IF to_regprocedure('public.update_souscripteur_stats()') IS NOT NULL THEN ALTER FUNCTION public.update_souscripteur_stats() RENAME TO update_client_stats; END IF;
  IF to_regprocedure('public.enforce_souscripteur_refund_update()') IS NOT NULL THEN ALTER FUNCTION public.enforce_souscripteur_refund_update() RENAME TO enforce_client_refund_update; END IF;

  FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (pg_get_functiondef(p.oid) ILIKE '%souscripteur%' OR pg_get_functiondef(p.oid) ILIKE '%souscription%' OR pg_get_functiondef(p.oid) ILIKE '%technicien%')
  LOOP
    d:=pg_get_functiondef(r.oid);
    d:=replace(d,'souscripteurs','clients'); d:=replace(d,'souscripteur_id','client_id');
    d:=replace(d,'souscripteur_dest_id','client_dest_id'); d:=replace(d,'souscripteur_source_id','client_source_id');
    d:=replace(d,'type_souscripteur_foncier','type_client_foncier'); d:=replace(d,'type_souscripteur','type_client');
    d:=replace(d,'documents_souscription','documents_acquisition'); d:=replace(d,'souscription_lots','acquisition_lots');
    d:=replace(d,'souscriptions_brouillon','acquisitions_brouillon'); d:=replace(d,'v_souscripteur_synthese','v_client_synthese');
    d:=replace(d,'agriplant_fill_souscripteur','agriplant_fill_client'); d:=replace(d,'generate_numero_contrat_souscripteur','generate_numero_contrat_client');
    d:=replace(d,'generate_souscripteur_id','generate_client_id'); d:=replace(d,'get_subscriber_effective_di','get_client_effective_di');
    d:=replace(d,'sync_subscriber_contract_status','sync_client_contract_status'); d:=replace(d,'trg_souscripteur_recompute','trg_client_recompute');
    d:=replace(d,'update_souscripteur_stats','update_client_stats'); d:=replace(d,'enforce_souscripteur_refund_update','enforce_client_refund_update');
    d:=replace(d,'technicien_id','agent_technique_id'); d:=replace(d,'technicien_nom','agent_technique_nom');
    EXECUTE d;
  END LOOP;
END $$;

UPDATE public.offres SET montant_depot_initial_par_ha=65000,montant_da_par_ha=65000,montant_total_par_ha=518600,montant_cash_par_ha=518600,duree_paiement_mois=36,duree_installation_mois=36,contribution_mensuelle_par_ha=12600,
tranches_paiement='[{"annee":1,"mois_debut":1,"mois_fin":12,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200},{"annee":3,"mois_debut":25,"mois_fin":36,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200}]'::jsonb
WHERE code='palm-terroir-flexible';

UPDATE public.user_roles SET role='responsable_commercial' WHERE role IN ('responsable_zone','superviseur_tc');
UPDATE public.user_roles SET role='responsable_operations' WHERE role IN ('operations','responsable_technique_agronomique');
UPDATE public.user_roles SET role='chef_equipe_commercial' WHERE role='chef_equipe';
UPDATE public.user_roles SET role='chef_equipe_technique' WHERE role='technicien';
UPDATE public.user_roles SET role='service_client' WHERE role IN ('agent_service_client','souscripteur');
UPDATE public.user_roles SET role='assistant_administratif' WHERE role IN ('assistant','assistante','secretaire');
UPDATE public.user_roles SET role='comptable' WHERE role='raf';
UPDATE public.user_roles SET role='associe_actionnaire' WHERE role IN ('associe','actionnaire');

UPDATE public.grille_remuneration SET role_cible='equipe_technique' WHERE role_cible='technicien';
UPDATE public.grille_remuneration SET type_remuneration='acquisition' WHERE type_remuneration='souscription';

UPDATE public.notification_templates
SET nom=replace(replace(nom,'souscription','acquisition'),'Souscription','Acquisition'),
    code=replace(code,'souscription','acquisition'),
    sujet=replace(replace(sujet,'souscription','acquisition'),'Souscription','Acquisition'),
    contenu=replace(replace(replace(contenu,'souscription','acquisition'),'Souscription','Acquisition'),'technicien','agent technique'),
    evenement=replace(evenement,'souscription','acquisition'),
    variables=replace(replace(variables::text,'technicien','agent_technique'),'souscripteur','client')::jsonb
WHERE to_jsonb(notification_templates)::text ~* '(souscription|souscripteur|technicien)';

UPDATE public.configurations_systeme
SET cle=replace(cle,'souscription','acquisition'),categorie=replace(categorie,'souscriptions','acquisitions'),description=replace(description,'souscription','acquisition')
WHERE to_jsonb(configurations_systeme)::text ~* '(souscription|souscripteur)';

UPDATE public.acquisitions_brouillon
SET donnees=replace(replace(donnees::text,'type_souscripteur','type_client'),'souscripteur','client')::jsonb
WHERE donnees::text ~* '(souscripteur|souscription)';

UPDATE public.app_roles SET description=replace(replace(description,'souscriptions','acquisitions'),'souscription','acquisition') WHERE description ILIKE '%souscript%';

DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) args
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef=true
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',r.proname,r.args);
 END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r record; using_sql text; check_sql text; cmd_sql text; stmt text;
BEGIN
 FOR r IN
   SELECT p.polname,p.polrelid,p.polcmd,p.polpermissive,pg_get_expr(p.polqual,p.polrelid) qual,pg_get_expr(p.polwithcheck,p.polrelid) with_check,
          n.nspname,c.relname,
          CASE WHEN cardinality(p.polroles)=0 THEN 'PUBLIC' ELSE (SELECT string_agg(quote_ident(rolname),', ') FROM pg_roles WHERE oid=ANY(p.polroles)) END roles_sql
   FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
 LOOP
  using_sql:=r.qual; check_sql:=r.with_check;
  IF using_sql IS NOT NULL THEN using_sql:=replace(replace(replace(using_sql,'auth.uid()','(select auth.uid())'),'auth.role()','(select auth.role())'),'auth.jwt()','(select auth.jwt())'); END IF;
  IF check_sql IS NOT NULL THEN check_sql:=replace(replace(replace(check_sql,'auth.uid()','(select auth.uid())'),'auth.role()','(select auth.role())'),'auth.jwt()','(select auth.jwt())'); END IF;
  IF using_sql IS NOT DISTINCT FROM r.qual AND check_sql IS NOT DISTINCT FROM r.with_check THEN CONTINUE; END IF;
  EXECUTE format('DROP POLICY %I ON %I.%I',r.polname,r.nspname,r.relname);
  cmd_sql:=CASE r.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END;
  stmt:=format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',r.polname,r.nspname,r.relname,CASE WHEN r.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,cmd_sql,r.roles_sql);
  IF using_sql IS NOT NULL THEN stmt:=stmt||format(' USING (%s)',using_sql); END IF;
  IF check_sql IS NOT NULL THEN stmt:=stmt||format(' WITH CHECK (%s)',check_sql); END IF;
  EXECUTE stmt;
 END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.relname);
 END LOOP;
END $$;