---
sidebar_position: 8
title: "Benchmark Methodology"
description: "Complete methodology for the Gateway Arena benchmark: scoring formulas, statistical methods, scenario definitions, architecture, and how to add a new gateway."
keywords:
  - benchmark methodology
  - gateway arena
  - scoring formula
  - CI95 confidence intervals
  - k6 benchmark
  - api gateway comparison
  - enterprise ai readiness
  - mcp benchmark
---

<!-- last verified: 2026-02 -->

# Benchmark Methodology

This document describes the full methodology behind the **Gateway Arena**, STOA's continuous comparative benchmark for API gateways. For results, see [Performance Benchmarks](/docs/reference/performance-benchmarks). For the architectural decision, see [ADR-049](/docs/architecture/adr/adr-049-enterprise-ai-native-benchmark).

## Design Principles

The Gateway Arena is built on four principles:

1. **Fair comparison** — All gateways hit the same local echo backend (nginx, static JSON, &lt;1ms response). Benchmarks measure pure gateway overhead, not backend or network latency.
2. **Statistical rigor** — Median-of-N scoring with Student's t-distribution CI95 confidence intervals. No cherry-picked best runs.
3. **Reproducibility** — All scripts are open source. Anyone can run the same benchmark on their own infrastructure.
4. **Open participation** — Any gateway can be added to the Arena. Same scenarios, same scoring, same methodology.

## Two-Layer Framework

The Arena has two independent layers, each with its own CronJob, metrics, and Grafana dashboard.

| Property | Layer 0: Proxy Baseline | Layer 1: Enterprise AI Readiness |
|----------|------------------------|----------------------------------|
| **Measures** | Raw HTTP proxy throughput | AI-native gateway capabilities |
| **Scenarios** | 7 (warmup, health, sequential, burst, sustained, ramp) | 8 enterprise dimensions |
| **Runs** | 5 (1 discarded) → 4 valid | 3 (1 discarded) → 2 valid |
| **Schedule** | Every 30 minutes | Every hour |
| **Score range** | 0–100 | 0–100 (Enterprise Readiness Index) |
| **CronJob** | `gateway-arena` | `gateway-arena-enterprise` |
| **Prometheus job** | `gateway_arena` | `gateway_arena_enterprise` |

---

## Layer 0: Proxy Baseline

### Scenarios

Each scenario is a separate k6 invocation with different load profiles.

| # | Scenario | Executor | VUs | Iterations/Duration | Purpose |
|---|----------|----------|-----|---------------------|---------|
| 0 | `warmup` | shared-iterations | 10 | 50 iterations, 15s max | JVM/runtime warm-up. **Discarded from scoring.** |
| 1 | `health` | shared-iterations | 1 | 1 iteration, 10s max | Health probe baseline |
| 2 | `sequential` | shared-iterations | 1 | 20 iterations, 30s max | Single-client P95 latency |
| 3 | `burst_10` | shared-iterations | 10 | 10 iterations, 15s max | Light burst |
| 4 | `burst_50` | ramping-vus | 0→50 | 5s ramp, 10s hold, 3s ramp-down | Medium burst capacity |
| 5 | `burst_100` | ramping-vus | 0→100 | 5s ramp, 10s hold, 3s ramp-down | Heavy burst capacity |
| 6 | `sustained` | shared-iterations | 1 | 100 iterations, 60s max | Consistency under steady load |
| 7 | `ramp_up` | ramping-arrival-rate | 10→100 req/s | 60s (6 stages) | Throughput scaling |

### Run Protocol

For each gateway, the orchestrator (`run-arena.sh`) executes:

```
For run = 1 to 5:
  For scenario in [warmup, health, sequential, burst_10, burst_50, burst_100, sustained, ramp_up]:
    k6 run benchmark.js --env SCENARIO={scenario} → JSON summary
```

Run 1 is the warm-up run and is **discarded** from scoring. Runs 2–5 are scored.

### Scoring Formula

The composite score is a weighted sum of 7 dimension scores:

