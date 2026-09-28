-- Migration miroir du flux Support -> Technicien, déjà appliquée à Supabase.
alter table public.tickets_techniques
  add column if not exists client_id uuid references public.clients(id),
  add column if not exists region_id uuid,
  add column if not exists categorie text,
  add column if not exists action_recommandee text,
  add column if not exists equipe_id uuid references public.equipes(id),
  add column if not exists assigne_le timestamptz,
  add column if not exists pris_en_charge_at timestamptz,
  add column if not exists resolution_note text;

alter table public.rapports_visites_techniques
  add column if not exists ticket_id uuid references public.tickets_techniques(id);

alter table public.interventions_techniques
  add column if not exists ticket_id uuid references public.tickets_techniques(id);

create index if not exists idx_tickets_techniques_client on public.tickets_techniques(client_id,created_at desc);
create index if not exists idx_tickets_techniques_region_status on public.tickets_techniques(region_id,statut,created_at desc);
create index if not exists idx_tickets_techniques_assignee_status on public.tickets_techniques(assigne_a,statut,created_at desc);
create index if not exists idx_rapports_visites_techniques_ticket on public.rapports_visites_techniques(ticket_id);
create index if not exists idx_interventions_techniques_ticket on public.interventions_techniques(ticket_id);

create or replace function public.assign_support_ticket_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare assigned_user uuid; manager_user uuid; supervisor_user uuid; client_name text;
begin
  if new.assigne_a is not null and (tg_op='INSERT' or new.assigne_a is distinct from old.assigne_a) then
    select p.user_id into assigned_user from profiles p where p.id=new.assigne_a and coalesce(p.actif,true);
    if assigned_user is not null then
      select coalesce(c.nom_complet, concat_ws(' ',c.prenoms,c.nom_famille),'Client') into client_name from clients c where c.id=new.client_id;
      insert into notifications(user_id,type,title,message,data) values(assigned_user,'support_assignment','Nouvelle intervention à traiter',coalesce(new.titre,'Demande client')||case when client_name is not null then ' — '||client_name else '' end,jsonb_build_object('ticket_id',new.id,'route','/support','region_id',new.region_id,'priority',new.priorite));
    end if;
  end if;
  if new.equipe_id is not null and (tg_op='INSERT' or new.equipe_id is distinct from old.equipe_id) then
    select p.user_id into manager_user from equipes e join profiles p on p.id=e.responsable_id where e.id=new.equipe_id and coalesce(p.actif,true);
    if manager_user is not null and manager_user <> assigned_user then
      insert into notifications(user_id,type,title,message,data) values(manager_user,'support_assignment','Nouvelle demande dans votre équipe',coalesce(new.titre,'Demande client'),jsonb_build_object('ticket_id',new.id,'route','/support','region_id',new.region_id));
    end if;
    select p.user_id into supervisor_user from equipes e join profiles p on p.id=e.superviseur_id where e.id=new.equipe_id and coalesce(p.actif,true);
    if supervisor_user is not null and supervisor_user <> coalesce(manager_user,assigned_user) then
      insert into notifications(user_id,type,title,message,data) values(supervisor_user,'support_assignment','Nouvelle demande technique dans votre région',coalesce(new.titre,'Demande client'),jsonb_build_object('ticket_id',new.id,'route','/support','region_id',new.region_id));
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_support_ticket_assignment_notifications on public.tickets_techniques;
create trigger trg_support_ticket_assignment_notifications after insert or update of assigne_a,equipe_id on public.tickets_techniques for each row execute function public.assign_support_ticket_notifications();

comment on table public.tickets_techniques is 'Support client : demande -> qualification -> affectation régionale -> intervention -> rapport -> publication client.';
