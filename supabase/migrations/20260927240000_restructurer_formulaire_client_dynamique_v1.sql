-- Dynamic client form architecture
-- Generated for the CRM form restructuring: offer -> client -> conditional path.

alter table public.clients
  add column if not exists telephone_indicatif text,
  add column if not exists telephone_local text,
  add column if not exists whatsapp_indicatif text,
  add column if not exists whatsapp_local text;

create table if not exists public.client_cotitulaires_mandataires (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type_relation text not null default 'cotitulaire' check (type_relation in ('cotitulaire','mandataire')),
  lien_client text,
  civilite text,
  nom text not null,
  prenoms text,
  date_naissance date,
  lieu_naissance text,
  nationalite text,
  type_piece text,
  numero_piece text,
  date_delivrance_piece date,
  telephone_indicatif text,
  telephone_local text,
  telephone text,
  whatsapp_indicatif text,
  whatsapp_local text,
  whatsapp text,
  email text,
  adresse text,
  district_id uuid references public.districts(id),
  region_id uuid references public.regions(id),
  departement_id uuid references public.departements(id),
  sous_prefecture_id uuid references public.sous_prefectures(id),
  village_id uuid references public.villages(id),
  photo_profil_url text,
  piece_recto_url text,
  piece_verso_url text,
  procuration_url text,
  actif boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_cotit_client
  on public.client_cotitulaires_mandataires(client_id);

create table if not exists public.offre_formulaire_etapes (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid not null references public.offres(id) on delete cascade,
  code text not null,
  titre text not null,
  description text,
  ordre integer not null,
  obligatoire boolean not null default true,
  actif boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(offre_id, code),
  unique(offre_id, ordre)
);

create table if not exists public.offre_formulaire_documents (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid not null references public.offres(id) on delete cascade,
  code text not null,
  libelle text not null,
  categorie text not null,
  obligatoire boolean not null default false,
  condition jsonb not null default '{}'::jsonb,
  formats text[] not null default array['image/jpeg','image/png','application/pdf'],
  max_mb integer not null default 10,
  source_contractuelle text,
  actif boolean not null default true,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(offre_id, code)
);

create table if not exists public.offre_formulaire_contrats (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid not null references public.offres(id) on delete cascade,
  type_contrat text not null check (type_contrat in ('acquisition_client','accompagnement_agricole')),
  obligatoire boolean not null default true,
  condition jsonb not null default '{}'::jsonb,
  source_document text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(offre_id, type_contrat)
);

alter table public.acquisitions_brouillon
  add column if not exists offre_id uuid references public.offres(id),
  add column if not exists parcours_code text;

alter table public.documents_acquisition
  add column if not exists code_document text,
  add column if not exists categorie text,
  add column if not exists obligatoire boolean not null default false,
  add column if not exists source_contractuelle text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

delete from public.offre_formulaire_etapes;
delete from public.offre_formulaire_documents;
delete from public.offre_formulaire_contrats;

with steps(code,titre,description,ordre,obligatoire,configuration) as (
  values
  ('offre','Offre et superficie','Choix de la famille, de la formule et de la superficie.',1,true,'{"fields":["offre_id","superficie_prevue","mode_paiement"]}'::jsonb),
  ('client','Client','Identité, état civil, coordonnées, domicile et pièces du Client.',2,true,'{"fields":["identite","etat_civil","contacts","domicile","photo_profil","piece_identite"]}'::jsonb),
  ('foncier','Parcelle / foncier','Identification de la parcelle selon la formule et sa situation foncière.',3,true,'{"fields":["superficie","localisation","gps","reference","statut_foncier"]}'::jsonb),
  ('representant','Cotitulaire / mandataire','Données du cotitulaire ou mandataire uniquement lorsqu’il est désigné.',4,false,'{"optional":true}'::jsonb),
  ('documents','Documents et contrats','Téléversement des documents exigés par la formule et suivi des contrats.',5,true,'{"fields":["documents_requis","contrats_requis"]}'::jsonb),
  ('paiement_confirmation','Paiement initial et validation','Montants recalculés depuis l’offre, validation du dossier et confirmation.',6,true,'{"fields":["paiement_initial","recapitulatif","acceptations"]}'::jsonb)
)
insert into public.offre_formulaire_etapes(offre_id,code,titre,description,ordre,obligatoire,configuration)
select o.id,s.code,s.titre,s.description,s.ordre,s.obligatoire,s.configuration
from public.offres o cross join steps s
where o.actif and o.code in ('palm-invest','palm-invest-plus','terra-palm','terra-palm-plus')
on conflict (offre_id,code) do update set
  titre=excluded.titre,description=excluded.description,ordre=excluded.ordre,
  obligatoire=excluded.obligatoire,configuration=excluded.configuration,actif=true;

with steps(code,titre,description,ordre,obligatoire,configuration) as (
  values
  ('offre','Offre et superficie','Choix de la famille, de la formule et de la superficie.',1,true,'{"fields":["offre_id","superficie_prevue","mode_paiement"]}'::jsonb),
  ('client','Client','Identité, état civil, coordonnées, domicile et pièces du Client.',2,true,'{"fields":["identite","etat_civil","contacts","domicile","photo_profil","piece_identite"]}'::jsonb),
  ('foncier','Parcelle','Identification de la parcelle du Client, localisation, superficie et situation foncière.',3,true,'{"fields":["superficie","localisation","gps","reference","statut_foncier"]}'::jsonb),
  ('documents','Documents et contrat','Documents strictement nécessaires à la formule et contrat d’accompagnement.',4,true,'{"fields":["documents_requis","contrats_requis"]}'::jsonb),
  ('paiement_confirmation','Paiement initial et validation','Montants recalculés depuis l’offre, validation et confirmation.',5,true,'{"fields":["paiement_initial","recapitulatif","acceptations"]}'::jsonb)
)
insert into public.offre_formulaire_etapes(offre_id,code,titre,description,ordre,obligatoire,configuration)
select o.id,s.code,s.titre,s.description,s.ordre,s.obligatoire,s.configuration
from public.offres o cross join steps s
where o.actif and o.code in ('palm-terroir-essentielle','palm-terroir-flexible')
on conflict (offre_id,code) do update set
  titre=excluded.titre,description=excluded.description,ordre=excluded.ordre,
  obligatoire=excluded.obligatoire,configuration=excluded.configuration,actif=true;

insert into public.offre_formulaire_documents
(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,v.code,v.libelle,v.categorie,v.obligatoire,v.condition,v.source_contractuelle,v.ordre
from public.offres o cross join (values
 ('client_piece_recto','Pièce d’identité du Client — recto','identite',true,'{}'::jsonb,'Contrat d’accompagnement agricole — Annexe 1',10),
 ('client_piece_verso','Pièce d’identité du Client — verso','identite',true,'{}'::jsonb,'Contrat d’accompagnement agricole — Annexe 1',11),
 ('client_photo_profil','Photo du Client','identite',true,'{}'::jsonb,'Dossier CRM Client',12),
 ('justificatif_foncier','Justificatif / document de sécurisation foncière','foncier',false,'{"when":"situation_fonciere"}'::jsonb,'Identification et responsabilité de la parcelle',20),
 ('plan_parcelle','Plan / croquis / document de localisation de la parcelle','foncier',false,'{"when":"parcelle_identifiee"}'::jsonb,'Identification de la parcelle',21),
 ('representant_piece_recto','Pièce d’identité du cotitulaire / mandataire — recto','representant',true,'{"when":"representant_active"}'::jsonb,'Contrat d’accompagnement agricole — Annexe 2',30),
 ('representant_piece_verso','Pièce d’identité du cotitulaire / mandataire — verso','representant',true,'{"when":"representant_active"}'::jsonb,'Contrat d’accompagnement agricole — Annexe 2',31),
 ('representant_photo_profil','Photo du cotitulaire / mandataire','representant',true,'{"when":"representant_active"}'::jsonb,'Dossier CRM Client',32)
) v(code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
where o.actif
on conflict (offre_id,code) do update set
  libelle=excluded.libelle,categorie=excluded.categorie,obligatoire=excluded.obligatoire,
  condition=excluded.condition,source_contractuelle=excluded.source_contractuelle,actif=true,ordre=excluded.ordre;

insert into public.offre_formulaire_contrats(offre_id,type_contrat,obligatoire,source_document)
select o.id,'accompagnement_agricole',o.contrat_accompagnement_requis,'AgriCapital — Contrat d’accompagnement agricole'
from public.offres o where o.actif
on conflict (offre_id,type_contrat) do update set obligatoire=excluded.obligatoire,source_document=excluded.source_document,actif=true;

insert into public.offre_formulaire_contrats(offre_id,type_contrat,obligatoire,source_document)
select o.id,'acquisition_client',o.contrat_acquisition_requis,'AgriCapital — Contrat d’acquisition de plantation agricole'
from public.offres o where o.actif
on conflict (offre_id,type_contrat) do update set obligatoire=excluded.obligatoire,source_document=excluded.source_document,actif=true;

create index if not exists idx_offre_formulaire_etapes_offre on public.offre_formulaire_etapes(offre_id,ordre);
create index if not exists idx_offre_formulaire_docs_offre on public.offre_formulaire_documents(offre_id,ordre);
create index if not exists idx_offre_formulaire_contracts_offre on public.offre_formulaire_contrats(offre_id);

alter table public.client_cotitulaires_mandataires enable row level security;
alter table public.offre_formulaire_etapes enable row level security;
alter table public.offre_formulaire_documents enable row level security;
alter table public.offre_formulaire_contrats enable row level security;

drop policy if exists "staff manage client representatives" on public.client_cotitulaires_mandataires;
create policy "staff manage client representatives"
on public.client_cotitulaires_mandataires for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'commercial') or public.has_role(auth.uid(),'service_client'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'commercial') or public.has_role(auth.uid(),'service_client'));

drop policy if exists "authenticated read form steps" on public.offre_formulaire_etapes;
create policy "authenticated read form steps" on public.offre_formulaire_etapes for select to authenticated using (actif=true);

drop policy if exists "authenticated read form documents" on public.offre_formulaire_documents;
create policy "authenticated read form documents" on public.offre_formulaire_documents for select to authenticated using (actif=true);

drop policy if exists "authenticated read form contracts" on public.offre_formulaire_contrats;
create policy "authenticated read form contracts" on public.offre_formulaire_contrats for select to authenticated using (actif=true);
