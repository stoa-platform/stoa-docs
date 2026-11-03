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
  "display_name": "ACME Corp",
  "description": "Équipe paiements",
  "owner_email": "owner@example.com"
}
```

`name`, `display_name` et `owner_email` sont obligatoires. L'identifiant du tenant est dérivé de `name` (minuscules, espaces remplacés par des tirets). Le provisioning est asynchrone : interrogez `GET /tenants/{tenant_id}/provisioning-status`. La réponse renvoie le `display_name` fourni comme `name`.

**Réponse :**

```json
{
  "id": "acme",
  "name": "ACME Corp",
  "display_name": "ACME Corp",
  "owner_email": "owner@example.com",
  "status": "active",
  "provisioning_status": "pending",
  "created_at": "2025-01-09T10:00:00Z"
}
```

### Lister les Tenants

```http
GET /tenants
```

Retourne un tableau JSON simple, sans pagination. Les administrateurs plateforme voient tous les tenants ; les autres utilisateurs ne voient que leur propre tenant.

### Obtenir un Tenant

```http
GET /tenants/{tenant_id}
```

### Mettre à Jour un Tenant

```http
PUT /tenants/{tenant_id}
Content-Type: application/json

{
  "display_name": "ACME Corporation",
  "description": "Équipes paiements et facturation",
  "max_apis": 20
}
```

Tous les champs sont optionnels (`display_name`, `description`, `owner_email`, `max_apis`, `max_applications`) ; les champs omis restent inchangés.

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
  "display_name": "Payment API",
  "description": "API de traitement des paiements",
  "backend_url": "https://payments.internal.example.com",
  "version": "1.0.0",
  "tags": ["payments"]
}
```

`name`, `display_name` et `backend_url` sont obligatoires. `version` vaut `1.0.0` par défaut ; `openapi_spec` porte optionnellement le document OpenAPI sous forme de chaîne. L'identifiant de l'API est dérivé de `name`.

**Réponse :**

```json
{
  "id": "payment-api",
  "tenant_id": "acme",
  "name": "payment-api",
  "display_name": "Payment API",
  "version": "1.0.0",
  "backend_url": "https://payments.internal.example.com",
  "status": "draft",
  "created_at": null
}
```

### Lister les APIs

```http
GET /tenants/{tenant_id}/apis?page=1&page_size=20
```

Filtre `environment` optionnel (`dev`, `staging` ou `prod`). La réponse est une enveloppe de page avec `items`, `total`, `page` et `page_size`.

### Obtenir une API

```http
GET /tenants/{tenant_id}/apis/{api_id}
```

### Mettre à Jour une API

```http
PUT /tenants/{tenant_id}/apis/{api_id}
Content-Type: application/json

{
  "description": "API de traitement des paiements (nouveau backend)",
  "backend_url": "https://payments-v2.internal.example.com"
}
```

Seuls les champs fournis sont mis à jour (`display_name`, `version`, `description`, `backend_url`, `openapi_spec`, `tags`).

### Supprimer une API

```http
DELETE /tenants/{tenant_id}/apis/{api_id}
```

## Abonnements

Les abonnements sont une ressource de premier niveau sous `/subscriptions` ; ils ne sont pas imbriqués sous le tenant.

### Créer un Abonnement

```http
POST /subscriptions
Content-Type: application/json

{
  "application_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "application_name": "Mobile App",
  "api_id": "payment-api",
  "api_name": "Payment API",
  "api_version": "1.0.0",
  "tenant_id": "acme",
  "plan_id": "basic",
  "plan_name": "Basic Plan"
}
```

Retourne `201 Created`. Tous les champs sauf `plan_id` et `plan_name` sont obligatoires ; `application_id` est l'UUID d'une application existante. L'abonnement est renvoyé au statut `active` si aucun `plan_id` n'est fourni, si le plan n'exige pas d'approbation ou si l'appelant possède l'un des rôles d'approbation automatique du plan ; sinon il reste `pending` jusqu'à son approbation par un administrateur du tenant. L'accès utilise les client credentials OAuth2 de l'application, aucune clé API n'est émise.

**Réponse (abrégée, plan soumis à approbation) :**

```json
{
  "id": "0f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f",
  "application_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "api_id": "payment-api",
  "tenant_id": "acme",
  "status": "pending",
  "created_at": "2025-01-09T10:30:00Z"
}
```

### Lister les Abonnements

```http
GET /subscriptions/tenant/{tenant_id}?status=pending&page=1&page_size=20
```

Liste les abonnements d'un tenant ; accessible aux membres de ce tenant et aux administrateurs plateforme. Les filtres `status` et `environment` sont optionnels ; la réponse est paginée (`items`, `total`, `page`, `page_size`, `total_pages`). `GET /subscriptions/my` renvoie les abonnements de l'utilisateur appelant ; pour les administrateurs du tenant et les administrateurs plateforme, il renvoie tous les abonnements, pas seulement les leurs.

### Obtenir un Abonnement

```http
GET /subscriptions/{subscription_id}
```

### Approuver un Abonnement

```http
POST /subscriptions/{subscription_id}/approve
Content-Type: application/json

{
  "expires_at": "2025-12-31T23:59:59Z"
}
```

`expires_at` est optionnel. Nécessite le rôle administrateur du tenant ou administrateur plateforme.

### Révoquer un Abonnement

```http
POST /subscriptions/{subscription_id}/revoke
Content-Type: application/json

{
  "reason": "Violation des conditions d'utilisation"
}
```

`reason` est obligatoire. Un abonné annule son propre abonnement avec `DELETE /subscriptions/{subscription_id}` (retourne `204`).

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
