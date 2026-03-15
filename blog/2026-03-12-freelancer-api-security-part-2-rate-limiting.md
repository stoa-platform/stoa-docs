---
slug: freelancer-api-security-part-2-rate-limiting
title: "Rate Limiting That Works (Freelancer Security Part 2)"
description: "Sliding windows, burst allowances, per-endpoint limits, and tiered plans. How to tune rate limits without breaking your legitimate users."
authors: [stoa-team]
tags: [security, tutorial, api-gateway]
keywords:
  - api rate limiting strategies
  - sliding window rate limiting
  - rate limit per endpoint
  - api rate limit tuning
  - burst allowance api
  - rate limiting freelancer api
  - api gateway rate limit configuration
---
<!-- last verified: 2026-02 -->

You set up rate limiting: 100 requests per minute. Done, right?

Not quite. A fixed limit of 100 req/min breaks legitimate users during burst activity, lets bots abuse you with slow trickle attacks, and doesn't differentiate between your free users and your paying customers.

This is Part 2 of the series. We'll go deep on rate limiting — the strategies that work in practice.

<!-- truncate -->

*This is Part 2 of the Freelancer API Security Series. [Part 1: Your APIs Are More Vulnerable Than You Think](/blog/freelancer-api-security-part-1-vulnerabilities) | [Part 3: Audit Trails for When Things Go Wrong](/blog/freelancer-api-security-part-3-audit-trails)*

---

## Why Simple Rate Limiting Fails

A fixed `100 requests/minute` limit sounds reasonable until you think about real usage:

**Scenario 1 — The batch job:** Your client runs a nightly sync job. It makes 200 requests in the first 10 seconds, then nothing for the next 50 minutes. With a fixed limit, it fails. With burst allowance, it succeeds.

**Scenario 2 — The slow bot:** A scraper makes exactly 99 requests/minute, 24 hours a day. It never hits your limit. It extracts 142,560 records/day. A daily volume limit catches this; a per-minute limit doesn't.

**Scenario 3 — The free user:** You want free users to get 100 req/min and paid users to get 1,000 req/min. A global policy can't do this. Consumer-tier policies can.

**Scenario 4 — The expensive endpoint:** Your `/api/export` endpoint generates a PDF and takes 2 seconds. Each call is 50x more expensive than a simple read. A per-endpoint limit makes sense here; applying the global limit treats it as equal.

A good rate limiting strategy handles all four scenarios.

---

## Strategy 1: Sliding Window + Burst

The most important upgrade from a fixed limit.

**Fixed window problem:** With a fixed 100 req/min window, a client can make 100 requests at 11:59:50, reset at midnight, and make another 100 requests at 12:00:00 — 200 requests in 20 seconds with no violation.

**Sliding window solution:** The window moves with each request. "100 requests in the last 60 seconds" is evaluated at every request, not at the start of each minute.

**Burst allowance:** Allows short spikes above the sustained rate. A client with 100 req/min can burst to 20 requests instantly (the burst), then continues at the sustained rate.

```bash
# Sliding window with burst: 100 req/min, burst of 20
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sliding-window-with-burst",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "requests_per_minute": 100,
      "burst": 20,
      "algorithm": "sliding_window"
    }
  }' | jq .
```

The burst handles the "batch job at start" pattern without allowing the "boundary abuse" pattern.

---

## Strategy 2: Multi-Tier Consumer Limits

Different consumers get different limits based on their plan.

**The wrong way:** Different global policies for different APIs (creates maintenance overhead, hard to manage).

**The right way:** Tiered policies bound to consumers, with the default policy handling untiered consumers.

```bash
# Tier 1: Free (default policy, already bound to API)
# Already set up from Part 1: 100 req/min

# Tier 2: Starter ($10/month)
STARTER_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tier-starter",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "tenant",
    "priority": 50,
    "config": {
      "requests_per_minute": 500,
      "burst": 50,
      "algorithm": "sliding_window"
    }
  }' | jq -r .id)

# Tier 3: Pro ($50/month)
PRO_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tier-pro",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "tenant",
    "priority": 50,
    "config": {
      "requests_per_minute": 2000,
      "burst": 200,
      "algorithm": "sliding_window"
    }
  }' | jq -r .id)
```