```
Score = 0.10 × Base
      + 0.20 × Burst50
      + 0.20 × Burst100
      + 0.15 × Availability
      + 0.10 × Error
      + 0.10 × Consistency
      + 0.15 × RampUp
```

#### Dimension: Base (Sequential Latency)

Measures single-client P95 latency against a cap of **400ms**.

```
Base = max(0, min(100, 100 × (1 − P95_sequential / 0.4)))
```

A P95 of 0ms scores 100. A P95 of 400ms scores 0.

#### Dimension: Burst50 / Burst100

Same formula with different caps:

```
Burst50  = max(0, min(100, 100 × (1 − P95_burst50  / 2.5)))
Burst100 = max(0, min(100, 100 × (1 − P95_burst100 / 4.0)))
```

| Dimension | Latency Cap | P95 = 0 | P95 = Cap | P95 > Cap |
|-----------|-------------|---------|-----------|-----------|
| Base | 400ms | 100 | 0 | 0 |
| Burst50 | 2.5s | 100 | 0 | 0 |
| Burst100 | 4.0s | 100 | 0 | 0 |

#### Dimension: Availability & Error

Both use the same formula, based on total successful checks across all runs:

```
Availability = Error = 100 × (total_ok / total_requests)
```

Where `total_ok` and `total_requests` are summed across all scenarios and all valid runs. If no requests are made, defaults to 50.

#### Dimension: Consistency

Uses **IQR-based coefficient of variation** from the `sustained` scenario. This is robust to bimodal network latency (unlike standard deviation).

```
IQR_CV = (P75 − P25) / P50
Consistency = max(0, min(100, 100 × (1 − IQR_CV)))
```

A perfectly consistent gateway (P75 = P25) scores 100. High variance scores lower.

#### Dimension: Ramp-Up

Measures throughput scaling under increasing load. The `ramp_up` scenario uses a `ramping-arrival-rate` executor that pushes from 10 to 100 requests/second over 60 seconds.

```
effective_rate = observed_rate × success_rate
```

If P99 exceeds 2 seconds, a penalty is applied:

```
if P99 > 2s:
  effective_rate × max(0.5, 1.0 − (P99 − 2.0) / 8.0)
```

The score is the effective rate capped at 100:

```
RampUp = min(100, effective_rate)
```

### Weight Summary

| Weight | Dimension | What It Rewards |
|--------|-----------|-----------------|
| 0.20 | Burst50 | Medium-scale burst handling |
| 0.20 | Burst100 | Heavy-scale burst handling |
| 0.15 | Availability | Request success rate |
| 0.15 | RampUp | Throughput scaling |
| 0.10 | Base | Low single-client latency |
| 0.10 | Error | Error-free operation |
| 0.10 | Consistency | Predictable response times |

Burst handling is weighted highest (40% combined) because API gateways in production face bursty traffic patterns more than sustained load.

---

## Layer 1: Enterprise AI Readiness

### 8 Dimensions

| # | Dimension | Weight | Scenario | Latency Cap |
|---|-----------|--------|----------|-------------|
| 1 | MCP Discovery | 0.15 | `ent_mcp_discovery` | 500ms |
| 2 | MCP Tool Execution | 0.20 | `ent_mcp_toolcall` | 500ms |
| 3 | Auth Chain | 0.15 | `ent_auth_chain` | 1s |
| 4 | Policy Engine | 0.15 | `ent_policy_eval` | 200ms |
| 5 | AI Guardrails | 0.10 | `ent_guardrails` | 1s |
| 6 | Rate Limiting | 0.10 | `ent_quota_burst` | 1s |
| 7 | Resilience | 0.10 | `ent_resilience` | 1s |
| 8 | Agent Governance | 0.05 | `ent_governance` | 2s |

### Per-Dimension Scoring

Each dimension score is a weighted blend of availability and latency:

```
availability_score = passes / (passes + fails) × 100
latency_score     = max(0, min(100, 100 × (1 − P95 / cap)))
dimension_score   = 0.6 × availability_score + 0.4 × latency_score
```

