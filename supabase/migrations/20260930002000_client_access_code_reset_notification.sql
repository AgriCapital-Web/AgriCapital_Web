-- Client portal access-code reset notification
-- Idempotent: keeps the automation aligned between source control and production.
insert into public.notification_automations (
  code, nom, description, evenement, canal, actif, sujet, contenu, criteres
)
select
  'client_access_code_reset',
  'Reinitialisation code portail',
  'SMS apres reinitialisation du code portail',
  'client_access_code_reset',
  'sms',
  true,
  'Code portail reinitialise',
  'AgriCapital: votre code portail a ete reinitialise. Connectez-vous avec votre numero et creez un nouveau code a 4 chiffres.',
  '{"audience":"clients"}'::jsonb
where not exists (
  select 1 from public.notification_automations
  where evenement = 'client_access_code_reset'
);