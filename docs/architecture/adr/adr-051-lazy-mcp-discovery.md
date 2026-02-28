---
title: "ADR-051: Lazy MCP Discovery with Cache-First Pattern"
description: "Decides how the STOA Gateway discovers upstream MCP server capabilities: lazy on-first-request with moka cache (Option A), evaluated against eager startup discovery (Option B) and periodic background polling (Option C)."
keywords: [mcp, discovery, cache, lazy loading, moka, circuit breaker, upstream, capabilities]
---

# ADR-051: Lazy MCP Discovery with Cache-First Pattern

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-27 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-1552 |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — discovery applies to edge-mcp mode
- **ADR-044**: MCP OAuth 2.1 — discovered endpoints may require OAuth tokens
- **ADR-046**: MCP Federation — lazy discovery is a prerequisite for federated tool routing

## Context

The STOA Gateway proxies tool calls to upstream MCP servers. Before proxying, the gateway needs to know what capabilities (tools, resources, prompts) each upstream server offers. This is the MCP discovery problem.

### Current State (Pre-ADR)

Discovery is not implemented. The gateway relies on the Control Plane API to provide a static tool registry. When a tool call arrives, the gateway looks up the tool in its local registry (synced from CP API) and forwards the request. There is no runtime probing of upstream MCP servers.

### Why Lazy Discovery

As STOA moves toward MCP Federation (ADR-046), the gateway must discover capabilities from upstream MCP servers that are not pre-registered in the CP API. Use cases:

1. **Dynamic upstream servers** — MCP servers added at runtime via CRD or API
2. **Federated routing** — gateway discovers which upstream serves a given tool
3. **Capability negotiation** — upstream capabilities change over time (new tools, deprecated resources)
4. **Health-aware routing** — discovery doubles as a health probe for upstream servers

### Constraints

- Gateway startup must remain fast (&lt;2s) — blocking discovery at startup is unacceptable
- Upstream MCP servers may be temporarily unavailable
- Discovery responses are relatively stable (change infrequently)
- Gateway handles 100+ concurrent requests; discovery must not become a bottleneck

## Options

### Option A: Lazy Discovery with Cache-First (Chosen)

Probe upstream MCP servers on first request, cache discovered capabilities with configurable TTL using moka in-memory cache. Subsequent requests use cache. Cache miss triggers async probe.

```
Request arrives → Check moka cache
  → HIT: return cached capabilities (0ms overhead)
  → MISS: probe upstream /mcp/capabilities → cache result → return
```

- **TTL**: configurable (default 300s / 5 min)
- **Max entries**: configurable (default 256)
- **Resilience**: circuit breaker + exponential retry on probe failures
- **Eviction**: moka handles TTL-based expiry + LRU when at capacity

### Option B: Eager Startup Discovery

Probe all known upstreams at gateway startup. Block until all responses received or timeout.

- Pro: warm cache from the start, no first-request latency penalty
- Con: **slow startup** (N upstreams × timeout), blocks readiness probe, fails if any upstream is down at startup, stale if upstreams change after startup

### Option C: Periodic Background Polling

Background task polls all upstreams every N seconds, maintaining a continuously fresh cache.

- Pro: always-fresh cache, no first-request penalty after first poll
- Con: **wastes resources** polling servers that may never be queried, complex lifecycle management (graceful shutdown of polling tasks), still needs lazy fallback for servers added between polls

## Decision

**Option A: Lazy Discovery with Cache-First pattern.**

The cache-first approach provides the best trade-off:

1. **Zero startup cost** — gateway starts instantly, no blocking on upstream probes
2. **Pay-per-use** — only probe upstreams that are actually requested
3. **Resilient** — circuit breaker prevents cascade failures when upstreams are down
4. **Simple** — single code path (check cache → miss → probe → cache), no background tasks
5. **Configurable** — TTL and capacity tunable via env vars without code changes

The first-request latency penalty is acceptable because:
- It only affects the very first request per upstream per TTL window
- Circuit breaker + retry ensure the penalty is bounded (max ~3 attempts)
- Subsequent requests in the TTL window have zero overhead

## Implementation

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LazyMcpDiscovery` | `src/mcp/lazy_discovery.rs` | Core struct: cache + probe logic |
| `UpstreamCapabilities` | `src/mcp/lazy_discovery.rs` | Cached discovery response (tools, resources, prompts, protocol version) |
| `DiscoveryError` | `src/mcp/lazy_discovery.rs` | Error enum (network, parse, circuit breaker open) |
| Config fields | `src/config.rs` | `mcp_discovery_cache_ttl_secs`, `mcp_discovery_cache_max_entries` |
| AppState field | `src/state.rs` | `mcp_discovery: Arc<LazyMcpDiscovery>` |

### Cache Strategy

- **Engine**: moka 0.12 `sync::Cache` (thread-safe, O(1) get/insert)
- **Key**: upstream server URL (String)
- **Value**: `UpstreamCapabilities` (Clone + Send + Sync + 'static)
- **TTL**: per-entry, configurable via `STOA_MCP_DISCOVERY_CACHE_TTL_SECS` (default 300)
- **Capacity**: max entries, configurable via `STOA_MCP_DISCOVERY_CACHE_MAX_ENTRIES` (default 256)
- **Eviction**: TTL expiry + LRU when at max capacity (moka handles both)

### Resilience

- **Circuit breaker**: per-upstream via `CircuitBreakerRegistry`, prevents repeated probes to failing upstreams
- **Retry**: exponential backoff (3 attempts) when circuit is closed
- **Fallback**: `DiscoveryError::CircuitBreakerOpen` returned when circuit is open (fast-fail, no network call)

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `STOA_MCP_DISCOVERY_CACHE_TTL_SECS` | `300` | Cache TTL in seconds |
| `STOA_MCP_DISCOVERY_CACHE_MAX_ENTRIES` | `256` | Maximum cached upstreams |

## Consequences

### Positive

- Gateway startup time unchanged (no blocking discovery)
- Memory-efficient: only caches upstreams that are actually used
- Circuit breaker prevents thundering herd on failing upstreams
- Configurable TTL allows tuning freshness vs. performance per deployment
- Foundation for MCP Federation (ADR-046) tool routing

### Negative

- First request to each upstream incurs discovery latency (~50-500ms depending on network)
- Cache TTL means capabilities changes are not immediately visible (bounded staleness)
- `entry_count()` on moka cache is eventually consistent (test consideration, not runtime issue)

### Risks

- **Upstream protocol mismatch**: upstream may not implement `/mcp/capabilities`. Mitigation: parse errors return `DiscoveryError::ParseError`, circuit breaker trips after repeated failures.
- **Cache stampede**: multiple concurrent requests for the same uncached upstream. Mitigation: moka's built-in deduplication (only one probe runs, others wait). Future: consider `get_with()` for guaranteed single-flight.

## Test Coverage

10 unit tests covering:
- Capability parsing (5 variants: full, minimal, empty, missing fields, invalid JSON)
- Serde roundtrip (serialize/deserialize consistency)
- Cache hit path (cached response returned without network call)
- Cache miss with unreachable upstream (error propagation)
- Cache invalidation (entry removed, count decremented)
- Entry counting (insert → count → verify)
