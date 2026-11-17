---
sidebar_position: 2
title: "Tool CRD"
description: "Tool CRD specification (tools.gostoa.dev) — define individual HTTP-backed MCP tools as Kubernetes resources."
keywords: [Tool CRD, Kubernetes, MCP, custom resource, gostoa.dev]
---

# Tool CRD

The `Tool` CRD (`charts/stoa-platform/crds/tools.gostoa.dev.yaml`) defines an individual HTTP-backed MCP tool watched dynamically by `stoa-gateway` when `STOA_K8S_WATCHER_ENABLED=true`.

## Resource Metadata

| Field | Value |
|-------|-------|
| **CRD Name** | `tools.gostoa.dev` |
| **API Version** | `gostoa.dev/v1alpha1` |
| **Kind** | `Tool` |
| **Short Name** | `tool` |
| **Scope** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`) |

## Complete Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: payment-create
  namespace: tenant-acme
spec:
  displayName: Create Payment
  description: Create a new payment transaction
  endpoint: https://payments.internal.example.com/v2/payments
  method: POST
  inputSchema:
    type: object
    properties:
      amount:
        type: number
        description: Payment amount in cents
      currency:
        type: string
        enum: [EUR, USD, GBP]
        default: EUR
      recipient:
        type: string
        description: Recipient account ID
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

## Spec Fields (`openAPIV3Schema`)

### Required Fields

All five fields below are enforced as `required` by the CRD schema:

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `displayName` | `string` | Required | Human-readable display name |
| `description` | `string` | Required | Tool description exposed to LLM agents |
| `endpoint` | `string` | Required | Upstream HTTP(S) endpoint URL |
| `method` | `string` | Enum: `GET`, `POST`, `PUT`, `DELETE`, `PATCH` | HTTP method used when invoking `endpoint` |
| `inputSchema` | `object` | `x-kubernetes-preserve-unknown-fields: true` | JSON Schema describing tool input arguments |

### Optional Fields

| Field | Type | Default | Enforced Values / Constraints | Description |
|-------|------|---------|-------------------------------|-------------|
| `outputSchema` | `object` | — | `x-kubernetes-preserve-unknown-fields: true` | Optional JSON Schema for tool output |
| `auth` | `string` | `none` | Enum: `bearer`, `service_account`, `none` | Upstream authentication mode |
| `rateLimit` | `string` | — | Expression string (e.g., `100/min`, `1000/hour`) | Per-tool rate limit expression |
| `annotations.readOnly` | `boolean` | — | Boolean | Hints that the tool does not mutate state |
| `annotations.destructive` | `boolean` | — | Boolean | Hints that the tool performs destructive mutations |
| `annotations.idempotent` | `boolean` | — | Boolean | Hints that repeated calls with identical args are safe |
| `annotations.openWorld` | `boolean` | — | Boolean | Hints that the tool interacts with external systems |

*(Note: to generate `Tool` manifests automatically from an OpenAPI specification, use [`stoactl bridge <spec-file>`](/docs/reference/cli).)*

## Status Subresource (`status`)

| Field | Type | Description |
|-------|------|-------------|
| `registered` | `boolean` | Whether the tool is currently registered in `stoa-gateway` |
| `lastSeen` | `string` | Timestamp of the last watcher update |
| `error` | `string` | Error message if registration failed |

`kubectl get tools` displays `Display Name` (`.spec.displayName`), `Endpoint` (`.spec.endpoint`), and `Registered` (`.status.registered`).

## Related Resources

- [ToolSet CRD](./toolset.md) — Expose tools from an upstream MCP server
- [Skill CRD](./skill.md) — Inject scoped system-prompt instructions for tools
- [ADR-006: Tool Registry Architecture](/docs/architecture/adr/adr-006-tool-registry-architecture)
