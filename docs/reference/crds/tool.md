---
sidebar_position: 2
title: "Tool CRD"
description: "Tool CRD specification (tools.gostoa.dev) — define individual HTTP-backed MCP tools as Kubernetes resources."
keywords: [Tool CRD, Kubernetes, MCP, custom resource, gostoa.dev]
---

# Tool CRD

The `Tool` CRD (`charts/stoa-platform/crds/tools.gostoa.dev.yaml`) defines an individual HTTP-backed MCP tool watched dynamically by `stoa-gateway` when compiled with the `k8s` Cargo feature and started with `STOA_K8S_ENABLED=true`.

## Resource Metadata

| Field | Value |
|-------|-------|
| **CRD Name** | `tools.gostoa.dev` |
| **API Version** | `gostoa.dev/v1alpha1` |
| **Kind** | `Tool` |
| **Short Name** | `tool` |
| **Scope** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`, exports `{namespace}_{snake_case(metadata.name)}`) |

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
  annotations:
    readOnly: false
    destructive: false
    idempotent: false
    openWorld: true
```
*(In namespace `tenant-acme`, `metadata.name: payment-create` registers in `stoa-gateway` under the MCP tool name `tenant-acme_payment_create`.)*

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
| `auth` | `string` | `none` | Enum: `bearer`, `service_account`, `none` | Declared in CRD schema, **not read** by `CrdWatcher` on `main` |
| `rateLimit` | `string` | — | Expression string (e.g., `100/min`, `1000/hour`) | Declared in CRD schema, **not enforced** by `CrdWatcher` on `main` |
| `annotations.readOnly` | `boolean` | — | Boolean | Hints that the tool does not mutate state |
| `annotations.destructive` | `boolean` | — | Boolean | Hints that the tool performs destructive mutations |
| `annotations.idempotent` | `boolean` | — | Boolean | Hints that repeated calls with identical args are safe |
| `annotations.openWorld` | `boolean` | — | Boolean | Hints that the tool interacts with external systems |

*(Note: `CrdWatcher::handle_tool_apply` (`stoa-gateway/src/k8s/watcher.rs`) constructs `DynamicTool` from `description`, `endpoint`, `method`, `inputSchema`, `outputSchema`, and `annotations`; `spec.auth` and `spec.rateLimit` are validated by the CRD schema but currently ignored by the Rust watcher. To generate `Tool` manifests automatically from an OpenAPI specification, use [`stoactl bridge <spec-file>`](/docs/reference/cli).)*

## Status Subresource (`status`)

The CRD defines `.status` fields (`registered`, `lastSeen`, `error`) and printer columns (`Display Name`, `Endpoint`, `Registered`). Note that `CrdWatcher` on `main` registers tools in memory without patching `.status` back to the Kubernetes API server, so `.status.registered` remains unset unless written by an external controller:

| Field | Type | Description |
|-------|------|-------------|
| `registered` | `boolean` | Schema field for registration state (not patched by `CrdWatcher` on `main`) |
| `lastSeen` | `string` | Schema field for last watcher timestamp (not patched by `CrdWatcher` on `main`) |
| `error` | `string` | Schema field for registration error details |

## Related Resources

- [ToolSet CRD](./toolset.md) — Expose tools from an upstream MCP server
- [Skill CRD](./skill.md) — Inject scoped system-prompt instructions for tools
- [ADR-006: Tool Registry Architecture](/docs/architecture/adr/adr-006-tool-registry-architecture)
