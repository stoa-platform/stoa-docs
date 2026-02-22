---
slug: enterprise-ai-native-gateway-benchmark
title: "Why Proxy Throughput Is the Wrong Benchmark for AI Gateways"
description: "Introducing the Enterprise AI Readiness Index — an open benchmark measuring what actually matters for AI-native API gateways: MCP support, guardrails, governance, and more."
authors: [christophe]
tags: [architecture, comparison, ai, open-source, api-gateway]
keywords:
  - API gateway benchmark
  - enterprise AI readiness
  - MCP gateway benchmark
  - AI-native API gateway
  - gateway comparison 2026
  - API gateway performance
  - open source benchmark
---
<!-- last verified: 2026-02 -->

Proxy throughput benchmarks tell you how fast a gateway can forward HTTP requests. They tell you nothing about whether that gateway can serve AI agents, enforce guardrails on tool calls, or govern autonomous sessions. We built a new benchmark that measures what actually matters.

<!-- truncate -->

## The Problem with Proxy Benchmarks

Every API gateway benchmark you'll find online measures the same thing: how many requests per second can the gateway proxy from A to B. Latency percentiles, burst capacity, connection handling — all variations of the same question: "how fast is your reverse proxy?"

For traditional API gateways, this is the right question. Kong, Envoy, and APISIX are optimized for high-throughput HTTP proxying — a design strength reflected in their architectures and benchmarks.

But 2026 is not 2020. AI agents are making tool calls through MCP. Enterprises need guardrails that detect PII in agent payloads. Security teams need OAuth 2.1 chains that validate JWT tokens on every tool invocation. Platform teams need governance over agent sessions that can run autonomously for hours.

**None of this is measured by a proxy throughput benchmark.**

