---
slug: detecting-attacks-stoa-part-3
title: "Detecting API Attacks: Audit Logs, Guardrails, Metrics"
description: "Credential abuse, prompt injection, and DDoS patterns in your gateway logs. How to detect attacks using audit trails, guardrails, and Prometheus."
authors: [stoa-team]
tags: [security, tutorial, api-gateway]
unlisted: true
keywords:
  - API attack detection gateway
  - API security monitoring
  - STOA audit log attack detection
  - credential abuse API detection
  - prompt injection detection API
  - API DDoS detection rate limiting
  - API security incident response
  - anomaly detection API gateway
  - API security monitoring 2026
  - detect API abuse open source
---
<!-- last verified: 2026-02 -->

Zero Trust architecture assumes breach — if you assume attackers are already inside, your priority shifts from pure prevention to detection. STOA generates structured audit events and Prometheus metrics that enable detection of credential abuse, prompt injection attempts, rate abuse, and data exfiltration patterns. This article covers what STOA detects, how to query for attack signals, and a practical incident response playbook.

<!-- truncate -->

:::info This is Part 3 of a 3-part series
- [Part 1](/blog/zero-trust-api-gateways-part-1): What Zero Trust Means for API Gateways
- [Part 2](/blog/zero-trust-stoa-checklist-part-2): 10-Step STOA Zero Trust Checklist
- **Part 3 (this article)**: Detecting Attacks with STOA

Also see: [STOA Security Architecture](/blog/stoa-api-security-architecture) and [OWASP API Security Top 10 & STOA Coverage](/blog/owasp-api-security-top-10-stoa).
:::

## What STOA Generates for Detection

STOA produces three detection data sources:

1. **Structured audit events** (Kafka/JSON): one event per API call, every call — including successful ones
2. **Prometheus metrics**: counters and histograms for requests, denies, guardrail triggers, auth failures
3. **Guardrail trigger events**: specific events when PII, prompt injection, or schema violations are detected

These are complementary. Audit events give you the detailed forensic record. Prometheus metrics give you real-time aggregation for alerting. Guardrail events give you immediate signals on specific threat patterns.

## Attack Pattern 1: Credential Abuse

**What it looks like**: a valid token used from an unexpected location, at unusual hours, or with a sudden change in request volume or endpoint distribution.

### Detection via Audit Log

Audit events include `agent_id`, `consumer_id`, `ip_address`, and `session_id`. Query your SIEM:

```sql
-- Detect single consumer calling from multiple IPs in 1 hour
SELECT consumer_id, COUNT(DISTINCT ip_address) AS unique_ips, COUNT(*) AS requests
FROM stoa_audit_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY consumer_id
HAVING COUNT(DISTINCT ip_address) > 3
ORDER BY unique_ips DESC;
```

```sql
-- Detect sudden endpoint distribution change (consumer normally calls /v1/analytics, now calling /v1/users/*)
SELECT consumer_id, path_prefix, COUNT(*) AS count
FROM stoa_audit_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND path LIKE '/v1/users/%'
  AND consumer_id NOT IN (SELECT consumer_id FROM known_user_api_consumers)
ORDER BY count DESC;
```

### Detection via Prometheus

```promql
# Auth failures per IP (last 5 minutes)
sum(rate(stoa_auth_failures_total[5m])) by (ip_address) > 10

# Consumer accessing endpoints outside their historical pattern
(stoa_consumer_endpoint_calls_total offset 24h) - stoa_consumer_endpoint_calls_total > 1000
```

**Response**: revoke the consumer's tokens immediately (Step 9 of the [Zero Trust Checklist](/blog/zero-trust-stoa-checklist-part-2)), suspend the consumer record, investigate the token lifecycle.

---

## Attack Pattern 2: Prompt Injection

**What it looks like**: request payloads containing instructions designed to override an AI agent's behavior and cause unauthorized API calls.

### How STOA's Guardrails Detect It

STOA's prompt injection guardrail matches against configurable patterns before forwarding requests to the backend. When a match is found:

1. The request is blocked (configurable: block or log-only)
2. A guardrail trigger event is emitted to the audit stream
3. The Prometheus counter `stoa_guardrail_triggers_total{type="prompt_injection"}` is incremented

