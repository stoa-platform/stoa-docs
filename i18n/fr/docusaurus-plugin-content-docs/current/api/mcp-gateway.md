---
sidebar_position: 2
title: "Référence API MCP Gateway : Découverte et Invocation d'Outils"
description: "Référence de l'API MCP Gateway — transport SSE, découverte d'outils, invocation, découverte OAuth 2.1 et protocole JSON-RPC."
keywords: [MCP, Model Context Protocol, API, gateway, AI agents, SSE, JSON-RPC, OAuth 2.1]
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# API MCP Gateway

Référence complète des endpoints MCP du STOA Gateway.

<EnvSetup />

## Vue d'Ensemble

Le STOA Gateway implémente la spécification [Model Context Protocol](https://modelcontextprotocol.io) (MCP). La version supportée la plus récente, `2025-11-25`, est la version par défaut ; `2025-03-26` et `2024-11-05` restent supportées pour la compatibilité ascendante.

Deux modes d'accès :

| Mode | Transport | Cas d'usage |
|------|-----------|-------------|
| **REST** | HTTP GET/POST | Scripts, intégrations simples, appels ponctuels |
| **Protocole MCP** | SSE (JSON-RPC) | Agents IA, streaming, sessions |

## Authentification

Tous les endpoints (sauf la découverte) nécessitent un Bearer token JWT depuis Keycloak :

```bash
# Obtenir un token
TOKEN=$(curl -s -X POST "${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token" \
  -d "client_id=my-app" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# Utiliser le token
curl -X POST "${STOA_GATEWAY_URL}/mcp/tools/list" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Endpoints publics (aucune authentification requise) : `initialize`, `ping` et la découverte OAuth.

---

## Endpoints REST

Endpoints HTTP simples pour les opérations sur les outils. La famille d'endpoints REST est `/mcp/tools/*` : elle reprend les formats de requête et de réponse des méthodes MCP `tools/list` et `tools/call`, et passe par le même pipeline d'exécution (auth, politiques, métrologie).

| Opération | Endpoint | Champ nom de l'outil |
|-----------|----------|----------------------|
| Lister les outils | `POST /mcp/tools/list` | — |
| Invoquer un outil | `POST /mcp/tools/call` | `name` |

:::note Alias hérités
Le gateway route encore `GET /mcp/v1/tools` et `POST /mcp/v1/tools/invoke` pour d'anciens clients de démonstration. Ils délèguent au même pipeline que `/mcp/tools/call`. Utilisez `/mcp/tools/list` et `/mcp/tools/call` pour les nouvelles intégrations.
:::

### Lister les Outils {#lister-les-outils}

```http
POST /mcp/tools/list
Authorization: Bearer <token>
Content-Type: application/json

{}
```

**Réponse** (`next_cursor` n'est présent qu'en cas de pagination) :

```json
{
  "tools": [
    {
      "name": "get-weather",
      "description": "Returns current weather for a given city",
      "inputSchema": {
        "type": "object",
        "properties": {
          "q": { "type": "string", "description": "City name" }
        },
        "required": ["q"]
      },
      "annotations": {
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true,
        "openWorldHint": true
      }
    }
  ]
}
```

### Invoquer un Outil {#invoquer-un-outil}

```http
POST /mcp/tools/call
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "get-weather",
  "arguments": { "q": "Paris" }
}
```

**Réponse :**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"location\":{\"name\":\"Paris\"},\"current\":{\"temp_c\":12.0}}"
    }
  ],
  "isError": false
}
```

---

## Endpoints du Protocole MCP (JSON-RPC sur SSE)

Conformité complète à la spécification MCP via le transport Server-Sent Events.

### Initialiser une Session

Handshake avec négociation de version du protocole :

```http
POST /mcp/sse
Authorization: Bearer <token>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "tools": {}
    },
    "clientInfo": {
      "name": "my-agent",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

**Réponse :**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "tools": { "listChanged": true },
      "tokenOptimization": {
        "supported": true,
        "levels": ["none", "moderate", "aggressive"]
      },
      "elicitation": {}
    },
    "serverInfo": {
      "name": "STOA Gateway",
      "version": "<gateway-version>"
    }
  },
  "id": 1
}
```

Négociation de version : le gateway lit `params.protocolVersion` ; une valeur supportée est renvoyée telle quelle, tandis qu'une valeur inconnue ou absente retombe sur la version par défaut `2025-11-25`. Versions supportées : `2025-11-25`, `2025-03-26`, `2024-11-05`.

### Lister les Outils (JSON-RPC)

```http
POST /mcp/sse
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

### Appeler un Outil (JSON-RPC)

```http
POST /mcp/sse
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get-weather",
    "arguments": { "q": "London" }
  },
  "id": 3
}
```

### Requêtes Batch (MCP 2025-03-26)

Envoyer plusieurs requêtes JSON-RPC en un seul appel :

```http
POST /mcp/sse
Content-Type: application/json

[
  {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { "name": "get-weather", "arguments": { "q": "Paris" } },
    "id": 1
  },
  {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { "name": "get-weather", "arguments": { "q": "London" } },
    "id": 2
  }
]
```

Toutes les requêtes sont traitées de manière concurrente. La réponse est un tableau de résultats JSON-RPC.

### Ping

```http
POST /mcp/sse
Content-Type: application/json

{ "jsonrpc": "2.0", "method": "ping", "id": 99 }
```

### Fermer une Session

```http
DELETE /mcp/sse?sessionId=<session-id>
```

### Flux SSE (Héritage)

```http
GET /mcp/sse?sessionId=<session-id>
```

Ouvre une connexion SSE persistante pour les réponses en streaming.

### Méthodes JSON-RPC Supportées

| Méthode | Auth Requise | Description |
|---------|-------------|-------------|
| `initialize` | Non | Handshake + négociation de version |
| `ping` | Non | Maintien de connexion |
| `notifications/initialized` | Non | Accusé de réception client (sans réponse) |
| `tools/list` | Oui | Lister les outils disponibles |
| `tools/call` | Oui | Exécuter un outil |
| `resources/list` | Oui | Lister les ressources (retourne `[]`) |

---

## Endpoints de Découverte

### Découverte du Serveur MCP

```http
GET /mcp
```

Retourne les métadonnées du serveur : nom, version, version du protocole, endpoints disponibles.

### Capacités MCP

```http
GET /mcp/capabilities
```

Retourne des informations détaillées sur les capacités, y compris les fonctionnalités supportées.

### Santé MCP

```http
GET /mcp/health
```

Retourne la santé spécifique MCP : nombre d'outils, sessions actives, statut.

---

## Découverte OAuth 2.1

STOA implémente la découverte OAuth 2.1 selon la RFC 9728, permettant aux agents IA de s'authentifier automatiquement.

### Métadonnées de la Ressource Protégée (RFC 9728)

```http
GET /.well-known/oauth-protected-resource
```

```json
{
  "resource": "https://mcp.<YOUR_DOMAIN>",
  "authorization_servers": ["https://auth.<YOUR_DOMAIN>/realms/stoa"],
  "scopes_supported": ["stoa:read", "stoa:write", "stoa:execute"]
}
```

### Métadonnées du Serveur d'Autorisation (RFC 8414)

```http
GET /.well-known/oauth-authorization-server
```

### Découverte OpenID Connect

```http
GET /.well-known/openid-configuration
```

### Proxy de Token

```http
POST /oauth/token
```

Proxy transparent vers l'endpoint de token Keycloak. Permet aux agents IA d'obtenir des tokens sans connaître l'URL de Keycloak.

### Enregistrement Dynamique de Client

```http
POST /oauth/register
```

Proxy vers l'endpoint DCR de Keycloak pour l'enregistrement automatique de clients.

---

## Pipeline d'Exécution

Chaque invocation d'outil passe par ce pipeline :

```mermaid
graph TD
    A[Requête] --> B[Auth JWT]
    B --> C[Vérification Rate Limit]
    C --> D[Évaluation Politique OPA]
    D --> E[Exécution Outil]
    E --> F[Metering Kafka]
    F --> G[Réponse]
    B -->|401| H[Non Autorisé]
    C -->|429| I[Limite Atteinte]
    D -->|403| J[Politique Refusée]
```

1. **Auth JWT** — Bearer token validé contre les JWKS de Keycloak
2. **Rate Limit** — Vérification du quota par consumer (si configuré)
3. **Politique OPA** — Contrôle d'accès basé sur les rôles avec scopes
4. **Exécution d'outil** — Appel HTTP vers l'endpoint backend
5. **Metering Kafka** — Événement émis pour l'analytique (optionnel, géré par feature flag)

### Correspondance des Scopes RBAC

| Rôle | Scopes |
|------|--------|
| `cpi-admin` | `admin`, `read`, `write`, `execute`, `deploy`, `audit` |
| `tenant-admin` | `read`, `write`, `execute` |
| `devops` | `read`, `write`, `deploy` |
| `viewer` | `read` |

---

## Optimisation des Tokens

Réduire la consommation de tokens LLM avec l'en-tête `X-Token-Optimization` :

```bash
curl -X POST "${STOA_GATEWAY_URL}/mcp/tools/call" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Token-Optimization: aggressive" \
  -H "Content-Type: application/json" \
  -d '{"name": "get-weather", "arguments": {"q": "Paris"}}'
```

| Niveau | Effet |
|--------|-------|
| `none` | Réponse complète (par défaut) |
| `moderate` | Suppression des champs redondants |
| `aggressive` | Réponse minimale, optimisée pour le contexte LLM |

---

## Gestion des Sessions

Les sessions SSE ont un TTL configurable (par défaut : 30 minutes). Les sessions sont automatiquement nettoyées par une tâche de fond.

### Statistiques des Sessions (Admin)

Les statistiques de sessions sont exposées par l'API d'administration : voir [`GET /admin/sessions/stats`](/docs/api/gateway-admin-api#get-adminsessionsstats) dans la référence de l'API Admin du Gateway.

---

## Réponses d'Erreur

### Erreurs d'outil (REST)

Les rejets et échecs d'exécution du gateway sur `/mcp/tools/list` et `/mcp/tools/call` renvoient un statut HTTP hors 2xx avec un corps de résultat d'outil contenant `isError: true`. Le tableau ci-dessous concerne ces échecs HTTP après le contrôle JWT ; les erreurs d'authentification utilisent un corps différent (voir ci-dessous) :

```json
{
  "content": [
    { "type": "text", "text": "Tool 'unknown-tool' not found" }
  ],
  "isError": true
}
```

| Statut | Cause |
|--------|-------|
| `400` | Requête rejetée avant exécution |
| `403` | Appel d'outil rejeté par une politique ou par les permissions |
| `404` | Nom d'outil introuvable pour le tenant de l'appelant |
| `429` | Limite de débit ou quota dépassé |
| `500` | Échec de l'exécution de l'outil |
| `503` | Une dépendance requise est indisponible |

Un outil peut aussi signaler une erreur applicative dans un résultat terminé, par exemple une réponse GraphQL en erreur. Dans ce cas, `/mcp/tools/call` renvoie **HTTP 200 avec `isError: true`**. Les clients doivent vérifier `isError` même lorsque la requête HTTP réussit.

### Erreurs d'authentification

Les requêtes rejetées par le contrôle JWT sur `/mcp/tools/*` n'atteignent jamais le handler d'outil. Leurs corps utilisent `error` et `message`, sans les champs `content` et `isError` d'un résultat d'outil.

L'absence d'en-tête Authorization renvoie `401` avec `WWW-Authenticate: Bearer resource_metadata="/.well-known/oauth-protected-resource"` et ce corps :

```json
{
  "error": "unauthorized",
  "message": "Missing Authorization header"
}
```

Un en-tête Authorization malformé ou un jeton invalide renvoie aussi `401`, avec `error: "unauthorized"` et un `message` décrivant l'échec (par exemple, `Malformed Authorization header` ou `Token expired`). Ces réponses ajoutent `error="invalid_token"` au challenge :

```http
WWW-Authenticate: Bearer error="invalid_token", resource_metadata="/.well-known/oauth-protected-resource"
```

Un jeton rejeté en raison de l'absence d'un claim de tenant requis renvoie `403`, sans en-tête `WWW-Authenticate`, avec ce corps :

```json
{
  "error": "forbidden",
  "message": "A tenant claim is required"
}
```

### Erreurs JSON-RPC

Sur le transport du protocole MCP, les erreurs de protocole et les appels d'outil rejetés utilisent l'objet `error` de JSON-RPC 2.0. Un `tools/call` rejeté passe par le même pipeline que `POST /mcp/tools/call` : le message est `Tool call rejected`, et `data` porte le statut HTTP (`httpStatus`) et le corps d'erreur REST (`result`) :

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Tool call rejected",
    "data": {
      "httpStatus": 404,
      "result": {
        "content": [
          { "type": "text", "text": "Tool 'unknown-tool' not found" }
        ],
        "isError": true
      }
    }
  },
  "id": 3
}
```

| Statut HTTP de l'appel d'outil | `code` JSON-RPC |
|--------------------------------|-----------------|
| `400`, `401`, `403`, `503` | `-32001` |
| `404` | `-32601` |
| `429` | `-32029` |
| Autre | `-32603` |

Pour `400` et `503`, `data` porte `requestId` à la place de `httpStatus` et `result`.

Une erreur applicative d'outil renvoyée avec HTTP 200 reste dans le champ `result` JSON-RPC, avec `isError: true` ; elle ne devient pas une erreur `Tool call rejected`. Les clients doivent vérifier `result.isError` :

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      { "type": "text", "text": "GraphQL endpoint returned an error" }
    ],
    "isError": true
  },
  "id": 3
}
```

---

## Exemples

### Client Python

```python
import os
import requests

STOA_AUTH_URL = os.environ['STOA_AUTH_URL']
STOA_GATEWAY_URL = os.environ['STOA_GATEWAY_URL']

# Authentification
auth = requests.post(
    f'{STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token',
    data={
        'client_id': 'my-app',
        'client_secret': os.environ['STOA_CLIENT_SECRET'],
        'grant_type': 'client_credentials'
    }
)
token = auth.json()['access_token']

# Invoquer un outil
response = requests.post(
    f'{STOA_GATEWAY_URL}/mcp/tools/call',
    headers={'Authorization': f'Bearer {token}'},
    json={'name': 'get-weather', 'arguments': {'q': 'Paris'}}
)

result = response.json()
print(result['content'][0]['text'])
```

### Client JavaScript

```javascript
const STOA_GATEWAY_URL = process.env.STOA_GATEWAY_URL;

const response = await fetch(`${STOA_GATEWAY_URL}/mcp/tools/call`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'get-weather',
    arguments: { q: 'Paris' }
  })
});

const result = await response.json();
console.log(result.content[0].text);
```

---

## Voir Aussi

- [Démarrer avec MCP](/docs/guides/mcp-getting-started) — Tutoriel pratique
- [Développement d'Outils MCP](/docs/guides/mcp-tools-development) — Créer des outils personnalisés
- [Fiche Protocole MCP](/docs/guides/fiches/mcp-protocol) — Approfondissement du protocole
- [Référence CRD](/docs/reference/crds/) — Spécifications Tool et ToolSet
