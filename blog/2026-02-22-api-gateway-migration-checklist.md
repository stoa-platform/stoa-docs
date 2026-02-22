---
slug: api-gateway-migration-checklist
title: "API Gateway Migration Checklist: 15 Steps to Zero-Downtime Transition (2026)"
description: "Complete API gateway migration checklist with 15 steps. Covers inventory, testing, traffic shifting, rollback, and post-migration validation."
authors: [stoa-team]
tags: [tutorial, migration, api-gateway]
keywords:
  - api gateway migration checklist 2026
  - api gateway migration steps
  - zero downtime api migration
  - api gateway migration planning
  - api gateway replacement guide
---
<!-- last verified: 2026-02 -->

Migrating an API gateway is one of the most critical infrastructure changes an organization can make. Done poorly, it causes downtime, broken integrations, and security gaps. Done right, it's invisible to consumers while unlocking new capabilities.

This 15-step checklist ensures zero downtime and zero data loss during your API gateway migration, whether you're moving from webMethods, Kong, Apigee, DataPower, MuleSoft, Oracle OAM, or any other platform.

<!-- truncate -->

## Why a Checklist Matters

API gateway migrations fail for predictable reasons:

- **Incomplete inventory** — Forgotten APIs that break after cutover
- **Untested policies** — Authentication works in staging, fails in production
- **Consumer surprises** — Changed endpoints or auth patterns discovered too late
- **No rollback plan** — Traffic shifted to the new gateway with no way back
- **Premature decommissioning** — Old gateway deleted before verification period ends

A systematic checklist eliminates these failure modes. Use this as a living document: check off steps as you complete them, add notes specific to your environment, and track blockers in real time.

---

## The 15-Step Migration Checklist

This checklist assumes the **augment-first strategy**: deploy the new gateway alongside the existing one, validate in shadow mode, then shift traffic gradually. For the strategic rationale behind this approach, see the [API Gateway Migration Guide 2026](/blog/api-gateway-migration-guide-2026).

---

## Phase 1: Discovery & Planning

The foundation of a successful migration is knowing exactly what you have. Incomplete discovery accounts for 60% of migration failures.

### Step 1: Create a Complete API Inventory

**Objective:** Document every API, endpoint, consumer, and traffic pattern in your production environment.

**Deliverables:**
- Spreadsheet or database with columns: API name, base path, protocol (REST/SOAP/GraphQL/gRPC), authentication method, average requests/second, peak requests/second, number of consumers, owning team, critical/non-critical classification
- For each API: list of endpoints (paths + HTTP methods)
- Traffic volume analysis from the last 30 days

**How to gather:**
- Legacy gateway logs or analytics dashboard (extract traffic stats)
- Developer portal or API catalog (if available)
- Source code repository analysis (`grep -r "api.example.com"`)
- Interview application teams (often know about undocumented APIs)

