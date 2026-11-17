---
sidebar_position: 3
title: "Référence API Admin du Gateway"
description: "Référence complète de l'API admin du STOA Gateway — contrats UAC, routes, politiques, skills, fédération, cache de prompts, circuit breakers, sessions, mTLS et quotas."
keywords:
  - gateway admin API
  - UAC contracts
  - API route management
  - skills management
  - federation
  - circuit breaker
  - cache management
  - quota management
---

# API Admin du Gateway

Référence complète des endpoints administratifs de `stoa-gateway` montés sous `/admin/*` (`stoa-gateway/src/handlers/admin/router.rs`). Ces endpoints sont utilisés par le Control Plane et les opérateurs pour gérer les contrats UAC, routes, politiques, skills, la fédération MCP, les caches et les diagnostics d'exécution.

## Authentification & Chaîne de Middlewares

Chaque route `/admin/*` traverse trois couches de middlewares (de la plus externe à la plus interne) :

1. **`admin_audit_log`** — Journalise tous les appels administratifs (y compris les rejets `429` et `401`)
2. **`admin_rate_limit`** — Limite les rafales de tentatives avant l'authentification
3. **`admin_auth`** — Valide l'en-tête `Authorization: Bearer <token>`

```bash
curl -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
  "${STOA_GATEWAY_URL}/admin/health"
```

| Réponse | Signification |
|---------|---------------|
| `200 OK` / `201 Created` / `204 No Content` | Authentifié, requête traitée |
| `401 Unauthorized` | `STOA_ADMIN_API_TOKEN` manquant/invalide (comparaison en temps constant), ou JWT OIDC administratif à authentification forte requis lorsque `strong_auth` est activé (`WWW-Authenticate: Bearer error="insufficient_user_authentication"`) |
| `429 Too Many Requests` | Limite de débit pré-authentification atteinte |
| `503 Service Unavailable` | API admin désactivée (`STOA_ADMIN_API_TOKEN` non défini ou vide — fail-closed) |

---

## Santé & Rechargement des Routes

### GET /admin/health

Retourne l'état du gateway et les compteurs de registres.

```bash
curl "${STOA_GATEWAY_URL}/admin/health" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}"
```

```json
{
  "status": "ok",
  "version": "0.12.0",
  "routes_count": 42,
  "policies_count": 15
}
```

### POST /admin/routes/reload

Déclenche un rechargement à chaud des routes dynamiques.

---

## Gestion des Contrats UAC

Les mutations de contrats (`stoa-gateway/src/handlers/admin/contracts.rs`) sont **transactionnelles** sur les trois registres en mémoire (`contract_registry`, `route_registry`, `tool_registry`) :

- **Upsert (`POST /admin/contracts`)** fonctionne en mode *bind-first* : les routes REST et les outils MCP sont générés avant l'écriture dans `contract_registry` (avec annulation en cas d'erreur).
- **Suppression (`DELETE /admin/contracts/:key`)** fonctionne en mode *unbind-first* : les deux désinscriptions doivent réussir avant la suppression du contrat.

### POST /admin/contracts

Enregistre ou met à jour un contrat UAC (`201 Created` à la création, `200 OK` à la mise à jour). L'option `"inboundAuth": "jwt"` active la validation JWT Keycloak sur la route REST générée (comme vérifié par `quickstart/verify.sh`) :

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/contracts" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "echo-service",
    "version": "1.0.0",
    "tenantId": "acme",
    "inboundAuth": "jwt",
    "bindings": {
      "rest": {
        "enabled": true,
        "pathPrefix": "/apis/acme/echo",
        "backendUrl": "http://backend:8080"
      },
      "mcp": {
        "enabled": true
      }
    },
    "endpoints": [
      {
        "path": "/get",
        "methods": ["GET"],
        "operationId": "echoGet"
      }
    ]
  }'