**Example guardrail event**:
```json
{
  "event_type": "guardrail_trigger",
  "timestamp": "2026-02-22T14:23:01.234Z",
  "session_id": "sess_abc123",
  "consumer_id": "claude-desktop-prod",
  "trigger_type": "prompt_injection",
  "matched_pattern": "ignore previous instructions",
  "action_taken": "blocked",
  "request_path": "/v1/tools/invoke",
  "tool_name": "delete_user"
}
```

### Query for Injection Campaigns

Isolated injections may be test probes. A series of injection attempts over a short window indicates a targeted attack:

```sql
-- Detect injection campaigns (3+ attempts in 10 minutes from same session)
SELECT session_id, consumer_id, COUNT(*) AS attempts, MIN(timestamp) AS first_attempt
FROM stoa_audit_events
WHERE event_type = 'guardrail_trigger'
  AND trigger_type = 'prompt_injection'
  AND timestamp > NOW() - INTERVAL '10 minutes'
GROUP BY session_id, consumer_id
HAVING COUNT(*) >= 3
ORDER BY attempts DESC;
```

**Response**: terminate the affected session, investigate the prompt source (backend application or external input), review which tool the injection was targeting.

---

## Attack Pattern 3: Rate Abuse / DDoS

**What it looks like**: sudden spike in request volume from one or several consumers, typically aimed at exhausting quota or degrading service for other consumers.

### Detection via Prometheus

```promql
# Consumer exceeding their historical baseline by 5×
(rate(stoa_consumer_requests_total[5m]) / on(consumer_id) avg_over_time(rate(stoa_consumer_requests_total[5m])[24h:])) > 5

# Policy deny rate spike (consumer hitting rate limit repeatedly)
rate(stoa_policy_denies_total{deny_reason="rate_limit"}[5m]) > 10
```

### Detection via Audit Log

```sql
-- Top consumers by volume in last 5 minutes vs their 24h average
SELECT
  consumer_id,
  COUNT(*) AS requests_last_5min,
  AVG(daily_avg) AS daily_avg_per_5min
FROM stoa_audit_events
LEFT JOIN (
  SELECT consumer_id, COUNT(*) / 288.0 AS daily_avg
  FROM stoa_audit_events
  WHERE timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY consumer_id
) baseline USING (consumer_id)
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY consumer_id
HAVING COUNT(*) > 3 * COALESCE(daily_avg, 0)
ORDER BY requests_last_5min DESC;
```

STOA's built-in rate limiting will already be throttling the consumer (returning `429`), but this query identifies the consumer for manual investigation.

**Response**: if rate limiting is in place and working, the immediate risk is contained. Investigate whether this is a legitimate traffic spike (new feature launch, data migration) or malicious activity. For confirmed abuse, suspend the consumer record.

---

## Attack Pattern 4: Data Exfiltration Signals

**What it looks like**: unusually large response payloads, repeated calls to high-sensitivity endpoints, or unusual time-of-day patterns on data retrieval endpoints.

### STOA's Contribution

STOA logs `backend_status` and `duration_ms` per request. While STOA doesn't log response content by default (for privacy and performance), it logs metadata that reveals anomalous data access patterns.

Guardrails can optionally log response size and trigger on oversized responses:

```yaml
guardrails:
  response_size_limit_kb: 512
  response_size_action: "truncate_and_alert"  # don't block, but alert
```

### Detection Queries

```sql
-- Unusual off-hours data access
SELECT consumer_id, DATE_TRUNC('hour', timestamp) AS hour, COUNT(*) AS calls
FROM stoa_audit_events
WHERE path LIKE '/v1/customers/%'
  AND timestamp > NOW() - INTERVAL '7 days'
  AND EXTRACT(HOUR FROM timestamp AT TIME ZONE 'UTC') NOT BETWEEN 7 AND 19
GROUP BY consumer_id, hour
HAVING COUNT(*) > 100
ORDER BY calls DESC;

-- Same consumer repeatedly reading the same list endpoint (pagination scraping)
SELECT consumer_id, path, COUNT(*) AS calls, MIN(timestamp), MAX(timestamp)
FROM stoa_audit_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND method = 'GET'
GROUP BY consumer_id, path
HAVING COUNT(*) > 500
ORDER BY calls DESC;
```

