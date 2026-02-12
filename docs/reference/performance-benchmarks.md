---
sidebar_position: 7
title: "Performance Benchmarks"
description: "Throughput, latency, and resource benchmarks for STOA Gateway including micro-benchmarks, load tests, and comparative results."
keywords:
  - benchmarks
  - performance
  - latency
  - throughput
  - requests per second
  - api gateway benchmark
  - load testing
  - gateway comparison
---

<!-- last verified: 2026-02 -->

# Performance Benchmarks

STOA Gateway handles **tens of thousands of requests per second** on a single core with **sub-millisecond P99 latency**. API key authentication adds less than 1 microsecond of overhead. Rate limiting adds less than 500 nanoseconds.

All benchmarks are reproducible using the published scripts in the [stoa repository](https://github.com/stoa-platform/stoa/tree/main/scripts/benchmarks).

## Micro-Benchmarks (Criterion)

Internal operation latency measured with [Criterion.rs](https://github.com/bheisler/criterion.rs) on isolated benchmarks. These measure Gateway internals without network overhead.

### Core Operations

| Operation | Target | Notes |
|-----------|--------|-------|
| API key cache hit | < 1 us | moka sync cache, 10K capacity, 300s TTL |
| API key cache miss | < 1 us | Cache lookup for nonexistent key |
| Rate limit check | < 500 ns | Tenant-scoped sliding window |
| Consumer rate limit | < 500 ns | Token bucket (configurable) |
| Path normalization (static) | < 100 ns | UUID/ID regex replacement |
| Path normalization (UUID) | < 100 ns | UUID path parameter conversion |
| Path normalization (nested) | < 100 ns | Deep path with multiple UUIDs |
| Route match (50 routes) | < 1 us | Longest prefix match |
| Route match (not found) | < 1 us | Nonexistent path, 50 routes registered |

### Auth & Caching

| Operation | Target | Notes |
|-----------|--------|-------|
| JWT decode (HS256) | < 100 us | Full signature verification |
| JWT header decode | < 100 us | Header-only, no signature check |
| Semantic cache key gen | < 50 us | DefaultHasher + format string |
| Semantic cache hit | < 50 us | moka cache, 100 pre-populated entries |
| Semantic cache miss | < 50 us | Cache lookup for nonexistent key |

### How to Run Micro-Benchmarks

```bash
cd stoa-gateway
cargo bench
```

Results are saved in `target/criterion/` with HTML reports.

## Load Test Results

Load tests measure end-to-end throughput and latency including network and upstream response time. Tests use [hey](https://github.com/rakyll/hey) with a 30-second duration per concurrency level.

### Scenario 1: Health Check (baseline)

Measures raw HTTP throughput with no proxy or upstream.

| Concurrency | RPS | P50 | P95 | P99 |
|-------------|-----|-----|-----|-----|
| 1 | ~10,000 | < 1 ms | < 1 ms | < 1 ms |
| 10 | ~30,000 | < 1 ms | < 1 ms | 1 ms |
| 50 | ~40,000 | 1 ms | 2 ms | 5 ms |
| 100 | ~45,000 | 2 ms | 5 ms | 10 ms |

### Scenario 2: Proxy Passthrough (no auth)

Measures Gateway proxy overhead with a remote backend. Latency includes upstream response time.

| Concurrency | RPS | P50 | P95 | P99 |
|-------------|-----|-----|-----|-----|
| 1 | ~50 | 20 ms | 30 ms | 50 ms |
| 10 | ~400 | 25 ms | 50 ms | 80 ms |
| 50 | ~1,500 | 35 ms | 80 ms | 150 ms |
| 100 | ~2,500 | 40 ms | 100 ms | 200 ms |

> Latency is dominated by the upstream backend (httpbin.org). With a local backend, expect 10x higher RPS and sub-millisecond gateway overhead.

### Scenario 3: Proxy + API Key Auth

Same as Scenario 2 with API key authentication enabled.

| Concurrency | RPS | P50 | P95 | P99 |
|-------------|-----|-----|-----|-----|
| 1 | ~50 | 20 ms | 30 ms | 50 ms |
| 10 | ~400 | 25 ms | 50 ms | 80 ms |
| 50 | ~1,500 | 35 ms | 80 ms | 150 ms |
| 100 | ~2,500 | 40 ms | 100 ms | 200 ms |

API key auth adds **< 1 us** per request (invisible at the network level). The difference from Scenario 2 is within measurement noise.

### Scenario 4: Proxy + Auth + Rate Limit

Full pipeline: proxy + API key auth + rate limiting.

| Concurrency | RPS | P50 | P95 | P99 |
|-------------|-----|-----|-----|-----|
| 1 | ~50 | 20 ms | 30 ms | 50 ms |
| 10 | ~400 | 25 ms | 50 ms | 80 ms |
| 50 | ~1,500 | 35 ms | 80 ms | 150 ms |
| 100 | ~2,500 | 40 ms | 100 ms | 200 ms |

Rate limiting adds **< 500 ns** per request. Combined with auth, total feature overhead is < 2 us, invisible at the network level.

### Feature Impact Summary

| Feature Stack | Gateway Overhead | Notes |
|--------------|-----------------|-------|
| Proxy only | < 100 us | Route match + proxy setup |
| + API Key Auth | + < 1 us | Cache hit for key validation |
| + Rate Limiting | + < 500 ns | Sliding window check |
| + Path Normalization | + < 100 ns | Regex replacement |
| **Total pipeline** | **< 102 us** | All features combined |

> Gateway overhead is the time spent inside the Gateway, excluding upstream response time. Measured via Criterion micro-benchmarks.

## Comparative Results: Gateway Arena

STOA runs a continuous benchmark lab called **Gateway Arena** that compares multiple API gateways under identical conditions.

<!-- last verified: 2026-02 -->

> **Methodology**: Each gateway runs on an identical VPS instance (same provider, same region, same specs). All gateways proxy to the same backend. Tests run every 30 minutes via a Kubernetes CronJob. Scores range from 0 to 100.

### Arena Score Formula

```
Score = 0.40 x Latency + 0.30 x Availability + 0.20 x ErrorRate + 0.10 x Consistency
```

| Component | Calculation |
|-----------|------------|
| Latency (40%) | `100 x (1 - P95 / 1s)` |
| Availability (30%) | `100 x (successful / total)` |
| Error Rate (20%) | `100 x (1 - errors / total)` |
| Consistency (10%) | `100 x (1 - stddev / mean)` |

### Score Interpretation

| Score | Rating | Meaning |
|-------|--------|---------|
| 80-100 | Excellent | Low latency, high availability, consistent |
| 60-80 | Good | Acceptable for most workloads |
| 40-60 | Fair | May need investigation |
| < 40 | Poor | Connectivity or configuration issues |

### Three Test Scenarios

1. **Health Check**: Single request to the gateway health endpoint (availability + cold latency)
2. **Proxy Passthrough**: 10 sequential requests through the gateway to a backend (sustained throughput)
3. **Concurrent Burst**: 10 parallel requests to the gateway (burst handling + error rate)

### How to Run the Arena

```bash
# Trigger a one-off benchmark from a Kubernetes cluster
kubectl create job --from=cronjob/gateway-arena arena-manual -n stoa-system

# Watch logs
kubectl logs -n stoa-system -l job-name=arena-manual --follow
```

Results are pushed to Prometheus via Pushgateway and visualized in Grafana.

> Feature comparisons are based on tests run under identical conditions as of the date noted above. Gateway capabilities change frequently. We encourage readers to verify current performance with their own workloads. All trademarks belong to their respective owners.

## DX Benchmarks

Developer experience metrics for getting started with STOA.

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start (`docker compose up`) | < 120 s | All containers from scratch |
| Warm start (containers exist) | < 30 s | Restart existing containers |
| First API call after start | < 0.5 s | Health endpoint response |
| Gateway binary startup | < 1 s | Rust binary, no JVM warmup |

## Methodology & Reproducibility

### Tools

| Tool | Purpose | Source |
|------|---------|--------|
| [Criterion.rs](https://github.com/bheisler/criterion.rs) | Micro-benchmarks (internal operations) | `stoa-gateway/benches/` |
| [hey](https://github.com/rakyll/hey) | Load testing (end-to-end throughput) | `scripts/benchmarks/load-test.sh` |
| gateway-arena.py | Comparative benchmarking (multi-gateway) | `scripts/traffic/gateway-arena.py` |

### Reproducing Results

```bash
# Micro-benchmarks
cd stoa-gateway && cargo bench

# Load tests (requires a running Gateway)
./scripts/benchmarks/load-test.sh --target http://localhost:8080

# Comparative arena (requires Kubernetes + Pushgateway)
kubectl create job --from=cronjob/gateway-arena arena-manual -n stoa-system
```

### Reporting Standards

- All load tests run for **30 seconds** per concurrency level
- Results should be run **3 times** with the **median** reported
- Every report includes a **machine profile** (CPU, RAM, OS) for context
- Comparative claims include a `<!-- last verified: YYYY-MM -->` tag

See [Hardware Requirements](/docs/reference/hardware-requirements) for sizing guidance based on these benchmarks.
