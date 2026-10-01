create or replace function public.finalize_portal_payment(
  _paiement_id uuid,
  _transaction_id text default null,
  _provider_amount numeric default null,
  _metadata jsonb default '{}'::jsonb,
  _validated_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_payment public.paiements%rowtype;
  v_plantation public.plantations%rowtype;
  v_client public.clients%rowtype;
  v_paid numeric;
  v_was_valid boolean;
  v_days integer := 0;
  v_new_days integer;
  v_activation_date date := _validated_at::date;
  v_expected_provider_amount numeric;
begin
  select * into v_payment from public.paiements where id=_paiement_id for update;
  if not found then raise exception 'Paiement introuvable'; end if;
  select * into v_client from public.clients where id=v_payment.client_id for update;
  if not found then raise exception 'Client du paiement introuvable'; end if;

  v_expected_provider_amount := coalesce(
    nullif(v_payment.metadata->>'kkiapay_widget_amount','')::numeric,
    v_payment.montant
  );
  if _provider_amount is not null and abs(_provider_amount-coalesce(v_expected_provider_amount,0))>1 then
    raise exception 'Montant fournisseur incohérent';
  end if;
  if _transaction_id is not null and exists(
    select 1 from public.paiements
    where kkiapay_transaction_id=_transaction_id and id<>v_payment.id
  ) then raise exception 'Transaction déjà rattachée à un autre paiement'; end if;

  v_was_valid := v_payment.statut='valide';
  v_paid := case
    when coalesce(v_payment.est_depot_initial,false) and coalesce(v_payment.montant,0)=0 then 0
    else coalesce(v_payment.montant_paye,v_payment.montant,0)
  end;

  if not v_was_valid then
    update public.paiements set statut='valide',montant_paye=v_paid,
      date_paiement=coalesce(date_paiement,_validated_at),
      date_validation=coalesce(date_validation,_validated_at),
      kkiapay_transaction_id=coalesce(_transaction_id,kkiapay_transaction_id),
      metadata=coalesce(metadata,'{}'::jsonb)||coalesce(_metadata,'{}'::jsonb)
        || jsonb_build_object('provider_amount',_provider_amount,'client_amount',v_payment.montant),
      updated_at=now() where id=v_payment.id;
  else
    update public.paiements set kkiapay_transaction_id=coalesce(_transaction_id,kkiapay_transaction_id),
      metadata=coalesce(metadata,'{}'::jsonb)||coalesce(_metadata,'{}'::jsonb)
        || jsonb_build_object('provider_amount',_provider_amount,'client_amount',v_payment.montant),
      updated_at=now() where id=v_payment.id;
  end if;

  if coalesce(v_payment.est_depot_initial,false) and v_payment.plantation_id is not null then
    select * into v_plantation from public.plantations
      where id=v_payment.plantation_id and client_id=v_payment.client_id for update;
    if not found then raise exception 'Plantation du paiement introuvable'; end if;

    update public.plantations set superficie_activee=superficie_ha,
      montant_pi_paye=greatest(coalesce(montant_pi_paye,0),v_paid),
      date_activation=coalesce(date_activation,v_activation_date),
      statut='actif',statut_global='actif',updated_at=now()
      where id=v_plantation.id;

    if v_plantation.parcelle_id is not null then
      update public.parcelles set plantation_partagee_activee=true,
        plantation_date_activation=coalesce(plantation_date_activation,v_activation_date),
        statut=case when coalesce(statut,'') in ('','en_attente','reservee','bloquee') then 'active' else statut end,
        updated_at=now() where id=v_plantation.parcelle_id;
    end if;

    update public.clients set compte_actif=true,
      statut=case when coalesce(statut,'') in ('','en_attente_pi','en_attente') then 'actif' else statut end,
      statut_global='actif',
      paiement_initial_paye_at=coalesce(paiement_initial_paye_at,_validated_at),
      pi_paye_at=coalesce(pi_paye_at,_validated_at),updated_at=now()
      where id=v_payment.client_id;

    begin perform public.ensure_client_repayment_schedule(v_payment.client_id);
    exception when undefined_function then null; end;

  elsif not v_was_valid and v_payment.plantation_id is not null and v_paid>0 then
    v_days := public.portal_days_for_amount(v_payment.client_id,v_payment.plantation_id,v_paid);
    v_new_days := least(coalesce(v_client.jours_contrat_total,2147483647),coalesce(v_client.jours_payes,0)+v_days);
    update public.clients set jours_payes=v_new_days,
      taux_journalier_ha=public.portal_client_daily_rate(v_payment.client_id,_validated_at::date),
      prochaine_echeance=case when contrat_debut_at is not null then (contrat_debut_at+v_new_days)::date else prochaine_echeance end,
      jours_retard=case when contrat_debut_at is not null then greatest(0,current_date-(contrat_debut_at+v_new_days)::date) else jours_retard end,
      updated_at=now() where id=v_payment.client_id;
  end if;

  if not v_was_valid then
    insert into public.historique_activites(table_name,record_id,action,details,nouvelles_valeurs)
    values('paiements',v_payment.id::text,
      case when coalesce(v_payment.est_depot_initial,false) then 'PORTAL_PI_VALIDATED' else 'PORTAL_MONTHLY_PAYMENT_VALIDATED' end,
      case when coalesce(v_payment.est_depot_initial,false)
        then 'PI validé : plantation débloquée automatiquement et activation foncière propagée si une parcelle est liée.'
        else 'Paiement validé et jours couverts crédités automatiquement' end,
      jsonb_build_object('reference',v_payment.reference,'transaction_id',_transaction_id,
        'montant_paye',v_paid,'provider_amount',_provider_amount,'client_amount',v_payment.montant,
        'jours_credites',v_days,'jours_payes_apres',
        case when coalesce(v_payment.est_depot_initial,false) then v_client.jours_payes else v_new_days end,
        'validated_at',_validated_at,'client_id',v_payment.client_id,
        'plantation_id',v_payment.plantation_id,
        'parcelle_id',case when coalesce(v_payment.est_depot_initial,false) then v_plantation.parcelle_id else null end));
  end if;

  return jsonb_build_object('success',true,'already_validated',v_was_valid,
    'paiement_id',v_payment.id,'client_id',v_payment.client_id,'plantation_id',v_payment.plantation_id,
    'parcelle_id',case when coalesce(v_payment.est_depot_initial,false) then v_plantation.parcelle_id else null end,
    'montant_paye',v_paid,'provider_amount',_provider_amount,'jours_credites',v_days,
    'jours_payes',case when coalesce(v_payment.est_depot_initial,false) then v_client.jours_payes else coalesce(v_new_days,v_client.jours_payes) end,
    'activated',coalesce(v_payment.est_depot_initial,false),
    'plantation_activee',coalesce(v_payment.est_depot_initial,false),
    'foncier_active',case when coalesce(v_payment.est_depot_initial,false) then v_plantation.parcelle_id is not null else false end);
end;
$function$;