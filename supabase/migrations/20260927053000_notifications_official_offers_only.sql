-- 2026-09-27 : notifications : aucune audience AgriPlan, ciblage des 6 formules.
create or replace function public.notification_resolve_recipients(_criteres jsonb default '{}'::jsonb)
returns table (source_type text, source_id uuid, user_id uuid, nom_complet text, email text, telephone text, whatsapp text, role_code text, offre_id uuid, offre_code text, offre_nom text)
language sql stable security definer set search_path=public as $$
with contacts(source_type,source_id,user_id,nom_complet,email,telephone,whatsapp,role_code,offre_id,offre_code,offre_nom) as (
  select 'equipe',p.id,p.user_id,p.nom_complet,p.email,p.telephone,p.whatsapp,ur.role,null::uuid,null::text,null::text
  from public.profiles p left join lateral (select r.role from public.user_roles r where r.user_id=p.user_id order by r.created_at limit 1) ur on true
  where coalesce(p.actif,true) and public.is_staff(p.user_id)
  union all
  select 'client',s.id,s.user_id,coalesce(nullif(s.nom_complet,''),concat_ws(' ',s.prenoms,s.nom_famille)),s.email,s.telephone,s.whatsapp,null::text,s.offre_id,o.code,o.nom
  from public.souscripteurs s left join public.offres o on o.id=s.offre_id where coalesce(s.statut,'actif') not in ('archive','supprime')
  union all
  select 'prospect',l.id,null::uuid,concat_ws(' ',l.prenoms,l.nom),l.email,l.telephone,l.whatsapp,null::text,null::uuid,null::text,null::text
  from public.leads l where coalesce(l.statut,'nouveau') not in ('archive','supprime')
)
select c.* from contacts c
where (
  coalesce(_criteres->>'audience','tous') in ('tous','all')
  or (coalesce(_criteres->>'audience','') in ('clients','client') and c.source_type='client')
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
$$;

insert into public.notification_segments(code,nom,description,criteres,actif)
values
('palmterroir_essentielle','Clients PalmTerroir — Essentielle','Clients ayant choisi PalmTerroir Essentielle','{"audience":"palmterroir_essentielle"}',true),
('palmterroir_flexible','Clients PalmTerroir — Flexible','Clients ayant choisi PalmTerroir Flexible','{"audience":"palmterroir_flexible"}',true)
on conflict(code) do update set nom=excluded.nom,description=excluded.description,criteres=excluded.criteres,actif=true,updated_at=now();

update public.notification_segments set actif=false,updated_at=now() where code in ('agriplan','palmterroir_plus');
