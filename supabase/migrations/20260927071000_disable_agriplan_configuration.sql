-- 2026-09-27 : désactiver définitivement l'ancienne configuration commerciale AgriPlan.
update public.agriplan_offre set actif=false where code='agriplan';