-- Planté-Partagé: activation progressive 50/50 + notifications propriétaires
-- 2026-09-28

alter table public.parcelles
  add column if not exists plantation_partagee_activee boolean not null default false,
  add column if not exists plantation_surface_cible_ha numeric(12,4),
  add column if not exists plantation_type_culture text default 'Palmier à huile',
  add column if not exists plantation_densite_plants integer,
  add column if not exists plantation_date_activation date;

alter table public.plantations
  add column if not exists activation_id uuid,
  add column if not exists role_attribution text not null default 'beneficiaire';

create table if not exists public.plantation_activations (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots_hectares(id) on delete restrict,
  parcelle_id uuid not null references public.parcelles(id) on delete restrict,
  proprietaire_id uuid not null references public.proprietaires_terres(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  surface_client_ha numeric(12,4) not null check (surface_client_ha > 0),
  surface_proprietaire_ha numeric(12,4) not null check (surface_proprietaire_ha > 0),
  statut text not null default 'active',
  date_activation date not null default current_date,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plantation_activations_parcelle on public.plantation_activations(parcelle_id);
create index if not exists idx_plantation_activations_proprietaire on public.plantation_activations(proprietaire_id);
create index if not exists idx_plantation_activations_client on public.plantation_activations(client_id);
create index if not exists idx_plantations_activation on public.plantations(activation_id);

alter table public.plantation_activations enable row level security;
drop policy if exists "staff_manage_plantation_activations" on public.plantation_activations;
create policy "staff_manage_plantation_activations"
on public.plantation_activations for all to authenticated
using ((select public.is_staff(auth.uid())))
with check ((select public.is_staff(auth.uid())));

drop function if exists public.notification_resolve_recipients(jsonb);
create or replace function public.notification_resolve_recipients(_criteres jsonb default '{}'::jsonb)
returns table(
  source_type text, source_id uuid, user_id uuid, nom_complet text, email text,
  telephone text, whatsapp text, role_code text, offre_id uuid, offre_code text, offre_nom text
)
language sql stable security definer set search_path='public'
as $function$
with contacts(source_type,source_id,user_id,nom_complet,email,telephone,whatsapp,role_code,offre_id,offre_code,offre_nom) as (
  select 'equipe',p.id,p.user_id,p.nom_complet,p.email,p.telephone,p.whatsapp,ur.role,null::uuid,null::text,null::text
  from public.profiles p
  left join lateral (select r.role from public.user_roles r where r.user_id=p.user_id order by r.created_at limit 1) ur on true
  where coalesce(p.actif,true) and public.is_staff(p.user_id)
  union all
  select 'client',s.id,s.user_id,coalesce(nullif(s.nom_complet,''),concat_ws(' ',s.prenoms,s.nom_famille)),s.email,s.telephone,s.whatsapp,null::text,s.offre_id,o.code,o.nom
  from public.clients s left join public.offres o on o.id=s.offre_id
  where coalesce(s.statut,'actif') not in ('archive','supprime')
  union all
  select 'prospect',l.id,null::uuid,concat_ws(' ',l.prenoms,l.nom),l.email,l.telephone,l.whatsapp,null::text,null::uuid,null::text,null::text
  from public.leads l where coalesce(l.statut,'nouveau') not in ('archive','supprime')
  union all
  select 'proprietaire_foncier',p.id,null::uuid,p.nom_complet,p.email,p.telephone,p.whatsapp,'proprietaire_foncier',null::uuid,null::text,null::text
  from public.proprietaires_terres p where coalesce(p.statut,'actif') not in ('archive','supprime')
)
select c.* from contacts c
where (
  coalesce(_criteres->>'audience','tous') in ('tous','all')
  or (coalesce(_criteres->>'audience','') in ('clients','client') and c.source_type='client')
  or (coalesce(_criteres->>'audience','') in ('beneficiaires_particuliers','beneficiaire_particulier') and c.source_type='client'
      and exists (select 1 from public.clients bc where bc.id=c.source_id and bc.type_client='beneficiaire_particulier'))
  or (coalesce(_criteres->>'audience','') in ('proprietaires_fonciers','proprietaire_foncier','proprietaires') and c.source_type='proprietaire_foncier')
  or (coalesce(_criteres->>'audience','') in ('prospects','prospect') and c.source_type='prospect')
  or (coalesce(_criteres->>'audience','') in ('equipe','equipe_interne','staff','team') and c.source_type='equipe')
  or (coalesce(_criteres->>'audience','')='palminvest' and lower(coalesce(c.offre_code,'')) in ('palm-invest','palm-invest-plus'))
  or (coalesce(_criteres->>'audience','')='terrapalm' and lower(coalesce(c.offre_code,'')) in ('terra-palm','terra-palm-plus'))
  or (coalesce(_criteres->>'audience','')='palminvest_plus' and lower(coalesce(c.offre_code,''))='palm-invest-plus')
  or (coalesce(_criteres->>'audience','')='terrapalm_plus' and lower(coalesce(c.offre_code,''))='terra-palm-plus')
  or (coalesce(_criteres->>'audience','')='palmterroir' and lower(coalesce(c.offre_code,'')) in ('palm-terroir-essentielle','palm-terroir-flexible'))
  or (coalesce(_criteres->>'audience','')='palmterroir_essentielle' and lower(coalesce(c.offre_code,''))='palm-terroir-essentielle')
  or (coalesce(_criteres->>'audience','')='palmterroir_flexible' and lower(coalesce(c.offre_code,''))='palm-terroir-flexible')
)
and (nullif(_criteres->>'offer_code','') is null or lower(coalesce(c.offre_code,''))=lower(_criteres->>'offer_code'))
and (nullif(_criteres->>'role_code','') is null or c.role_code=_criteres->>'role_code')
and (nullif(_criteres->>'has_email','') is null or case when (_criteres->>'has_email')::boolean then nullif(trim(c.email),'') is not null else nullif(trim(c.email),'') is null end)
and (nullif(_criteres->>'has_phone','') is null or case when (_criteres->>'has_phone')::boolean then coalesce(nullif(trim(c.telephone),''),nullif(trim(c.whatsapp),'')) is not null else coalesce(nullif(trim(c.telephone),''),nullif(trim(c.whatsapp),'')) is null end);
$function$;

revoke execute on function public.notification_resolve_recipients(jsonb) from public,anon;
grant execute on function public.notification_resolve_recipients(jsonb) to authenticated;

create or replace function public.activate_shared_plantation_from_lot(
  p_lot_id uuid,
  p_client_id uuid,
  p_date_activation date default current_date
)
returns jsonb
language plpgsql security definer set search_path='public'
as $function$
declare
  v_lot public.lots_hectares%rowtype;
  v_parcelle public.parcelles%rowtype;
  v_owner public.proprietaires_terres%rowtype;
  v_client public.clients%rowtype;
  v_activation public.plantation_activations%rowtype;
  v_surface numeric;
  v_agri_share numeric;
  v_allocated numeric;
  v_user uuid := auth.uid();
  v_client_plantation uuid;
  v_owner_plantation uuid;
begin
  if v_user is not null and not public.is_staff(v_user) then
    raise exception 'Accès réservé au personnel AgriCapital';
  end if;

  select * into v_lot from public.lots_hectares where id=p_lot_id for update;
  if v_lot.id is null then raise exception 'Lot introuvable'; end if;
  if v_lot.client_id is not null and v_lot.client_id <> p_client_id then raise exception 'Lot déjà attribué'; end if;

  select * into v_client from public.clients where id=p_client_id;
  if v_client.id is null then raise exception 'Client introuvable'; end if;

  select * into v_parcelle from public.parcelles where id=v_lot.parcelle_id for update;
  if v_parcelle.id is null then raise exception 'Parcelle du lot introuvable'; end if;
  select * into v_owner from public.proprietaires_terres where id=v_parcelle.proprietaire_id;
  if v_owner.id is null then raise exception 'Propriétaire foncier introuvable'; end if;

  v_surface := coalesce(v_lot.surface_ha,1);
  v_agri_share := coalesce(v_parcelle.surface_agricapital_ha, v_parcelle.surface_totale_ha/2, 0);
  select coalesce(sum(l.surface_ha),0) into v_allocated
  from public.lots_hectares l
  where l.parcelle_id=v_parcelle.id and l.id<>v_lot.id and l.client_id is not null and l.statut='attribue';
  if v_allocated + v_surface > v_agri_share then
    raise exception 'La part AgriCapital disponible de la parcelle est insuffisante';
  end if;

  select * into v_activation from public.plantation_activations where lot_id=v_lot.id;
  if v_activation.id is null then
    insert into public.plantation_activations(
      lot_id,parcelle_id,proprietaire_id,client_id,surface_client_ha,surface_proprietaire_ha,
      statut,date_activation,created_by,updated_by
    ) values (
      v_lot.id,v_parcelle.id,v_owner.id,p_client_id,v_surface,v_surface,
      'active',coalesce(p_date_activation,current_date),v_user,v_user
    ) returning * into v_activation;
  else
    update public.plantation_activations set client_id=p_client_id,statut='active',
      date_activation=coalesce(p_date_activation,date_activation),updated_by=v_user,updated_at=now()
    where id=v_activation.id returning * into v_activation;
  end if;

  insert into public.plantations(
    client_id,parcelle_id,activation_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,
    nombre_plants,densite_plants,region_id,departement_id,sous_prefecture_id,village,village_nom,localite,
    latitude,longitude,date_plantation,date_activation,statut,statut_global,type_culture,notes,created_by,updated_by
  )
  select p_client_id,v_parcelle.id,v_activation.id,'beneficiaire',
    coalesce('Plantation '||v_client.nom_complet,'Plantation bénéficiaire'),coalesce('Plantation '||v_client.nom_complet,'Plantation bénéficiaire'),
    v_surface,v_surface,coalesce(v_surface::numeric * coalesce(v_parcelle.plantation_densite_plants,140),0)::integer,
    coalesce(v_parcelle.plantation_densite_plants,140),v_parcelle.region_id,v_parcelle.departement_id,v_parcelle.sous_prefecture_id,
    v_parcelle.village,v_parcelle.village,v_parcelle.village,v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
    coalesce(v_parcelle.plantation_date_activation,p_date_activation,current_date),coalesce(p_date_activation,current_date),
    'active','active',coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),
    'Planté-Partagé : part bénéficiaire correspondant au lot hectare '||coalesce(v_lot.reference,v_lot.id::text),v_user,v_user
  where not exists (select 1 from public.plantations p where p.activation_id=v_activation.id and p.role_attribution='beneficiaire')
  returning id into v_client_plantation;

  insert into public.plantations(
    client_id,parcelle_id,activation_id,role_attribution,nom,nom_plantation,superficie_ha,superficie_activee,
    nombre_plants,densite_plants,region_id,departement_id,sous_prefecture_id,village,village_nom,localite,
    latitude,longitude,date_plantation,date_activation,statut,statut_global,type_culture,notes,created_by,updated_by
  )
  select null,v_parcelle.id,v_activation.id,'proprietaire',
    'Plantation propriétaire — '||coalesce(v_owner.nom_complet,'Propriétaire'),
    'Plantation propriétaire — '||coalesce(v_owner.nom_complet,'Propriétaire'),
    v_surface,v_surface,coalesce(v_surface::numeric * coalesce(v_parcelle.plantation_densite_plants,140),0)::integer,
    coalesce(v_parcelle.plantation_densite_plants,140),v_parcelle.region_id,v_parcelle.departement_id,v_parcelle.sous_prefecture_id,
    v_parcelle.village,v_parcelle.village,v_parcelle.village,v_parcelle.localisation_gps_lat,v_parcelle.localisation_gps_lng,
    coalesce(v_parcelle.plantation_date_activation,p_date_activation,current_date),coalesce(p_date_activation,current_date),
    'active','active',coalesce(v_parcelle.plantation_type_culture,'Palmier à huile'),
    'Planté-Partagé : contrepartie propriétaire de '||v_surface||' ha liée au lot '||coalesce(v_lot.reference,v_lot.id::text),v_user,v_user
  where not exists (select 1 from public.plantations p where p.activation_id=v_activation.id and p.role_attribution='proprietaire')
  returning id into v_owner_plantation;

  update public.lots_hectares
  set client_id=p_client_id,statut='attribue',date_attribution=coalesce(date_attribution,p_date_activation,current_date),updated_at=now()
  where id=v_lot.id;

  update public.parcelles
  set surface_attribuee_ha = (
    select coalesce(sum(l.surface_ha),0) from public.lots_hectares l
    where l.parcelle_id=v_parcelle.id and l.client_id is not null and l.statut='attribue'
  ), updated_by=v_user, updated_at=now()
  where id=v_parcelle.id;

  perform public.notification_emit_event(
    'lot_attribue',
    jsonb_build_object(
      'lot_id',v_lot.id,'client_id',p_client_id,'parcelle_id',v_parcelle.id,'proprietaire_id',v_owner.id,
      'surface',v_surface,'surface_client',v_surface,'surface_proprietaire',v_surface,
      'lot_reference',coalesce(v_lot.reference,v_lot.id::text),'village',coalesce(v_parcelle.village,''),
      'date_activation',coalesce(p_date_activation,current_date)
    )
  );

  return jsonb_build_object(
    'activation_id',v_activation.id,'lot_id',v_lot.id,'parcelle_id',v_parcelle.id,
    'client_plantation_id',v_client_plantation,'owner_plantation_id',v_owner_plantation,
    'surface_client_ha',v_surface,'surface_proprietaire_ha',v_surface
  );
end;
$function$;

revoke execute on function public.activate_shared_plantation_from_lot(uuid,uuid,date) from public,anon;
grant execute on function public.activate_shared_plantation_from_lot(uuid,uuid,date) to authenticated;

create or replace function public.notification_resolve_recipients_target(_criteres jsonb default '{}'::jsonb)
returns table(source_type text,source_id uuid,user_id uuid,nom_complet text,email text,telephone text,whatsapp text)
language sql stable security definer set search_path='public'
as $function$
select source_type,source_id,user_id,nom_complet,email,telephone,whatsapp
from public.notification_resolve_recipients(_criteres);
$function$;

create or replace function public.trg_lot_attribution_notification()
returns trigger
language plpgsql security definer set search_path='public'
as $function$
begin
  if new.client_id is not null and new.statut='attribue'
     and (tg_op='INSERT' or old.client_id is distinct from new.client_id or old.statut is distinct from new.statut) then
    perform public.notification_emit_event(
      'lot_attribue',
      jsonb_build_object(
        'lot_id',new.id,'client_id',new.client_id,'parcelle_id',new.parcelle_id,
        'surface',coalesce(new.surface_ha,1),'lot_reference',coalesce(new.reference,new.id::text),
        'date_activation',coalesce(new.date_attribution,current_date)
      )
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_lot_attribution_notification on public.lots_hectares;
create trigger trg_lot_attribution_notification
after insert or update of client_id,statut,date_attribution on public.lots_hectares
for each row execute function public.trg_lot_attribution_notification();

insert into public.notification_segments(code,nom,description,criteres,actif)
values
('proprietaires_fonciers','Propriétaires fonciers','Propriétaires de terres ayant confié une parcelle à AgriCapital.',jsonb_build_object('audience','proprietaires_fonciers'),true),
('beneficiaires_particuliers','Bénéficiaires particuliers','Bénéficiaires enregistrés à titre particulier, sans parcours de paiement.',jsonb_build_object('audience','beneficiaires_particuliers'),true)
on conflict (code) do update set nom=excluded.nom,description=excluded.description,criteres=excluded.criteres,actif=true,updated_at=now();

insert into public.notification_automations(code,nom,description,evenement,canal,sujet,contenu,criteres,conditions,actif,cooldown_minutes)
values
(
 'lot_attribue_proprietaire',
 'Activation d’un nouveau lot sur votre parcelle',
 'Informe le propriétaire qu’une nouvelle portion de sa parcelle vient d’être activée dans le cadre du Planté-Partagé. Aucun détail inutile sur le souscripteur n’est transmis.',
 'lot_attribue','auto','Activation d’une nouvelle portion de votre parcelle',
 'Bonjour {{prenom}}, une nouvelle portion de votre parcelle située à {{village}} vient d’être activée dans le cadre du Planté-Partagé. Superficie concernée : {{surface}} ha. La plantation sera suivie et développée progressivement par AgriCapital. Référence : {{lot_reference}}.',
 jsonb_build_object('audience','proprietaires_fonciers'),
 '{}'::jsonb,true,1440
),
(
 'plantation_activee_beneficiaire_particulier',
 'Activation de la plantation du bénéficiaire particulier',
 'Informe un bénéficiaire particulier de l’activation de son actif agricole, sans paiement ni échéance.',
 'plantation_activee','auto','Votre plantation AgriCapital est activée',
 'Bonjour {{prenom}}, votre plantation agricole de {{surface}} ha est maintenant activée dans le cadre de votre dossier AgriCapital. Elle sera suivie et développée progressivement par nos équipes. Référence : {{lot_reference}}.',
 jsonb_build_object('audience','beneficiaires_particuliers'),
 '{}'::jsonb,true,1440
)
on conflict (code) do update set nom=excluded.nom,description=excluded.description,evenement=excluded.evenement,canal=excluded.canal,sujet=excluded.sujet,contenu=excluded.contenu,criteres=excluded.criteres,conditions=excluded.conditions,actif=excluded.actif,cooldown_minutes=excluded.cooldown_minutes,updated_at=now();

-- Keep parcel statistics on the AgriCapital share: only client lots count as allocated.
create or replace function public.update_parcelle_attribution()
returns trigger
language plpgsql security definer set search_path='public'
as $function$
declare
  v_parcelle uuid;
  v_attribue numeric;
begin
  v_parcelle := coalesce(new.parcelle_id,old.parcelle_id);
  if v_parcelle is null then return coalesce(new,old); end if;

  select coalesce(sum(l.surface_ha),0) into v_attribue
  from public.lots_hectares l
  where l.parcelle_id=v_parcelle and l.client_id is not null and l.statut='attribue';

  update public.parcelles
  set surface_attribuee_ha=v_attribue, updated_at=now()
  where id=v_parcelle;
  return coalesce(new,old);
end;
$function$;

drop trigger if exists trigger_update_parcelle_attribution on public.plantations;
drop trigger if exists trg_plantations_update_parcelle_attribution on public.plantations;

create trigger trg_lots_update_parcelle_attribution
after insert or update or delete on public.lots_hectares
for each row execute function public.update_parcelle_attribution();
