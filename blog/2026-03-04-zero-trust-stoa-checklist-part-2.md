---
slug: zero-trust-stoa-checklist-part-2
title: "Zero Trust for API Gateways (Part 2): 10-Step STOA Checklist"
description: "Actionable 10-step checklist to implement Zero Trust with STOA Platform. Covers mTLS, OAuth scopes, OPA policies, guardrails, audit logging, and incident response."
authors: [stoa-team]
tags: [security, tutorial, api-gateway]
unlisted: true
keywords:
  - zero trust API gateway checklist
  - STOA zero trust configuration
  - API gateway mTLS configuration
  - OPA policy API gateway
  - OAuth 2.1 API gateway configuration
  - zero trust implementation guide API
  - API security checklist 2026
  - configure zero trust API gateway
  - mTLS zero trust step by step
  - least privilege API scopes
---
<!-- last verified: 2026-02 -->

This checklist implements Zero Trust architecture with STOA Platform in 10 actionable steps. Each step is independently deployable and verifiable. Start from the top — steps 1-3 provide the most immediate security improvement and can be implemented in under an hour.

<!-- truncate -->

:::info This is Part 2 of a 3-part series
- [Part 1](/blog/zero-trust-api-gateways-part-1): What Zero Trust Means for API Gateways
- **Part 2 (this article)**: 10-Step STOA Zero Trust Checklist
- [Part 3](/blog/detecting-attacks-stoa-part-3): Detecting Attacks with STOA

For architecture context, see [STOA Security Architecture](/blog/stoa-api-security-architecture).
:::

## Step 1: Assign Every API Consumer a Unique Identity

Zero Trust begins with identity. Every caller — mobile app, CI/CD pipeline, third-party integration, AI agent — must have a unique, non-shared identity.

**Why**: Shared credentials make attribution impossible. When something goes wrong, you can't tell which consumer caused it.

**With STOA**: Each consumer gets a unique consumer record in the STOA control plane with a distinct OAuth client ID.

```bash
# Create a consumer via STOA API
curl -X POST ${STOA_API_URL}/v1/consumers \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "analytics-service",
    "description": "Internal analytics pipeline",
    "tenant_id": "acme-corp"
  }'
```

**Verify**: Every consumer record has a unique `consumer_id`. No shared credentials between services.

---

## Step 2: Enforce Short-Lived Tokens

Long-lived tokens (days, months, years) are a major risk: a stolen token grants prolonged access. Short-lived tokens limit the damage window.

**STOA configuration**: Set access token TTL in Keycloak to 15 minutes with 8-hour refresh token:

```bash
# Keycloak realm settings (via API)
curl -X PUT ${STOA_AUTH_URL}/admin/realms/stoa \
  -H "Authorization: Bearer ${KC_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "accessTokenLifespan": 900,
    "ssoSessionMaxLifespan": 28800,
    "ssoSessionIdleTimeout": 3600
  }'
```

**For AI agents**: configure automatic token refresh using the refresh token before the access token expires. Claude Desktop and most AI agent frameworks support this natively.

**Verify**: `curl -s ${STOA_AUTH_URL}/realms/stoa/.well-known/openid-configuration | jq '.token_endpoint'` — confirm token endpoint responds and tokens are JWTs you can decode to check `exp` claim.

---

## Step 3: Apply Least-Privilege Scopes

Audit your consumers' current scopes. Most should have `stoa:read` only. Write and admin scopes should be explicit exceptions with documented justification.

**Check current state**:
```bash
# List consumers and their scopes
curl ${STOA_API_URL}/v1/consumers \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  | jq '.[] | {name: .name, scope: .oauth_scopes}'
```

**Fix overly broad scopes**: if you find consumers with `stoa:admin` that don't need it, rotate to `stoa:read` or `stoa:write`.

**Scope definitions**:
- `stoa:read` — GET requests only, no mutations
- `stoa:write` — read + write, no admin operations
- `stoa:admin` — full control plane access (STOA admins only)

**Verify**: decode a consumer's JWT and confirm `scope` claim matches the minimum required.

---

## Step 4: Enable mTLS for High-Risk Consumers

Mutual TLS (RFC 8705 certificate binding) binds access tokens to client certificates. A stolen token is useless without the corresponding private key.

**Enable for**: internal services, CI/CD pipelines, AI agents with broad access.

**STOA mTLS configuration** (`stoa-gateway/config.yaml`):

