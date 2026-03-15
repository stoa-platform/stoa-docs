---
slug: freelancer-api-security-part-3-audit-trails
title: "Audit Trails When Things Go Wrong (Freelancer Part 3)"
description: "What was your API doing at 3am? Structured logging, incident response without an ops team, and queryable audit trails for solo developers."
authors: [stoa-team]
tags: [security, tutorial, api-gateway, compliance]
keywords:
  - api audit trail freelancer
  - api logging best practices
  - api incident response solo developer
  - structured logging api gateway
  - api security monitoring
  - api access logs
  - how to investigate api abuse
---
<!-- last verified: 2026-02 -->

Three weeks after launch, a client emails: "Our data looks wrong. Something happened last Tuesday at 3am."

You have two possible answers:
- "Let me check the logs" ← with an audit trail
- "I don't know, I'll have to investigate" ← without one

This is Part 3. We'll build the audit capability that lets you answer the first way.

<!-- truncate -->

*This is Part 3 of the Freelancer API Security Series. [Part 1: Your APIs Are More Vulnerable Than You Think](/blog/freelancer-api-security-part-1-vulnerabilities) | [Part 2: Rate Limiting Strategies That Actually Work](/blog/freelancer-api-security-part-2-rate-limiting)*

---

## What an Audit Trail Actually Is

An audit trail is not just access logs. It's the structured record that answers:

- **Who** made a request (consumer identity, not just IP)
- **What** they requested (method, path, request body summary)
- **When** it happened (timestamp, time zone)
- **What happened** (response code, latency, error message)
- **What changed** (before/after for mutations)

Access logs give you WHO and WHEN. A proper audit trail gives you all five.

The difference matters when your client asks "who deleted our API key?" — access logs might tell you that a DELETE request happened at 3am. An audit trail tells you which user, from which session, with what credentials.

---

## Layer 1: Gateway-Level Logging (Automatic)

STOA's gateway logs every proxied request automatically. No configuration needed. Every request through the gateway generates a structured audit event:

```json
{
  "event_type": "api_request",
  "timestamp": "2026-03-11T03:17:42.123Z",
  "request_id": "req_abc123def456",
  "consumer_id": "cons_xyz789",
  "consumer_name": "my-saas-client",
  "tenant_id": "tenant_abc",
  "api_id": "api_123",
  "method": "POST",
  "path": "/api/documents/export",
  "status_code": 200,
  "latency_ms": 342,
  "request_size_bytes": 1024,
  "response_size_bytes": 45680,
  "gateway_version": "0.1.0",
  "datacenter": "fra1"
}
```

Query it:

```bash
# Last 50 requests
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs[] | {timestamp, consumer_name, method, path, status_code, latency_ms}'

# All requests from a specific consumer
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?consumer_id=$CONSUMER_ID&limit=100" \
  -H "Authorization: Bearer $TOKEN" | jq .

# All 5xx errors in last 24h
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?status_min=500&hours=24" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | length'

# Export as CSV for analysis
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID/export/csv?hours=168" \
  -H "Authorization: Bearer $TOKEN" > last-7-days.csv
```

This is your first-line audit capability — zero config, always on.

---

## Layer 2: Security Event Logging

Beyond request logs, STOA tracks security-relevant events separately:

```bash
# Security events: key rotations, failed auth, rate limit hits, policy changes
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID/security?hours=24" \
  -H "Authorization: Bearer $TOKEN" | jq '.events[] | {type, timestamp, actor, target, outcome}'
```

Security events include:

| Event Type | What Triggers It | Why It Matters |
|-----------|-----------------|---------------|
| `auth_failed` | Invalid or expired API key | Brute force attempts, leaked keys |
| `rate_limit_exceeded` | Consumer hits rate limit | Scraping, runaway jobs |
| `policy_applied` | Policy blocked a request | Payload too large, forbidden path |
| `key_rotated` | API key was rotated | Credential rotation audit |
| `key_revoked` | API key was revoked | Deprovisioning, compromise response |
| `consumer_suspended` | Consumer was suspended | Abuse response |
| `admin_action` | Admin changed configuration | Change audit trail |

Filter by type:

```bash
# Auth failures in last 24h — potential key abuse
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID/security?event_type=auth_failed&hours=24" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    total_failures: (.events | length),
    by_consumer: (.events | group_by(.target) | map({consumer: .[0].target, count: length}) | sort_by(.count) | reverse | .[0:5])
  }'
```

