-- 2026-09-27 : supprimer les triggers historiques dupliqués.
drop trigger if exists trg_souscripteur_recompute on public.souscripteurs;
drop trigger if exists trg_souscripteurs_generated_id on public.souscripteurs;
-- CI finalisation checkpoint 2026-09-27
