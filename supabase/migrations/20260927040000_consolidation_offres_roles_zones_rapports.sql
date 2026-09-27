-- Canonical commercial offers, governance, zones and technical visit reporting.
-- Applied to Supabase App on 2026-09-27.

UPDATE public.offres SET montant_total_par_ha=2465200,montant_depot_initial_par_ha=90700,montant_da_par_ha=90700,contribution_mensuelle_par_ha=83800,duree_paiement_mois=40,duree_installation_mois=36,tranches_paiement='[{"type":"paiement_initial","mois":1,"mensualite_par_ha":0,"montant":90700},{"annee":1,"mois_debut":2,"mois_fin":12,"mois":11,"mensualite_par_ha":31900,"total_periode_par_ha":350900},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":56900,"total_periode_par_ha":682800},{"annee":3,"mois_debut":25,"mois_fin":40,"mois":16,"mensualite_par_ha":83800,"total_periode_par_ha":1340800}]'::jsonb WHERE code IN ('palm-invest','palm-invest-plus');
UPDATE public.offres SET montant_total_par_ha=1620200,montant_depot_initial_par_ha=84700,montant_da_par_ha=84700,contribution_mensuelle_par_ha=49800,duree_paiement_mois=40,duree_installation_mois=36,tranches_paiement='[{"type":"paiement_initial","mois":1,"mensualite_par_ha":0,"montant":84700},{"annee":1,"mois_debut":2,"mois_fin":12,"mois":11,"mensualite_par_ha":26900,"total_periode_par_ha":295900},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":36900,"total_periode_par_ha":442800},{"annee":3,"mois_debut":25,"mois_fin":40,"mois":16,"mensualite_par_ha":49800,"total_periode_par_ha":796800}]'::jsonb WHERE code IN ('terra-palm','terra-palm-plus');
UPDATE public.offres SET montant_total_par_ha=356000,montant_depot_initial_par_ha=230000,montant_da_par_ha=230000,contribution_mensuelle_par_ha=3500,duree_paiement_mois=36,duree_installation_mois=36,tranches_paiement='[{"annee":1,"mois_debut":1,"mois_fin":12,"mois":12,"mensualite_par_ha":3500,"total_periode_par_ha":42000},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":3500,"total_periode_par_ha":42000},{"annee":3,"mois_debut":25,"mois_fin":36,"mois":12,"mensualite_par_ha":3500,"total_periode_par_ha":42000}]'::jsonb WHERE code='palm-terroir-essentielle';
UPDATE public.offres SET montant_total_par_ha=683600,montant_depot_initial_par_ha=230000,montant_da_par_ha=230000,contribution_mensuelle_par_ha=12600,duree_paiement_mois=36,duree_installation_mois=36,tranches_paiement='[{"annee":1,"mois_debut":1,"mois_fin":12,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200},{"annee":2,"mois_debut":13,"mois_fin":24,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200},{"annee":3,"mois_debut":25,"mois_fin":36,"mois":12,"mensualite_par_ha":12600,"total_periode_par_ha":151200}]'::jsonb WHERE code='palm-terroir-flexible';

INSERT INTO public.app_roles(code,nom,court,description,niveau,niveau_label,actif) VALUES ('associe_actionnaire','Associé / Actionnaire','A/A','Lecture seule des indicateurs, ventes, clients, plantations et finances autorisées; aucun accès aux paramètres.',2,'Gouvernance',true)
ON CONFLICT(code) DO UPDATE SET nom=excluded.nom,court=excluded.court,description=excluded.description,niveau=excluded.niveau,niveau_label=excluded.niveau_label,actif=true,updated_at=now();
DELETE FROM public.role_permissions WHERE role_code='associe_actionnaire';
INSERT INTO public.role_permissions(role_code,permission_code) VALUES ('associe_actionnaire','offres.view'),('associe_actionnaire','promotions.view'),('associe_actionnaire','leads.view'),('associe_actionnaire','clients.view'),('associe_actionnaire','plantations.view'),('associe_actionnaire','paiements.view'),('associe_actionnaire','documents.view'),('associe_actionnaire','rapports.view_technique'),('associe_actionnaire','rapports.view_financier'),('associe_actionnaire','rapports.export'),('associe_actionnaire','commissions.view'),('associe_actionnaire','tickets.view');

