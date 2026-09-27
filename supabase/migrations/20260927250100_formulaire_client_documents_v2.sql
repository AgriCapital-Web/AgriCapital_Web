-- Formulaire client V2 : calendrier des pièces contractuelles
-- Les annexes établies après l'identification technique ne bloquent pas la création initiale du Client.

update public.offre_formulaire_documents
set obligatoire=false,
    condition='{"statut":"a_etablir"}'::jsonb
where code='plan_individuel';

update public.offre_formulaire_documents
set obligatoire=false,
    condition='{"statut":"conditionnel"}'::jsonb
where code='plan_bloc';

-- Les photos/identité du Client restent obligatoires dans le parcours CRM.
update public.offre_formulaire_documents
set obligatoire=true
where code in ('client_piece_recto','client_piece_verso','client_photo_profil');

-- Les pièces du représentant ne sont requises que si un représentant est effectivement désigné.
update public.offre_formulaire_documents
set obligatoire=false,
    condition='{"when":"representant_active"}'::jsonb
where code='procuration_representant';