Availability is weighted higher (60%) because an AI gateway that doesn't support a feature scores 0 regardless of latency.

### Enterprise Readiness Index (ERI)

The composite score is the weighted sum of all dimensions:

```
ERI = Σ (weight_i × dimension_score_i)
```

**Gateways without MCP support score 0** — not N/A. This is intentional: the absence of a capability is a concrete, honest measurement. Any gateway can implement MCP and re-run the benchmark.

### MCP Protocol Support

The benchmark supports two MCP protocol variants:

| Protocol | Config Value | Endpoint Pattern | Used By |
|----------|-------------|-----------------|---------|
| STOA REST | `"stoa"` | `GET /mcp/capabilities`, `POST /mcp/tools/list`, `POST /mcp/tools/call` | STOA Gateway |
| Streamable HTTP | `"streamable-http"` | `POST /mcp` with JSON-RPC 2.0 envelope | Gravitee 4.8+ |

The k6 script reads `MCP_PROTOCOL` to switch between request formats. Both protocols are tested with the same scoring formula.

---

## Statistical Methods

### Median Selection

All per-scenario metrics (P50, P95, P99, pass/fail counts) are computed as the **median** of valid runs. Median is preferred over mean because it is robust to a single outlier run caused by GC pauses, noisy neighbors, or transient network issues.

```python
def median(values):
    s = sorted(values)
    return s[len(s) // 2]
```

For Layer 0: 5 runs, 1 discarded → 4 valid runs → median of 4.
For Layer 1: 3 runs, 1 discarded → 2 valid runs → median of 2.

### CI95 Confidence Intervals

Confidence intervals use **Student's t-distribution** (not z-scores) because sample sizes are small (n=2–4). The t-distribution has heavier tails, producing wider (more honest) intervals for small samples.

```
CI95 = mean ± t(α/2, df) × (stddev / √n)

where:
  df = n − 1               (degrees of freedom)
  t(α/2, df)               (t-critical value for 95% confidence)
  stddev = √(Σ(xi − mean)² / (n − 1))  (sample standard deviation)
```

#### t-Critical Values

| df | t-critical | Typical n |
|----|-----------|-----------|
| 1 | 12.706 | 2 runs (Layer 1) |
| 2 | 4.303 | 3 runs |
| 3 | 3.182 | 4 runs (Layer 0) |
| 4 | 2.776 | 5 runs |
| ≥120 | 1.96 | Large samples (≈ z-score) |

CI95 bounds are clamped to `[0, 100]` for composite scores.

### Why Not z-Scores?

With n=4 runs, using z=1.96 instead of t=3.182 would produce confidence intervals that are **50% too narrow**, giving a false impression of precision. The t-distribution correctly accounts for the uncertainty inherent in small sample sizes.

---

## Architecture

### Infrastructure

```
K8s CronJob (OVH MKS, co-located):
  run-arena.sh (orchestrator)
    └── For each gateway (3 K8s + N VPS):
        └── For each run (5):
            ├── k6 run (warmup) → discard
            └── k6 run (7 scenarios) → JSON summaries
  run-arena.py (scorer)
    └── Reads JSON → median → composite score → CI95 → Prometheus text
    └── curl POST → Pushgateway

VPS Sidecar (host cron, co-located):
  Same Docker image + scripts
  Benchmarks 1 local gateway → pushes to Pushgateway
```

### Echo Backend

All gateways proxy to a shared echo server — an nginx container returning a static JSON payload in &lt;1ms:

```json
{"status": "ok", "server": "echo-k8s"}
```

This ensures benchmarks measure **gateway overhead only**, not backend performance or network latency. The echo server runs on the same cluster/host as the gateway being tested.

### Current Participants

#### In-Cluster (K8s — OVH MKS)

| Gateway | Proxy Port | Health Endpoint | Backend |
|---------|-----------|----------------|---------|
| STOA | 8080 | `/health` | echo-backend:8888 |
| Kong DB-less | 8000 | `:8001/status` | echo-backend:8888 |
| Gravitee APIM | 8082 | `:18082/_node/health` | echo-backend:8888 |

