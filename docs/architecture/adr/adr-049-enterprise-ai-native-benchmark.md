---
title: "ADR-049: Enterprise AI-Native Gateway Benchmark"
description: "Introduces a two-layer benchmark framework: Layer 0 measures raw proxy throughput (existing), Layer 1 measures enterprise AI readiness across 8 dimensions including MCP support, auth chains, guardrails, and governance."
keywords: [benchmark, arena, enterprise, MCP, AI readiness, gateway comparison, k6, Prometheus]
---

# ADR-049: Enterprise AI-Native Gateway Benchmark

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-22 |
| **Decision Makers** | Platform Team |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — edge-mcp mode provides the MCP endpoints benchmarked here
- **ADR-012**: MCP RBAC — policy evaluation chain tested by the policy dimension
- **ADR-039**: mTLS Cert-Bound Tokens — auth chain includes mTLS stage validation

## Context

Gateway Arena v1 measures raw HTTP proxy throughput: sequential latency, burst capacity, ramp-up, and availability. In this benchmark, Kong consistently scores ~87 and STOA ~73 — because Kong is an optimized nginx proxy with years of production tuning, and that's exactly what v1 measures.

The problem: **proxy throughput is the wrong metric for AI-native gateways**. Arena v1 tests zero AI-specific capabilities. It doesn't measure whether a gateway can serve MCP tools, enforce AI guardrails, evaluate OPA policies on tool calls, detect PII in agent payloads, or provide session governance for autonomous agents. Kong and Gravitee score well because the test is designed for their strengths.

STOA competes on a different axis: enterprise AI readiness. The gateway supports MCP protocol discovery, JSON-RPC tool execution, OAuth 2.1 with PKCE, OPA policy evaluation, PII detection/redaction, per-consumer rate limiting, circuit breakers, and agent session governance. None of these capabilities are tested by Arena v1.

### Problem Statement

How do we benchmark what actually matters for AI-native API gateways, without invalidating the existing proxy baseline?

## Decision

Introduce a **two-layer benchmark framework**:

```
Layer 0 — Proxy Baseline (existing, unchanged)
  Score: Measures raw HTTP proxy throughput
  Methodology: 7 scenarios, median-of-5, CI95
  Schedule: Every 30 min (existing CronJob)

Layer 1 — Enterprise AI Readiness (NEW)
  Score: Measures 8 enterprise dimensions
  Methodology: 8 scenarios, median-of-3, CI95
  Schedule: Hourly (new CronJob)
```

Layer 0 stays untouched. Layer 1 is additive — a separate CronJob, separate Prometheus metrics, separate Grafana dashboard.

### 8 Enterprise Dimensions

| # | Dimension | Weight | What It Tests | Endpoint | Latency Cap |
|---|-----------|--------|---------------|----------|-------------|
| 1 | MCP Discovery | 0.15 | `GET /mcp/capabilities` returns valid JSON with capability listing | `/mcp/capabilities` | 500ms |
| 2 | MCP Tool Execution | 0.20 | `POST /mcp/tools/list` via JSON-RPC, response within p95 cap | `/mcp/tools/list` | 500ms |
| 3 | Auth Chain | 0.15 | JWT Bearer token + MCP tool call, full auth pipeline | `/mcp/tools/list` + JWT | 1s |
| 4 | Policy Engine | 0.15 | OPA evaluation overhead on MCP endpoints | `/mcp/capabilities` | 200ms |
| 5 | AI Guardrails | 0.10 | PII in tool call payload blocked or redacted | `/mcp/tools/call` + PII | 1s |
| 6 | Rate Limiting | 0.10 | 429 enforcement fires on burst, valid requests pass | `/mcp/capabilities` | 1s |
| 7 | Resilience | 0.10 | Bad tool call returns 4xx graceful error, not 500 crash | `/mcp/tools/call` + bad input | 1s |
| 8 | Agent Governance | 0.05 | Session and governance endpoints exist and respond | `/admin/sessions/stats` | 2s |

### Scoring Formula

Each dimension score (0-100):

```
availability_score = passes / (passes + fails) * 100
latency_score = max(0, 100 * (1 - p95 / cap))
dimension_score = 0.6 * availability_score + 0.4 * latency_score
```

Composite Enterprise Readiness Index:

```
ERI = sum(weight_i * dimension_score_i)
```

