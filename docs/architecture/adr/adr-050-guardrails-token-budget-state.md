---
title: "ADR-050: Guardrails V2 — Token Budget State Management"
description: "Decides how the STOA Gateway tracks per-tenant token budgets for AI Guardrails V2: in-memory counters with periodic CP API sync (Option A), evaluated against Redis atomic counters (Option B) and CP API as sole state store (Option C)."
keywords: [guardrails, token budget, rate limiting, in-memory, CP API, Redis, policy engine, OPA, content filtering]
---

# ADR-050: Guardrails V2 — Token Budget State Management

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-22 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-1337 Phase 0 |
| **Council** | 7.25/10 Fix (adjustments applied) |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — token counting happens in edge-mcp mode
- **ADR-041**: Plugin Architecture — guardrails are a community feature, no enterprise gating
- **ADR-043**: Kafka MCP Event Bridge — budget exhaustion events flow to Kafka
- **ADR-044**: MCP OAuth 2.1 — per-tenant token budgets scoped by Keycloak tenant ID

## Context

Guardrails V2 (CAB-1337) extends V1 PII/injection detection with per-tenant token budget management. Token budgets enforce a cap on tokens consumed per tenant per time period (hourly, daily, or monthly), enabling cost governance for enterprise deployments.

### V1 Guardrails Baseline

V1 is implemented in `stoa-gateway/src/guardrails/` with:
- `pii.rs` — regex-based PII detection (email, SSN, phone, IBAN, credit card)
- `injection.rs` — prompt injection pattern detection
- Pipeline position: Auth → Rate Limit → **[GUARDRAILS]** → OPA Policy → Cache → Tool Execute
- Disabled by default (`STOA_GUARDRAILS_PII_ENABLED=false`, `STOA_GUARDRAILS_INJECTION_ENABLED=false`)
- Metrics: `stoa_guardrails_pii_detected_total`, `stoa_guardrails_injection_blocked_total`

### Why Token Budgets Require a State Management Decision

Unlike PII/injection detection (stateless per-request), token budgets are **stateful**: each tool call consumes tokens, and the running total must be checked against the tenant's limit. This raises three design questions:

1. **Where is the running total stored?** (in-memory, Redis, or CP API)
2. **How is the total recovered after a gateway restart?**
3. **What happens when the budget is exhausted?** (reject or queue)

### Constraints

| Constraint | Detail |
|-----------|--------|
| Latency budget | Token counting must not add more than 1ms to p99 tool call latency |
| No Redis in current stack | Adding Redis requires operational overhead (HA, TLS, auth, backup) |
| CP API is the source of truth | All tenant configuration lives in CP API |
| Single gateway replica (current) | Multi-replica synchronization is not needed today |
| Approximate enforcement acceptable | Token budgets are cost governance, not billing-critical enforcement |
| Restart tolerance required | Gateway restarts must not lose budget tracking entirely |

## Options Evaluated

### Option A — In-Memory Counters + Periodic CP API Sync (Recommended)

**Architecture**: Each gateway instance maintains atomic in-memory counters per tenant. Counters are periodically (every 30s) persisted to CP API as usage snapshots. On startup, the gateway fetches the current period's usage from CP API to restore state.

```
Tool Call
   │
   ▼
[load budget config from CP API (cached, TTL=60s)]
   │
   ▼
[atomic in-memory increment: tenant_tokens_used += N]
   │
   ▼
[check: used > 80%? → emit alert metric]
[check: used >= 100%? → reject or queue]
   │
   └── every 30s: POST /v1/tenants/{id}/token-usage { period, tokens_used }

Gateway Startup:
   GET /v1/tenants/{id}/token-usage?period=current → restore counters
```

**Pros**:
- Zero new infrastructure
- Sub-microsecond token counting (atomic in-memory operation)
- Restart tolerance via CP API sync on startup
- Simple implementation: `AtomicU64` per tenant, `DashMap<TenantId, AtomicU64>`

