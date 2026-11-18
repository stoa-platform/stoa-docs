---
sidebar_position: 2
title: "CRD Tool"
description: "Spécification de la CRD Tool (tools.gostoa.dev) — définir des outils MCP individuels adossés à HTTP sous forme de ressources Kubernetes."
keywords: [Tool CRD, Kubernetes, MCP, custom resource, gostoa.dev]
---

# CRD Tool

La CRD `Tool` (`charts/stoa-platform/crds/tools.gostoa.dev.yaml`) définit un outil MCP individuel adossé à un endpoint HTTP, surveillé dynamiquement par `stoa-gateway` lorsqu'il est compilé avec la feature Cargo `k8s` et démarré avec `STOA_K8S_ENABLED=true`.

## Métadonnées de Ressource

| Champ | Valeur |
|-------|--------|
| **Nom CRD** | `tools.gostoa.dev` |
| **Version API** | `gostoa.dev/v1alpha1` |
| **Kind** | `Tool` |
| **Nom court** | `tool` |
| **Portée** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`, expose `{namespace}_{snake_case(metadata.name)}`) |

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
  annotations:
    readOnly: false
    destructive: false
    idempotent: false
    openWorld: true
```
*(Dans le namespace `tenant-acme`, `metadata.name: payment-create` est enregistré dans `stoa-gateway` sous le nom d'outil MCP `tenant-acme_payment_create`.)*

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
| `auth` | `string` | `none` | Enum : `bearer`, `service_account`, `none` | Déclaré au schéma CRD, **non lu** par `CrdWatcher` sur `main` |
| `rateLimit` | `string` | — | Expression (ex. `100/min`, `1000/hour`) | Déclaré au schéma CRD, **non appliqué** par `CrdWatcher` sur `main` |
| `annotations.readOnly` | `boolean` | — | Booléen | Indique un outil sans modification d'état |
| `annotations.destructive` | `boolean` | — | Booléen | Indique une action destructive |
| `annotations.idempotent` | `boolean` | — | Booléen | Indique une opération idempotente |
| `annotations.openWorld` | `boolean` | — | Booléen | Indique une interaction avec un système externe |

*(Note : `CrdWatcher::handle_tool_apply` (`stoa-gateway/src/k8s/watcher.rs`) construit `DynamicTool` à partir de `description`, `endpoint`, `method`, `inputSchema`, `outputSchema` et `annotations` ; `spec.auth` et `spec.rateLimit` sont acceptés par le schéma mais ne sont pas lus par le watcher Rust actuel. Pour générer automatiquement des manifestes `Tool` à partir d'une spécification OpenAPI, utilisez [`stoactl bridge <spec-file>`](/docs/reference/cli).)*

## Sous-ressource `status`

Le schéma CRD définit les champs `.status` (`registered`, `lastSeen`, `error`) et les colonnes d'affichage (`Display Name`, `Endpoint`, `Registered`). Sur `main`, `CrdWatcher` enregistre les outils en mémoire sans patcher `.status` auprès de l'API Kubernetes ; `.status.registered` reste donc vide tant qu'aucun contrôleur externe ne l'écrit :

| Champ | Type | Description |
|-------|------|-------------|
| `registered` | `boolean` | Champ schéma d'état d'enregistrement (non patché par `CrdWatcher` sur `main`) |
| `lastSeen` | `string` | Champ schéma d'horodatage (non patché par `CrdWatcher` sur `main`) |
| `error` | `string` | Détail d'erreur éventuel |

## Ressources Associées

- [CRD ToolSet](./toolset.md) — Exposer les outils d'un serveur MCP amont
- [CRD Skill](./skill.md) — Injecter des instructions système ciblées sur un outil
- [ADR-006 — Architecture du Registre d'Outils](/docs/architecture/adr/adr-006-tool-registry-architecture)
