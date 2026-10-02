-- 20261002195500: verrouillage des profils utilisateurs, identité recto/verso et stockage administré
alter table public.profiles
  add column if not exists piece_identite_recto_url text,
  add column if not exists piece_identite_verso_url text,
  add column if not exists piece_identite_page_principale_url text;

update public.profiles
set piece_identite_recto_url = coalesce(piece_identite_recto_url, piece_identite_url)
where piece_identite_url is not null
  and piece_identite_recto_url is null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('photos-profils','photos-profils',false,5242880,array['image/jpeg','image/png','image/webp']),
  ('pieces-identite','pieces-identite',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Users update own profile" on public.profiles;
create policy "Admins update profiles"
on public.profiles for update to authenticated
using (private.is_admin((select auth.uid())))
with check (private.is_admin((select auth.uid())));

drop policy if exists "Users manage own profile photo paths" on storage.objects;
drop policy if exists "Users manage own profile photo paths v2" on storage.objects;
drop policy if exists "Users upload own profile photo" on storage.objects;
drop policy if exists "Users update own profile photo" on storage.objects;
drop policy if exists "Users delete own profile photo" on storage.objects;
drop policy if exists "Authenticated upload own business files" on storage.objects;
drop policy if exists "Owners update business files" on storage.objects;
drop policy if exists "Owners delete business files" on storage.objects;
drop policy if exists "Staff read business files" on storage.objects;

create policy "Admin upload profile photos"
on storage.objects for insert to authenticated
with check (bucket_id='photos-profils' and private.is_admin((select auth.uid())));

create policy "Admin update profile photos"
on storage.objects for update to authenticated
using (bucket_id='photos-profils' and private.is_admin((select auth.uid())))
with check (bucket_id='photos-profils' and private.is_admin((select auth.uid())));

create policy "Admin delete profile photos"
on storage.objects for delete to authenticated
using (bucket_id='photos-profils' and private.is_admin((select auth.uid())));

create policy "Staff read business files excluding profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = any(array['documents','documents-fonciers','photos-plantations','pieces-identite','preuves-paiement'])
  and private.is_staff((select auth.uid()))
);

create policy "Staff upload business files excluding profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = any(array['documents','documents-fonciers','photos-plantations','pieces-identite','preuves-paiement'])
  and private.is_staff((select auth.uid()))
  and not (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles')
);

create policy "Staff update business files excluding profile photos"
on storage.objects for update to authenticated
using (
  bucket_id = any(array['documents','documents-fonciers','photos-plantations','pieces-identite','preuves-paiement'])
  and private.is_staff((select auth.uid()))
  and not (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles')
)
with check (
  bucket_id = any(array['documents','documents-fonciers','photos-plantations','pieces-identite','preuves-paiement'])
  and private.is_staff((select auth.uid()))
  and not (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles')
);

create policy "Staff delete business files excluding profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = any(array['documents','documents-fonciers','photos-plantations','pieces-identite','preuves-paiement'])
  and private.is_staff((select auth.uid()))
  and not (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles')
);

create policy "Admin profile identity read"
on storage.objects for select to authenticated
using (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles' and private.is_admin((select auth.uid())));

create policy "Admin profile identity upload"
on storage.objects for insert to authenticated
with check (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles' and private.is_admin((select auth.uid())));

create policy "Admin profile identity update"
on storage.objects for update to authenticated
using (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles' and private.is_admin((select auth.uid())))
with check (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles' and private.is_admin((select auth.uid())));

create policy "Admin profile identity delete"
on storage.objects for delete to authenticated
using (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles' and private.is_admin((select auth.uid())));

create policy "Users read own profile identity"
on storage.objects for select to authenticated
using (bucket_id='pieces-identite' and (storage.foldername(name))[1]='profiles' and (storage.foldername(name))[2]=(select auth.uid())::text);

drop policy if exists "Staff read private identity docs" on storage.objects;
drop policy if exists "Staff upload private identity docs" on storage.objects;
drop policy if exists "Staff update private identity docs" on storage.objects;
drop policy if exists "Staff delete private identity docs" on storage.objects;

create policy "Staff read private identity docs"
on storage.objects for select to authenticated
using (bucket_id='pieces-identite' and private.is_staff((select auth.uid())) and (storage.foldername(name))[1] <> 'profiles');

create policy "Staff upload private identity docs"
on storage.objects for insert to authenticated
with check (bucket_id='pieces-identite' and private.is_staff((select auth.uid())) and (storage.foldername(name))[1] <> 'profiles');

create policy "Staff update private identity docs"
on storage.objects for update to authenticated
using (bucket_id='pieces-identite' and private.is_staff((select auth.uid())) and (storage.foldername(name))[1] <> 'profiles')
with check (bucket_id='pieces-identite' and private.is_staff((select auth.uid())) and (storage.foldername(name))[1] <> 'profiles');

create policy "Staff delete private identity docs"
on storage.objects for delete to authenticated
using (bucket_id='pieces-identite' and private.is_staff((select auth.uid())) and (storage.foldername(name))[1] <> 'profiles');