**Watch for:**
- Shadow IT APIs (APIs not registered in the gateway but called directly)
- Deprecated APIs with residual traffic (0.01% of calls might be a critical B2B integration)
- Weekend-only or batch processing APIs (won't show up in weekday traffic analysis)

**Status:** ☐ Complete inventory created
**Notes:** _____________________________________________________

---

### Step 2: Create a Policy Inventory

**Objective:** Document every security, rate limiting, transformation, and routing policy applied to your APIs.

**Deliverables:**
- Spreadsheet with columns: API name, policy type (auth/rate-limit/CORS/transform/routing), policy configuration, dependencies (external systems, secrets, certificates)
- Authentication details: OAuth2 provider, API key storage, mTLS certificate authority, SAML IdP
- Rate limit tiers: per-consumer quotas, burst limits, time windows
- Custom logic: request/response transformations, header manipulation, validation rules

**How to gather:**
- Export gateway configuration (Kong declarative config, webMethods API definitions, Apigee proxy bundles)
- For proprietary formats: screenshot policy screens and manually document
- Test each API with different consumer identities to validate policy behavior

**Watch for:**
- Implicit policies (applied at global level, not visible in per-API config)
- Chained policies (policy A depends on output from policy B)
- External dependencies (policy calls out to PDP, fraud detection service, legacy LDAP)

**Status:** ☐ Complete policy inventory created
**Notes:** _____________________________________________________

---

### Step 3: Map Integration Points

**Objective:** Identify every system that integrates with your API gateway (upstream, downstream, and sidecar services).

**Deliverables:**
- Network diagram showing: consumer applications → gateway → upstream services
- DNS records for gateway hostnames
- Load balancer configuration (if gateway sits behind one)
- Certificate details (TLS termination point, mTLS requirements)
- Monitoring and logging integrations (where metrics and logs flow)
- Identity provider integration (Keycloak, Okta, Azure AD, custom LDAP)

**How to gather:**
- Review firewall rules (what IPs can reach the gateway)
- Check DNS records (`dig api.example.com`)
- Interview network and security teams
- Review monitoring dashboard configuration (Prometheus scrape targets, log forwarding rules)

**Watch for:**
- Hardcoded IP addresses in consumer apps (these break after migration)
- Pinned TLS certificates (consumers that validate certificate thumbprint, not just chain)
- IP-based rate limiting or allowlisting (will break if gateway IP changes)

**Status:** ☐ Complete integration map created
**Notes:** _____________________________________________________

---

### Step 4: Define Success Criteria

**Objective:** Establish measurable targets for latency, error rates, and business continuity during and after migration.

**Deliverables:**
- Baseline metrics from existing gateway (current performance levels)
- Target metrics for new gateway (acceptable ranges)
- Rollback triggers (conditions that force immediate rollback to old gateway)
- Business continuity requirements (maximum acceptable downtime, data loss tolerance)

**Baseline metrics to capture:**
- P50, P95, P99 latency (milliseconds)
- Error rate by HTTP status code (4xx vs 5xx)
- Throughput (requests/second sustained and peak)
- Time to first byte (TTFB) for representative APIs
- Consumer authentication success rate

**Sample success criteria:**
| Metric | Current (Baseline) | Target (New Gateway) | Rollback Trigger |
|--------|------------------|---------------------|----------------|
| P95 latency | 85ms | &lt;100ms | &gt;200ms sustained for 5 min |
| 5xx error rate | 0.02% | &lt;0.05% | &gt;0.2% sustained for 5 min |
| Auth success rate | 99.97% | &gt;99.95% | &lt;99.5% |
| Throughput | 12,000 req/s | ≥12,000 req/s | &lt;10,000 req/s |

**Status:** ☐ Success criteria defined and approved
**Notes:** _____________________________________________________

---

## Phase 2: Parallel Setup

This phase deploys the new gateway alongside your existing one. The new gateway receives no production traffic yet — only synthetic test traffic and shadow traffic (request copies).

### Step 5: Deploy Target Gateway in Shadow Mode

**Objective:** Install and configure the new API gateway in your production environment without routing any live traffic to it.

**Deliverables:**
- New gateway deployed in production cluster/VMs
- Network connectivity verified (can reach upstream services)
- Observability configured (Prometheus metrics, log forwarding)
- Shadow traffic replication enabled (mirror production requests to new gateway, discard responses)

**How to deploy:**
- Use infrastructure-as-code (Terraform, Helm charts, Ansible)
- Deploy to the same Kubernetes cluster or network zone as the legacy gateway
- Configure DNS for the new gateway hostname (e.g., `api-v2.example.com`) but don't publish it yet
- Set up mirroring: configure your load balancer or service mesh to duplicate requests to the new gateway

**Watch for:**
- Resource contention (new gateway competing for CPU/RAM with legacy gateway)
- Firewall rules blocking new gateway → upstream service communication
- Certificate validation failures (new gateway presents different TLS cert)

**Verification:**
```bash
# Check new gateway is running
kubectl get pods -n gateway-system -l app=stoa-gateway

# Send synthetic traffic
curl -H "Authorization: Bearer test-token" https://api-v2.example.com/health

# Verify shadow traffic is being received (check new gateway logs)
kubectl logs -n gateway-system deployment/stoa-gateway --tail=100 | grep "GET /api/v1"
```

**Status:** ☐ New gateway deployed and receiving shadow traffic
**Notes:** _____________________________________________________

---

### Step 6: Import API Configurations

**Objective:** Recreate all APIs from your legacy gateway in the new gateway, using declarative configuration where possible.

**Deliverables:**
- All APIs from Step 1 inventory configured in the new gateway
- OpenAPI/Swagger definitions imported (if supported)
- Routes, upstream targets, and health checks configured

**How to import:**
- **Option 1 (best):** Export OpenAPI specs from legacy gateway, import into new gateway
- **Option 2:** Use migration scripts to convert proprietary config (e.g., Kong declarative YAML → STOA UAC)
- **Option 3:** Manual recreation (tedious but ensures clean config)

**Platform-specific guidance:**
- [webMethods migration](/blog/webmethods-migration-guide) — export from Integration Server, convert Flow to REST
- [Kong migration](/docs/guides/migration/kong) — `deck dump` to export declarative config
- [Apigee migration](/blog/apigee-alternative-open-source) — export proxy bundles, translate JavaScript policies
- [DataPower/TIBCO migration](/blog/datapower-tibco-migration-guide) — manual export, SOAP-to-REST bridging

**Watch for:**
- Missing path parameters or query parameter validation
- Case-sensitive path matching differences (Kong vs. nginx)
- Trailing slash handling (`/api/users` vs. `/api/users/`)

**Verification:**
```bash
# List APIs in new gateway
curl https://api-v2.example.com/v1/apis -H "Authorization: Bearer admin-token"

# Compare counts
echo "Legacy gateway: $(wc -l < legacy_api_list.txt) APIs"
echo "New gateway: $(wc -l < new_api_list.txt) APIs"
```

**Status:** ☐ All APIs configured in new gateway
**Notes:** _____________________________________________________

---

### Step 7: Replicate Security Policies

**Objective:** Apply authentication, rate limiting, CORS, and other security policies from Step 2 inventory to the new gateway.

**Deliverables:**
- All policies from Step 2 inventory configured in the new gateway
- Authentication integration tested (OAuth2, API keys, mTLS)
- Rate limiting tiers replicated (same quotas as legacy gateway)
- CORS policies applied (same allowed origins and headers)

**How to replicate:**
- For standard policies (OAuth2, API keys), use built-in new gateway features
- For custom logic (request validation, transformation), reimplement using new gateway's policy language or plugins
- Connect new gateway to same identity provider as legacy gateway (Keycloak, Okta, Azure AD)

**Watch for:**
- OAuth2 token validation endpoint differences (some gateways cache introspection results, others don't)
- Rate limit key differences (consumer ID vs. IP address vs. API key)
- CORS preflight handling (OPTIONS request behavior)

**Verification:**
```bash
# Test authentication (should return 401 without valid token)
curl https://api-v2.example.com/api/v1/protected

# Test authentication (should return 200 with valid token)
curl -H "Authorization: Bearer $VALID_TOKEN" https://api-v2.example.com/api/v1/protected

# Test rate limiting (send 100 requests rapidly)
for i in {1..100}; do curl -H "Authorization: Bearer $VALID_TOKEN" https://api-v2.example.com/api/v1/test; done

# Verify CORS headers
curl -X OPTIONS -H "Origin: https://app.example.com" https://api-v2.example.com/api/v1/test -i
```

**Status:** ☐ All security policies replicated and tested
**Notes:** _____________________________________________________

---

### Step 8: Run Synthetic Traffic Tests

**Objective:** Validate the new gateway under realistic load before routing any production traffic to it.

**Deliverables:**
- Synthetic test suite covering all APIs from Step 1 inventory
- Load test results showing new gateway handles expected throughput
- Comparison report: new gateway vs. legacy gateway performance

**How to test:**
- Create test scripts using tools like k6, Locust, JMeter, or Postman collections
- Replay production traffic patterns (request rate, endpoint distribution, authentication methods)
- Run tests against both legacy and new gateways simultaneously for comparison

**Sample k6 test:**
```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

export default function () {
  let response = http.get('https://api-v2.example.com/api/v1/users', {
    headers: { 'Authorization': 'Bearer test-token' },
  });
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

**Watch for:**
- Memory leaks (memory usage grows over sustained load)
- Connection pool exhaustion (new gateway can't keep up with connection rate)
- Upstream service impact (new gateway's connection behavior differs from legacy)

**Verification criteria:**
- P95 latency within target from Step 4
- Error rate below threshold
- No resource exhaustion (CPU/RAM/file descriptors stay below 80%)

**Status:** ☐ Synthetic tests passing, performance within targets
**Notes:** _____________________________________________________

---

## Phase 3: Traffic Migration

This is the high-risk phase. You're now routing production traffic through the new gateway. Start small (1%), validate thoroughly, then scale gradually.

### Step 9: Canary Routing (1% → 10% → 50% → 100%)

**Objective:** Shift production traffic to the new gateway incrementally, validating at each step.

**Deliverables:**
- Traffic routing rule configured (DNS, load balancer, or service mesh)
- Canary progression plan with dwell times and validation criteria
- Real-time monitoring dashboard showing old vs. new gateway metrics

**How to route:**
- **Option 1 (DNS weighted routing):** Create two DNS A records with different weights (99% to old IP, 1% to new IP). Not all DNS providers support weights; clients may cache aggressively.
- **Option 2 (load balancer split):** Configure your load balancer to route X% to old gateway, (100-X)% to new gateway. Best option for fine-grained control.
- **Option 3 (service mesh canary):** Use Istio, Linkerd, or Consul to split traffic at L7. Most flexible but requires service mesh infrastructure.
- **Option 4 (multi-gateway orchestration):** Use STOA's [multi-gateway adapter](/docs/guides/multi-gateway-setup) to route traffic through both gateways from a single control plane.

**Canary progression schedule:**
| Step | Traffic % to New Gateway | Dwell Time | Validation Criteria |
|------|------------------------|----------|-------------------|
| 1    | 1%                     | 30 min   | Error rate < 0.1%, P95 latency within target |
| 2    | 5%                     | 2 hours  | No increase in consumer-reported errors |
| 3    | 10%                    | 4 hours  | Sustained load validation |
| 4    | 25%                    | 8 hours  | Include peak traffic period |
| 5    | 50%                    | 24 hours | Majority traffic validation |
| 6    | 75%                    | 24 hours | Legacy becomes backup |
| 7    | 100%                   | 1 week   | Full cutover, legacy on standby |

**Watch for:**
- Sudden error rate spikes at any canary step (rollback immediately)
- Consumer-reported issues that don't show up in gateway metrics (check application error logs)
- Traffic distribution skew (verify canary % matches actual traffic observed)

**Rollback procedure:**
```bash
# Load balancer rollback (example with nginx)
# Change upstream weight back to 100% old gateway
kubectl edit configmap nginx-config -n ingress-nginx
# Set: old_gateway weight=100, new_gateway weight=0
# Reload nginx
kubectl rollout restart deployment nginx-ingress-controller -n ingress-nginx
```

**Status:** ☐ Canary routing in progress (currently at ___%)
**Notes:** _____________________________________________________

---

### Step 10: Monitor Error Rates and Latency at Each Step

**Objective:** Detect regressions immediately during canary rollout, before they impact all users.

**Deliverables:**
- Real-time dashboard showing: error rate (4xx, 5xx), P50/P95/P99 latency, throughput, authentication success rate
- Alerts configured for: error rate threshold breached, latency threshold breached, traffic imbalance detected
- Runbook for on-call engineer: what to check, how to rollback

**How to monitor:**
- Use Prometheus + Grafana (recommended) or your existing observability stack
- Create a dedicated "Migration Status" dashboard with side-by-side comparison (old gateway vs. new gateway)
- Set up alerts that trigger within 60 seconds of anomaly detection

**Sample Prometheus queries:**
```promql
# Error rate (per gateway)
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# P95 latency (per gateway)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Throughput (requests per second)
rate(http_requests_total[1m])
```

**Sample alert rules:**
```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5..",gateway="new"}[5m]) > 0.01
  for: 2m
  annotations:
    summary: "New gateway error rate exceeded 1%"

- alert: LatencyRegression
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{gateway="new"}[5m])) > 0.2
  for: 5m
  annotations:
    summary: "New gateway P95 latency exceeded 200ms"
