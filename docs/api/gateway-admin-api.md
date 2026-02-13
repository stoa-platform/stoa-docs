---
sidebar_position: 3
title: "Gateway Admin API Reference"
description: "Complete reference for the STOA Gateway admin API — API route management, policies, circuit breakers, cache, sessions, mTLS, and quotas."
keywords:
  - gateway admin API
  - API route management
  - circuit breaker
  - cache management
  - quota management
---

# Gateway Admin API

Complete reference for the STOA Gateway administrative endpoints. These endpoints are used by the Control Plane to manage routes, policies, and runtime state.

## Authentication

All `/admin/*` endpoints require a Bearer token configured as the gateway's admin API token:

```bash
curl -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${STOA_GATEWAY_URL}/admin/health"
```

| Response | Meaning |
|----------|---------|
| `200 OK` | Authenticated, request processed |
| `401 Unauthorized` | Missing or invalid admin token |
| `503 Service Unavailable` | Admin API disabled (no token configured) |

---

## Health

### GET /admin/health

Returns gateway status and statistics.

```bash
curl "${STOA_GATEWAY_URL}/admin/health" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

```json
{
  "status": "ok",
  "version": "0.12.0",
  "routes_count": 42,
  "policies_count": 15
}
```

---

## API Route Management

### POST /admin/apis

Create or update an API route (upsert).

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/apis" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "api-123",
    "name": "payments",
    "tenant_id": "acme",
    "path_prefix": "/apis/acme/payments",
    "backend_url": "https://api.example.com",
    "methods": ["GET", "POST", "PUT"],
    "spec_hash": "abc123def456",
    "activated": true
  }'
```

| Status | Meaning |
|--------|---------|
| `201 Created` | New route created |
| `200 OK` | Existing route updated |

### GET /admin/apis

List all registered API routes.

```json
[
  {
    "id": "api-123",
    "name": "payments",
    "tenant_id": "acme",
    "path_prefix": "/apis/acme/payments",
    "backend_url": "https://api.example.com",
    "methods": ["GET", "POST"],
    "spec_hash": "abc123",
    "activated": true
  }
]
```

### GET /admin/apis/:id

Get a single API route by ID. Returns `404 Not Found` if the route doesn't exist.

### DELETE /admin/apis/:id

Remove an API route. Returns `204 No Content` on success, `404 Not Found` if missing. Delete is idempotent — deleting a non-existent route is safe.

---

## Policy Management

### POST /admin/policies

Create or update a policy (upsert). Policies apply rate limits, CORS, and other rules to API routes.

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/policies" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "policy-123",
    "name": "rate-limit-gold",
    "policy_type": "rate_limit",
    "config": {
      "limit": 1000,
      "window_secs": 60
    },
    "priority": 1,
    "api_id": "api-123"
  }'
