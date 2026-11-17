---
sidebar_position: 5
title: "CRD GatewayInstance"
description: "Spécification de la CRD GatewayInstance (gatewayinstances.gostoa.dev) — enregistrement déclaratif, topologie et suivi de santé des passerelles STOA et tierces."
keywords: [GatewayInstance CRD, Kubernetes, stoa-operator, multi-gateway, gostoa.dev]
---

# CRD GatewayInstance

La CRD `GatewayInstance` (`charts/stoa-platform/crds/gatewayinstances.gostoa.dev.yaml`) déclare une instance de passerelle API (STOA ou tierce) et suit son état de santé via `stoa-operator` (`stoa-operator/src/handlers/gateway_instance.py`).

## Métadonnées de Ressource

| Champ | Valeur |
|-------|--------|
| **Nom CRD** | `gatewayinstances.gostoa.dev` |
| **Version API** | `gostoa.dev/v1alpha1` |
| **Kind** | `GatewayInstance` |
| **Nom court** | `gwi` |
| **Portée** | `Namespaced` |
| **Réconciliateur** | `stoa-operator` (Python/Kopf, Bêta) |

## Exemple Complet

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: GatewayInstance
metadata:
  name: kong-prod-eu
  namespace: stoa-system
spec:
  displayName: Kong Production EU
  gatewayType: kong
  environment: prod
  tenantId: acme
  baseUrl: https://kong-admin.internal.example.com:8444
  deploymentMode: connect
  targetGatewayType: kong
  topology: remote-agent
  mode: connect
  endpoints:
    publicUrl: https://api.example.com
    adminUrl: https://kong-admin.internal.example.com:8444
    healthUrl: https://kong-admin.internal.example.com:8444/status
  authConfig:
    secretRef: kong-admin-credentials
  capabilities:
    - rest
    - oidc
    - rate_limiting
  version: "3.7.0"
  tags:
    - eu-west
    - production
status:
  phase: online
  lastHealthCheck: "2026-11-01T12:00:00Z"
```

## Champs `spec` (`openAPIV3Schema`)

### Champs Obligatoires

Le schéma OpenAPI de la CRD impose quatre champs obligatoires sous `spec` :

| Champ | Type | Valeurs / Contraintes imposées | Description |
|-------|------|--------------------------------|-------------|
| `displayName` | `string` | Obligatoire | Nom d'affichage lisible |
| `gatewayType` | `string` | Obligatoire ; Enum : `webmethods`, `kong`, `apigee`, `aws_apigateway`, `gravitee`, `stoa`, `stoa_edge_mcp`, `stoa_sidecar`, `stoa_proxy`, `stoa_shadow` | Type de produit ou profil passerelle |
| `environment` | `string` | Obligatoire | Environnement cible (ex. `dev`, `staging`, `prod`) |
| `baseUrl` | `string` | Obligatoire | URL de base de l'API d'administration (ou de contrôle) |

:::note Limites des Enums (`gatewayType` vs `targetGatewayType`)
- Ni `spec.gatewayType` ni `spec.targetGatewayType` n'inclut encore la valeur `envoy` dans le schéma CRD `v1alpha1` (les instances Envoy ADS loopback s'enregistrent actuellement via `stoa-connect` avec `STOA_GATEWAY_TYPE=envoy`).
- `azure_apim` et `agentgateway` figurent dans `spec.targetGatewayType` (`[stoa, kong, webmethods, gravitee, agentgateway, apigee, aws_apigateway, azure_apim]`) mais **pas** dans `spec.gatewayType`.
:::

### Champs Optionnels

| Champ | Type | Défaut | Valeurs / Contraintes imposées | Description |
|-------|------|--------|--------------------------------|-------------|
| `tenantId` | `string` | — | Chaîne | Identifiant du tenant propriétaire (vide pour une instance mutualisée) |
| `deploymentMode` | `string` | — | Enum : `edge`, `connect`, `sidecar` | Topologie canonique de déploiement |
| `targetGatewayType` | `string` | — | Enum : `stoa`, `kong`, `webmethods`, `gravitee`, `agentgateway`, `apigee`, `aws_apigateway`, `azure_apim` | Technologie de passerelle pilotée ou placée derrière STOA |
| `topology` | `string` | — | Enum : `native-edge`, `remote-agent`, `same-pod` | Topologie d'exécution |
| `topologyProof` | `object` | — | `x-kubernetes-preserve-unknown-fields: true` | Preuve de topologie attendue lorsque `deploymentMode: sidecar` |
| `mode` | `string` | — | Enum : `edge-mcp`, `sidecar`, `proxy`, `shadow`, `connect` | Mode d'exécution STOA ([ADR-024](/docs/architecture/adr/adr-024-gateway-unified-modes)) |
| `endpoints` | `object` | — | `x-kubernetes-preserve-unknown-fields: true` ; sous-champs : `publicUrl`, `targetGatewayUrl`, `uiUrl`, `internalUrl`, `adminUrl`, `healthUrl` | Carte logique des endpoints de l'instance |
| `authConfig` | `object` | — | `x-kubernetes-preserve-unknown-fields: true` | Référence d'authentification vers l'API d'administration (référencez toujours un `Secret` Kubernetes plutôt qu'un secret en clair) |
| `capabilities` | `string[]` | `[]` | Tableau de chaînes (ex. `rest`, `graphql`, `websocket`, `oidc`, `rate_limiting`, `mcp`) | Capacités déclarées de la passerelle |
| `version` | `string` | — | Chaîne | Version logicielle de la passerelle |
| `tags` | `string[]` | `[]` | Tableau de chaînes | Étiquettes libres de filtrage |

## Sous-ressource `status`

| Champ | Type | Valeurs / Contraintes imposées | Description |
|-------|------|--------------------------------|-------------|
| `phase` | `string` | Enum : `online`, `offline`, `degraded`, `maintenance` | État de santé réconcilié |
| `lastHealthCheck` | `string` | — | Horodatage du dernier contrôle de santé réussi |
| `healthDetails` | `object` | `x-kubernetes-preserve-unknown-fields: true` | Détail du dernier contrôle de santé |
| `error` | `string` | — | Message d'erreur en cas d'échec du contrôle de santé |

`kubectl get gatewayinstances` (ou `kubectl get gwi`) affiche `Type` (`.spec.gatewayType`), `Environment` (`.spec.environment`) et `Status` (`.status.phase`), ainsi que `URL` et `Topology` avec `-o wide`.

## Ressources Associées

- [CRD GatewayBinding](./gateway-binding.md) — Lier une API du catalogue et des politiques à une `GatewayInstance`
- [Configuration multi-passerelles](/docs/guides/multi-gateway-setup) — Guide d'orchestration multi-passerelles
- [ADR-035 : Patron Adaptateur de Gateway](/docs/architecture/adr/adr-035-gateway-adapter-pattern)