CREATE TABLE IF NOT EXISTS public.rapports_visites_techniques(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plantation_id uuid NOT NULL REFERENCES public.plantations(id) ON DELETE CASCADE,
 souscripteur_id uuid REFERENCES public.souscripteurs(id) ON DELETE SET NULL, technicien_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 date_visite timestamptz NOT NULL DEFAULT now(), type_visite text NOT NULL DEFAULT 'suivi', observations text,recommandations text,
 statut text NOT NULL DEFAULT 'brouillon',client_visible boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS public.rapports_visites_medias(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),rapport_id uuid NOT NULL REFERENCES public.rapports_visites_techniques(id) ON DELETE CASCADE,
 plantation_id uuid NOT NULL REFERENCES public.plantations(id) ON DELETE CASCADE,media_type text NOT NULL CHECK(media_type IN ('photo','video')),
 storage_path text NOT NULL,mime_type text,nom_fichier text,description text,client_visible boolean NOT NULL DEFAULT false,
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_rvt_plantation_date ON public.rapports_visites_techniques(plantation_id,date_visite DESC);
CREATE INDEX IF NOT EXISTS idx_rvm_rapport ON public.rapports_visites_medias(rapport_id,created_at DESC);
ALTER TABLE public.rapports_visites_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapports_visites_medias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage technical visit reports" ON public.rapports_visites_techniques;
CREATE POLICY "Staff manage technical visit reports" ON public.rapports_visites_techniques FOR ALL TO authenticated USING(public.is_staff(auth.uid())) WITH CHECK(public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Client read own technical visit reports" ON public.rapports_visites_techniques;
CREATE POLICY "Client read own technical visit reports" ON public.rapports_visites_techniques FOR SELECT TO authenticated USING(client_visible AND EXISTS(SELECT 1 FROM public.souscripteurs s WHERE s.id=rapports_visites_techniques.souscripteur_id AND s.user_id=auth.uid()));
DROP POLICY IF EXISTS "Staff manage technical visit media" ON public.rapports_visites_medias;
CREATE POLICY "Staff manage technical visit media" ON public.rapports_visites_medias FOR ALL TO authenticated USING(public.is_staff(auth.uid())) WITH CHECK(public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Client read own technical visit media" ON public.rapports_visites_medias;
CREATE POLICY "Client read own technical visit media" ON public.rapports_visites_medias FOR SELECT TO authenticated USING(client_visible AND EXISTS(SELECT 1 FROM public.souscripteurs s JOIN public.rapports_visites_techniques r ON r.souscripteur_id=s.id WHERE r.id=rapports_visites_medias.rapport_id AND s.user_id=auth.uid()));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('rapports-techniques','rapports-techniques',false,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=52428800,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'];
DROP POLICY IF EXISTS "Staff read technical report media" ON storage.objects;
CREATE POLICY "Staff read technical report media" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='rapports-techniques' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff write technical report media" ON storage.objects;
CREATE POLICY "Staff write technical report media" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='rapports-techniques' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff delete technical report media" ON storage.objects;
CREATE POLICY "Staff delete technical report media" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='rapports-techniques' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Client read visible technical report media" ON storage.objects;
CREATE POLICY "Client read visible technical report media" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='rapports-techniques' AND EXISTS(SELECT 1 FROM public.rapports_visites_medias m JOIN public.rapports_visites_techniques r ON r.id=m.rapport_id JOIN public.souscripteurs s ON s.id=r.souscripteur_id WHERE m.storage_path=objects.name AND m.client_visible=true AND s.user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.normalize_profile_org_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.relation_rh IN ('PDG','Associé / Actionnaire') THEN NEW.departement=NULL;NEW.equipe_id=NULL;NEW.district_id=NULL;NEW.region_id=NULL;NEW.taux_commission=NULL;
 ELSIF COALESCE(NEW.departement,'') NOT IN ('Commercial','Technique') THEN NEW.equipe_id=NULL;NEW.district_id=NULL;NEW.region_id=NULL; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_normalize_profile_org_scope ON public.profiles;
CREATE TRIGGER trg_normalize_profile_org_scope BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_org_scope();

CREATE OR REPLACE FUNCTION public.sync_governance_role_from_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.relation_rh='PDG' THEN DELETE FROM public.user_roles WHERE user_id=NEW.user_id AND role<>'super_admin';
 INSERT INTO public.user_roles(user_id,role) SELECT NEW.user_id,'super_admin' WHERE NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role='super_admin');
 ELSIF NEW.relation_rh='Associé / Actionnaire' THEN DELETE FROM public.user_roles WHERE user_id=NEW.user_id;
 INSERT INTO public.user_roles(user_id,role) SELECT NEW.user_id,'associe_actionnaire' WHERE NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role='associe_actionnaire');
 END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_governance_role_from_profile ON public.profiles;
CREATE TRIGGER trg_sync_governance_role_from_profile AFTER INSERT OR UPDATE OF relation_rh,user_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_governance_role_from_profile();

CREATE OR REPLACE FUNCTION public.zone_assignment_expected_type(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT CASE WHEN EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='responsable_commercial') THEN 'region'
WHEN EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('chef_equipe_commercial','chef_equipe_technique')) THEN 'departement'
WHEN EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='commercial') THEN 'sous_prefecture' ELSE NULL END $$;
CREATE OR REPLACE FUNCTION public.validate_zone_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE expected text; BEGIN expected=public.zone_assignment_expected_type(NEW.user_id);
IF expected IS NULL OR NEW.zone_type<>expected THEN RAISE EXCEPTION 'Affectation de zone incohérente: type attendu=%',COALESCE(expected,'aucun');END IF;
IF NEW.created_by IS NULL THEN NEW.created_by=auth.uid();END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS trg_validate_zone_assignment ON public.zone_assignments;
CREATE TRIGGER trg_validate_zone_assignment BEFORE INSERT OR UPDATE ON public.zone_assignments FOR EACH ROW EXECUTE FUNCTION public.validate_zone_assignment();

CREATE OR REPLACE FUNCTION public.recompute_profile_coverage(_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; BEGIN SELECT * INTO a FROM public.zone_assignments WHERE user_id=_user_id ORDER BY created_at DESC LIMIT 1;
IF a IS NULL THEN UPDATE public.profiles SET district_id=NULL,region_id=NULL WHERE user_id=_user_id AND relation_rh IN ('Employé','Prestataire'); RETURN; END IF;
IF a.zone_type='region' THEN UPDATE public.profiles SET region_id=a.zone_id WHERE user_id=_user_id;
ELSIF a.zone_type='departement' THEN UPDATE public.profiles SET district_id=(SELECT r.district_id FROM public.regions r WHERE r.id=(SELECT d.region_id FROM public.departements d WHERE d.id=a.zone_id)),region_id=(SELECT d.region_id FROM public.departements d WHERE d.id=a.zone_id) WHERE user_id=_user_id;
ELSIF a.zone_type='sous_prefecture' THEN UPDATE public.profiles SET district_id=(SELECT r.district_id FROM public.regions r WHERE r.id=(SELECT d.region_id FROM public.departements d WHERE d.id=(SELECT sp.departement_id FROM public.sous_prefectures sp WHERE sp.id=a.zone_id))),region_id=(SELECT d.region_id FROM public.departements d WHERE d.id=(SELECT sp.departement_id FROM public.sous_prefectures sp WHERE sp.id=a.zone_id)) WHERE user_id=_user_id; END IF; END $$;
CREATE OR REPLACE FUNCTION public.recompute_profile_coverage_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF TG_OP='DELETE' THEN PERFORM public.recompute_profile_coverage(OLD.user_id); RETURN OLD; ELSE PERFORM public.recompute_profile_coverage(NEW.user_id); RETURN NEW; END IF; END $$;
DROP TRIGGER IF EXISTS trg_recompute_profile_coverage ON public.zone_assignments;
CREATE TRIGGER trg_recompute_profile_coverage AFTER INSERT OR UPDATE OR DELETE ON public.zone_assignments FOR EACH ROW EXECUTE FUNCTION public.recompute_profile_coverage_trigger();

CREATE OR REPLACE FUNCTION public.notify_hierarchy(p_type text,p_title text,p_message text,p_data jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user RECORD; BEGIN
IF p_type IS NULL OR p_type NOT IN ('nouvelle_souscription','nouveau_paiement','paiement_valide','paiement_retard','rappel_paiement','nouveau_lead','lead_assigne','nouveau_ticket','ticket_resolu','demande_compte','compte_approuve','suivi_agriplant','systeme') THEN RAISE EXCEPTION 'Type de notification non autorisé'; END IF;
IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
FOR v_user IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('super_admin','directeur_tc','responsable_operations','responsable_commercial','chef_equipe_commercial','chef_equipe_technique','chef_equipe_service_client','service_client','comptable')
LOOP INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(v_user.user_id,p_type,p_title,left(p_message,1000),p_data); END LOOP;
END $$;