-- 2026-09-27 : état actif final du référentiel géographique.
-- On active les nœuds présents dans le référentiel courant ; les historiques et
-- les entrées explicitement classées comme anciennes/invalides restent hors sélection.

update public.districts set est_actif=true;
update public.regions set est_active=true;

update public.departements set est_actif=true
where region_id is not null
  and lower(nom) not like '%(historique)%'
  and lower(nom) not in ('anyama','bingerville','bonon','gohitafla','ouellé','niakara')
  and (code is null or code not in ('CI0703','CI3501','CI3502','NIA'));

update public.departements set est_actif=false
where region_id is null
   or lower(nom) like '%(historique)%'
   or lower(nom) in ('anyama','bingerville','bonon','gohitafla','ouellé','niakara')
   or code in ('CI0703','CI3501','CI3502','NIA');

update public.sous_prefectures sp
set est_active=true
where exists (
  select 1
  from public.departements d
  join public.regions r on r.id=d.region_id
  join public.districts di on di.id=r.district_id
  where d.id=sp.departement_id
    and d.est_actif=true
    and r.est_active=true
    and di.est_actif=true
);

update public.villages v
set est_actif=true
where exists (
  select 1
  from public.sous_prefectures sp
  join public.departements d on d.id=sp.departement_id
  join public.regions r on r.id=d.region_id
  join public.districts di on di.id=r.district_id
  where sp.id=v.sous_prefecture_id
    and sp.est_active=true
    and d.est_actif=true
    and r.est_active=true
    and di.est_actif=true
);
