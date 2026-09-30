-- Normalize acquisition document workflow so uploaded documents enter the validation queue.
UPDATE public.documents_acquisition
SET statut = 'en_attente'
WHERE statut = 'soumis';

COMMENT ON COLUMN public.documents_acquisition.statut IS
'Workflow de validation: en_attente, valide, rejete. Les anciennes valeurs soumis sont normalisées en en_attente.';
