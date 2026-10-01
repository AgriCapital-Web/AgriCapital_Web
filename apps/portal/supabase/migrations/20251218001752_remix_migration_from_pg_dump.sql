CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'directeur_tc',
    'responsable_zone',
    'comptable',
    'commercial',
    'service_client',
    'operations',
    'user'
);


--
-- Name: current_profile_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_profile_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_profile_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _profile_id
      AND ur.role = _role
  );
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: account_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom_complet text NOT NULL,
    email text NOT NULL,
    telephone text,
    region_id uuid,
    departement_id uuid,
    district_id uuid,
    motif text,
    statut text DEFAULT 'en_attente'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    paiement_id uuid,
    type_commission text NOT NULL,
    montant numeric NOT NULL,
    taux numeric,
    statut text DEFAULT 'en_attente'::text,
    paye_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: configurations_systeme; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configurations_systeme (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cle text NOT NULL,
    valeur text NOT NULL,
    description text,
    categorie text DEFAULT 'general'::text NOT NULL,
    type_valeur text DEFAULT 'text'::text NOT NULL,
    modifiable boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: departements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    district_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text,
    region_id uuid,
    est_actif boolean DEFAULT true
);


--
-- Name: districts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.districts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    region_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text,
    est_actif boolean DEFAULT true
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    souscripteur_id uuid,
    plantation_id uuid,
    type_document text NOT NULL,
    nom_fichier text NOT NULL,
    url text NOT NULL,
    statut text DEFAULT 'en_attente'::text,
    valide_par uuid,
    valide_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: equipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    responsable_id uuid,
    region_id uuid,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: historique_activites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historique_activites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    ancien_valeurs jsonb,
    nouvelles_valeurs jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    souscripteur_id uuid,
    plantation_id uuid,
    contenu text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: offres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    code text NOT NULL,
    description text,
    montant_da_par_ha numeric DEFAULT 30000 NOT NULL,
    contribution_mensuelle_par_ha numeric DEFAULT 1050 NOT NULL,
    avantages jsonb DEFAULT '[]'::jsonb,
    icon text,
    couleur text DEFAULT '#00643C'::text,
    ordre integer DEFAULT 1,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: paiements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paiements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    souscripteur_id uuid,
    plantation_id uuid,
    montant numeric NOT NULL,
    type_paiement text DEFAULT 'DA'::text,
    mode_paiement text DEFAULT 'Mobile Money'::text,
    reference text,
    statut text DEFAULT 'en_attente'::text,
    date_paiement timestamp with time zone,
    fedapay_transaction_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plantations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    souscripteur_id uuid NOT NULL,
    nom text,
    superficie_ha numeric DEFAULT 1 NOT NULL,
    date_plantation date,
    annee_plantation integer,
    age_plantation integer,
    type_culture text DEFAULT 'Palmier à huile'::text,
    variete text,
    densite_plants integer,
    region_id uuid,
    district_id uuid,
    departement_id uuid,
    sous_prefecture_id uuid,
    village_id uuid,
    localite text,
    coordonnees_gps text,
    latitude numeric,
    longitude numeric,
    statut text DEFAULT 'actif'::text,
    montant_da numeric DEFAULT 30000,
    montant_contribution_mensuelle numeric DEFAULT 1050,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id_unique text GENERATED ALWAYS AS (('PLT-'::text || "left"((id)::text, 8))) STORED,
    nom_plantation text,
    statut_global text DEFAULT 'en_attente_da'::text,
    nombre_plants integer,
    village_nom text,
    altitude numeric,
    document_foncier_type text,
    document_foncier_numero text,
    document_foncier_date_delivrance date,
    document_foncier_url text,
    date_signature_contrat date,
    chef_village_nom text,
    chef_village_telephone text,
    notes_internes text,
    updated_by uuid,
    alerte_non_paiement boolean DEFAULT false NOT NULL,
    alerte_visite_retard boolean DEFAULT false NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nom_complet text,
    email text,
    telephone text,
    role text DEFAULT 'user'::text,
    equipe_id uuid,
    actif boolean DEFAULT true,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    description text,
    pourcentage_reduction numeric DEFAULT 0 NOT NULL,
    date_debut timestamp with time zone DEFAULT now() NOT NULL,
    date_fin timestamp with time zone NOT NULL,
    active boolean DEFAULT true,
    applique_toutes_offres boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: promotions_offres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions_offres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    offre_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    district_id uuid,
    est_active boolean DEFAULT true
);


