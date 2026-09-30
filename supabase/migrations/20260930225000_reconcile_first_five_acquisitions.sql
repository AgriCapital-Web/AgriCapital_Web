-- Production reconciliation for the first five acquisition dossiers.
-- Idempotent: rerunning this migration does not create duplicate payment schedules or commissions.

update public.clients set id_unique='AGC-RENUMBER-DARIUS' where id_unique='AGC-000003' and upper(coalesce(nom_complet,'')) like '%DARIUS%';
update public.clients set id_unique='AGC-000005' where id_unique='AGC-000004' and upper(coalesce(nom_complet,'')) like '%TIONON%';
update public.clients set id_unique='AGC-000004' where id_unique='AGC-RENUMBER-DARIUS';

insert into public.clients(
  id_unique,civilite,nom_famille,prenoms,nom_complet,nom,telephone,telephone_indicatif,telephone_local,whatsapp,
  district_id,region_id,departement_id,sous_prefecture_id,village_id,localite,offre_id,type_compte,nombre_plantations,total_hectares,
  statut,statut_global,created_by,updated_by,compte_actif,pi_paye_at,contrat_debut_at,mensualite_montant,phase_actuelle,
  jours_contrat_total,jours_payes,jours_retard,taux_journalier_ha,montant_total_contrat,famille_offre,formule_code,formule_nom,
  contrat_acquisition_statut,contrat_accompagnement_statut,paiement_initial_montant,paiement_initial_paye_at,parcours_code,
  type_client,type_client_foncier,mode_paiement,paiement_personnalise,numero_ordre_global,created_at,updated_at
)
select
  'AGC-000003','M.','BI','BERTIN','BI BERTIN','BI BERTIN','+2250767885529','+225','0767885529','+2250767885529',
  d.id,r.id,dep.id,sp.id,v.id,'GONATE',o.id,'especes',0,1,'actif','actif',
  (select user_id from public.profiles where id='bd9579fd-1d07-4431-9cc4-b57dfeeab593'),
  (select user_id from public.profiles where id='bd9579fd-1d07-4431-9cc4-b57dfeeab593'),
  true,'2026-08-23','2026-08-23',3500,'installation',10220,0,0,0,230000,'PALMTERROIR','PALMTERROIR_ESSENTIELLE','Essentielle',
  'a_preparer','a_preparer',230000,'2026-08-23','PALMTERROIR_ESSENTIELLE','beneficiaire_particulier','EXT','echeancier',
  jsonb_build_object('actif',true,'motif','Exception individuelle : avance de 100 000 F, solde PI 130 000 F et démarrage des mensualités 3 500 F après 3 mois.','offre_reference','PALMTERROIR_ESSENTIELLE','paiement_initial',jsonb_build_object('solde',130000,'montant_verse',100000,'montant_officiel',230000),'mensualite',jsonb_build_object('active',true,'nombre',33,'montant',3500,'date_debut','2026-11-23','date_fin','2029-07-23','decalage_mois',3),'sms',jsonb_build_object('utiliser_regle_personnalisee',true)),
  3,(select created_at-interval '1 second' from public.clients where id_unique='AGC-000004'),now()
from public.districts d
join public.regions r on r.district_id=d.id
join public.departements dep on dep.region_id=r.id
join public.sous_prefectures sp on sp.departement_id=dep.id
left join public.villages v on v.sous_prefecture_id=sp.id and upper(v.nom)='GONATÉ'
join public.offres o on o.formule_code='PALMTERROIR_ESSENTIELLE'
where upper(d.nom)='HAUT-SASSANDRA-MARAHOUE' and upper(r.nom)='HAUT-SASSANDRA' and upper(dep.nom)='DALOA' and upper(sp.nom)='GONATE'
and not exists(select 1 from public.clients where id_unique='AGC-000003') limit 1;

update public.clients
set numero_ordre_global=case id_unique when 'AGC-000001' then 1 when 'AGC-000002' then 2 when 'AGC-000003' then 3 when 'AGC-000004' then 4 when 'AGC-000005' then 5 end,
    nom_famille=upper(nom_famille),prenoms=upper(prenoms),nom_complet=upper(nom_complet),nom=upper(nom),
    nom_pere=upper(nom_pere),nom_mere=upper(nom_mere),contact_urgence_nom=upper(contact_urgence_nom),
    updated_at=now()
where id_unique in ('AGC-000001','AGC-000002','AGC-000003','AGC-000004','AGC-000005');

update public.clients c set district_id=d.id,region_id=r.id,departement_id=dep.id,sous_prefecture_id=sp.id,village_id=v.id,localite='GONATE',updated_at=now()
from public.districts d join public.regions r on r.district_id=d.id join public.departements dep on dep.region_id=r.id join public.sous_prefectures sp on sp.departement_id=dep.id left join public.villages v on v.sous_prefecture_id=sp.id and upper(v.nom)='GONATÉ'
where c.id_unique in ('AGC-000003','AGC-000004') and upper(d.nom)='HAUT-SASSANDRA-MARAHOUE' and upper(r.nom)='HAUT-SASSANDRA' and upper(dep.nom)='DALOA' and upper(sp.nom)='GONATE';

