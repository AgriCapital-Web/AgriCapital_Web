-- Final notification / trigger hardening.
drop trigger if exists trigger_validate_plantation on public.plantations;
drop trigger if exists validate_plantation_trigger on public.plantations;
drop trigger if exists trg_plantations_update_client_stats on public.plantations;
drop trigger if exists trigger_update_client_stats on public.plantations;
drop trigger if exists trg_set_generated_ids_plantations on public.plantations;
drop trigger if exists trg_check_docs_create_depot on public.documents_acquisition;
drop trigger if exists trg_paiements_commission_auto on public.paiements;
drop trigger if exists trg_refresh_activation_payment on public.paiements;
drop trigger if exists recompute_pending_pi_after_offres_change on public.offres;
drop trigger if exists trg_offres_recompute_pi on public.offres;
drop trigger if exists trigger_calculate_parcelle_surfaces on public.parcelles;
drop trigger if exists trigger_update_proprietaire_stats on public.parcelles;
drop trigger if exists trg_set_generated_ids_parcelles on public.parcelles;
drop trigger if exists trg_set_generated_ids_proprietaires on public.proprietaires_terres;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  content_encoding text not null default 'aes128gcm',
  user_agent text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_owner_check check (user_id is not null or client_id is not null)
);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_api_deny on public.push_subscriptions;
create policy push_subscriptions_api_deny on public.push_subscriptions
for all to anon, authenticated using (false) with check (false);

create index if not exists idx_push_subscriptions_user_active
on public.push_subscriptions(user_id, active) where user_id is not null and active = true;
create index if not exists idx_push_subscriptions_client_active
on public.push_subscriptions(client_id, active) where client_id is not null and active = true;
create index if not exists idx_push_subscriptions_last_seen
on public.push_subscriptions(last_seen_at desc);

create unique index if not exists uq_notifications_dedupe_key
on public.notifications(dedupe_key) where dedupe_key is not null;

alter table public.notification_event_outbox add column if not exists derniere_erreur text;

create or replace function public.trg_notification_push_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_event_outbox(event_code, context)
  values ('notification_push', jsonb_build_object(
    'notification_id', new.id, 'user_id', new.user_id,
    'dedupe_key', coalesce(new.dedupe_key, new.id::text)
  ));
  return new;
exception when others then
  raise warning 'notification push outbox failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notifications_push_event on public.notifications;
create trigger trg_notifications_push_event after insert on public.notifications
for each row execute function public.trg_notification_push_event();

create or replace function public.trg_portail_notification_push_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_event_outbox(event_code, context)
  values ('portail_notification_push', jsonb_build_object(
    'portal_notification_id', new.id, 'client_id', new.client_id,
    'message_id', new.message_id, 'dedupe_key', new.dedupe_key
  ));
  return new;
exception when others then
  raise warning 'portal push outbox failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_portail_notifications_push_event on public.portail_notifications;
create trigger trg_portail_notifications_push_event after insert on public.portail_notifications
for each row execute function public.trg_portail_notification_push_event();

create trigger trg_offres_recompute_pi
after insert or delete or update of montant_pi_par_ha, montant_total_par_ha, montant_cash_par_ha, tranches_paiement, duree_paiement_mois, actif
on public.offres
for each statement execute function public.trg_recompute_pi_on_change();