```yaml
mtls:
  enabled: true
  client_cert_header: "X-Client-Cert"
  require_for_tenants:
    - acme-corp
    - finance-team
  exempt_paths:
    - "/.well-known/*"
    - "/oauth/*"
    - "/health"
```

**Issue client certificates**: use your internal CA or a short-lived certificate from Vault/cert-manager:

```bash
# With cert-manager (Kubernetes)
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: analytics-service-cert
  namespace: stoa-system
spec:
  secretName: analytics-service-tls
  duration: 720h  # 30 days
  renewBefore: 168h  # Renew 7 days before expiry
  subject:
    organizations: ["acme-corp"]
  commonName: analytics-service
  issuerRef:
    name: internal-ca
    kind: ClusterIssuer
EOF
```

**Verify**: make a request with and without the client certificate. Requests without the cert should return `401 mTLS certificate required`.

---

## Step 5: Write Explicit OPA Policies

Replace implicit "allow all authenticated requests" with explicit OPA policies. Start simple — block write operations for read-only consumers.

**Create a baseline policy**:

```rego
# policy/baseline.rego
package stoa.authz

default allow = false

# Allow GET/HEAD/OPTIONS for any authenticated consumer
allow {
    input.consumer.authenticated == true
    input.method in ["GET", "HEAD", "OPTIONS"]
}

# Allow mutations only for consumers with write scope
allow {
    input.consumer.authenticated == true
    input.consumer.scope in ["stoa:write", "stoa:admin"]
    input.method in ["POST", "PUT", "PATCH", "DELETE"]
}

# Block admin endpoints for non-admins
deny {
    startswith(input.path, "/admin/")
    input.consumer.scope != "stoa:admin"
}
```

Upload via STOA API or Console. OPA policies take effect immediately on the next request.

**Verify**: send a DELETE request with a `stoa:read` token — expect `403 Forbidden`. Send with a `stoa:write` token — expect `200 OK` or appropriate backend response.

---

## Step 6: Set Per-Consumer Rate Limits

Rate limits enforce "least resource consumption" — no consumer can monopolize the gateway. They also provide early detection of abusive or malfunctioning consumers.

```bash
# Create a rate limit policy for analytics service
curl -X POST ${STOA_API_URL}/v1/policies \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "analytics-rate-limit",
    "type": "rate_limit",
    "consumer_id": "analytics-service-id",
    "config": {
      "requests_per_minute": 1000,
      "requests_per_hour": 20000,
      "burst_multiplier": 1.5
    }
  }'
```

**Tier your limits** by consumer type:
- AI agents: lower per-minute, higher per-hour (bursty workloads)
- Internal services: higher per-minute (high-frequency, predictable)
- External partners: per their SLA

**Verify**: run a simple loop making 1001 requests/minute and confirm the 1001st returns `429 Too Many Requests` with `Retry-After` header.

---

## Step 7: Enable AI Guardrails

Guardrails inspect request and response payloads for security-relevant patterns. Essential for AI agent traffic where payloads may contain sensitive data or injection attempts.

**Enable in STOA configuration**:

```yaml
guardrails:
  enabled: true
  pii_detection:
    enabled: true
    action: redact  # or "block"
    patterns:
      - type: credit_card
      - type: ssn
      - type: email
        action: log_only  # Don't block emails, just log
  prompt_injection:
    enabled: true
    action: block
    patterns:
      - "ignore previous instructions"
      - "override system prompt"
      - "you are now"
  response_size_limit_kb: 512
```

**Verify**: send a request with `4242424242424242` (test card number) in the body. Confirm it's redacted in the response and a guardrail event appears in the audit log.

---

## Step 8: Configure Immutable Audit Logging

You cannot practice Zero Trust without observability. Every call must be logged — including successful ones. Successful calls represent your normal baseline; deviations from baseline are your anomaly signal.

**STOA audit log shipping** (Kafka/SIEM):

```yaml
audit:
  enabled: true
  kafka:
    brokers: ["kafka.internal:9092"]
    topic: "stoa.audit.events"
    include_request_hash: true
    include_response_status: true
    include_guardrail_triggers: true
  retention_days: 90
```

**Minimum fields to capture**:
- `timestamp`, `session_id`, `agent_id`, `consumer_id`
- `tool_name`, `http_method`, `path`
- `outcome` (allowed/denied), `policy_result`
- `backend_status`, `duration_ms`
- `guardrail_triggers[]`

