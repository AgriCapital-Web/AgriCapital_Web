# Documentation d'Intégration Wave - AgriCapital CRM

## Vue d'ensemble

Ce document fournit toutes les informations techniques nécessaires pour l'intégration du système de paiement Wave avec le CRM AgriCapital.

---

## 1. Architecture de l'intégration

### Flux de paiement

```
Planteur (Wave App)
    ↓
    1. Saisie numéro téléphone
    ↓
API Vérification (GET)
    ↓
    2. Affichage infos + montant
    ↓
Validation paiement Wave
    ↓
API Notification (POST)
    ↓
    3. Mise à jour CRM AgriCapital
```

---

## 2. Endpoints API

### Base URL
```
Production: https://vschpokaogikpfayzxja.supabase.co/functions/v1
```

### 2.1 Vérification avant paiement

**Endpoint:** `GET /wave-verification`

**Description:** Vérifie l'existence du souscripteur et retourne les informations de paiement

**Paramètres:**
- `telephone` (required): Numéro de téléphone du planteur

**Exemple de requête:**
```bash
curl -X GET "https://vschpokaogikpfayzxja.supabase.co/functions/v1/wave-verification?telephone=0759566087" \
  -H "Content-Type: application/json"
```

**Réponse succès (200 OK):**
```json
{
  "success": true,
  "souscripteur": {
    "nom_complet": "KOFFI Inocent",
    "telephone": "0759566087",
    "superficie_totale": 5.5
  },
  "type_paiement": "droit_acces",
  "montant_recommande": 165000,
  "statut": "a_jour",
  "promotion": {
    "nom": "Promo Lancement 2025",
    "reduction_pct": 33.33,
    "montant_unitaire": 20000
  },
  "message": "Premier paiement - Droit d'Accès"
}
```

**Réponse succès - Contribution Annuelle:**
```json
{
  "success": true,
  "souscripteur": {
    "nom_complet": "KOFFI Inocent",
    "telephone": "0759566087",
    "superficie_totale": 5.5
  },
  "type_paiement": "contribution_annuelle",
  "montant_recommande": 1900,
  "statut": "en_arriere",
  "promotion": null,
  "message": "Contribution Annuelle - Statut: en_arriere"
}
```

**Réponse erreur (404 Not Found):**
```json
{
  "success": false,
  "error": "Souscripteur non trouvé avec ce numéro"
}
```

**Codes de statut:**
- `a_jour`: Contributions à jour
- `en_avance`: Paiements en avance
- `en_arriere`: Paiements en retard

---

### 2.2 Notification après paiement

**Endpoint:** `POST /wave-notification`

**Description:** Enregistre le paiement validé et met à jour le CRM

**Headers:**
```
Content-Type: application/json
```

**Corps de la requête:**
```json
{
  "transaction_id": "WAVE_TXN_123456789",
  "telephone": "0759566087",
  "montant": 20000,
  "date_paiement": "2025-01-15T10:30:00Z",
  "type_paiement": "droit_acces",
  "donnees_supplementaires": {
    "methode": "mobile_money",
    "operateur": "wave",
    "reference_client": "REF_CLIENT_001"
  }
}
```

**Champs obligatoires:**
- `transaction_id`: ID unique de la transaction Wave
- `telephone`: Numéro de téléphone du planteur
- `montant`: Montant payé en FCFA

**Champs optionnels:**
- `date_paiement`: Date ISO du paiement (défaut: maintenant)
- `type_paiement`: `droit_acces` ou `contribution_annuelle` (défaut: `droit_acces`)
- `donnees_supplementaires`: Objet JSON avec métadonnées supplémentaires

**Exemple de requête:**
```bash
curl -X POST "https://vschpokaogikpfayzxja.supabase.co/functions/v1/wave-notification" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "WAVE_TXN_123456789",
    "telephone": "0759566087",
    "montant": 20000,
    "type_paiement": "droit_acces"
  }'
```