---

## Incident Response Playbook

When a detection rule fires, follow this playbook:

### Step 1: Contain (< 5 minutes)

```bash
# Revoke consumer tokens immediately
curl -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/revoke \
  -d "token=${CONSUMER_REFRESH_TOKEN}" \
  -d "token_type_hint=refresh_token" \
  -u "${CLIENT_ID}:${CLIENT_SECRET}"

# Suspend consumer in STOA
curl -X PATCH ${STOA_API_URL}/v1/consumers/${CONSUMER_ID} \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"status": "suspended"}'
```

### Step 2: Investigate (< 30 minutes)

Pull the consumer's audit trail for the last 24 hours:

```bash
# Export consumer audit events (Kibana/SIEM query)
# Filter: consumer_id = ${CONSUMER_ID} AND timestamp > (NOW - 24h)
# Export to CSV for analysis
```

Key questions:
- When did the unusual activity start?
- What endpoints were accessed?
- Were guardrails triggered?
- Is the activity from a known IP range or unexpected locations?
- Does the request volume match the consumer's stated use case?

### Step 3: Remediate

Depending on findings:
- **Credential theft**: issue new credentials, rotate the affected client certificate, review how the credential was exposed
- **Prompt injection**: patch the application layer that accepts user input, review the tool that was targeted
- **Rate abuse**: investigate whether it's a bug in the consumer application or intentional; adjust rate limits if warranted
- **Exfiltration**: determine what data was accessed, assess notification obligations (GDPR Article 33 requires breach notification within 72 hours if high-risk)

### Step 4: Document and Update

- Log the incident in your security incident tracker
- Add the attack pattern to your OPA policies or guardrail rules if not already covered
- Update alert thresholds based on what the baseline looked like before the attack

## Grafana Dashboard Setup

A complete Grafana dashboard for STOA security monitoring should include:

| Panel | Metric | Visualization |
|-------|--------|--------------|
| Request rate by consumer | `rate(stoa_requests_total[5m])` | Time series |
| Policy deny rate | `rate(stoa_policy_denies_total[5m])` | Time series |
| Auth failures | `rate(stoa_auth_failures_total[5m])` | Time series + alert |
| Guardrail triggers by type | `stoa_guardrail_triggers_total` | Bar chart |
| Top consumers by volume | `topk(10, sum by(consumer_id))` | Table |
| P99 latency | `histogram_quantile(0.99, stoa_request_duration_seconds)` | Time series |

## Frequently Asked Questions

### How long should I retain audit logs?

GDPR Article 5 requires data minimization — don't retain longer than necessary. For security purposes, 90 days is a typical retention period for operational logs. However, incident investigation often requires looking back 30-60 days. If your organization has specific regulatory requirements (PCI DSS: 12 months, DORA: depends on ICT risk classification), those requirements take precedence. STOA's audit events hash request parameters by default to reduce PII exposure in long-term retention.

### Can STOA detect zero-day attacks?

STOA's guardrails are pattern-based — they detect known attack patterns, not novel ones. For behavioral anomaly detection (identifying attacks that don't match known patterns), you need a behavioral baseline and anomaly scoring, which is typically done in your SIEM using the audit log data. STOA provides the data; anomaly scoring requires additional tooling.

### What's the performance impact of audit logging?

Audit log events are written asynchronously to Kafka. The synchronous overhead per request is minimal (< 1ms for the event serialization). If Kafka is unavailable, STOA buffers events in memory (configurable buffer size) and writes when connectivity is restored. In worst case, very high buffer use can cause log loss — size your Kafka topic for your peak request rate.

---

*This concludes the Zero Trust for API Gateways series.*
*[Part 1: What Zero Trust Means](/blog/zero-trust-api-gateways-part-1) | [Part 2: 10-Step Checklist](/blog/zero-trust-stoa-checklist-part-2)*

*STOA Platform is open-source (Apache 2.0). [Get started](https://docs.gostoa.dev/docs/guides/quickstart) or star the project on [GitHub](https://github.com/stoa-platform/stoa).*