```

```json
{
  "key": "acme:echo-service:1.0.0",
  "status": "created",
  "routes_generated": 1,
  "tools_generated": 1,
  "llm_capabilities": []
}
```

### GET /admin/contracts

Liste tous les contrats UAC enregistrés.

### GET /admin/contracts/:key

Récupère un contrat par sa clé composite (`{tenant_id}:{name}:{version}`). Retourne `404` s'il est absent.

### DELETE /admin/contracts/:key

Retire les routes REST et outils MCP associés à `:key` puis supprime le contrat (`204 No Content` ou `404 Not Found`).

---

## Gestion des Routes API & Backends Proxy

### POST /admin/apis

Crée ou met à jour une route API bas niveau (`201 Created` ou `200 OK`).

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/apis" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
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

### GET /admin/apis

Liste toutes les routes API enregistrées.

### GET /admin/apis/:id

Récupère une route API par identifiant (`404 Not Found` si absente).

### DELETE /admin/apis/:id

Supprime une route API (`204 No Content` ou `404 Not Found`).

### GET /admin/api-proxy/backends

Liste les backends proxy API internes configurés et leur état (protégé par `admin_auth`).

---

## Gestion des Politiques & Identifiants

### POST /admin/policies

Crée ou met à jour une politique passerelle (`201 Created` ou `200 OK`).

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/policies" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
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

### GET /admin/policies

Liste toutes les politiques enregistrées.

### DELETE /admin/policies/:id

Supprime une politique (`204 No Content` ou `404 Not Found`).

### Identifiants Backend & Consommateur (BYOK)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/admin/backend-credentials` | `GET`, `POST` | Lister ou enregistrer des identifiants upstream BYOK par route |
| `/admin/backend-credentials/:route_id` | `DELETE` | Supprimer l'identifiant backend pour `:route_id` |
| `/admin/consumer-credentials` | `GET`, `POST` | Lister ou enregistrer des identifiants par consommateur |
| `/admin/consumer-credentials/:route_id/:consumer_id` | `DELETE` | Supprimer l'identifiant d'un consommateur |

---

## Gestion des Skills

Gère les skills d'injection de contexte hiérarchique (spécificité `global` < `tenant` < `tool` < `user`, alignée sur la [CRD `Skill`](/docs/reference/crds/skill)). Les chemins littéraux (`/status`, `/resolve`, `/sync`, `/health`) sont déclarés avant le chemin paramétrique `/skills/:id`.

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/admin/skills/status` | `GET` | État et compteurs du résolveur de skills |
| `/admin/skills/resolve` | `GET` | Prévisualiser les instructions résolues pour un contexte (`tenant`, `tool`, `user`) |
| `/admin/skills/sync` | `POST` | Déclencher une synchronisation des skills depuis le Control Plane |
| `/admin/skills` | `GET`, `POST` | Lister les skills ou créer/mettre à jour un skill (`201` ou `200`) |
| `/admin/skills/:id` | `GET`, `PUT`, `DELETE` | Consulter, modifier ou supprimer un skill par ID (**suppression canonique**) |
| `/admin/skills?key=<key>` | `DELETE` | **Déprécié** : suppression par paramètre de requête émettant les en-têtes `Deprecation` et `Sunset` ; privilégiez `DELETE /admin/skills/:id` |
| `/admin/skills/health` | `GET` | État de santé agrégé de tous les skills |
| `/admin/skills/:id/health` | `GET` | Métriques de santé d'un skill donné |
| `/admin/skills/:id/health/reset` | `POST` | Réinitialiser les compteurs d'erreur/santé de `:id` |

---

## Gestion de la Fédération MCP

Inspection et purge du cache des serveurs MCP fédérés (`stoa-gateway/src/handlers/admin/federation.rs`).

### GET /admin/federation/status

```json
{
  "enabled": true,
  "cache_size": 18,
  "cache_ttl_secs": 300
}
```

### GET /admin/federation/upstreams

Liste les serveurs MCP amont configurés (`url`, `transport`, `has_auth`, `timeout_secs` — aucun jeton secret n'est exposé).

### GET /admin/federation/cache

Retourne les statistiques du cache de fédération.

### DELETE /admin/federation/cache/:sub_account_id

Purge l'entrée de cache du sous-compte `:sub_account_id` et indique si une entrée existait (`invalidated: true | false`).

---

## Cache de Prompts & Routage LLM

### Cache de Prompts

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/admin/prompt-cache/stats` | `GET` | Statistiques hits/misses et nombre d'entrées |
| `/admin/prompt-cache/patterns` | `GET` | Lister les motifs en cache |
| `/admin/prompt-cache/get/:key` | `GET` | Consulter une entrée par clé |
| `/admin/prompt-cache/load` | `POST` | Précharger des entrées dans le cache de prompts |
| `/admin/prompt-cache/invalidate` | `POST` | Invalider des entrées du cache de prompts |

