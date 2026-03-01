---
unlisted: true
slug: saas-playbook-5-production-checklist
title: "SaaS Production Checklist: 20 Gates Before Go-Live"
description: "Not ready until you pass all 20. Security, performance, compliance, observability, and incident response gates for multi-tenant SaaS APIs."
authors: [stoa-team]
tags: [tutorial, architecture, api-gateway]
keywords:
  - SaaS API production checklist
  - API gateway production readiness
  - go-live checklist SaaS
  - multi-tenant API production
  - SaaS launch checklist 2026
  - API security checklist production
  - STOA production deployment
---
<!-- last verified: 2026-02 -->

You have built it. You have tested it. Your team says it is ready. Before you open the doors, run through this checklist. Every item here represents a failure mode that real SaaS companies have experienced in production. Not theoretical risks — actual incidents that cost companies customers, regulatory scrutiny, or engineer weekends.

This is Part 5 (final) of the **SaaS Playbook** series. It assumes you have implemented the foundations covered in Parts [1](/blog/saas-playbook-1-multi-tenancy-101), [2](/blog/saas-playbook-2-rate-limiting-saas), [3](/blog/saas-playbook-3-audit-compliance), and [4](/blog/saas-playbook-4-scaling-multi-tenant).

<!-- truncate -->

## How to Use This Checklist

This is a binary go/no-go list. Each item is either **PASS** or **FAIL** — no partial credit. If any item is a FAIL, do not launch until it is resolved.

Some items are optional for initial launch if explicitly deferred with a documented timeline (marked **[Deferrable]**). Deferrable items must have a Linear ticket and a target date within 30 days of launch.

---

## Section 1: Security (8 Checks)

### ☐ 1. All tenant tokens expire

**Test**: Issue a token, wait for expiry, verify it is rejected.

JWT tokens must expire. There should be no mechanism to issue non-expiring tokens, even for service accounts. Service accounts should use short-lived tokens (1-24 hours) with automatic refresh.

```bash
# Verify token expiry is set on all client types
stoactl tenants list-oauth-clients --tenant acme | grep -E "accessTokenLifespan|refreshTokenLifespan"
# Expected: accessTokenLifespan < 3600 (1 hour), refreshTokenLifespan < 86400 (24 hours)
```

### ☐ 2. Cross-tenant authorization returns 401, not 404

**Test**: Request Tenant A's resource with Tenant B's token. Verify you get 401, not 404.

This is subtle but important. Returning 404 for unauthorized cross-tenant access is "security through obscurity" — it leaks that the resource exists. A 401 is the correct response regardless of whether the resource exists.

```bash
TOKEN_B=$(stoactl auth token --tenant globex)
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_B" \
  ${STOA_GATEWAY_URL}/acme/billing-api/invoices
# Expected: 401 (not 403, not 404)
```

### ☐ 3. Rate limits are enforced per tenant

**Test**: Exceed Tenant A's rate limit. Verify Tenant B's requests are unaffected.

```bash
# Flood Tenant A's endpoint until 429
for i in $(seq 1 2000); do
  curl -s -o /dev/null ${STOA_GATEWAY_URL}/acme/api/resource \
    -H "Authorization: Bearer $TOKEN_A"
done

# Verify Tenant B still gets 200
curl -s -o /dev/null -w "%{http_code}" \
  ${STOA_GATEWAY_URL}/globex/api/resource \
  -H "Authorization: Bearer $TOKEN_B"
# Expected: 200 (Tenant B unaffected)
```

### ☐ 4. Secrets are not in environment variables or configuration files

**Test**: `grep -r "password\|secret\|key" k8s/ --include="*.yaml" | grep -v "secretRef\|secretKeyRef\|valueFrom"`

All secrets must reference Kubernetes Secrets or your secret management system (Infisical, Vault, AWS Secrets Manager). No plaintext secrets in:
- Helm values files (even `values-prod.yaml`)
- Kubernetes manifests committed to git
- Docker images (`docker inspect` should reveal no secrets)
- Application configuration files

### ☐ 5. TLS is enforced on all public endpoints

**Test**: Attempt HTTP connection to each public endpoint. Verify redirect to HTTPS or outright rejection.

```bash
# Test HTTP rejection
curl -v http://${STOA_GATEWAY_URL}/mcp/health
# Expected: 301 redirect to HTTPS or connection refused
```

All tenant-facing endpoints must be HTTPS-only. Internal service-to-service communication within the cluster should also use TLS (mTLS for zero-trust deployments).

### ☐ 6. PII detection is enabled and tested

**Test**: Send a request containing a credit card number to a non-financial API. Verify the request is blocked or redacted.

```bash
curl -X POST ${STOA_GATEWAY_URL}/acme/api/notes \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"content": "My card is 4111111111111111, expiry 01/28"}'
# Expected: 400 (blocked) or 200 with PII redacted in audit log
```

### ☐ 7. Dependency audit is clean

**Test**: Run `npm audit --audit-level=high` and `cargo audit` (or equivalent for your stack). Zero high/critical CVEs in production dependencies.

