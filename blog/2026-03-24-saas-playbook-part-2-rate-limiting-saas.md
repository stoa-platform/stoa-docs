---
unlisted: true
slug: saas-playbook-2-rate-limiting-saas
title: "SaaS Rate Limiting: Per-Tenant Strategies That Scale"
description: "Token bucket vs sliding window for multi-tenant APIs. Configure API key tiers, burst handling, and per-tenant quotas without custom code."
authors: [stoa-team]
tags: [tutorial, architecture, api-gateway]
keywords:
  - API rate limiting SaaS multi-tenant
  - per-tenant rate limiting
  - API key tiers SaaS
  - burst handling API gateway
  - rate limiting strategies 2026
  - SaaS API quota management
  - STOA rate limiting
---
<!-- last verified: 2026-02 -->

Rate limiting is the difference between a SaaS product that scales gracefully and one that falls over every time a customer runs a batch job. But standard rate limiting — one global bucket, one set of limits — does not work for multi-tenant SaaS. You need **per-tenant, per-tier, per-endpoint** rate limiting that can enforce different quotas for different customers without letting anyone degrade the experience for others.

This is Part 2 of the **SaaS Playbook** series. Part 1 covered [multi-tenancy fundamentals and tenant isolation models](/blog/saas-playbook-1-multi-tenancy-101). Here we go deep on rate limiting strategies.

<!-- truncate -->

## Why Standard Rate Limiting Fails for SaaS

Most tutorials on rate limiting cover the basics: pick an algorithm (token bucket, sliding window), pick a key (IP address or API key), set a threshold. Done.

That model collapses in multi-tenant SaaS for several reasons.

**The noisy-neighbor problem**: A single shared rate limit means one tenant's data export job consumes the headroom that should belong to another tenant's real-time dashboard. Customer support gets calls from the tenant whose dashboard is slow, even though their individual usage was perfectly normal.

**Plan differentiation**: Your free tier should get 100 requests per minute. Your professional tier should get 10,000. Your enterprise tier needs 100,000 with burst allowances for batch operations. A single global limit cannot encode these distinctions.

**Endpoint-level granularity**: Read endpoints and write endpoints have different cost profiles. Listing resources is cheap. Running a report that scans 10 million records is expensive. You need different limits for different endpoint categories, applied per-tenant.

**Burst vs sustained traffic**: Real production workloads are bursty. A developer testing a new integration might send 200 requests in 5 seconds, then nothing for an hour. Rejecting those 200 requests with a strict per-minute counter is hostile UX. A well-designed rate limiter allows short bursts while controlling sustained throughput.

**Graceful degradation vs hard 429**: Enterprise customers with high-value contracts expect a warning before a hard cutoff. They want a `X-RateLimit-Remaining` header so they can slow down proactively, not a sudden wall of 429 errors.

## Rate Limiting Algorithms

Understanding the algorithms helps you choose the right tool for each scenario.

### Token Bucket

The token bucket fills at a steady rate (e.g., 100 tokens/minute) up to a maximum capacity (e.g., 200 tokens). Each request consumes one token. When the bucket is empty, requests are rejected until it refills.

**Behavior**: Allows bursts up to the bucket capacity. Sustained throughput is limited to the fill rate.

**Best for**: APIs where short bursts are acceptable (interactive dashboards, CLI tools).

**Pitfall**: Two full buckets of requests can arrive within a single refill period. With a 100 req/min fill rate and 200-token capacity, a client can send 400 requests in the first two minutes if they stored up tokens.

### Sliding Window

Rather than a fixed one-minute window that resets on the clock, a sliding window counts requests in the past N seconds, measured from each request's timestamp.

**Behavior**: Smoother than fixed windows, no thundering-herd problem at window boundaries.

**Best for**: Production APIs where you want predictable sustained throughput limits.

**Pitfall**: More memory-intensive than token bucket — requires storing timestamps of recent requests rather than a simple counter.