**Verify**: make a test call and confirm the audit event appears in your SIEM/log aggregator within 30 seconds. Check that `consumer_id` and `agent_id` are populated.

---

## Step 9: Implement Continuous Token Validation

Token validation should happen on every request, not just at session start. This catches revoked tokens promptly.

**STOA validates on every request by default**. Confirm introspection is enabled:

```yaml
auth:
  jwt:
    issuer: "${STOA_AUTH_URL}/realms/stoa"
    audience: "stoa-gateway"
    validation_mode: "strict"  # validates exp, iss, aud on every request
  introspection:
    enabled: true
    endpoint: "${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token/introspect"
    cache_ttl_seconds: 60  # Cache result for 1 minute to reduce load
```

**Token revocation**: when a consumer is deprovisioned, revoke their tokens immediately:

```bash
# Revoke all tokens for a consumer
curl -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/revoke \
  -d "token=${CONSUMER_REFRESH_TOKEN}" \
  -d "token_type_hint=refresh_token" \
  -u "${CLIENT_ID}:${CLIENT_SECRET}"
```

**Verify**: issue a token, revoke it via Keycloak, then make a request with the revoked token — expect `401 Token revoked`.

---

## Step 10: Set Up Anomaly Alerting

The final step closes the Zero Trust loop: move from detection to alerting. Define what "normal" looks like and alert when behavior deviates.

**Key metrics to alert on**:

| Metric | Alert Condition | Suggested Threshold |
|--------|----------------|-------------------|
| `stoa_consumer_requests_total` (rate) | Sudden spike | > 3× 5-minute rolling average |
| `stoa_policy_deny_rate` (per consumer) | High deny rate | > 10% deny rate over 5 minutes |
| `stoa_guardrail_triggers_total` | Guardrail triggered | Any trigger (start with log, escalate to alert) |
| `stoa_auth_failures_total` | Auth failures | > 50 failures in 1 minute from single IP |
| `stoa_response_time_p99` | Latency spike | > 2× baseline |

**Prometheus alert example** (Grafana alerting):

```yaml
- alert: StoaHighDenyRate
  expr: rate(stoa_policy_denies_total[5m]) / rate(stoa_requests_total[5m]) > 0.1
  for: 2m
  annotations:
    summary: "High policy deny rate for consumer {{ $labels.consumer_id }}"
    description: "{{ $value | humanizePercentage }} of requests denied in the last 5 minutes"
```

**Verify**: trigger a policy deny (send a request that violates a policy) and confirm the alert fires within the configured window.

---

## Checklist Summary

| Step | Action | Priority | Estimated Time |
|------|--------|---------|---------------|
| 1 | Unique identity per consumer | Critical | 30 min |
| 2 | Short-lived tokens (15 min TTL) | Critical | 15 min |
| 3 | Least-privilege scope audit | Critical | 1 hour |
| 4 | mTLS for high-risk consumers | High | 2 hours |
| 5 | Explicit OPA policies | High | 2 hours |
| 6 | Per-consumer rate limits | High | 30 min |
| 7 | AI guardrails | Medium | 30 min |
| 8 | Immutable audit logging | Medium | 1 hour |
| 9 | Continuous token validation | Medium | 30 min |
| 10 | Anomaly alerting | Medium | 2 hours |

## Frequently Asked Questions

### Do I need to implement all 10 steps?

Steps 1-3 deliver the most immediate improvement and are the foundation everything else builds on. Steps 4-6 add significant defense-in-depth for production workloads. Steps 7-10 enable detection and response. For a minimum viable Zero Trust configuration, steps 1-6 are the baseline.

### How long does a full Zero Trust implementation take?

Steps 1-6 can realistically be completed in a day for a small deployment. Steps 7-10 require integration with your monitoring stack and take 1-2 days additional. The ongoing work is policy maintenance, certificate rotation, and alert tuning — plan for a monthly review cycle.

### Can I use this checklist for compliance documentation?

Yes. Each step maps to specific controls in NIST SP 800-207, OWASP API Security Top 10, and supports NIS2/DORA requirements. For formal compliance documentation, map each completed step to the relevant framework control and capture evidence (screenshots, configuration exports, test results).

---

*Continue the series: [Part 3 — Detecting Attacks with STOA](/blog/detecting-attacks-stoa-part-3)*

*STOA Platform is open-source (Apache 2.0). [Deploy STOA](https://docs.gostoa.dev/docs/guides/quickstart) or explore the [security reference](https://docs.gostoa.dev/docs/reference/security).*
