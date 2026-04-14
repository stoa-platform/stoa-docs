---
slug: freelancer-api-security-part-1-vulnerabilities
title: "Your APIs Are More Vulnerable Than You Think (Part 1)"
description: "Real attack patterns targeting solo developer APIs. What breaks first, how attackers find you, and the 80% fix that doesn't add complexity."
authors: [stoa-team]
tags: [security, tutorial, api-gateway, education]
keywords:
  - api security freelancer
  - api vulnerabilities solo developer
  - protect api from attacks
  - api gateway security open source
  - api security checklist indie hacker
  - common api vulnerabilities
  - api security best practices 2026
---
<!-- last verified: 2026-02 -->

You've deployed your API. Maybe it's a side project, maybe it's client work, maybe it's the backend for a SaaS you're building on evenings and weekends.

Here's what's probably happening to it right now — without you knowing.

<!-- truncate -->

*This is Part 1 of the Freelancer API Security Series. [Part 2: Rate Limiting Strategies That Actually Work](/blog/freelancer-api-security-part-2-rate-limiting) | [Part 3: Audit Trails for When Things Go Wrong](/blog/freelancer-api-security-part-3-audit-trails)*

---

## The Attack Surface You Don't Think About

When most developers think about API security, they think about authentication: "add JWT tokens, done." Authentication is important, but it's one layer of a multi-layer problem.

Here's the actual threat landscape for a typical freelancer API:

| Attack Type | Frequency | Impact | How Common |
|-------------|-----------|--------|------------|
| Credential stuffing / key theft | High | Critical | Very common |
| Excessive data exposure | Medium | High | Extremely common |
| Lack of rate limiting | High | High | Near-universal |
| Broken object-level auth | Medium | Critical | Very common |
| Security misconfiguration | Medium | Medium | Common |
| Injection (SQL, NoSQL, cmd) | Low | Critical | Common |

Notice what's at the top: rate limiting and data exposure. These are boring, unsexy, and ignored by most tutorials. They're also the ones that hit you first.

---

## Attack Pattern 1: The API Key Harvest

**What happens:** A bot discovers your API, tries a few valid endpoints, then starts cycling through API keys from breach databases. Or worse, your client's developer accidentally commits an API key to a public GitHub repo.

**How fast it escalates:** GitHub bots scan for committed secrets in minutes. Within an hour of a key appearing in a public repo, it's typically been harvested.

**What a gateway does:** Centralized key management. You can revoke a compromised key in one API call, without touching your backend code:

```bash
# Revoke a compromised subscription immediately
curl -s -X POST "${STOA_API_URL}/v1/subscriptions/$SUBSCRIPTION_ID/revoke" \
  -H "Authorization: Bearer $TOKEN"
```

The key stops working within seconds. Your backend code doesn't change. Your other clients are unaffected.

Without a gateway, you'd need to deploy a code change to invalidate a key. If your deployment pipeline is slow, or if it's 2am, that's a problem.

---

## Attack Pattern 2: The Slow Scrape

**What happens:** A competitor, data broker, or malicious actor doesn't hammer your API — they call it slowly, methodically, 24 hours a day, extracting every piece of data you have. No rate limit trigger. No alert. Just silent extraction.

**Signs you've been scraped:** You notice your database backup is suddenly 3x larger. Your cloud costs creep up. Your downstream API vendor sends an overage invoice.

**The insidious part:** Slow scraping looks like a legitimate heavy user. Without per-consumer tracking, you can't tell the difference.

**What a gateway does:** Per-consumer request tracking. Every consumer has a consumption profile — calls per day, calls per hour, bytes transferred. Anomalies are visible:

```bash
# Check a consumer's last 24h usage
curl -s "${STOA_API_URL}/v1/quotas/$TENANT_ID/$CONSUMER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    requests_today: .daily_count,
    requests_this_hour: .hourly_count,
    bytes_transferred: .bytes_out
  }'
```

