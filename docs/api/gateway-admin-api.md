---
sidebar_position: 3
title: "Gateway Admin API Reference"
description: "Complete reference for the STOA Gateway admin API — UAC contracts, routes, policies, skills, federation, prompt cache, circuit breakers, sessions, mTLS, and quotas."
keywords:
  - gateway admin API
  - UAC contracts
  - API route management
  - skills management
  - federation
  - circuit breaker
  - cache management
  - quota management
---

# Gateway Admin API

Complete reference for the STOA Gateway (`stoa-gateway`) administrative surface mounted under `/admin/*` (`stoa-gateway/src/handlers/admin/router.rs`). These endpoints are used by the Control Plane and operators to manage UAC contracts, routes, policies, skills, federation, caches, and runtime diagnostics.

## Authentication & Middleware Chain

Every `/admin/*` route passes through three middleware layers (outermost to innermost):

1. **`admin_audit_log`** — Logs all administrative requests (including rate-limited `429` and unauthenticated `401` attempts)
2. **`admin_rate_limit`** — Throttles bearer-probing bursts before authentication
3. **`admin_auth`** — Validates `Authorization: Bearer <token>`

```bash
curl -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
  "${STOA_GATEWAY_URL}/admin/health"
```

| Response | Meaning |
|----------|---------|
| `200 OK` / `201 Created` / `204 No Content` | Authenticated, request processed |
| `401 Unauthorized` | Missing/invalid `STOA_ADMIN_API_TOKEN` (constant-time comparison), or missing strong-auth administrative OIDC JWT when strong authentication is enabled (`WWW-Authenticate: Bearer error="insufficient_user_authentication"`) |
| `429 Too Many Requests` | Admin pre-auth rate limit exceeded |
| `503 Service Unavailable` | Admin API disabled (`STOA_ADMIN_API_TOKEN` is unset or empty — fail-closed) |

---

## Health & Route Reload

### GET /admin/health

Returns gateway status and registry counts.

```bash
curl "${STOA_GATEWAY_URL}/admin/health" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}"
```

```json
{
  "status": "ok",
  "version": "0.12.0",
  "routes_count": 42,
  "policies_count": 15
}
```

### POST /admin/routes/reload

Trigger a hot-reload of dynamic routes from the configured source.

---

## UAC Contract Management

Contract mutations (`stoa-gateway/src/handlers/admin/contracts.rs`) are **transactional** across three in-memory stores (`contract_registry`, `route_registry`, and `tool_registry`):

- **Upsert (`POST /admin/contracts`)** runs *bind-first*: REST routes and MCP tools are bound before committing to `contract_registry` (rolling back partial binds on error).
- **Delete (`DELETE /admin/contracts/:key`)** runs *unbind-first*: both binders must succeed before the contract record is removed.

### POST /admin/contracts

Register or update a Universal API Contract (`201 Created` on insert, `200 OK` on update). `tenant_id` is required, and `"inboundAuth": "jwt"` enforces Keycloak JWT validation on the generated REST route (matching `quickstart/verify.sh` and `stoa-gateway/src/uac/schema.rs`). `perform_upsert` and the REST/MCP binders (`contracts.rs`, `rest.rs`, `mcp.rs`) generate routes and tools unconditionally on upsert — `status` (such as `"published"` in the example payload below) is stored contract metadata rather than a conditional activation gate:

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/contracts" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "echo-service",
    "version": "1.0.0",
    "tenant_id": "acme",
    "status": "published",
    "classification": "H",
    "inboundAuth": "jwt",
    "endpoints": [
      {
        "path": "/ping",
        "methods": ["GET"],
        "backend_url": "http://backend:80",
        "operation_id": "echoPing"
      }
    ]
  }'
