-- 2026-09-27 : file d'événements notification sans dépendance à un secret Edge custom.
create table if not exists public.notification_event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  context jsonb not null default '{}'::jsonb,
  statut text not null default 'en_attente' check(statut in ('en_attente','traite','echoue')),
  tentatives integer not null default 0,
  derniere_erreur text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_notification_event_outbox_pending on public.notification_event_outbox(statut,created_at);

create table if not exists public.notification_cron_state (
  id boolean primary key default true,
  last_run_at timestamptz
);
insert into public.notification_cron_state(id,last_run_at) values(true,null) on conflict(id) do nothing;

create or replace function public.notification_emit_event(_event text,_context jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.notification_event_outbox(event_code,context) values(_event,coalesce(_context,'{}'::jsonb));
exception when others then
  raise warning 'notification_emit_event failed: %',sqlerrm;
end $$;
