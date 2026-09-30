-- Portal messaging attachments: metadata + private storage bucket.
alter table public.portail_messages
  add column if not exists piece_jointe_url text,
  add column if not exists piece_jointe_nom text,
  add column if not exists piece_jointe_type text,
  add column if not exists piece_jointe_taille integer,
  add column if not exists piece_jointe_bucket text default 'portail-messages';

create unique index if not exists uq_portail_messages_attachment_path
  on public.portail_messages(piece_jointe_bucket, piece_jointe_url)
  where piece_jointe_url is not null;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('portail-messages','portail-messages',false,52428800,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','video/mp4','video/webm','video/quicktime','video/mpeg','application/pdf','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Staff can upload portal message attachments" on storage.objects;
create policy "Staff can upload portal message attachments" on storage.objects for insert to authenticated
with check (bucket_id='portail-messages' and private.is_staff((select auth.uid())));

drop policy if exists "Staff can read portal message attachments" on storage.objects;
create policy "Staff can read portal message attachments" on storage.objects for select to authenticated
using (bucket_id='portail-messages' and private.is_staff((select auth.uid())));

drop policy if exists "Staff can delete portal message attachments" on storage.objects;
create policy "Staff can delete portal message attachments" on storage.objects for delete to authenticated
using (bucket_id='portail-messages' and private.is_staff((select auth.uid())));
