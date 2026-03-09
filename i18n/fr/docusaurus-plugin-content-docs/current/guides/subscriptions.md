---
sidebar_position: 3
title: "Abonnements aux APIs"
description: "Gérez l'accès aux APIs grâce au modèle d'abonnement de STOA — découverte en libre-service, workflows d'approbation et suivi d'utilisation."
keywords: [API subscriptions, access management, developer portal, API catalog]
---

# Abonnements aux APIs et aux Outils

Gérez l'accès aux APIs grâce au modèle d'abonnement.

## Vue d'ensemble

STOA implémente un modèle d'accès basé sur les abonnements :

- **Découverte en Libre-Service** - Parcourez les APIs/outils disponibles
- **Gestion des Abonnements** - Demandez et gérez les accès
- **Workflows d'Approbation** - Approbation manuelle ou automatique
- **Suivi d'Utilisation** - Surveillez l'utilisation des abonnements
- **Intégration de Facturation** - (À venir) Facturation à l'utilisation

## Modèle d'Abonnement

```
Utilisateur/App → S'abonner → API/Outil → Générer une Clé API → Accéder
```

## Catalogue d'API

### Parcourir les APIs Disponibles

```bash
# Lister toutes les APIs du catalogue
stoa catalog list --tenant acme

# Rechercher une API spécifique
stoa catalog search --query "payment"

# Obtenir les détails d'une API
stoa catalog get payment-api
```

### Entrée du Catalogue d'API

Chaque API comprend :

- **Nom & Description** - Ce que fait l'API
- **Version** - Version de l'API
- **Documentation** - Spec OpenAPI, guides
- **Endpoints** - Chemins disponibles
- **Niveau Tarifaire** - Gratuit, payant, etc.
- **Limites de Débit** - Quotas de requêtes
- **SLA** - Objectifs de disponibilité

## Cycle de Vie de l'Abonnement

### 1. Créer un Abonnement

```bash
# S'abonner à une API
stoa subscription create \
  --tenant acme \
  --api payment-api \
  --plan community \
  --app my-mobile-app

# La réponse inclut :
# - ID d'abonnement
# - Clé API (si auto-approuvée)
# - Statut (pending/active)
```

### 2. Approbation (si requise)

```bash
# Le propriétaire de l'API examine la demande d'abonnement
stoa subscription approve \
  --subscription-id sub-12345 \
  --rate-limit 1000/hour

# Ou rejeter
stoa subscription reject \
  --subscription-id sub-12345 \
  --reason "Invalid use case"
```

### 3. Gestion des Clés API

```bash
# Lister vos clés API
stoa apikey list --tenant acme

# Rotation de la clé API
stoa apikey rotate \
  --subscription-id sub-12345

# Révoquer une clé API
stoa apikey revoke \
  --key sk_live_abc123
```

### 4. Surveiller l'Utilisation

```bash
# Vérifier l'utilisation de l'abonnement
stoa subscription usage \
  --subscription-id sub-12345 \
  --period last-30-days

# Sortie :
# Requests: 45,231
# Errors: 23 (0.05%)
# P95 Latency: 124ms
# Quota Used: 45.2%
```

## Plans d'Abonnement

### Niveaux de Plans

| Plan | Auto-hébergé | SaaS Géré | Prix |
|------|-------------|--------------|-------|
| **Community** | Illimité, à vie | 1M requêtes/mois | Gratuit |
| **Enterprise** | N/A | Illimité + SLA personnalisé | Nous contacter |
| **Sovereign** | Option sur site | Infrastructure EU dédiée | Personnalisé |

:::info Licence Auto-hébergée
STOA est sous licence Apache 2.0. Les déploiements auto-hébergés de la version open-source sont gratuits sans frais de licence.
Nous monétisons les services gérés et le support enterprise.
:::

### Configurer un Plan

