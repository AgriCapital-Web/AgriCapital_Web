# Guide de Déploiement - AgriCapital

## ⚠️ IMPORTANT: Ce projet nécessite une étape de BUILD avant le déploiement

Ce projet utilise **Vite** comme outil de build. Vous **NE POUVEZ PAS** simplement télécharger le code source et le téléverser directement sur votre serveur. Vous devez d'abord compiler le projet.

## 📋 Prérequis

- Node.js version 18 ou supérieure
- npm ou yarn installé
- Accès à votre serveur SafaryCloud (FTP/SFTP)

## 🚀 Étapes de Déploiement

### 1. Cloner ou télécharger le projet depuis GitHub

```bash
git clone [URL_DE_VOTRE_REPO]
cd [NOM_DU_PROJET]
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Construire le projet pour la production

```bash
npm run build
```

Cette commande crée un dossier `dist/` contenant tous les fichiers optimisés pour la production.

### 4. Téléverser sur SafaryCloud

**🔴 ATTENTION:** Ne téléversez **QUE** le contenu du dossier `dist/`, pas le projet entier!

Via FTP/SFTP, téléversez **TOUS les fichiers et dossiers** qui se trouvent **À L'INTÉRIEUR** du dossier `dist/` vers votre répertoire web (généralement `public_html/` ou `www/`).

Structure après téléversement sur www.agricapital.ci:
```
public_html/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
├── .htaccess
└── ...autres fichiers du dossier dist
```

### 5. Vérifier la configuration du serveur

Le fichier `.htaccess` est déjà inclus dans le dossier `dist/` et sera téléversé automatiquement. Il configure:
- La redirection des routes React vers index.html
- La compression gzip
- Le cache des assets statiques

### 6. Variables d'environnement Supabase

Les variables d'environnement Supabase sont déjà intégrées lors du build:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Ces variables sont configurées dans le fichier `.env` et sont compilées dans le build.

## 🔄 Mise à jour du site

Pour mettre à jour votre site après des modifications:

1. Récupérer les dernières modifications depuis GitHub
2. Réinstaller les dépendances si nécessaire: `npm install`
3. Reconstruire: `npm run build`
4. Téléverser le **nouveau contenu du dossier dist/** sur SafaryCloud

## ❌ Erreurs courantes

### Site blanc / page vide
- **Cause**: Vous avez téléversé le code source au lieu du build
- **Solution**: Suivez les étapes ci-dessus et téléversez uniquement le contenu de `dist/`

### Routes 404
- **Cause**: Le fichier `.htaccess` n'est pas présent ou ne fonctionne pas
- **Solution**: Vérifiez que `.htaccess` est bien dans le dossier racine de votre site

### Connexion Supabase échoue
- **Cause**: Variables d'environnement manquantes lors du build
- **Solution**: Vérifiez que le fichier `.env` contient les bonnes valeurs avant de lancer `npm run build`

## 📞 Support

En cas de problème: +225 07 59 56 60 87

## 🔐 Accès Super Admin

**Username:** admin  
**Email:** contact@agricapital.ci  
**Téléphone:** 0759566087  
**Mot de passe:** @AgriCapital

---

**Domaine de production:** https://www.agricapital.ci  
**Hébergeur:** SafaryCloud


## PWA et notifications push

Le portail utilise un Service Worker unique (`public/sw.js`) pour :
- le cache PWA ;
- la réception Web Push ;
- l'affichage des notifications lorsque l'application n'est pas ouverte ;
- le clic sur notification et le retour vers le portail.

Les abonnements sont enregistrés dans `public.push_subscriptions` et rattachés soit à un utilisateur CRM, soit à un client portail.

Les événements de notification passent par `notification_event_outbox`. La clé `dedupe_key` est la référence d'idempotence afin d'éviter les doubles notifications.

Les clés VAPID sont stockées dans le coffre Supabase Vault sous `agricapital_vapid_config`. Elles ne doivent jamais être commitées dans Git.

## Identité du projet

Éditeur : **AgriCapital SARL**  
Fondateur / responsable : **Inocent KOFFI _ AgriCapital**