```

```json
{
  "key": "acme:echo-service",
  "status": "ok",
  "routes_generated": 1,
  "tools_generated": 1,
  "llm_capabilities": 0
}
```

### GET /admin/contracts

List all registered UAC contracts.

### GET /admin/contracts/:key

Fetch a single contract by its composite key (`{tenant_id}:{name}` by default, e.g., `acme:echo-service`, unless an explicit `key` was passed on upsert). Returns `404` if not found.

### DELETE /admin/contracts/:key

Unbind REST routes and MCP tools for `:key` and delete the contract (`200 OK` with JSON counters `{"status": "deleted", "routes_removed": 1, "tools_removed": 1}`, or `404 Not Found` if missing).

---

## API Route & Proxy Backend Management

### POST /admin/apis

Create or update a low-level API route (`201 Created` or `200 OK`).

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/apis" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
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

### GET /admin/apis

List all registered API routes.

### GET /admin/apis/:id

Get a single API route by ID (`404 Not Found` if missing).

### DELETE /admin/apis/:id

Remove an API route (`204 No Content` or `404 Not Found`).

### GET /admin/api-proxy/backends

List configured internal API proxy backends and their active status (protected by `admin_auth`).

---

## Policy & Credential Management

### POST /admin/policies

Create or update a gateway policy (`201 Created` or `200 OK`).

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/policies" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
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

### GET /admin/policies

List all registered policies.

### DELETE /admin/policies/:id

Remove a policy (`204 No Content` or `404 Not Found`).

### Backend & Consumer Credentials (BYOK)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/backend-credentials` | `GET`, `POST` | List or upsert upstream BYOK credentials per route |
| `/admin/backend-credentials/:route_id` | `DELETE` | Remove backend credential for `:route_id` |
| `/admin/consumer-credentials` | `GET`, `POST` | List or upsert per-consumer credentials |
| `/admin/consumer-credentials/:route_id/:consumer_id` | `DELETE` | Remove consumer credential |

---

## Skills Management

Manage hierarchical context-injection skills (`global` < `tenant` < `tool` < `user` specificity, matching the [`Skill` CRD](/docs/reference/crds/skill)). Literal routes (`/status`, `/resolve`, `/sync`, `/health`) are registered ahead of parametric `/skills/:id`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/skills/status` | `GET` | Skill resolver summary (`enabled`, `cache_ttl_secs`, `skill_count`) |
| `/admin/skills/resolve` | `GET` | Preview resolved instructions (`?tenant_id=<id>` **required**; optional `&tool_ref=<tool>&user_ref=<user>`) |
| `/admin/skills/sync` | `POST` | Atomically replace the in-memory skill registry from a posted JSON array of skill objects (does **not** pull from the Control Plane) |
| `/admin/skills` | `GET`, `POST` | List skills or upsert a skill (`201` on insert, `200` on update) |
| `/admin/skills/:id` | `GET`, `PUT`, `DELETE` | Get, update, or delete a skill by ID (**canonical delete path**) |
| `/admin/skills?key=<key>` | `DELETE` | **Deprecated**: query-based deletion returning `Deprecation` and `Sunset` headers; prefer `DELETE /admin/skills/:id` |
| `/admin/skills/health` | `GET` | Aggregated health status across all skills |
| `/admin/skills/:id/health` | `GET` | Health metrics for a single skill |
| `/admin/skills/:id/health/reset` | `POST` | Reset error/health counters for `:id` |

---

## MCP Federation Management

Inspect and manage upstream MCP server federation and sub-account caches (`stoa-gateway/src/handlers/admin/federation.rs`).

### GET /admin/federation/status

```json
{
  "enabled": true,
  "cache_size": 18,
  "cache_ttl_secs": 300
}
```

### GET /admin/federation/upstreams

Lists configured upstream MCP servers (`url`, `transport`, `has_auth`, `timeout_secs` — credentials are never exposed).

### GET /admin/federation/cache

Returns federation cache hit/miss statistics.

### DELETE /admin/federation/cache/:sub_account_id

Invalidates cached federation state for `:sub_account_id` and reports whether an active entry was purged (`invalidated: true | false`).

---

## Prompt Cache & LLM Cost-Aware Routing

### Prompt Cache

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/prompt-cache/stats` | `GET` | Hit/miss statistics and entry counts |
| `/admin/prompt-cache/patterns` | `GET` | List cached prompt patterns |
| `/admin/prompt-cache/get/:key` | `GET` | Inspect a cached prompt entry by key |
| `/admin/prompt-cache/load` | `POST` | Preload prompt cache entries |
| `/admin/prompt-cache/invalidate` | `POST` | Clear all entries in the prompt cache (`{"status": "cleared"}`, no pattern filter) |

