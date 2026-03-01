---
title: "ADR-053: LLM Cost-Aware Routing"
description: "Decides how the STOA Gateway routes LLM requests across multiple providers with cost optimization, budget enforcement, and Prometheus-based cost tracking. Chooses LowestCost as the default routing strategy (Option A), evaluated against RoundRobin (Option B) and LowestLatency (Option C)."
keywords: [llm, routing, cost, budget, prometheus, multi-provider, anthropic, openai, mistral]
---

# ADR-053: LLM Cost-Aware Routing

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-03-01 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-1600 |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — LLM routing operates in edge-mcp mode
- **ADR-041**: Plugin Architecture — LLM modules use feature flags for community/enterprise split
- **ADR-051**: Lazy MCP Discovery — shares moka cache pattern for budget lookups

## Context

The STOA Gateway proxies LLM requests to multiple providers (Anthropic, OpenAI, Mistral, Azure OpenAI, Google Vertex, AWS Bedrock). Without cost-aware routing, tenants pay full price on a single provider with no visibility into spend, no budget enforcement, and no ability to optimize across providers.

### Current State (Pre-ADR)

The gateway has an `LlmProxy` module (`src/proxy/llm_proxy.rs`) that forwards requests to a single configured provider. No routing decision is made — the request goes to whichever provider is configured. Token counts are extracted from responses but not used for cost calculation or metrics.

### Why Cost-Aware Routing

Multi-provider tenants can achieve 30-85% cost savings through intelligent routing:

1. **Cost-based routing** — route to the cheapest provider for equivalent model quality (30-50% savings)
2. **Budget enforcement** — pre-flight 429 check prevents runaway spend (15-25% savings)
3. **Cache-aware billing** — Anthropic prompt caching costs ~10% of full input pricing (10-15% savings)
4. **Fallback chains** — circuit breaker avoids paying for failed requests (5-10% savings)

### Constraints

- Routing decision must add less than 5ms latency (no external calls in hot path)
- Budget lookup must not block every request (cache with bounded staleness acceptable)
- Cost tracking must not lose data on gateway restart (Prometheus scraping provides durability)
- Must support per-request provider override via header (for A/B testing, debugging)

## Options

### Option A: LowestCost Default Strategy (Chosen)

Route every request to the provider with the lowest cost-per-token for the requested model class. Pricing metadata is configured per-provider at startup (no runtime API calls).

```
Request arrives → Extract model from payload
  → Filter enabled providers with compatible model
  → Sort by cost_per_1m_input (ascending)
  → Select cheapest → Forward request
  → Extract tokens from response → Record cost metrics
```

- **Decision latency**: under 1ms (in-memory sort of 2-6 providers)
- **Override**: `X-Stoa-Provider` header bypasses routing, sends to specific provider
- **Fallback**: if cheapest provider fails, circuit breaker marks it unhealthy, next request goes to second-cheapest

### Option B: RoundRobin Default Strategy

Distribute requests evenly across all enabled providers. Simple, predictable, but ignores cost differences.

- Pro: even load distribution, no pricing configuration needed
- Con: **no cost optimization** — a 50/50 split between a $3/MTok and $15/MTok provider wastes 40% vs routing all to the cheaper one

### Option C: LowestLatency Default Strategy

Route to the provider with the lowest observed P50 latency (sliding window). Optimizes for speed, not cost.

- Pro: best user experience for latency-sensitive workloads
- Con: **fastest provider is often the most expensive** — defeats cost optimization goal. Also requires latency tracking infrastructure (sliding window, decay).

## Decision

**Option A: LowestCost as the default routing strategy.**

Cost optimization is the primary value proposition for multi-provider tenants. The strategy is:

1. **Simple** — static pricing metadata, no runtime API calls, deterministic routing
2. **Overridable** — per-request header override for latency-sensitive or provider-specific workloads
3. **Composable** — tenants can switch to RoundRobin or LowestLatency via configuration
4. **Measurable** — Prometheus metrics prove savings (before/after comparison)

LowestLatency and RoundRobin remain available as configuration options. The router supports all four strategies: `LowestCost`, `LowestLatency`, `RoundRobin`, `HeaderOverride`.

## Implementation

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LlmRouter` | `src/llm/router.rs` | Core router: 4 strategies, provider selection, circuit breaker integration |
| `CostCalculator` | `src/llm/cost.rs` | Per-request cost calculation from token counts + provider pricing |
| `BudgetGate` | `src/llm/cost.rs` | Pre-flight budget check (429 if exceeded) |
| `ProviderRegistry` | `src/llm/providers.rs` | 6 providers with pricing metadata, model mappings |
| Config fields | `src/config.rs` | `LlmRouterConfig` (strategy, budget, providers) |
| AppState field | `src/state.rs` | `llm_router: Option<Arc<LlmRouter>>` |
| Admin endpoints | `src/handlers/admin.rs` | `/admin/llm/{status,providers,costs}` |

### Routing Flow

```
POST /v1/messages
  │
  ├─ BudgetGate::check_tenant_budget()
  │   └─ moka cache (60s TTL) → CP API budget lookup
  │   └─ If exceeded → 429 + X-Stoa-Budget-Exceeded: true
  │
  ├─ LlmRouter::select(strategy, model, headers)
  │   └─ LowestCost: sort providers by cost_per_1m_input, pick cheapest enabled
  │   └─ HeaderOverride: X-Stoa-Provider → direct to named provider
  │   └─ Circuit breaker: skip unhealthy providers
  │
  ├─ LlmProxy::forward(provider, request)
  │   └─ SSE streaming with token extraction
  │
  └─ CostCalculator::track(provider, model, tokens)
      └─ Emit 7 Prometheus metrics
