-- Remove only indexes proven identical by Supabase advisors on 2026-09-29.
-- Keep the descriptive/canonical index names used by the application.
drop index if exists public.idx_client_cotit_client;
drop index if exists public.idx_clients_portal_phone;
drop index if exists public.idx_clients_type_client;
drop index if exists public.idx_fk_rapports_visites_techniques_9abdeebb14cf2be4d24c816a9700;
drop index if exists public.idx_rvt_plantation_date;
drop index if exists public.villages_sp_idx;