```

**Watch for:**
- Bimodal latency distribution (some requests fast, some very slow — indicates upstream connection pooling issues)
- 4xx error rate changes (might indicate authentication or authorization policy differences)
- Non-HTTP errors (connection refused, DNS resolution failures)

**Status:** ☐ Monitoring configured and alerts validated
**Notes:** _____________________________________________________

---

### Step 11: Consumer Notification and Testing Window

**Objective:** Give API consumers advance notice of the migration and a dedicated window to test against the new gateway.

**Deliverables:**
- Email or portal announcement sent to all consumers from Step 1 inventory
- Test endpoint published (`api-v2.example.com`) for consumers to validate their integrations
- Support channel (Slack, ticketing system) for consumers to report issues
- Migration FAQ document addressing common questions

**How to notify:**
- Send email 2 weeks before canary rollout begins
- Publish blog post or changelog entry with migration timeline
- Update developer portal with banner notification
- Provide test credentials or sandbox environment for consumers to validate

**Sample notification content:**
```
Subject: Action Required: API Gateway Migration Testing Window

We're upgrading our API gateway infrastructure to improve performance,
security, and AI agent support. This migration is transparent to most
consumers, but we recommend testing your integration.

Timeline:
- Feb 10-17: Test endpoint available (api-v2.example.com)
- Feb 18: Canary rollout begins (1% → 100% over 7 days)
- Feb 25: Full cutover (100% traffic on new gateway)

