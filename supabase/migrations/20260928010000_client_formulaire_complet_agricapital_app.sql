-- Formulaire Client complet AgriCapital
-- Parcours piloté par l'offre : 1 Offre -> 2 Client -> 3 Cotitulaire/Mandataire
-- -> 4 Foncier -> 5 Enquête -> 6 Documents -> 7 Contrats
-- -> 8 Paiement initial -> 9 Confirmation.

create table if not exists public.offre_formulaire_etapes (
  id uuid primary key default gen_random_uuid(), offre_id uuid not null references public.offres(id) on delete cascade,
  code text not null, titre text not null, description text, ordre integer not null,
  obligatoire boolean not null default true, actif boolean not null default true,
  configuration jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(offre_id, code)
);
create index if not exists idx_offre_formulaire_etapes_offre_ordre on public.offre_formulaire_etapes(offre_id, ordre);

create table if not exists public.offre_formulaire_documents (
  id uuid primary key default gen_random_uuid(), offre_id uuid not null references public.offres(id) on delete cascade,
  code text not null, libelle text not null, categorie text, obligatoire boolean not null default false,
  condition jsonb not null default '{}'::jsonb, formats text[] not null default array['pdf','jpg','jpeg','png'],
  max_mb integer not null default 10, source_contractuelle text, actif boolean not null default true,
  ordre integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(offre_id, code)
);
create index if not exists idx_offre_formulaire_documents_offre_ordre on public.offre_formulaire_documents(offre_id, ordre);

create table if not exists public.offre_formulaire_contrats (
  id uuid primary key default gen_random_uuid(), offre_id uuid not null references public.offres(id) on delete cascade,
  type_contrat text not null, obligatoire boolean not null default true, condition jsonb not null default '{}'::jsonb,
  source_document text, actif boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(offre_id, type_contrat)
);

