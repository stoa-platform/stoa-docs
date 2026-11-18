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
      secretRef: crm-mcp-token   # Nom du Secret K8s dans `tenant-acme` (clé `token` lue par défaut)
  tools:
    - search_contacts
    - get_account
  prefix: "crm_"
```
*(Les outils exportés sont nommés `{prefix}{namespace}_{snake_case(tool_name)}` : avec `prefix: "crm_"` dans `tenant-acme`, `CrdWatcher` enregistre `crm_tenant-acme_search_contacts` et `crm_tenant-acme_get_account`.)*

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
| `upstream.timeoutSeconds` | `integer` | `30` (runtime) | Entier | Délai d'expiration de connexion/requête en secondes (`unwrap_or(30)` dans `CrdWatcher`) |
| `upstream.auth.type` | `string` | — | Enum : `bearer`, `header` | Déclaré au schéma CRD ; le client runtime `UpstreamMcpClient` émet `Authorization: Bearer <token>` dès qu'un jeton Secret est lu |
| `upstream.auth.secretRef` | `string` | — | Chaîne | Nom du `Secret` Kubernetes dans le même namespace (`CrdWatcher` lit la clé `token` par défaut) |
| `upstream.auth.headerName` | `string` | — | Chaîne | Déclaré au schéma CRD pour `type: header`, **non lu** par `UpstreamMcpClient` sur `main` |
| `tools` | `string[]` | `[]` | Tableau de chaînes | Liste blanche des outils à exposer (`[]` expose tous les outils découverts) |
| `prefix` | `string` | `""` | Chaîne | Préfixe ajouté devant `{namespace}_{snake_case(tool_name)}` (ex. `crm_tenant-acme_search_contacts`) |

## Sous-ressource `status`

Le schéma CRD définit les champs `.status` (`connected`, `toolCount`, `discoveredTools`, `lastSync`, `error`) et les colonnes d'affichage (`Upstream`, `Tools`, `Connected`). Sur `main`, `CrdWatcher` enregistre les outils fédérés en mémoire sans patcher `.status` auprès de l'API Kubernetes :

| Champ | Type | Description |
|-------|------|-------------|
| `connected` | `boolean` | Champ schéma de connectivité amont (non patché par `CrdWatcher` sur `main`) |
| `toolCount` | `integer` | Champ schéma du nombre d'outils (non patché par `CrdWatcher` sur `main`) |
| `discoveredTools` | `string[]` | Champ schéma des noms d'outils enregistrés |
| `lastSync` | `string` | Champ schéma de dernier horodatage |
| `error` | `string` | Champ schéma d'erreur de connexion ou de découverte |

## Ressources Associées

- [CRD Tool](./tool.md) — Outil MCP individuel adossé à HTTP
- [CRD Skill](./skill.md) — Instructions système contextualisées
- [Référence CLI (`stoactl bridge`)](/docs/reference/cli) — Générer des CRDs `Tool` depuis une spec OpenAPI