**Réponse succès (200 OK):**
```json
{
  "success": true,
  "message": "Paiement enregistré avec succès",
  "paiement_id": "uuid-here",
  "souscripteur_id": "uuid-here",
  "type_paiement": "droit_acces",
  "montant": 20000
}
```

**Réponse erreur (409 Conflict):**
```json
{
  "success": false,
  "error": "Transaction déjà enregistrée"
}
```

**Réponse erreur (404 Not Found):**
```json
{
  "success": false,
  "error": "Souscripteur non trouvé"
}
```

---

## 3. Logique de calcul

### 3.1 Droit d'Accès (Premier paiement)

**Formule de base:**
```
Montant DA = Superficie (ha) × Montant unitaire
Montant unitaire = 30 000 FCFA (ou promotion si active)
```

**Avec promotion:**
```
Montant DA = Superficie × Montant_promo
Exemple: 5 ha × 20 000 FCFA = 100 000 FCFA
Économie: 5 ha × (30 000 - 20 000) = 50 000 FCFA
```

---

### 3.2 Contribution Annuelle

**Taux journalier:** 65 FCFA/jour

**Montants standards:**
- 1 mois (30 jours): 1 950 FCFA ≈ **1 900 FCFA**
- 3 mois (90 jours): 5 850 FCFA ≈ **5 500 FCFA**
- 1 an (365 jours): 23 725 FCFA ≈ **20 000 FCFA**

**Formule:**
```
Nombre de jours = Montant payé ÷ 65
```

**Exemple:**
```
Paiement de 2 000 FCFA
→ 2000 ÷ 65 = 30,77 jours
→ 30 jours validés
→ Reliquat: 50 FCFA conservé pour prochain paiement
```

**Calcul du statut:**
```javascript
jours_couverts = FLOOR(montant_total_paye / 65)
jours_restants = 365 - jours_couverts

if (jours_restants < 0) → statut = "en_avance"
if (jours_restants === 0) → statut = "a_jour"
if (jours_restants > 0) → statut = "en_arriere"
```

---

## 4. Types de paiement

### 4.1 Droit d'Accès (`droit_acces`)

**Quand:** Premier paiement uniquement
**Promotions:** Applicables
**Montant variable:** Selon la superficie et promotion active

**Données retournées:**
```json
{
  "type_paiement": "droit_acces",
  "montant_recommande": 165000,
  "promotion": {
    "nom": "Promo Lancement 2025",
    "reduction_pct": 33.33,
    "montant_unitaire": 20000
  }
}
```

---

### 4.2 Contribution Annuelle (`contribution_annuelle`)

**Quand:** Tous les paiements après le DA
**Promotions:** Non applicables
**Calcul:** Basé sur 65 FCFA/jour

**Données retournées:**
```json
{
  "type_paiement": "contribution_annuelle",
  "montant_recommande": 1900,
  "statut": "en_arriere"
}
```

---

## 5. Affichage côté Wave

### Informations à afficher AVANT validation:

```
─────────────────────────────────
  Informations Planteur
─────────────────────────────────
Nom: KOFFI Inocent
Téléphone: 0759566087
Superficie: 5.5 ha

─────────────────────────────────
  Type de Paiement
─────────────────────────────────
□ Droit d'Accès
  (ou)
□ Contribution Annuelle

─────────────────────────────────
  Détails du Paiement
─────────────────────────────────
Montant recommandé: 165 000 FCFA
Statut: À jour / En retard / En avance

[Si promotion active:]
Promotion: Promo Lancement 2025
Réduction: 33.33%
Économie: 50 000 FCFA

─────────────────────────────────
  Montant à payer
─────────────────────────────────
[Input modifiable] 165 000 FCFA

[Bouton Valider le paiement]
─────────────────────────────────
```

---

## 6. Gestion des erreurs

### Codes d'erreur HTTP:

| Code | Signification | Action recommandée |
|------|---------------|-------------------|
| 400 | Requête invalide | Vérifier les paramètres |
| 404 | Souscripteur non trouvé | Vérifier le numéro de téléphone |
| 409 | Transaction déjà enregistrée | Transaction en doublon |
| 500 | Erreur serveur | Réessayer plus tard |

---

## 7. Sécurité

### Authentification
Les endpoints sont publics mais loggés. Chaque requête est tracée avec:
- IP source
- Timestamp
- Données de la requête

### Validation
- Numéros de téléphone: Format ivoirien attendu
- Montants: Validation > 0
- Transaction ID: Unicité garantie

### Idempotence
L'endpoint de notification est idempotent:
- Même `transaction_id` = Refus (409)
- Évite les doublons de paiement

---

## 8. Tests

### Environnement de test

**Base URL Test:**
```
https://vschpokaogikpfayzxja.supabase.co/functions/v1
```

### Données de test:

**Souscripteur test (DA non payé):**
```
Téléphone: 0759566087
Nom: KOFFI Inocent
Superficie: 5.5 ha
Type paiement attendu: droit_acces
```

### Scénarios de test:

#### Test 1: Vérification DA
```bash
curl "https://vschpokaogikpfayzxja.supabase.co/functions/v1/wave-verification?telephone=0759566087"
```

#### Test 2: Notification DA
```bash
curl -X POST "https://vschpokaogikpfayzxja.supabase.co/functions/v1/wave-notification" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "TEST_TXN_001",
    "telephone": "0759566087",
    "montant": 165000,
    "type_paiement": "droit_acces"
  }'
```

#### Test 3: Vérification CA (après DA)
```bash
curl "https://vschpokaogikpfayzxja.supabase.co/functions/v1/wave-verification?telephone=0759566087"
# Devrait retourner type_paiement: "contribution_annuelle"
```

---

## 9. Monitoring et Logs

### Logs disponibles:
- Chaque requête est loggée avec timestamp
- Erreurs tracées avec détails
- Transactions enregistrées dans `paiements_wave`

### Accès aux logs:
Contactez l'équipe AgriCapital pour accès aux logs de production

---

## 10. Support technique

### Contact AgriCapital:
- Email: contact@agricapital.ci
- Téléphone: +225 07 59 56 60 87
- Support technique: Disponible 9h-17h (GMT)

### Délai de réponse:
- Incidents critiques: < 2h
- Questions techniques: < 24h
- Demandes d'évolution: < 72h

---

## 11. Changelog

### Version 1.0 (Janvier 2025)
- Implémentation initiale
- Endpoints vérification et notification
- Logique DA et CA
- Support promotions
- Calcul statuts automatique

---

## Annexes

### A. Exemple d'intégration complète

```javascript
// Exemple d'intégration côté Wave

// 1. Vérification avant paiement
async function verifierSouscripteur(telephone) {
  const response = await fetch(
    `https://vschpokaogikpfayzxja.supabase.co/functions/v1/wave-verification?telephone=${telephone}`
  );
  
  const data = await response.json();
  
  if (data.success) {
    // Afficher les informations
    afficherInfos(data);
    return data;
  } else {
    afficherErreur(data.error);
    return null;
  }
}

// 2. Notification après paiement
async function notifierPaiement(transactionId, telephone, montant, typePaiement) {
  const response = await fetch(
    'https://vschpokaogikpfayzxja.supabase.co/functions/v1/wave-notification',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction_id: transactionId,
        telephone: telephone,
        montant: montant,
        type_paiement: typePaiement,
        date_paiement: new Date().toISOString()
      })
    }
  );
  
  const data = await response.json();
  
  if (data.success) {
    afficherSucces('Paiement enregistré avec succès');
  } else {
    afficherErreur(data.error);
  }
}
```

### B. Format des dates

Toutes les dates utilisent le format ISO 8601:
```
2025-01-15T10:30:00Z
```

---

**Fin du document**