```bash
# For Node.js dependencies
cd control-plane-ui && npm audit --audit-level=high

# For Rust dependencies
cd stoa-gateway && cargo audit --deny warnings
```

**Not deferrable**: Known high/critical vulnerabilities in production must be resolved before launch.

### ☐ 8. API keys are rotatable without downtime

**Test**: Issue an API key, use it to make a successful request, rotate the key, verify old key is rejected, verify new key works, verify the rotation happened without service interruption.

```bash
stoactl apikeys rotate --tenant acme --key-name production-integration
# Should return new key without invalidating mid-flight requests
```

---

## Section 2: Reliability (4 Checks)

### ☐ 9. Health checks are configured and tested

**Test**: Delete a gateway pod. Verify Kubernetes routes around it within 30 seconds.

```bash
# Delete one of N gateway pods
kubectl delete pod -n stoa-system -l app=stoa-gateway --field-selector=metadata.name=stoa-gateway-0

# Verify service continues responding within 30 seconds
watch -n 1 'curl -s -o /dev/null -w "%{http_code}" ${STOA_GATEWAY_URL}/health'
# Expected: 200 continuously, brief 503 (< 10 seconds) during pod restart
```

Both readiness and liveness probes must be configured. Readiness probe prevents traffic from routing to pods that are not ready (e.g., still loading tenant configuration). Liveness probe kills and restarts pods that are hung.

### ☐ 10. Graceful shutdown is implemented

**Test**: Send SIGTERM to the gateway process. Verify in-flight requests complete before the process exits.

The gateway must:
1. Stop accepting new connections on SIGTERM
2. Wait for in-flight requests to complete (up to 30 seconds)
3. Then exit with code 0

```yaml
# Kubernetes lifecycle hook for graceful shutdown
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]  # Allow time for k8s to update endpoints
terminationGracePeriodSeconds: 35            # 5s preStop + 30s for in-flight requests
```

### ☐ 11. Upstream timeouts are configured

**Test**: Artificially delay a backend API response beyond the timeout threshold. Verify the gateway returns 504, not a hung connection.

```yaml
spec:
  apis:
    - name: billing-api
      upstream: https://billing.acme.internal/v1
      timeouts:
        connect: 5s
        request: 30s       # Gateway returns 504 if backend doesn't respond in 30s
        idle: 60s
```

Never leave timeouts at defaults (often unlimited). An upstream that is slow will cause gateway resources to be held indefinitely, eventually causing a cascade failure.

### ☐ 12. Circuit breaker is configured for upstream failures **[Deferrable]**

**Test**: Take a backend offline. Verify the gateway stops sending traffic to it after N failures, returns 503 with a `Retry-After` header, and resumes sending traffic when the backend recovers.

```yaml
spec:
  apis:
    - name: billing-api
      circuitBreaker:
        enabled: true
        failureThreshold: 5      # Open after 5 failures in 60 seconds
        timeout: 30s             # Try again after 30 seconds
        halfOpenRequests: 2      # Send 2 test requests in half-open state
```

---

## Section 3: Observability (4 Checks)

### ☐ 13. Error rate alerting is configured

**Test**: Trigger HTTP 500 errors. Verify an alert fires within 5 minutes.

```yaml
# Prometheus alerting rule
groups:
  - name: api-gateway
    rules:
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(stoa_http_requests_total{status=~"5.."}[5m])) /
            sum(rate(stoa_http_requests_total[5m]))
          ) > 0.01
        for: 2m
        labels:
          severity: page
        annotations:
          summary: "API Gateway error rate > 1% for 2 minutes"
```

Alert on error rate, not just error count. A spike in errors is significant even if total volume is low.

### ☐ 14. Per-tenant dashboards are available

**Test**: Open the Grafana dashboard. Verify you can see request volume, error rate, latency P50/P99, and rate limit utilization for any individual tenant within 2 minutes.

When a tenant contacts support claiming their API is slow, you need to see their metrics within 2 minutes, not 2 hours. Build tenant-scoped dashboards before launch, not after the first support ticket arrives.

### ☐ 15. Audit logs are verified and queryable

**Test**: Make 10 API calls as a specific user. Query the audit log for those events. Verify all 10 appear within 30 seconds.

```bash
# Make test calls
for i in $(seq 1 10); do
  curl -s ${STOA_GATEWAY_URL}/acme/api/resource \
    -H "Authorization: Bearer $TOKEN_A"
done

# Query audit log
stoactl tenants audit query --tenant acme --actor alice@acme.example.com --from -5m
# Expected: 10 entries, all within last 5 minutes
```

If audit events are delayed by more than 30 seconds, investigate the audit pipeline before launch.

### ☐ 16. On-call runbook is written and accessible

**Test**: Ask a non-author engineer to find the runbook and describe the steps for restarting the gateway without downtime.

Your runbook must be accessible from your on-call platform (PagerDuty, OpsGenie, etc.) and must cover:
- How to restart the gateway without downtime
- How to roll back a bad configuration change
- How to investigate a tenant-reported incident
- What to do when the database is unreachable
- Escalation contacts and their time zones

---

## Section 4: Compliance (2 Checks)

