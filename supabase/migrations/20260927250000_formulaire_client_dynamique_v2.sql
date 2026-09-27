-- Formulaire client dynamique V2 : parcours piloté par l'offre et pièces contractuelles
-- Cette migration complète la V1 sans modifier l'historique des migrations précédentes.

-- 1. Le représentant est une relation métier du Client.
alter table public.client_cotitulaires_mandataires
  add column if not exists type_relation text;

update public.client_cotitulaires_mandataires
set type_relation = 'cotitulaire'
where type_relation is null;

alter table public.client_cotitulaires_mandataires
  alter column type_relation set default 'cotitulaire';

-- 2. Le brouillon conserve l'offre sélectionnée et le code de parcours.
create index if not exists idx_acquisitions_brouillon_offre
  on public.acquisitions_brouillon(offre_id);

-- 3. Catalogue exact des étapes du formulaire client.
delete from public.offre_formulaire_etapes;

with parcours(code_offre, code, titre, description, ordre, obligatoire, configuration) as (
  values
    ('palm-invest','offre','Offre et superficie','Choix de l’offre et de la superficie.',1,true,'{"section":"offre"}'::jsonb),
    ('palm-invest','client','Client','Identité, état civil, coordonnées, domicile, photo et pièce d’identité.',2,true,'{"section":"client"}'::jsonb),
    ('palm-invest','parcelle','Parcelle / foncier','Convention, propriétaire foncier, lot, superficie et localisation de la plantation.',3,true,'{"section":"parcelle","foncier":"externe"}'::jsonb),
    ('palm-invest','representant','Cotitulaire / mandataire','À renseigner uniquement si le Client en désigne un.',4,false,'{"section":"representant","optional":true}'::jsonb),
    ('palm-invest','documents','Documents et contrats','Pièces exigées par la formule et contrats à signer/téléverser.',5,true,'{"section":"documents"}'::jsonb),
    ('palm-invest','paiement_confirmation','Paiement initial et validation','Récapitulatif, paiement initial et validations finales.',6,true,'{"section":"paiement_confirmation"}'::jsonb),

    ('palm-invest-plus','offre','Offre et superficie','Choix de l’offre et de la superficie.',1,true,'{"section":"offre"}'::jsonb),
    ('palm-invest-plus','client','Client','Identité, état civil, coordonnées, domicile, photo et pièce d’identité.',2,true,'{"section":"client"}'::jsonb),
    ('palm-invest-plus','parcelle','Parcelle / foncier','Convention, propriétaire foncier, lot, superficie et localisation de la plantation.',3,true,'{"section":"parcelle","foncier":"externe"}'::jsonb),
    ('palm-invest-plus','representant','Cotitulaire / mandataire','À renseigner uniquement si le Client en désigne un.',4,false,'{"section":"representant","optional":true}'::jsonb),
    ('palm-invest-plus','documents','Documents et contrats','Pièces exigées par la formule et contrats à signer/téléverser.',5,true,'{"section":"documents"}'::jsonb),
    ('palm-invest-plus','paiement_confirmation','Paiement initial et validation','Récapitulatif, paiement initial et validations finales.',6,true,'{"section":"paiement_confirmation"}'::jsonb),

    ('terra-palm','offre','Offre et superficie','Choix de l’offre et de la superficie.',1,true,'{"section":"offre"}'::jsonb),
    ('terra-palm','client','Client','Identité, état civil, coordonnées, domicile, photo et pièce d’identité.',2,true,'{"section":"client"}'::jsonb),
    ('terra-palm','parcelle','Parcelle / foncier','Parcelle du Client, propriétaire foncier, superficie, localisation et coordonnées GPS.',3,true,'{"section":"parcelle","foncier":"client"}'::jsonb),
    ('terra-palm','representant','Cotitulaire / mandataire','À renseigner uniquement si le Client en désigne un.',4,false,'{"section":"representant","optional":true}'::jsonb),
    ('terra-palm','documents','Documents et contrats','Pièces exigées par la formule et contrats à signer/téléverser.',5,true,'{"section":"documents"}'::jsonb),
    ('terra-palm','paiement_confirmation','Paiement initial et validation','Récapitulatif, paiement initial et validations finales.',6,true,'{"section":"paiement_confirmation"}'::jsonb),

    ('terra-palm-plus','offre','Offre et superficie','Choix de l’offre et de la superficie.',1,true,'{"section":"offre"}'::jsonb),
    ('terra-palm-plus','client','Client','Identité, état civil, coordonnées, domicile, photo et pièce d’identité.',2,true,'{"section":"client"}'::jsonb),
    ('terra-palm-plus','parcelle','Parcelle / foncier','Parcelle du Client, propriétaire foncier, superficie, localisation et coordonnées GPS.',3,true,'{"section":"parcelle","foncier":"client"}'::jsonb),
    ('terra-palm-plus','representant','Cotitulaire / mandataire','À renseigner uniquement si le Client en désigne un.',4,false,'{"section":"representant","optional":true}'::jsonb),
    ('terra-palm-plus','documents','Documents et contrats','Pièces exigées par la formule et contrats à signer/téléverser.',5,true,'{"section":"documents"}'::jsonb),
    ('terra-palm-plus','paiement_confirmation','Paiement initial et validation','Récapitulatif, paiement initial et validations finales.',6,true,'{"section":"paiement_confirmation"}'::jsonb),

    ('palm-terroir-essentielle','offre','Offre et superficie','Choix de l’offre et de la superficie.',1,true,'{"section":"offre"}'::jsonb),
    ('palm-terroir-essentielle','client','Client','Identité, état civil, coordonnées, domicile, photo et pièce d’identité.',2,true,'{"section":"client"}'::jsonb),
    ('palm-terroir-essentielle','parcelle','Parcelle du Client','Superficie, localisation, coordonnées GPS et situation de la parcelle.',3,true,'{"section":"parcelle","foncier":"client"}'::jsonb),
    ('palm-terroir-essentielle','documents','Documents et contrat','Pièces exigées par le contrat d’accompagnement et contrat signé.',4,true,'{"section":"documents"}'::jsonb),
    ('palm-terroir-essentielle','paiement_confirmation','Paiement initial et validation','Récapitulatif, paiement initial et validations finales.',5,true,'{"section":"paiement_confirmation"}'::jsonb),

    ('palm-terroir-flexible','offre','Offre et superficie','Choix de l’offre et de la superficie.',1,true,'{"section":"offre"}'::jsonb),
    ('palm-terroir-flexible','client','Client','Identité, état civil, coordonnées, domicile, photo et pièce d’identité.',2,true,'{"section":"client"}'::jsonb),
    ('palm-terroir-flexible','parcelle','Parcelle du Client','Superficie, localisation, coordonnées GPS et situation de la parcelle.',3,true,'{"section":"parcelle","foncier":"client"}'::jsonb),
    ('palm-terroir-flexible','documents','Documents et contrat','Pièces exigées par le contrat d’accompagnement et contrat signé.',4,true,'{"section":"documents"}'::jsonb),
    ('palm-terroir-flexible','paiement_confirmation','Paiement initial et validation','Récapitulatif, paiement initial et validations finales.',5,true,'{"section":"paiement_confirmation"}'::jsonb)
)
insert into public.offre_formulaire_etapes(offre_id,code,titre,description,ordre,obligatoire,configuration)
select o.id,p.code,p.titre,p.description,p.ordre,p.obligatoire,p.configuration
from public.offres o
join parcours p on p.code_offre=o.code
where o.actif
on conflict (offre_id,code) do update set
  titre=excluded.titre,
  description=excluded.description,
  ordre=excluded.ordre,
  obligatoire=excluded.obligatoire,
  configuration=excluded.configuration,
  actif=true;