When a customer upgrades, bind the higher-tier policy to their consumer. The gateway applies the highest-priority matching policy. No code deployment, no restart.

---

## Strategy 3: Daily Volume Limits

Per-minute limits stop burst abuse. Daily limits stop the slow scraper from Strategy 2.

```bash
# Add a daily quota limit alongside the per-minute limit
DAILY_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "daily-volume-cap",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "requests_per_day": 5000,
      "reset_time": "00:00:00",
      "timezone": "UTC"
    }
  }' | jq -r .id)

# Bind to your API (alongside the per-minute policy)
curl -s -X POST "${STOA_API_URL}/v1/admin/policies/bindings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "'$DAILY_POLICY_ID'",
    "api_catalog_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq .
```

The gateway enforces BOTH limits simultaneously. A client that stays under 100 req/min but makes 50,000 requests/day still gets blocked at the daily cap.

---

## Strategy 4: Per-Endpoint Limits

Some endpoints are more expensive than others. Apply tighter limits where it counts.

**Common candidates:**
- Export / report generation endpoints (CPU/memory intensive)
- Search endpoints (database-heavy)
- Webhook registration (can create state)
- AI inference endpoints (cost per call)

```bash
# Global API rate limit: 200 req/min (generous for most endpoints)
# Export endpoint rate limit: 5 req/min (strict — expensive operation)

EXPORT_LIMIT_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "export-endpoint-limit",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "priority": 10,
    "config": {
      "requests_per_minute": 5,
      "burst": 2,
      "path_pattern": "/export/*"
    }
  }' | jq -r .id)
```

The higher-priority (lower number) per-endpoint policy applies to `/export/*` paths, while the default policy applies to everything else.

---

## Strategy 5: Cost-Aware Limits for AI Proxies

If your API proxies AI model calls (OpenAI, Anthropic, etc.), standard request-count limits aren't enough — a single request with a 100K token context costs far more than 100 simple requests.

The right metric is **tokens** (or estimated cost), not requests.

```bash
# Token-based rate limit for AI proxy endpoint
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ai-proxy-token-budget",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "requests_per_minute": 20,
      "burst": 5,
      "path_pattern": "/ai/*",
      "max_request_body_kb": 50
    }
  }' | jq .
```

This combines request rate limiting with payload size limits. A 50KB request body is enough for substantial AI prompts without allowing the 1MB context-stuffing attack from [Part 1](/blog/freelancer-api-security-part-1-vulnerabilities).

---

## Tuning Without Breaking Users

The hardest part of rate limiting isn't setting it up — it's tuning it correctly. Too tight, and you break legitimate users. Too loose, and you're not protected.

### Step 1: Observe Before You Restrict

Start with generous limits and observe actual usage patterns:

```bash
# Check quota usage for all consumers over last 7 days
curl -s "${STOA_API_URL}/v1/admin/quotas/$TENANT_ID/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.consumers | sort_by(.peak_rpm) | reverse | .[0:10] | .[] | {consumer: .name, peak_rpm, avg_rpm, daily_max}'
```

This shows your top consumers by peak and average request rate. Set your limit at 2-3x the peak legitimate rate. This protects against abuse while giving real users headroom.

### Step 2: Return Useful Rate Limit Headers

When you return a `429`, include information so clients can back off intelligently:

STOA automatically adds these headers to rate-limited responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709251200
Retry-After: 45
```

A well-behaved client reads `Retry-After` and waits before retrying. This is the difference between a brief spike and a thundering herd.

### Step 3: Differentiate Rate Limit from Quota Exceeded

Two different 429s deserve different messages:

| Situation | Meaning | Client Should |
|-----------|---------|---------------|
| Rate limit hit | Too many requests in short window | Wait `Retry-After` seconds |
| Daily quota hit | Used up today's allocation | Wait until `X-RateLimit-Reset` (midnight UTC) |
| Monthly quota hit | Plan limit reached | Upgrade their plan |

```bash
# Check if a consumer is near their quota
curl -s "${STOA_API_URL}/v1/quotas/$TENANT_ID/$CONSUMER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    daily_used: .daily_count,
    daily_limit: .daily_limit,
    pct_used: (.daily_count / .daily_limit * 100 | floor)
  }'
