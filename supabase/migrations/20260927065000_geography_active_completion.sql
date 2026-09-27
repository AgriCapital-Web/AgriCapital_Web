-- 2026-09-27 : finaliser le référentiel géographique actif.
-- Les départements canoniques restent les lignes codifiées ; les doublons historiques sont
-- conservés hors sélection active avec un libellé historique.
update public.departements set nom='Gbéléban (historique)' where id='27ca734c-4aa4-4050-ad35-01fee6eecb28';
update public.departements set nom='Koun-Fao (historique)' where id='290f84a6-e04e-4c4e-a202-028c7dbaec72';
update public.departements set nom='Sandégué (historique)' where id='01630a89-9f8f-4aa8-b72f-263efe1e3f1f';
update public.departements set nom='Odienné (historique)' where id='22700321-cc81-46b7-8375-e5fe836da898';
update public.departements set nom='Toulépleu (historique)' where id='0861b2cf-0fea-4c6d-9665-011e6f43e4cd';

update public.departements set nom='Gbéléban' where code='CI2101';
update public.departements set nom='Koun-Fao' where code='CI1402';
update public.departements set nom='Sandégué' where code='CI1403';
update public.departements set nom='Odienné' where code='CI2103';
update public.departements set nom='Toulépleu' where code='CI0904';

update public.sous_prefectures sp set est_active=true
where sp.est_active=false and sp.code_sp is null
and exists (
  select 1 from public.departements d
  join public.regions r on r.id=d.region_id
  where d.id=sp.departement_id and d.est_actif=true and r.est_active=true
)
and not (
  sp.nom in ('Abobo','Adjamé','Attécoubé','Cocody','Koumassi','Marcory','Plateau','Port-Bouët','Treichville','Yopougon')
  and sp.departement_id=(select id from public.departements where code='ABJ' and est_actif=true limit 1)
);

update public.villages v set est_actif=true
where exists (
  select 1 from public.sous_prefectures sp
  join public.departements d on d.id=sp.departement_id
  join public.regions r on r.id=d.region_id
  join public.districts di on di.id=r.district_id
  where sp.id=v.sous_prefecture_id
    and sp.est_active=true and d.est_actif=true and r.est_active=true and di.est_actif=true
);

-- Rattachement des doublons historiques vers les départements canoniques codifiés.
update public.sous_prefectures sp set departement_id='ed623e3a-5a42-40ec-96a7-35d097bc9e31',est_active=true
where sp.departement_id='e096eb86-9593-4bf5-afc0-a824e5748758'
and not exists(select 1 from public.sous_prefectures c where c.departement_id='ed623e3a-5a42-40ec-96a7-35d097bc9e31' and lower(trim(c.nom))=lower(trim(sp.nom)));

update public.sous_prefectures sp set departement_id='ea517b5a-056d-469e-ba0b-db8cc5078719',est_active=true
where sp.departement_id='e274b2f3-ff6e-44ea-8ddf-6ebc3daeffc7'
and not exists(select 1 from public.sous_prefectures c where c.departement_id='ea517b5a-056d-469e-ba0b-db8cc5078719' and lower(trim(c.nom))=lower(trim(sp.nom)));

update public.sous_prefectures sp set departement_id='2de34668-7e36-419a-92df-e100e4e126c7',est_active=true
where sp.departement_id='5f2e4090-d15b-40a2-be53-c0c9e2637371'
and not exists(select 1 from public.sous_prefectures c where c.departement_id='2de34668-7e36-419a-92df-e100e4e126c7' and lower(trim(c.nom))=lower(trim(sp.nom)));

update public.villages v set est_actif=true
where exists(
  select 1 from public.sous_prefectures sp
  join public.departements d on d.id=sp.departement_id
  join public.regions r on r.id=d.region_id
  join public.districts di on di.id=r.district_id
  where sp.id=v.sous_prefecture_id and sp.est_active=true and d.est_actif=true and r.est_active=true and di.est_actif=true
);