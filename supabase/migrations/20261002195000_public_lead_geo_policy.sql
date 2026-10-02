drop policy if exists "Anon can insert leads" on public.leads;
create policy "Anon can insert leads" on public.leads for insert to anon with check (
 statut='nouveau' and assigned_to is null and client_id is null and converti_at is null and created_by is null and prochaine_relance_at is null
 and district_id is not null
 and exists(select 1 from public.v_geo_districts d where d.id=leads.district_id and d.est_actif_effectif=true)
 and (region_id is null or exists(select 1 from public.v_geo_regions r where r.id=leads.region_id and r.district_id=leads.district_id and r.est_active_effectif=true))
 and (departement_id is null or exists(select 1 from public.v_geo_departements d where d.id=leads.departement_id and d.region_id=leads.region_id and d.est_actif_effectif=true))
 and (sous_prefecture_id is null or exists(select 1 from public.v_geo_sous_prefectures s where s.id=leads.sous_prefecture_id and s.departement_id=leads.departement_id and s.est_active_effective=true))
 and (village_id is null or exists(select 1 from public.v_geo_villages v where v.id=leads.village_id and v.sous_prefecture_id=leads.sous_prefecture_id and v.est_actif_effectif=true))
 and nom is not null and length(btrim(nom)) between 2 and 120
 and prenoms is not null and length(btrim(prenoms)) between 2 and 120
 and telephone is not null and length(btrim(telephone)) between 6 and 30
 and ((email is null) or (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'))
 and source=any(array['formulaire_public','reseaux_sociaux','site_web','commercial_terrain','reference','autre'])
);