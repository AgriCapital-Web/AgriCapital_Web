-- Direction générale + commissions techniques initiales
insert into public.role_permissions (role_code, permission_code)
select 'dg', permission_code
from public.role_permissions
where role_code='super_admin'
on conflict (role_code, permission_code) do nothing;

do $$
declare v_technicien uuid;
begin
  select id into v_technicien from public.profiles
  where lower(trim(nom_complet)) = lower('YAO KONAN JEAN-MARIE') limit 1;
  if v_technicien is null then
    insert into public.profiles (nom_complet, poste, relation_rh, actif)
    values ('YAO KONAN JEAN-MARIE', 'Technicien', 'Employé', true)
    returning id into v_technicien;
  end if;

  insert into public.commissions
    (profile_id, plantation_id, client_id, type_commission, montant_base, taux_commission,
     montant_commission, periode, date_calcul, statut)
  select v_technicien,p.id,p.client_id,'technique',5000,0,5000,
         coalesce(p.date_plantation,current_date),now(),
         case when upper(trim(c.nom_complet))='TIONON MADOU' then 'validee' else 'payee' end
  from public.plantations p join public.clients c on c.id=p.client_id
  where upper(trim(c.nom_complet)) in ('DADODOUE DARIUS','YAO KONAN EMMANUEL','ZAGBLE BOLOU JEAN-JACQUES','TIONON MADOU')
    and exists (select 1 from public.interventions_techniques i
                where i.client_id=p.client_id and i.statut='realisee' and i.type_intervention='mise_en_terre')
    and not exists (select 1 from public.commissions cx
                    where cx.profile_id=v_technicien and cx.client_id=p.client_id
                      and cx.type_commission='technique' and cx.plantation_id=p.id);
end $$;

create index if not exists idx_commissions_profile_type_statut
  on public.commissions(profile_id, type_commission, statut);
create index if not exists idx_interventions_techniques_client_statut_type
  on public.interventions_techniques(client_id, statut, type_intervention);