### Fixed Window Counter

The simplest approach: a counter per time window (e.g., per minute, per hour). Resets at the start of each window.

**Behavior**: Predictable and easy to implement. Susceptible to thundering-herd at window boundaries (all clients reset simultaneously at :00).

**Best for**: Coarse-grained limits (hourly or daily quota enforcement), billing integrations.

**Avoid for**: High-frequency APIs — the thundering-herd effect at window boundaries creates latency spikes.

### Leaky Bucket

Requests enter a queue and drain at a fixed rate. If the queue is full, new requests are rejected.

**Behavior**: Perfectly smooth outbound traffic. No bursts.

**Best for**: Webhook delivery, outbound API calls to rate-limited external services.

**Avoid for**: Interactive APIs — the queuing introduces latency.

## STOA Rate Limiting Architecture

STOA implements per-tenant rate limiting at the gateway layer using `GuardrailPolicy` CRDs. Each tenant namespace has its own policy with its own limits — limits are isolated between tenants by design.

### Defining a Rate Limit Tier

Rate limit tiers are defined in `GuardrailPolicy` resources:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: GuardrailPolicy
metadata:
  name: professional-tier
  namespace: tenant-acme
spec:
  rateLimit:
    algorithm: token-bucket
    requestsPerMinute: 10000
    burstMultiplier: 2.0        # Allow bursts up to 20,000 req/min
    perEndpoint:
      "/reports/*":
        requestsPerMinute: 100  # Expensive endpoints have stricter limits
      "/export/*":
        requestsPerMinute: 10
    headers:
      exposeRemaining: true     # Send X-RateLimit-Remaining in response
      exposeReset: true         # Send X-RateLimit-Reset in response
```

This policy applies to all requests in the `tenant-acme` namespace. Tenant B's namespace has its own `GuardrailPolicy` — their limits are entirely independent.

### API Key Tiers

STOA's UAC supports plan-based tier assignment. When you create a tenant with `--plan professional`, the gateway automatically resolves the `professional-tier` GuardrailPolicy for that tenant.

```yaml
# plan-tiers.yaml — global configuration
apiVersion: gostoa.dev/v1alpha1
kind: PlanTier
metadata:
  name: starter
spec:
  rateLimits:
    requestsPerMinute: 1000
    burstMultiplier: 1.5

---
apiVersion: gostoa.dev/v1alpha1
kind: PlanTier
metadata:
  name: professional
spec:
  rateLimits:
    requestsPerMinute: 10000
    burstMultiplier: 2.0

---
apiVersion: gostoa.dev/v1alpha1
kind: PlanTier
metadata:
  name: enterprise
spec:
  rateLimits:
    requestsPerMinute: 100000
    burstMultiplier: 3.0
    perEndpointOverrides: allowed   # Enterprise can configure custom per-endpoint limits
```

When a tenant upgrades from starter to professional, stoactl updates the tenant's namespace with the new GuardrailPolicy. The gateway picks up the change without restart.

```bash
stoactl tenants upgrade --name acme --plan professional
# → Updates GuardrailPolicy in tenant-acme namespace
# → New limits apply within 30 seconds (hot reload)
```

### Handling Burst Traffic Gracefully

Hard 429 rejections are hostile. For SaaS products, a better pattern is:

1. **Warn before throttle**: Send `X-RateLimit-Remaining: 10` headers so clients can slow down
2. **Soft limit → Hard limit**: At 80% utilization, return responses with a `Retry-After` hint. At 100%, return 429.
3. **Priority queuing**: Prioritize read requests over write requests when quota is scarce

STOA's token bucket implementation includes a `warnThreshold` setting:

```yaml
spec:
  rateLimit:
    requestsPerMinute: 10000
    warnThreshold: 0.8          # Send warning headers at 80% utilization
    softLimitAction: warn       # Log + header, don't reject at soft limit
    hardLimitAction: reject     # 429 at hard limit