```bash
# Le propriétaire de l'API définit les plans d'abonnement
stoa api plan create \
  --api payment-api \
  --name enterprise \
  --rate-limit unlimited \
  --quota unlimited \
  --features "Custom SLA,Priority support,Webhook notifications"
```

## Portail Développeur

### Portail en Libre-Service

STOA fournit un portail web pour les développeurs :

- **Découverte d'API** - Parcourir le catalogue
- **Documentation Interactive** - Tester les endpoints
- **Gestion des Abonnements** - Créer/gérer les abonnements
- **Tableau de Bord d'Utilisation** - Visualiser les analytiques
- **Facturation** - Gérer les modes de paiement

Accédez au portail à : `https://portal.<YOUR_DOMAIN>/{tenant}`

### Configuration du Portail

```bash
# Personnaliser le portail développeur
stoa portal configure \
  --tenant acme \
  --logo https://acme.com/logo.png \
  --primary-color "#4F46E5" \
  --custom-domain portal.acme.com
```

## Clés API

### Types de Clés API

1. **Clés API Utilisateur** - Liées à un utilisateur individuel
2. **Clés d'Application** - Liées à une application/service
3. **Clés d'Environnement** - Clés séparées pour dev/staging/prod

### Format des Clés

```
sk_live_abc123xyz789...     # Production
sk_test_abc123xyz789...     # Sandbox/Test
```

### Utiliser les Clés API

```bash
# Dans l'en-tête de la requête
curl ${STOA_GATEWAY_URL}/acme/payment-api/charge \
  -H "X-API-Key: sk_live_abc123xyz789"

# Ou en paramètre de requête (non recommandé)
curl ${STOA_GATEWAY_URL}/acme/payment-api/charge?apikey=sk_live_abc123
```

## Webhooks

Abonnez-vous aux événements :

```bash
# Enregistrer un webhook pour les événements d'abonnement
stoa webhook create \
  --tenant acme \
  --url https://myapp.com/webhooks/stoa \
  --events subscription.created,subscription.cancelled \
  --secret whsec_abc123
```

### Événements Webhook

- `subscription.created` - Nouvel abonnement
- `subscription.approved` - Abonnement approuvé
- `subscription.cancelled` - Abonnement annulé
- `subscription.usage_threshold` - Avertissement de quota d'utilisation
- `apikey.rotated` - Clé API renouvelée
- `apikey.revoked` - Clé API révoquée

## Quotas d'Utilisation

### Appliquer des Quotas

```bash
# Définir des quotas d'utilisation
stoa subscription quota set \
  --subscription-id sub-12345 \
  --requests 50000/month \
  --bandwidth 10GB/month

# Vérifier le statut du quota
stoa subscription quota get \
  --subscription-id sub-12345
```

### Quota Dépassé

Lorsque le quota est dépassé :

- Réponse HTTP 429 (Too Many Requests)
- En-têtes `X-RateLimit-*` inclus
- Notification webhook envoyée
- Notification affichée dans le Portail

## Fonctionnalités Avancées

### Groupes d'Abonnements

Regroupez les abonnements pour des quotas partagés :

```bash
stoa subscription-group create \
  --tenant acme \
  --name mobile-apps \
  --shared-quota 100000/month
```

### Accès Conditionnel

Restreignez l'accès selon des conditions :

```bash
# Autoriser l'accès uniquement depuis des IPs spécifiques
stoa subscription acl add \
  --subscription-id sub-12345 \
  --allow-ips 203.0.113.0/24

# Restreindre à certains endpoints
stoa subscription scope set \
  --subscription-id sub-12345 \
  --allow-paths "/read/*,/list/*" \
  --deny-paths "/admin/*"
```

---

## Étapes Suivantes

- [Configuration de l'Authentification](/docs/guides/authentication) — Configurer SSO et OIDC
- [Référence API](/docs/api/control-plane) — Documentation API complète
- [Référence CLI](/docs/reference/cli) — Gérer les abonnements via CLI
- [FAQ](/docs/faq) — Questions fréquentes
