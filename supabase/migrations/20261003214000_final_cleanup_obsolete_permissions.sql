-- Final canonical cleanup of permission rows that have no corresponding active UI/catalogue definition.
-- Runtime role assignments remain in public.role_permissions; this migration only removes obsolete codes.
DELETE FROM public.role_permissions
WHERE permission_code IN ('paiements.create', 'parametres.manage_users');

-- Service Client is non-financial. Financial access is reserved for the finance roles.
DELETE FROM public.role_permissions
WHERE role_code IN ('service_client', 'chef_equipe_service_client')
  AND (
    permission_code LIKE 'finance.%'
    OR permission_code LIKE 'paiements.%'
    OR permission_code LIKE 'commissions.%'
    OR permission_code LIKE 'portefeuilles.%'
    OR permission_code = 'clients.view_money'
    OR permission_code = 'rapports.view_financier'
  );
