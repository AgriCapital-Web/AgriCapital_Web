-- Canon métier final AgriCapital : PalmTerroir Flexible
-- PI unique de 230 000 F, puis 12 600 F/mois pendant 36 mois.
-- Total contractuel : 683 600 F/ha.
update public.offres
set
  montant_pi_par_ha = 230000,
  montant_cash_par_ha = 0,
  montant_total_par_ha = 683600,
  duree_paiement_mois = 36,
  contribution_mensuelle_par_ha = 12600,
  tranches_paiement = jsonb_build_array(
    jsonb_build_object('mois',12,'annee',1,'mois_debut',1,'mois_fin',12,'mensualite_par_ha',12600,'total_periode_par_ha',151200),
    jsonb_build_object('mois',12,'annee',2,'mois_debut',13,'mois_fin',24,'mensualite_par_ha',12600,'total_periode_par_ha',151200),
    jsonb_build_object('mois',12,'annee',3,'mois_debut',25,'mois_fin',36,'mensualite_par_ha',12600,'total_periode_par_ha',151200)
  ),
  updated_at = now()
where code = 'palm-terroir-flexible';
