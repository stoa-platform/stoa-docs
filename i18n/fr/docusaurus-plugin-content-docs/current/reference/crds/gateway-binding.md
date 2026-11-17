---
sidebar_position: 6
title: "CRD GatewayBinding"
description: "Spécification de la CRD GatewayBinding (gatewaybindings.gostoa.dev) — lier de manière déclarative une entrée du catalogue API, un contrat UAC et des politiques vers une GatewayInstance."
keywords: [GatewayBinding CRD, Kubernetes, stoa-operator, policy binding, gostoa.dev]
---

# CRD GatewayBinding

La CRD `GatewayBinding` (`charts/stoa-platform/crds/gatewaybindings.gostoa.dev.yaml`) lie de manière déclarative une entrée du catalogue API (ainsi qu'un contrat UAC et des politiques optionnels) vers une [`GatewayInstance`](./gateway-instance.md) cible. Elle est réconciliée par `stoa-operator` (`stoa-operator/src/handlers/gateway_binding.py`).

## Métadonnées de Ressource

| Champ | Valeur |
|-------|--------|
| **Nom CRD** | `gatewaybindings.gostoa.dev` |
| **Version API** | `gostoa.dev/v1alpha1` |
| **Kind** | `GatewayBinding` |
| **Nom court** | `gwb` |
| **Portée** | `Namespaced` |
| **Réconciliateur** | `stoa-operator` (Python/Kopf, Bêta) |

## Exemple Complet

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: GatewayBinding
metadata:
  name: payments-on-kong-eu
  namespace: tenant-acme
spec:
  apiRef:
    name: payments-api
    version: "2.0.0"
  gatewayRef:
    name: kong-prod-eu
    namespace: stoa-system
  contractRef:
    name: payments-uac
    namespace: tenant-acme
  desiredState:
    stripPath: false
  policies:
    - name: gold-rate-limit
      type: rate_limit
      config:
        maxRequests: 600
        intervalSeconds: 60
    - name: portal-cors
      type: cors
      config:
        allowOrigins:
          - https://portal.example.com
status:
  syncStatus: synced
  gatewayResourceId: "svc_9f81c2"
  lastSyncAttempt: "2026-11-01T12:00:00Z"
  lastSyncSuccess: "2026-11-01T12:00:01Z"
  syncAttempts: 1
```

## Champs `spec` (`openAPIV3Schema`)

### Champs Obligatoires

| Champ | Type | Valeurs / Contraintes imposées | Description |
|-------|------|--------------------------------|-------------|
| `apiRef` | `object` | Obligatoire (`apiRef.name` obligatoire) | Référence vers l'entrée du catalogue d'API Control Plane |
| `apiRef.name` | `string` | Obligatoire | Nom / identifiant de l'API dans le catalogue |
| `gatewayRef` | `object` | Obligatoire (`gatewayRef.name` obligatoire) | Référence vers la `GatewayInstance` cible |
| `gatewayRef.name` | `string` | Obligatoire | Nom de la `GatewayInstance` cible |

### Champs Optionnels

| Champ | Type | Valeurs / Contraintes imposées | Description |
|-------|------|--------------------------------|-------------|
| `apiRef.version` | `string` | Chaîne | Version spécifique de l'API à exposer |
| `gatewayRef.namespace` | `string` | Chaîne | Namespace de la `GatewayInstance` cible (si inter-namespace) |
| `contractRef` | `object` | Sous-champs : `name` (`string`), `namespace` (`string`) | Référence optionnelle vers un contrat UAC |
| `desiredState` | `object` | `x-kubernetes-preserve-unknown-fields: true` | Configuration souhaitée spécifique à la passerelle cible |
| `policies` | `object[]` | Tableau d'objets `{name, type, config}` | Politiques appliquées sur cette liaison |
| `policies[].name` | `string` | Chaîne | Nom de la politique |
| `policies[].type` | `string` | Chaîne (ex. `rate_limit`, `cors`, `request_validation`) | Type de politique |
| `policies[].config` | `object` | `x-kubernetes-preserve-unknown-fields: true` | Paramètres de la politique |

## Sous-ressource `status`

| Champ | Type | Valeurs / Contraintes imposées | Description |
|-------|------|--------------------------------|-------------|
| `syncStatus` | `string` | Enum : `pending`, `syncing`, `synced`, `drifted`, `error`, `deleting` | État du cycle de synchronisation |
| `actualState` | `object` | `x-kubernetes-preserve-unknown-fields: true` | État effectif remonté par la passerelle cible |
| `gatewayResourceId` | `string` | Chaîne | Identifiant externe attribué par la passerelle cible |
| `lastSyncAttempt` | `string` | Chaîne | Horodatage de la dernière tentative de synchronisation |
| `lastSyncSuccess` | `string` | Chaîne | Horodatage de la dernière synchronisation réussie |
| `syncAttempts` | `integer` | Entier | Nombre cumulé de tentatives |
| `syncError` | `string` | Chaîne | Message d'erreur de la dernière synchronisation en échec |

`kubectl get gatewaybindings` (ou `kubectl get gwb`) affiche `API` (`.spec.apiRef.name`), `Gateway` (`.spec.gatewayRef.name`), `Sync` (`.status.syncStatus`) et `Age`.

## Ressources Associées

- [CRD GatewayInstance](./gateway-instance.md) — Déclarer les instances de passerelle cibles
- [Configuration multi-passerelles](/docs/guides/multi-gateway-setup) — Guide d'orchestration multi-passerelles
- [Politiques OPA](/docs/guides/opa-policies) — Rédaction de politiques de gouvernance
