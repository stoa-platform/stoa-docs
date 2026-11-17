---
sidebar_position: 3
title: "CRD ToolSet"
description: "Spécification de la CRD ToolSet (toolsets.gostoa.dev) — connecter un serveur MCP amont via SSE ou Streamable HTTP et exposer ses outils sur STOA Gateway."
keywords: [ToolSet CRD, Kubernetes, MCP, serveur amont, SSE, streamable-http, gostoa.dev]
---

# CRD ToolSet

La CRD `ToolSet` (`charts/stoa-platform/crds/toolsets.gostoa.dev.yaml`) connecte un serveur MCP amont externe ou interne (`sse` ou `streamable-http`) et enregistre ses outils découverts dans `stoa-gateway`.

:::info Génération OpenAPI vers `Tool` vs `ToolSet`
`ToolSet` fédère un **serveur MCP amont** en exécution. Pour générer statiquement des manifestes `Tool` à partir d'une spécification OpenAPI, utilisez [`stoactl bridge <openapi.yaml>`](/docs/reference/cli).
:::

## Métadonnées de Ressource

| Champ | Valeur |
|-------|--------|
| **Nom CRD** | `toolsets.gostoa.dev` |
| **Version API** | `gostoa.dev/v1alpha1` |
| **Kind** | `ToolSet` |
| **Nom court** | `ts` |
| **Portée** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`) |

## Exemple Complet

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: crm-mcp-upstream
  namespace: tenant-acme
spec:
  upstream:
    url: https://crm-mcp.internal.example.com/mcp
    transport: streamable-http
    timeoutSeconds: 30
    auth:
      type: bearer
      secretRef: crm-mcp-token
  tools:
    - search_contacts
    - get_account
  prefix: "crm_"
status:
  connected: true
  toolCount: 2
  discoveredTools:
    - crm_search_contacts
    - crm_get_account
  lastSync: "2026-11-01T12:00:00Z"
```

## Champs `spec` (`openAPIV3Schema`)

### Champs Obligatoires

| Champ | Type | Valeurs / Contraintes imposées | Description |
|-------|------|--------------------------------|-------------|
| `upstream` | `object` | Obligatoire (`upstream.url` obligatoire) | Paramètres de connexion au serveur MCP amont |
| `upstream.url` | `string` | Obligatoire | URL du serveur MCP amont |

### Champs Optionnels

| Champ | Type | Défaut | Valeurs / Contraintes imposées | Description |
|-------|------|--------|--------------------------------|-------------|
| `upstream.transport` | `string` | `sse` | Enum : `sse`, `streamable-http` | Protocole de transport MCP vers `upstream.url` |
| `upstream.timeoutSeconds` | `integer` | — | Entier | Délai d'expiration de connexion/requête en secondes |
| `upstream.auth.type` | `string` | — | Enum : `bearer`, `header` | Schéma d'authentification amont |
| `upstream.auth.secretRef` | `string` | — | Chaîne | Nom du `Secret` Kubernetes contenant l'identifiant amont |
| `upstream.auth.headerName` | `string` | — | Chaîne | Nom de l'en-tête HTTP lorsque `upstream.auth.type: header` |
| `tools` | `string[]` | `[]` | Tableau de chaînes | Liste blanche des outils à exposer (`[]` expose tous les outils découverts) |
| `prefix` | `string` | — | Chaîne | Préfixe ajouté aux noms d'outils pour éviter les collisions |

## Sous-ressource `status`

| Champ | Type | Description |
|-------|------|-------------|
| `connected` | `boolean` | Indique si `stoa-gateway` est connecté au serveur MCP amont |
| `toolCount` | `integer` | Nombre d'outils découverts et enregistrés |
| `discoveredTools` | `string[]` | Liste des noms d'outils enregistrés |
| `lastSync` | `string` | Horodatage de la dernière synchronisation réussie |
| `error` | `string` | Message d'erreur en cas d'échec de connexion ou de découverte |

`kubectl get toolsets` (ou `kubectl get ts`) affiche les colonnes `Upstream` (`.spec.upstream.url`), `Tools` (`.status.toolCount`) et `Connected` (`.status.connected`).

## Ressources Associées

- [CRD Tool](./tool.md) — Outil MCP individuel adossé à HTTP
- [CRD Skill](./skill.md) — Instructions système contextualisées
- [Référence CLI (`stoactl bridge`)](/docs/reference/cli) — Générer des CRDs `Tool` depuis une spec OpenAPI
