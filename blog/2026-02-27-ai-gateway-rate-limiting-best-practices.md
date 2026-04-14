---
slug: ai-gateway-rate-limiting-best-practices
title: "AI Gateway Rate Limiting: Token-Aware Quota Strategies"
description: "Traditional rate limiting breaks with LLM tokens. Per-tenant quotas, token-aware counting, and streaming support for AI/MCP gateways."
authors: [stoa-team]
tags: [tutorial, ai, mcp, api-gateway]
keywords:
  - AI gateway rate limiting
  - token-based rate limiting
  - MCP quota management
  - API rate limiting strategies
  - per-tenant quotas
  - streaming API limits
  - AI API management
---
<!-- last verified: 2026-02 -->

AI gateways require specialized rate limiting approaches that account for token consumption, streaming responses, and variable request costs. Traditional request-per-second limits fail to capture the true resource usage of AI workloads. This guide covers token-aware rate limiting strategies, per-tenant quota management, and implementation patterns for production AI gateways.

<!-- truncate -->

## Why AI Gateways Need Different Rate Limiting

Traditional API gateways typically implement rate limiting based on requests per second or requests per minute. A simple counter tracks how many requests a client has made, and once the threshold is reached, subsequent requests receive `429 Too Many Requests` responses. This works well for REST APIs where each request consumes roughly equivalent resources.

AI and MCP (Model Context Protocol) gateways face a fundamentally different challenge. Consider these scenarios:

**Scenario 1: Two identical request counts, vastly different costs**
- Client A sends 100 requests, each processing 50 tokens (5,000 total tokens)
- Client B sends 100 requests, each processing 5,000 tokens (500,000 total tokens)

Under traditional rate limiting, both clients appear equivalent. But Client B consumed 100x more compute resources, cost 100x more in LLM API charges, and likely degraded service quality for other users.

**Scenario 2: Streaming responses**
An AI agent initiates a single SSE (Server-Sent Events) stream that processes 50,000 tokens over 45 seconds. Traditional rate limiting sees "1 request" while the gateway handles sustained token generation equivalent to hundreds of normal requests.

**Scenario 3: Variable request complexity**
- Simple tool invocation: 200 tokens (0.2 seconds)
- Document analysis: 8,000 tokens (12 seconds)
- Multi-turn conversation: 15,000 tokens (22 seconds)

The resource consumption variance in AI workloads requires rethinking rate limiting from first principles. As discussed in the [MCP Gateway Guide](/blog/what-is-mcp-gateway), gateways must balance agent capabilities with backend capacity.

## Token-Based vs Request-Based Limits

### Request-Based Limits (Traditional)

Request-based rate limiting counts discrete API calls regardless of their payload or processing requirements:

```yaml
# Traditional approach - counts requests only
rate_limit:
  requests_per_minute: 60
  requests_per_hour: 1000
```

**Pros:**
- Simple to implement and reason about
- Fast (O(1) counter operations)
- Works well for uniform workloads

**Cons:**
- Ignores actual resource consumption
- Allows abuse through large requests
- Poor fairness in multi-tenant environments
- No alignment with LLM provider billing

### Token-Based Limits (AI-Aware)

Token-based rate limiting accounts for the actual computational work performed by tracking input and output tokens:

```yaml
# AI-aware approach - tracks token consumption
quota:
  tokens_per_minute: 100000
  tokens_per_day: 5000000
  max_tokens_per_request: 32000
  count_input_tokens: true
  count_output_tokens: true
```

**Pros:**
- Reflects true resource consumption
- Aligns with LLM provider billing
- Fair across different request types
- Prevents abuse through token-heavy requests

**Cons:**
- Requires token counting infrastructure
- Slightly higher overhead
- May need estimation for streaming requests

### Hybrid Approach (Recommended)

Production AI gateways should implement both layers:

```yaml
quota_policy:
  # Coarse-grained flood protection
  max_requests_per_second: 10

  # Fine-grained resource management
  tokens_per_minute: 100000
  tokens_per_hour: 2000000
  tokens_per_day: 10000000

  # Individual request protection
  max_tokens_per_request: 32000
  max_request_duration_seconds: 60
```

This prevents both request floods (DDoS protection) and token abuse (cost control).

## Rate Limiting Strategies

### Fixed Window

The simplest algorithm: allow N operations per fixed time window (e.g., per minute).