#### VPS (Co-located Sidecars)

| Gateway | Host | Proxy Port | Backend |
|---------|------|-----------|---------|
| STOA | 51.83.45.13 | 8080 | echo-local:8888 |
| Kong | 51.83.45.13 | 8000 | echo-local:8888 |
| Gravitee | 54.36.209.237 | 8082 | echo-local:8888 |

### Prometheus Metrics

#### Layer 0

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `gateway_arena_score` | gauge | `gateway` | Composite score (0–100) |
| `gateway_arena_score_stddev` | gauge | `gateway` | Run-to-run standard deviation |
| `gateway_arena_score_ci_lower` | gauge | `gateway` | CI95 lower bound |
| `gateway_arena_score_ci_upper` | gauge | `gateway` | CI95 upper bound |
| `gateway_arena_runs` | gauge | `gateway` | Number of valid runs |
| `gateway_arena_availability` | gauge | `gateway` | Health check success rate (0–1) |
| `gateway_arena_p50_seconds` | gauge | `gateway`, `scenario` | Median latency per scenario |
| `gateway_arena_p95_seconds` | gauge | `gateway`, `scenario` | P95 latency per scenario |
| `gateway_arena_p99_seconds` | gauge | `gateway`, `scenario` | P99 latency per scenario |
| `gateway_arena_ramp_rate` | gauge | `gateway` | Peak sustained req/s |
| `gateway_arena_requests_total` | gauge | `gateway`, `scenario`, `status` | Request counts |

Each latency metric also has `_ci_lower_seconds` and `_ci_upper_seconds` variants with the same labels.

#### Layer 1

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `gateway_arena_enterprise_score` | gauge | `gateway` | Enterprise Readiness Index (0–100) |
| `gateway_arena_enterprise_dimension` | gauge | `gateway`, `dimension` | Per-dimension score (0–100) |
| `gateway_arena_enterprise_score_ci_lower` | gauge | `gateway` | CI95 lower bound |
| `gateway_arena_enterprise_score_ci_upper` | gauge | `gateway` | CI95 upper bound |
| `gateway_arena_enterprise_score_stddev` | gauge | `gateway` | Run-to-run standard deviation |
| `gateway_arena_enterprise_runs` | gauge | `gateway` | Valid enterprise run count |
| `gateway_arena_enterprise_latency_p95` | gauge | `gateway`, `dimension` | P95 latency per dimension |

---

## Adding a New Gateway

### K8s (In-Cluster)

1. Deploy the gateway in the `stoa-system` namespace with a Service
2. Configure a route to the echo backend: `http://echo-backend.stoa-system.svc:8888`
3. Add an entry to the `GATEWAYS` JSON in `k8s/arena/cronjob-prod.yaml`:

```json
{
  "name": "my-gateway",
  "health": "http://my-gw-svc.stoa-system.svc:PORT/health",
  "proxy": "http://my-gw-svc.stoa-system.svc:PORT/echo/get"
}
```

4. For Layer 1, add MCP fields:

```json
{
  "name": "my-gateway",
  "target": "http://my-gw-svc:PORT",
  "health": "http://my-gw-svc:PORT/health",
  "mcp_base": "http://my-gw-svc:PORT/mcp",
  "mcp_protocol": "stoa"
}
```

5. Update the ConfigMap and run a manual benchmark:

```bash
kubectl create configmap gateway-arena-scripts \
  --from-file=scripts/traffic/arena/benchmark.js \
  --from-file=scripts/traffic/arena/run-arena.sh \
  --from-file=scripts/traffic/arena/run-arena.py \
  -n stoa-system --dry-run=client -o yaml | kubectl apply -f -

kubectl create job --from=cronjob/gateway-arena arena-test-$(date +%s) -n stoa-system
```

### VPS (Co-located Sidecar)

1. Deploy the gateway on the VPS
2. Deploy the echo container on the same Docker network
3. Add VPS configuration to `deploy/vps/bench/deploy.sh`
4. Run: `./deploy/vps/bench/deploy.sh`

