---
sidebar_position: 6
title: "GatewayBinding CRD"
description: "GatewayBinding CRD specification (gatewaybindings.gostoa.dev) — declaratively bind API catalog entries, UAC contracts, and policies onto a GatewayInstance."
keywords: [GatewayBinding CRD, Kubernetes, stoa-operator, policy binding, gostoa.dev]
---

# GatewayBinding CRD

The `GatewayBinding` CRD (`charts/stoa-platform/crds/gatewaybindings.gostoa.dev.yaml`) declaratively binds an API catalog entry (and optional UAC contract and inline policies) onto a target [`GatewayInstance`](./gateway-instance.md). It is reconciled by `stoa-operator` (`stoa-operator/src/handlers/gateway_binding.py`).

## Resource Metadata

| Field | Value |
|-------|-------|
| **CRD Name** | `gatewaybindings.gostoa.dev` |
| **API Version** | `gostoa.dev/v1alpha1` |
| **Kind** | `GatewayBinding` |
| **Short Name** | `gwb` |
| **Scope** | `Namespaced` |
| **Reconciler** | `stoa-operator` (Python/Kopf, Beta) |

## Complete Example

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

## Spec Fields (`openAPIV3Schema`)

### Required Fields

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `apiRef` | `object` | Required (`apiRef.name` required) | Reference to the Control Plane API catalog entry |
| `apiRef.name` | `string` | Required | API catalog entry name/identifier |
| `gatewayRef` | `object` | Required (`gatewayRef.name` required) | Reference to the target `GatewayInstance` |
| `gatewayRef.name` | `string` | Required | Name of the target `GatewayInstance` |

### Optional Fields

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `apiRef.version` | `string` | String | Specific API version to bind |
| `gatewayRef.namespace` | `string` | String | Namespace of the target `GatewayInstance` (when cross-namespace) |
| `contractRef` | `object` | Subfields: `name` (`string`), `namespace` (`string`) | Optional reference to a Universal API Contract (UAC) |
| `desiredState` | `object` | `x-kubernetes-preserve-unknown-fields: true` | Gateway-specific desired configuration payload |
| `policies` | `object[]` | Array of `{name, type, config}` | Policies attached to this binding |
| `policies[].name` | `string` | String | Policy identifier |
| `policies[].type` | `string` | String (e.g., `rate_limit`, `cors`, `request_validation`) | Policy type |
| `policies[].config` | `object` | `x-kubernetes-preserve-unknown-fields: true` | Policy configuration object |

## Status Subresource (`status`)

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `syncStatus` | `string` | Enum: `pending`, `syncing`, `synced`, `drifted`, `error`, `deleting` | Synchronization lifecycle state |
| `actualState` | `object` | `x-kubernetes-preserve-unknown-fields: true` | State reported back by the target gateway |
| `gatewayResourceId` | `string` | String | External resource identifier assigned by the target gateway |
| `lastSyncAttempt` | `string` | String | Timestamp of the most recent synchronization attempt |
| `lastSyncSuccess` | `string` | String | Timestamp of the most recent successful synchronization |
| `syncAttempts` | `integer` | Integer | Cumulative synchronization attempt count |
| `syncError` | `string` | String | Error message from the most recent failed synchronization |

`kubectl get gatewaybindings` (or `kubectl get gwb`) displays `API` (`.spec.apiRef.name`), `Gateway` (`.spec.gatewayRef.name`), `Sync` (`.status.syncStatus`), and `Age`.

## Related Resources

- [GatewayInstance CRD](./gateway-instance.md) — Register target gateway instances
- [Multi-Gateway Setup](/docs/guides/multi-gateway-setup) — Multi-gateway orchestration guide
- [OPA Policies](/docs/guides/opa-policies) — Policy authoring guide