If you see 5,000 auth failures from a single consumer in 24 hours, that's a compromised key being tested. Revoke it immediately.

---

## Layer 3: Application-Level Logging (What You Build)

The gateway logs the transport layer. You need to log the business layer. The two are complementary.

**What the gateway logs:** Who called what, when, with what result.

**What your application should log:** What business operation happened, what data changed, why.

A good application-level audit log:

```python
import logging
import json
from datetime import datetime, UTC

audit_logger = logging.getLogger("audit")

def log_audit_event(
    action: str,
    resource_type: str,
    resource_id: str,
    actor_id: str,
    changes: dict | None = None,
    metadata: dict | None = None,
):
    """Structured audit log entry for business events."""
    event = {
        "timestamp": datetime.now(UTC).isoformat(),
        "action": action,             # "created", "updated", "deleted", "accessed"
        "resource_type": resource_type,  # "document", "user", "invoice"
        "resource_id": resource_id,
        "actor_id": actor_id,          # From the API key / JWT claim
        "changes": changes,            # {"field": {"before": X, "after": Y}}
        "metadata": metadata,          # Any extra context
    }
    audit_logger.info(json.dumps(event))

# Usage in a route handler:
@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str, consumer: Consumer = Depends(get_consumer)):
    doc = await get_document(doc_id, consumer)

    # Log before deletion — you won't be able to log after
    log_audit_event(
        action="deleted",
        resource_type="document",
        resource_id=doc_id,
        actor_id=consumer.id,
        metadata={
            "document_name": doc.name,
            "document_size_bytes": doc.size,
            "reason": "user_requested"
        }
    )

    await db.delete(doc)
    return {"status": "deleted"}
```

**Key rule for mutations:** Log before you execute the operation, not after. If the operation fails, you still have the audit entry. If you log after and the service crashes, the event is lost.

---

## Layer 4: Structured Query Patterns

Raw logs are useless without the ability to query them. Here are the patterns you'll actually use.

### Pattern 1: Timeline Reconstruction

"What happened between 3am and 4am on Tuesday?"

```bash
# Gateway logs for the window
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?from=2026-03-11T03:00:00Z&to=2026-03-11T04:00:00Z&limit=500" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | group_by(.path) | map({
    path: .[0].path,
    total_requests: length,
    errors: map(select(.status_code >= 400)) | length,
    consumers: [.[].consumer_name] | unique
  })'
```

This gives you a breakdown by endpoint: how many calls, how many errors, which consumers.

### Pattern 2: Consumer Activity Profile

"What does 'user-12345' actually do in the API?"

```bash
CONSUMER_ID="cons_xyz789"
START="2026-03-01T00:00:00Z"
END="2026-03-15T23:59:59Z"

curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?consumer_id=$CONSUMER_ID&from=$START&to=$END&limit=1000" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    total_requests: (.logs | length),
    methods: (.logs | group_by(.method) | map({method: .[0].method, count: length})),
    top_paths: (.logs | group_by(.path) | map({path: .[0].path, count: length}) | sort_by(.count) | reverse | .[0:10]),
    error_rate: (.logs | map(select(.status_code >= 400)) | length) / (.logs | length) * 100,
    peak_hour: (.logs | group_by(.timestamp[0:13]) | map({hour: .[0].timestamp[0:13], count: length}) | sort_by(.count) | last)
  }'
```

This profile answers: is this consumer using the API as intended? Are they hitting paths they shouldn't? Is their error rate unusually high?

### Pattern 3: Anomaly Detection

"Has anything unusual happened recently?"

```bash
# Find consumers with unusually high error rates
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?hours=24&limit=5000" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | group_by(.consumer_id) | map({
    consumer: .[0].consumer_name,
    total: length,
    errors: map(select(.status_code >= 400)) | length,
    error_rate: (map(select(.status_code >= 400)) | length) / length * 100
  }) | map(select(.error_rate > 10)) | sort_by(.error_rate) | reverse'
```

A consumer with >10% error rate is either:
- Integrating incorrectly (innocent — reach out and help them)
- Testing attack patterns (not innocent — investigate)

The distinction is usually clear from the error types: `400` errors are usually bad integration; `401/403` errors in volume are usually probing.

