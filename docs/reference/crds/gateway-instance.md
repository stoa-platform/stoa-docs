---
sidebar_position: 5
title: "GatewayInstance CRD"
description: "GatewayInstance CRD specification (gatewayinstances.gostoa.dev) — declarative registration, topology metadata, and health tracking for STOA and third-party gateways."
keywords: [GatewayInstance CRD, Kubernetes, stoa-operator, multi-gateway, gostoa.dev]
---

# GatewayInstance CRD

The `GatewayInstance` CRD (`charts/stoa-platform/crds/gatewayinstances.gostoa.dev.yaml`) declaratively registers an API gateway instance (STOA or third-party) and tracks its reconciliation health through `stoa-operator` (`stoa-operator/src/handlers/gateway_instance.py`).

## Resource Metadata

| Field | Value |
|-------|-------|
| **CRD Name** | `gatewayinstances.gostoa.dev` |
| **API Version** | `gostoa.dev/v1alpha1` |
| **Kind** | `GatewayInstance` |
| **Short Name** | `gwi` |
| **Scope** | `Namespaced` |
| **Reconciler** | `stoa-operator` (Python/Kopf, Beta) |

## Complete Example

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

## Spec Fields (`openAPIV3Schema`)

### Required Fields

The CRD schema enforces four required fields under `spec`:

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `displayName` | `string` | Required | Human-readable display name |
| `gatewayType` | `string` | Required; Enum: `webmethods`, `kong`, `apigee`, `aws_apigateway`, `gravitee`, `stoa`, `stoa_edge_mcp`, `stoa_sidecar`, `stoa_proxy`, `stoa_shadow` | Gateway product/profile identifier |
| `environment` | `string` | Required | Target environment identifier (e.g., `dev`, `staging`, `prod`) |
| `baseUrl` | `string` | Required | Gateway admin API (or control) base URL |

:::note Schema Enum Boundaries & `stoa-operator` Mapping (`gateway_instance.py`)
- Neither `spec.gatewayType` nor `spec.targetGatewayType` includes an `envoy` enum value in the `v1alpha1` CRD schema yet (Envoy loopback ADS instances currently register via `stoa-connect` with `STOA_GATEWAY_TYPE=envoy`).
- `azure_apim` and `agentgateway` appear in `spec.targetGatewayType` (`[stoa, kong, webmethods, gravitee, agentgateway, apigee, aws_apigateway, azure_apim]`) but **not** in `spec.gatewayType`.
- **Schema vs operator behavior on `main`**: `stoa-operator` (`_spec_to_registration` in `stoa-operator/src/handlers/gateway_instance.py`) sends **only** `metadata.name`, `displayName` (`display_name`), `gatewayType` (`gateway_type`), `baseUrl` (`base_url`), `environment`, and `mode` when registering with the Control Plane API. The optional fields below (`authConfig.secretRef`, `tenantId`, `deploymentMode`, `targetGatewayType`, `topology`, `endpoints`, `capabilities`, `version`, `tags`) are validated and stored on the Kubernetes resource by the CRD schema, but are not forwarded to the Control Plane by the Beta operator yet.
:::

### Optional Fields

| Field | Type | Default | Enforced Values / Constraints | Description |
|-------|------|---------|-------------------------------|-------------|
| `tenantId` | `string` | — | String | Owning tenant ID (omit or leave empty for platform-wide instances) |
| `deploymentMode` | `string` | — | Enum: `edge`, `connect`, `sidecar` | Canonical deployment topology |
| `targetGatewayType` | `string` | — | Enum: `stoa`, `kong`, `webmethods`, `gravitee`, `agentgateway`, `apigee`, `aws_apigateway`, `azure_apim` | Gateway technology fronted or controlled by STOA |
| `topology` | `string` | — | Enum: `native-edge`, `remote-agent`, `same-pod` | Execution topology |
| `topologyProof` | `object` | — | `x-kubernetes-preserve-unknown-fields: true` | Co-location/integration evidence object when `deploymentMode: sidecar` |
| `mode` | `string` | — | Enum: `edge-mcp`, `sidecar`, `proxy`, `shadow`, `connect` | STOA gateway runtime mode ([ADR-024](/docs/architecture/adr/adr-024-gateway-unified-modes)) |
| `endpoints` | `object` | — | `x-kubernetes-preserve-unknown-fields: true`; subfields: `publicUrl`, `targetGatewayUrl`, `uiUrl`, `internalUrl`, `adminUrl`, `healthUrl` | Logical endpoint map for the gateway instance |
| `authConfig` | `object` | — | `x-kubernetes-preserve-unknown-fields: true` | Admin API authentication reference (always reference Kubernetes `Secret`s rather than inline credentials) |
| `capabilities` | `string[]` | `[]` | Array of strings (e.g., `rest`, `graphql`, `websocket`, `oidc`, `rate_limiting`, `mcp`) | Declared gateway capabilities |
| `version` | `string` | — | String | Gateway software version |
| `tags` | `string[]` | `[]` | Array of strings | Arbitrary labels/tags for filtering |

## Status Subresource (`status`)

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `phase` | `string` | Enum: `online`, `offline`, `degraded`, `maintenance` | Reconciled gateway health phase |
| `lastHealthCheck` | `string` | — | Timestamp of the last successful health check |
| `healthDetails` | `object` | `x-kubernetes-preserve-unknown-fields: true` | Last health check payload |
| `error` | `string` | — | Error message if the last health check failed |

*(Implementation note: on `main`, `stoa-operator` also attempts to patch `status.cpGatewayId` — which is not yet declared in `status.properties` — and writes `status.phase: "error"` on registration failure, which is rejected by Kubernetes schema validation because `error` is outside the `[online, offline, degraded, maintenance]` enum.)*

`kubectl get gatewayinstances` (or `kubectl get gwi`) displays `Type` (`.spec.gatewayType`), `Environment` (`.spec.environment`), and `Status` (`.status.phase`), plus `URL` and `Topology` with `-o wide`.

## Related Resources

- [GatewayBinding CRD](./gateway-binding.md) — Bind catalog APIs and policies onto a `GatewayInstance`
- [Multi-Gateway Setup](/docs/guides/multi-gateway-setup) — Multi-gateway orchestration guide
- [ADR-035: Gateway Adapter Pattern](/docs/architecture/adr/adr-035-gateway-adapter-pattern)