Our own [Gateway Arena](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic/arena/) runs 7 scenarios measuring raw HTTP performance using [open-source k6 scripts](https://github.com/stoa-platform/stoa/blob/main/scripts/traffic/arena/benchmark.js). In our tests, Kong scores ~87 and STOA scores ~73 — Kong leads on proxy throughput because the test measures what Kong excels at.

But ask the benchmark whether either gateway can serve MCP tools, evaluate OPA policies on tool calls, or block PII in agent payloads — and the answer is silence. The benchmark doesn't know. It wasn't designed to.

## Introducing the Enterprise AI Readiness Index

We're introducing a second layer to Gateway Arena: the **Enterprise AI Readiness Index**. It measures 8 dimensions that define what an AI-native gateway should do:

| Dimension | Weight | What It Tests |
|-----------|--------|---------------|
| **MCP Discovery** | 15% | Does `GET /mcp/capabilities` return valid JSON? |
| **MCP Tool Execution** | 20% | Can `POST /mcp/tools/list` respond within 500ms? |
| **Auth Chain** | 15% | Does JWT + tool call complete within 1 second? |
| **Policy Engine** | 15% | Is OPA evaluation overhead under 200ms? |
| **AI Guardrails** | 10% | Is PII in payloads blocked or redacted? |
| **Rate Limiting** | 10% | Does 429 enforcement fire on burst traffic? |
| **Resilience** | 10% | Does a bad tool call return 4xx, not 500? |
| **Agent Governance** | 5% | Do session governance endpoints exist? |

Each dimension is scored 0-100 based on availability (60% weight) and latency (40% weight). The composite index is the weighted sum.

## Two Layers, One Framework

The key design decision: **two layers, not one**. Layer 0 (proxy throughput) stays untouched. Layer 1 (enterprise AI readiness) is additive.

```
Layer 0 — Proxy Baseline (existing)
  Kong ~87  |  STOA ~73
  Measures: raw HTTP throughput, burst, availability

Layer 1 — Enterprise AI Readiness (new)
  STOA ~95  |  Kong ~5
  Measures: MCP, auth, guardrails, governance
```

Why not merge them? Because they measure different things. A gateway scoring 90 on a combined index — is it fast, AI-ready, or both? You can't tell. Two separate scores give clarity: Kong leads on proxy throughput, STOA leads on AI-native capabilities.

## What Scoring 0 Means

Kong and Gravitee score near-zero on Layer 1. This isn't a bug — it reflects the current state of their public documentation. As of 2026-02, neither Kong's nor Gravitee's documentation describes native MCP endpoint support, OPA-based tool call policies, or built-in PII detection in agent payloads.

**Score 0 means "not implemented," not "broken."**

And here's the important part: it's an invitation. The benchmark spec is open ([ADR-049](/docs/architecture/adr/adr-049-enterprise-ai-native-benchmark)). The [k6 scripts are open source](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic/arena/). Any gateway can:

1. Implement the MCP endpoints
2. Add themselves to the gateway config
3. Run the benchmark
4. Publish their score

If Kong implements MCP tomorrow, their Layer 1 score goes up automatically. No code changes on our side. The benchmark is a level playing field — we just defined what the field measures.

## How We Score Each Dimension

The scoring formula is transparent:

```
availability_score = passes / (passes + fails) × 100
latency_score = max(0, 100 × (1 - p95 / cap))
dimension_score = 0.6 × availability + 0.4 × latency
```

Each dimension has a latency cap. MCP Discovery caps at 500ms — if your p95 is above that, the latency component scores 0. Rate limiting caps at 1 second. Agent governance at 2 seconds (admin endpoints are less latency-critical).

We run 3 runs per gateway (with 1 warmup discarded) and compute CI95 confidence intervals. The methodology mirrors our Layer 0 benchmark: median of valid runs, t-distribution critical values, Prometheus metrics pushed to Pushgateway, Grafana dashboard for visualization.

## The 8 Scenarios in Detail

### 1. MCP Discovery (15%)

```
GET /mcp/capabilities → valid JSON with capability listing
```

The foundation. If your gateway can't tell an AI agent what tools are available, nothing else matters. This tests the MCP protocol discovery endpoint — the equivalent of a REST API's OpenAPI spec, but for AI tools.

### 2. MCP Tool Execution (20%)

```
POST /mcp/tools/list → JSON-RPC response, p95 < 500ms
```

The highest-weighted dimension. Can the gateway serve a tool listing via JSON-RPC within half a second? This is the hot path for every AI agent interaction. A gateway that can't do this isn't an AI gateway.

### 3. Auth Chain (15%)

JWT Bearer token plus MCP tool call. The full authentication pipeline: token validation, scope checking, tool authorization — all within 1 second. Gateways without JWT support on MCP endpoints get partial credit if they enforce any form of auth.

### 4. Policy Engine (15%)

OPA (Open Policy Agent) evaluation overhead. We measure the delta between a raw MCP call and one that passes through OPA policy evaluation. The cap is 200ms — if your policy engine adds more than 200ms of overhead, something is wrong.

### 5. AI Guardrails (10%)

We send a tool call with PII in the payload: "My SSN is 123-45-6789." The gateway should either block the request (4xx) or redact the PII before forwarding. A 500 crash is unacceptable — that means the guardrails themselves are broken.

### 6. Rate Limiting (10%)

Burst traffic against the gateway to trigger 429 responses. Both 200 (request passes) and 429 (rate limit enforced) are valid — they prove the rate limiter is working. A 500 means the rate limiter crashed under load.

### 7. Resilience (10%)

Bad tool call with a non-existent tool name and malformed arguments. The gateway should return a graceful 4xx error with an error body — not a 500 crash or an empty response. This tests error handling in the AI tool execution path.

### 8. Agent Governance (5%)

Do session governance endpoints exist? Can the gateway report on active agent sessions, circuit breaker status, and quota usage? These are enterprise requirements for autonomous agent deployments — you need visibility into what agents are doing.

## Run It Yourself

The entire benchmark is open source. Clone the repo and run:

```bash
# Local test against a running STOA gateway
k6 run --env SCENARIO=ent_mcp_discovery \
  --env TARGET_URL=http://localhost:8080 \
  --env MCP_BASE=http://localhost:8080/mcp \
  --env SUMMARY_FILE=/tmp/ent_test.json \
  scripts/traffic/arena/benchmark-enterprise.js

# Full enterprise benchmark on K8s
kubectl create job --from=cronjob/gateway-arena-enterprise \
  arena-ent-test -n stoa-system
```

Results are pushed to Prometheus Pushgateway and visualized in a dedicated Grafana dashboard.

## What This Means for the Industry

We're not claiming STOA outperforms Kong overall — Kong leads on proxy throughput, as Layer 0 demonstrates. What we are claiming is that **proxy throughput is an incomplete metric for 2026**. The industry needs a benchmark that measures AI readiness, and we're publishing the first one.

The spec is open. The code is open source. The invitation stands: implement MCP, run the benchmark, publish your score.

> Feature comparisons are based on publicly available documentation as of
> 2026-02. Product capabilities change frequently. We encourage readers
> to verify current features directly with each vendor. All trademarks
> belong to their respective owners.

## FAQ

### What is the Enterprise AI Readiness Index?

A composite score (0-100) measuring 8 enterprise dimensions: MCP support, auth chains, OPA policy evaluation, PII guardrails, rate limiting, resilience, and agent governance. It complements traditional proxy throughput benchmarks with AI-specific capabilities.

### Why does Kong score 0 on Layer 1?

As of 2026-02, Kong's public documentation does not describe native MCP endpoints, OPA-based tool call policies, or built-in PII guardrails. Score 0 means "not implemented" — Kong can implement these features and re-run the benchmark to improve their score. The spec is open.

### Can other gateways participate?

Yes. The benchmark scripts are [open source](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic/arena/). Any gateway that implements the tested endpoints can add themselves to the config and run the benchmark. See [ADR-049](/docs/architecture/adr/adr-049-enterprise-ai-native-benchmark) for the full spec.

### How is this different from existing benchmarks?

Traditional benchmarks (like the [TechEmpower Framework Benchmark](https://www.techempower.com/benchmarks/)) measure raw HTTP throughput. The Enterprise AI Readiness Index measures capabilities specific to AI-native gateways: MCP protocol support, AI guardrails, and agent governance. No existing benchmark measures these.

### Is the benchmark biased toward STOA?

STOA designed the benchmark, so the dimensions reflect what we believe matters for AI-native gateways. However: the scoring formula is transparent, the code is open source, and Layer 0 (where Kong outscores STOA) remains unchanged. We welcome peer review and challenge on the dimension choices. Readers can judge whether the 8 dimensions are the right ones.