What you need to do:
1. Test your app against https://api-v2.example.com
2. Report any issues to api-support@example.com

No changes to:
- Authentication (same OAuth2 provider and API keys)
- Rate limits (same quotas and tiers)
- Response schemas (same JSON structure)

FAQ: https://docs.example.com/migration-faq
```

**Watch for:**
- Consumers using deprecated features (discover these during test window, not after cutover)
- Consumers with hardcoded URLs (remind them to use DNS names, not IP addresses)
- Consumers with aggressive caching (remind them TTL changes may affect behavior)

**Status:** ☐ Consumers notified and test window provided
**Notes:** _____________________________________________________

---

### Step 12: DNS Cutover

**Objective:** Shift the production DNS hostname (`api.example.com`) to point to the new gateway.

**Deliverables:**
- DNS TTL reduced to 60 seconds (at least 24 hours before cutover)
- DNS A record updated to new gateway IP address
- Verification that all global DNS resolvers propagate within 5 minutes

**How to execute:**
```bash
# Step 1: Lower TTL (do this 24-48 hours before cutover)
# In your DNS provider (Cloudflare, Route 53, etc.)
api.example.com   A   300s   192.0.2.100   # Old gateway IP

# Change TTL to 60s
api.example.com   A   60s   192.0.2.100