--
-- Name: sous_prefectures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sous_prefectures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    departement_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text,
    est_active boolean DEFAULT true
);


--
-- Name: souscripteurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.souscripteurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    prenoms text,
    telephone text NOT NULL,
    email text,
    date_naissance date,
    lieu_naissance text,
    nationalite text DEFAULT 'Ivoirienne'::text,
    type_piece text,
    numero_piece text,
    photo_url text,
    piece_recto_url text,
    piece_verso_url text,
    region_id uuid,
    district_id uuid,
    departement_id uuid,
    sous_prefecture_id uuid,
    village_id uuid,
    localite text,
    adresse text,
    offre_id uuid,
    statut text DEFAULT 'actif'::text,
    technico_commercial_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id_unique text GENERATED ALWAYS AS (('PAB-'::text || "left"((id)::text, 8))) STORED,
    nom_complet text GENERATED ALWAYS AS (((COALESCE(nom, ''::text) || ' '::text) || COALESCE(prenoms, ''::text))) STORED,
    statut_global text DEFAULT 'actif'::text,
    nombre_plantations integer DEFAULT 0,
    total_hectares numeric DEFAULT 0,
    total_da_verse numeric DEFAULT 0
);


--
-- Name: tickets_support; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets_support (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre text NOT NULL,
    description text,
    priorite text DEFAULT 'normale'::text,
    statut text DEFAULT 'ouvert'::text,
    souscripteur_id uuid,
    assigne_a uuid,
    created_by uuid,
    resolu_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: villages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.villages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    sous_prefecture_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text,
    est_actif boolean DEFAULT true
);


--
-- Name: account_requests account_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_requests
    ADD CONSTRAINT account_requests_pkey PRIMARY KEY (id);


--
-- Name: commissions commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_pkey PRIMARY KEY (id);


--
-- Name: configurations_systeme configurations_systeme_cle_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configurations_systeme
    ADD CONSTRAINT configurations_systeme_cle_key UNIQUE (cle);


--
-- Name: configurations_systeme configurations_systeme_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configurations_systeme
    ADD CONSTRAINT configurations_systeme_pkey PRIMARY KEY (id);


--
-- Name: departements departements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departements
    ADD CONSTRAINT departements_pkey PRIMARY KEY (id);


--
-- Name: districts districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: equipes equipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipes
    ADD CONSTRAINT equipes_pkey PRIMARY KEY (id);


--
-- Name: historique_activites historique_activites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_activites
    ADD CONSTRAINT historique_activites_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offres offres_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offres
    ADD CONSTRAINT offres_code_key UNIQUE (code);


--
-- Name: offres offres_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offres
    ADD CONSTRAINT offres_nom_key UNIQUE (nom);


--
-- Name: offres offres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offres
    ADD CONSTRAINT offres_pkey PRIMARY KEY (id);


--
-- Name: paiements paiements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements
    ADD CONSTRAINT paiements_pkey PRIMARY KEY (id);


--
-- Name: plantations plantations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantations
    ADD CONSTRAINT plantations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promotions_offres promotions_offres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions_offres
    ADD CONSTRAINT promotions_offres_pkey PRIMARY KEY (id);


