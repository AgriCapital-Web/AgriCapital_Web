create or replace function public.prevent_manual_plantation_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() <= 1 then
    raise exception 'Une plantation ne peut pas être créée manuellement. Elle est créée automatiquement après validation technique de la mise en terre.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_manual_plantation_creation on public.plantations;
create trigger trg_prevent_manual_plantation_creation
before insert on public.plantations
for each row
execute function public.prevent_manual_plantation_creation();
