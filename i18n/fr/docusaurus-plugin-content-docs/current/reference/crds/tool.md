---
sidebar_position: 2
title: "CRD Tool"
description: "Spécification de la CRD Tool (tools.gostoa.dev) — définir des outils MCP individuels adossés à HTTP sous forme de ressources Kubernetes."
keywords: [Tool CRD, Kubernetes, MCP, custom resource, gostoa.dev]
---

# CRD Tool

La CRD `Tool` (`charts/stoa-platform/crds/tools.gostoa.dev.yaml`) définit un outil MCP individuel adossé à un endpoint HTTP, surveillé dynamiquement par `stoa-gateway` lorsque `STOA_K8S_WATCHER_ENABLED=true`.

## Métadonnées de Ressource

| Champ | Valeur |
|-------|--------|
| **Nom CRD** | `tools.gostoa.dev` |
| **Version API** | `gostoa.dev/v1alpha1` |
| **Kind** | `Tool` |
| **Nom court** | `tool` |
| **Portée** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`) |

## Exemple Complet

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: payment-create
  namespace: tenant-acme
spec:
  displayName: Créer un Paiement
  description: Créer une nouvelle transaction de paiement
  endpoint: https://payments.internal.example.com/v2/payments
  method: POST
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
        description: Identifiant du compte bénéficiaire
    required:
      - amount
      - recipient
  outputSchema:
    type: object
    properties:
      paymentId:
        type: string
  auth: bearer
  rateLimit: "100/min"
  annotations:
    readOnly: false
    destructive: false
    idempotent: false
    openWorld: true
status:
  registered: true
  lastSeen: "2026-11-01T12:00:00Z"
```

## Champs `spec` (`openAPIV3Schema`)

### Champs Obligatoires

Les cinq champs suivants sont imposés (`required`) par le schéma OpenAPI de la CRD :

| Champ | Type | Valeurs / Contraintes imposées | Description |
|-------|------|--------------------------------|-------------|
| `displayName` | `string` | Obligatoire | Nom d'affichage lisible |
| `description` | `string` | Obligatoire | Description de l'outil exposée au contexte LLM |
| `endpoint` | `string` | Obligatoire | URL HTTP(S) du service backend |
| `method` | `string` | Enum : `GET`, `POST`, `PUT`, `DELETE`, `PATCH` | Méthode HTTP d'invocation |
| `inputSchema` | `object` | `x-kubernetes-preserve-unknown-fields: true` | JSON Schema décrivant les arguments d'entrée |

### Champs Optionnels

| Champ | Type | Défaut | Valeurs / Contraintes imposées | Description |
|-------|------|--------|--------------------------------|-------------|
| `outputSchema` | `object` | — | `x-kubernetes-preserve-unknown-fields: true` | JSON Schema optionnel de la sortie |
| `auth` | `string` | `none` | Enum : `bearer`, `service_account`, `none` | Mode d'authentification vers le backend |
| `rateLimit` | `string` | — | Expression (ex. `100/min`, `1000/hour`) | Expression de limitation de débit de l'outil |
| `annotations.readOnly` | `boolean` | — | Booléen | Indique un outil sans modification d'état |
| `annotations.destructive` | `boolean` | — | Booléen | Indique une action destructive |
| `annotations.idempotent` | `boolean` | — | Booléen | Indique une opération idempotente |
| `annotations.openWorld` | `boolean` | — | Booléen | Indique une interaction avec un système externe |

*(Note : pour générer automatiquement des manifestes `Tool` à partir d'une spécification OpenAPI, utilisez [`stoactl bridge <spec-file>`](/docs/reference/cli).)*

## Sous-ressource `status`

| Champ | Type | Description |
|-------|------|-------------|
| `registered` | `boolean` | Indique si l'outil est enregistré dans `stoa-gateway` |
| `lastSeen` | `string` | Horodatage de la dernière prise en compte par le watcher |
| `error` | `string` | Message d'erreur en cas d'échec d'enregistrement |

`kubectl get tools` affiche les colonnes `Display Name` (`.spec.displayName`), `Endpoint` (`.spec.endpoint`) et `Registered` (`.status.registered`).

## Ressources Associées

- [CRD ToolSet](./toolset.md) — Exposer les outils d'un serveur MCP amont
- [CRD Skill](./skill.md) — Injecter des instructions système ciblées sur un outil
- [ADR-006 — Architecture du Registre d'Outils](/docs/architecture/adr/adr-006-tool-registry-architecture)
