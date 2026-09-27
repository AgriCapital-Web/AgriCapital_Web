-- Cleanup of canonical client index names and duplicate foreign-key indexes.
ALTER INDEX IF EXISTS public.idx_souscripteurs_id_unique RENAME TO idx_clients_id_unique;
ALTER INDEX IF EXISTS public.idx_souscripteurs_offre RENAME TO idx_clients_offre;
ALTER INDEX IF EXISTS public.idx_souscripteurs_statut RENAME TO idx_clients_statut;
ALTER INDEX IF EXISTS public.idx_souscripteurs_user RENAME TO idx_clients_user;
ALTER INDEX IF EXISTS public.idx_souscripteurs_type RENAME TO idx_clients_type;
ALTER INDEX IF EXISTS public.idx_souscripteurs_parcelle RENAME TO idx_clients_parcelle;
ALTER INDEX IF EXISTS public.idx_souscripteurs_numero_contrat RENAME TO idx_clients_numero_contrat;
ALTER INDEX IF EXISTS public.idx_documents_souscription_souscripteur_id RENAME TO idx_documents_acquisition_client_id;
ALTER INDEX IF EXISTS public.idx_lots_souscripteur RENAME TO idx_lots_client;
ALTER INDEX IF EXISTS public.idx_agriplan_suivis_souscripteur RENAME TO idx_agriplan_suivis_client;
ALTER INDEX IF EXISTS public.idx_hist_actions_sous RENAME TO idx_hist_actions_client;
ALTER INDEX IF EXISTS public.idx_client_contracts_subscriber RENAME TO idx_client_contracts_client;
DROP INDEX IF EXISTS public.idx_fk_transferts_paiements_e57d5fa2d518200b6e8115f6161768e1;
DROP INDEX IF EXISTS public.idx_fk_transferts_paiements_6a269e454c941c0d21cc80b949ddc4c9;
