---
sidebar_position: 3
title: "ToolSet CRD"
description: "ToolSet CRD specification — generate multiple Tool resources from an OpenAPI specification automatically."
keywords: [ToolSet CRD, Kubernetes, OpenAPI, custom resource]
---

# ToolSet CRD

The `ToolSet` CRD generates multiple Tool resources from an OpenAPI specification.

## GroupVersionKind

| Field | Value |
|-------|-------|
| Group | `gostoa.dev` |
| Version | `v1alpha1` |
| Kind | `ToolSet` |

## Complete Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: payment-api-tools
  namespace: tenant-acme
spec:
  displayName: Payment API Tools
  description: Tools generated from Payment API OpenAPI spec
  openAPISpec:
    url: https://api.gostoa.dev/acme/payment-api/v2/openapi.json
    refreshInterval: "1h"
  baseURL: https://api.gostoa.dev/acme/payment-api/v2
  selector:
    tags:
      - payments
      - refunds
    excludeTags:
      - internal
      - deprecated
    methods:
      - GET
      - POST
  toolDefaults:
    tags:
      - generated
      - payment-api
    timeout: "30s"
    rateLimit:
      requestsPerMinute: 100
      burst: 20
    authentication:
      type: bearer
      secretRef:
        name: payment-api-token
        key: token
  naming:
    prefix: "payment_"
    useOperationId: true
  enabled: true
status:
  phase: Ready
  toolCount: 12
  tools:
    - payment_create_payment
    - payment_get_payment
    - payment_list_payments
    - payment_create_refund
  lastSyncedAt: "2026-02-06T12:00:00Z"
  specHash: "abc123"
```

## Spec Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | Human-readable name (1-64 chars) |

### OpenAPI Spec Source

Configure where to fetch the OpenAPI specification:

```yaml
spec:
  openAPISpec:
    # Option 1: URL (recommended)
    url: https://api.example.com/openapi.json
    refreshInterval: "1h"  # How often to re-fetch

    # Option 2: ConfigMap
    configMapRef:
      name: api-spec
      key: openapi.yaml

    # Option 3: Secret (for private specs)
    secretRef:
      name: private-api-spec
      key: openapi.json

    # Option 4: Inline (small specs only)
    inline: |
      openapi: "3.0.0"
      info:
        title: My API
        version: "1.0"
      paths: ...
```

### Selector (Filter Operations)

Control which operations become tools:

```yaml
spec:
  selector:
    # Include only these tags
    tags:
      - public
      - v2

    # Exclude these tags
    excludeTags:
      - internal
      - deprecated
      - admin

    # Limit HTTP methods
    methods:
      - GET
      - POST

    # Path prefix filter
    pathPrefix: /api/v2/

    # Specific operations by ID
    operationIds:
      - createUser
      - getUser
      - listUsers
```

### Tool Defaults

Apply defaults to all generated tools:

```yaml
spec:
  toolDefaults:
    tags:
      - generated
    timeout: "30s"
    rateLimit:
      requestsPerMinute: 60
      burst: 10
    authentication:
      type: bearer
      secretRef:
        name: api-token
        key: token
```

### Naming Configuration

Control tool naming:

```yaml
spec:
  naming:
    prefix: "myapi_"           # Prefix all tool names
    suffix: "_v2"              # Suffix all tool names
    useOperationId: true       # Use OpenAPI operationId (recommended)
```

Tool names are generated as: `{prefix}{operationId}{suffix}`

Example: `myapi_createPayment_v2`

## Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | enum | Pending, Syncing, Ready, Error, Disabled |
| `toolCount` | integer | Number of tools generated |
| `tools` | array | List of generated tool names |
| `lastSyncedAt` | datetime | Last successful sync |
| `specHash` | string | Hash of OpenAPI spec (for change detection) |
| `lastError` | string | Most recent error message |
| `conditions` | array | Kubernetes-style conditions |

### Phases

| Phase | Description |
|-------|-------------|
| `Pending` | ToolSet created, awaiting first sync |
| `Syncing` | Currently fetching and processing spec |
| `Ready` | Tools generated and registered |
| `Error` | Sync failed |
| `Disabled` | ToolSet manually disabled |

## Sync Behavior

1. **Initial sync** — On creation, fetches spec and generates tools
2. **Periodic refresh** — Re-fetches at `refreshInterval`
3. **Change detection** — Only regenerates if spec hash changes
4. **Incremental** — Adds new tools, removes deleted operations
5. **Preserves modifications** — Manual tool edits are preserved

## Examples

### From Public URL

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: petstore-tools
  namespace: tenant-demo
spec:
  displayName: Petstore API
  openAPISpec:
    url: https://petstore3.swagger.io/api/v3/openapi.json
    refreshInterval: "24h"
  baseURL: https://petstore3.swagger.io/api/v3
  selector:
    tags:
      - pet
      - store
  enabled: true
```

### From ConfigMap

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: internal-api-tools
  namespace: tenant-corp
spec:
  displayName: Internal API
  openAPISpec:
    configMapRef:
      name: internal-api-spec
      key: openapi.yaml
  baseURL: http://internal-api.corp.svc.cluster.local
  toolDefaults:
    authentication:
      type: none  # Internal service, no auth needed
```

### Filtered by Methods

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: readonly-tools
  namespace: tenant-readonly
spec:
  displayName: Read-Only API Tools
  description: Only GET operations exposed
  openAPISpec:
    url: https://api.example.com/openapi.json
  selector:
    methods:
      - GET
  toolDefaults:
    timeout: "10s"
    rateLimit:
      requestsPerMinute: 200
```

## Troubleshooting

### Tools Not Generated

Check ToolSet status:

```bash
kubectl describe toolset my-toolset -n tenant-acme
```

Common issues:
- Invalid OpenAPI spec URL
- Selector filters too restrictive
- Authentication required for spec URL

### Spec Not Refreshing

Verify `refreshInterval` is set and check logs:

```bash
kubectl logs -l app=mcp-gateway -n stoa-system | grep toolset
```

### Duplicate Tool Names

Ensure `naming.prefix` is unique per ToolSet.

## Related Resources

- [Tool CRD](./tool.md) — Individual tool definition
- [ADR-006 — Tool Registry Architecture](/docs/architecture/adr/adr-006-tool-registry-architecture)
