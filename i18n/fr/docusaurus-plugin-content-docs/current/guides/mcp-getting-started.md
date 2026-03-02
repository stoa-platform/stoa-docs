---
sidebar_position: 9
title: "MCP Premiers Pas : Votre premier outil IA en 5 minutes"
description: "Guide pas à pas pour déployer votre premier outil MCP sur STOA — du CRD Tool à l'invocation par un agent IA via SSE ou REST."
keywords:
  - MCP premiers pas
  - tutoriel Model Context Protocol
  - déploiement outil IA
  - serveur MCP STOA
  - invocation d'outil
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# MCP Premiers Pas

Déployez votre premier outil MCP et invoquez-le depuis un agent IA — en 5 minutes.

:::tip Pas de cluster ? Utilisez le cloud hébergé
Ce guide couvre le **parcours auto-hébergé** avec kubectl et les CRD. Si vous souhaitez simplement connecter Claude au cloud hébergé de STOA sans infrastructure, consultez [MCP pour développeurs](/docs/guides/mcp-developer-guide).
:::

## Prérequis

| Exigence | Détails |
|----------|---------|
| Plateforme STOA | Instance en cours d'exécution ([Démarrage rapide](/docs/guides/quickstart)) |
| kubectl | Configuré pour votre cluster |
| Tenant | Au moins un tenant actif (ex. `oasis`) |
| Keycloak | Jeton pour l'authentification |

<EnvSetup />

## Étape 1 — Définir un outil (CRD) {#step-1--define-a-tool-crd}

Créez une ressource personnalisée `Tool` qui encapsule une API existante en tant qu'outil MCP :

```yaml
# my-tool.yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: get-weather
  namespace: stoa-system
spec:
  displayName: Get Weather
  description: "Returns current weather for a given city. Useful for travel planning and logistics."
  endpoint: https://api.weatherapi.com/v1/current.json
  method: GET
  inputSchema:
    type: object
    properties:
      q:
        type: string
        description: "City name or coordinates"
    required:
      - q
  auth: none
  rateLimit: "60/min"
  annotations:
    readOnly: true
    destructive: false
    idempotent: true
    openWorld: true
```

Appliquez-le :

```bash
kubectl apply -f my-tool.yaml
```

Vérifiez l'enregistrement :

```bash
kubectl get tools.gostoa.dev -n stoa-system
```

```
NAME          DISPLAY NAME   ENDPOINT                                    REGISTERED
get-weather   Get Weather    https://api.weatherapi.com/v1/current.json  true
```

:::tip Annotations des outils
Les annotations aident les agents IA à prendre des décisions sûres :
- **readOnly** : L'outil ne lit que des données, pas d'effets de bord
- **destructive** : L'outil supprime ou modifie des données de manière irréversible
- **idempotent** : Appeler deux fois produit le même résultat
- **openWorld** : L'outil interagit avec des systèmes externes
:::

## Étape 2 — Découvrir les outils {#step-2--discover-tools}

### Option A : API REST

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/v1/tools" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.tools[].name'
```

### Option B : Protocole MCP (JSON-RPC)

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/tools/list" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.tools[] | {name, description}'
```

Les deux retournent les mêmes outils. REST est plus simple pour les scripts ; JSON-RPC suit la spécification MCP pour l'intégration des agents IA.

## Étape 3 — Invoquer un outil {#step-3--invoke-a-tool}

### Invocation REST

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/v1/tools/invoke" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get-weather",
    "arguments": {"q": "Paris"}
  }' | jq '.content[0].text'
```

### Invocation protocole MCP (JSON-RPC)

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/tools/call" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get-weather",
    "arguments": {"q": "Paris"}
  }'
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

## Étape 4 — Se connecter via SSE (streaming) {#step-4--connect-via-sse-streaming}

Pour les agents IA nécessitant des connexions persistantes, utilisez les Server-Sent Events :

```bash
# 1. Initialiser une session
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/sse" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": { "tools": {} },
      "clientInfo": { "name": "my-agent", "version": "1.0" }
    },
    "id": 1
  }'
```

**La réponse inclut :**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": { "listChanged": true },
      "tokenOptimization": {
        "supported": true,
        "levels": ["none", "moderate", "aggressive"]
      }
    },
    "serverInfo": { "name": "stoa-gateway", "version": "0.1.0" }
  },
  "id": 1
}
```

Après l'initialisation, envoyez les appels d'outils sur le même point d'entrée :

```bash
# 2. Appeler un outil via SSE
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/sse" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get-weather",
      "arguments": {"q": "London"}
    },
    "id": 2
  }'
```

:::info Versions du protocole
STOA supporte MCP `2025-03-26` (dernière version) et `2024-11-05` (rétro-compatible). La passerelle négocie la version mutuellement supportée la plus élevée lors de l'initialisation.
:::

## Étape 5 — Connecter un ToolSet (serveur MCP externe) {#step-5--connect-a-toolset-external-mcp-server}

Pour connecter un serveur MCP existant (ex. les outils internes d'une équipe), utilisez le CRD `ToolSet` :

```yaml
# my-toolset.yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: internal-tools
  namespace: stoa-system
spec:
  upstream:
    url: https://tools.internal.example.com/mcp
    transport: sse
    auth:
      type: bearer
      secretRef: internal-tools-token
    timeoutSeconds: 30
  tools: []       # Vide = exposer tous les outils découverts
  prefix: "int"   # Les outils deviennent int_tool_name (évite les collisions)
```

Appliquez et vérifiez :

```bash
kubectl apply -f my-toolset.yaml
kubectl get toolsets.gostoa.dev -n stoa-system
```

```
NAME             UPSTREAM                                    TOOLS   CONNECTED
internal-tools   https://tools.internal.example.com/mcp      5       true
```

La passerelle découvre automatiquement les outils du serveur MCP upstream et les expose.

## Étapes suivantes

| Sujet | Lien |
|-------|------|
| Créer des outils personnalisés avec les CRD | [Développement d'outils MCP](/docs/guides/mcp-tools-development) |
| Référence API MCP | [API de la passerelle MCP](/docs/api/mcp-gateway) |
| Plongée dans le protocole MCP | [Fiche protocole MCP](/docs/guides/fiches/mcp-protocol) |
| Gérer les abonnements | [Guide des abonnements](/docs/guides/subscriptions) |
| Spécifications CRD Tool et ToolSet | [CRD Kubernetes](/docs/reference/crds/) |

## Dépannage

| Problème | Cause | Solution |
|----------|-------|----------|
| Outil non listé | CRD pas dans le namespace `stoa-system` | Vérifiez le namespace : `kubectl get tools -A` |
| `401 Unauthorized` | Jeton manquant ou expiré | Rafraîchissez le jeton Keycloak |
| `registered: false` sur le Tool | La passerelle n'a pas synchronisé | Vérifiez les logs : `kubectl logs deploy/stoa-gateway -n stoa-system` |
| ToolSet `connected: false` | Upstream inaccessible | Vérifiez l'URL + le secret d'auth : `kubectl describe toolset <name>` |
| `SSRF blocked` à l'invocation | L'URL backend résout vers une IP privée | Utilisez une URL publique ou un nom de conteneur (pas localhost) |
