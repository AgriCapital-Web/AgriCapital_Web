-- Préserve la commission mensuelle de recouvrement tout en appliquant
-- la nouvelle règle : le paiement initial validé génère immédiatement
-- la commission d'acquisition validée, indépendamment de la plantation.

create or replace function public.compute_commission_for_paiement(p_paiement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  p record;
  v_client record;
  v_profile_id uuid;
  v_montant numeric := 0;
  v_base numeric := 0;
  v_taux numeric := 0;
  v_formule text;
  v_type text;
  v_commission_id uuid;
begin
  select *
  into p
  from public.paiements
  where id = p_paiement_id;

  if not found or lower(coalesce(p.statut,'')) <> 'valide' then
    return;
  end if;

  select
    c.id,
    c.created_by,
    c.total_hectares,
    c.formule_code,
    c.montant_total_contrat
  into v_client
  from public.clients c
  where c.id = p.client_id;

  if not found or v_client.created_by is null then
    return;
  end if;

  select pr.id
  into v_profile_id
  from public.profiles pr
  where pr.user_id = v_client.created_by
  limit 1;

  if v_profile_id is null then
    return;
  end if;

  if (
    coalesce(p.est_paiement_initial,false)
    or coalesce(p.est_depot_initial,false)
    or upper(coalesce(p.type_paiement,'')) in ('PI','DEPOT_INITIAL')
  ) then
    -- Une seule commission d'acquisition par paiement initial validé.
    select cm.id
    into v_commission_id
    from public.commissions cm
    where cm.paiement_id = p.id
      and cm.type_commission = 'acquisition'
    limit 1;

    v_base := coalesce(v_client.montant_total_contrat,p.montant_theorique,p.montant_paye,p.montant,0);
    v_formule := upper(coalesce(v_client.formule_code,''));

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

    if v_commission_id is not null then
      update public.commissions
      set profile_id = coalesce(profile_id,v_profile_id),
          client_id = v_client.id,
          montant_base = coalesce(montant_base,v_base),
          montant_commission = greatest(coalesce(montant_commission,0),v_montant),
          statut = 'validee',
          valide_par = coalesce(valide_par,p.valide_par,auth.uid()),
          date_validation = coalesce(date_validation,p.date_validation,now()),
          date_calcul = coalesce(date_calcul,now())
      where id = v_commission_id;
    elsif v_montant > 0 then
      insert into public.commissions(
        profile_id,plantation_id,type_commission,montant_base,taux_commission,
        montant_commission,periode,statut,valide_par,date_validation,date_calcul,
        paiement_id,client_id,taux_applique,annee_contrat
      )
      values(
        v_profile_id,p.plantation_id,'acquisition',v_base,0,v_montant,
        coalesce(p.date_paiement::date,current_date),'validee',
        coalesce(p.valide_par,auth.uid()),coalesce(p.date_validation,now()),now(),
        p.id,v_client.id,0,1
      );
    end if;

    return;
  end if;

  -- Les paiements mensuels de REDEVANCE conservent leur commission
  -- de recouvrement à 2,5 %. Celle-ci reste "calculée" jusqu'au cycle
  -- normal de validation du versement de quinzaine.
  if upper(coalesce(p.type_paiement,'')) <> 'REDEVANCE' then
    return;
  end if;

  select cm.id
  into v_commission_id
  from public.commissions cm
  where cm.paiement_id = p.id
    and cm.type_commission = 'recouvrement_mensuel'
  limit 1;

  if v_commission_id is not null then
    return;
  end if;

  select coalesce(gr.taux_pourcentage,0)
  into v_taux
  from public.grille_remuneration gr
  where gr.role_cible='commercial'
    and gr.type_remuneration='recouvrement_mensuel'
    and gr.actif
  order by gr.updated_at desc
  limit 1;

  v_base := coalesce(p.montant_paye,p.montant,0);
  v_montant := round(v_base * coalesce(v_taux,0) / 100.0,2);

  if v_montant <= 0 then
    return;
  end if;

  insert into public.commissions(
    profile_id,plantation_id,type_commission,montant_base,taux_commission,
    montant_commission,periode,statut,date_calcul,paiement_id,client_id,
    taux_applique,annee_contrat
  )
  values(
    v_profile_id,p.plantation_id,'recouvrement_mensuel',v_base,v_taux,
    v_montant,coalesce(p.date_paiement::date,current_date),'calculee',now(),
    p.id,v_client.id,v_taux,1
  );
end;
$function$;

-- Rejoue les paiements mensuels déjà validés pour créer les commissions
-- de recouvrement manquantes sans toucher aux commissions d'acquisition.
do $$
declare
  r record;
begin
  for r in
    select p.id
    from public.paiements p
    where lower(coalesce(p.statut,''))='valide'
      and upper(coalesce(p.type_paiement,''))='REDEVANCE'
  loop
    perform public.compute_commission_for_paiement(r.id);
  end loop;
end $$;
