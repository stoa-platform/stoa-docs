---
sidebar_position: 3
title: "CRD ToolSet"
description: "Spécification de la CRD ToolSet — générer automatiquement plusieurs ressources Tool depuis une spécification OpenAPI."
keywords: [ToolSet CRD, Kubernetes, OpenAPI, custom resource]
---

# CRD ToolSet

La CRD `ToolSet` génère plusieurs ressources Tool depuis une spécification OpenAPI.

## GroupVersionKind

| Champ | Valeur |
|-------|-------|
| Group | `gostoa.dev` |
| Version | `v1alpha1` |
| Kind | `ToolSet` |

## Exemple Complet

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: payment-api-tools
  namespace: tenant-acme
spec:
  displayName: Tools API Paiement
  description: Tools générés depuis la spec OpenAPI de l'API Paiement
  openAPISpec:
    url: https://api.<YOUR_DOMAIN>/acme/payment-api/v2/openapi.json
    refreshInterval: "1h"
  baseURL: https://api.<YOUR_DOMAIN>/acme/payment-api/v2
  selector:
    tags:
      - payments
      - refunds
    excludeTags:
      - internal
      - deprecated
    methods:
      - GET
      - POST
  toolDefaults:
    tags:
      - generated
      - payment-api
    timeout: "30s"
    rateLimit:
      requestsPerMinute: 100
      burst: 20
    authentication:
      type: bearer
      secretRef:
        name: payment-api-token
        key: token
  naming:
    prefix: "payment_"
    useOperationId: true
  enabled: true
status:
  phase: Ready
  toolCount: 12
  tools:
    - payment_create_payment
    - payment_get_payment
    - payment_list_payments
    - payment_create_refund
  lastSyncedAt: "2026-02-06T12:00:00Z"
  specHash: "abc123"
```

## Champs Spec

### Champs Obligatoires

| Champ | Type | Description |
|-------|------|-------------|
| `displayName` | string | Nom lisible par un humain (1-64 caractères) |

### Source de la Spec OpenAPI

Configurer d'où récupérer la spécification OpenAPI :

```yaml
spec:
  openAPISpec:
    # Option 1 : URL (recommandé)
    url: https://api.example.com/openapi.json
    refreshInterval: "1h"  # Fréquence de récupération

    # Option 2 : ConfigMap
    configMapRef:
      name: api-spec
      key: openapi.yaml

    # Option 3 : Secret (pour les specs privées)
    secretRef:
      name: private-api-spec
      key: openapi.json

    # Option 4 : Inline (petites specs uniquement)
    inline: |
      openapi: "3.0.0"
      info:
        title: Mon API
        version: "1.0"
      paths: ...
```

### Selector (Filtrer les Opérations)

Contrôler quelles opérations deviennent des tools :

```yaml
spec:
  selector:
    # N'inclure que ces tags
    tags:
      - public
      - v2

    # Exclure ces tags
    excludeTags:
      - internal
      - deprecated
      - admin

    # Limiter les méthodes HTTP
    methods:
      - GET
      - POST

    # Filtre par préfixe de chemin
    pathPrefix: /api/v2/

    # Opérations spécifiques par ID
    operationIds:
      - createUser
      - getUser
      - listUsers
```

### Valeurs par Défaut des Tools

Appliquer des valeurs par défaut à tous les tools générés :

```yaml
spec:
  toolDefaults:
    tags:
      - generated
    timeout: "30s"
    rateLimit:
      requestsPerMinute: 60
      burst: 10
    authentication:
      type: bearer
      secretRef:
        name: api-token
        key: token
```

### Configuration du Nommage

Contrôler le nommage des tools :

```yaml
spec:
  naming:
    prefix: "myapi_"           # Préfixer tous les noms de tools
    suffix: "_v2"              # Suffixer tous les noms de tools
    useOperationId: true       # Utiliser l'operationId OpenAPI (recommandé)
```

Les noms de tools sont générés comme suit : `{prefix}{operationId}{suffix}`

Exemple : `myapi_createPayment_v2`

## Champs Status

| Champ | Type | Description |
|-------|------|-------------|
| `phase` | enum | Pending, Syncing, Ready, Error, Disabled |
| `toolCount` | integer | Nombre de tools générés |
| `tools` | array | Liste des noms de tools générés |
| `lastSyncedAt` | datetime | Dernière synchronisation réussie |
| `specHash` | string | Hash de la spec OpenAPI (pour la détection de changements) |
| `lastError` | string | Message d'erreur le plus récent |
| `conditions` | array | Conditions de style Kubernetes |

### Phases

| Phase | Description |
|-------|-------------|
| `Pending` | ToolSet créé, en attente de la première synchronisation |
| `Syncing` | Récupération et traitement de la spec en cours |
| `Ready` | Tools générés et enregistrés |
| `Error` | Échec de la synchronisation |
| `Disabled` | ToolSet désactivé manuellement |

## Comportement de Synchronisation

1. **Synchronisation initiale** — À la création, récupère la spec et génère les tools
2. **Actualisation périodique** — Re-récupère à `refreshInterval`
3. **Détection des changements** — Ne régénère que si le hash de la spec change
4. **Incrémental** — Ajoute les nouveaux tools, supprime les opérations effacées
5. **Préserve les modifications** — Les modifications manuelles des tools sont préservées

## Exemples

### Depuis une URL Publique

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: petstore-tools
  namespace: tenant-demo
spec:
  displayName: API Petstore
  openAPISpec:
    url: https://petstore3.swagger.io/api/v3/openapi.json
    refreshInterval: "24h"
  baseURL: https://petstore3.swagger.io/api/v3
  selector:
    tags:
      - pet
      - store
  enabled: true
```

### Depuis un ConfigMap

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: internal-api-tools
  namespace: tenant-corp
spec:
  displayName: API Interne
  openAPISpec:
    configMapRef:
      name: internal-api-spec
      key: openapi.yaml
  baseURL: http://internal-api.corp.svc.cluster.local
  toolDefaults:
    authentication:
      type: none  # Service interne, aucune auth requise
```

### Filtré par Méthodes

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: readonly-tools
  namespace: tenant-readonly
spec:
  displayName: Tools API Lecture Seule
  description: Uniquement les opérations GET exposées
  openAPISpec:
    url: https://api.example.com/openapi.json
  selector:
    methods:
      - GET
  toolDefaults:
    timeout: "10s"
    rateLimit:
      requestsPerMinute: 200
```

## Dépannage

### Tools Non Générés

Vérifier le statut du ToolSet :

```bash
kubectl describe toolset my-toolset -n tenant-acme
```

Problèmes courants :
- URL de spec OpenAPI invalide
- Filtres selector trop restrictifs
- Authentification requise pour l'URL de la spec

### Spec Non Actualisée

Vérifier que `refreshInterval` est défini et consulter les logs :

```bash
kubectl logs -l app=mcp-gateway -n stoa-system | grep toolset
```

### Noms de Tools en Double

S'assurer que `naming.prefix` est unique par ToolSet.

## Ressources Associées

- [CRD Tool](./tool.md) — Définition individuelle de tool
- [ADR-006 — Architecture du Registre de Tools](/docs/architecture/adr/adr-006-tool-registry-architecture)
