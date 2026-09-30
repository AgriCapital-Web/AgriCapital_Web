-- Commission d'acquisition déclenchée par la validation du paiement initial.
-- Règle métier canonique : un paiement initial validé génère immédiatement
-- une commission d'acquisition validée, indépendamment de l'activation
-- ou de la plantation. Le bénéficiaire est le créateur du dossier client.

create or replace function public.compute_commission_for_paiement(p_paiement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  p record;
  c record;
  v_profile_id uuid;
  v_montant numeric := 0;
  v_base numeric := 0;
  v_taux numeric := 0;
  v_formule text;
  v_commission_id uuid;
begin
  select *
  into p
  from public.paiements
  where id = p_paiement_id;

  if not found or lower(coalesce(p.statut,'')) <> 'valide' then
    return;
  end if;

  if not (
    coalesce(p.est_paiement_initial,false)
    or coalesce(p.est_depot_initial,false)
    or upper(coalesce(p.type_paiement,'')) in ('PI','DEPOT_INITIAL')
  ) then
    return;
  end if;

  select
    c.id,
    c.created_by,
    c.total_hectares,
    c.formule_code,
    c.montant_total_contrat
  into c
  from public.clients c
  where c.id = p.client_id;

  if not found or c.created_by is null then
    return;
  end if;

  select pr.id
  into v_profile_id
  from public.profiles pr
  where pr.user_id = c.created_by
  limit 1;

  if v_profile_id is null then
    return;
  end if;

  -- Une seule commission d'acquisition par paiement initial validé.
  select cm.id
  into v_commission_id
  from public.commissions cm
  where cm.paiement_id = p.id
    and cm.type_commission = 'acquisition'
  limit 1;

  if v_commission_id is not null then
    update public.commissions
    set profile_id = coalesce(profile_id,v_profile_id),
        client_id = c.id,
        montant_base = coalesce(montant_base,v_base),
        montant_commission = greatest(coalesce(montant_commission,0),v_montant),
        statut = 'validee',
        valide_par = coalesce(valide_par,p.valide_par,auth.uid()),
        date_validation = coalesce(date_validation,p.date_validation,now()),
        date_calcul = coalesce(date_calcul,now())
    where id = v_commission_id;
    return;
  end if;

  v_base := coalesce(p.montant_paye,p.montant,0) + greatest(
    0,
    coalesce(c.montant_total_contrat,0) - coalesce(p.montant_paye,p.montant,0)
  );

  v_formule := upper(coalesce(c.formule_code,''));

  -- La grille reste la source des montants de commission.
  -- Les variantes + suivent la grille de leur famille.
  if v_formule = 'PALMTERROIR_ESSENTIELLE' then
    select gr.montant
    into v_montant
    from public.grille_remuneration gr
    where gr.role_cible='commercial'
      and gr.type_remuneration='acquisition'
      and gr.actif
      and lower(coalesce(gr.description,'')) like '%palmterroir%'
      and lower(coalesce(gr.description,'')) like '%essentielle%'
    order by gr.updated_at desc
    limit 1;
  elsif v_formule = 'PALMTERROIR_FLEXIBLE' then
    select gr.montant
    into v_montant
    from public.grille_remuneration gr
    where gr.role_cible='commercial'
      and gr.type_remuneration='acquisition'
      and gr.actif
      and lower(coalesce(gr.description,'')) like '%palmterroir%'
      and lower(coalesce(gr.description,'')) like '%flexible%'
    order by gr.updated_at desc
    limit 1;
  else
    select gr.montant
    into v_montant
    from public.grille_remuneration gr
    where gr.role_cible='commercial'
      and gr.type_remuneration='acquisition'
      and gr.actif
      and (
        lower(coalesce(gr.description,'')) like '%palminvest%'
        or lower(coalesce(gr.description,'')) like '%terrapalm%'
      )
    order by gr.updated_at desc
    limit 1;
  end if;

  v_montant := coalesce(v_montant,0);

  if v_montant <= 0 then
    return;
  end if;

  insert into public.commissions(
    profile_id,
    plantation_id,
    type_commission,
    montant_base,
    taux_commission,
    montant_commission,
    periode,
    statut,
    valide_par,
    date_validation,
    date_calcul,
    paiement_id,
    client_id,
    taux_applique,
    annee_contrat
  )
  values(
    v_profile_id,
    p.plantation_id,
    'acquisition',
    v_base,
    v_taux,
    v_montant,
    coalesce(p.date_paiement::date,current_date),
    'validee',
    coalesce(p.valide_par,auth.uid()),
    coalesce(p.date_validation,now()),
    now(),
    p.id,
    c.id,
    v_taux,
    1
  );
end;
$function$;

-- Recalcule immédiatement les commissions historiques des paiements initiaux
-- déjà validés mais sans commission, et fait passer les commissions existantes
-- de "calculée" à "validée".
do $$
declare
  r record;
begin
  for r in
    select p.id
    from public.paiements p
    where lower(coalesce(p.statut,''))='valide'
      and (
        coalesce(p.est_paiement_initial,false)
        or coalesce(p.est_depot_initial,false)
        or upper(coalesce(p.type_paiement,'')) in ('PI','DEPOT_INITIAL')
      )
  loop
    perform public.compute_commission_for_paiement(r.id);
  end loop;
end $$;

-- Une commission d'acquisition déjà générée à partir d'un paiement initial
-- validé est considérée comme immédiatement validée.
update public.commissions cm
set statut='validee',
    date_validation=coalesce(cm.date_validation,p.date_validation,now()),
    valide_par=coalesce(cm.valide_par,p.valide_par)
from public.paiements p
where cm.paiement_id=p.id
  and cm.type_commission='acquisition'
  and p.statut='valide'
  and (
    coalesce(p.est_paiement_initial,false)
    or coalesce(p.est_depot_initial,false)
    or upper(coalesce(p.type_paiement,'')) in ('PI','DEPOT_INITIAL')
  );

-- Le portefeuille reflète immédiatement les commissions acquises/validées.
select public.recalculer_portefeuilles_commissions();
