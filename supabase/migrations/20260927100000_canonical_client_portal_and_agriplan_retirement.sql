-- 2026-09-27 : canonisation du portail client et retrait opérationnel d'AgriPlan
-- Les historiques AgriPlan restent conservés pour traçabilité. Aucun nouveau parcours
-- ne doit plus créer, lire ou notifier ces données.

create table if not exists public.client_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  user_agent text,
  ip_address text
);

create index if not exists idx_client_portal_sessions_client
  on public.client_portal_sessions(client_id, expires_at desc);
create index if not exists idx_client_portal_sessions_active
  on public.client_portal_sessions(token_hash, expires_at)
  where revoked_at is null;

alter table public.client_portal_sessions enable row level security;
drop policy if exists deny_client_portal_sessions_api on public.client_portal_sessions;
create policy deny_client_portal_sessions_api
  on public.client_portal_sessions for all to anon, authenticated
  using (false) with check (false);
revoke all on public.client_portal_sessions from public, anon, authenticated;

update public.notification_automations
set actif=false, description='Désactivée : l’accès portail utilise désormais le numéro de téléphone et un code OTP.', updated_at=now()
where code='client_account_ready';

update public.notification_automations
set contenu='Bonjour {{prenom}}, votre compte AgriCapital est maintenant actif. Pour accéder à votre espace client, utilisez votre numéro de téléphone et le code de vérification reçu par SMS.',
    updated_at=now()
where code='compte_active_client';

update public.notification_segments
set actif=false, updated_at=now()
where lower(code) like '%agriplan%';

update public.notification_automations
set actif=false, updated_at=now()
where lower(code) like '%agriplan%' or lower(evenement) like '%agriplan%';

drop trigger if exists trg_agriplan_paiement_sync on public.paiements;
drop function if exists public.trg_agriplan_paiement();