### ☐ 17. Audit log retention policy is documented and enforced

**Test**: Verify the retention configuration in your UAC matches your documented policy. Query an event that is 91 days old — verify it exists (or is in warm storage) if your policy is 90+ days.

Your privacy policy must state the retention period. Your technical implementation must enforce it. They must match.

### ☐ 18. GDPR data subject request process is documented and tested

**Test**: Submit a test DSAR for a test user. Execute the DSAR export procedure. Verify the export completes within 72 hours (regulatory requirement is 30 days, but test that your process is faster than that).

```bash
stoactl tenants dsar export \
  --tenant test-tenant \
  --email test-user@test.example.com \
  --from 2025-01-01 \
  --to 2026-01-01 \
  --output dsar-test-export.json

# Verify the export is complete and human-readable
wc -l dsar-test-export.json
jq '.events | length' dsar-test-export.json
```

---

## Section 5: Operations (2 Checks)

### ☐ 19. Rollback procedure is documented and tested

**Test**: Deploy a breaking configuration change. Execute the rollback procedure. Verify service is restored within 10 minutes.

For Kubernetes deployments, rollback is:
```bash
kubectl rollout undo deployment/stoa-gateway -n stoa-system
kubectl rollout status deployment/stoa-gateway -n stoa-system
```

For configuration changes (UAC updates, policy changes), verify that reverting the UAC YAML and applying it restores previous behavior.

### ☐ 20. Launch day checklist is prepared

Before go-live, have a real-time monitoring view ready that shows:
- Request rate (expected vs actual)
- Error rate (target < 0.1%)
- P99 latency (target < 500ms for your primary APIs)
- Rate limit hit rate (should be < 1% for a healthy launch)
- Active tenant count

Have a designated "launch captain" who owns the dashboard for the first 4 hours. Have a rollback decision criterion defined in advance: "If error rate exceeds 5% for 5 consecutive minutes, we roll back."

---

## The Final Gate

Before marking any item as PASS, test it. Do not accept "we think it works" — verify it.

| Section | Items | Required to Pass |
|---|---|---|
| Security | 8 | All 8 (no deferrals) |
| Reliability | 4 | 3 of 4 (circuit breaker is deferrable) |
| Observability | 4 | All 4 (no deferrals) |
| Compliance | 2 | Both (required for GDPR) |
| Operations | 2 | Both (no deferrals) |

If you have 20/20, ship it.

If you have a deferral, document it:
- What is deferred?
- When will it be done? (must be within 30 days)
- Who owns it? (must be a named engineer)
- What is the risk if the deferral takes longer than 30 days?

A deferral is an informed risk decision, not avoidance. Make the decision consciously, with a named owner and a date.

---

## Completing the Series

Congratulations on making it through the SaaS Playbook:

1. [Part 1: Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101) — Isolating your tenants
2. [Part 2: Rate Limiting Strategies](/blog/saas-playbook-2-rate-limiting-saas) — Per-tenant quotas and burst handling
3. [Part 3: Audit & Compliance](/blog/saas-playbook-3-audit-compliance) — Immutable logs and GDPR readiness
4. [Part 4: Scaling Multi-Tenant APIs](/blog/saas-playbook-4-scaling-multi-tenant) — From 50 to 5000 tenants
5. **Part 5: Production Checklist** — This article
6. [Build vs Buy: API Gateway Cost Analysis](/blog/saas-playbook-build-vs-buy-api-gateway) — TCO analysis for your decision

For decision support on which API gateway to use for your SaaS: [SMB API Gateway Buying Guide 2026](/blog/smb-api-gateway-buying-guide-2026).

To get started immediately: [STOA Docker Compose Quickstart](/blog/mcp-gateway-quickstart-docker).

## FAQ

### How often should I run this checklist after launch?

Run the security section (checks 1-8) quarterly or after any significant infrastructure change. Run the full checklist before any major feature launch that changes authentication, authorization, or API routing. Security checks 1, 2, 3, and 5 should be part of your continuous integration test suite — not just a pre-launch gate.

### What if we fail a non-deferrable check close to launch?

Delay the launch. This is the correct decision. Every item on this list represents a known failure mode. Launching with a known security gap or observability hole will not speed up your product's success — it will create a crisis at the worst possible time.

### Is this checklist sufficient for SOC 2 readiness?

No. SOC 2 Type II requires a 6-12 month observation period and covers a much broader scope than this checklist (HR controls, physical security, vendor management, etc.). This checklist ensures your API infrastructure is a strong foundation for SOC 2. Use a dedicated SOC 2 readiness assessment (there are tools like Vanta, Drata, or Tugboat Logic) for the full picture.

### Do I need all 4 series articles before running this checklist?

Not necessarily. If you are using a different gateway (not STOA), many of the implementation details are different but the checklist items are universal. The checklist is gateway-agnostic by design — it covers what must be true, not how to achieve it with a specific product.

### How long does this checklist take to complete?

Allocate 1-2 full engineering days for the first run. Security checks often require infrastructure changes that take hours to implement and verify. After the first run, subsequent checks (before major releases) typically take 2-4 hours if no regressions are found.