# Step 2: Wait for old TTL to expire (at least 300 seconds)

# Step 3: Update A record to new gateway IP
api.example.com   A   60s   192.0.2.200   # New gateway IP

# Step 4: Verify propagation
dig api.example.com @8.8.8.8
dig api.example.com @1.1.1.1
```

**Watch for:**
- DNS caching by consumer applications (Java apps often cache DNS forever — requires JVM restart)
- Split-brain DNS (some resolvers still returning old IP after cutover)
- TLS certificate mismatch (new gateway must present cert for `api.example.com`)

**Rollback procedure:**
```bash
# Update A record back to old gateway IP
api.example.com   A   60s   192.0.2.100

# Wait 60 seconds for propagation
# Verify traffic returns to old gateway
```

**Status:** ☐ DNS cutover completed successfully
**Notes:** _____________________________________________________

---

## Phase 4: Validation & Cleanup

The new gateway is now handling 100% of production traffic. This phase ensures stability before decommissioning the old gateway.

### Step 13: Post-Migration Validation

**Objective:** Verify all APIs, consumers, and integrations are functioning correctly on the new gateway.

**Deliverables:**
- Validation report covering: all APIs responding, authentication working, rate limits enforced, CORS policies active
- Consumer feedback collected (via support tickets, Slack, or direct outreach)
- Error log analysis (check for new error patterns not seen during canary)

**How to validate:**
- Run the same synthetic test suite from Step 8 against the production hostname
- Check consumer success metrics (application error logs, support ticket volume)
- Manually test critical APIs with different authentication methods
- Verify monitoring and logging integrations still work

**Validation checklist:**
- ☐ All APIs from Step 1 inventory return 200/201 responses
- ☐ Authentication succeeds for all supported methods (OAuth2, API keys, mTLS)
- ☐ Rate limiting triggers correctly (test with burst traffic)
- ☐ CORS preflight requests return correct headers
- ☐ Upstream services receive requests as expected
- ☐ Metrics flowing to Prometheus
- ☐ Logs flowing to centralized logging system
- ☐ Zero increase in consumer-reported errors

**Watch for:**
- Long-tail issues (rare edge cases that only appear after 24-48 hours)
- B2B partner integrations (often test less frequently, may not discover issues for days)
- Batch processing jobs (may run weekly or monthly)

**Status:** ☐ Post-migration validation completed, all checks passed
**Notes:** _____________________________________________________

---

### Step 14: Monitoring Stabilization (24-Hour Observation Window)

**Objective:** Confirm the new gateway performs within targets over a sustained period, including peak traffic hours.

**Deliverables:**
- 24-hour performance report comparing new gateway to baseline from Step 4
- Incident log (any alerts triggered, issues discovered, mitigations applied)
- Stakeholder sign-off that migration is considered successful

**How to observe:**
- Monitor the dashboard from Step 10 continuously for 24 hours
- Ensure observation window includes peak traffic period (e.g., business hours, end-of-month batch processing)
- Document any deviations from baseline and confirm they're acceptable

**Sample observation report:**
| Metric | Baseline (Old Gateway) | Actual (New Gateway) | Status |
|--------|----------------------|-------------------|--------|
| P95 latency | 85ms | 72ms | ✅ Improved |
| 5xx error rate | 0.02% | 0.01% | ✅ Improved |
| Auth success | 99.97% | 99.98% | ✅ Maintained |
| Throughput | 12,000 req/s | 12,500 req/s | ✅ Maintained |

**Watch for:**
- Performance degradation over time (memory leak, connection pool growth)
- Daily or weekly traffic patterns that weren't present during canary (e.g., Monday morning spike)
- External dependency changes (upstream service deploys, database performance shifts)

**Status:** ☐ 24-hour observation complete, stakeholder sign-off obtained
**Notes:** _____________________________________________________

---

### Step 15: Decommission Old Gateway

**Objective:** Safely remove the legacy gateway from production, preserving configuration for audit and rollback.

**Deliverables:**
- Legacy gateway configuration exported and archived in Git
- Legacy gateway pods/VMs shut down (not deleted yet)
- DNS TTL restored to normal value (e.g., 300s or 3600s)
- Monitoring and alerting for legacy gateway disabled
- Documentation updated (runbooks, architecture diagrams)

**How to decommission:**
```bash
# Step 1: Archive configuration
kubectl get deployment legacy-gateway -n gateway-system -o yaml > legacy-gateway-backup.yaml
# For webMethods, DataPower, etc.: export from management console