-- 4. Documents : on distingue les pièces du Client, du représentant et les pièces contractuelles.
delete from public.offre_formulaire_documents;

with docs(code_offre,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre) as (
  values
  ('palm-invest','client_piece_recto','Pièce d’identité du Client — recto','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',10),
  ('palm-invest','client_piece_verso','Pièce d’identité du Client — verso','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',11),
  ('palm-invest','client_photo_profil','Photo du Client','client',true,'{}','Dossier CRM Client',12),
  ('palm-invest','plan_bloc','Plan du bloc / zone de plantation','parcelle',false,'{"statut":"conditionnel"}','Contrat d’acquisition — Annexe 1',20),
  ('palm-invest','plan_individuel','Plan topographique individuel de la plantation (polygonal GPS)','parcelle',true,'{}','Contrat d’acquisition — Annexe 2',21),
  ('palm-invest','avenant_plus','Avenant Formule +','contrat',false,'{"when":"offre_plus"}','Contrat d’acquisition — Annexe 4',30),
  ('palm-invest','procuration_representant','Procuration du cotitulaire / mandataire','representant',false,'{"when":"representant_active"}','Contrat d’acquisition — Annexe 5',31),
  ('palm-invest','securisation_complementaire','Document complémentaire de sécurisation','foncier',false,'{"when":"necessaire"}','Contrat d’acquisition — Annexe 6',32),
  ('palm-invest','contrat_acquisition_signe','Contrat d’acquisition signé','contrat',true,'{}','Contrat d’acquisition',40),
  ('palm-invest','contrat_accompagnement_signe','Contrat d’accompagnement agricole signé','contrat',true,'{}','Contrat d’accompagnement agricole',41),

  ('palm-invest-plus','client_piece_recto','Pièce d’identité du Client — recto','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',10),
  ('palm-invest-plus','client_piece_verso','Pièce d’identité du Client — verso','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',11),
  ('palm-invest-plus','client_photo_profil','Photo du Client','client',true,'{}','Dossier CRM Client',12),
  ('palm-invest-plus','plan_bloc','Plan du bloc / zone de plantation','parcelle',false,'{"statut":"conditionnel"}','Contrat d’acquisition — Annexe 1',20),
  ('palm-invest-plus','plan_individuel','Plan topographique individuel de la plantation (polygonal GPS)','parcelle',true,'{}','Contrat d’acquisition — Annexe 2',21),
  ('palm-invest-plus','avenant_plus','Avenant Formule +','contrat',true,'{"when":"offre_plus"}','Contrat d’acquisition — Annexe 4',30),
  ('palm-invest-plus','procuration_representant','Procuration du cotitulaire / mandataire','representant',false,'{"when":"representant_active"}','Contrat d’acquisition — Annexe 5',31),
  ('palm-invest-plus','securisation_complementaire','Document complémentaire de sécurisation','foncier',false,'{"when":"necessaire"}','Contrat d’acquisition — Annexe 6',32),
  ('palm-invest-plus','contrat_acquisition_signe','Contrat d’acquisition signé','contrat',true,'{}','Contrat d’acquisition',40),
  ('palm-invest-plus','contrat_accompagnement_signe','Contrat d’accompagnement agricole signé','contrat',true,'{}','Contrat d’accompagnement agricole',41),

  ('terra-palm','client_piece_recto','Pièce d’identité du Client — recto','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',10),
  ('terra-palm','client_piece_verso','Pièce d’identité du Client — verso','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',11),
  ('terra-palm','client_photo_profil','Photo du Client','client',true,'{}','Dossier CRM Client',12),
  ('terra-palm','plan_bloc','Plan du bloc / zone de plantation','parcelle',false,'{"statut":"conditionnel"}','Contrat d’acquisition — Annexe 1',20),
  ('terra-palm','plan_individuel','Plan topographique individuel de la plantation (polygonal GPS)','parcelle',true,'{}','Contrat d’acquisition — Annexe 2',21),
  ('terra-palm','procuration_representant','Procuration du cotitulaire / mandataire','representant',false,'{"when":"representant_active"}','Contrat d’acquisition — Annexe 5',31),
  ('terra-palm','securisation_complementaire','Document complémentaire de sécurisation','foncier',false,'{"when":"necessaire"}','Contrat d’acquisition — Annexe 6',32),
  ('terra-palm','contrat_acquisition_signe','Contrat d’acquisition signé','contrat',true,'{}','Contrat d’acquisition',40),
  ('terra-palm','contrat_accompagnement_signe','Contrat d’accompagnement agricole signé','contrat',true,'{}','Contrat d’accompagnement agricole',41),

  ('terra-palm-plus','client_piece_recto','Pièce d’identité du Client — recto','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',10),
  ('terra-palm-plus','client_piece_verso','Pièce d’identité du Client — verso','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',11),
  ('terra-palm-plus','client_photo_profil','Photo du Client','client',true,'{}','Dossier CRM Client',12),
  ('terra-palm-plus','plan_bloc','Plan du bloc / zone de plantation','parcelle',false,'{"statut":"conditionnel"}','Contrat d’acquisition — Annexe 1',20),
  ('terra-palm-plus','plan_individuel','Plan topographique individuel de la plantation (polygonal GPS)','parcelle',true,'{}','Contrat d’acquisition — Annexe 2',21),
  ('terra-palm-plus','avenant_plus','Avenant Formule +','contrat',true,'{"when":"offre_plus"}','Contrat d’acquisition — Annexe 4',30),
  ('terra-palm-plus','procuration_representant','Procuration du cotitulaire / mandataire','representant',false,'{"when":"representant_active"}','Contrat d’acquisition — Annexe 5',31),
  ('terra-palm-plus','securisation_complementaire','Document complémentaire de sécurisation','foncier',false,'{"when":"necessaire"}','Contrat d’acquisition — Annexe 6',32),
  ('terra-palm-plus','contrat_acquisition_signe','Contrat d’acquisition signé','contrat',true,'{}','Contrat d’acquisition',40),
  ('terra-palm-plus','contrat_accompagnement_signe','Contrat d’accompagnement agricole signé','contrat',true,'{}','Contrat d’accompagnement agricole',41),

  ('palm-terroir-essentielle','client_piece_recto','Pièce d’identité du Client — recto','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',10),
  ('palm-terroir-essentielle','client_piece_verso','Pièce d’identité du Client — verso','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',11),
  ('palm-terroir-essentielle','client_photo_profil','Photo du Client','client',true,'{}','Dossier CRM Client',12),
  ('palm-terroir-essentielle','justificatif_foncier','Justificatif foncier / document de sécurisation','foncier',false,'{"when":"necessaire"}','Contrat d’accompagnement — Identification de la parcelle',20),
  ('palm-terroir-essentielle','contrat_accompagnement_signe','Contrat d’accompagnement agricole signé','contrat',true,'{}','Contrat d’accompagnement agricole',40),

  ('palm-terroir-flexible','client_piece_recto','Pièce d’identité du Client — recto','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',10),
  ('palm-terroir-flexible','client_piece_verso','Pièce d’identité du Client — verso','client',true,'{}','Contrat d’accompagnement agricole — Annexe 1',11),
  ('palm-terroir-flexible','client_photo_profil','Photo du Client','client',true,'{}','Dossier CRM Client',12),
  ('palm-terroir-flexible','justificatif_foncier','Justificatif foncier / document de sécurisation','foncier',false,'{"when":"necessaire"}','Contrat d’accompagnement — Identification de la parcelle',20),
  ('palm-terroir-flexible','contrat_accompagnement_signe','Contrat d’accompagnement agricole signé','contrat',true,'{}','Contrat d’accompagnement agricole',40)
)
insert into public.offre_formulaire_documents(offre_id,code,libelle,categorie,obligatoire,condition,source_contractuelle,ordre)
select o.id,d.code,d.libelle,d.categorie,d.obligatoire,d.condition::jsonb,d.source_contractuelle,d.ordre
from public.offres o
join docs d on d.code_offre=o.code
where o.actif
on conflict (offre_id,code) do update set
  libelle=excluded.libelle,
  categorie=excluded.categorie,
  obligatoire=excluded.obligatoire,
  condition=excluded.condition,
  source_contractuelle=excluded.source_contractuelle,
  actif=true,
  ordre=excluded.ordre;

