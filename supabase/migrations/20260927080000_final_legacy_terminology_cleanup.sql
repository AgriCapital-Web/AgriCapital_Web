-- Canonisation finale AgriCapital : suppression des traces actives AgriPlan et DI/DA.
-- Les anciennes migrations historiques sont conservées comme historique technique ;
-- cette migration garantit l'état courant de la base.

begin;

alter table public.grille_remuneration
  drop constraint if exists grille_remuneration_type_remuneration_check;

update public.grille_remuneration
set type_remuneration = replace(type_remuneration, 'commission_surplus_di', 'commission_surplus_pi'),
    description = regexp_replace(description, '\\mDI\\M', 'PI', 'gi')
where lower(coalesce(type_remuneration,'')) like '%di%'
   or lower(coalesce(description,'')) ~ '\\mdi\\M';

alter table public.grille_remuneration
  add constraint grille_remuneration_type_remuneration_check
  check (type_remuneration = any (array[
    'acquisition',
    'recouvrement_mensuel',
    'cash',
    'salaire_fixe',
    'prime_ha',
    'bonus_qualite',
    'commission_ha_signature',
    'commission_cash',
    'commission_surplus_pi',
    'commission_recouvrement',
    'bonus_palier',
    'objectif_mensuel'
  ]));

delete from public.notification_templates
where lower(coalesce(code,'')) like '%agriplan%'
   or lower(coalesce(nom,'')) like '%agriplan%'
   or lower(coalesce(parcours,'')) like '%agriplan%'
   or lower(coalesce(evenement,'')) like '%agriplan%';

delete from public.admin_audit_logs
where lower(coalesce(entite,'')) like '%agriplan%'
   or lower(coalesce(cible_libelle,'')) like '%agriplan%'
   or lower(coalesce(details::text,'')) like '%agriplan%';

commit;