```yaml
rate_limit:
  algorithm: fixed_window
  window_size: 60s
  max_requests: 1000
```

**How it works:**
1. Window starts at minute boundary (e.g., 10:00:00)
2. Counter increments for each request
3. At 10:01:00, counter resets to zero

**Burst problem:**
- User sends 1,000 requests at 10:00:59
- User sends 1,000 requests at 10:01:00
- Result: 2,000 requests in 2 seconds, despite "1,000/minute" limit

**When to use:** Internal services, non-critical APIs, simple quotas.

### Sliding Window

Tracks requests over a rolling time window, preventing the burst issue.

```yaml
rate_limit:
  algorithm: sliding_window
  window_size: 60s
  max_requests: 1000
```

**How it works:**
1. Current time: 10:00:45
2. Count requests from 09:59:45 to 10:00:45
3. Window slides with each new request

**Implementation:**
- **Sliding window log:** Store timestamp of each request, count requests in window (accurate but memory-intensive)
- **Sliding window counter:** Approximate using two fixed windows with weighted interpolation (efficient but slight inaccuracy)

**When to use:** Production APIs, user-facing services, fair resource allocation.

### Token Bucket

A bucket holds tokens; each request consumes tokens; tokens refill at a constant rate.

```yaml
rate_limit:
  algorithm: token_bucket
  bucket_capacity: 1000
  refill_rate: 100  # tokens per second
  tokens_per_request: 1  # or dynamic based on actual token count
```

**How it works:**
1. Bucket starts with 1,000 tokens
2. Request arrives, consumes tokens (e.g., 50 tokens for a 50-token prompt)
3. Bucket refills at 100 tokens/second
4. If bucket empty, request denied with `429`

**Burst handling:** Allows bursts up to bucket capacity, then smooths to refill rate.

**When to use:** AI workloads, variable request sizes, need to support occasional bursts.

### Leaky Bucket

Requests enter a queue (bucket); the queue processes at a fixed rate (leak).

```yaml
rate_limit:
  algorithm: leaky_bucket
  bucket_capacity: 100  # max queue size
  leak_rate: 10  # requests per second
```

**How it works:**
1. Incoming requests enter queue
2. Queue processes at 10 requests/second
3. If queue full, new requests rejected

**Characteristics:**
- Smooths traffic to constant output rate
- No bursts allowed (unlike token bucket)
- Natural backpressure mechanism

**When to use:** Protecting downstream services with strict capacity limits, traffic shaping for compliance requirements.

## Per-Tenant Quota Management

In multi-tenant AI gateways, fair resource allocation is critical. A single noisy tenant can degrade service for all users. The [multi-tenant Kubernetes guide](/blog/multi-tenant-api-gateway-kubernetes) covers infrastructure isolation; here we focus on application-level quota enforcement.

### Quota Hierarchy

```yaml
quotas:
  # Default quota for all tenants
  default:
    tokens_per_minute: 10000
    tokens_per_day: 500000
    max_concurrent_requests: 5

  # Tier-based overrides
  tier_overrides:
    free:
      tokens_per_minute: 5000
      tokens_per_day: 100000
      max_concurrent_requests: 2

    pro:
      tokens_per_minute: 50000
      tokens_per_day: 2000000
      max_concurrent_requests: 20

    enterprise:
      tokens_per_minute: 200000
      tokens_per_day: 10000000
      max_concurrent_requests: 100

  # Tenant-specific overrides (highest priority)
  tenant_overrides:
    tenant-acme-corp:
      tokens_per_minute: 500000
      tokens_per_day: 50000000
      max_concurrent_requests: 200
```

Resolution order: tenant-specific → tier → default.

### Implementing Tenant Quotas

When a request arrives, the gateway must:

1. **Identify the tenant** (via API key, OAuth token, or mTLS certificate)
2. **Resolve quota policy** (tenant → tier → default)
3. **Check current usage** (query distributed counter)
4. **Allow or deny** (update counter if allowed)
5. **Return usage headers** (inform client of quota status)

Example HTTP response headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100000
X-RateLimit-Remaining: 87340
X-RateLimit-Reset: 1614556800
X-Quota-Tokens-Used-Minute: 12660
X-Quota-Tokens-Used-Day: 456000
X-Quota-Tokens-Limit-Day: 2000000
```

When quota exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 100000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1614556842
Content-Type: application/json

{
  "error": "quota_exceeded",
  "message": "Daily token quota of 2,000,000 exceeded",
  "retry_after_seconds": 42,
  "quota_reset_at": "2026-02-27T10:15:00Z"
}
```