**If a gateway doesn't implement a feature, it scores 0 — not N/A.** The 0 is honest and factual: the capability is absent. It's also an invitation: implement MCP and your score goes up.

### Open Participation Model

The benchmark spec is public (this ADR). Any gateway can participate:

1. Implement MCP endpoints (either STOA REST or Streamable HTTP JSON-RPC 2.0)
2. Add a gateway entry to the GATEWAYS JSON:
   ```json
   {
     "name": "my-gw",
     "target": "http://my-gateway:8080",
     "mcp_base": "http://my-gateway:8080/mcp",
     "mcp_protocol": "streamable-http",
     "health": "http://my-gateway:8080/health"
   }
   ```
   `mcp_protocol` values: `"stoa"` (REST paths) or `"streamable-http"` (JSON-RPC 2.0 on single endpoint). Default: `"stoa"`.
3. Run the benchmark
4. Submit results (or run it yourself — the k6 scripts are open source)

We define the category, but we don't lock the door.

## Alternatives Considered

### A. Modify Arena v1 to include enterprise scenarios

**Rejected.** Mixing proxy and enterprise scenarios in one CronJob conflates two different measurement axes. A gateway scoring 90 (is it fast? AI-ready? both?) is meaningless. Two separate scores give clarity.

### B. Weight enterprise dimensions into the existing composite score

**Rejected.** This would retroactively lower Kong/Gravitee scores, which is unfair. They never claimed to be AI-native gateways. Let them compete on Layer 0 where they're strong. Layer 1 is a new game.

### C. Use N/A instead of 0 for unsupported features

**Rejected.** N/A makes comparison impossible (you can't average N/A). Score 0 is mathematically clean and strategically honest: "you don't have this capability." The blog and ADR explain the scoring clearly — there's no hidden agenda.

### D. Only benchmark STOA (single-gateway enterprise test)

**Rejected.** A benchmark with one participant isn't a benchmark — it's a vanity metric. Including Kong and Gravitee (even at score 0) makes it a real comparison that others can join.

## Consequences

### Positive

- **Category creation**: STOA defines "Enterprise AI Readiness" as a benchmark category. No existing benchmark measures this.
- **Honest comparison**: Layer 0 shows where Kong is better (proxy throughput). Layer 1 shows where STOA is better (AI capabilities). Readers get the full picture.
- **Open invitation**: Any gateway vendor can run the same benchmark. The scoring is transparent, the code is open source.
- **Marketing leverage**: The Enterprise Readiness Index is a concrete, reproducible number — not a subjective claim.

### Negative

- **Maintenance cost**: Two CronJobs, two dashboards, two sets of scripts to maintain.
- **Perception risk**: Skeptics may see a benchmark designed to make STOA win. Mitigation: Layer 0 is kept unchanged (showing STOA's lower proxy score), and the spec is open.
- **Enterprise scenarios are heavier**: 3 runs instead of 5, hourly instead of every 30 min. Acceptable tradeoff for the additional compute cost.

### Neutral

- Kong's MCP support (`ai-mcp-proxy` plugin, since 3.12) requires an Enterprise license; the OSS edition tested in the arena does not include MCP. Kong Enterprise users can add their gateway to the config.
- Gravitee 4.8 community edition includes an MCP entrypoint (Apache 2.0). The arena tests Gravitee via Streamable HTTP (JSON-RPC 2.0) protocol using the `mcp_protocol: "streamable-http"` config field.

## Implementation

| Deliverable | Repo | Key Files |
|-------------|------|-----------|
| k6 enterprise scenarios | stoa | `scripts/traffic/arena/benchmark-enterprise.js` |
| Shell orchestrator | stoa | `scripts/traffic/arena/run-arena-enterprise.sh` |
| Python scorer | stoa | `scripts/traffic/arena/run-arena-enterprise.py` |
| K8s CronJob | stoa | `k8s/arena/cronjob-enterprise.yaml` |
| Deploy scripts | stoa | `k8s/arena/deploy-enterprise.sh`, `deploy.sh` (updated) |
| Grafana dashboard | stoa | `docker/observability/grafana/dashboards/gateway-arena-enterprise.json` |
| Rules documentation | stoa | `.claude/rules/gateway-arena.md` (updated) |
| This ADR | stoa-docs | `docs/architecture/adr/adr-049-*` |
| Blog post | stoa-docs | `blog/2026-02-22-*` |
