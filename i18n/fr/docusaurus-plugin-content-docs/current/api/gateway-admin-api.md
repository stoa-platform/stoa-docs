---
sidebar_position: 3
title: "Référence API Admin du Gateway"
description: "Référence complète de l'API admin du STOA Gateway — gestion des routes API, politiques, circuit breakers, cache, sessions, mTLS et quotas."
keywords:
  - gateway admin API
  - API route management
  - circuit breaker
  - cache management
  - quota management
---

# API Admin du Gateway

Référence complète des endpoints administratifs du STOA Gateway. Ces endpoints sont utilisés par le Control Plane pour gérer les routes, les politiques et l'état d'exécution.

## Authentification

Tous les endpoints `/admin/*` nécessitent un Bearer token configuré comme token admin du gateway :

```bash
curl -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${STOA_GATEWAY_URL}/admin/health"
```

| Réponse | Signification |
|---------|---------------|
| `200 OK` | Authentifié, requête traitée |
| `401 Unauthorized` | Token admin manquant ou invalide |
| `503 Service Unavailable` | API admin désactivée (aucun token configuré) |

---

## Santé

### GET /admin/health

Retourne le statut et les statistiques du gateway.

```bash
curl "${STOA_GATEWAY_URL}/admin/health" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

```json
{
  "status": "ok",
  "version": "0.12.0",
  "routes_count": 42,
  "policies_count": 15
}
```

---

## Gestion des Routes API

### POST /admin/apis

Créer ou mettre à jour une route API (upsert).

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/apis" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "api-123",
    "name": "payments",
    "tenant_id": "acme",
    "path_prefix": "/apis/acme/payments",
    "backend_url": "https://api.example.com",
    "methods": ["GET", "POST", "PUT"],
    "spec_hash": "abc123def456",
    "activated": true
  }'
```

| Statut | Signification |
|--------|---------------|
| `201 Created` | Nouvelle route créée |
| `200 OK` | Route existante mise à jour |

### GET /admin/apis

Lister toutes les routes API enregistrées.

```json
[
  {
    "id": "api-123",
    "name": "payments",
    "tenant_id": "acme",
    "path_prefix": "/apis/acme/payments",
    "backend_url": "https://api.example.com",
    "methods": ["GET", "POST"],
    "spec_hash": "abc123",
    "activated": true
  }
]
```

### GET /admin/apis/:id

Obtenir une route API par son identifiant. Retourne `404 Not Found` si la route n'existe pas.

### DELETE /admin/apis/:id

Supprimer une route API. Retourne `204 No Content` en cas de succès, `404 Not Found` si absente. La suppression est idempotente — supprimer une route inexistante est sans effet.

---

## Gestion des Politiques

### POST /admin/policies

Créer ou mettre à jour une politique (upsert). Les politiques appliquent des limites de débit, du CORS et d'autres règles aux routes API.

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/policies" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "policy-123",
    "name": "rate-limit-gold",
    "policy_type": "rate_limit",
    "config": {
      "limit": 1000,
      "window_secs": 60
    },
    "priority": 1,
    "api_id": "api-123"
  }'