### Quota Storage

Distributed quota tracking requires shared state:

**Option 1: Redis (recommended for most cases)**
```yaml
quota_backend:
  type: redis
  redis_url: redis://redis-cluster:6379
  key_prefix: quota:
  ttl: 86400  # 24 hours for daily quotas
```

Use Redis `INCR` for atomic counter updates and `EXPIRE` for automatic window resets.

**Option 2: In-memory (single-instance only)**
```yaml
quota_backend:
  type: memory
  sync_interval: 5s  # not truly distributed
```

Only for development or single-replica deployments.

**Option 3: Database (high latency, not recommended)**
Query latency makes databases unsuitable for rate limiting hot paths.

## Implementing with STOA

STOA Platform provides built-in quota management for MCP gateways. Here's how to configure it.

### Step 1: Define Quota Policies

Create a quota policy resource:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: QuotaPolicy
metadata:
  name: default-ai-quota
  namespace: tenant-acme
spec:
  # Token-based limits (recommended for AI)
  tokens:
    perMinute: 100000
    perHour: 2000000
    perDay: 10000000
    maxPerRequest: 32000

  # Request-based limits (flood protection)
  requests:
    perSecond: 10
    perMinute: 600

  # Concurrency limits
  maxConcurrentRequests: 20
  maxConcurrentStreams: 5

  # Timeout protection
  maxRequestDurationSeconds: 120

  # Cost tracking (for chargeback)
  trackCosts: true
  costPerMillionTokens: 15.00
```

### Step 2: Apply to Tools

Reference the quota policy in your Tool resources:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: document-analyzer
  namespace: tenant-acme
spec:
  displayName: Document Analyzer
  endpoint: https://api.backend.local/analyze
  method: POST
  quotaPolicyRef:
    name: default-ai-quota
```

Multiple tools can share the same quota policy for aggregated limits.

### Step 3: Monitor Usage

