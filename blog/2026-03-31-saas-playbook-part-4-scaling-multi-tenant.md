---
unlisted: true
slug: saas-playbook-4-scaling-multi-tenant
title: "SaaS Playbook Part 4: Scaling Multi-Tenant APIs from 50 to 5000 Tenants"
description: "Scale your multi-tenant SaaS API without rebuilding it. Covers HPA, connection pooling, caching strategies, tenant shard routing, and STOA scaling patterns."
authors: [stoa-team]
tags: [tutorial, architecture, api-gateway]
keywords:
  - scaling multi-tenant API
  - SaaS API scaling 5000 tenants
  - multi-tenant API performance
  - connection pooling SaaS
  - horizontal scaling API gateway
  - Kubernetes HPA API gateway
  - tenant sharding
---
<!-- last verified: 2026-02 -->

Scaling a multi-tenant SaaS API is not the same as scaling a single-tenant one. At 50 tenants, your API gateway does a small amount of per-tenant work on each request — resolving a policy, checking a rate limit, validating a token. At 5000 tenants, that same work multiplied across thousands of concurrent connections creates challenges that do not show up in early load tests.

This is Part 4 of the **SaaS Playbook** series. We assume you have already implemented the foundations: [multi-tenancy](/blog/saas-playbook-1-multi-tenancy-101), [rate limiting](/blog/saas-playbook-2-rate-limiting-saas), and [audit logging](/blog/saas-playbook-3-audit-compliance). Now you need to scale them.

<!-- truncate -->

## The Three Scaling Bottlenecks in Multi-Tenant APIs

Before optimizing anything, understand where the actual bottlenecks are. Multi-tenant API gateways typically hit three scaling walls.

### Wall 1: Policy Resolution Overhead

Every request requires the gateway to resolve the tenant's policies — which rate limits apply, which GuardrailPolicies are active, which upstream to route to. At small scale, this is a quick in-memory lookup. At large scale, with thousands of tenants and frequent policy updates, policy resolution can become a bottleneck if not cached properly.

**Symptoms**: Increasing P99 latency as tenant count grows, even when per-tenant RPS is constant.

### Wall 2: Database Connection Pool Exhaustion

Multi-tenant architectures often require per-request database lookups for audit logging, quota tracking, or tenant configuration. At scale, the number of concurrent database connections grows proportionally with tenant traffic, and connection pool exhaustion becomes a serious problem.

**Symptoms**: Intermittent 503 errors under load, database server showing max connections reached, requests timing out waiting for a connection.

### Wall 3: Noisy Neighbor at Infrastructure Scale

Even with per-tenant rate limiting, infrastructure-level contention is possible. A tenant running thousands of connections simultaneously may exhaust OS-level socket buffers, CPU scheduling time, or shared network bandwidth — none of which are controlled by application-level rate limits.

**Symptoms**: One tenant's traffic spike causes latency increases for other tenants, even when no rate limits are triggered.

## Caching Strategies for Multi-Tenant Gateways

The most impactful optimization: cache tenant configuration and policy resolution results aggressively.

### Tenant Configuration Cache

Tenant configuration (which APIs are registered, which policies apply, which upstream to use) rarely changes. Read it once, cache it in memory, invalidate only when the UAC is updated.

```yaml
# stoa-gateway configuration
gateway:
  cache:
    tenantConfig:
      strategy: in-memory
      ttl: 300s              # 5 minutes — balance freshness vs performance
      maxSize: 10000         # Support up to 10,000 cached tenant configs
      eviction: lru
      invalidateOnUAC: true  # Invalidate when UAC is updated via admin API
```

With a 5-minute TTL, policy updates propagate within 5 minutes of being applied. For most SaaS products, this is acceptable. For configuration that changes frequently (e.g., dynamic rate limit adjustments), use a shorter TTL or event-driven invalidation.

### Rate Limit Counter Cache

Rate limit counters need to be consistent across gateway replicas. Naive approaches (database row per counter) don't scale. The right architecture:

**For throughput limits (per-second, per-minute)**: In-memory counters per replica with periodic synchronization to the control plane. Accept that there may be slight overcounting (a tenant might briefly exceed their limit by a small margin across replicas) in exchange for microsecond-latency counter checks.

**For quota limits (daily, monthly)**: Centralized counters in the control plane database, checked per-request via a cache with 10-30 second TTL. Slight over-counting is acceptable; under-counting (letting a tenant exceed their monthly quota) is not.

```yaml
gateway:
  cache:
    rateLimits:
      throughput:
        strategy: in-memory-with-sync
        syncInterval: 5s     # Sync to control plane every 5 seconds
        overshootTolerance: 0.05  # Allow 5% overshoot per replica
      quota:
        strategy: cached-remote
        ttl: 30s             # Check control plane every 30 seconds
        refetchOnNearLimit: true   # Force-check when within 10% of limit
```