A legitimate user calling your API for a side project makes ~500 calls/day. A scraper makes 50,000. The numbers tell the story.

---

## Attack Pattern 3: Excessive Data Exposure

This isn't an external attack — it's your own code exposing too much.

**The classic mistake:**

```python
# You need to return the user's display name
# You return the entire user object
@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    user = await db.get(User, user_id)
    return user  # includes email, password hash, internal flags, billing_id...
```

The client only uses `displayName`. You've exposed everything. This is one of the [OWASP API Top 10](https://owasp.org/www-project-api-security/) most common patterns.

**What a gateway does:** Request/response transformation policies let you strip sensitive fields before they reach the client, without touching your backend:

```bash
# Add a response transform policy to strip sensitive fields
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "strip-sensitive-user-fields",
    "policy_type": "transform",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "response": {
        "remove_fields": ["password_hash", "billing_id", "internal_flags", "keycloak_id"]
      }
    }
  }' | jq .
```

This is a gateway-level safeguard, not a replacement for proper serialization in your backend. Defense in depth: fix the root cause AND add the gateway layer.

---

## Attack Pattern 4: Broken Object-Level Authorization

**What happens:** Your API has `GET /api/documents/{document_id}`. User A can call `GET /api/documents/12345` and get their document. What happens if they call `GET /api/documents/12346`? If your backend doesn't check ownership, they get User B's document.

This is BOLA (Broken Object Level Authorization) — OWASP API Security #1 for three years running.

**The uncomfortable truth:** This is a backend code problem. A gateway cannot fix authorization logic errors in your business code. There's no configuration that makes "check if this user owns this document" happen automatically.

**What a gateway CAN do:** Add an extra layer of authentication enforcement (ensure the token is valid, the consumer is active, the tenant is correct) so unauthenticated requests never reach the backend at all. Reducing the attack surface doesn't eliminate the vulnerability but means only authenticated users can attempt the exploit.

**What you must do:** Always filter by `user_id` (or `tenant_id`) when querying owned resources:

```python
# Vulnerable
async def get_document(document_id: str):
    return await db.query(Document).filter(Document.id == document_id).first()

# Fixed
async def get_document(document_id: str, current_user: User = Depends(get_current_user)):
    doc = await db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id  # always scope to owner
    ).first()
    if not doc:
        raise HTTPException(status_code=404)  # not 403 — don't reveal existence
    return doc
```

---

## Attack Pattern 5: The Amplification Attack

**What happens:** Your API has an endpoint like `POST /api/process-batch` that accepts 1,000 items. One malicious call triggers 1,000 downstream operations. At 10 calls/second, that's 10,000 operations/second hitting your database or a paid third-party API.

**Real-world example:** An LLM proxy with no batch size limit. An attacker submits requests with 1,000-item batches. Each batch consumes expensive compute credits. At 10 concurrent users, costs escalate to thousands of dollars per hour before you notice.

**What a gateway does:**

1. **Payload size limits** — reject requests over a configured size (e.g., 100KB max)
2. **Rate limiting by consumer** — even if each batch request is "one request," limit total requests per time window

```bash
# Add a payload size limit policy
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payload-size-limit",
    "policy_type": "transform",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "request": {
        "max_body_size_kb": 100
      }
    }
  }' | jq .
```

Combined with rate limiting from [Part 2 of this series](/blog/freelancer-api-security-part-2-rate-limiting), amplification attacks become much harder to execute.

---

## The 80/20 of API Security

You can't fix everything. Here's what protects you from 80% of real-world attacks, in order of impact:

| Priority | Control | What It Stops | Effort |
|----------|---------|---------------|--------|
| 1 | Rate limiting per consumer | Brute force, scraping, amplification | Low (gateway policy) |
| 2 | Centralized key management | Key compromise, unauthorized access | Low (gateway) |
| 3 | Request/response logging | All attack patterns (post-hoc) | Low (gateway) |
| 4 | Object-level authorization | BOLA | Medium (code fix) |
| 5 | Input validation | Injection | Medium (code fix) |
| 6 | Payload size limits | Amplification | Low (gateway policy) |
| 7 | Dependency scanning | Supply chain | Low (CI tool) |

Items 1, 2, 3, and 6 are handled by an API gateway. Items 4 and 5 require backend code changes. Item 7 requires CI tooling.

**The gateway covers 4 of the 7.** That's why setting up a gateway — even for a side project — isn't over-engineering. It's the minimum viable security posture.

---

## Setting Up the Security Baseline

If you followed [Hello World tutorial](/blog/hello-world-api-gateway-freelancer), you already have the gateway running. Here's the security baseline to add:

```bash
# 1. Rate limiting (100 req/min, burst 10)
RATE_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "security-baseline-rate-limit",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {"requests_per_minute": 100, "burst": 10}
  }' | jq -r .id)

# 2. Payload size limit (100KB max)
SIZE_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "security-baseline-size-limit",
    "policy_type": "transform",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {"request": {"max_body_size_kb": 100}}
  }' | jq -r .id)

# 3. Bind both to your API
for POLICY_ID in $RATE_POLICY_ID $SIZE_POLICY_ID; do
  curl -s -X POST "${STOA_API_URL}/v1/admin/policies/bindings" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"policy_id": "'$POLICY_ID'", "api_catalog_id": "'$API_ID'", "tenant_id": "'$TENANT_ID'"}' \
    | jq .id
done
```

These three controls — rate limiting, size limits, and the key management you set up in Hello World — give you the 80% security baseline.

---

## What Comes Next

This article covered the threat landscape. The next two articles get practical:

- **[Part 2: Rate Limiting Strategies That Actually Work](/blog/freelancer-api-security-part-2-rate-limiting)** — sliding windows, burst allowances, per-endpoint limits, and how to tune without breaking legitimate users
- **[Part 3: Audit Trails for When Things Go Wrong](/blog/freelancer-api-security-part-3-audit-trails)** — structured logging, what to capture, how to query it, and minimum viable incident response

If you haven't set up STOA yet, start with the [Hello World tutorial](/blog/hello-world-api-gateway-freelancer).

---

## FAQ

### My API is small — do I really need this?

Size doesn't matter for attackers. Bots scan the entire internet continuously. A new endpoint is found within hours of going live, regardless of whether it's a side project or a Fortune 500 service.

### Isn't HTTPS enough?

HTTPS encrypts traffic in transit. It doesn't prevent rate abuse, key compromise, excessive data exposure, or authorization failures. Different threat, different control.

### I use a managed API (AWS API Gateway, Cloudflare Workers). Do I still need this?

Managed gateways provide some of these controls, but often at a cost per request that adds up quickly. STOA is open source and self-hosted — no per-request fees, full control over your data.

### What about WAF (Web Application Firewall)?

A WAF adds another layer (SQL injection signatures, bot detection rules). It's a complement to, not a replacement for, the controls described here. For most freelancer APIs, a WAF is premature — start with the gateway controls first.

### How do I know if my API is already being abused?

Check your audit logs: `GET /v1/audit/$TENANT_ID`. Look for unusual patterns — many requests from one consumer, requests to endpoints that don't exist (404 flood), or requests at unusual hours. [Part 3](/blog/freelancer-api-security-part-3-audit-trails) of this series covers exactly this.


---

## Ready to bridge your legacy APIs to AI agents?

STOA is open-source (Apache 2.0) and free to try.

- **[Quick Start Guide →](/docs/guides/quickstart)** — Get STOA running locally in 5 minutes
- **[GitHub →](https://github.com/stoa-platform/stoa)** — Star us, fork us, contribute
- **[Discord →](https://discord.gostoa.dev)** — Join the community
