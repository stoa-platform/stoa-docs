---
sidebar_position: 2
title: "CRD Tool"
description: "Spécification de la CRD Tool — définir des tools MCP individuels comme ressources Kubernetes pour l'invocation par les agents AI."
keywords: [Tool CRD, Kubernetes, MCP, custom resource]
---

# CRD Tool

La CRD `Tool` définit un tool MCP individuel que les agents AI peuvent invoquer.

## GroupVersionKind

| Champ | Valeur |
|-------|-------|
| Group | `gostoa.dev` |
| Version | `v1alpha1` |
| Kind | `Tool` |

## Exemple Complet

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: payment-create
  namespace: tenant-acme
  labels:
    app.kubernetes.io/part-of: payment-api
  annotations:
    gostoa.dev/api-ref: payment-api/v2
spec:
  displayName: Créer un Paiement
  description: Créer une nouvelle transaction de paiement
  endpoint: https://api.<YOUR_DOMAIN>/acme/payment-api/v2/payments
  method: POST
  version: "2.0.0"
  tags:
    - payments
    - transactions
  inputSchema:
    type: object
    properties:
      amount:
        type: number
        description: Montant du paiement en centimes
      currency:
        type: string
        enum: [EUR, USD, GBP]
        default: EUR
      recipient:
        type: string
        description: ID du compte destinataire
    required:
      - amount
      - recipient
  authentication:
    type: bearer
    secretRef:
      name: payment-api-token
      key: token
  rateLimit:
    requestsPerMinute: 100
    burst: 20
  timeout: "30s"
  enabled: true
status:
  phase: Registered
  registeredAt: "2026-02-06T10:00:00Z"
  lastSyncedAt: "2026-02-06T12:00:00Z"
  invocationCount: 1542
  errorCount: 12
```

## Champs Spec

### Champs Obligatoires

| Champ | Type | Description |
|-------|------|-------------|
| `displayName` | string | Nom lisible par un humain (1-64 caractères) |
| `description` | string | Description du tool pour le contexte AI (1-1024 caractères) |

### Champs Optionnels

| Champ | Type | Défaut | Description |
|-------|------|---------|-------------|
| `endpoint` | string | - | URL de l'endpoint HTTP |
| `method` | enum | `POST` | Méthode HTTP : GET, POST, PUT, PATCH, DELETE |
| `inputSchema` | object | `{}` | JSON Schema pour les paramètres du tool |
| `tags` | array | `[]` | Tags de catégorisation |
| `version` | string | `1.0.0` | Version du tool |
| `timeout` | string | `30s` | Timeout de la requête (ex : "30s", "1m") |
| `enabled` | boolean | `true` | Activer/désactiver le tool |

### Configuration de l'Authentification

```yaml
spec:
  authentication:
    type: bearer       # none, bearer, basic, apiKey, oauth2
    secretRef:
      name: api-secret # Nom du secret dans le même namespace
      key: token       # Clé dans le secret
    headerName: Authorization  # En-tête personnalisé (défaut : Authorization)
```

### Rate Limiting

```yaml
spec:
  rateLimit:
    requestsPerMinute: 60  # Requêtes par minute (1-10000)
    burst: 10              # Tolérance de rafale (1-1000)
```

### Référence API

Lier le tool à l'API source :

```yaml
spec:
  apiRef:
    name: payment-api
    version: v2
    operationId: createPayment
```

## Champs Status

| Champ | Type | Description |
|-------|------|-------------|
| `phase` | enum | Pending, Registered, Error, Disabled |
| `registeredAt` | datetime | Date d'enregistrement du tool |
| `lastSyncedAt` | datetime | Horodatage de la dernière synchronisation |
| `invocationCount` | integer | Total des invocations |
| `errorCount` | integer | Total des erreurs |
| `lastError` | string | Message d'erreur le plus récent |
| `conditions` | array | Conditions de style Kubernetes |

### Phases

| Phase | Description |
|-------|-------------|
| `Pending` | Tool créé, en attente d'enregistrement |
| `Registered` | Tool actif et disponible |
| `Error` | Échec de l'enregistrement |
| `Disabled` | Tool désactivé manuellement |

## Règles de Validation

1. **Nom unique par namespace** — Les noms de tools doivent être uniques dans un namespace
2. **JSON Schema valide** — `inputSchema` doit être un JSON Schema draft-07 valide
3. **Endpoint valide** — Si fourni, doit être une URL HTTP(S) valide
4. **Le secret doit exister** — Les secrets référencés doivent exister dans le même namespace

## Exemples

### Tool Simple (Sans Auth)

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: echo
  namespace: tenant-demo
spec:
  displayName: Echo
  description: Retourne le message en entrée
  method: GET
  inputSchema:
    type: object
    properties:
      message:
        type: string
```

### Tool avec OAuth2

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: salesforce-query
  namespace: tenant-enterprise
spec:
  displayName: Requête Salesforce
  description: Exécuter une requête SOQL sur Salesforce
  endpoint: https://login.salesforce.com/services/data/v58.0/query
  method: GET
  authentication:
    type: oauth2
    secretRef:
      name: salesforce-oauth
      key: access_token
  inputSchema:
    type: object
    properties:
      q:
        type: string
        description: Requête SOQL
    required:
      - q
```

### Tool avec Clé API

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: openai-completion
  namespace: tenant-ai
spec:
  displayName: Complétion OpenAI
  description: Générer une complétion de texte
  endpoint: https://api.openai.com/v1/completions
  method: POST
  authentication:
    type: apiKey
    headerName: Authorization
    secretRef:
      name: openai-key
      key: api-key
  timeout: "60s"
  rateLimit:
    requestsPerMinute: 20
    burst: 5
```

## Ressources Associées

- [CRD ToolSet](./toolset.md) — Générer plusieurs tools depuis OpenAPI
- [ADR-006 — Architecture du Registre de Tools](/docs/architecture/adr/adr-006-tool-registry-architecture)
