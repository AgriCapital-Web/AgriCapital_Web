-- Promotions : conserver l'échéancier propre à chaque offre.
-- PI : réduction du Paiement Initial uniquement.
-- Prix global : réduction du total puis réduction proportionnelle de chaque
-- tranche, sans remplacer An 1 / An 2 / An 3 par une mensualité unique.

update public.offres
set
  montant_pi_par_ha = case code
    when 'palm-invest' then 90700
    when 'palm-invest-plus' then 90700
    when 'terra-palm' then 84700
    when 'terra-palm-plus' then 84700
    when 'palm-terroir-essentielle' then 230000
    when 'palm-terroir-flexible' then 65000
    else montant_pi_par_ha
  end,
  montant_total_par_ha = case code
    when 'palm-invest' then 2465200
    when 'palm-invest-plus' then 2465200
    when 'terra-palm' then 1620200
    when 'terra-palm-plus' then 1620200
    when 'palm-terroir-essentielle' then 536000
    when 'palm-terroir-flexible' then 518600
    else montant_total_par_ha
  end,
  montant_cash_par_ha = case code
    when 'palm-invest' then 2266000
    when 'palm-invest-plus' then 2266000
    when 'terra-palm' then 1466200
    when 'terra-palm-plus' then 1466200
    when 'palm-terroir-essentielle' then 356000
    when 'palm-terroir-flexible' then 518600
    else montant_cash_par_ha
  end,
  contribution_mensuelle_par_ha = case code
    when 'palm-invest' then 83800
    when 'palm-invest-plus' then 83800
    when 'terra-palm' then 49800
    when 'terra-palm-plus' then 49800
    when 'palm-terroir-essentielle' then 3500
    when 'palm-terroir-flexible' then 12600
    else contribution_mensuelle_par_ha
  end,
  duree_paiement_mois = case
    when code in ('palm-invest','palm-invest-plus','terra-palm','terra-palm-plus') then 40
    when code in ('palm-terroir-essentielle','palm-terroir-flexible') then 36
    else duree_paiement_mois
  end
where code in (
  'palm-invest','palm-invest-plus','terra-palm','terra-palm-plus',
  'palm-terroir-essentielle','palm-terroir-flexible'
);

create or replace function public.offre_prix_effectif()
returns table(
  offre_id uuid, code text, nom text,
  montant_total_base numeric, depot_initial_base numeric, mensualite_base numeric,
  montant_total_effectif numeric, depot_initial_effectif numeric, mensualite_effective numeric,
  promotion_id uuid, promotion_nom text, promotion_cible text, reduction_pct numeric, reduction_montant numeric
)
language sql stable security definer
set search_path = public
as $function$
with promo_candidates as (
  select o.id oid,p.id pid,p.nom pnom,
    case when lower(coalesce(p.cible,p.type_promotion,'paiement_initial'))
      in ('cout_global','coût_global','total_contrat','cg','special')
      then 'cout_global' else 'paiement_initial' end cible,
    coalesce(p.pourcentage_reduction,0) pct,
    coalesce(p.montant_fixe_reduction,0) fixe,p.created_at,
    row_number() over(
      partition by o.id
      order by coalesce(p.pourcentage_reduction,0) desc,
               coalesce(p.montant_fixe_reduction,0) desc,
               p.created_at desc
    ) rn
  from public.offres o
  join public.promotions p on p.active=true
    and (p.date_debut is null or p.date_debut<=now())
    and (p.date_fin is null or p.date_fin>=now())
    and (p.applique_toutes_offres=true
      or exists(select 1 from jsonb_array_elements_text(coalesce(p.offre_ids,'[]'::jsonb)) x where x=o.id::text))
  where o.actif=true
),
best as (select * from promo_candidates where rn=1),
base as (
  select o.*,coalesce(o.montant_total_par_ha,0) total_base,
    coalesce(o.montant_pi_par_ha,0) pi_base,
    coalesce(o.contribution_mensuelle_par_ha,0) monthly_base
  from public.offres o where o.actif=true
),
calc as (
  select b.*,p.pid,p.pnom,p.cible,p.pct,p.fixe,
    case when p.pid is null then b.total_base
      when p.cible='cout_global' then greatest(b.total_base*(1-p.pct/100.0)-p.fixe,0)
      else greatest(b.total_base-(b.pi_base-greatest(b.pi_base*(1-p.pct/100.0)-p.fixe,0)),0)
    end total_eff,
    case when p.pid is null then b.pi_base
      when p.cible='paiement_initial' then greatest(b.pi_base*(1-p.pct/100.0)-p.fixe,0)
      else least(b.pi_base,greatest(b.total_base*(1-p.pct/100.0)-p.fixe,0))
    end pi_eff
  from base b left join best p on p.oid=b.id
),
ratios as (
  select c.*,
    case when greatest(total_base-pi_base,0)>0
      then greatest(total_eff-pi_eff,0)/greatest(total_base-pi_base,0)
      else 1 end tranche_ratio
  from calc c
)
select id,code,nom,total_base,pi_base,monthly_base,total_eff,least(pi_eff,total_eff),
  case when pid is null then monthly_base
       when cible='paiement_initial' then monthly_base
       else round(monthly_base*tranche_ratio,2) end,
  pid,pnom,cible,coalesce(pct,0),greatest(total_base-total_eff,0)
from ratios;
$function$;