```

Send a warning email when consumers hit 80% of their daily quota — before they hit the wall.

### Step 4: Monitor for False Positives

After tightening limits, check for legitimate users being blocked:

```bash
# Find consumers who got rate limited in last 24h
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?event_type=rate_limit_exceeded&hours=24" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | group_by(.consumer_id) | map({
    consumer: .[0].consumer_name,
    count: length,
    first_hit: .[0].created_at,
    last_hit: .[-1].created_at
  }) | sort_by(.count) | reverse'
```

If a paying customer is getting rate limited repeatedly, their limit is too low. Bump it.

---

## The Complete Rate Limiting Setup

Here's the complete setup for a typical freelancer SaaS API:

```bash
# 1. Default limit for free tier (all consumers start here)
FREE_LIMIT=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"free-tier","policy_type":"rate_limit","tenant_id":"'$TENANT_ID'","scope":"api","config":{"requests_per_minute":100,"burst":20,"requests_per_day":5000}}' \
  | jq -r .id)

# 2. Per-minute limit for expensive endpoints
EXPORT_LIMIT=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"export-limit","policy_type":"rate_limit","tenant_id":"'$TENANT_ID'","scope":"api","priority":10,"config":{"requests_per_minute":5,"burst":2,"path_pattern":"/export/*"}}' \
  | jq -r .id)

# 3. Payload size limit
SIZE_LIMIT=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"size-limit","policy_type":"transform","tenant_id":"'$TENANT_ID'","scope":"api","config":{"request":{"max_body_size_kb":100}}}' \
  | jq -r .id)

# 4. Bind all three to your API
for POLICY_ID in $FREE_LIMIT $EXPORT_LIMIT $SIZE_LIMIT; do
  curl -s -X POST "${STOA_API_URL}/v1/admin/policies/bindings" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"policy_id":"'$POLICY_ID'","api_catalog_id":"'$API_ID'","tenant_id":"'$TENANT_ID'"}' \
    -o /dev/null -w "Bound policy $POLICY_ID: %{http_code}\n"
done
```

Three policies, three API calls, and you have: per-minute sliding window, per-day volume cap, per-endpoint protection for expensive calls, and payload size limits.

---

## FAQ

### What's the right number for my limit?

Start at 10x your expected legitimate peak usage. If your heaviest user makes 50 req/min during normal operation, set the limit to 500 req/min. Tighten over time as you observe usage.

### Should I rate limit by IP or by consumer?

By consumer (API key), always. IP-based rate limiting breaks shared environments (corporate NATs, cloud VMs, mobile networks) and is easily bypassed by rotating IPs. Consumer-based limiting can't be bypassed by changing IPs.

### My client has a legitimate batch job that bursts — what do I do?

Option 1: Increase their burst allowance (bind a higher-burst policy to their consumer).
Option 2: Have them add exponential backoff — their job retries after `Retry-After` seconds.
Option 3: Create an async job endpoint that accepts a batch and processes it in the background, returning a job ID to poll.

### Do I need different limits for read vs write endpoints?

Often yes. Writes (POST, PUT, DELETE) should typically have tighter limits than reads (GET), because:
1. They're more expensive (database writes vs reads)
2. Abuse has worse impact (mass data creation, state corruption)

Use the `path_pattern` config to apply tighter limits to write paths.

### How does rate limiting interact with retries?

Return `Retry-After` in the 429 response. Properly implemented clients will back off. For internal services, implement exponential backoff: first retry after 1s, second after 2s, third after 4s, up to a max (e.g., 60s).

---

## Next in the Series

You've set up rate limiting. The next question is: what happened before you turned it on, and what happens when something slips through?

**[Part 3: Audit Trails for When Things Go Wrong](/blog/freelancer-api-security-part-3-audit-trails)** covers structured logging, what to capture, how to build useful queries, and minimum viable incident response for solo developers.


---

## Ready to bridge your legacy APIs to AI agents?

STOA is open-source (Apache 2.0) and free to try.

- **[Quick Start Guide →](/docs/guides/quickstart)** — Get STOA running locally in 5 minutes
- **[GitHub →](https://github.com/stoa-platform/stoa)** — Star us, fork us, contribute
- **[Discord →](https://discord.gostoa.dev)** — Join the community