### JWT Validation Cache

JWT validation involves cryptographic signature verification — relatively expensive at scale. Cache validation results:

```yaml
gateway:
  auth:
    jwtCache:
      enabled: true
      ttl: 60s               # Cache valid tokens for 60 seconds
      negativeCache: true    # Cache invalid tokens too (prevents replay attacks on invalid tokens)
      maxSize: 100000        # Support 100K concurrent active tokens
```

The cache key is the token's `jti` (JWT ID) claim. Revoked tokens are handled via a revocation list that is checked even on cache hits — this prevents holding a cached valid token after it has been revoked.

## Horizontal Pod Autoscaling for the Gateway

The STOA Gateway is stateless at the request processing layer (state lives in the control plane database and caches). This makes it straightforward to scale horizontally.

### HPA Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: stoa-gateway-hpa
  namespace: stoa-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: stoa-gateway
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60    # Scale up at 60% CPU (avoid overshooting)
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30   # React quickly to traffic spikes
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # Scale down slowly to avoid thrash
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
```

The asymmetric scale-up/scale-down behavior is deliberate: scale up quickly (30-second window, 4 pods at a time) to handle traffic spikes, scale down slowly (300-second window, 1 pod at a time) to avoid flapping.

### Resource Requests and Limits

Proper resource requests are critical for HPA to work correctly and for Kubernetes scheduler to make good placement decisions:

```yaml
resources:
  requests:
    cpu: "500m"       # What the pod needs in steady state
    memory: "256Mi"
  limits:
    cpu: "2000m"      # What the pod can burst to
    memory: "512Mi"
```

If you set CPU limits too low, the gateway will be throttled even when headroom is available on the node. Set limits 2-4x the request value to allow burst handling without getting throttled.

## Connection Pool Management

### PgBouncer for Database Connections

The control plane API connects to PostgreSQL for audit logging, quota tracking, and tenant configuration. Without connection pooling, each gateway pod might open 10-20 database connections, and at 20 pods you have 200-400 connections — easily exhausting PostgreSQL's default `max_connections = 100`.

The solution: PgBouncer between the application and PostgreSQL, in transaction pooling mode.

```yaml
# pgbouncer.ini
[databases]
stoa_db = host=postgresql-primary port=5432 dbname=stoa

[pgbouncer]
pool_mode = transaction       # Transaction-level pooling (most aggressive)
max_client_conn = 1000        # Maximum client connections to PgBouncer
default_pool_size = 20        # Connections per database to PostgreSQL
max_db_connections = 50       # Hard cap on connections to PostgreSQL
```

With transaction pooling, a connection is only held for the duration of a single transaction. A connection pool of 50 connections to PostgreSQL can serve 1000 concurrent clients — each client holds a connection for microseconds (one transaction), then releases it.

**Important**: Transaction pooling is incompatible with session-level features like `SET` statements, advisory locks, or prepared statements with session lifetime. Audit log writes and quota counter updates are simple INSERTs — they work perfectly with transaction pooling.

### Connection Pool Sizing Calculator

```
Required pool size = (requests/second) × (avg DB latency in seconds)

Example:
- 10,000 req/sec
- Each request does 1 DB write (audit log): avg latency 2ms
- Required connections: 10,000 × 0.002 = 20 connections

Add 2x buffer for spikes: 40 connections
```

This is the theoretical minimum. In practice, add 50% overhead for connection establishment overhead, query planning, and GC pauses. Start with 60-80 connections for 10K req/sec and benchmark.

## Tenant Sharding for Large Deployments

At very large scale (10,000+ tenants, 100K+ req/sec), a single shared gateway cluster may become insufficient. Tenant sharding distributes tenants across dedicated gateway clusters.

### Shard Assignment Strategy

```
Tenant → Consistent hash → Shard ID → Gateway cluster
```

STOA uses consistent hashing with virtual nodes. This ensures:
- Tenant A always routes to shard 1 (low routing overhead)
- Adding a new shard migrates only 1/N of existing tenants (minimal disruption)
- Tenant traffic patterns remain predictable per shard

```yaml
gateway:
  sharding:
    enabled: true
    shards:
      - id: shard-eu-1
        region: eu-west-1
        tenants: "hash range 0-33"
      - id: shard-eu-2
        region: eu-west-1
        tenants: "hash range 34-66"
      - id: shard-us-1
        region: us-east-1
        tenants: "hash range 67-100"
    consistentHash:
      virtualNodes: 150
      hashFunction: xxhash64
```

### Data Residency via Sharding

Sharding also enables data residency enforcement: EU tenants can be pinned to EU shards, ensuring their audit logs and traffic never leave the EU. This is achieved via tenant metadata:

```bash
stoactl tenants create \
  --name eu-customer \
  --region eu \           # Forces assignment to EU shards
  --plan enterprise