### Pattern 4: Data Export for Compliance

Some clients or industries require audit trail exports (GDPR requests, SOC 2 audits, customer incident investigation):

```bash
# Export full 30-day audit for a specific consumer
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID/export/json?consumer_id=$CONSUMER_ID&days=30" \
  -H "Authorization: Bearer $TOKEN" > audit-export-$(date +%Y%m%d).json

# CSV format for spreadsheet analysis
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID/export/csv?consumer_id=$CONSUMER_ID&days=30" \
  -H "Authorization: Bearer $TOKEN" > audit-export-$(date +%Y%m%d).csv
```

---

## Minimum Viable Incident Response

You're a solo developer. You don't have a SIEM, a SOC, or an incident response team. Here's what you DO have, and how to use it.

### The 5-Minute Investigation Script

When something goes wrong, run this:

```bash
#!/bin/bash
# investigate.sh — quick API incident triage
# Usage: ./investigate.sh [consumer_id] [hours=24]

CONSUMER_ID="${1:-}"
HOURS="${2:-24}"

echo "=== API Incident Triage (last ${HOURS}h) ==="
echo "Timestamp: $(date -u)"
echo ""

# 1. Recent error rate
echo "--- Error Rate ---"
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?hours=$HOURS&limit=5000" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    total: (.logs | length),
    errors_4xx: (.logs | map(select(.status_code >= 400 and .status_code < 500)) | length),
    errors_5xx: (.logs | map(select(.status_code >= 500)) | length),
    rate_limited: (.logs | map(select(.status_code == 429)) | length)
  }'

# 2. Top consumers by volume
echo ""
echo "--- Top Consumers (${HOURS}h) ---"
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?hours=$HOURS&limit=5000" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | group_by(.consumer_id) | map({consumer: .[0].consumer_name, requests: length}) | sort_by(.requests) | reverse | .[0:5]'

# 3. Security events
echo ""
echo "--- Security Events (${HOURS}h) ---"
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID/security?hours=$HOURS" \
  -H "Authorization: Bearer $TOKEN" | jq '.events | group_by(.event_type) | map({type: .[0].event_type, count: length})'

# 4. If consumer specified, their activity
if [ -n "$CONSUMER_ID" ]; then
  echo ""
  echo "--- Consumer $CONSUMER_ID Activity ---"
  curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?consumer_id=$CONSUMER_ID&hours=$HOURS&limit=500" \
    -H "Authorization: Bearer $TOKEN" | jq '{
      total_requests: (.logs | length),
      error_rate: ((.logs | map(select(.status_code >= 400)) | length) / (.logs | length) * 100 | floor),
      top_paths: (.logs | group_by(.path) | map({path: .[0].path, count: length}) | sort_by(.count) | reverse | .[0:5])
    }'
fi
```

This 5-minute script answers the most common "what happened?" questions without deep investigation.

### Incident Response Playbook

**Scenario: Possible data breach**

1. Run `./investigate.sh "" 48` — get last 48h overview
2. Check for unusual consumers: large request volumes, high error rates, access to sensitive paths
3. Export logs for the suspicious window: `GET /v1/audit/$TENANT_ID/export/json?from=...&to=...`
4. Cross-reference with application logs (Layer 3)
5. If confirmed breach: revoke affected keys immediately (`POST /v1/subscriptions/$ID/revoke`)
6. Notify affected consumers (GDPR: 72h notification requirement in EU)
7. Document the timeline from the audit trail for your notification

**Scenario: Client reports data corruption**

1. Ask for timestamp and affected resource ID
2. `GET /v1/audit/$TENANT_ID?hours=72&consumer_id=$THEIR_CONSUMER_ID` — their request history
3. Look for the mutation event (DELETE, PUT, POST) near the reported timestamp
4. Cross-reference with application audit logs (Layer 3) for the `before`/`after` values
5. Answer: "At 03:17:42 UTC, a DELETE request was made from your API key for resource /documents/12345. Here is the audit record."

**Scenario: Unexpected API cost spike**

1. Check daily volume: `GET /v1/quotas/$TENANT_ID/stats`
2. Find the top consumers by volume over the spike period
3. Check if any consumer had a runaway job (sustained high request rate with no pause)
4. Apply daily volume cap if not already configured (see Part 2)

---

## Building the Habit

