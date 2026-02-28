---
title: "ADR-052: Benchmark OpenSearch Persistence & LLM Routing Dimension"
description: "Extends the Enterprise AI Readiness Benchmark (ADR-049) with OpenSearch persistence for historical trending, ISM lifecycle management, and adds Dimension 9: LLM Routing in observation mode."
keywords: [benchmark, opensearch, persistence, historical, ILM, LLM routing, arena, trending]
---

# ADR-052: Benchmark OpenSearch Persistence & LLM Routing Dimension

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-28 |
| **Decision Makers** | Platform Team |
| **Ticket** | CAB-1601 |

### Related Decisions

- **ADR-049**: Enterprise AI-Native Gateway Benchmark — defines the 8-dimension framework this ADR extends
- **ADR-024**: Gateway Unified Modes — LLM proxy mode enables the new dimension

## Context

ADR-049 introduced the Enterprise AI Readiness Benchmark (Layer 1) with 8 dimensions, scoring 98.24/100 across 7 sprints of optimization. However, all benchmark data is ephemeral — it exists only in Prometheus via the Pushgateway, which retains metrics for ~2 weeks before scraping stops.

This creates three problems:

1. **No historical trending**: We cannot answer "Has STOA's MCP discovery score improved over the last 3 months?" or "When did Gravitee's MCP support appear?"
2. **No per-dimension drill-down**: Pushgateway metrics are aggregated. We store composite scores and per-dimension gauges, but not the raw availability/latency breakdown that explains *why* a score changed.
3. **Missing dimension**: The gateway's LLM proxy (`/v1/messages` route, ADR-024) is not benchmarked. This capability differentiates STOA from pure API gateways but has zero measurement.

### Requirements

- Persist per-dimension, per-gateway, per-run data for at least 12 months
- Support Grafana dashboards for historical composite score trending, per-dimension heatmaps, and CI95 confidence bands
- Add LLM Routing as Dimension 9 without affecting the existing composite score (observation mode)
- Maintain backward compatibility with existing Pushgateway metrics pipeline

## Decision

### 1. OpenSearch as the Persistence Backend

Benchmark results are exported to OpenSearch using a monthly index pattern `stoa-bench-{yyyy.MM}`. Each run produces **1 document per dimension per gateway** (not 1 flat document per gateway), enabling Grafana drill-down by dimension.

#### Document Schema

```json
{
  "@timestamp": "2026-02-28T14:00:00Z",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "layer": "enterprise",
  "instance": "k8s",
  "gateway": "stoa-k8s",
  "dimension": "mcp_discovery",
  "dimension_score": 98.5,
  "composite_score": 98.24,
  "availability": {
    "passes": 50,
    "fails": 0,
    "score": 100.0
  },
  "latency": {
    "p50": 0.012,
    "p95": 0.035,
    "p99": 0.052,
    "cap": 0.5,
    "score": 93.0
  },
  "weight": 0.15,
  "ci95": {
    "lower": 97.1,
    "upper": 99.4
  },
  "stddev": 0.82
}
```

**Index template** (`stoa-bench-*`): keyword fields for gateway/dimension/layer/instance/run_id, half_float for scores, float for latencies, date for @timestamp. One shard, one replica.

**Bulk API**: Documents are exported via the `_bulk` endpoint (single HTTP request per run) to minimize OpenSearch overhead.

#### Why OpenSearch (Not Prometheus Long-Term)

| Option | Pros | Cons |
|--------|------|------|
| Prometheus + Thanos/Cortex | Already in stack | Overkill for ~1000 docs/day; no native nested object support; complex HA setup |
| OpenSearch | Already deployed for logs; native JSON docs; Grafana plugin exists; ISM for lifecycle | Separate datasource in Grafana |
| PostgreSQL | Already deployed for CP API | Wrong tool for time-series aggregation; no native Grafana integration |

OpenSearch is already running in the cluster for log aggregation. Adding a new index pattern is zero infrastructure cost.

### 2. Index Lifecycle Management (ISM)

The `stoa-bench-lifecycle` ISM policy manages index retention:

| Phase | Duration | Actions |
|-------|----------|---------|
| Hot | 30 days | Default — read/write, full replicas |
| Warm | 30-90 days | Read-only, force merge to 1 segment |
| Cold | 90-365 days | Replica count = 0 (save storage) |
| Delete | >365 days | Auto-delete |

At ~1000 docs/day (9 dimensions × 3 gateways × ~37 runs), monthly indexes stay under 50MB. Total yearly storage: ~600MB.

### 3. Dimension 9: LLM Routing (Observation Mode)

