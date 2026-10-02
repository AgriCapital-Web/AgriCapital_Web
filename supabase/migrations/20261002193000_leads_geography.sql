alter table public.leads add column if not exists district_id uuid references public.districts(id);
alter table public.leads add column if not exists region_id uuid references public.regions(id);
alter table public.leads add column if not exists departement_id uuid references public.departements(id);
alter table public.leads add column if not exists sous_prefecture_id uuid references public.sous_prefectures(id);
alter table public.leads add column if not exists village_id uuid references public.villages(id);
create index if not exists idx_leads_geo on public.leads(district_id,region_id,departement_id,sous_prefecture_id,village_id);