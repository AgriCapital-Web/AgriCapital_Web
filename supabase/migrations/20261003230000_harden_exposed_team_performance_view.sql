-- Sécurité: les vues exposées doivent respecter les privilèges/RLS
-- de l'utilisateur qui les interroge, pas ceux du propriétaire de la vue.
ALTER VIEW public.v_performance_equipes SET (security_invoker = true);
