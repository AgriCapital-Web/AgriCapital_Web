-- Finalisation du moteur de prix et des echeanciers.
-- Cette migration reprend la logique active en production afin que la base,
-- les formulaires et les paiements utilisent la meme source de verite.

create or replace function public.offre_prix_effectif()
returns table(offre_id uuid,code text,nom text,montant_total_base numeric,depot_initial_base numeric,mensualite_base numeric,montant_total_effectif numeric,depot_initial_effectif numeric,mensualite_effective numeric,promotion_id uuid,promotion_nom text,promotion_cible text,reduction_pct numeric,reduction_montant numeric)
language sql stable security definer set search_path=public
as $$
with candidates as (
 select o.id oid,p.id pid,p.nom pnom,
 case when lower(coalesce(p.cible,p.type_promotion,'paiement_initial')) in ('cout_global','coût_global','total_contrat','cg','special') then 'cout_global' else 'paiement_initial' end cible,
 coalesce(p.pourcentage_reduction,0) pct,coalesce(p.montant_fixe_reduction,0) fixe,p.created_at,
 row_number() over(partition by o.id order by coalesce(p.pourcentage_reduction,0) desc,coalesce(p.montant_fixe_reduction,0) desc,p.created_at desc) rn
 from public.offres o join public.promotions p on p.active=true and (p.date_debut is null or p.date_debut<=now()) and (p.date_fin is null or p.date_fin>=now())
 and (p.applique_toutes_offres=true or exists(select 1 from jsonb_array_elements_text(coalesce(p.offre_ids,'[]'::jsonb)) x where x=o.id::text or x=o.code))
 where o.actif=true
),best as(select * from candidates where rn=1),
base as(select o.id,o.code,o.nom,coalesce(o.montant_total_par_ha,0) total_base,coalesce(o.montant_pi_par_ha,0) pi_base,coalesce(o.contribution_mensuelle_par_ha,0) monthly_base from public.offres o where o.actif=true),
calc as(select b.*,p.pid,p.pnom,p.cible,p.pct,p.fixe,
case when p.pid is null then b.total_base when p.cible='cout_global' then greatest(b.total_base*(1-p.pct/100.0)-p.fixe,0) else greatest(b.total_base-(b.pi_base-greatest(b.pi_base*(1-p.pct/100.0)-p.fixe,0)),0) end total_eff,
case when p.pid is null then b.pi_base when p.cible='paiement_initial' then greatest(b.pi_base*(1-p.pct/100.0)-p.fixe,0) else least(b.pi_base,greatest(b.total_base*(1-p.pct/100.0)-p.fixe,0)) end pi_eff from base b left join best p on p.oid=b.id),
monthly as(select c.*,coalesce((select coalesce((t->>'mensualite_par_ha')::numeric,0) from jsonb_array_elements((select o.tranches_paiement from public.offres o where o.id=c.id)) t where coalesce(t->>'type','') not in ('paiement_initial','apres_trouaison','paiement_apres_trouaison') and coalesce((t->>'mensualite_par_ha')::numeric,0)>0 order by coalesce((t->>'mois_debut')::int,999999) limit 1),c.monthly_base) first_monthly from calc c)
select id,code,nom,total_base,pi_base,monthly_base,total_eff,least(pi_eff,total_eff),first_monthly,pid,pnom,cible,coalesce(pct,0),greatest(total_base-total_eff,0) from monthly;
$$;

create or replace view public.v_prix_effectif_offres as
select offre_id,code,nom,depot_initial_base as pi_base,montant_total_base as total_base,depot_initial_effectif as pi_effectif,montant_total_effectif as total_effectif
from public.offre_prix_effectif();

