# Installation et Configuration d'AgriCapital CRM

## 📋 Étapes d'Installation

### 1. Configuration de la Base de Données

Avant d'utiliser le système de notifications et demandes de compte, vous devez créer les tables nécessaires dans Supabase :

1. **Ouvrez Supabase** : Connectez-vous à votre projet Supabase
2. **Allez dans SQL Editor** : Cloud → Database → SQL Editor
3. **Exécutez le script** : Copiez le contenu du fichier `SETUP_NOTIFICATIONS.sql` et exécutez-le

Ce script va créer :
- ✅ Table `notifications` pour le système de notifications en temps réel
- ✅ Table `account_requests` pour les demandes de création de compte
- ✅ Table `activity_notes` pour les notes utilisateurs sur les actions
- ✅ Triggers automatiques pour notifications lors de nouvelles souscriptions/paiements
- ✅ Fonction `notify_hierarchy()` pour envoyer des notifications à la hiérarchie
- ✅ Bucket storage `documents` pour les fichiers
- ✅ Policies RLS appropriées pour la sécurité

### 2. Création du Compte Super Admin

Pour créer le compte super administrateur initial :

1. **Accédez à l'URL** : `https://votre-domaine.com/create-super-admin`
2. **Cliquez sur le bouton** : "Créer le compte Super Admin"
3. **Informations du compte** :
   - Username: `admin`
   - Email: `admin@agricapital.ci`
   - Password: `@AgriCapitaladmin`
   - Nom: KOFFI Inocent
   - Téléphone: 0759566087
   - Rôle: Super Administrateur

⚠️ **Important** : Changez le mot de passe immédiatement après la première connexion !

### 3. Configuration des Notifications (Optionnel)

Pour activer les notifications par email et WhatsApp, configurez les secrets dans Supabase :

#### Notifications Email (Resend)
```bash
RESEND_API_KEY=votre_clé_api_resend
```

1. Créez un compte sur [resend.com](https://resend.com)
2. Validez votre domaine email
3. Créez une clé API dans Resend → API Keys
4. Ajoutez le secret dans Supabase → Project Settings → Edge Functions → Secrets

#### Notifications WhatsApp (Meta Business)
```bash
WHATSAPP_TOKEN=votre_token_whatsapp
```

1. Créez un compte Meta Business
2. Configurez WhatsApp Business API
3. Obtenez votre token d'accès
4. Ajoutez le secret dans Supabase

### 4. Première Connexion

1. **Allez sur** : `https://votre-domaine.com/login`
2. **Connectez-vous avec** :
   - Nom d'utilisateur: `admin`
   - Mot de passe: `@AgriCapitaladmin`
3. **Changez votre mot de passe** dans Paramètres → Mon profil

## 🔐 Sécurité

- ✅ Row Level Security (RLS) activé sur toutes les tables
- ✅ Authentification requise pour toutes les routes protégées
- ✅ Validation des entrées côté client et serveur
- ✅ Secrets stockés de manière sécurisée dans Supabase
- ✅ CORS configuré correctement pour les edge functions

## 📱 Fonctionnalités

### Système de Notifications en Temps Réel
- Notifications dans l'application avec badge de compteur
- Notifications par email (si Resend configuré)
- Notifications par WhatsApp (si WhatsApp configuré)
- Hiérarchie automatique : Chef d'équipe → Responsable Zone → Directeur Technico-commercial

### Demandes de Création de Compte
- Formulaire public pour nouveaux employés/prestataires
- Upload de photo obligatoire avec prévisualisation
- Upload de CV (optionnel)
- Validation/rejet par super admin avec motif
- Notifications multi-canal au super admin

### Traçabilité
- Chaque action est enregistrée dans audit_log
- Les utilisateurs peuvent ajouter des notes optionnelles sur leurs actions
- Historique complet visible par les administrateurs

### Gestion des Rôles Unifiés
- Ancien système : "commercial" + "technicien" + "directeur_commercial"
- Nouveau système : "technico_commercial" + "directeur_technico_commercial"
- Uniformisation dans toute la plateforme

## 🛠️ Support Technique

Pour toute question ou problème :
- **Email** : contact@agricapital.ci
- **Téléphone** : +225 07 59 56 60 87
- **Heures** : 9h-17h (GMT)

## 📊 Prochaines Étapes

Après l'installation :
1. ✅ Créer les utilisateurs via le menu Utilisateurs
2. ✅ Configurer les paramètres système dans Paramètres
3. ✅ Importer les données existantes (si migration)
4. ✅ Former les utilisateurs
5. ✅ Tester toutes les fonctionnalités

## 🔄 Mises à Jour

Le système se met à jour automatiquement via :
- **Frontend** : Cliquez sur "Déployer" dans Inocent KOFFI _ AgriCapital
- **Backend** : Les edge functions se déploient automatiquement
- **Base de données** : Exécutez les nouveaux scripts SQL manuellement