```

### Per-Endpoint Limits for Expensive Operations

Not all endpoints are equal. A `GET /users/{id}` is cheap — a database lookup, maybe a cache hit. A `POST /reports/export` might scan millions of records, join several tables, and stream a CSV. They should not share the same rate limit.

```yaml
spec:
  rateLimit:
    requestsPerMinute: 10000    # Default for all endpoints
    perEndpoint:
      "GET /users/*":
        requestsPerMinute: 10000  # Same as default, explicitly set
      "POST /reports/*":
        requestsPerMinute: 50     # Expensive — strict limit
      "GET /export/*":
        requestsPerMinute: 10     # Very expensive — very strict
      "POST /webhook/test":
        requestsPerMinute: 5      # Prevent webhook spam
```

The gateway resolves the most specific matching rule for each request.

## Enforcing Daily and Monthly Quotas

Rate limits control throughput per second/minute. Quota limits control consumption over longer windows — daily, monthly. These are billing primitives.

```yaml
spec:
  quota:
    daily:
      requests: 500000
      action: reject              # Hard stop at daily quota
    monthly:
      requests: 10000000
      action: notify              # Notify tenant admin, don't reject (yet)
      notifyAt: [0.75, 0.90]      # Notify at 75% and 90% utilization
```

Quota counters persist across gateway restarts (stored in the STOA control plane database). Rate limit buckets are in-memory — they reset on restart, which is correct behavior for throughput control.

## Implementing API Key Tiers in Your Application

For SaaS products that sell API access directly (developer tools, data APIs), API key tiers are often more intuitive than tenant plan tiers.

### Issuing Tier-Tagged API Keys

```bash
# Issue a professional-tier API key for a user within tenant-acme
stoactl apikeys create \
  --tenant acme \
  --user user-123 \
  --tier professional \
  --name "Production Integration Key" \
  --expires 2027-01-01
```

The issued key carries tier metadata in its opaque token. When the gateway validates the key, it resolves the corresponding rate limit policy.

### Scoping API Keys to Specific Endpoints

Enterprise use cases often require API keys scoped to specific APIs:

```bash
stoactl apikeys create \
  --tenant acme \
  --tier enterprise \
  --scope "billing-api:read orders-api:read,write" \
  --name "Billing Read-Only Key"