```

## Caching Layer for High-Read APIs

For APIs with high read-to-write ratios (reference data, catalogs, user profiles), a caching layer between the gateway and the backend dramatically reduces backend load.

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: UniversalAPIContract
metadata:
  name: acme-contract
  namespace: tenant-acme
spec:
  apis:
    - name: catalog-api
      upstream: https://catalog.acme.internal/v1
      cache:
        enabled: true
        ttl: 300s            # Cache responses for 5 minutes
        varyBy:
          - header: "Accept-Language"
          - query: "category"
        invalidateOn:
          - method: POST     # Invalidate cache on writes
          - method: DELETE
          - method: PUT
          - method: PATCH
```

The gateway-level cache operates per-tenant (Tenant A's cached responses are separate from Tenant B's), per-endpoint, and per-vary-key. Cache invalidation is triggered by write operations or explicit cache-bust API calls.

## Load Testing at Scale

Never trust that your scaling architecture works without load testing it. The patterns that fail under load are rarely the ones you expect.

### Simulating Multi-Tenant Load

```javascript
// k6 load test: simulate 1000 tenants, 10 req/sec each
import http from 'k6/http';
import { check } from 'k6';

const TENANTS = Array.from({length: 1000}, (_, i) => `tenant-${i:04d}`);

export const options = {
  scenarios: {
    constant_vus: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },   // Ramp up to 500 VUs
        { duration: '5m', target: 500 },   // Hold
        { duration: '2m', target: 0 },     // Ramp down
      ],
    },
  },
};

export default function() {
  const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const token = getToken(tenant);  // Fetch token from cache

  const res = http.get(`${__ENV.GATEWAY_URL}/${tenant}/api/resource`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency < 100ms': (r) => r.timings.duration < 100,
  });
}
```

This test simulates realistic multi-tenant load: random tenant distribution, realistic token handling, and latency SLA assertions. Run it before and after any caching configuration change.

## What Comes Next

With scaling covered, you have the four fundamental pillars of a production-ready multi-tenant SaaS API. The final part of this series brings it all together in a production checklist you can use as a go-live gate.

**Complete SaaS Playbook:**
1. [Part 1: Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101) — Isolating your tenants
2. [Part 2: Rate Limiting Strategies](/blog/saas-playbook-2-rate-limiting-saas) — Per-tenant quotas and burst handling
3. [Part 3: Audit & Compliance](/blog/saas-playbook-3-audit-compliance) — Immutable logs and GDPR readiness
4. **Part 4: Scaling Multi-Tenant APIs** — This article
5. [Part 5: Production Checklist](/blog/saas-playbook-5-production-checklist) — 20-point go-live gate
6. [Build vs Buy: API Gateway Cost Analysis](/blog/saas-playbook-build-vs-buy-api-gateway) — TCO analysis for your decision

## FAQ

### At what tenant count should I start thinking about sharding?

Most multi-tenant SaaS APIs do not need sharding until they reach 5,000-10,000 active tenants with meaningful per-tenant traffic. Before that, horizontal scaling of the gateway cluster (via HPA) combined with good caching is sufficient. Focus on getting HPA and connection pooling right first — sharding adds significant operational complexity.

### How do I avoid the noisy neighbor problem at the infrastructure level?

STOA's per-tenant rate limiting handles application-level noisy neighbors. For infrastructure-level isolation (CPU, network), consider Kubernetes ResourceQuota per tenant namespace for high-value tenants, or dedicated node pools for enterprise tenants in the Silo model. Most SMB SaaS products never need this level of isolation.

### Should I use Redis for rate limit counters?

Redis is a common choice for distributed rate limit counters. STOA uses an in-memory-with-sync approach as the default because it is lower latency (no network hop per counter increment) and simpler to operate. If you need perfect consistency across replicas (zero overshoot), Redis with a Lua script provides atomic increment operations. Benchmark both approaches at your target scale before committing.

### How do I size my PgBouncer connection pool?

Use the formula: `pool size = (req/sec) × (avg DB latency)`. Add 50% overhead for bursts. Start conservative and increase based on observed `pgbouncer` metrics (`cl_waiting` should be near zero under normal load). If `cl_waiting` is non-zero, you need more connections in the pool.

### What Kubernetes node size should I use for gateway pods?

For the STOA Gateway (Rust-based), CPU is typically the bottleneck before memory. Start with `4 CPU / 8 GB RAM` nodes and measure. Each gateway pod can typically handle 10,000-50,000 req/sec depending on policy complexity and caching configuration. Size your nodes so HPA can go from `minReplicas` to `maxReplicas` without saturating the node's CPU.