**Cons**:
- Enforcement is approximate: in the 30s sync window, a tenant can overshoot the limit
- Not suitable for hard enforcement (billing, compliance) — but token budgets are soft limits

**Restart behavior**: On restart, the gateway fetches the last persisted usage. Maximum drift = 30s of usage (bounded). Acceptable for cost governance use cases.

**Accuracy estimate**: At 1000 tool calls/minute (high throughput), max overshoot per restart = ~500 tool calls × average tokens. For a 1M token/day budget, this is a sub-0.05% overshoot.

---

### Option B — Redis Atomic Counters

**Architecture**: `INCRBY tenant:{id}:tokens:{period} N` on a Redis cluster. Exact enforcement across any number of gateway replicas.

**Pros**:
- Exact enforcement (no overshoot window)
- Works across multiple gateway replicas without coordination
- Redis native TTL handles period rollover

**Cons**:
- New infrastructure dependency (Redis 7, HA configuration, TLS, auth, eviction policies)
- Network round-trip per tool call (+1-5ms latency overhead)
- Operational complexity: monitoring, backup, memory sizing
- Current architecture is single-replica — multi-replica benefit not realized today
- Redis outage = token counting unavailable (requires fallback logic anyway)

**Verdict**: Overhead not justified for current scale. Revisit when horizontal scaling requires more than 3 replicas and hard enforcement is a contractual requirement.

---

### Option C — CP API as Sole State Store

**Architecture**: Each tool call makes a synchronous POST to CP API to increment and check the token counter.

**Pros**:
- Exact enforcement
- No new infrastructure
- Persistent by default

**Cons**:
- Network round-trip per tool call (+10-50ms — unacceptable)
- Creates a hot endpoint on CP API (N tool calls/s → N writes/s)
- CP API becomes a synchronous dependency of the gateway's critical path
- Not viable for any non-trivial throughput

**Verdict**: Rejected. Latency penalty is incompatible with the sub-1ms latency constraint.

## Decision

**Option A — In-Memory Counters + Periodic CP API Sync.**

Token budgets are **soft limits for cost governance**, not billing-critical enforcement. The ~30s approximation window is acceptable, and the simplicity of zero new infrastructure outweighs the slight enforcement imprecision.

### Implementation Design

```rust
// stoa-gateway/src/guardrails/token_budget.rs

pub struct TokenBudgetTracker {
    /// Per-tenant in-memory counters: tenant_id → tokens used this period
    counters: DashMap<String, AtomicU64>,
    /// Budget config fetched from CP API (TTL-cached, 60s)
    config_cache: Arc<RwLock<HashMap<String, TenantBudgetConfig>>>,
    /// Sync interval to CP API
    sync_interval: Duration,
}

pub struct TenantBudgetConfig {
    pub max_tokens_per_period: u64,
    pub period: BudgetPeriod,       // Hourly | Daily | Monthly
    pub alert_threshold_pct: u8,    // default 80
    pub exhaustion_policy: ExhaustionPolicy,
}

pub enum ExhaustionPolicy {
    /// Reject tool calls when budget exhausted (HTTP 429)
    Reject,
    /// Queue tool calls (not implemented in Phase 2, future)
    Queue,
}

pub enum BudgetCheckResult {
    Allowed,
    AlertThreshold(u8),    // percentage used
    Exhausted,
}
```

### CP API Endpoints (new, Phase 2)

```
GET  /v1/tenants/{id}/token-budget       → TenantBudgetConfig
POST /v1/tenants/{id}/token-usage        → { period, tokens_used } → persisted
GET  /v1/tenants/{id}/token-usage?period=current → { period, tokens_used, last_updated }
```

### Sync Protocol

```
1. Background task runs every 30s per active tenant
2. Read current counter value (AtomicU64::load(Ordering::Relaxed))
3. POST /v1/tenants/{id}/token-usage with current value
4. On response: if period has rolled over, reset counter to 0

On startup:
1. Fetch all tenant budget configs (batch, one call)
2. Fetch current-period usage for each tenant with a configured budget
3. Initialize counters from fetched values
4. Start background sync task
```

### Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `stoa_token_budget_used_total` | counter | `tenant_id`, `period` | Total tokens consumed |
| `stoa_token_budget_exhausted_total` | counter | `tenant_id` | Budget exhaustion events |
| `stoa_token_budget_alert_total` | counter | `tenant_id`, `threshold_pct` | Alert threshold crossings |
| `stoa_token_budget_sync_errors_total` | counter | `tenant_id` | CP API sync failures |
| `stoa_token_budget_utilization_ratio` | gauge | `tenant_id` | Current usage/limit ratio (0.0-1.0+) |

## Phase 3 Policy Engine — OPA Reuse Evaluation

The ticket requires evaluating whether to reuse OPA for Phase 3 (policy engine for custom rules) or build a new YAML DSL.

### Evaluation Result: **Reuse OPA** (`regorus`)

The gateway already has a production `regorus`-based OPA engine (`src/policy/opa.rs`) with:
- Pure-Rust evaluation (no sidecar, no network hop)
- Sub-1ms policy evaluation latency
- `Arc<RwLock<Engine>>` for concurrent access and hot-reload
- Policies loaded from filesystem or inline Rego

**Phase 3 scope** (with OPA reuse):
1. Add `GuardrailPolicy` CRD schema (tenant-scoped, namespace-isolated)
2. Extend K8s CRD watcher (`src/k8s/`) to watch `GuardrailPolicy` resources
3. On CRD event: generate Rego policy from CRD spec → `engine.write().add_policy()`
4. `check_request()` in `guardrails/mod.rs` calls `PolicyEngine.evaluate()` for custom rule enforcement

This replaces the need for a separate YAML DSL, reuses ~400 LOC of existing code, and keeps the single policy evaluation path in the tool call pipeline.

**Rego template for content filtering rules**:

```rego
package stoa.guardrails.content

default allow = true

# Block if request matches any tenant-defined blocked pattern
deny[reason] {
    pattern := data.rules[_]
    pattern.action == "block"
    regex.match(pattern.pattern, input.content)
    reason := sprintf("Content blocked by rule: %s", [pattern.name])
}

# Redact if request matches sensitive pattern
redact[field] {
    pattern := data.rules[_]
    pattern.action == "redact"
    regex.match(pattern.pattern, input.content)
    field := pattern.field
}
```

**Conclusion**: Phase 3 is CRD + Rego generation + hot-reload extension. No new DSL needed.

## Consequences

### Positive

- Zero new infrastructure for token budget tracking
- Restart-tolerant with bounded drift (under 30s window)
- Clean separation: gateway handles real-time counting, CP API handles persistence
- OPA reuse simplifies Phase 3 significantly (reuses existing codebase)
- Alert thresholds (80%/90%/100%) enable proactive cost governance

### Negative

- Token budget enforcement is approximate (30s window). Tenants may briefly exceed limits.
- If CP API is unreachable at startup, the gateway starts with zero counters (conservative: no history = full budget available, overshoot possible until first sync)
- Budget config cache (60s TTL) means limit changes take up to 60s to propagate

### Mitigations

| Risk | Mitigation |
|------|-----------|
| CP API unreachable at startup | Start with zero counters + log warning; conservative overshoot bounded by period budget |
| 30s sync failure | Log metric `stoa_token_budget_sync_errors_total`; use last successful sync value |
| Phase 2→3 transition | OPA policy check runs after token count check; same pipeline position |

## Re-evaluation Triggers

Revisit to Option B (Redis) when:
- Gateway scales to more than 3 replicas AND
- A tenant contractually requires hard enforcement (billing accuracy, SLA compliance)

At that scale, Redis Cluster with `INCRBY` + `EXPIRE` per period is the right answer.
