---
sidebar_position: 3
title: "ToolSet CRD"
description: "ToolSet CRD specification (toolsets.gostoa.dev) — connect an upstream MCP server over SSE or Streamable HTTP and expose its tools through STOA Gateway."
keywords: [ToolSet CRD, Kubernetes, MCP, upstream server, SSE, streamable-http, gostoa.dev]
---

# ToolSet CRD

The `ToolSet` CRD (`charts/stoa-platform/crds/toolsets.gostoa.dev.yaml`) connects an external or internal upstream MCP server (`sse` or `streamable-http`) and registers its discovered tools in `stoa-gateway`.

:::info OpenAPI-to-Tool Generation vs `ToolSet`
`ToolSet` federates a live **upstream MCP server**. To generate individual `Tool` CRDs statically from an OpenAPI specification, use [`stoactl bridge <openapi.yaml>`](/docs/reference/cli).
:::

## Resource Metadata

| Field | Value |
|-------|-------|
| **CRD Name** | `toolsets.gostoa.dev` |
| **API Version** | `gostoa.dev/v1alpha1` |
| **Kind** | `ToolSet` |
| **Short Name** | `ts` |
| **Scope** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`) |

## Complete Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: crm-mcp-upstream
  namespace: tenant-acme
spec:
  upstream:
    url: https://crm-mcp.internal.example.com/mcp
    transport: streamable-http
    timeoutSeconds: 30
    auth:
      type: bearer
      secretRef: crm-mcp-token
  tools:
    - search_contacts
    - get_account
  prefix: "crm_"
status:
  connected: true
  toolCount: 2
  discoveredTools:
    - crm_search_contacts
    - crm_get_account
  lastSync: "2026-11-01T12:00:00Z"
```

## Spec Fields (`openAPIV3Schema`)

### Required Fields

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `upstream` | `object` | Required (`upstream.url` required) | Connection settings for the upstream MCP server |
| `upstream.url` | `string` | Required | Upstream MCP server endpoint URL |

### Optional Fields

| Field | Type | Default | Enforced Values / Constraints | Description |
|-------|------|---------|-------------------------------|-------------|
| `upstream.transport` | `string` | `sse` | Enum: `sse`, `streamable-http` | MCP transport protocol used to reach `upstream.url` |
| `upstream.timeoutSeconds` | `integer` | — | Integer | Connection and request timeout in seconds |
| `upstream.auth.type` | `string` | — | Enum: `bearer`, `header` | Upstream authentication scheme |
| `upstream.auth.secretRef` | `string` | — | String | Kubernetes `Secret` name containing the upstream credential |
| `upstream.auth.headerName` | `string` | — | String | Custom HTTP header name when `upstream.auth.type: header` |
| `tools` | `string[]` | `[]` | Array of strings | Allowlist of upstream tool names to expose (empty array `[]` exposes all discovered tools) |
| `prefix` | `string` | — | String | Optional prefix prepended to exposed tool names to avoid collisions |

## Status Subresource (`status`)

| Field | Type | Description |
|-------|------|-------------|
| `connected` | `boolean` | Whether `stoa-gateway` is currently connected to the upstream MCP server |
| `toolCount` | `integer` | Number of tools discovered and registered |
| `discoveredTools` | `string[]` | Names of registered tools |
| `lastSync` | `string` | Timestamp of the last successful upstream discovery sync |
| `error` | `string` | Error message if upstream connection or discovery failed |

`kubectl get toolsets` (or `kubectl get ts`) displays `Upstream` (`.spec.upstream.url`), `Tools` (`.status.toolCount`), and `Connected` (`.status.connected`).

## Related Resources

- [Tool CRD](./tool.md) — Individual HTTP-backed MCP tool
- [Skill CRD](./skill.md) — Scoped system-prompt context instructions
- [CLI Reference (`stoactl bridge`)](/docs/reference/cli) — Generate `Tool` CRDs from OpenAPI specs
