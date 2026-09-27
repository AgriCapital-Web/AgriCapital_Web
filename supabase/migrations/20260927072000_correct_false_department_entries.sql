-- 2026-09-27 : corriger trois départements introduits à tort ; ce sont des sous-préfectures.
update public.departements
set est_actif=false
where code in ('CI0703','CI3501','CI3502');