-- Consolidation des relations paiements / commissions / portefeuilles.
-- Garantit que chaque paiement et chaque commission restent rattachés à leurs entités métier.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'commissions_client_id_fkey'
  ) then
    alter table public.commissions
      add constraint commissions_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'commissions_paiement_id_fkey'
  ) then
    alter table public.commissions
      add constraint commissions_paiement_id_fkey
      foreign key (paiement_id) references public.paiements(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'paiements_created_by_fkey'
  ) then
    alter table public.paiements
      add constraint paiements_created_by_fkey
      foreign key (created_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'paiements_valide_par_fkey'
  ) then
    alter table public.paiements
      add constraint paiements_valide_par_fkey
      foreign key (valide_par) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'commissions_valide_par_fkey'
  ) then
    alter table public.commissions
      add constraint commissions_valide_par_fkey
      foreign key (valide_par) references public.profiles(id) on delete set null;
  end if;
end $;

do $
begin
  if not exists (select 1 from pg_constraint where conname = 'portefeuilles_user_id_fkey') then
    alter table public.portefeuilles
      add constraint portefeuilles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'remboursements_traite_par_fkey') then
    alter table public.remboursements
      add constraint remboursements_traite_par_fkey
      foreign key (traite_par) references auth.users(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transferts_paiements_effectue_par_fkey') then
    alter table public.transferts_paiements
      add constraint transferts_paiements_effectue_par_fkey
      foreign key (effectue_par) references auth.users(id) on delete set null;
  end if;
end $;

create index if not exists idx_paiements_client_created_at
  on public.paiements(client_id, created_at desc);

create index if not exists idx_paiements_statut_created_at
  on public.paiements(statut, created_at desc);

create index if not exists idx_paiements_type_statut
  on public.paiements(type_paiement, statut);

create index if not exists idx_commissions_client_periode
  on public.commissions(client_id, periode desc);

create index if not exists idx_commissions_paiement
  on public.commissions(paiement_id);

create index if not exists idx_commissions_profile_statut
  on public.commissions(profile_id, statut);

-- Réconciliation du dossier KOUAKOU KOUAME FERDINAND.
-- Le paiement initial validé de 65 000 F CFA pour la formule PalmTerroir Flexible
-- ouvre une commission d'acquisition de 5 000 F CFA pour INOCENT KOFFI.
insert into public.commissions(
  profile_id, plantation_id, type_commission, montant_base, taux_commission,
  montant_commission, periode, statut, valide_par, date_validation,
  date_calcul, paiement_id, client_id, taux_applique, annee_contrat
)
select
  'bd9579fd-1d07-4431-9cc4-b57dfeeab593'::uuid,
  p.plantation_id,
  'acquisition',
  coalesce(p.montant_paye, p.montant),
  0,
  5000,
  coalesce(p.date_paiement::date, current_date),
  'validee',
  'bd9579fd-1d07-4431-9cc4-b57dfeeab593'::uuid,
  coalesce(p.date_validation, now()),
  now(),
  p.id,
  p.client_id,
  0,
  1
from public.paiements p
join public.clients c on c.id = p.client_id
left join lateral (
  select pl.id as plantation_id
  from public.plantations pl
  where pl.client_id = c.id
  order by pl.created_at desc
  limit 1
) pl on true
where c.nom_complet ilike '%KOUAKOU KOUAME FERDINAND%'
  and p.est_paiement_initial = true
  and p.statut = 'valide'
  and not exists (
    select 1 from public.commissions cm
    where cm.paiement_id = p.id and cm.type_commission = 'acquisition'
  )
limit 1;

select public.recalculer_portefeuilles_commissions();