--
-- Name: promotions_offres promotions_offres_promotion_id_offre_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions_offres
    ADD CONSTRAINT promotions_offres_promotion_id_offre_id_key UNIQUE (promotion_id, offre_id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: sous_prefectures sous_prefectures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sous_prefectures
    ADD CONSTRAINT sous_prefectures_pkey PRIMARY KEY (id);


--
-- Name: souscripteurs souscripteurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_pkey PRIMARY KEY (id);


--
-- Name: souscripteurs souscripteurs_telephone_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_telephone_unique UNIQUE (telephone);


--
-- Name: tickets_support tickets_support_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_support
    ADD CONSTRAINT tickets_support_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: villages villages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.villages
    ADD CONSTRAINT villages_pkey PRIMARY KEY (id);


--
-- Name: idx_notifications_user_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id_created_at ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: configurations_systeme update_configurations_systeme_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_configurations_systeme_updated_at BEFORE UPDATE ON public.configurations_systeme FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: account_requests account_requests_departement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_requests
    ADD CONSTRAINT account_requests_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES public.departements(id);


--
-- Name: account_requests account_requests_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_requests
    ADD CONSTRAINT account_requests_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id);


--
-- Name: account_requests account_requests_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_requests
    ADD CONSTRAINT account_requests_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: commissions commissions_paiement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_paiement_id_fkey FOREIGN KEY (paiement_id) REFERENCES public.paiements(id);


--
-- Name: commissions commissions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: departements departements_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departements
    ADD CONSTRAINT departements_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id);


--
-- Name: departements departements_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departements
    ADD CONSTRAINT departements_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: districts districts_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: documents documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: documents documents_plantation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_plantation_id_fkey FOREIGN KEY (plantation_id) REFERENCES public.plantations(id) ON DELETE CASCADE;


--
-- Name: documents documents_souscripteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_souscripteur_id_fkey FOREIGN KEY (souscripteur_id) REFERENCES public.souscripteurs(id) ON DELETE CASCADE;


--
-- Name: documents documents_valide_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES public.profiles(id);


--
-- Name: equipes equipes_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipes
    ADD CONSTRAINT equipes_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: equipes equipes_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipes
    ADD CONSTRAINT equipes_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.profiles(id);


--
-- Name: historique_activites historique_activites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_activites
    ADD CONSTRAINT historique_activites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: notes notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: notes notes_plantation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_plantation_id_fkey FOREIGN KEY (plantation_id) REFERENCES public.plantations(id) ON DELETE CASCADE;


--
-- Name: notes notes_souscripteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_souscripteur_id_fkey FOREIGN KEY (souscripteur_id) REFERENCES public.souscripteurs(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: paiements paiements_plantation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements
    ADD CONSTRAINT paiements_plantation_id_fkey FOREIGN KEY (plantation_id) REFERENCES public.plantations(id);


--
-- Name: paiements paiements_souscripteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements
    ADD CONSTRAINT paiements_souscripteur_id_fkey FOREIGN KEY (souscripteur_id) REFERENCES public.souscripteurs(id);


--
-- Name: plantations plantations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantations
    ADD CONSTRAINT plantations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: plantations plantations_departement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantations
    ADD CONSTRAINT plantations_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES public.departements(id);


--
-- Name: plantations plantations_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantations
    ADD CONSTRAINT plantations_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id);


--
-- Name: plantations plantations_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantations
    ADD CONSTRAINT plantations_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: plantations plantations_sous_prefecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantations
    ADD CONSTRAINT plantations_sous_prefecture_id_fkey FOREIGN KEY (sous_prefecture_id) REFERENCES public.sous_prefectures(id);


--
-- Name: plantations plantations_souscripteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantations
    ADD CONSTRAINT plantations_souscripteur_id_fkey FOREIGN KEY (souscripteur_id) REFERENCES public.souscripteurs(id) ON DELETE CASCADE;