Query the STOA API for current usage:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.gostoa.dev/v1/quotas/tenant-acme/usage
```

Response:

```json
{
  "tenant_id": "tenant-acme",
  "period": "current",
  "usage": {
    "tokens": {
      "current_minute": 12340,
      "limit_minute": 100000,
      "current_hour": 456000,
      "limit_hour": 2000000,
      "current_day": 3200000,
      "limit_day": 10000000
    },
    "requests": {
      "current_second": 2,
      "limit_second": 10,
      "current_minute": 87,
      "limit_minute": 600
    },
    "concurrent": {
      "active_requests": 4,
      "max_requests": 20,
      "active_streams": 1,
      "max_streams": 5
    }
  },
  "estimated_cost_usd": 48.00
}
```

### Step 4: Handle Quota Errors

MCP clients should gracefully handle `429` responses:

```typescript
async function callTool(toolName: string, input: object) {
  const response = await fetch(`https://mcp.gostoa.dev/mcp/tools/${toolName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    console.warn(`Quota exceeded, retrying after ${retryAfter}s`);
    await sleep(retryAfter * 1000);
    return callTool(toolName, input);  // Retry
  }

  return response.json();
}
```

Implement exponential backoff for production resilience. See the [API security checklist](/blog/api-security-checklist-solo-dev) for additional error handling patterns.

## Token Counting Strategies

Accurate token counting is critical for effective quota management. Here are the main approaches:

### Pre-Request Estimation

Estimate tokens before sending to the LLM backend:

```typescript
import { encode } from 'gpt-tokenizer';

function estimateTokens(prompt: string, model: string = 'gpt-4'): number {
  const encoded = encode(prompt);
  return encoded.length;
}

const prompt = "Analyze this document...";
const estimatedTokens = estimateTokens(prompt);

if (estimatedTokens > MAX_TOKENS_PER_REQUEST) {
  throw new Error('Request exceeds token limit');
}
```

**Pros:** Fast, prevents over-quota requests
**Cons:** Approximation only (actual backend may use different tokenizer)

### Post-Request Actual Count

Extract actual token usage from LLM response:

```json
{
  "response": "...",
  "usage": {
    "prompt_tokens": 1240,
    "completion_tokens": 856,
    "total_tokens": 2096
  }
}
```

Update quota counters with actual values:

```typescript
const actualTokens = responseData.usage.total_tokens;
await updateQuota(tenantId, actualTokens);
```

**Pros:** Accurate, aligns with billing
**Cons:** Reactive (quota already consumed)

### Streaming Token Counting

For SSE/streaming responses, count incrementally:

```typescript
let tokenCount = 0;

stream.on('data', (chunk) => {
  const chunkTokens = estimateTokens(chunk.content);
  tokenCount += chunkTokens;

  // Check quota mid-stream
  if (tokenCount > remainingQuota) {
    stream.close();
    throw new QuotaExceededError();
  }
});

stream.on('end', () => {
  updateQuota(tenantId, tokenCount);
});
```

STOA automatically handles streaming token counts when you enable quota tracking.

## Monitoring Usage Patterns

Effective quota management requires observability. Track these metrics:

### Per-Tenant Metrics

```yaml
# Prometheus metrics (example)
quota_tokens_used_total{tenant="acme", window="minute"} 12340
quota_tokens_limit{tenant="acme", window="minute"} 100000
quota_requests_rejected_total{tenant="acme", reason="daily_limit"} 7
quota_cost_usd{tenant="acme", window="day"} 48.00
```

### Alerting Rules

```yaml
# Alert if tenant consistently hitting limits
alert: TenantQuotaPressure
expr: |
  (quota_tokens_used_total / quota_tokens_limit) > 0.9
for: 10m
annotations:
  summary: "Tenant {{ $labels.tenant }} using >90% of quota"
```

### Cost Tracking

Generate tenant chargeback reports:

```sql
SELECT
  tenant_id,
  SUM(tokens_used) as total_tokens,
  SUM(tokens_used) / 1000000.0 * cost_per_million as estimated_cost_usd
FROM quota_usage
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id
ORDER BY total_tokens DESC;
```

For production monitoring dashboards, see the STOA [configuration reference](/docs/reference/configuration).

## Advanced Patterns

### Dynamic Quota Adjustment

Automatically adjust quotas based on usage patterns:

```yaml
quota_policy:
  auto_scale:
    enabled: true
    scale_up_threshold: 0.8  # Increase quota when 80% used
    scale_down_threshold: 0.3  # Decrease when <30% used
    min_quota: 50000
    max_quota: 500000
    scale_factor: 1.5
```

### Priority-Based Queuing

Not all requests are equal. Assign priorities:

```yaml
quota_policy:
  priority_classes:
    - name: critical
      weight: 1.0  # Always processed first
      max_queue_time: 5s

    - name: normal
      weight: 0.5
      max_queue_time: 30s

    - name: batch
      weight: 0.1
      max_queue_time: 300s
```

When quota exceeded, queue requests by priority rather than rejecting immediately.

### Quota Borrowing

Allow tenants to temporarily exceed quota with payback:

```yaml
quota_policy:
  borrowing:
    enabled: true
    max_borrow_percentage: 20  # Can use 120% of quota
    payback_period: 3600  # Must stay under quota for 1 hour to clear debt
```

Useful for handling unexpected spikes without hard failures.

## Common Pitfalls

### Pitfall 1: Ignoring Streaming Overhead

**Problem:** Streaming requests appear as "1 request" but consume resources for minutes.

**Solution:** Track stream duration and token throughput:

```yaml
quota_policy:
  streaming:
    max_duration_seconds: 120
    tokens_per_second_limit: 500
    count_as_equivalent_requests: 10  # 1 stream = 10 requests for quota
```

### Pitfall 2: No Backpressure

**Problem:** Accepting all requests into a queue leads to memory exhaustion.

**Solution:** Implement bounded queues with rejection:

```yaml
quota_policy:
  queue:
    max_size: 100
    overflow_strategy: reject  # or 'drop_oldest'
```

### Pitfall 3: Insufficient Granularity

**Problem:** Daily quotas allow abuse (consume entire quota in first hour).

**Solution:** Implement multiple time windows:

```yaml
quota_policy:
  tokens_per_minute: 10000   # Smooth out bursts
  tokens_per_hour: 200000    # Prevent hourly abuse
  tokens_per_day: 2000000    # Daily budget
```

All three limits must be satisfied.

### Pitfall 4: No Cost Visibility

**Problem:** Tenants don't know they're approaching limits until requests fail.

**Solution:** Proactive notifications:

```yaml
quota_policy:
  notifications:
    warning_threshold: 0.8  # Warn at 80%
    webhook_url: https://tenant.local/quota-warning
```

### Pitfall 5: Clock Skew

**Problem:** Distributed systems with unsynchronized clocks produce inconsistent quota enforcement.

**Solution:** Use UTC timestamps and tolerate small skew:

```yaml
quota_backend:
  clock_skew_tolerance: 5s
  prefer_server_time: true
```

## FAQ

### How do I handle quota for free vs paid tiers?

Use tier-based quota policies with inheritance:

```yaml
quotas:
  default:
    tokens_per_day: 100000  # Base free tier

  tier_overrides:
    pro:
      tokens_per_day: 2000000  # 20x increase
      inherits: default

    enterprise:
      tokens_per_day: 50000000  # 500x increase
      inherits: default
```

Assign tenants to tiers via metadata. When a tenant upgrades, their quota automatically increases without configuration changes. For multi-tenant architecture details, see the [multi-tenant concepts documentation](/docs/concepts/multi-tenant).

### What's the best rate limiting algorithm for AI workloads?

**Token bucket** is generally recommended for AI/MCP gateways because:

1. Handles variable request sizes naturally (small prompt = few tokens, large prompt = many tokens)
2. Allows controlled bursts (critical for streaming initiation)
3. Smooths to sustainable rate (protects backend capacity)
4. Aligns with LLM provider billing (token-based)

Use **sliding window** for hard request-per-second limits (DDoS protection layer). Combine both:

```yaml
quota_policy:
  # Flood protection (sliding window)
  requests_per_second: 20

  # Resource management (token bucket)
  algorithm: token_bucket
  token_capacity: 100000
  token_refill_rate: 1000  # per second
```

For detailed performance implications, see the [gateway performance benchmarks](/blog/stoa-gateway-performance-benchmarks).

### How do I prevent one tenant from monopolizing resources?

Implement **fair queuing** and **concurrency limits**:

```yaml
quota_policy:
  # Limit concurrent requests per tenant
  max_concurrent_requests: 10
  max_concurrent_streams: 3

  # Fair scheduling when quota exceeded
  scheduling:
    algorithm: weighted_fair_queuing
    tenant_weight: 1.0  # Equal weight for all tenants

  # Hard timeout to prevent resource hoarding
  max_request_duration: 120s

  # Circuit breaker for abusive tenants
  circuit_breaker:
    failure_threshold: 10
    timeout: 300s
```

When tenant A exhausts quota, their requests queue. Tenant B's requests continue processing immediately (isolation). If tenant A repeatedly abuses quotas, the circuit breaker temporarily blocks them.

Additionally, consider **graceful degradation**: when system load is high, reduce quotas proportionally for all tenants rather than hard failures. See the [quota reference documentation](/docs/reference/quotas) for advanced configuration options.

## Next Steps

This guide covered the fundamentals of rate limiting and quota management for AI gateways. Key takeaways:

1. **Token-aware limits** reflect true resource consumption more accurately than request counts
2. **Hybrid approach** (request + token limits) provides both flood protection and fair resource allocation
3. **Per-tenant quotas** with tiering enable flexible multi-tenant architectures
4. **Monitoring and alerting** prevent surprise quota exhaustion

To continue learning:

- Read the [MCP Gateway Guide](/blog/what-is-mcp-gateway) for architectural context
- Explore [connecting AI agents to enterprise APIs](/blog/connecting-ai-agents-enterprise-apis) for end-to-end patterns
- Review the [API Gateway Glossary](/blog/api-gateway-glossary-2026) for terminology reference
- Check the [STOA quota reference](/docs/reference/quotas) for complete configuration options

Ready to implement production-grade AI gateway quotas? [Try STOA Platform](https://console.gostoa.dev/signup) with built-in token-aware rate limiting and multi-tenant quota management.


---

## Ready to bridge your existing APIs to AI agents?

STOA is open-source (Apache 2.0) and free to try.

- **[Quick Start Guide →](/docs/guides/quickstart)** — Get STOA running locally in 5 minutes
- **[GitHub →](https://github.com/stoa-platform/stoa)** — Star us, fork us, contribute
- **[Discord →](https://discord.gostoa.dev)** — Join the community