# Step 2: Reduce to zero replicas (keep resources, just stop pods)
kubectl scale deployment legacy-gateway -n gateway-system --replicas=0

# Step 3: Wait 2 weeks (cold standby period)

# Step 4: Delete resources
kubectl delete deployment legacy-gateway -n gateway-system
kubectl delete service legacy-gateway -n gateway-system

# Step 5: Restore normal DNS TTL
# In your DNS provider
api.example.com   A   3600s   192.0.2.200
```

**Watch for:**
- Hidden dependencies (some obscure integration still pointing to old gateway)
- Compliance requirements (retain logs from old gateway for N months)
- License de-provisioning (cancel commercial licenses, reclaim resources)

**What to keep:**
- Configuration backups (YAML, JSON, declarative config)
- Migration scripts and runbooks (for future migrations or rollbacks)
- Performance baseline metrics (for future comparison)
- Lessons learned documentation (what went well, what didn't)

**Status:** ☐ Old gateway decommissioned, resources reclaimed
**Notes:** _____________________________________________________

---

## Printable Checklist

Use this condensed version for progress tracking:

| Step | Phase | Task | Status | Notes |
|------|-------|------|--------|-------|
| 1 | Discovery | Create complete API inventory | ☐ | |
| 2 | Discovery | Create policy inventory | ☐ | |
| 3 | Discovery | Map integration points | ☐ | |
| 4 | Discovery | Define success criteria | ☐ | |
| 5 | Setup | Deploy new gateway (shadow mode) | ☐ | |
| 6 | Setup | Import API configurations | ☐ | |
| 7 | Setup | Replicate security policies | ☐ | |
| 8 | Setup | Run synthetic traffic tests | ☐ | |
| 9 | Migration | Canary routing (1% → 100%) | ☐ | Currently: ___% |
| 10 | Migration | Monitor error rates and latency | ☐ | |
| 11 | Migration | Consumer notification | ☐ | |
| 12 | Migration | DNS cutover | ☐ | |
| 13 | Validation | Post-migration validation | ☐ | |
| 14 | Validation | 24-hour observation window | ☐ | |
| 15 | Cleanup | Decommission old gateway | ☐ | |

---

## Platform-Specific Migration Guides

This checklist is vendor-agnostic, but each legacy platform has unique migration challenges. For detailed, hands-on guidance:

- [webMethods Migration Guide](/blog/webmethods-migration-guide) — Software AG Integration Server, Flow mediation, ESB patterns
- [Kong Migration Guide](/docs/guides/migration/kong) — Kong OSS/Enterprise, declarative config export, plugin translation
- [Apigee Migration Guide](/blog/apigee-alternative-open-source) — Google Apigee, proxy bundles, JavaScript policies
- [DataPower & TIBCO Migration Guide](/blog/datapower-tibco-migration-guide) — IBM DataPower, TIBCO Gateway, SOAP-to-REST bridging
- [Oracle OAM Migration Guide](/docs/guides/migration/oracle-oam) — Oracle Access Manager, WebGate replacement, identity federation
- [MuleSoft Migration Guide](/blog/mulesoft-migration-open-source-gateway) — MuleSoft Anypoint, DataWeave transformations, Salesforce decoupling
- [Axway Migration Guide](/blog/axway-api-gateway-migration-open-source) — Axway API Gateway, Policy Studio export
- [WSO2 Migration Guide](/blog/wso2-api-manager-open-source-alternative) — WSO2 API Manager, Synapse mediation migration

For a strategic overview of why organizations migrate and how to choose a target platform, see the [API Gateway Migration Guide 2026](/blog/api-gateway-migration-guide-2026).

---

## Frequently Asked Questions

### How long should each canary step dwell before increasing traffic?

Dwell time depends on traffic volume and API criticality. For high-traffic APIs (>1000 req/s), 30 minutes at 1% is sufficient to detect issues. For medium-traffic APIs (100-1000 req/s), wait 2-4 hours. For low-traffic APIs (&lt;100 req/s), you may need 24 hours to accumulate enough data. Always include at least one peak traffic period (e.g., business hours) before moving to 100%. The canary schedule in Step 9 provides a conservative baseline.

### What if the new gateway performs worse than the old one?

First, verify it's not a configuration issue: check connection pool sizes, timeout settings, keepalive configuration. Second, run the load test from Step 8 in isolation (no other traffic) to eliminate noisy neighbor effects. Third, profile the new gateway under load (CPU flamegraphs, memory allocation). If performance is fundamentally worse, consider: (a) scaling up the new gateway (more pods/VMs), (b) deferring non-critical features (transformations, complex policies) to upstream services, or (c) re-evaluating the target platform choice. For multi-gateway orchestration, STOA's [gateway adapter pattern](/docs/guides/multi-gateway-setup) lets you route different APIs to different gateways based on performance profiles.

### Can I skip the shadow mode phase and go directly to canary routing?

Technically yes, but it's high risk. Shadow mode (Step 5) validates that the new gateway can handle production traffic patterns without impacting consumers. It catches misconfigurations (wrong upstream URLs, missing policies, certificate issues) before they cause real outages. Skipping shadow mode increases the blast radius of failures during canary. Only skip if: (a) the new gateway is extremely similar to the old one (e.g., Kong OSS → Kong Enterprise), and (b) you have extensive synthetic test coverage from Step 8. Even then, run at least 24 hours of shadow traffic before starting canary.

### What should I do if consumers report issues that don't show up in gateway metrics?

This indicates the issue is upstream (backend service behavior changed) or downstream (client-side caching, DNS propagation). First, verify the issue is reproducible with a direct API call from curl/Postman (bypass consumer app). Second, compare request/response headers between old and new gateway (especially `Cache-Control`, `Vary`, `ETag`). Third, check if the consumer app is using an older SDK or library that behaves differently with the new gateway. Fourth, verify the consumer is calling the correct hostname (not still hitting the old gateway via stale DNS). Add verbose logging on both gateway and upstream service to trace the full request path.

---

## What's Next?

Once your API gateway migration is complete, consider these enhancements:

1. **GitOps configuration management** — Store all gateway config in Git, use ArgoCD or Flux for continuous reconciliation. See [GitOps in 10 Minutes](/blog/gitops-in-10-minutes).

2. **Multi-gateway orchestration** — Run multiple gateway vendors side-by-side, route APIs to the best-fit gateway. See [Multi-Gateway Setup Guide](/docs/guides/multi-gateway-setup).

3. **AI agent support** — Enable MCP protocol for your APIs so AI agents can discover and call them automatically. See [Quick Start Guide](/docs/guides/quickstart).

4. **Performance benchmarking** — Compare your new gateway against alternatives using the [Gateway Arena benchmark](/blog/stoa-gateway-performance-benchmarks).

5. **Hybrid deployment** — Run gateways in multiple clouds or on-premises for sovereignty and redundancy. See [Hybrid Deployment Guide](/docs/deployment/hybrid).

---

> This guide describes technical migration steps and does not imply any deficiency in the source platform. Migration decisions depend on specific organizational requirements. All trademarks belong to their respective owners.

> STOA Platform provides technical capabilities that support regulatory compliance efforts. This does not constitute legal advice or a guarantee of compliance. Organizations should consult qualified legal counsel for compliance requirements.