update public.clients c set district_id=d.id,region_id=r.id,departement_id=dep.id,sous_prefecture_id=sp.id,village_id=v.id,localite='GABOUA',updated_at=now()
from public.districts d join public.regions r on r.district_id=d.id join public.departements dep on dep.region_id=r.id join public.sous_prefectures sp on sp.departement_id=dep.id left join public.villages v on v.sous_prefecture_id=sp.id and upper(v.nom)='GABOUA'
where c.id_unique='AGC-000005' and upper(d.nom)='HAUT-SASSANDRA-MARAHOUE' and upper(r.nom)='HAUT-SASSANDRA' and upper(dep.nom)='DALOA' and upper(sp.nom)='DALOA';

update public.clients set type_client='beneficiaire_particulier',total_hectares=1,mensualite_montant=3500,compte_actif=true,statut='actif',statut_global='actif',contrat_debut_at='2026-09-16',prochaine_echeance='2026-12-16',jours_retard=0,phase_actuelle='installation',paiement_initial_montant=230000,paiement_initial_paye_at='2026-09-30',pi_paye_at='2026-09-30',
paiement_personnalise=jsonb_build_object('actif',true,'motif','Exception individuelle : démarrage des mensualités après 3 mois.','offre_reference','PALMTERROIR_ESSENTIELLE','paiement_initial',jsonb_build_object('solde',130000,'montant_verse',100000,'montant_officiel',230000),'mensualite',jsonb_build_object('active',true,'nombre',33,'montant',3500,'date_debut','2026-12-16','date_fin','2029-08-16','decalage_mois',3),'sms',jsonb_build_object('utiliser_regle_personnalisee',true)),updated_at=now()
where id_unique='AGC-000004';

update public.clients set type_client='beneficiaire_particulier',total_hectares=1,mensualite_montant=0,compte_actif=true,statut='actif',statut_global='actif',contrat_debut_at='2026-09-30',prochaine_echeance=null,jours_retard=0,phase_actuelle='installation',paiement_initial_montant=200000,paiement_initial_paye_at='2026-09-30',pi_paye_at='2026-09-30',
paiement_personnalise=jsonb_build_object('actif',true,'motif','Exception individuelle : ancienne facturation de 200 000 F, avance 100 000 F déjà versée, solde 100 000 F. Aucun paiement mensuel de 3 500 F.','offre_reference','PALMTERROIR_ESSENTIELLE','paiement_initial',jsonb_build_object('solde',100000,'montant_verse',100000,'montant_facture_ancien',200000),'mensualite',jsonb_build_object('active',false,'nombre',0,'montant',0,'decalage_mois',0),'sms',jsonb_build_object('utiliser_regle_personnalisee',true)),updated_at=now()
where id_unique='AGC-000005';

update public.plantations p set village='GONATE',village_nom='GONATE',localite='GONATE',sous_prefecture_id=(select id from public.sous_prefectures where upper(nom)='GONATE' limit 1),updated_at=now()
from public.clients c where p.client_id=c.id and c.id_unique='AGC-000004';
update public.plantations p set village='GABOUA',village_nom='GABOUA',localite='GABOUA',sous_prefecture_id=(select id from public.sous_prefectures where upper(nom)='DALOA' and departement_id=p.departement_id limit 1),updated_at=now()
from public.clients c where p.client_id=c.id and c.id_unique='AGC-000005';
update public.plantations p set date_plantation='2026-09-16',date_activation='2026-09-16',superficie_activee=superficie_ha,statut='actif',statut_global='actif',montant_pi_paye=100000,updated_at=now()
from public.clients c where p.client_id=c.id and c.id_unique='AGC-000004';
update public.plantations p set date_plantation='2026-09-30',date_activation='2026-09-30',superficie_activee=superficie_ha,statut='actif',statut_global='actif',montant_pi_paye=100000,updated_at=now()
from public.clients c where p.client_id=c.id and c.id_unique='AGC-000005';