```

| Statut | Signification |
|--------|---------------|
| `201 Created` | Nouvelle politique créée |
| `200 OK` | Politique existante mise à jour |

### GET /admin/policies

Lister toutes les politiques.

### DELETE /admin/policies/:id

Supprimer une politique. Retourne `204 No Content` ou `404 Not Found`.

---

## Gestion des Circuit Breakers

Le gateway utilise des circuit breakers pour se protéger contre les défaillances des backends. Quand un backend échoue de manière répétée, le circuit s'ouvre et les requêtes sont rejetées immédiatement plutôt que d'attendre des délais d'expiration.

### GET /admin/circuit-breaker/stats

Obtenir les statistiques du circuit breaker principal (connexion à l'API Control Plane).

```json
{
  "name": "cp-api-breaker",
  "state": "closed",
  "success_count": 1234,
  "failure_count": 5,
  "consecutive_failures": 0,
  "open_count": 2,
  "rejected_count": 0
}
```

| État | Signification |
|------|---------------|
| `closed` | Fonctionnement normal — les requêtes passent |
| `open` | Backend défaillant — requêtes rejetées immédiatement |
| `half_open` | Test de récupération — requêtes limitées autorisées |

### POST /admin/circuit-breaker/reset

Réinitialiser le circuit breaker principal à l'état `closed`.

```json
{
  "status": "ok",
  "message": "Circuit breaker reset to closed"
}
```

### GET /admin/circuit-breakers

Lister tous les circuit breakers par upstream (un par URL backend).

### POST /admin/circuit-breakers/:name/reset

Réinitialiser un circuit breaker upstream spécifique. Retourne `404` si le circuit breaker nommé n'existe pas.

---

## Gestion du Cache

Le gateway met en cache les validations de clés API et les réponses des outils pour réduire la latence.

### GET /admin/cache/stats

```json
{
  "hits": 523,
  "misses": 127,
  "entry_count": 45,
  "hit_rate": 0.804
}
```

### POST /admin/cache/clear

Vider toutes les entrées du cache. À utiliser après les rotations de clés ou les modifications de politiques nécessitant un effet immédiat.

```json
{
  "status": "ok",
  "message": "Cache cleared"
}
```

---

## Gestion des Sessions

Les sessions SSE pour les connexions au protocole MCP sont suivies par le gateway.

### GET /admin/sessions/stats

```json
{
  "active_sessions": 42,
  "zombie_count": 2,
  "tracked_sessions": 44
}
```

| Champ | Description |
|-------|-------------|
| `active_sessions` | Sessions avec activité récente |
| `zombie_count` | Sessions dépassant le TTL, en attente de nettoyage |
| `tracked_sessions` | Total des sessions en mémoire |

---

## Configuration mTLS

### GET /admin/mtls/config

Obtenir la configuration mTLS actuelle.

```json
{
  "enabled": true,
  "require_client_cert": true,
  "trusted_proxies": "[redacted]"
}
```

### GET /admin/mtls/stats

Obtenir les statistiques de validation mTLS.

```json
{
  "total_requests": 1000,
  "cert_validated": 950,
  "cert_missing": 30,
  "cert_invalid": 20
}
```

---

## Gestion des Quotas

### GET /admin/quotas

Lister les statistiques de quota pour tous les consumers.

```json
[
  {
    "consumer_id": "user-123",
    "daily_count": 450,
    "daily_limit": 1000,
    "monthly_count": 12500,
    "monthly_limit": 50000,
    "daily_remaining": 550,
    "monthly_remaining": 37500
  }
]
```

### GET /admin/quotas/:consumer_id

Obtenir les statistiques de quota pour un consumer spécifique. Retourne `404` si le consumer n'a pas de données de quota.

### POST /admin/quotas/:consumer_id/reset

Réinitialiser les compteurs de quota d'un consumer (compteurs quotidien et mensuel remis à zéro).

```json
{
  "status": "ok",
  "message": "Quota reset for consumer 'user-123'"
}
```

---

## Sondes de Santé

Ces endpoints sont destinés aux sondes de vivacité et de disponibilité Kubernetes (aucune authentification requise) :

| Endpoint | Objectif |
|----------|---------|
| `GET /health/ready` | Sonde de disponibilité — le gateway peut traiter le trafic |
| `GET /health/live` | Sonde de vivacité — le processus gateway est actif |

---

## Récapitulatif des Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/admin/health` | GET | Santé et statistiques du gateway |
| `/admin/apis` | POST | Créer/mettre à jour une route API |
| `/admin/apis` | GET | Lister toutes les routes API |
| `/admin/apis/:id` | GET | Obtenir une route API |
| `/admin/apis/:id` | DELETE | Supprimer une route API |
| `/admin/policies` | POST | Créer/mettre à jour une politique |
| `/admin/policies` | GET | Lister toutes les politiques |
| `/admin/policies/:id` | DELETE | Supprimer une politique |
| `/admin/circuit-breaker/stats` | GET | Statistiques du CB principal |
| `/admin/circuit-breaker/reset` | POST | Réinitialiser le CB principal |
| `/admin/circuit-breakers` | GET | Lister les CBs par upstream |
| `/admin/circuit-breakers/:name/reset` | POST | Réinitialiser un CB spécifique |
| `/admin/cache/stats` | GET | Statistiques du cache |
| `/admin/cache/clear` | POST | Vider tout le cache |
| `/admin/sessions/stats` | GET | Statistiques des sessions SSE |
| `/admin/mtls/config` | GET | Configuration mTLS |
| `/admin/mtls/stats` | GET | Statistiques mTLS |
| `/admin/quotas` | GET | Lister les quotas des consumers |
| `/admin/quotas/:consumer_id` | GET | Obtenir le quota d'un consumer |
| `/admin/quotas/:consumer_id/reset` | POST | Réinitialiser le quota d'un consumer |
| `/health/ready` | GET | Sonde de disponibilité K8s |
| `/health/live` | GET | Sonde de vivacité K8s |

## Voir Aussi

- [API MCP Gateway](/docs/api/mcp-gateway) — Endpoints du protocole MCP
- [API Control Plane](/docs/api/control-plane) — API de gestion
- [Application des Quotas](/docs/reference/quotas) — Modèle et application des quotas
- [Permissions RBAC](/docs/reference/rbac-permissions) — Contrôle d'accès
