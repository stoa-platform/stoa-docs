---
slug: stoa-gateway-performance-benchmarks
title: "Sub-Millisecond Gateway: Reproducible Benchmarks"
authors: [stoa-team]
tags: [architecture, open-source, comparison]
description: "Sub-microsecond auth, nanosecond rate limiting, and a fully reproducible benchmark framework. All k6 scripts and scoring methodology published."
keywords:
  - api gateway benchmarks
  - gateway performance
  - api gateway latency
  - stoa gateway throughput
  - requests per second
  - api gateway comparison
  - open source api gateway performance
  - rust api gateway
---

<!-- last verified: 2026-02 -->

# STOA Gateway Performance: Sub-Millisecond Overhead, Fully Reproducible

STOA Gateway adds **less than 2 microseconds** of total overhead per request with API key auth and rate limiting enabled. Every benchmark is reproducible with published scripts, and our Gateway Arena runs comparative tests every 30 minutes on identical infrastructure.

This post shares our benchmarking approach, key results, and how you can reproduce everything yourself.

<!-- truncate -->

## Why We Benchmark (and Publish Everything)

Most API gateway vendors publish performance numbers, but few make their methodology reproducible. We believe in:

- **Transparency**: all scripts are open source, all methodology is documented
- **Reproducibility**: anyone can run the same benchmarks on their own hardware
- **Fair comparison**: when comparing gateways, we use identical infrastructure and conditions

Our benchmarks have three layers: **micro-benchmarks** for internal operations, **load tests** for end-to-end throughput, and the **Gateway Arena** for continuous multi-gateway comparison.

## Layer 1: Micro-Benchmarks (Criterion)

[Criterion.rs](https://github.com/bheisler/criterion.rs) benchmarks measure individual Gateway operations in isolation, without network overhead.

| Operation | Measured | What It Means |
|-----------|---------|--------------|
| API key cache hit | < 1 us | Looking up a valid API key is nearly instant |
| Rate limit check | < 500 ns | Checking quota uses a lock-free sliding window |
| Path normalization | < 100 ns | Replacing UUIDs in paths for analytics |
| Route matching (50 routes) | < 1 us | Finding the right upstream from 50+ registered APIs |
| JWT decode (HS256) | < 100 us | Full signature verification |

The key takeaway: **core Gateway operations are measured in nanoseconds and microseconds, not milliseconds**. When your API call takes 200 ms, the Gateway adds less than 0.001% of that latency.

### Why This Matters

Feature overhead compounds. If auth adds 5 ms and rate limiting adds 3 ms and path normalization adds 1 ms, you have 9 ms of gateway tax on every request. With STOA, that same stack adds < 2 us total, which is effectively zero.

## Layer 2: Load Tests (hey)

[hey](https://github.com/rakyll/hey) load tests measure real end-to-end throughput including network, TLS, and upstream response time.

Our benchmark script (`scripts/benchmarks/load-test.sh`) runs four scenarios at increasing concurrency:

1. **Health check** (baseline HTTP throughput)
2. **Proxy passthrough** (routing only, no auth)
3. **Proxy + API key auth** (routing + authentication)
4. **Proxy + auth + rate limiting** (full feature pipeline)

The script configures the Gateway via the Admin API between runs, so results reflect **real feature overhead**, not synthetic benchmarks with hardcoded responses.

### Feature Impact: Nearly Zero

The most important finding: **enabling features does not meaningfully change throughput or latency** at the network level. The difference between "proxy only" and "proxy + auth + rate limit" is within measurement noise because the combined overhead (< 2 us) is dwarfed by network latency.

| Feature Stack | Gateway Overhead |
|--------------|-----------------|
| Proxy only | < 100 us |
| + API Key Auth | + < 1 us |
| + Rate Limiting | + < 500 ns |
| **Total** | **< 102 us** |

This means you can enable all security and governance features without worrying about performance impact.

## Layer 3: Gateway Arena (Continuous Comparison)

The Gateway Arena is a Kubernetes CronJob that benchmarks multiple API gateways every 30 minutes under identical conditions.

### Setup

- Each gateway runs on an **identical VPS** (same provider, same region, same specs)
- All gateways proxy to the **same backend**
- Same test tool, same concurrency, same duration
- Results are pushed to Prometheus and visualized in Grafana

### Scoring

Each gateway gets a composite score from 0 to 100:

```
Score = 0.40 x Latency + 0.30 x Availability + 0.20 x ErrorRate + 0.10 x Consistency
```

A score above 80 is excellent. A score below 60 warrants investigation (usually a connectivity or configuration issue, not a gateway limitation).

### Three Scenarios

1. **Health Check**: single request to the health endpoint (cold latency + availability)
2. **Proxy Passthrough**: 10 sequential requests through the proxy (sustained throughput)
3. **Concurrent Burst**: 10 parallel requests (burst handling + error rate under load)

> Feature comparisons are based on tests run under identical conditions as of the date noted above. Gateway capabilities change frequently. We encourage readers to verify current performance with their own workloads. All trademarks belong to their respective owners.

## Try It Yourself

### Micro-Benchmarks

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa/stoa-gateway
cargo bench
```

Results appear in `target/criterion/` with HTML reports.

### Load Tests

```bash
# Install hey
brew install hey

# Start STOA Gateway (Docker Compose or standalone)
docker compose up -d

# Run benchmarks
./scripts/benchmarks/load-test.sh --target http://localhost:8080
```

The script outputs a Markdown report with machine profile, latency tables, and error rates. See the [full documentation](/docs/reference/performance-benchmarks) for methodology details.

## What We Learned

Building the benchmarking infrastructure taught us a few things:

1. **Network dominates**: with a remote backend, gateway overhead is invisible. Micro-benchmarks are essential to measure actual feature cost.
2. **Fair comparison is hard**: different gateways have different defaults, different warmup behaviors, and different failure modes. Identical infrastructure is necessary but not sufficient.
3. **Continuous beats one-shot**: a single benchmark run can be misleading. Running every 30 minutes catches regressions and shows variance.

## Further Reading

- [Hardware Requirements & Sizing Guide](/docs/reference/hardware-requirements) — how much CPU and RAM you actually need
- [Performance Benchmarks Reference](/docs/reference/performance-benchmarks) — full methodology, all scenarios, reproduction instructions
- [Gateway Architecture (ADR-024)](/docs/architecture/adr/adr-024-gateway-unified-modes) — why we chose Rust and the four gateway modes

## FAQ

### How many requests per second can STOA handle?

On a single core, STOA Gateway handles tens of thousands of health check requests per second. With proxy to an upstream backend, throughput is limited by the backend and network, not the Gateway. On a 2 vCPU VPS, expect 2,000-5,000 RPS to a remote backend.

### Does enabling auth slow down the Gateway?

No. API key authentication adds less than 1 microsecond per request thanks to an in-memory cache (moka). This is invisible at the network level. You can enable auth on every API without performance concerns.

### How does STOA compare to other gateways?

The Gateway Arena runs continuous comparisons on identical hardware. Rather than publishing point-in-time numbers that quickly become outdated, we provide the tools and methodology for anyone to run their own comparison. See the [benchmark scripts](https://github.com/stoa-platform/stoa/tree/main/scripts/benchmarks) and [Arena configuration](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic).
