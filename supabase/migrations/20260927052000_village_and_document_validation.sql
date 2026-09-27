-- 2026-09-27 : localisation village + validation documentaire.
alter table public.souscripteurs add column if not exists village_id uuid references public.villages(id);

create or replace function public.refresh_document_validation()
returns trigger language plpgsql security definer set search_path=public as $$
declare total_docs integer; valid_docs integer;
begin
  select count(*),count(*) filter(where lower(coalesce(statut,''))='valide')
  into total_docs,valid_docs
  from public.documents_souscription where souscripteur_id=new.souscripteur_id;
  update public.souscripteurs
  set documents_valides_at=case when total_docs>0 and total_docs=valid_docs then coalesce(documents_valides_at,now()) else null end,
      updated_at=now()
  where id=new.souscripteur_id;
  perform public.refresh_client_account_activation(new.souscripteur_id);
  return new;
end $$;

drop trigger if exists trg_refresh_document_validation on public.documents_souscription;
create trigger trg_refresh_document_validation after insert or update of statut on public.documents_souscription
for each row execute function public.refresh_document_validation();