--
-- Name: plantations plantations_village_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantations
    ADD CONSTRAINT plantations_village_id_fkey FOREIGN KEY (village_id) REFERENCES public.villages(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: promotions_offres promotions_offres_offre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions_offres
    ADD CONSTRAINT promotions_offres_offre_id_fkey FOREIGN KEY (offre_id) REFERENCES public.offres(id) ON DELETE CASCADE;


--
-- Name: promotions_offres promotions_offres_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions_offres
    ADD CONSTRAINT promotions_offres_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: regions regions_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id);


--
-- Name: sous_prefectures sous_prefectures_departement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sous_prefectures
    ADD CONSTRAINT sous_prefectures_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES public.departements(id);


--
-- Name: souscripteurs souscripteurs_departement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES public.departements(id);


--
-- Name: souscripteurs souscripteurs_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id);


--
-- Name: souscripteurs souscripteurs_offre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_offre_id_fkey FOREIGN KEY (offre_id) REFERENCES public.offres(id);


--
-- Name: souscripteurs souscripteurs_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: souscripteurs souscripteurs_sous_prefecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_sous_prefecture_id_fkey FOREIGN KEY (sous_prefecture_id) REFERENCES public.sous_prefectures(id);


--
-- Name: souscripteurs souscripteurs_technico_commercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_technico_commercial_id_fkey FOREIGN KEY (technico_commercial_id) REFERENCES public.profiles(id);


--
-- Name: souscripteurs souscripteurs_village_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.souscripteurs
    ADD CONSTRAINT souscripteurs_village_id_fkey FOREIGN KEY (village_id) REFERENCES public.villages(id);


--
-- Name: tickets_support tickets_support_assigne_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_support
    ADD CONSTRAINT tickets_support_assigne_a_fkey FOREIGN KEY (assigne_a) REFERENCES public.profiles(id);


--
-- Name: tickets_support tickets_support_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_support
    ADD CONSTRAINT tickets_support_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tickets_support tickets_support_souscripteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_support
    ADD CONSTRAINT tickets_support_souscripteur_id_fkey FOREIGN KEY (souscripteur_id) REFERENCES public.souscripteurs(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: villages villages_sous_prefecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.villages
    ADD CONSTRAINT villages_sous_prefecture_id_fkey FOREIGN KEY (sous_prefecture_id) REFERENCES public.sous_prefectures(id);


--
-- Name: user_roles Super admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(public.current_profile_id(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(public.current_profile_id(), 'super_admin'::public.app_role));


--
-- Name: user_roles Super admins can read all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(public.current_profile_id(), 'super_admin'::public.app_role));


--
-- Name: notifications Users can insert own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((user_id = public.current_profile_id()));


--
-- Name: notifications Users can read own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = public.current_profile_id()));


--
-- Name: user_roles Users can read own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = public.current_profile_id()));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = public.current_profile_id()));


--
-- Name: account_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: configurations_systeme; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configurations_systeme ENABLE ROW LEVEL SECURITY;

--
-- Name: departements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departements ENABLE ROW LEVEL SECURITY;

--
-- Name: districts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: equipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;

--
-- Name: historique_activites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historique_activites ENABLE ROW LEVEL SECURITY;

--
-- Name: account_requests insert_account_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_account_requests ON public.account_requests FOR INSERT WITH CHECK (true);


--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: offres; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offres ENABLE ROW LEVEL SECURITY;

--
-- Name: paiements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

--
-- Name: plantations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plantations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions_offres; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions_offres ENABLE ROW LEVEL SECURITY;

--
-- Name: account_requests read_account_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_account_requests ON public.account_requests FOR SELECT USING (true);


--
-- Name: commissions read_commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_commissions ON public.commissions FOR SELECT USING (true);


--
-- Name: configurations_systeme read_configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_configurations ON public.configurations_systeme FOR SELECT USING (true);


--
-- Name: departements read_departements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_departements ON public.departements FOR SELECT USING (true);