```

### Prometheus Metrics (7 counters/histograms)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `gateway_llm_requests_total` | counter | `provider`, `model`, `status` | Total LLM requests |
| `gateway_llm_cost_total` | counter | `provider`, `model` | Cumulative cost in USD |
| `gateway_llm_tokens_input_total` | counter | `provider`, `model` | Total input tokens |
| `gateway_llm_tokens_output_total` | counter | `provider`, `model` | Total output tokens |
| `gateway_llm_tokens_cache_read_total` | counter | `provider`, `model` | Cache read tokens (Anthropic) |
| `gateway_llm_tokens_cache_write_total` | counter | `provider`, `model` | Cache write tokens (Anthropic) |
| `gateway_llm_request_duration_seconds` | histogram | `provider`, `model` | Request latency |

### PromQL Examples

```promql
# Total LLM spend last 24h
sum(increase(gateway_llm_cost_total[24h]))

# Cost per provider last 7d
sum by (provider) (increase(gateway_llm_cost_total[7d]))

# Average cost per request
sum(rate(gateway_llm_cost_total[1h])) / sum(rate(gateway_llm_requests_total[1h]))

# Cache savings ratio (Anthropic)
sum(rate(gateway_llm_tokens_cache_read_total{provider="anthropic"}[1h]))
  / sum(rate(gateway_llm_tokens_input_total{provider="anthropic"}[1h]))

# Budget utilization (requires CP API budget endpoint)
# gateway_llm_cost_total / tenant_budget_limit_usd * 100
```

### Budget Sync

Budget limits are stored in the Control Plane API (`llm_budget` table). The gateway caches limits using moka with a 60-second TTL to avoid per-request API calls.

```
BudgetGate::check()
  → moka cache HIT → compare spend vs limit (0ms overhead)
  → moka cache MISS → GET /v1/tenants/{id}/llm/budget → cache result → compare
  → If spend >= limit → 429 Too Many Requests + X-Stoa-Budget-Exceeded: true
```

Cache invalidation: `POST /admin/llm/budget-cache/clear` forces cache eviction (for immediate budget changes).

### Admin API

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/llm/status` | GET | Bearer (admin token) | Router status: enabled, strategy, provider count |
| `/admin/llm/providers` | GET | Bearer (admin token) | Provider list with pricing metadata |
| `/admin/llm/costs` | GET | Bearer (admin token) | Cost tracking status + metrics snapshot |
| `/admin/llm/budget-cache/clear` | POST | Bearer (admin token) | Force budget cache eviction |

### Provider Configuration

```yaml
llm_router:
  enabled: true
  default_strategy: lowest_cost
  budget_limit_usd: 100.0
  providers:
    - provider: anthropic
      base_url: https://api.anthropic.com/v1
      api_key_env: ANTHROPIC_API_KEY
      default_model: claude-sonnet-4-20250514
      cost_per_1m_input: 3.0
      cost_per_1m_output: 15.0
      cost_per_1m_cache_read: 0.3
      cost_per_1m_cache_write: 3.75
      priority: 1
      max_concurrent: 50
    - provider: openai
      base_url: https://api.openai.com/v1
      api_key_env: OPENAI_API_KEY
      default_model: gpt-4o
      cost_per_1m_input: 2.5
      cost_per_1m_output: 10.0
      priority: 2
      max_concurrent: 50
```

## Consequences

### Positive

- Multi-provider tenants achieve 30-85% cost savings with zero code changes (configure providers, enable routing)
- Budget enforcement prevents runaway spend before it happens (pre-flight 429)
- Prometheus metrics provide full cost observability (per-provider, per-model, per-request)
- Cache-aware billing correctly accounts for Anthropic prompt caching (10x cheaper cache reads)
- Admin API enables Console UI dashboard for cost monitoring and budget management
- Circuit breaker integration ensures routing avoids unhealthy providers automatically

### Negative

- Pricing metadata is static (configured at deploy time) — provider price changes require config update
- Budget cache staleness (60s TTL) means a tenant can slightly exceed their budget in a burst
- LowestCost routing may concentrate all traffic on a single provider (no load balancing)

### Risks

- **Provider pricing changes**: upstream providers may change pricing without notice. Mitigation: pricing is explicit in config, not fetched from provider APIs. Operators update on their own schedule.
- **Budget race condition**: concurrent requests in the 60s cache window could exceed budget. Mitigation: acceptable for most workloads. Future: consider atomic budget decrement with Redis for strict enforcement.
- **Single provider concentration**: LowestCost always picks the cheapest, potentially overloading one provider. Mitigation: `max_concurrent` limit per provider + circuit breaker. Future: consider weighted cost routing.

## Test Coverage

40 integration tests covering:

- Admin LLM status (enabled/disabled, provider count, routing strategy)
- Admin LLM providers (list with pricing metadata, empty when disabled)
- Admin LLM costs (tracking enabled/disabled, metrics array)
- Auth enforcement on all admin endpoints (401 without token, 401 with wrong token)
- Router strategy selection (LowestCost, RoundRobin, LowestLatency, HeaderOverride)
- Cost calculator (token-based cost computation, cache-aware billing)
- Budget gate (pre-flight check, 429 response)
- Circuit breaker integration (unhealthy provider skipped)

Arena L1 benchmark (`ent_llm_cost` dimension) validates live admin endpoints with cost tracking and provider pricing metadata.
