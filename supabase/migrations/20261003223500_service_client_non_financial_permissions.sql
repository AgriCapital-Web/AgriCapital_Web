-- Service Client: support and relation client only.
-- No access to financial amounts, payments or financial reports.
DELETE FROM public.role_permissions
WHERE role_code IN ('service_client','chef_equipe_service_client')
  AND permission_code IN (
    'clients.view_money',
    'paiements.view',
    'paiements.record',
    'paiements.execute',
    'paiements.update',
    'paiements.cancel',
    'paiements.validate',
    'rapports.view_financier'
  );