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

:::note Schema vs `stoa-operator` Behavior (`gateway_binding.py`)
On current `main`, `on_gwb_create` (`stoa-operator/src/handlers/gateway_binding.py`) resolves **only** `spec.apiRef.name` and `spec.gatewayRef.name` against the Control Plane API (`apiRef.version` and `gatewayRef.namespace` are not used during lookup), does **not** apply `contractRef`, `desiredState`, or `policies`, and calls `cp_client.create_deployment(api_id, gateway_id)` whose returned Control Plane `deployment_id` is written into `status.gatewayResourceId`.
:::

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `apiRef.version` | `string` | String | Specific API version declared in schema (not used in `stoa-operator` lookup on `main`) |
| `gatewayRef.namespace` | `string` | String | Target `GatewayInstance` namespace declared in schema (not used in `stoa-operator` lookup on `main`) |
| `contractRef` | `object` | Subfields: `name` (`string`), `namespace` (`string`) | Optional UAC reference declared in schema (not applied by `stoa-operator` on `main`) |
| `desiredState` | `object` | `x-kubernetes-preserve-unknown-fields: true` | Desired configuration object declared in schema (not applied by `stoa-operator` on `main`) |
| `policies` | `object[]` | Array of `{name, type, config}` | Binding policies declared in schema (not applied by `stoa-operator` on `main`) |
| `policies[].name` | `string` | String | Policy identifier |
| `policies[].type` | `string` | String (e.g., `rate_limit`, `cors`, `request_validation`) | Policy type |
| `policies[].config` | `object` | `x-kubernetes-preserve-unknown-fields: true` | Policy configuration object |

## Status Subresource (`status`)

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `syncStatus` | `string` | Enum: `pending`, `syncing`, `synced`, `drifted`, `error`, `deleting` | Synchronization lifecycle state |
| `actualState` | `object` | `x-kubernetes-preserve-unknown-fields: true` | State reported back by the target gateway |
| `gatewayResourceId` | `string` | String | Control Plane deployment ID written by `stoa-operator` (`create_deployment`) |
| `lastSyncAttempt` | `string` | String | Timestamp of the most recent synchronization attempt |
| `lastSyncSuccess` | `string` | String | Timestamp of the most recent successful synchronization |
| `syncAttempts` | `integer` | Integer | Cumulative synchronization attempt count |
| `syncError` | `string` | String | Error message from the most recent failed synchronization |

`kubectl get gatewaybindings` (or `kubectl get gwb`) displays `API` (`.spec.apiRef.name`), `Gateway` (`.spec.gatewayRef.name`), `Sync` (`.status.syncStatus`), and `Age`.

## Related Resources

- [GatewayInstance CRD](./gateway-instance.md) — Register target gateway instances
- [Multi-Gateway Setup](/docs/guides/multi-gateway-setup) — Multi-gateway orchestration guide
- [OPA Policies](/docs/guides/opa-policies) — Policy authoring guide