A new dimension measures the gateway's ability to proxy LLM API requests via `POST /v1/messages` (Anthropic format):

| Field | Value |
|-------|-------|
| Key | `llm_routing` |
| Scenario | `ent_llm_routing` |
| Weight | **0.00** (observation mode) |
| Latency Cap | 2.0s |
| Requires MCP | No |

**Observation mode** means:
- The score is computed and persisted in OpenSearch
- The score is visible on the historical dashboard
- The score does **not** affect the composite Enterprise Readiness Index
- Weight will be increased (e.g., 0.10) after validation across multiple runs, by reducing other weights proportionally

**Mock backend**: An nginx pod (`llm-mock-backend`) returns static Anthropic API format JSON in ~5ms. This isolates the benchmark from real LLM latency, measuring only gateway proxy overhead.

**Checks**:
- `llm_routing_status_2xx` — Response is 2xx
- `llm_routing_valid_json` — Response is valid JSON
- `llm_routing_has_message` — Response contains `"type": "message"`
- `llm_routing_has_usage` — Response contains `usage.input_tokens > 0`

### 4. Dual Export (Pushgateway + OpenSearch)

Both pipelines run in parallel:
- **Pushgateway**: Existing pipeline, unchanged. Powers the live Grafana dashboard (`gateway-arena-enterprise.json`).
- **OpenSearch**: New pipeline. Powers the historical Grafana dashboard (`gateway-arena-historical.json`).

If OpenSearch is unreachable, the run continues — Pushgateway metrics are still exported. The OpenSearch export is best-effort with a warning log.

### 5. Public Corpus

A `corpus/` directory contains 9 JSON files (one per dimension), each with 5 synthetic test tasks. This documents publicly what each dimension measures, enabling other gateways to prepare their implementations before running the benchmark.

## Alternatives Considered

### A. Replace Pushgateway with OpenSearch entirely

**Rejected.** Pushgateway powers existing Prometheus alerts and the live dashboard. Replacing it would break the monitoring stack. Dual export adds less than 100ms per run.

### B. Start LLM Routing at weight 0.10 immediately

**Rejected.** Changing composite scores requires re-normalizing all 8 existing weights. Starting at 0.00 (observation mode) lets us validate the dimension's stability across runs before introducing it into the composite. This prevents score regressions and gives Gravitee/Kong time to implement LLM proxy support if they choose.

### C. Use a real LLM backend for benchmarking

**Rejected.** Real LLM responses have variable latency (200ms-10s) that dominates gateway overhead. A mock backend (~5ms) isolates what we're actually measuring: the gateway's proxy layer, not the LLM's inference time.

## Consequences

### Positive

- **Historical trending**: Grafana dashboards show score evolution over weeks/months, enabling regression detection.
- **Per-dimension drill-down**: Engineers can identify which specific dimension degraded and why (availability vs latency).
- **LLM readiness tracking**: Even at weight 0.00, the LLM Routing score provides visibility into a key differentiator.
- **Open benchmark corpus**: Published task definitions increase transparency and reproducibility.

### Negative

- **Two Grafana datasources**: OpenSearch requires a separate Grafana datasource and plugin.
- **Storage cost**: ~600MB/year in OpenSearch (negligible).
- **Dual export complexity**: Two export paths to maintain (Pushgateway + OpenSearch).

### Neutral

- Existing L0 and L1 Pushgateway metrics are unaffected.
- The composite score remains unchanged until LLM Routing weight is increased in a future decision.

## Implementation

| Deliverable | Repo | Key Files |
|-------------|------|-----------|
| OpenSearch export refactor | stoa | `scripts/traffic/arena/run-arena-enterprise.py` |
| Index template | stoa | `k8s/arena/opensearch-index-template.json` |
| ISM lifecycle policy | stoa | `k8s/arena/opensearch-ism-policy.json` |
| LLM mock backend | stoa | `k8s/arena/llm-mock-backend.yaml` |
| k6 LLM routing scenario | stoa | `scripts/traffic/arena/benchmark-enterprise.js` |
| Historical dashboard | stoa | `docker/observability/grafana/dashboards/gateway-arena-historical.json` |
| Grafana OpenSearch datasource | stoa | `docker/observability/grafana/provisioning/datasources/prometheus.yml` |
| Deploy bootstrap | stoa | `k8s/arena/deploy-enterprise.sh` |
| Public corpus | stoa | `scripts/traffic/arena/corpus/*.json` (9 files) |
| This ADR | stoa-docs | `docs/architecture/adr/adr-052-*` |
