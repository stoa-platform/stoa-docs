# ADR-059 — Simplified Deployment Architecture: Single Path via SSE

**Status:** Accepted
**Date:** 2026-03-30
**Author:** Christophe (CAB Ingénierie)
**Supersedes:** Current multi-path deployment (SyncEngine + inline sync + Connect polling)
**Council:** 8.00/10 (Go) — Impact 288 (CRITICAL)

---

## Context

API deployment to a gateway currently follows 3 distinct paths:

1. **SyncEngine** — background cron that pushes HTTP directly to gateways
2. **`_try_inline_sync`** — synchronous HTTP push called at Console deploy time
3. **STOA Connect polling** — agent polls `/pending-deployments` and applies locally

These 3 paths have different guards, different behaviors, different bugs. SyncEngine had a `self_register` guard (L278), but `_try_inline_sync` did not. Ghost gateway instances in the database cause pushes to unresolvable Docker hostnames. Every fix on one path reveals a bug on another.

**Result: 4 days blocked on API deployment, fix/feat ratio at 1:1, regressions in a loop.**

The multi-path model is incompatible with STOA's hybrid architecture (cloud CP + on-premise gateway). The cloud CP should NEVER initiate a connection to on-premise — the on-premise agent initiates.

---

## Decision

**A single deployment path. The CP writes the intent, the Link executes.**

### Single Path

```
Console → CP API → SSE push → STOA Link → Gateway → Callback → CP API
```

### Detailed Flow

1. Dev clicks "Deploy" in the Console
2. CP API creates a `gateway_deployment` with **PENDING** status in database
3. CP API emits an SSE event on the targeted Link's connection
4. STOA Link receives the event instantly (SSE connection maintained)
5. STOA Link applies the desired state on the local gateway
6. STOA Link callbacks HTTPS to CP: **SYNCED** or **FAILED**
7. CP updates the status in database
8. Console displays the result

### SSE — CP Endpoint

```
GET /api/v1/links/{link_id}/events
Headers: Authorization: Bearer <link_token>
Content-Type: text/event-stream
```

Events:
- `deployment.requested` — new desired state to apply
- `deployment.cancelled` — cancellation before execution

### Reconnection

If the SSE connection drops, the Link reconnects automatically (native SSE). On reconnect, it calls:

```
GET /api/v1/links/{link_id}/pending-deployments
```

A single catch-up call, not permanent polling. This endpoint returns all PENDING deployments for this Link. Once caught up, the Link switches back to SSE mode.

### Git — Asynchronous Side-effect

After a SYNCED deploy, the CP commits the desired state (UAC YAML) to the Git repo. Non-blocking. Git is the archive (audit trail, versioning, rollback via `git revert`), not the deployment bus. If Git is unavailable, the deploy still works.

---

## What We Remove

| Component | Reason for Removal |
|---|---|
| **SyncEngine** (background cron) | Direct HTTP push CP → gateway. Violates hybrid model. |
| **`_try_inline_sync`** | Synchronous HTTP push at deploy. Same problem. |
| **Polling `/pending-deployments`** in cron mode | Replaced by real-time SSE + catch-up on reconnect. |
| **`gateway_instance.base_url`** used for push | CP no longer calls gateways. Field kept for info, never used for HTTP. |
| **Gateway "push" concept on CP side** | No longer exists. All gateways are pull/SSE. |

## What We Keep

| Component | Role |
|---|---|
| **`gateway_deployments` table** | Source of truth for deployments (PENDING → SYNCED/FAILED) |
| **STOA Link / Connect** | On-premise agent, maintains SSE connection, executes deploys |
| **HTTPS Callback Link → CP** | Status reporting after execution |
| **Kafka events** | Non-blocking side-effects: notifications, audit, observability |
| **Git commits** | Asynchronous archive: audit trail, versioning, rollback |

---

## Drift Detection — Post-SyncEngine

The current SyncEngine runs `_detect_drift()` by comparing `spec_hash` on SYNCED deployments. With its removal, drift detection moves to the Link side:

**Mechanism:** The Link periodically reports (every 5 min) the actual gateway state via a `state.report` callback to the CP. The CP compares the reported state with the desired state in database. On divergence → `drift.detected` event emitted on SSE → the Link re-applies the desired state.

**For demo:** Drift detection disabled. The flow is linear (deploy → sync → done). Drift detection is post-demo P1.

---

## Kafka — Topic Fate

| Topic | Decision | Reason |
|---|---|---|
| `gateway-sync-requests` | **Removed** | Was consumed by SyncEngine to trigger pushes. No more pushes. |
| `gateway-events` | **Kept** | Used for side-effects: notifications, audit trail, observability. The CP emits `deployment.synced` / `deployment.failed` after the Link callback. |
| `api-catalog-events` | **Unchanged** | Not related to deploy. |

---

## Scope — The 5 stoa-connect Loops

The Go client `stoa-connect` has 5 independent loops. This ADR only affects one:

| Loop | ADR-059 Impact | Detail |
|---|---|---|
| **Deployment sync** | **SSE replaces polling** | Cron polling → SSE listener + catch-up on reconnect |
| Heartbeat | Unchanged | Periodic ping CP → Link alive |
| Route sync | Unchanged | Gateway routes synchronization → CP |
| Discovery | Unchanged | Auto-discovery of APIs on the gateway |
| Credential sync | Unchanged | Vault credentials synchronization → gateway |

---

## Naming — Link vs Connect

**"STOA Link"** is the product concept (branding validated Feb 2026, see ADR-057). E.g.: "STOA Link for webMethods."

**`stoa-connect`** is the Go binary (`stoa-go/cmd/stoa-connect/`). No binary rename in this ADR — it's a cosmetic topic post-demo.

