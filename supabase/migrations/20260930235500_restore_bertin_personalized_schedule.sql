-- Restore BI BERTIN's canonical personalized schedule.
-- Initial payment: 100,000 XOF on 2026-08-23.
-- Remaining initial balance: 130,000 XOF.
-- Personalized monthly payments: 3,500 XOF x 33, starting 2026-11-23.
UPDATE public.paiements p
SET statut = 'planifie',
    montant = 3500,
    montant_paye = 0,
    date_paiement = NULL,
    date_echeance = (DATE '2026-11-23' + make_interval(months => ((p.metadata->>'numero')::int - 1)))::date
FROM public.clients c
WHERE p.client_id = c.id
  AND c.id_unique = 'AGC-000003'
  AND p.type_paiement = 'REDEVANCE'
  AND p.statut = 'annule'
  AND COALESCE((p.metadata->>'echeancier_personnalise')::boolean, false)
  AND (p.metadata->>'numero') ~ '^[0-9]+$'
  AND (p.metadata->>'numero')::int BETWEEN 1 AND 33;

UPDATE public.clients
SET prochaine_echeance = DATE '2026-11-23'
WHERE id_unique = 'AGC-000003';