### LLM Routing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/llm/status` | `GET` | LLM router status and active configuration |
| `/admin/llm/providers` | `GET` | Configured LLM providers and health |
| `/admin/llm/costs` | `GET` | Aggregated LLM cost and token telemetry |

---

## Circuit Breaker Management

### GET /admin/circuit-breaker/stats

Get the main Control Plane circuit breaker statistics (`closed`, `open`, `half_open`).

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

### POST /admin/circuit-breaker/reset

Reset the main circuit breaker to `closed`.

### GET /admin/circuit-breakers

List all per-upstream circuit breakers.

### POST /admin/circuit-breakers/:name/reset

Reset a specific upstream circuit breaker (`404` if unknown).

---

## Cache Management

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

Clear all cached entries immediately.

---

## Session Management

### GET /admin/sessions/stats

Returns MCP session tracking statistics.

```json
{
  "active_sessions": 42,
  "zombie_count": 2,
  "tracked_sessions": 44
}
```

---

## mTLS & Quota Management

### GET /admin/mtls/config & GET /admin/mtls/stats

Inspect current mTLS settings (`trusted_proxies` redacted) and client-certificate validation counters (`total_requests`, `cert_validated`, `cert_missing`, `cert_invalid`).

### GET /admin/quotas, GET /admin/quotas/:consumer_id & POST /admin/quotas/:consumer_id/reset

Inspect or reset daily and monthly consumer quota counters.

---

## Diagnostics, Error Snapshots, Tracing & A2A Registry

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/diagnostic` | `GET` | Gateway uptime, circuit breaker states, and route statistics |
| `/admin/diagnostics/summary` | `GET` | Aggregated diagnostic report summary |
| `/admin/diagnostics/:request_id` | `GET` | Per-request diagnostic trace report |
| `/admin/snapshots` | `GET`, `DELETE` | List or clear captured error snapshots |
| `/admin/snapshots/:request_id` | `GET` | Retrieve a specific error snapshot |
| `/admin/tracing/status` | `GET` | OpenTelemetry distributed tracing exporter status |
| `/admin/a2a/agents` | `GET`, `POST` | List or register Agent-to-Agent (A2A) agents |
| `/admin/a2a/agents/:name` | `GET`, `DELETE` | Inspect or unregister an A2A agent |

*(Internal supervision endpoints under `/admin/hegemon/*` and experimental `/admin/ebpf/*` hooks are also mounted behind `admin_auth` for platform-internal telemetry.)*

---

## Unauthenticated Health Probes

Kubernetes liveness and readiness probes live outside `/admin` and require no token:

| Endpoint | Purpose |
|----------|---------|
| `GET /health` / `GET /health/live` | Liveness probe — gateway process is alive |
| `GET /ready` / `GET /health/ready` | Fail-closed readiness probe — verifies required policy/audience/audit-spool state ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) |

## Related

- [MCP Gateway API](/docs/api/mcp-gateway) — MCP JSON-RPC and companion REST endpoints
- [Control Plane API](/docs/api/control-plane) — Platform management API
- [Quota Enforcement](/docs/reference/quotas) — Quota model and enforcement
- [RBAC Permissions](/docs/reference/rbac-permissions) — Role and scope model
