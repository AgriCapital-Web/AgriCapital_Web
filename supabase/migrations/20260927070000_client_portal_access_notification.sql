-- 2026-09-27 : notification automatique d'accès au portail client.
insert into public.notification_automations
  (code,nom,description,evenement,canal,sujet,contenu,criteres,conditions,actif,cooldown_minutes)
values
  ('client_account_ready','Accès portail client prêt',
   'Envoie les identifiants du portail après activation automatique du compte client.',
   'client_account_ready','auto',
   'Votre accès au portail AgriCapital',
   'Bonjour {{nom}}, votre compte client AgriCapital est activé. Identifiant : {{username}}. Mot de passe temporaire : {{password}}. Portail : {{portail_url}}. Vous pourrez modifier votre mot de passe après connexion.',
   '{}'::jsonb,'{}'::jsonb,true,0)
on conflict (code) do update set
  nom=excluded.nom,description=excluded.description,evenement=excluded.evenement,
  canal=excluded.canal,sujet=excluded.sujet,contenu=excluded.contenu,
  criteres=excluded.criteres,conditions=excluded.conditions,actif=true,cooldown_minutes=0,updated_at=now();