update public.paiements p set mode_paiement='Wave',operateur_mobile_money='Wave',statut='valide',montant_paye=100000,date_paiement='2026-09-30',date_validation='2026-09-30',id_transaction='WAVE-AGC-000004-20260930',reference='WAVE-AGC-000004-20260930',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('provider','Wave','provider_reference','WAVE-AGC-000004-20260930','validation_source','crm_manual')
where p.client_id=(select id from public.clients where id_unique='AGC-000004') and p.est_depot_initial=true;
update public.paiements p set mode_paiement='Wave',operateur_mobile_money='Wave',statut='valide',montant_paye=100000,date_paiement='2026-09-30',date_validation='2026-09-30',id_transaction='WAVE-AGC-000005-20260930',reference='WAVE-AGC-000005-20260930',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('provider','Wave','provider_reference','WAVE-AGC-000005-20260930','validation_source','crm_manual')
where p.client_id=(select id from public.clients where id_unique='AGC-000005') and p.est_depot_initial=true;
insert into public.paiements(client_id,plantation_id,montant,montant_paye,montant_theorique,type_paiement,mode_paiement,statut,reference,date_paiement,date_validation,est_depot_initial,est_paiement_initial,phase,parcours,operateur_mobile_money,id_transaction,metadata,created_by,periode_debut,periode_fin)
select c.id,null,100000,100000,230000,'PI','Wave','valide','WAVE-AGC-000003-20260823','2026-08-23','2026-08-23',true,true,'paiement_initial','PALMTERROIR','Wave','WAVE-AGC-000003-20260823',jsonb_build_object('provider','Wave','provider_reference','WAVE-AGC-000003-20260823','validation_source','crm_manual'),c.created_by,'2026-08-23','2026-08-23'
from public.clients c where c.id_unique='AGC-000003' and not exists(select 1 from public.paiements p where p.client_id=c.id and p.est_depot_initial=true);

delete from public.paiements p where p.client_id=(select id from public.clients where id_unique='AGC-000004') and p.type_paiement='REDEVANCE';
insert into public.paiements(client_id,plantation_id,montant,montant_paye,montant_theorique,type_paiement,statut,numero_echeance,date_echeance,annee,phase,est_depot_initial,est_paiement_initial,metadata)
select c.id,p.id,3500,0,3500,'REDEVANCE','planifie',g.n,(date '2026-12-16'+((g.n-1)||' months')::interval)::date,ceil(g.n/12.0)::int,'personnalise',false,false,jsonb_build_object('echeancier_personnalise',true,'montant',3500,'numero',g.n,'total',33,'decalage_mois',3,'date_debut','2026-12-16')
from public.clients c join public.plantations p on p.client_id=c.id cross join generate_series(1,33) g(n) where c.id_unique='AGC-000004';
delete from public.paiements p where p.client_id=(select id from public.clients where id_unique='AGC-000003') and p.type_paiement='REDEVANCE';
insert into public.paiements(client_id,plantation_id,montant,montant_paye,montant_theorique,type_paiement,statut,numero_echeance,date_echeance,annee,phase,est_depot_initial,est_paiement_initial,metadata)
select c.id,null,3500,0,3500,'REDEVANCE','planifie',g.n,(date '2026-11-23'+((g.n-1)||' months')::interval)::date,ceil(g.n/12.0)::int,'personnalise',false,false,jsonb_build_object('echeancier_personnalise',true,'montant',3500,'numero',g.n,'total',33,'decalage_mois',3,'date_debut','2026-11-23')
from public.clients c cross join generate_series(1,33) g(n) where c.id_unique='AGC-000003';

update public.clients set prochaine_echeance='2026-12-16',jours_retard=0 where id_unique='AGC-000004';
update public.clients set prochaine_echeance='2026-11-23',jours_retard=0 where id_unique='AGC-000003';
update public.clients set prochaine_echeance=null,jours_retard=0,mensualite_montant=0 where id_unique='AGC-000005';
update public.paiements set statut='planifie',updated_at=now() where type_paiement='REDEVANCE' and statut='en_attente' and date_echeance>current_date;

insert into public.commissions(profile_id,plantation_id,type_commission,montant_base,taux_commission,montant_commission,periode,statut,date_calcul,paiement_id,client_id,taux_applique,annee_contrat)
select pr.id,p.id,'acquisition',case when c.id_unique='AGC-000005' then 200000 else 230000 end,0,15000,current_date,'calculee',now(),pay.id,c.id,0,1
from public.clients c join public.plantations p on p.client_id=c.id join public.paiements pay on pay.client_id=c.id and pay.est_depot_initial=true and pay.statut='valide' join public.profiles pr on pr.user_id=c.created_by
where c.id_unique in ('AGC-000004','AGC-000005') and p.statut_global='actif'
and not exists(select 1 from public.commissions cm where cm.client_id=c.id and cm.type_commission='acquisition');

insert into public.portefeuilles(user_id,solde_commissions,total_gagne,total_retire,dernier_versement_montant,total_verse)
select pr.user_id,30000,30000,0,0,0 from public.profiles pr where pr.id='bd9579fd-1d07-4431-9cc4-b57dfeeab593'
and not exists(select 1 from public.portefeuilles pf where pf.user_id=pr.user_id);

update public.portefeuilles pf set total_gagne=coalesce((select sum(c.montant_commission) from public.commissions c join public.profiles pr on pr.id=c.profile_id where pr.user_id=pf.user_id),0),
solde_commissions=greatest(0,coalesce((select sum(c.montant_commission) from public.commissions c join public.profiles pr on pr.id=c.profile_id where pr.user_id=pf.user_id and c.statut in ('calculee','validee')),0)-coalesce(pf.total_verse,0)),updated_at=now()
where pf.user_id=(select user_id from public.profiles where id='bd9579fd-1d07-4431-9cc4-b57dfeeab593');
