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
      secretRef: crm-mcp-token   # K8s Secret name in `tenant-acme` (reads key `token`)
  tools:
    - search_contacts
    - get_account
  prefix: "crm_"
```
*(Registered tool names follow `{prefix}{namespace}_{snake_case(tool_name)}`: with `prefix: "crm_"` in `tenant-acme`, `CrdWatcher` registers `crm_tenant-acme_search_contacts` and `crm_tenant-acme_get_account`.)*

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
| `upstream.timeoutSeconds` | `integer` | `30` (runtime) | Integer | Connection and request timeout in seconds (`unwrap_or(30)` in `CrdWatcher`) |
| `upstream.auth.type` | `string` | — | Enum: `bearer`, `header` | Declared in CRD schema; runtime `UpstreamMcpClient` currently sends `Authorization: Bearer <token>` whenever a Secret token is loaded |
| `upstream.auth.secretRef` | `string` | — | String | Name of the Kubernetes `Secret` in the same namespace (`CrdWatcher` reads key `token` by default) |
| `upstream.auth.headerName` | `string` | — | String | Declared in CRD schema for `type: header`, **not read** by `UpstreamMcpClient` on `main` |
| `tools` | `string[]` | `[]` | Array of strings | Allowlist of upstream tool names to expose (empty array `[]` exposes all discovered tools) |
| `prefix` | `string` | `""` | String | Prefix prepended before `{namespace}_{snake_case(tool_name)}` (e.g., `crm_tenant-acme_search_contacts`) |

## Status Subresource (`status`)

The CRD defines `.status` fields (`connected`, `toolCount`, `discoveredTools`, `lastSync`, `error`) and printer columns (`Upstream`, `Tools`, `Connected`). On `main`, `CrdWatcher` registers federated tools in memory without patching `.status` back to the Kubernetes API server:

| Field | Type | Description |
|-------|------|-------------|
| `connected` | `boolean` | Schema field for upstream connectivity (not patched by `CrdWatcher` on `main`) |
| `toolCount` | `integer` | Schema field for registered tool count (not patched by `CrdWatcher` on `main`) |
| `discoveredTools` | `string[]` | Schema field for registered tool names |
| `lastSync` | `string` | Schema field for last discovery sync timestamp |
| `error` | `string` | Schema field for upstream connection or discovery error |

## Related Resources

- [Tool CRD](./tool.md) — Individual HTTP-backed MCP tool
- [Skill CRD](./skill.md) — Scoped system-prompt context instructions
- [CLI Reference (`stoactl bridge`)](/docs/reference/cli) — Generate `Tool` CRDs from OpenAPI specs