```

A key with `billing-api:read` scope cannot call `billing-api:write` endpoints. The gateway enforces scope at the routing layer before rate limits even apply.

## Observability: Monitoring Rate Limit Health

Rate limiting is only useful if you can see it working. STOA exposes Prometheus metrics for rate limit telemetry:

```
# Per-tenant rate limit metrics
stoa_rate_limit_requests_total{tenant="acme", endpoint="/users", result="allowed"} 45231
stoa_rate_limit_requests_total{tenant="acme", endpoint="/reports", result="throttled"} 143
stoa_rate_limit_bucket_fill_ratio{tenant="acme"} 0.73
stoa_rate_limit_quota_remaining{tenant="acme", window="daily"} 423451
```

A Grafana dashboard with per-tenant rate limit visualizations ships with STOA's observability stack. Add alerts for:
- `stoa_rate_limit_requests_total{result="throttled"}` > 1% of total requests (indicates a misconfigured client)
- `stoa_rate_limit_quota_remaining` < 10% remaining (proactive customer success alert)
- Sudden spikes in any tenant's throttle rate (potential abuse or bug)

## Common Patterns and Gotchas

### Pattern: Generous Defaults, Strict Exceptions

Start with permissive default limits that almost no legitimate client will hit. Add strict limits only for proven-expensive endpoints. You can always tighten limits — loosening them after customers have built against the strict limits is much harder.

### Pattern: Retry-After Header Is Mandatory

Every 429 response MUST include a `Retry-After` header indicating when the limit resets. Without it, clients will retry immediately and make the throttling worse. STOA sends this header automatically when a request is rejected.

### Gotcha: Clock Skew in Distributed Systems

Rate limiting state must be consistent across gateway replicas. STOA uses a centralized counter store (backed by the control plane API) for quota enforcement, ensuring consistency across horizontal replicas. Token bucket state is replicated via the control plane's state synchronization protocol.

### Gotcha: Test Your Rate Limits Before Launch

Every SaaS team discovers their rate limits are wrong in production. Before launch, run load tests that simulate your heaviest expected tenants. Use STOA's load simulation tooling or k6 with per-tenant scripts.

```bash
# Simulate professional-tier tenant load
k6 run --env TENANT=acme --env TARGET_RPS=10000 scripts/load-test.js
```

## What Comes Next

With multi-tenancy and rate limiting in place, your SaaS API has two of its three fundamental safety mechanisms. The third is **audit logging and compliance**. Part 3 covers how to build immutable audit trails, satisfy GDPR requests, and prepare for compliance audits without rebuilding your logging infrastructure.

**Complete SaaS Playbook:**
1. [Part 1: Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101) — Isolating your tenants
2. **Part 2: Rate Limiting Strategies** — This article
3. [Part 3: Audit & Compliance](/blog/saas-playbook-3-audit-compliance) — Immutable logs and GDPR readiness
4. [Part 4: Scaling Multi-Tenant APIs](/blog/saas-playbook-4-scaling-multi-tenant) — From 50 to 5000 tenants
5. [Part 5: Production Checklist](/blog/saas-playbook-5-production-checklist) — 20-point go-live gate
6. [Build vs Buy: API Gateway Cost Analysis](/blog/saas-playbook-build-vs-buy-api-gateway) — TCO analysis for your decision

For comparison of how different API gateways handle rate limiting for SMB use cases, see our [SMB API Gateway Buying Guide](/blog/smb-api-gateway-buying-guide-2026).

## FAQ

### What rate limiting algorithm should I use for a SaaS REST API?

**Token bucket** is the best default for interactive SaaS APIs — it allows short bursts while controlling sustained throughput. Use **sliding window** when you need precise sustained-rate enforcement without burst allowance. Use **fixed window** for coarse billing quotas (daily/monthly) where exact timing at window boundaries does not matter.

### How do I handle tenants on different plans with different limits?

Define plan-tier GuardrailPolicy templates and assign tenants to a plan tier at creation time. When a tenant upgrades, run `stoactl tenants upgrade --plan` to apply the new policy. STOA applies the change within 30 seconds via hot reload — no restart required.

### What should I return when a request is rate-limited?

Always return HTTP 429 with these headers: `Retry-After: <seconds>`, `X-RateLimit-Limit: <max>`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset: <unix-timestamp>`. Include a JSON body with an error code and human-readable message. Never return 429 without `Retry-After` — clients will spin immediately and worsen the throttling.

### How do I prevent one tenant's burst from affecting other tenants?

Use per-tenant rate limit buckets — never a shared global bucket. STOA's GuardrailPolicy is namespace-scoped, so each tenant has their own independent bucket. Tenant A exhausting their quota does not affect Tenant B's bucket in any way.

### Can I give enterprise customers custom rate limits?

Yes. STOA's enterprise plan tier includes `perEndpointOverrides: allowed`, which lets the tenant admin configure custom per-endpoint limits within their namespace. The global plan limit still acts as a ceiling — they cannot exceed what their contract permits.


---

## Ready to bridge your legacy APIs to AI agents?

STOA is open-source (Apache 2.0) and free to try.

- **[Quick Start Guide →](/docs/guides/quickstart)** — Get STOA running locally in 5 minutes
- **[GitHub →](https://github.com/stoa-platform/stoa)** — Star us, fork us, contribute
- **[Discord →](https://discord.gostoa.dev)** — Join the community
