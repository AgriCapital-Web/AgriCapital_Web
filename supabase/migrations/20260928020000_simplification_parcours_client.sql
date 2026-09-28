-- Simplification du parcours Client : 5 étapes, aucun paiement dans le CRM.
-- Paiements gérés exclusivement par le portail Client (agricapital-pay).

delete from public.offre_formulaire_etapes;

insert into public.offre_formulaire_etapes(offre_id,code,titre,description,ordre,obligatoire,configuration)
select o.id,v.code,v.titre,v.description,v.ordre,v.obligatoire,v.configuration
from public.offres o
cross join lateral (values
('offre','Offre et superficie','Choix de la formule et de la superficie.',1,true,jsonb_build_object('start',true)),
('client','Client et enquête','Identité, coordonnées, enquête Client et cotitulaire/mandataire si nécessaire.',2,true,jsonb_build_object('merge_enquete',true,'merge_representant',true)),
('parcelle','Foncier / parcelle','Parcelle, localisation, superficie et rattachement foncier.',3,true,'{}'::jsonb),
('documents','Documents et contrats','Toutes les pièces, annexes et contrats applicables au dossier Client.',4,true,jsonb_build_object('merge_contracts',true,'merge_annexes',true)),
('confirmation','Confirmation','Récapitulatif final et validation du dossier.',5,true,'{}'::jsonb)
) v(code,titre,description,ordre,obligatoire,configuration)
where o.actif=true;

comment on table public.offre_formulaire_etapes is 'Parcours CRM Client simplifié en 5 étapes : offre, Client/enquête, foncier, documents/contrats, confirmation. Aucun paiement dans ce formulaire.';
