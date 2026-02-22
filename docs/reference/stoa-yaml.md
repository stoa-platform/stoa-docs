---
sidebar_position: 3
title: "stoa.yaml Reference"
description: "Complete field reference for stoa.yaml — the declarative API deployment spec used by stoactl, Console UI, and MCP Copilot."
keywords: [stoa.yaml, declarative, API deployment, CLI, GitOps, reference, spec]
---

# stoa.yaml Reference

`stoa.yaml` is the declarative API configuration format for STOA Platform. It is used as the input for:

- **`stoactl deploy ./stoa.yaml`** — CLI-driven deployment
- **Console UI** — Import / Export via the API form
- **MCP Copilot** — AI-generated and AI-validated deployments

See [ADR-045](/docs/architecture/adr/adr-045-stoa-yaml-declarative-spec) for the full design rationale.

---

## Minimal Example

```yaml
name: customer-api
version: 1.2.0
```

Deploys with default settings: rate limit `1000 req/min`, no auth, no endpoint filtering.

---

## Full Example

```yaml
name: customer-api
version: 2.0.0
tags:
  - payments
  - crm

endpoints:
  - path: /customers
    method: GET
    description: List all customers
    tags: [read]
  - path: /customers/{id}
    method: GET
    description: Get customer by ID
  - path: /customers
    method: POST
    description: Create a new customer
    tags: [write]

rate_limit:
  requests_per_minute: 1000
  burst: 50

auth:
  type: oauth2
  issuer: ${STOA_AUTH_URL}/realms/acme
  required: true
```

---

## Field Reference

### Top-level fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | **Yes** | — | API unique identifier. Max 255 characters. Used as the API name in the Control Plane. |
| `version` | string | No | `1.0.0` | Semantic version (e.g. `1.2.0`, `2.0.0-beta`). Must match `MAJOR.MINOR.PATCH` pattern. |
| `tags` | string[] | No | `[]` | Optional tags attached to the API for filtering and grouping. |
| `endpoints` | object[] | No | `[]` | Endpoint definitions. If empty, all traffic passes through without endpoint-level routing. |
| `rate_limit` | object | No | `null` | Rate limiting policy. If absent, no rate limit is applied. |
| `auth` | object | No | `null` | Authentication policy. If absent, no authentication is required. |

---

### `endpoints[]`

Each entry defines an endpoint that should be exposed through the gateway.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `path` | string | **Yes** | — | URL path (e.g. `/customers`, `/users/{id}`). |
| `method` | string | No | `GET` | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. |
| `description` | string | No | `""` | Human-readable description shown in the Console and Portal. |
| `tags` | string[] | No | `[]` | Endpoint-level tags for filtering in the Portal. |

---

### `rate_limit`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `requests_per_minute` | int | **Yes** | — | Maximum requests per minute. Must be > 0. |
| `burst` | int | No | `0` | Burst allowance above `requests_per_minute` for brief spikes. |

**Example:**

```yaml
rate_limit:
  requests_per_minute: 500
  burst: 100
```

---

### `auth`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | string | **Yes** | — | Auth mechanism: `jwt`, `api_key`, `mtls`, `oauth2`, `none`. |
| `issuer` | string | No | — | JWT/OAuth2 issuer URL (e.g. `https://auth.acme.com/realms/prod`). |
| `header` | string | No | — | Custom header name for API key auth (default: `Authorization`). |
| `required` | bool | No | `false` | If `true`, unauthenticated requests are rejected with `401`. If `false`, auth is optional. |

**Auth type values:**

| Value | Description |
|-------|-------------|
| `jwt` | Validate JWT Bearer tokens. Use `issuer` to specify the JWKS endpoint. |
| `api_key` | Validate API keys via header or query param. |
| `oauth2` | OAuth 2.0 token introspection. Use `issuer` for the authorization server. |
| `mtls` | Mutual TLS client certificate validation. |
| `none` | No authentication (passthrough). |

---

## Deployment via CLI

### File-based deploy (recommended)

```bash
stoactl deploy ./stoa.yaml --env production
stoactl deploy ./stoa.yaml --env dev --watch
```

The CLI reads and validates `stoa.yaml` locally before submitting to the Control Plane.

### Validate without deploying

```bash
stoactl validate ./stoa.yaml   # (planned — see roadmap)
```

### Export existing API config

```bash
stoactl get apis customer-api -o yaml > stoa.yaml
```

---

## Environment Variables

Use shell variables in string values to avoid hardcoding environment-specific URLs:

```yaml
auth:
  type: oauth2
  issuer: ${STOA_AUTH_URL}/realms/acme
```

The CLI expands variables from the current shell environment before parsing.

---

## Defaults Summary

| Field | Default when absent |
|-------|---------------------|
| `version` | `1.0.0` |
| `endpoints[].method` | `GET` |
| `auth.required` | `false` |
| `rate_limit` (entire block) | No rate limiting applied |
| `auth` (entire block) | No auth required |

---

## Validation Errors

The CLI validates `stoa.yaml` before sending to the API and returns human-readable errors:

| Error | Cause |
|-------|-------|
| `'name' is required` | `name` field is missing or empty |
| `'name' must be 255 characters or fewer` | Name too long |
| `'version' must be a semantic version` | Invalid format (e.g. `v1.0` instead of `1.0.0`) |
| `endpoints[N].path is required` | An endpoint entry is missing `path` |
| `rate_limit.requests_per_minute must be > 0` | Zero or negative rate limit |
| `auth.type must be one of: jwt, api_key, mtls, oauth2, none` | Unknown auth type |

---

## Related

- [stoactl CLI Reference](/docs/reference/cli) — `stoactl deploy`, `stoactl logs`, `stoactl deploy list`
- [ADR-045: stoa.yaml Declarative API Spec](/docs/architecture/adr/adr-045-stoa-yaml-declarative-spec) — Design rationale and examples
- [Deployment Guide](/docs/guides/environment-management) — Managing environments
