-- Reconcile the first five acquisition records and their payment schedules.
-- 1 Emmanuel, 2 BOLOU, 3 BI BERTIN, 4 DADODOUE DARIUS, 5 TIONON MADOU.

update public.clients
set district_id='c552c470-bd75-4985-93f6-7c101251ebc3',
    region_id='d7738144-14cf-43f6-be4d-500f21a9cee5',
    departement_id='f6903743-4dc4-4554-8be5-c751ab2ffb28',
    sous_prefecture_id='da27d8e6-1211-4bd3-9a3c-81b444ce8d6e',
    village_id='d92e4f91-8103-4986-92f1-f1abb4371258',
    localite='Gonaté'
where id_unique in ('AGC-000003','AGC-000004');

update public.clients
set district_id='c552c470-bd75-4985-93f6-7c101251ebc3',
    region_id='d7738144-14cf-43f6-be4d-500f21a9cee5',
    departement_id='f6903743-4dc4-4554-8be5-c751ab2ffb28',
    sous_prefecture_id='ffdb4050-1b54-49fb-b5ec-faf338b58b19',
    village_id='32866af7-6cc8-4e59-a9c3-2782365cb39a',
    localite='Gaboua'
where id_unique='AGC-000005';

update public.plantations
set district_id='c552c470-bd75-4985-93f6-7c101251ebc3',
    region_id='d7738144-14cf-43f6-be4d-500f21a9cee5',
    departement_id='f6903743-4dc4-4554-8be5-c751ab2ffb28',
    sous_prefecture_id='da27d8e6-1211-4bd3-9a3c-81b444ce8d6e',
    village='GONATÉ',
    village_nom='GONATÉ',
    localite='Gonaté'
where client_id=(select id from public.clients where id_unique='AGC-000004');

update public.plantations
set district_id='c552c470-bd75-4985-93f6-7c101251ebc3',
    region_id='d7738144-14cf-43f6-be4d-500f21a9cee5',
    departement_id='f6903743-4dc4-4554-8be5-c751ab2ffb28',
    sous_prefecture_id='ffdb4050-1b54-49fb-b5ec-faf338b58b19',
    village='GABOUA',
    village_nom='GABOUA',
    localite='Gaboua'
where client_id=(select id from public.clients where id_unique='AGC-000005');

update public.clients
set offre_id='4a062827-a1d1-476d-9789-16bcdae54f5f',
    famille_offre='PALMTERROIR',
    formule_code='PALMTERROIR_ESSENTIELLE',
    formule_nom='Essentielle',
    total_hectares=1,
    paiement_initial_montant=230000,
    paiement_initial_paye_at='2026-08-23T00:00:00Z',
    pi_paye_at='2026-08-23T00:00:00Z',
    mensualite_montant=3500,
    prochaine_echeance=null,
    jours_retard=0,
    phase_actuelle='pre_activation',
    paiement_personnalise='{"actif":true,"motif":"Mensualités déclenchées 3 mois après la mise en terre. Aucune mensualité exigible tant que la mise en terre n''est pas validée.","offre_reference":"PALMTERROIR_ESSENTIELLE","mensualite":{"active":true,"nombre":33,"montant":3500,"decalage_mois":3,"date_debut":null,"date_fin":null},"paiement_initial":{"montant_officiel":230000,"montant_verse":100000,"solde":130000}}'::jsonb
where id_unique='AGC-000003';

update public.clients
set prochaine_echeance='2026-12-16',
    mensualite_montant=3500,
    jours_retard=0
where id_unique='AGC-000004';

update public.paiements
set statut='planifie',
    montant_paye=0,
    mode_paiement=null,
    reference=null,
    date_paiement=null,
    updated_at=now()
where client_id=(select id from public.clients where id_unique='AGC-000004')
  and type_paiement='REDEVANCE';

update public.paiements
set statut='annule',
    date_echeance=null,
    montant_paye=0,
    notes='Échéancier suspendu jusqu’à la validation de la mise en terre. Les mensualités démarreront 3 mois après la mise en terre.',
    updated_at=now()
where client_id=(select id from public.clients where id_unique='AGC-000003')
  and type_paiement='REDEVANCE'
  and statut<>'valide';

update public.clients
set mensualite_montant=0,
    prochaine_echeance=null,
    jours_retard=0,
    paiement_personnalise='{"actif":true,"motif":"Exception individuelle : aucun paiement mensuel de 3 500 F.","offre_reference":"PALMTERROIR_ESSENTIELLE","mensualite":{"active":false,"nombre":0,"montant":0,"decalage_mois":0},"paiement_initial":{"montant_officiel":200000,"montant_verse":100000,"solde":100000}}'::jsonb
where id_unique='AGC-000005';

update public.paiements
set statut='valide',
    montant_paye=montant,
    mode_paiement='Wave',
    reference='WAVE-AGC-000003-20260823',
    id_transaction='WAVE-AGC-000003-20260823',
    operateur_mobile_money='Wave',
    date_paiement='2026-08-23T00:00:00Z',
    date_validation='2026-08-23T00:00:00Z',
    est_depot_initial=true,
    est_paiement_initial=true,
    updated_at=now()
where client_id=(select id from public.clients where id_unique='AGC-000003')
  and type_paiement='PI';

update public.paiements
set statut='valide',
    montant_paye=montant,
    mode_paiement='Wave',
    id_transaction=coalesce(id_transaction,reference),
    operateur_mobile_money='Wave',
    updated_at=now()
where client_id in (
  (select id from public.clients where id_unique='AGC-000004'),
  (select id from public.clients where id_unique='AGC-000005')
)
and type_paiement='PI';

insert into public.commissions(
  profile_id,client_id,paiement_id,type_commission,montant_base,taux_commission,
  montant_commission,periode,statut,annee_contrat
)
select
  'bd9579fd-1d07-4431-9cc4-b57dfeeab593',
  c.id,p.id,'acquisition',230000,0,15000,'2026-08-23','calculee',1
from public.clients c
join public.paiements p on p.client_id=c.id and p.type_paiement='PI'
where c.id_unique='AGC-000003'
  and not exists (
    select 1 from public.commissions x
    where x.client_id=c.id and x.type_commission='acquisition'
  );

update public.portefeuilles p
set total_gagne=coalesce((
      select sum(c.montant_commission)
      from public.commissions c
      where c.profile_id=p.user_id and c.statut in ('calculee','validee','payee')
    ),0),
    solde_commissions=coalesce((
      select sum(c.montant_commission)
      from public.commissions c
      where c.profile_id=p.user_id and c.statut in ('calculee','validee')
    ),0),
    updated_at=now()
where p.user_id='bd9579fd-1d07-4431-9cc4-b57dfeeab593';
