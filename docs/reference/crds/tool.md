---
sidebar_position: 2
title: "Tool CRD"
description: "Tool CRD specification — define individual MCP tools as Kubernetes resources for AI agent invocation."
keywords: [Tool CRD, Kubernetes, MCP, custom resource]
---

# Tool CRD

The `Tool` CRD defines an individual MCP tool that AI agents can invoke.

## GroupVersionKind

| Field | Value |
|-------|-------|
| Group | `gostoa.dev` |
| Version | `v1alpha1` |
| Kind | `Tool` |

## Complete Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: payment-create
  namespace: tenant-acme
  labels:
    app.kubernetes.io/part-of: payment-api
  annotations:
    gostoa.dev/api-ref: payment-api/v2
spec:
  displayName: Create Payment
  description: Create a new payment transaction
  endpoint: https://api.gostoa.dev/acme/payment-api/v2/payments
  method: POST
  version: "2.0.0"
  tags:
    - payments
    - transactions
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
  authentication:
    type: bearer
    secretRef:
      name: payment-api-token
      key: token
  rateLimit:
    requestsPerMinute: 100
    burst: 20
  timeout: "30s"
  enabled: true
status:
  phase: Registered
  registeredAt: "2026-02-06T10:00:00Z"
  lastSyncedAt: "2026-02-06T12:00:00Z"
  invocationCount: 1542
  errorCount: 12
```

## Spec Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | Human-readable name (1-64 chars) |
| `description` | string | Tool description for AI context (1-1024 chars) |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `endpoint` | string | - | HTTP endpoint URL |
| `method` | enum | `POST` | HTTP method: GET, POST, PUT, PATCH, DELETE |
| `inputSchema` | object | `{}` | JSON Schema for tool parameters |
| `tags` | array | `[]` | Categorization tags |
| `version` | string | `1.0.0` | Tool version |
| `timeout` | string | `30s` | Request timeout (e.g., "30s", "1m") |
| `enabled` | boolean | `true` | Enable/disable tool |

### Authentication Configuration

```yaml
spec:
  authentication:
    type: bearer       # none, bearer, basic, apiKey, oauth2
    secretRef:
      name: api-secret # Secret name in same namespace
      key: token       # Key within the secret
    headerName: Authorization  # Custom header (default: Authorization)
```

### Rate Limiting

```yaml
spec:
  rateLimit:
    requestsPerMinute: 60  # Requests per minute (1-10000)
    burst: 10              # Burst allowance (1-1000)
```

### API Reference

Link tool to source API:

```yaml
spec:
  apiRef:
    name: payment-api
    version: v2
    operationId: createPayment
```

## Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | enum | Pending, Registered, Error, Disabled |
| `registeredAt` | datetime | When tool was registered |
| `lastSyncedAt` | datetime | Last sync timestamp |
| `invocationCount` | integer | Total invocations |
| `errorCount` | integer | Total errors |
| `lastError` | string | Most recent error message |
| `conditions` | array | Kubernetes-style conditions |

### Phases

| Phase | Description |
|-------|-------------|
| `Pending` | Tool created, awaiting registration |
| `Registered` | Tool active and available |
| `Error` | Registration failed |
| `Disabled` | Tool manually disabled |

## Validation Rules

1. **Unique name per namespace** — Tool names must be unique within a namespace
2. **Valid JSON Schema** — `inputSchema` must be valid JSON Schema draft-07
3. **Valid endpoint** — If provided, must be a valid HTTP(S) URL
4. **Secret must exist** — Referenced secrets must exist in the same namespace

## Examples

### Simple Tool (No Auth)

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: echo
  namespace: tenant-demo
spec:
  displayName: Echo
  description: Returns the input message
  method: GET
  inputSchema:
    type: object
    properties:
      message:
        type: string
```

### Tool with OAuth2

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: salesforce-query
  namespace: tenant-enterprise
spec:
  displayName: Salesforce Query
  description: Execute SOQL query on Salesforce
  endpoint: https://login.salesforce.com/services/data/v58.0/query
  method: GET
  authentication:
    type: oauth2
    secretRef:
      name: salesforce-oauth
      key: access_token
  inputSchema:
    type: object
    properties:
      q:
        type: string
        description: SOQL query
    required:
      - q
```

### Tool with API Key

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: openai-completion
  namespace: tenant-ai
spec:
  displayName: OpenAI Completion
  description: Generate text completion
  endpoint: https://api.openai.com/v1/completions
  method: POST
  authentication:
    type: apiKey
    headerName: Authorization
    secretRef:
      name: openai-key
      key: api-key
  timeout: "60s"
  rateLimit:
    requestsPerMinute: 20
    burst: 5
```

## Related Resources

- [ToolSet CRD](./toolset.md) — Generate multiple tools from OpenAPI
- [ADR-006 — Tool Registry Architecture](/docs/architecture/adr/adr-006-tool-registry-architecture)
