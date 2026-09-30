-- Correct the two current plantations: fully planted on 2026-09-05.
update public.plantations
set date_plantation='2026-09-05',
    date_activation='2026-09-05',
    surface_reellement_plantee=coalesce(superficie_ha,0),
    nombre_plants_mis_en_terre=coalesce(nombre_plants_prevus,0),
    taux_reussite=100,
    updated_at=now()
where id in ('e8b99368-9415-418d-8399-4e0dbfb6df2c','1ba1b803-592a-42bd-8ec5-1ddb269ee5b8');

insert into public.interventions_techniques
  (plantation_id,type_intervention,date_intervention,statut,observations,nombre_plants_prevus,nombre_plants_realises,densite_plants)
select p.id,'piquetage','2026-09-05','realisee','Étape de piquetage validée dans le parcours d’installation.',p.nombre_plants_prevus,p.nombre_plants_prevus,p.densite_plants
from public.plantations p
where p.id in ('e8b99368-9415-418d-8399-4e0dbfb6df2c','1ba1b803-592a-42bd-8ec5-1ddb269ee5b8')
and not exists (select 1 from public.interventions_techniques i where i.plantation_id=p.id and i.type_intervention='piquetage');

update public.interventions_techniques
set date_intervention='2026-09-05'
where plantation_id in ('e8b99368-9415-418d-8399-4e0dbfb6df2c','1ba1b803-592a-42bd-8ec5-1ddb269ee5b8')
and type_intervention in ('validation_parcelle','defrichage','piquetage','trouaison','mise_en_terre');

update public.interventions_techniques i
set nombre_plants_prevus=p.nombre_plants_prevus,nombre_plants_realises=p.nombre_plants_prevus,densite_plants=coalesce(p.densite_plants,p.densite_cible,143)
from public.plantations p
where i.plantation_id=p.id and i.plantation_id in ('e8b99368-9415-418d-8399-4e0dbfb6df2c','1ba1b803-592a-42bd-8ec5-1ddb269ee5b8') and i.type_intervention='mise_en_terre';