create table if not exists public.client_enquetes (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete restrict, parcours_code text,
  niveau_detail text not null default 'standard', reponses jsonb not null default '{}'::jsonb,
  statut text not null default 'complete', created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_enquetes_client on public.client_enquetes(client_id);
create index if not exists idx_client_enquetes_offre on public.client_enquetes(offre_id);

alter table public.offre_formulaire_etapes enable row level security;
alter table public.offre_formulaire_documents enable row level security;
alter table public.offre_formulaire_contrats enable row level security;
alter table public.client_enquetes enable row level security;

drop policy if exists "auth_read_offre_formulaire_etapes" on public.offre_formulaire_etapes;
create policy "auth_read_offre_formulaire_etapes" on public.offre_formulaire_etapes for select to authenticated using (true);
drop policy if exists "auth_read_offre_formulaire_documents" on public.offre_formulaire_documents;
create policy "auth_read_offre_formulaire_documents" on public.offre_formulaire_documents for select to authenticated using (true);
drop policy if exists "auth_read_offre_formulaire_contrats" on public.offre_formulaire_contrats;
create policy "auth_read_offre_formulaire_contrats" on public.offre_formulaire_contrats for select to authenticated using (true);
drop policy if exists "auth_manage_client_enquetes" on public.client_enquetes;
create policy "auth_manage_client_enquetes" on public.client_enquetes for all to authenticated using (true) with check (true);

alter table public.client_cotitulaires_mandataires add column if not exists type_relation text;
create index if not exists idx_client_cotitulaires_mandataires_client on public.client_cotitulaires_mandataires(client_id);

delete from public.offre_formulaire_etapes;
delete from public.offre_formulaire_documents;
delete from public.offre_formulaire_contrats;

insert into public.offre_formulaire_etapes(offre_id,code,titre,description,ordre,obligatoire,configuration)
select o.id,v.code,v.titre,v.description,v.ordre,v.obligatoire,v.configuration
from public.offres o
cross join lateral (values
('offre','Offre et superficie','Choix de la formule, superficie et conditions financières.',1,true,jsonb_build_object('start',true)),
('client','Client','Identité, état civil, coordonnées, résidence et pièces du Client.',2,true,'{}'::jsonb),
('representant','Cotitulaire / mandataire','Étape optionnelle selon la situation du Client et l’offre.',3,false,jsonb_build_object('optional',true)),
('parcelle','Foncier / parcelle','Parcelle, localisation, superficie et rattachement foncier.',4,true,'{}'::jsonb),
('enquete','Enquête Client','Questionnaire adapté à la formule ; allégé pour PalmTerroir.',5,true,jsonb_build_object('palmterroir_light',true)),
('documents','Documents','Pièces dynamiques selon l’offre et les annexes contractuelles.',6,true,'{}'::jsonb),
('contrats','Contrats','Contrats applicables et suivi de leur signature.',7,true,'{}'::jsonb),
('paiement_initial','Paiement initial','Déclaration du paiement initial, mode et justificatif.',8,true,'{}'::jsonb),
('confirmation','Confirmation','Récapitulatif final et validation du dossier.',9,true,'{}'::jsonb)
) v(code,titre,description,ordre,obligatoire,configuration)
where o.actif=true;

insert into public.offre_formulaire_contrats(offre_id,type_contrat,obligatoire,condition,source_document)
select o.id,'contrat_acquisition_client',true,'{}'::jsonb,'Contrat_Acquisition_AgriCapital_V1.pdf'
from public.offres o where o.actif=true and o.contrat_acquisition_requis=true
on conflict do nothing;
insert into public.offre_formulaire_contrats(offre_id,type_contrat,obligatoire,condition,source_document)
select o.id,'accompagnement_agricole',true,'{}'::jsonb,'AgriCapital _ CONTRAT D''ACCOMPAGNEMENT AGRICOLE.pdf'
from public.offres o where o.actif=true and o.contrat_accompagnement_requis=true
on conflict do nothing;

insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'client_piece_recto','Pièce d’identité du Client — recto','identite',true,'{}'::jsonb,'Annexe contractuelle — identité du Client',10 from public.offres o where o.actif=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'client_piece_verso','Pièce d’identité du Client — verso','identite',true,'{}'::jsonb,'Annexe contractuelle — identité du Client',20 from public.offres o where o.actif=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'client_photo_profil','Photo d’identité / profil du Client','identite',true,'{}'::jsonb,'Dossier Client',30 from public.offres o where o.actif=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'representant_piece_recto','Pièce d’identité du cotitulaire / mandataire — recto','representant',true,'{"when":"representant_active"}'::jsonb,'Annexe — cotitulaire / mandataire',40 from public.offres o where o.actif=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'representant_piece_verso','Pièce d’identité du cotitulaire / mandataire — verso','representant',true,'{"when":"representant_active"}'::jsonb,'Annexe — cotitulaire / mandataire',50 from public.offres o where o.actif=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'representant_photo_profil','Photo du cotitulaire / mandataire','representant',true,'{"when":"representant_active"}'::jsonb,'Dossier Client',60 from public.offres o where o.actif=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'procuration_representant','Procuration / mandat signé','contractuel',true,'{"when":"representant_active","relation":"mandataire"}'::jsonb,'Contrat d’acquisition — procuration si mandat',70 from public.offres o where o.actif=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'justificatif_foncier','Justificatif foncier / document de propriété','foncier',true,'{"when":"client_land"}'::jsonb,'Dossier foncier',80 from public.offres o where o.actif=true and o.necessite_foncier_client=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'plan_bloc','Plan bloc / zone','foncier',false,'{"when":"acquisition"}'::jsonb,'Annexe 1 — plan bloc / zone, si applicable',90 from public.offres o where o.actif=true and o.contrat_acquisition_requis=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'plan_individuel','Plan individuel topographique GPS polygonal','foncier',false,'{"when":"acquisition"}'::jsonb,'Annexe 2 — plan individuel obligatoire à établir',100 from public.offres o where o.actif=true and o.contrat_acquisition_requis=true;
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,'avenant_plus','Avenant applicable à la formule +','contractuel',true,'{"when":"offre_plus"}'::jsonb,'Annexe 4 — avenant formule +',110 from public.offres o where o.actif=true and o.code like '%-plus';

comment on table public.offre_formulaire_etapes is 'Configuration du parcours CRM Client, pilotée par l’offre. Ne pas utiliser Souscripteur/Souscription dans le parcours utilisateur.';
comment on table public.offre_formulaire_documents is 'Pièces dynamiques du dossier Client selon l’offre et les annexes contractuelles.';
comment on table public.offre_formulaire_contrats is 'Contrats applicables au dossier Client ; les termes acquisition/acquéreur restent réservés aux documents officiels.';