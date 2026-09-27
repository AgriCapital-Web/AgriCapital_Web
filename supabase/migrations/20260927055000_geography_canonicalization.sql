-- 2026-09-27 : normalisation finale du référentiel géographique.
-- Canonicalise les départements officiels et retire les anciennes lignes alias.
insert into public.departements(nom,code,region_id,est_actif)
select v.nom,v.code,v.region_id,true
from (values
('Grand-Lahou','CI1502',(select id from public.regions where code='GPO' limit 1)),
('Alépé','CI2403',(select id from public.regions where code='ME' limit 1)),
('Sikensi','CI0302',(select id from public.regions where code='AGT' limit 1)),
('Taabo','CI0303',(select id from public.regions where code='AGT' limit 1)),
('Attiégouakro','CI0201',(select id from public.regions where code='YAM' limit 1)),
('Ouellé','CI0703',(select id from public.regions where code='IFF' limit 1)),
('Bonon','CI3501',(select id from public.regions where code='MAR' limit 1)),
('Gohitafla','CI3502',(select id from public.regions where code='MAR' limit 1))
) v(nom,code,region_id)
where v.region_id is not null
and not exists(select 1 from public.departements d where lower(trim(d.nom))=lower(trim(v.nom)) and d.region_id=v.region_id);

update public.departements set est_actif=false
where lower(trim(nom)) in ('anyama','bingerville','niakara','gbeleban','odienne','koun fao','sandegue','toulepleu');

update public.departements set nom='Gbéléban',est_actif=true where lower(trim(nom))='gbeleban';
update public.departements set nom='Odienné',est_actif=true where lower(trim(nom))='odienne';
update public.departements set nom='Koun-Fao',est_actif=true where lower(trim(nom))='koun fao';
update public.departements set nom='Sandégué',est_actif=true where lower(trim(nom))='sandegue';
update public.departements set nom='Toulépleu',est_actif=true where lower(trim(nom))='toulepleu';
update public.departements set nom='Niakaramadougou',est_actif=true where code='CI1703';

update public.departements set est_actif=false where code is null and lower(trim(nom)) in ('dabakala','katiola','niakaramandougou');

update public.sous_prefectures set est_active=false
where departement_id in (select id from public.departements where est_actif=false);

update public.villages v set est_actif=false
where not exists(select 1 from public.sous_prefectures sp where sp.id=v.sous_prefecture_id and sp.est_active=true);

-- Le référentiel OpenAdminData utilisé pour l'import comporte 510 sous-préfectures ;
-- les doublons hérités sont conservés en historique mais désactivés.