### Routage LLM

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/admin/llm/status` | `GET` | Statut et configuration active du routeur LLM |
| `/admin/llm/providers` | `GET` | Fournisseurs LLM configurés et état de santé |
| `/admin/llm/costs` | `GET` | Télémetrie agrégée des coûts et jetons LLM |

---

## Gestion des Circuit Breakers

### GET /admin/circuit-breaker/stats

Statistiques du circuit breaker principal Control Plane (`closed`, `open`, `half_open`).

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

### POST /admin/circuit-breaker/reset

Réinitialise le circuit breaker principal à l'état `closed`.

### GET /admin/circuit-breakers

Liste les circuit breakers par upstream.

### POST /admin/circuit-breakers/:name/reset

Réinitialise un circuit breaker upstream donné (`404` s'il est inconnu).

---

## Gestion du Cache

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

Vide immédiatement toutes les entrées du cache.

---

## Gestion des Sessions

### GET /admin/sessions/stats

Retourne les statistiques de suivi des sessions MCP.

```json
{
  "active_sessions": 42,
  "zombie_count": 2,
  "tracked_sessions": 44
}
```

---

## Configuration mTLS & Quotas

### GET /admin/mtls/config & GET /admin/mtls/stats

Consulte la configuration mTLS active (`trusted_proxies` masqué) et les compteurs de validation de certificats clients (`total_requests`, `cert_validated`, `cert_missing`, `cert_invalid`).

### GET /admin/quotas, GET /admin/quotas/:consumer_id & POST /admin/quotas/:consumer_id/reset

Consulte ou remet à zéro les compteurs quotidien et mensuel de quotas par consommateur.

---

## Diagnostics, Snapshots d'Erreurs, Tracing & Registre A2A

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/admin/diagnostic` | `GET` | Uptime passerelle, états des circuit breakers et statistiques de routes |
| `/admin/diagnostics/summary` | `GET` | Synthèse agrégée des diagnostics |
| `/admin/diagnostics/:request_id` | `GET` | Rapport de diagnostic détaillé pour une requête |
| `/admin/snapshots` | `GET`, `DELETE` | Lister ou purger les snapshots d'erreurs capturés |
| `/admin/snapshots/:request_id` | `GET` | Récupérer un snapshot d'erreur par identifiant de requête |
| `/admin/tracing/status` | `GET` | Statut de l'exportateur de traces distribuées OpenTelemetry |
| `/admin/a2a/agents` | `GET`, `POST` | Lister ou enregistrer des agents Agent-to-Agent (A2A) |
| `/admin/a2a/agents/:name` | `GET`, `DELETE` | Consulter ou désenregistrer un agent A2A |

*(Les endpoints internes `/admin/hegemon/*` et expérimentaux `/admin/ebpf/*` sont également montés derrière `admin_auth` pour la télémétrie interne.)*

---

## Sondes de Santé (Sans Authentification)

Les sondes Kubernetes de vivacité et de disponibilité sont servies hors `/admin` :

| Endpoint | Objectif |
|----------|----------|
| `GET /health` / `GET /health/live` | Sonde de vivacité — le processus passerelle est actif |
| `GET /ready` / `GET /health/ready` | Sonde de disponibilité fail-closed — vérifie les politiques signées, l'audience et le spool d'audit ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) |

## Voir Aussi

- [API MCP Gateway](/docs/api/mcp-gateway) — Endpoints JSON-RPC MCP et routes REST compagnons
- [API Control Plane](/docs/api/control-plane) — API centrale de gestion
- [Application des Quotas](/docs/reference/quotas) — Modèle et application des quotas
- [Permissions RBAC](/docs/reference/rbac-permissions) — Modèle de rôles et scopes
