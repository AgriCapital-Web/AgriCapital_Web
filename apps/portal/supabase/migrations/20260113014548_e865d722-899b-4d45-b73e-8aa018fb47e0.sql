-- Tighten overly-permissive INSERT policies flagged by linter

-- account_requests: still public insert, but enforce minimal required fields
DROP POLICY IF EXISTS public_insert_account_requests ON public.account_requests;
CREATE POLICY public_insert_account_requests
ON public.account_requests
FOR INSERT
TO public
WITH CHECK (
  nom_complet IS NOT NULL
  AND length(trim(nom_complet)) >= 3
  AND email IS NOT NULL
  AND position('@' in email) > 1
);

-- paiements: allow anon insert only for pending payments with basic integrity
DROP POLICY IF EXISTS anon_insert_paiements ON public.paiements;
CREATE POLICY anon_insert_paiements
ON public.paiements
FOR INSERT
TO anon
WITH CHECK (
  statut = 'en_attente'
  AND montant > 0
  AND (montant_paye IS NULL OR montant_paye >= 0)
  AND coalesce(type_paiement, 'DA') IN ('DA', 'REDEVANCE')
);
