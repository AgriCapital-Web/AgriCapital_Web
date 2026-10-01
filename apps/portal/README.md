# AgriCapital — Portail client

**Éditeur :** AgriCapital SARL  
**Fondateur / responsable :** Inocent KOFFI _ AgriCapital  
**Domaine :** https://agricapital.ci/  
**Portail client :** https://client.agricapital.ci/  
**CRM :** https://app.agricapital.ci/

## Présentation

AgriCapital est une plateforme de gestion et de suivi de projets agricoles. Le portail client permet notamment :

- suivi des plantations de palmier à huile ;
- consultation des superficies et activations ;
- suivi des paiements et échéances ;
- consultation des rapports et médias terrain ;
- messagerie avec les équipes AgriCapital ;
- notifications applicatives et notifications push PWA ;
- accès sécurisé par téléphone et code personnel à 4 chiffres.

## Architecture

- React + TypeScript + Vite
- Supabase Database / Edge Functions / Storage
- PWA avec Service Worker et Web Push
- Vercel pour le déploiement web
- KKiaPay pour les paiements
- CRM AgriCapital comme source opérationnelle de référence

## Principes

Le portail ne duplique pas la logique métier du CRM : les offres, contrats, plantations, parcelles, paiements, rapports et relations clients sont synchronisés depuis les données métier centrales.

Les notifications utilisent une clé de déduplication commune afin d'éviter les doubles notifications entre le CRM, l'application et le push.

## Développement

1. Installer les dépendances avec le gestionnaire de paquets du projet.
2. Configurer les variables Supabase nécessaires.
3. Lancer l'environnement de développement.
4. Vérifier les migrations et les Edge Functions avant déploiement.

## Maintenance

Les migrations SQL sous `supabase/migrations/` constituent la source versionnée des évolutions de la base.

Les secrets serveur, notamment les clés Web Push VAPID, ne doivent jamais être commités dans Git. Ils sont conservés dans le coffre sécurisé Supabase.

## Identité

Toute attribution de contenu, documentation ou métadonnée interne du projet doit utiliser :

**Inocent KOFFI _ AgriCapital**