create or replace function public.offre_echeancier_effectif(_offre_id uuid)
returns table(annee integer,mois_debut integer,mois_fin integer,mois integer,mensualite_par_ha numeric,total_periode_par_ha numeric)
language sql stable security definer set search_path=public
as $$
with o as(select * from public.offres where id=_offre_id and actif=true),
p as(select p.id,case when lower(coalesce(p.cible,p.type_promotion,'paiement_initial')) in ('cout_global','coût_global','total_contrat','cg','special') then 'cout_global' else 'paiement_initial' end cible,coalesce(p.pourcentage_reduction,0) pct,coalesce(p.montant_fixe_reduction,0) fixe from public.promotions p,o where p.active=true and (p.date_debut is null or p.date_debut<=now()) and (p.date_fin is null or p.date_fin>=now()) and (p.applique_toutes_offres=true or p.offre_ids ? o.id::text or p.offre_ids ? o.code) order by coalesce(p.pourcentage_reduction,0) desc,coalesce(p.montant_fixe_reduction,0) desc,p.created_at desc limit 1),
c as(select o.*,p.cible,p.pct,p.fixe,case when p.id is null then coalesce(o.montant_total_par_ha,0) when p.cible='cout_global' then greatest(coalesce(o.montant_total_par_ha,0)*(1-p.pct/100.0)-p.fixe,0) else greatest(coalesce(o.montant_total_par_ha,0)-(coalesce(o.montant_pi_par_ha,0)-greatest(coalesce(o.montant_pi_par_ha,0)*(1-p.pct/100.0)-p.fixe,0)),0) end total_eff,case when p.id is null then coalesce(o.montant_pi_par_ha,0) when p.cible='paiement_initial' then greatest(coalesce(o.montant_pi_par_ha,0)*(1-p.pct/100.0)-p.fixe,0) else least(coalesce(o.montant_pi_par_ha,0),greatest(coalesce(o.montant_total_par_ha,0)*(1-p.pct/100.0)-p.fixe,0)) end pi_eff from o left join p on true),
r as(select c.*,case when greatest(coalesce(montant_total_par_ha,0)-coalesce(montant_pi_par_ha,0),0)>0 then greatest(total_eff-least(pi_eff,total_eff),0)/greatest(coalesce(montant_total_par_ha,0)-coalesce(montant_pi_par_ha,0),0) else 1 end ratio from c)
select coalesce((t->>'annee')::int,1),coalesce((t->>'mois_debut')::int,1),coalesce((t->>'mois_fin')::int,(t->>'mois')::int),coalesce((t->>'mois')::int,0),
case when r.cible='cout_global' then coalesce((t->>'mensualite_par_ha')::numeric,0)*r.ratio else coalesce((t->>'mensualite_par_ha')::numeric,0) end,
case when r.cible='cout_global' then coalesce((t->>'mensualite_par_ha')::numeric,0)*r.ratio*coalesce((t->>'mois')::int,0) else coalesce((t->>'mensualite_par_ha')::numeric,0)*coalesce((t->>'mois')::int,0) end
from r cross join lateral jsonb_array_elements(r.tranches_paiement) t
where coalesce(t->>'type','') not in ('paiement_initial','apres_trouaison','paiement_apres_trouaison') and coalesce((t->>'mensualite_par_ha')::numeric,0)>0 and coalesce((t->>'mois')::int,0)>0
order by coalesce((t->>'mois_debut')::int,999999);
$$;

create or replace function public.ensure_client_repayment_schedule(_client_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare c record; e record; idx int:=0; start_date date; i int;
begin
 select * into c from public.clients where id=_client_id;
 if c is null or c.offre_id is null or coalesce(c.mode_paiement,'echeancier')='comptant' then return; end if;
 if exists(select 1 from public.paiements where client_id=_client_id and type_paiement='REDEVANCE') then return; end if;
 start_date:=coalesce(c.contrat_debut_at::date,current_date);
 for e in select * from public.offre_echeancier_effectif(c.offre_id) loop
  for i in 1..e.mois loop
   idx:=idx+1;
   insert into public.paiements(client_id,type_paiement,statut,montant,montant_theorique,numero_echeance,date_echeance,annee,phase,est_depot_initial,est_paiement_initial)
   values(_client_id,'REDEVANCE','en_attente',e.mensualite_par_ha*coalesce(c.total_hectares,0),e.mensualite_par_ha*coalesce(c.total_hectares,0),idx,(start_date+(idx||' months')::interval)::date,e.annee,'annee_'||e.annee,false,false);
  end loop;
 end loop;
end $$;

create or replace function public.get_client_effective_pi(_client_id uuid)
returns numeric language sql stable security definer set search_path=public
as $$
select coalesce(p.depot_initial_effectif,0) from public.offre_prix_effectif() p join public.clients c on c.offre_id=p.offre_id
where c.id=_client_id and (public.is_staff(auth.uid()) or c.user_id=auth.uid()) limit 1;
$$;

create or replace function public.create_depot_initial(_client_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare _existing uuid; _montant numeric; _new_id uuid;
begin
 if auth.uid() is not null and not public.is_staff(auth.uid()) then raise exception 'Accès refusé'; end if;
 select id into _existing from public.paiements where client_id=_client_id and type_paiement='depot_initial' limit 1;
 if _existing is not null then return _existing; end if;
 _montant:=public.get_client_effective_pi(_client_id);
 insert into public.paiements(client_id,type_paiement,montant,statut,est_depot_initial,est_paiement_initial,montant_theorique)
 values(_client_id,'depot_initial',coalesce(_montant,0),'en_attente',true,true,coalesce(_montant,0)) returning id into _new_id;
 return _new_id;
end $$;