```

| Status | Meaning |
|--------|---------|
| `201 Created` | New policy created |
| `200 OK` | Existing policy updated |

### GET /admin/policies

List all policies.

### DELETE /admin/policies/:id

Remove a policy. Returns `204 No Content` or `404 Not Found`.

---

## Circuit Breaker Management

The gateway uses circuit breakers to protect against backend failures. When a backend fails repeatedly, the circuit opens and requests are rejected fast instead of waiting for timeouts.

### GET /admin/circuit-breaker/stats

Get the main circuit breaker statistics (Control Plane API connection).

```json
{
  "name": "cp-api-breaker",
  "state": "closed",
  "success_count": 1234,
  "failure_count": 5,
  "consecutive_failures": 0,
  "open_count": 2,
  "rejected_count": 0
}
```

| State | Meaning |
|-------|---------|
| `closed` | Normal operation — requests flow through |
| `open` | Backend failing — requests rejected immediately |
| `half_open` | Testing recovery — limited requests allowed |

### POST /admin/circuit-breaker/reset

Reset the main circuit breaker to `closed` state.

```json
{
  "status": "ok",
  "message": "Circuit breaker reset to closed"
}
```

### GET /admin/circuit-breakers

List all per-upstream circuit breakers (one per backend URL).

### POST /admin/circuit-breakers/:name/reset

Reset a specific upstream circuit breaker. Returns `404` if the named breaker doesn't exist.

---

## Cache Management

The gateway caches API key validations and tool responses to reduce latency.

### GET /admin/cache/stats

```json
{
  "hits": 523,
  "misses": 127,
  "entry_count": 45,
  "hit_rate": 0.804
}
```

### POST /admin/cache/clear

Clear all cached entries. Use after key rotations or policy changes that need immediate effect.

```json
{
  "status": "ok",
  "message": "Cache cleared"
}
```

---

## Session Management

SSE sessions for MCP protocol connections are tracked by the gateway.

### GET /admin/sessions/stats

```json
{
  "active_sessions": 42,
  "zombie_count": 2,
  "tracked_sessions": 44
}
```

| Field | Description |
|-------|-------------|
| `active_sessions` | Sessions with recent activity |
| `zombie_count` | Sessions past TTL, pending cleanup |
| `tracked_sessions` | Total sessions in memory |

---

## mTLS Configuration

### GET /admin/mtls/config

Get current mTLS configuration.

```json
{
  "enabled": true,
  "require_client_cert": true,
  "trusted_proxies": "[redacted]"
}
```

### GET /admin/mtls/stats

Get mTLS validation statistics.

```json
{
  "total_requests": 1000,
  "cert_validated": 950,
  "cert_missing": 30,
  "cert_invalid": 20
}
```

---

## Quota Management

### GET /admin/quotas

List quota statistics for all consumers.

```json
[
  {
    "consumer_id": "user-123",
    "daily_count": 450,
    "daily_limit": 1000,
    "monthly_count": 12500,
    "monthly_limit": 50000,
    "daily_remaining": 550,
    "monthly_remaining": 37500
  }
]
```

### GET /admin/quotas/:consumer_id

Get quota statistics for a specific consumer. Returns `404` if the consumer has no quota data.

### POST /admin/quotas/:consumer_id/reset

Reset quota counters for a consumer (daily and monthly counts reset to zero).

```json
{
  "status": "ok",
  "message": "Quota reset for consumer 'user-123'"
}
```

---

## Health Probes

These endpoints are for Kubernetes liveness and readiness probes (no authentication required):

| Endpoint | Purpose |
|----------|---------|
| `GET /health/ready` | Readiness probe — gateway can serve traffic |
| `GET /health/live` | Liveness probe — gateway process is alive |

---

## Endpoint Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/health` | GET | Gateway health + statistics |
| `/admin/apis` | POST | Create/update API route |
| `/admin/apis` | GET | List all API routes |
| `/admin/apis/:id` | GET | Get single API route |
| `/admin/apis/:id` | DELETE | Remove API route |
| `/admin/policies` | POST | Create/update policy |
| `/admin/policies` | GET | List all policies |
| `/admin/policies/:id` | DELETE | Remove policy |
| `/admin/circuit-breaker/stats` | GET | Main CB statistics |
| `/admin/circuit-breaker/reset` | POST | Reset main CB |
| `/admin/circuit-breakers` | GET | List per-upstream CBs |
| `/admin/circuit-breakers/:name/reset` | POST | Reset specific CB |
| `/admin/cache/stats` | GET | Cache statistics |
| `/admin/cache/clear` | POST | Clear all cache |
| `/admin/sessions/stats` | GET | SSE session statistics |
| `/admin/mtls/config` | GET | mTLS configuration |
| `/admin/mtls/stats` | GET | mTLS statistics |
| `/admin/quotas` | GET | List consumer quotas |
| `/admin/quotas/:consumer_id` | GET | Get consumer quota |
| `/admin/quotas/:consumer_id/reset` | POST | Reset consumer quota |
| `/health/ready` | GET | K8s readiness probe |
| `/health/live` | GET | K8s liveness probe |

## Related

- [MCP Gateway API](/docs/api/mcp-gateway) — MCP protocol endpoints
- [Control Plane API](/docs/api/control-plane) — Management API
- [Quota Enforcement](/docs/reference/quotas) — Quota model and enforcement
- [RBAC Permissions](/docs/reference/rbac-permissions) — Access control
