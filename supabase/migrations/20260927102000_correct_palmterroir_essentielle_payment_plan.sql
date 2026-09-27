-- Correction canonique PalmTerroir Essentielle
-- Aucun paiement après trouaison. Le seul paiement à la signature est le Paiement Initial de 230 000 FCFA/ha.
-- Puis 3 500 FCFA/ha/mois pendant 36 mois. Total = 230 000 + (3 500 x 36) = 356 000 FCFA/ha.

update public.offres
set montant_pi_par_ha = 230000,
    contribution_mensuelle_par_ha = 3500,
    paiement_signature_par_ha = 230000,
    paiement_apres_trouaison_par_ha = 0,
    montant_total_par_ha = 356000,
    duree_paiement_mois = 36,
    tranches_paiement = '[
      {"mois":12,"annee":1,"mois_fin":12,"mois_debut":1,"mensualite_par_ha":3500,"total_periode_par_ha":42000},
      {"mois":12,"annee":2,"mois_fin":24,"mois_debut":13,"mensualite_par_ha":3500,"total_periode_par_ha":42000},
      {"mois":12,"annee":3,"mois_fin":36,"mois_debut":25,"mensualite_par_ha":3500,"total_periode_par_ha":42000}
    ]'::jsonb,
    description = 'Paiement initial de 230 000 FCFA, puis 3 500 FCFA par mois pendant 36 mois.',
    updated_at = now()
where code = 'palm-terroir-essentielle';
