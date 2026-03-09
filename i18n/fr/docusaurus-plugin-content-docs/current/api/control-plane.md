---
sidebar_position: 1
title: "Référence REST API du Control Plane"
description: "Référence REST API du Control Plane STOA — gérez tenants, APIs, outils, abonnements, webhooks et opérations gateway via des endpoints documentés OpenAPI"
keywords: [API reference, REST API, control plane, OpenAPI]
---

# API du Control Plane

Référence de l'API REST du Control Plane STOA.

## Spécification OpenAPI

La spécification OpenAPI 3.1 complète est disponible :

- **JSON** : [openapi.json](https://raw.githubusercontent.com/stoa-platform/stoa/main/apis/control-plane-api/openapi.json)
- **Swagger UI** : `${STOA_API_URL}/docs`
- **ReDoc** : `${STOA_API_URL}/redoc`

Importez dans votre client API favori (Postman, Insomnia, Bruno) :

```bash
# Télécharger la spec
curl -o openapi.json https://raw.githubusercontent.com/stoa-platform/stoa/main/apis/control-plane-api/openapi.json
```

## URL de Base

```
${STOA_API_URL}/v1
```

:::tip Configurez votre environnement
```bash
export STOA_API_URL="https://api.gostoa.dev"   # Remplacez par votre domaine
export STOA_AUTH_URL="https://auth.gostoa.dev"  # Fournisseur OIDC Keycloak
```
Auto-hébergé ? Remplacez `gostoa.dev` par votre domaine.
:::

## Authentification

Toutes les requêtes API nécessitent une authentification :

```bash
Authorization: Bearer <access_token>
```

Obtenez un token d'accès depuis Keycloak :

```bash
curl -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token \
  -d "client_id=control-plane-api" \
  -d "client_secret=${STOA_CLIENT_SECRET}" \
  -d "grant_type=client_credentials"
```

## Tenants

### Créer un Tenant

```http
POST /tenants
Content-Type: application/json

{
  "name": "acme",
  "tier": "starter",
  "admin_email": "admin@acme.com",
  "region": "us-east-1"
}
```

**Réponse :**

```json
{
  "id": "ten-abc123",
  "name": "acme",
  "tier": "starter",
  "status": "provisioning",
  "gateway_url": "https://gateway.<VOTRE_DOMAINE>/acme",
  "created_at": "2025-01-09T10:00:00Z"
}
```

### Lister les Tenants

```http
GET /tenants?page=1&limit=20
```

### Obtenir un Tenant

```http
GET /tenants/{tenant_id}
```

### Mettre à Jour un Tenant

```http
PATCH /tenants/{tenant_id}
Content-Type: application/json

{
  "tier": "business",
  "settings": {
    "rate_limit_multiplier": 2.0
  }
}
```

### Supprimer un Tenant

```http
DELETE /tenants/{tenant_id}
```

## APIs

### Enregistrer une API

```http
POST /tenants/{tenant_id}/apis
Content-Type: application/json

{
  "name": "payment-api",
  "description": "API de traitement des paiements",
  "upstream_url": "https://api.payments.example.com",
  "path": "/payments",
  "version": "v1",
  "auth_required": true,
  "rate_limit": {
    "requests_per_hour": 1000
  }
}
```

**Réponse :**

```json
{
  "id": "api-xyz789",
  "name": "payment-api",
  "public_url": "https://gateway.<VOTRE_DOMAINE>/acme/payments",
  "status": "active",
  "created_at": "2025-01-09T10:15:00Z"
}
```

### Lister les APIs

```http
GET /tenants/{tenant_id}/apis
```

### Obtenir une API

```http
GET /tenants/{tenant_id}/apis/{api_id}
```

### Mettre à Jour une API

```http
PATCH /tenants/{tenant_id}/apis/{api_id}
Content-Type: application/json

{
  "rate_limit": {
    "requests_per_hour": 2000
  }
}
```

### Supprimer une API

```http
DELETE /tenants/{tenant_id}/apis/{api_id}
```

## Abonnements

### Créer un Abonnement

```http
POST /tenants/{tenant_id}/subscriptions
Content-Type: application/json

{
  "api_id": "api-xyz789",
  "plan": "standard",
  "application": "mobile-app",
  "callback_url": "https://myapp.com/webhook"
}
```

**Réponse :**

```json
{
  "id": "sub-12345",
  "api_id": "api-xyz789",
  "status": "pending_approval",
  "api_key": null,
  "created_at": "2025-01-09T10:30:00Z"
}
```

### Lister les Abonnements

```http
GET /tenants/{tenant_id}/subscriptions
```

### Obtenir un Abonnement

```http
GET /tenants/{tenant_id}/subscriptions/{subscription_id}
```

### Approuver un Abonnement

```http
POST /tenants/{tenant_id}/subscriptions/{subscription_id}/approve
Content-Type: application/json

{
  "rate_limit": 1000,
  "quota": 50000
}
```

### Révoquer un Abonnement

```http
DELETE /tenants/{tenant_id}/subscriptions/{subscription_id}
```

## Clés API

### Lister les Clés API

```http
GET /tenants/{tenant_id}/apikeys
```

### Créer une Clé API

```http
POST /tenants/{tenant_id}/apikeys
Content-Type: application/json

{
  "subscription_id": "sub-12345",
  "name": "Clé Production",
  "expires_at": "2026-01-09T00:00:00Z"
}
```

### Effectuer la Rotation d'une Clé API

```http
POST /tenants/{tenant_id}/apikeys/{key_id}/rotate
```

### Révoquer une Clé API

```http
DELETE /tenants/{tenant_id}/apikeys/{key_id}
```

## Métriques

### Obtenir les Métriques d'un Tenant

```http
GET /tenants/{tenant_id}/metrics
  ?start_date=2025-01-01
  &end_date=2025-01-31
  &granularity=day
```

**Réponse :**

```json
{
  "metrics": [
    {
      "date": "2025-01-09",
      "requests": 45231,
      "errors": 23,
      "p50_latency_ms": 87,
      "p95_latency_ms": 234,
      "p99_latency_ms": 456
    }
  ]
}
```

### Obtenir les Métriques d'une API

```http
GET /tenants/{tenant_id}/apis/{api_id}/metrics
```

### Obtenir l'Utilisation d'un Abonnement

```http
GET /tenants/{tenant_id}/subscriptions/{subscription_id}/usage
```

## Webhooks

### Créer un Webhook

```http
POST /tenants/{tenant_id}/webhooks
Content-Type: application/json

{
  "url": "https://myapp.com/webhooks/stoa",
  "events": [
    "subscription.created",
    "subscription.approved"
  ],
  "secret": "whsec_abc123"
}
```

### Lister les Webhooks

```http
GET /tenants/{tenant_id}/webhooks
```

### Supprimer un Webhook

```http
DELETE /tenants/{tenant_id}/webhooks/{webhook_id}
```

## Réponses d'Erreur

Format d'erreur standard :

```json
{
  "error": {
    "code": "validation_error",
    "message": "Paramètres de requête invalides",
    "details": [
      {
        "field": "tier",
        "message": "Valeur de tier invalide"
      }
    ]
  }
}
```

### Codes d'Erreur

| Code | Statut HTTP | Description |
|------|-------------|-------------|
| `validation_error` | 400 | Données de requête invalides |
| `unauthorized` | 401 | Token manquant ou invalide |
| `forbidden` | 403 | Permissions insuffisantes |
| `not_found` | 404 | Ressource introuvable |
| `conflict` | 409 | La ressource existe déjà |
| `rate_limited` | 429 | Trop de requêtes |
| `internal_error` | 500 | Erreur serveur |

## Limites de Débit

L'API du Control Plane a des limites de débit :

- **Tier Gratuit** : 100 requêtes/heure
- **Starter** : 1 000 requêtes/heure
- **Business** : 10 000 requêtes/heure
- **Entreprise** : Personnalisé

En-têtes inclus dans la réponse :

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1673276400
```

---

🚧 **Prochainement** : API WebSocket et opérations en masse.