-- 5. Les contrats applicables sont directement liés à l'offre.
delete from public.offre_formulaire_contrats;

insert into public.offre_formulaire_contrats(offre_id,type_contrat,obligatoire,source_document)
select id,'accompagnement_agricole',true,'AgriCapital — Contrat d’accompagnement agricole'
from public.offres
where actif;

insert into public.offre_formulaire_contrats(offre_id,type_contrat,obligatoire,source_document)
select id,'acquisition_client',true,'AgriCapital — Contrat d’acquisition de plantation agricole'
from public.offres
where actif and contrat_acquisition_requis=true;

-- 6. Relations et index nécessaires au parcours.
create index if not exists idx_client_representants_client_type
  on public.client_cotitulaires_mandataires(client_id,type_relation,actif);

create index if not exists idx_formulaire_documents_offre_categorie
  on public.offre_formulaire_documents(offre_id,categorie,ordre);

-- 7. Nettoyage du vocabulaire du parcours : les données CRM restent des Clients.
comment on table public.client_cotitulaires_mandataires is
  'Personnes liées à un Client : cotitulaire ou mandataire.';

comment on column public.acquisitions_brouillon.donnees is
  'Brouillon du parcours Client. Les documents officiels peuvent employer acquéreur/acquisition, mais le CRM utilise Client.';

