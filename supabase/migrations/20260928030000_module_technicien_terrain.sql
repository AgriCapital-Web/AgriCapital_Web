-- Module Technicien terrain : compléter le modèle canonique existant.
alter table public.rapports_visites_techniques
  add column if not exists constat text,
  add column if not exists travaux_realises text,
  add column if not exists etat_plantation text,
  add column if not exists prochaine_intervention date,
  add column if not exists localisation_gps_lat numeric,
  add column if not exists localisation_gps_lng numeric,
  add column if not exists equipe_id uuid references public.equipes(id);

create index if not exists idx_rapports_visites_techniques_agent on public.rapports_visites_techniques(agent_technique_id);
create index if not exists idx_rapports_visites_techniques_plantation_date on public.rapports_visites_techniques(plantation_id,date_visite desc);

-- Catalogue des étapes techniques métier : stockées dans le même champ canonique type_intervention.
-- Les valeurs historiques sont conservées.
comment on column public.interventions_techniques.type_intervention is
  'Etape technique : defrichage, piquetage, trouaison, mise_en_terre, remplacement, entretien, fertilisation, mise_en_production, remise, suivi_mensuel, autre.';

-- Nouveau rôle opérationnel dédié au terrain.
insert into public.app_roles(code,nom,court,description,niveau,niveau_label,actif)
values ('technicien','Technicien','Tech','Technicien terrain : visites, rapports, interventions et médias terrain.',5,'Opérationnel',true)
on conflict (code) do update set nom=excluded.nom,court=excluded.court,description=excluded.description,actif=true,updated_at=now();

insert into public.role_permissions(role_code,permission_code)
values
('technicien','clients.view'),
('technicien','plantations.view'),
('technicien','plantations.update'),
('technicien','documents.view'),
('technicien','documents.upload'),
('technicien','rapports.view_technique'),
('technicien','tickets.view'),
('technicien','tickets.create'),
('technicien','tickets.update')
on conflict do nothing;

-- Lecture staff terrain : technicien, chef technique et encadrement autorisé.
drop policy if exists "Staff manage technical visit reports" on public.rapports_visites_techniques;
drop policy if exists "Technician insert technical visit reports" on public.rapports_visites_techniques;
drop policy if exists "Technician update own technical visit reports" on public.rapports_visites_techniques;
drop policy if exists "Technical managers update visit reports" on public.rapports_visites_techniques;
create policy "Technical staff read technical visit reports"
on public.rapports_visites_techniques for select to authenticated
using (
  private.has_role((select auth.uid()),'technicien')
  or private.has_role((select auth.uid()),'chef_equipe_technique')
  or private.has_role((select auth.uid()),'responsable_operations')
  or private.has_role((select auth.uid()),'directeur_tc')
  or private.is_admin((select auth.uid()))
  or (client_visible and exists (
    select 1 from public.clients c where c.id=rapports_visites_techniques.client_id and c.user_id=(select auth.uid())
  ))
);

create policy "Technician insert technical visit reports"
on public.rapports_visites_techniques for insert to authenticated
with check (
  (
    private.has_role((select auth.uid()),'technicien')
    or private.has_role((select auth.uid()),'chef_equipe_technique')
    or private.has_role((select auth.uid()),'responsable_operations')
    or private.has_role((select auth.uid()),'directeur_tc')
    or private.is_admin((select auth.uid()))
  )
  and (
    client_visible=false
    or private.has_role((select auth.uid()),'chef_equipe_technique')
    or private.has_role((select auth.uid()),'responsable_operations')
    or private.has_role((select auth.uid()),'directeur_tc')
    or private.is_admin((select auth.uid()))
  )
);

create policy "Technician update own technical visit reports"
on public.rapports_visites_techniques for update to authenticated
using (
  private.has_role((select auth.uid()),'technicien')
  and exists (
    select 1 from public.profiles p
    where p.id=rapports_visites_techniques.created_by and p.user_id=(select auth.uid())
  )
)
with check (
  client_visible=false
  and (
    private.has_role((select auth.uid()),'technicien')
    and exists (
      select 1 from public.profiles p
      where p.id=rapports_visites_techniques.created_by and p.user_id=(select auth.uid())
    )
  )
);

create policy "Technical managers update visit reports"
on public.rapports_visites_techniques for update to authenticated
using (
  private.has_role((select auth.uid()),'chef_equipe_technique')
  or private.has_role((select auth.uid()),'responsable_operations')
  or private.has_role((select auth.uid()),'directeur_tc')
  or private.is_admin((select auth.uid()))
)
with check (true);

drop policy if exists "Staff manage technical visit media" on public.rapports_visites_medias;
create policy "Technical staff read visit media"
on public.rapports_visites_medias for select to authenticated
using (
  private.has_role((select auth.uid()),'technicien')
  or private.has_role((select auth.uid()),'chef_equipe_technique')
  or private.has_role((select auth.uid()),'responsable_operations')
  or private.has_role((select auth.uid()),'directeur_tc')
  or private.is_admin((select auth.uid()))
  or (client_visible and exists (
    select 1 from public.clients c
    join public.rapports_visites_techniques r on r.client_id=c.id
    where r.id=rapports_visites_medias.rapport_id and c.user_id=(select auth.uid())
  ))
);

create policy "Technical staff insert visit media"
on public.rapports_visites_medias for insert to authenticated
with check (
  private.has_role((select auth.uid()),'technicien')
  or private.has_role((select auth.uid()),'chef_equipe_technique')
  or private.has_role((select auth.uid()),'responsable_operations')
  or private.has_role((select auth.uid()),'directeur_tc')
  or private.is_admin((select auth.uid()))
);

create policy "Technical managers update visit media"
on public.rapports_visites_medias for update to authenticated
using (
  private.has_role((select auth.uid()),'chef_equipe_technique')
  or private.has_role((select auth.uid()),'responsable_operations')
  or private.has_role((select auth.uid()),'directeur_tc')
  or private.is_admin((select auth.uid()))
)
with check (true);
