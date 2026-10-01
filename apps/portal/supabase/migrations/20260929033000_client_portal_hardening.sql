create index if not exists idx_portail_messages_plantation_created_at
  on public.portail_messages (plantation_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portail_messages_message_length_check'
      and conrelid = 'public.portail_messages'::regclass
  ) then
    alter table public.portail_messages
      add constraint portail_messages_message_length_check
      check (char_length(btrim(message)) between 1 and 4000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'portail_messages_auteur_type_check'
      and conrelid = 'public.portail_messages'::regclass
  ) then
    alter table public.portail_messages
      add constraint portail_messages_auteur_type_check
      check (auteur_type in ('client','staff','technicien','commercial','system'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='client_portal_access_codes'
      and policyname='deny_client_portal_access_codes_api'
  ) then
    create policy deny_client_portal_access_codes_api
      on public.client_portal_access_codes
      for all to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

alter table public.portail_messages enable row level security;
alter table public.client_portal_access_codes enable row level security;