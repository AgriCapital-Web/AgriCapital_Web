-- Finance & Comptabilité intégrée AgriCapital
-- Une seule source métier: clients/offres/plantations/paiements/commissions restent dans le CRM.
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date timestamptz not null default now(),
  direction text not null check (direction in ('entree','sortie')),
  category text not null,
  label text not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text,
  reference text,
  client_id uuid references public.clients(id) on delete set null,
  plantation_id uuid references public.plantations(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  source_type text,
  source_id uuid,
  status text not null default 'valide' check (status in ('brouillon','valide','annule')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists finance_transactions_source_uidx on public.finance_transactions(source_type,source_id) where source_type is not null and source_id is not null;
create index if not exists finance_transactions_date_idx on public.finance_transactions(transaction_date);

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.finance_transactions(id) on delete cascade,
  expense_category text not null,
  supplier_name text,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  plantation_id uuid references public.plantations(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  is_direct_cost boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_associates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  role_label text not null default 'ASSOCIÉ',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists finance_associates_profile_uidx on public.finance_associates(profile_id) where profile_id is not null;

create table if not exists public.finance_associate_transactions (
  id uuid primary key default gen_random_uuid(),
  associate_id uuid not null references public.finance_associates(id) on delete restrict,
  transaction_id uuid not null unique references public.finance_transactions(id) on delete cascade,
  movement_type text not null check (movement_type in ('apport','remboursement','autre')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_salary_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  base_salary numeric(14,2) not null default 0 check (base_salary >= 0),
  pay_day integer not null default 28 check (pay_day between 1 and 31),
  active boolean not null default true,
  effective_from date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'brouillon' check (status in ('brouillon','valide','paye','annule')),
  generated_at timestamptz not null default now(),
  validated_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  notes text,
  unique(period_start,period_end)
);

create table if not exists public.finance_payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.finance_payroll_runs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  base_salary numeric(14,2) not null default 0,
  commissions numeric(14,2) not null default 0,
  bonuses numeric(14,2) not null default 0,
  deductions numeric(14,2) not null default 0,
  net_salary numeric(14,2) generated always as (greatest(0,base_salary+commissions+bonuses-deductions)) stored,
  status text not null default 'calcule' check (status in ('calcule','valide','paye','annule')),
  transaction_id uuid unique references public.finance_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(payroll_run_id,profile_id)
);

create or replace function public.finance_can_view() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('super_admin','pdg','dg','comptable','responsable_operations','associe_actionnaire'));
$$;
create or replace function public.finance_can_manage() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('super_admin','pdg','dg','comptable'));
$$;

alter table public.finance_transactions enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_associates enable row level security;
alter table public.finance_associate_transactions enable row level security;
alter table public.finance_salary_profiles enable row level security;
alter table public.finance_payroll_runs enable row level security;
alter table public.finance_payroll_items enable row level security;

drop policy if exists finance_transactions_select on public.finance_transactions;
drop policy if exists finance_transactions_manage on public.finance_transactions;
create policy finance_transactions_select on public.finance_transactions for select using (public.finance_can_view());
create policy finance_transactions_manage on public.finance_transactions for all using (public.finance_can_manage()) with check (public.finance_can_manage());

drop policy if exists finance_expenses_select on public.finance_expenses;
drop policy if exists finance_expenses_manage on public.finance_expenses;
create policy finance_expenses_select on public.finance_expenses for select using (public.finance_can_view());
create policy finance_expenses_manage on public.finance_expenses for all using (public.finance_can_manage()) with check (public.finance_can_manage());

drop policy if exists finance_associates_select on public.finance_associates;
drop policy if exists finance_associates_manage on public.finance_associates;
create policy finance_associates_select on public.finance_associates for select using (public.finance_can_view());
create policy finance_associates_manage on public.finance_associates for all using (public.finance_can_manage()) with check (public.finance_can_manage());

drop policy if exists finance_associate_transactions_select on public.finance_associate_transactions;
drop policy if exists finance_associate_transactions_manage on public.finance_associate_transactions;
create policy finance_associate_transactions_select on public.finance_associate_transactions for select using (public.finance_can_view());
create policy finance_associate_transactions_manage on public.finance_associate_transactions for all using (public.finance_can_manage()) with check (public.finance_can_manage());

drop policy if exists finance_salary_profiles_select on public.finance_salary_profiles;
drop policy if exists finance_salary_profiles_manage on public.finance_salary_profiles;
create policy finance_salary_profiles_select on public.finance_salary_profiles for select using (public.finance_can_view());
create policy finance_salary_profiles_manage on public.finance_salary_profiles for all using (public.finance_can_manage()) with check (public.finance_can_manage());

drop policy if exists finance_payroll_runs_select on public.finance_payroll_runs;
drop policy if exists finance_payroll_runs_manage on public.finance_payroll_runs;
create policy finance_payroll_runs_select on public.finance_payroll_runs for select using (public.finance_can_view());
create policy finance_payroll_runs_manage on public.finance_payroll_runs for all using (public.finance_can_manage()) with check (public.finance_can_manage());

drop policy if exists finance_payroll_items_select on public.finance_payroll_items;
drop policy if exists finance_payroll_items_manage on public.finance_payroll_items;
create policy finance_payroll_items_select on public.finance_payroll_items for select using (public.finance_can_view());
create policy finance_payroll_items_manage on public.finance_payroll_items for all using (public.finance_can_manage()) with check (public.finance_can_manage());

create or replace function public.finance_sync_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare v_amount numeric;
begin
  if lower(coalesce(new.statut,''))='valide' then
    v_amount:=greatest(coalesce(new.montant_paye,0),coalesce(new.montant,0));
    if v_amount>0 then
      insert into public.finance_transactions(transaction_date,direction,category,label,amount,payment_method,reference,client_id,plantation_id,source_type,source_id,status,notes,created_by)
      values(coalesce(new.date_paiement,new.created_at,now()),'entree',case when upper(coalesce(new.type_paiement,'')) in ('REDEVANCE','PI','DEPOT_INITIAL') then 'ENCAISSEMENT_CLIENT' else 'ENCAISSEMENT' end,'PAIEMENT CLIENT',v_amount,new.mode_paiement,new.reference,new.client_id,new.plantation_id,'paiement',new.id,'valide',new.notes,new.created_by)
      on conflict (source_type,source_id) where source_type is not null and source_id is not null do update set amount=excluded.amount,transaction_date=excluded.transaction_date,status='valide',updated_at=now();
    end if;
  elsif lower(coalesce(new.statut,'')) in ('annule','refuse') then
    update public.finance_transactions set status='annule',updated_at=now() where source_type='paiement' and source_id=new.id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_finance_sync_payment on public.paiements;
create trigger trg_finance_sync_payment after insert or update of statut,montant_paye,montant,date_paiement,mode_paiement,reference on public.paiements for each row execute function public.finance_sync_payment();

create or replace function public.finance_sync_commission() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if lower(coalesce(new.statut,'')) in ('validee','payee') and coalesce(new.montant_commission,0)>0 then
    insert into public.finance_transactions(transaction_date,direction,category,label,amount,client_id,plantation_id,profile_id,source_type,source_id,status)
    values(coalesce(new.date_validation,new.date_calcul,new.created_at,now()),'sortie','COMMISSION','COMMISSION '||upper(coalesce(new.type_commission,'')),new.montant_commission,new.client_id,new.plantation_id,new.profile_id,'commission',new.id,'valide')
    on conflict (source_type,source_id) where source_type is not null and source_id is not null do update set amount=excluded.amount,status='valide',updated_at=now();
  elsif lower(coalesce(new.statut,''))='annule' then
    update public.finance_transactions set status='annule',updated_at=now() where source_type='commission' and source_id=new.id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_finance_sync_commission on public.commissions;
create trigger trg_finance_sync_commission after insert or update of statut,montant_commission,date_validation on public.commissions for each row execute function public.finance_sync_commission();

create or replace function public.finance_sync_salary_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare v_tx uuid;
begin
  if lower(coalesce(new.status,''))='paye' and new.transaction_id is null then
    insert into public.finance_transactions(transaction_date,direction,category,label,amount,profile_id,source_type,source_id,status,created_by)
    values(now(),'sortie','SALAIRE','SALAIRE - '||coalesce((select nom_complet from public.profiles where id=new.profile_id),'EMPLOYE'),new.net_salary,new.profile_id,'paie',new.id,'valide',auth.uid())
    returning id into v_tx;
    new.transaction_id:=v_tx;
  end if;
  return new;
end; $$;
drop trigger if exists trg_finance_sync_salary_payment on public.finance_payroll_items;
create trigger trg_finance_sync_salary_payment before update of status,transaction_id on public.finance_payroll_items for each row execute function public.finance_sync_salary_payment();

insert into public.role_permissions(role_code,permission_code)
select r.role_code,p.permission_code from (values('super_admin'),('pdg'),('dg'),('comptable')) r(role_code)
cross join (values('finance.view'),('finance.manage'),('finance.expenses'),('finance.payroll'),('finance.associates'),('finance.reports')) p(permission_code)
on conflict(role_code,permission_code) do nothing;
insert into public.role_permissions(role_code,permission_code)
select r.role_code,p.permission_code from (values('responsable_operations'),('associe_actionnaire')) r(role_code)
cross join (values('finance.view'),('finance.reports')) p(permission_code)
on conflict(role_code,permission_code) do nothing;

insert into public.finance_associates(full_name,role_label) values
('KOFFI INOCENT','FONDATEUR'),('KWAKU KWAME JAKA','ASSOCIÉ'),('KWAME KWADJO JULIEN','ASSOCIÉ'),('YAO KWAME SAMUEL','ASSOCIÉ'),('YAO KONAN LAZARE','ASSOCIÉ'),('KWAME KWAKU JUNIOR','ASSOCIÉ')
on conflict do nothing;

insert into public.finance_transactions(transaction_date,direction,category,label,amount,payment_method,reference,client_id,plantation_id,source_type,source_id,status,notes,created_by)
select coalesce(p.date_paiement,p.created_at,now()),'entree',case when upper(coalesce(p.type_paiement,'')) in ('REDEVANCE','PI','DEPOT_INITIAL') then 'ENCAISSEMENT_CLIENT' else 'ENCAISSEMENT' end,'PAIEMENT CLIENT',greatest(coalesce(p.montant_paye,0),coalesce(p.montant,0)),p.mode_paiement,p.reference,p.client_id,p.plantation_id,'paiement',p.id,'valide',p.notes,p.created_by
from public.paiements p where lower(coalesce(p.statut,''))='valide' and greatest(coalesce(p.montant_paye,0),coalesce(p.montant,0))>0
on conflict(source_type,source_id) where source_type is not null and source_id is not null do nothing;
insert into public.finance_transactions(transaction_date,direction,category,label,amount,client_id,plantation_id,profile_id,source_type,source_id,status)
select coalesce(c.date_validation,c.date_calcul,c.created_at,now()),'sortie','COMMISSION','COMMISSION '||upper(coalesce(c.type_commission,'')),c.montant_commission,c.client_id,c.plantation_id,c.profile_id,'commission',c.id,'valide'
from public.commissions c where lower(coalesce(c.statut,'')) in ('validee','payee') and c.montant_commission>0
on conflict(source_type,source_id) where source_type is not null and source_id is not null do nothing;
