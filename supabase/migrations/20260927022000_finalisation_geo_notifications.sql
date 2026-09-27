-- Finalisation communication + cascade géographique AgriCapital
-- 2026-09-27

create or replace function public.cascade_geo_status()
returns trigger language plpgsql security definer set search_path=public as $$
declare new_status boolean; old_status boolean;
begin
  if tg_table_name='districts' then
    new_status := (to_jsonb(new)->>'est_actif')::boolean;
    old_status := (to_jsonb(old)->>'est_actif')::boolean;
    if new_status is distinct from old_status then
      update public.regions set est_active=new_status where district_id=(to_jsonb(new)->>'id')::uuid;
      update public.departements d set est_actif=new_status from public.regions r where d.region_id=r.id and r.district_id=(to_jsonb(new)->>'id')::uuid;
      update public.sous_prefectures sp set est_active=new_status from public.departements d where sp.departement_id=d.id and d.region_id in (select id from public.regions where district_id=(to_jsonb(new)->>'id')::uuid);
      update public.villages v set est_actif=new_status from public.sous_prefectures sp join public.departements d on d.id=sp.departement_id join public.regions r on r.id=d.region_id where v.sous_prefecture_id=sp.id and r.district_id=(to_jsonb(new)->>'id')::uuid;
    end if;
  elsif tg_table_name='regions' then
    new_status := (to_jsonb(new)->>'est_active')::boolean; old_status := (to_jsonb(old)->>'est_active')::boolean;
    if new_status is distinct from old_status then
      update public.departements set est_actif=new_status where region_id=(to_jsonb(new)->>'id')::uuid;
      update public.sous_prefectures sp set est_active=new_status from public.departements d where sp.departement_id=d.id and d.region_id=(to_jsonb(new)->>'id')::uuid;
      update public.villages v set est_actif=new_status from public.sous_prefectures sp join public.departements d on d.id=sp.departement_id where v.sous_prefecture_id=sp.id and d.region_id=(to_jsonb(new)->>'id')::uuid;
    end if;
  elsif tg_table_name='departements' then
    new_status := (to_jsonb(new)->>'est_actif')::boolean; old_status := (to_jsonb(old)->>'est_actif')::boolean;
    if new_status is distinct from old_status then
      update public.sous_prefectures set est_active=new_status where departement_id=(to_jsonb(new)->>'id')::uuid;
      update public.villages v set est_actif=new_status from public.sous_prefectures sp where v.sous_prefecture_id=sp.id and sp.departement_id=(to_jsonb(new)->>'id')::uuid;
    end if;
  elsif tg_table_name='sous_prefectures' then
    new_status := (to_jsonb(new)->>'est_active')::boolean; old_status := (to_jsonb(old)->>'est_active')::boolean;
    if new_status is distinct from old_status then update public.villages set est_actif=new_status where sous_prefecture_id=(to_jsonb(new)->>'id')::uuid; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_cascade_district_status on public.districts;
create trigger trg_cascade_district_status after update of est_actif on public.districts for each row execute function public.cascade_geo_status();
drop trigger if exists trg_cascade_region_status on public.regions;
create trigger trg_cascade_region_status after update of est_active on public.regions for each row execute function public.cascade_geo_status();
drop trigger if exists trg_cascade_departement_status on public.departements;
create trigger trg_cascade_departement_status after update of est_actif on public.departements for each row execute function public.cascade_geo_status();
drop trigger if exists trg_cascade_sp_status on public.sous_prefectures;
create trigger trg_cascade_sp_status after update of est_active on public.sous_prefectures for each row execute function public.cascade_geo_status();

alter table public.notification_campaigns drop constraint if exists notification_campaigns_canal_check;
alter table public.notification_campaigns add constraint notification_campaigns_canal_check check (canal in ('app','email','sms','whatsapp','auto','email_sms'));
alter table public.notification_automations drop constraint if exists notification_automations_canal_check;
alter table public.notification_automations add constraint notification_automations_canal_check check (canal in ('app','email','sms','whatsapp','auto','email_sms'));
alter table public.notification_deliveries drop constraint if exists notification_deliveries_canal_check;
alter table public.notification_deliveries add constraint notification_deliveries_canal_check check (canal in ('app','email','sms','whatsapp'));

