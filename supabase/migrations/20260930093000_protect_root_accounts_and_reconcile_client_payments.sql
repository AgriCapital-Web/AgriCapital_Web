-- Protect the two permanent root accounts and document the payment-state rules used by the CRM.
create or replace function public.protect_root_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.id in (
    '8d616fdc-6f25-43e9-baaa-51ead746222e'::uuid,
    'bd9579fd-1d07-4431-9cc4-b57dfeeab593'::uuid
  ) then
    if tg_op = 'DELETE' then
      raise exception 'Compte racine protégé : suppression interdite';
    end if;
    if tg_op = 'UPDATE' and new.actif is distinct from old.actif and new.actif = false then
      raise exception 'Compte racine protégé : révocation/suspension interdite';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_root_accounts on public.profiles;
create trigger trg_protect_root_accounts
before update or delete on public.profiles
for each row execute function public.protect_root_accounts();

create or replace function public.protect_root_user_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.user_id in (
    '8d616fdc-6f25-43e9-baaa-51ead746222e'::uuid,
    'bd9579fd-1d07-4431-9cc4-b57dfeeab593'::uuid
  ) then
    raise exception 'Compte racine protégé : modification des rôles interdite';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_root_user_roles on public.user_roles;
create trigger trg_protect_root_user_roles
before update or delete on public.user_roles
for each row execute function public.protect_root_user_roles();

-- Never represent future scheduled installments as "pending".
update public.paiements
set statut='planifie',
    montant_paye=0,
    updated_at=now()
where statut='en_attente'
  and date_echeance is not null
  and date_echeance > current_date
  and coalesce(montant_paye,0) < coalesce(montant,0);
