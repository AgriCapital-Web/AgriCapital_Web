-- Nettoyage du parcours Support et des anciens rôles
-- Le Support recueille uniquement le signalement du client.
-- L'analyse, la consigne et la décision technique restent dans l'Espace Terrain.

alter table public.tickets_techniques drop column if exists action_recommandee;

delete from public.role_permissions where role_code = 'directeur_tc';
delete from public.app_roles where code = 'directeur_tc';

-- Les fonctions/RLS ont été alignées en production sur les rôles officiels actuels :
-- super_admin, responsable_operations, responsable_commercial, comptable,
-- commercial, service_client, assistant_administratif,
-- chef_equipe_commercial, chef_equipe_technique, technicien,
-- chef_equipe_service_client, associe_actionnaire.