In this ADR, "Link" = the concept and the agent. The code remains `stoa-connect` for now.

---

## Known Limitations

### Multi-replica EventBus (P1 post-demo)

The current EventBus is **in-memory** (CAB-1420). With a single CP API replica, it works. With N replicas behind a load balancer, an event emitted on replica A won't be seen by the SSE connection on replica B.

**For demo:** 1 single CP API replica. No issue.

**Post-demo:** Migrate the EventBus to PostgreSQL `LISTEN/NOTIFY` (already in the stack, zero new dependencies). Alternative: Redis PubSub if event volumes justify the separation.

### SSE Auth vs Console Auth

Two SSE endpoints coexist with different auth models:

| Endpoint | Audience | Auth |
|---|---|---|
| `/v1/events/stream/{tenant_id}` (existing) | Console frontend | JWT Keycloak |
| `/api/v1/links/{link_id}/events` (new) | STOA Link agent | `X-Gateway-Key` (existing) |

Good separation of concerns. No possible confusion.

### Catch-up Payload Size (P2 post-demo)

The `/pending-deployments` endpoint returns all PENDING deployments for a Link in a single call. If the Link has been disconnected for a long time (hours/days), the response may contain dozens of deployments.

**For demo:** Negligible volume (1-5 deployments max). No issue.

**Post-demo:** Add `?limit=50&offset=0` to the endpoint. The Link paginates until the backlog is exhausted, then switches back to SSE mode. Priority P2 — only blocks if a Link is disconnected for days with high deploy volume.

### Rollback & Gradual Rollout

**Feature flag**: `DEPLOY_MODE` (CP API env var)

| Value | Behavior | When |
|---|---|---|
| `sse_only` (default post-ADR) | Only the SSE path is active. SyncEngine and inline sync removed. | Final target |
| `dual` | SSE active + SyncEngine kept as read-only fallback (drift detection only, no push). | Post-demo transition if SSE issues |
| `legacy` | Old behavior (SyncEngine + inline sync). SSE disabled. | Emergency rollback |

**Migration strategy:**
1. Merge with `DEPLOY_MODE=dual` — SSE active, SyncEngine reduced to drift detection
2. Validate in staging for 48h (metrics: SSE events emitted vs callbacks received)
3. Switch `DEPLOY_MODE=sse_only` — remove SyncEngine code in a separate cleanup PR
4. If production incident → rollback `DEPLOY_MODE=legacy` via Helm values, redeployment < 5 min

**For demo:** `sse_only` directly (no legacy gateways to manage).

---

## Auth, Monitoring, Rate Limiting — Post-demo

These concerns are real but do NOT require a new component. They are incremental features on the CP:

### Link Auth
- Each Link authenticates with a token (existing) or mTLS (post-demo, CAB-1873)
- The token is provisioned at Link installation
- The CP identifies each SSE connection

### Monitoring
- Prometheus metric `stoa_link_connections_active{link_id, environment}`
- Grafana dashboard "Links Health": connections, callback latency, pending events
- Already in the stack (Prometheus + Grafana deployed)

### Rate Limiting
- FastAPI middleware on SSE endpoint: max reconnections/minute per Link
- Middleware on callback: max requests/second per Link
- Fallback: Cloudflare rate limiting at the edge

### Priority
| Feature | When |
|---|---|
| Token auth (existing) | Demo (already in place) |
| Rate limiting middleware | Post-demo P1 |
| Monitoring dashboard Links | Post-demo P1 |
| mTLS per Link | Post-demo P2 |

---

## Consequences

### Positive
- **1 single path** for deployment instead of 3 → 3x less bug surface
- **Near-zero latency** — instant SSE push vs 30s polling
- **Firewall-friendly** — the on-premise Link initiates the outbound HTTPS connection
- **Less code** — removal of SyncEngine + inline sync = net subtraction
- **Consistent with positioning** — "Define Once, Expose Everywhere" = CP defines, Links expose
- **CP no longer knows gateways** — it knows Links, which know their gateways

### Negative
- **Perceived Console latency** — deploy is no longer "instant" (the old push gave a false positive of immediate success). Status goes through PENDING → SYNCED. UX must reflect this (spinner, then confirmation).
- **SSE connection dependency** — if the Link loses connection, deploys accumulate in PENDING until reconnect. The catch-up mechanism covers this case.

### Risks
- **Data migration** — existing gateway_instances with `source != self_register` must be migrated or deleted
- **STOA Connect Go** — the Go client must implement the SSE listener (standard library `net/http` or `r3labs/sse`)

---

## Implementation — MEGA "Deploy Single Path"

### Sub-task 1 — CP: SSE Endpoint + deploy simplification
- Create `GET /api/v1/links/{link_id}/events` (SSE endpoint)
- Simplify `deploy_api_to_env`: write PENDING + emit SSE event. Nothing else.
- Remove `_try_inline_sync`
- Remove `SyncEngine`
- Keep `GET /api/v1/links/{link_id}/pending-deployments` for reconnect catch-up

### Sub-task 2 — Link: SSE client + execution
- Replace cron polling with an SSE listener on `/events`
- On reconnect: call `/pending-deployments` once, process the backlog, switch back to SSE
- The rest (apply on gateway + callback) does not change

### Sub-task 3 — Data cleanup
- Delete ghost gateway instances in database
- Migrate instances with `source != self_register` or delete them
- Verify: 1 Link = 1 gateway instance per environment

### Sub-task 4 — E2E Test
- Script that runs the complete demo flow:
  1. Create API in Console
  2. Deploy to dev
  3. Verify SSE event received by Link
  4. Verify SYNCED callback
  5. Verify status in Console
- This script = DONE criteria for the MEGA