drop function if exists public.notification_resolve_recipients(jsonb);
create or replace function public.notification_resolve_recipients(_criteres jsonb default '{}'::jsonb)
returns table (source_type text, source_id uuid, user_id uuid, nom_complet text, email text, telephone text, whatsapp text, role_code text, offre_id uuid, offre_code text, offre_nom text)
language sql stable security definer set search_path=public as $$
with contacts(source_type,source_id,user_id,nom_complet,email,telephone,whatsapp,role_code,offre_id,offre_code,offre_nom) as (
  select 'equipe',p.id,p.user_id,p.nom_complet,p.email,p.telephone,p.whatsapp,ur.role,null::uuid,null::text,null::text from public.profiles p
  left join lateral (select r.role from public.user_roles r where r.user_id=p.user_id order by r.created_at limit 1) ur on true
  where coalesce(p.actif,true) and public.is_staff(p.user_id)
  union all
  select 'client',s.id,s.user_id,coalesce(nullif(s.nom_complet,''),concat_ws(' ',s.prenoms,s.nom_famille)),s.email,s.telephone,s.whatsapp,null::text,s.offre_id,o.code,o.nom
  from public.souscripteurs s left join public.offres o on o.id=s.offre_id where coalesce(s.statut,'actif') not in ('archive','supprime')
  union all
  select 'client',a.id,a.user_id,a.nom_complet,a.email,a.telephone,a.whatsapp,null::text,null::uuid,'agriplan','AgriPlan'
  from public.agriplan_clients a where coalesce(a.statut,'actif') not in ('archive','supprime')
  union all
  select 'prospect',l.id,null::uuid,concat_ws(' ',l.prenoms,l.nom),l.email,l.telephone,l.whatsapp,null::text,null::uuid,null::text,null::text
  from public.leads l where coalesce(l.statut,'nouveau') not in ('archive','supprime')
  union all
  select 'prospect',l.id,null::uuid,l.nom_complet,null::text,l.telephone,l.whatsapp,null::text,null::uuid,'agriplan','AgriPlan'
  from public.agriplan_leads l where coalesce(l.statut,'nouveau') not in ('archive','supprime')
)
select c.* from contacts c where (
  coalesce(_criteres->>'audience','tous') in ('tous','all')
  or (coalesce(_criteres->>'audience','') in ('clients','client') and c.source_type='client')
  or (coalesce(_criteres->>'audience','') in ('prospects','prospect') and c.source_type='prospect')
  or (coalesce(_criteres->>'audience','') in ('equipe','equipe_interne','staff','team') and c.source_type='equipe')
  or (coalesce(_criteres->>'audience','')='agriplan' and c.offre_code='agriplan')
  or (coalesce(_criteres->>'audience','')='palminvest' and lower(coalesce(c.offre_code,'')) in ('palm-invest','palm-invest-plus'))
  or (coalesce(_criteres->>'audience','')='terrapalm' and lower(coalesce(c.offre_code,'')) in ('terra-palm','terra-palm-plus'))
  or (coalesce(_criteres->>'audience','')='palminvest_plus' and lower(coalesce(c.offre_code,''))='palm-invest-plus')
  or (coalesce(_criteres->>'audience','')='terrapalm_plus' and lower(coalesce(c.offre_code,''))='terra-palm-plus')
) and (nullif(_criteres->>'offer_code','') is null or lower(coalesce(c.offre_code,''))=lower(_criteres->>'offer_code'));
$$;
revoke all on function public.notification_resolve_recipients(jsonb) from public,anon,authenticated;
grant execute on function public.notification_resolve_recipients(jsonb) to service_role;

insert into public.notification_segments(code,nom,description,criteres) values
('palminvest_plus','Clients PalmInvest+','Clients ayant souscrit à PalmInvest+','{"audience":"palminvest_plus"}'),
('terrapalm_plus','Clients TerraPalm+','Clients ayant souscrit à TerraPalm+','{"audience":"terrapalm_plus"}')
on conflict(code) do update set nom=excluded.nom,description=excluded.description,criteres=excluded.criteres,updated_at=now();