--
-- Name: districts read_districts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_districts ON public.districts FOR SELECT USING (true);


--
-- Name: documents read_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_documents ON public.documents FOR SELECT USING (true);


--
-- Name: equipes read_equipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_equipes ON public.equipes FOR SELECT USING (true);


--
-- Name: historique_activites read_historique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_historique ON public.historique_activites FOR SELECT USING (true);


--
-- Name: notes read_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_notes ON public.notes FOR SELECT USING (true);


--
-- Name: offres read_offres; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_offres ON public.offres FOR SELECT USING (true);


--
-- Name: paiements read_paiements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_paiements ON public.paiements FOR SELECT USING (true);


--
-- Name: plantations read_plantations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_plantations ON public.plantations FOR SELECT USING (true);


--
-- Name: profiles read_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_profiles ON public.profiles FOR SELECT USING (true);


--
-- Name: promotions read_promotions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_promotions ON public.promotions FOR SELECT USING (true);


--
-- Name: promotions_offres read_promotions_offres; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_promotions_offres ON public.promotions_offres FOR SELECT USING (true);


--
-- Name: regions read_regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_regions ON public.regions FOR SELECT USING (true);


--
-- Name: sous_prefectures read_sous_prefectures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_sous_prefectures ON public.sous_prefectures FOR SELECT USING (true);


--
-- Name: souscripteurs read_souscripteurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_souscripteurs ON public.souscripteurs FOR SELECT USING (true);


--
-- Name: tickets_support read_tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_tickets ON public.tickets_support FOR SELECT USING (true);


--
-- Name: villages read_villages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_villages ON public.villages FOR SELECT USING (true);


--
-- Name: regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

--
-- Name: sous_prefectures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sous_prefectures ENABLE ROW LEVEL SECURITY;

--
-- Name: souscripteurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.souscripteurs ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets_support; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets_support ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: villages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;

--
-- Name: commissions write_commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_commissions ON public.commissions USING (true) WITH CHECK (true);


--
-- Name: configurations_systeme write_configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_configurations ON public.configurations_systeme USING (true) WITH CHECK (true);


--
-- Name: departements write_departements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_departements ON public.departements TO authenticated USING (true) WITH CHECK (true);


--
-- Name: districts write_districts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_districts ON public.districts TO authenticated USING (true) WITH CHECK (true);


--
-- Name: documents write_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_documents ON public.documents USING (true) WITH CHECK (true);


--
-- Name: equipes write_equipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_equipes ON public.equipes USING (true) WITH CHECK (true);


--
-- Name: historique_activites write_historique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_historique ON public.historique_activites USING (true) WITH CHECK (true);


--
-- Name: notes write_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_notes ON public.notes USING (true) WITH CHECK (true);


--
-- Name: offres write_offres; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_offres ON public.offres TO authenticated USING (true) WITH CHECK (true);


--
-- Name: paiements write_paiements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_paiements ON public.paiements TO authenticated USING (true) WITH CHECK (true);


--
-- Name: plantations write_plantations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_plantations ON public.plantations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: profiles write_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_profiles ON public.profiles TO authenticated USING (true) WITH CHECK (true);


--
-- Name: promotions write_promotions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_promotions ON public.promotions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: promotions_offres write_promotions_offres; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_promotions_offres ON public.promotions_offres TO authenticated USING (true) WITH CHECK (true);


--
-- Name: regions write_regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_regions ON public.regions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sous_prefectures write_sous_prefectures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_sous_prefectures ON public.sous_prefectures TO authenticated USING (true) WITH CHECK (true);


--
-- Name: souscripteurs write_souscripteurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_souscripteurs ON public.souscripteurs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: tickets_support write_tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_tickets ON public.tickets_support USING (true) WITH CHECK (true);


--
-- Name: villages write_villages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_villages ON public.villages TO authenticated USING (true) WITH CHECK (true);


--
-- PostgreSQL database dump complete
--