### Verification

After adding a gateway, verify metrics appear in Pushgateway:

```bash
curl -s https://pushgateway.gostoa.dev/metrics | grep 'gateway="my-gateway"'
```

---

## Score Interpretation

| Score | Rating | Typical Cause |
|-------|--------|---------------|
| > 95 | Excellent | Co-located gateway with minimal overhead (Rust, C, optimized nginx) |
| 80–95 | Good | Well-configured gateway, normal for production setups |
| 60–80 | Acceptable | Check resource constraints, network hops, or JVM tuning |
| < 60 | Investigate | Connection failures, high error rates, or misconfiguration |

### Reading CI95 Bounds

- **Narrow bounds** (e.g., `[82, 88]`): stable, reproducible results
- **Wide bounds** (e.g., `[60, 95]`): high run-to-run variance — investigate noisy neighbors, GC pauses, or cold-start effects
- **Bounds crossing a threshold** (e.g., `[78, 92]` crossing 80): the gateway's true performance is ambiguous at that threshold — more runs would narrow the interval

---

## Reproducibility

All Arena scripts are in the [`scripts/traffic/arena/`](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic/arena) directory of the stoa repository.

| File | Purpose |
|------|---------|
| `benchmark.js` | k6 scenario definitions (Layer 0) |
| `benchmark-enterprise.js` | k6 enterprise scenarios (Layer 1) |
| `run-arena.sh` | Shell orchestrator (Layer 0) |
| `run-arena-enterprise.sh` | Shell orchestrator (Layer 1) |
| `run-arena.py` | Python scorer with CI95 (Layer 0) |
| `run-arena-enterprise.py` | Python scorer with CI95 (Layer 1) |
| `Dockerfile` | Arena image: k6 0.54.0 + jq + curl + bash + python3 |

### Running Locally

```bash
# Build the arena image
docker build -t arena-bench scripts/traffic/arena/

# Run Layer 0 against a local gateway
docker run --rm \
  -e GATEWAYS='[{"name":"local","health":"http://host.docker.internal:8080/health","proxy":"http://host.docker.internal:8080/echo/get"}]' \
  -e RUNS=3 \
  -e DISCARD_FIRST=1 \
  arena-bench /scripts/run-arena.sh
```

### Running on Kubernetes

```bash
# Layer 0 — one-off
kubectl create job --from=cronjob/gateway-arena arena-manual -n stoa-system
kubectl logs -n stoa-system -l job-name=arena-manual --follow

# Layer 1 — one-off
kubectl create job --from=cronjob/gateway-arena-enterprise arena-ent-manual -n stoa-system
kubectl logs -n stoa-system -l job-name=arena-ent-manual --follow

# Clean up
kubectl delete job arena-manual arena-ent-manual -n stoa-system
```

---

## Limitations and Known Biases

- **Network locality** — K8s gateways run on the same cluster as k6 (co-located). VPS gateways run on the same host. Cross-network benchmarks are not comparable due to variable latency.
- **JVM warm-up** — The warmup run mitigates cold-start bias for JVM-based gateways (Kong/OpenResty, Gravitee), but 50 iterations may not fully warm all code paths.
- **Small sample size** — Layer 1 uses only 2 valid runs (3 total, 1 discarded). CI95 bounds with df=1 use t=12.706, producing very wide intervals. This is statistically correct but limits precision.
- **MCP scoring bias** — Layer 1 inherently favors gateways with MCP support. This is by design: the benchmark measures AI-native capabilities. Layer 0 provides the complementary proxy baseline.
- **Echo backend assumes GET** — All proxy scenarios use HTTP GET against the echo backend. POST/PUT patterns with request body parsing are not benchmarked.

> Feature comparisons are based on tests run under identical conditions as of the date noted above. Gateway capabilities change frequently. We encourage readers to verify current performance with their own workloads. All trademarks belong to their respective owners. See [trademarks](/docs/trademarks).