create or replace function public.notification_emit_event(_event text,_context jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='notification_cron_secret' limit 1;
  if secret is null then return; end if;
  perform net.http_post(url:='https://rfzfsmpsuempafhkqhra.supabase.co/functions/v1/notification-dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','x-agricapital-automation-secret',secret),
    body:=jsonb_build_object('mode','event','event_code',_event,'context',_context),timeout_milliseconds:=5000);
exception when others then raise warning 'notification_emit_event failed: %',sqlerrm;
end $$;

create or replace function public.trg_paiement_notification() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if lower(coalesce(new.statut,'')) in ('valide','paye','paid','success','successful','completed') and
     (tg_op='INSERT' or lower(coalesce(old.statut,'')) is distinct from lower(coalesce(new.statut,''))) then
    perform public.notification_emit_event('paiement_recu',jsonb_build_object('paiement_id',new.id,'souscripteur_id',new.souscripteur_id,'agriplan_client_id',new.agriplan_client_id,'montant',coalesce(new.montant_paye,new.montant),'reference',new.reference,'date_paiement',new.date_paiement));
  end if;
  return new;
end $$;
drop trigger if exists trg_paiement_notification on public.paiements;
create trigger trg_paiement_notification after insert or update of statut on public.paiements for each row execute function public.trg_paiement_notification();

create or replace function public.trg_account_request_notification() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    perform public.notification_emit_event('nouvelle_demande_compte',jsonb_build_object('account_request_id',new.id,'nom',new.nom_complet,'email',new.email,'telephone',new.telephone));
  elsif new.statut is distinct from old.statut and lower(coalesce(new.statut,'')) in ('approuve','approuvee','approved','active','valide','validee') then
    perform public.notification_emit_event('compte_active',jsonb_build_object('account_request_id',new.id,'user_id',new.auth_user_id,'nom',new.nom_complet,'email',new.email,'telephone',new.telephone));
  end if;
  return new;
end $$;
drop trigger if exists trg_account_request_notification on public.account_requests;
create trigger trg_account_request_notification after insert or update of statut on public.account_requests for each row execute function public.trg_account_request_notification();

insert into public.notification_automations(code,nom,description,evenement,canal,sujet,contenu,criteres,conditions,actif,cooldown_minutes) values
('paiement_recu_client','Confirmation de paiement','Confirme automatiquement un paiement valide au client.','paiement_recu','auto','Paiement reçu - AgriCapital','Bonjour {{prenom}}, votre paiement de {{montant}} FCFA a bien été enregistré par AgriCapital. Référence : {{reference}}.','{"audience":"clients"}','{}',true,30),
('nouvelle_demande_compte_equipe','Nouvelle demande de compte','Informe automatiquement l’équipe d’une nouvelle demande.','nouvelle_demande_compte','auto','Nouvelle demande de compte AgriCapital','Une nouvelle demande de création de compte a été reçue : {{nom}} - {{email}} - {{telephone}}.','{"audience":"equipe"}','{}',true,5),
('compte_active_client','Compte activé','Informe automatiquement le demandeur que son compte est actif.','compte_active','auto','Votre compte AgriCapital est actif','Bonjour {{prenom}}, votre compte AgriCapital est maintenant actif. Vous pouvez vous connecter à votre espace.','{"audience":"clients"}','{}',true,5),
('paiement_echeance_client','Rappel échéance','Rappelle automatiquement les échéances proches.','paiement_echeance','auto','Rappel d’échéance AgriCapital','Bonjour {{prenom}}, votre prochaine échéance AgriCapital approche. Pensez à effectuer votre règlement à temps.','{"audience":"clients"}','{}',true,1440),
('paiement_retard_client','Retard de paiement','Informe automatiquement les clients en retard.','paiement_retard','auto','Échéance AgriCapital en retard','Bonjour {{prenom}}, une échéance AgriCapital semble en retard. Merci de régulariser votre situation ou de contacter le service client.','{"audience":"clients"}','{}',true,1440)
on conflict(code) do update set nom=excluded.nom,description=excluded.description,evenement=excluded.evenement,canal=excluded.canal,sujet=excluded.sujet,contenu=excluded.contenu,criteres=excluded.criteres,conditions=excluded.conditions,actif=excluded.actif,cooldown_minutes=excluded.cooldown_minutes,updated_at=now();