An audit trail is only useful if you check it regularly. Build it into your weekly routine:

```bash
# Add to your weekly-stoa-review.sh (from the Week 1 runbook)

echo ""
echo "--- Security Events This Week ---"
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID/security?hours=168" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    auth_failures: (.events | map(select(.event_type == "auth_failed")) | length),
    rate_limit_hits: (.events | map(select(.event_type == "rate_limit_exceeded")) | length),
    key_rotations: (.events | map(select(.event_type == "key_rotated")) | length),
    admin_actions: (.events | map(select(.event_type == "admin_action")) | length)
  }'

echo ""
echo "--- Error Rate Trend (by day) ---"
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?hours=168&limit=10000" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | group_by(.timestamp[0:10]) | map({
    date: .[0].timestamp[0:10],
    total: length,
    errors: map(select(.status_code >= 400)) | length,
    error_pct: (map(select(.status_code >= 400)) | length) / length * 100 | floor
  })'
```

Five minutes, once a week. Most problems are visible in the trend data before they become incidents.

---

## The Compliance Angle

If you're building for European clients, healthcare, or fintech — you may have compliance requirements around audit trails.

**GDPR Article 30** requires a record of processing activities. An API audit trail that captures who accessed what personal data, when, and for what purpose is a significant part of your GDPR documentation.

**DORA (Digital Operational Resilience Act)** for financial services requires ICT incident logging and reporting. Your gateway audit trail provides the ICT event log.

**SOC 2 Type II** (if you're selling to enterprise) requires demonstrating audit controls. Your audit trail evidence (exported logs) is a direct artifact for the audit.

You don't need to configure anything extra for these. The audit trail described in this article is the artifact. The habit of checking it weekly, the ability to export it on demand, and the incident response playbook above are what turn the logs into compliance evidence.

---

## FAQ

### How long should I keep audit logs?

GDPR: data access logs should be kept for as long as you process that data (typically 12-24 months minimum). DORA: 5 years for ICT incident logs. Pragmatic recommendation: 90 days hot (queryable via API), 12 months cold (archived CSV exports).

### Can I use STOA's audit trail as my sole compliance record?

It covers the gateway layer. For full compliance, combine it with application-level audit logs (Layer 3). The gateway tells you "who called what." Your app tells you "what changed as a result."

### My client wants a self-service audit download. How do I do that?

Expose a secure admin endpoint in your app that calls `GET /v1/audit/$TENANT_ID/export/csv?consumer_id={their_id}` and returns the CSV. The client gets their own activity records; they don't access other consumers' data.

### What's the difference between access logs and audit logs?

Access logs = raw request/response records (Apache/nginx format). Audit logs = structured business event records. STOA provides both. This article focuses on audit logs because they're what matters for security investigation and compliance.

### Can I forward STOA's audit events to my existing SIEM?

STOA emits audit events to a Kafka topic (if Kafka is configured). You can consume from that topic and forward to Datadog, Splunk, OpenSearch, or any SIEM. For most freelancer setups, the API query approach in this article is sufficient without a full SIEM pipeline.

---

## You've Completed the Series

**[Part 1](/blog/freelancer-api-security-part-1-vulnerabilities)** covered the threat landscape and the 80/20 of what to protect against.

**[Part 2](/blog/freelancer-api-security-part-2-rate-limiting)** built the rate limiting strategy that stops the most common attacks.

**Part 3** (this article) built the audit capability that lets you investigate when something slips through.

The combination — gateway security baseline + tiered rate limiting + structured audit trail — is what production API security looks like for solo developers and small teams. No enterprise security team required.

**Next steps:**
- [Developer Portal Guide](/docs/guides/portal) — let clients self-register and manage their own keys
- [Authentication Guide](/docs/guides/authentication) — JWT, OAuth 2.0, and mTLS options for higher-security scenarios
- [Observability Guide](/docs/guides/observability) — full Prometheus + Grafana setup for uptime monitoring


---

## Ready to bridge your legacy APIs to AI agents?

STOA is open-source (Apache 2.0) and free to try.

- **[Quick Start Guide →](/docs/guides/quickstart)** — Get STOA running locally in 5 minutes
- **[GitHub →](https://github.com/stoa-platform/stoa)** — Star us, fork us, contribute
- **[Discord →](https://discord.gostoa.dev)** — Join the community
