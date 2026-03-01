---
slug: week-1-with-stoa-operations-runbook
title: "Week 1 Operations Runbook: Install to Production-Ready"
description: "Day-by-day operations guide for your first week. Monitoring, policies, consumers, and production hardening steps in the right order."
authors: [stoa-team]
tags: [tutorial, education, api-gateway]
keywords:
  - stoa platform first week guide
  - api gateway operations runbook
  - stoa monitoring setup tutorial
  - api gateway production checklist
  - stoa platform onboarding guide
  - week 1 api gateway operations
---
<!-- last verified: 2026-02 -->

You've installed STOA. The health check returns 200. Now what?

The gap between "it runs" and "it's production-ready" is where most setups fail. This runbook covers your first 7 days with STOA — the operational habits that prevent 3am surprises, the monitoring that catches issues before your users do, and the hardening steps that separate a demo from a real deployment.

<!-- truncate -->

## Who This Is For

This guide is for developers, freelancers, and small teams who have STOA running (via [Docker Compose](/blog/stoa-quickstart-first-api-5-minutes) or Kubernetes) and want to move from "installed" to "operating with confidence."

Each day builds on the previous one. By Day 7, you'll have monitoring, alerting, consumers, policies, and a production checklist completed.

:::tip Configure your environment
```bash
export STOA_API_URL="http://localhost:8000"      # Control Plane API
export STOA_GATEWAY_URL="http://localhost:3001"   # Gateway endpoint
export STOA_AUTH_URL="http://localhost:8080"       # Keycloak
export TENANT_ID="default"                        # Your tenant ID
```

Replace with your production URLs if deploying remotely. See the [full operations guide](/docs/guides/week-1-operations) for environment-specific details.
:::

---

## Day 1: Verify Everything Works

Before adding anything new, confirm your baseline is solid.

### Health Check All Services

```bash
# Gateway
curl -s ${STOA_GATEWAY_URL}/health | jq .
# Expected: {"status":"ok","version":"..."}

# Control Plane API
curl -s ${STOA_API_URL}/health | jq .
# Expected: {"status":"ok"}

# Keycloak
curl -s ${STOA_AUTH_URL}/health/ready
# Expected: {"status":"UP"}
```

If any service fails, check logs before proceeding:

```bash
docker compose logs <service-name> --tail=50
```

### Get Your Admin Token

You'll need this for every API call in this runbook:

```bash
TOKEN=$(curl -s -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token \
  -d "client_id=control-plane-api" \
  -d "client_secret=your-client-secret" \
  -d "grant_type=client_credentials" | jq -r .access_token)
```

### Explore the Console

Open `http://localhost:3000` (or your Console URL) and log in with your admin credentials. Walk through:

- **Dashboard**: overview of APIs, consumers, and request volume
- **APIs**: your registered API catalog
- **Policies**: rate limits, CORS, and security rules
- **Consumers**: who has access to what

This is your command center. Bookmark it.

**Day 1 checkpoint**: All services healthy, Console accessible, admin token working.

---

## Day 2: Register Your First API

If you followed the [Quick Start](/blog/stoa-quickstart-first-api-5-minutes), you already have a test API. Now let's register a real one.

### Create a UAC Contract

The [Universal API Contract](/blog/uac-in-5-minutes-define-once-expose-everywhere) is how STOA manages APIs. One contract, multiple protocol bindings:

```bash
CONTRACT_ID=$(curl -s -X POST "${STOA_API_URL}/v1/contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "my-service-api",
    "apiVersion": "1.0.0",
    "tenant": "'$TENANT_ID'",
    "displayName": "My Service API",
    "description": "Backend service for my application",
    "endpoint": {
      "url": "http://my-backend:8080/api",
      "method": "REST",
      "timeout": "15s"
    },
    "auth": {
      "type": "api_key"
    },
    "portal": {
      "visible": true,
      "categories": ["production"]
    }
  }' | jq -r .id)

echo "Contract ID: $CONTRACT_ID"
```

### Verify It's Reachable

```bash
curl -s -o /dev/null -w "HTTP %{http_code} in %{time_total}s\n" \
  "${STOA_GATEWAY_URL}/my-service-api/v1/health" \
  -H "X-API-Key: your-test-key"
```

You should see `HTTP 200`. If you get a `502`, your backend URL isn't reachable from inside the gateway container. Common fix: use `host.docker.internal` instead of `localhost` on Mac/Windows.

**Day 2 checkpoint**: At least one real API registered and callable through the gateway.

---

## Day 3: Set Up Policies

Policies are what turn a proxy into a gateway. Start with the two most important: rate limiting and CORS.

### Add Rate Limiting

Protect your backend from traffic spikes:

```bash
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "standard-rate-limit",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "requests_per_minute": 100,
      "burst": 10
    }
  }' | jq .
```

### Add CORS (If You Have Browser Clients)

Without CORS headers, browsers block cross-origin API calls:

```bash
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "browser-cors",
    "policy_type": "cors",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "origins": ["https://yourapp.com", "http://localhost:3000"],
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "headers": ["Content-Type", "Authorization", "X-API-Key"],
      "max_age": 3600
    }
  }' | jq .
```

### Test Rate Limiting

Send a burst of requests to verify the limit kicks in:

```bash
for i in $(seq 1 15); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "${STOA_GATEWAY_URL}/my-service-api/v1/health" \
    -H "X-API-Key: your-test-key")
  echo "Request $i: HTTP $STATUS"
done
```

After exceeding the burst allowance, you should see `HTTP 429` (Too Many Requests). That means rate limiting is working.

**Day 3 checkpoint**: Rate limiting and CORS policies active and verified.

---

## Day 4: Onboard Your First Consumer

APIs are useless without consumers. Let's set one up.

### Create a Consumer

```bash
CONSUMER_ID=$(curl -s -X POST "${STOA_API_URL}/v1/consumers/${TENANT_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "client-001",
    "name": "Acme Corp Integration",
    "email": "dev@acme.example.com",
    "consumer_metadata": {
      "plan": "starter",
      "contact": "Alice"
    }
  }' | jq -r .id)

echo "Consumer ID: $CONSUMER_ID"
```

### Create a Subscription (API Key)

```bash
API_KEY=$(curl -s -X POST "${STOA_API_URL}/v1/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": "'$CONSUMER_ID'",
    "api_id": "'$CONTRACT_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq -r .api_key)

echo "API Key for Acme: $API_KEY"
```

### Verify the Consumer Can Access the API

```bash
curl -s "${STOA_GATEWAY_URL}/my-service-api/v1/health" \
  -H "X-API-Key: $API_KEY" \
  -w "\nHTTP %{http_code}\n"
```

Send this API key to your consumer. They can also self-register through the [Developer Portal](/docs/guides/portal) at `http://localhost:3002`.

**Day 4 checkpoint**: At least one consumer created with a working API key.

---

## Day 5: Enable Monitoring

You can't fix what you can't see. STOA exposes Prometheus metrics and structured logs out of the box.

### Check Metrics Are Exposed

```bash
curl -s ${STOA_GATEWAY_URL}/metrics | head -20
```

You should see Prometheus-format metrics: `stoa_requests_total`, `stoa_request_duration_seconds`, `stoa_rate_limit_exceeded_total`, and others.

### Set Up a Basic Monitoring Script

If you don't have Prometheus/Grafana yet, start with a simple check script:

```bash
#!/bin/bash
# check-stoa.sh — run via cron every 5 minutes

GATEWAY="${STOA_GATEWAY_URL:-http://localhost:3001}"

status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/health")
latency=$(curl -s -o /dev/null -w "%{time_total}" "$GATEWAY/health")

if [ "$status" != "200" ]; then
  echo "[ALERT] Gateway returned $status at $(date)"
fi

if (( $(echo "$latency > 2.0" | bc -l) )); then
  echo "[WARN] Gateway latency ${latency}s at $(date)"
fi
```

Add to cron:

```bash
crontab -e
# */5 * * * * /path/to/check-stoa.sh >> /var/log/stoa-monitor.log 2>&1
```

### Review Gateway Logs

STOA logs every request in structured format. The important patterns to watch:

| Log Pattern | Meaning | Action |
|-------------|---------|--------|
| `status=200` | Normal request | None |
| `status=429` | Rate limit hit | Check if consumer needs higher limit |
| `status=502` | Backend unreachable | Check backend health immediately |
| `status=401` | Auth failure | Verify API key or token is valid |

```bash
# Find errors in the last hour
docker compose logs stoa-gateway --since=1h 2>/dev/null | grep '"status":5'
```

For a full observability setup with Grafana dashboards, see the [Observability Guide](/docs/guides/observability).

**Day 5 checkpoint**: Monitoring script running, you know where to find logs and metrics.

---

## Day 6: Set Up Alerting

Monitoring without alerting means you only discover problems when users complain. Set up the minimum viable alerts.

### Three Alerts You Need on Day 1

| Alert | Condition | Why |
|-------|-----------|-----|
| **Gateway down** | Health check returns non-200 | Your API is offline |
| **High error rate** | 5xx rate > 5% for 5 minutes | Backend is failing |
| **Rate limit storm** | 429 rate > 50% for 10 minutes | Possible abuse or misconfigured limits |

### Free External Monitoring

For a quick setup without infrastructure, use [UptimeRobot](https://uptimerobot.com) (free tier: 50 monitors, 5-minute checks):

1. Add monitor: `https://your-gateway-domain/health`
2. Alert via email or Slack webhook
3. Set check interval to 5 minutes

This catches the scenario where your server is up but STOA is down.

### Prometheus Alerts (If You Have Prometheus)

```yaml
# prometheus-alerts.yml
groups:
  - name: stoa
    rules:
      - alert: StoaGatewayDown
        expr: up{job="stoa-gateway"} == 0
        for: 2m
        labels:
          severity: critical

      - alert: StoaHighErrorRate
        expr: rate(stoa_requests_total{status=~"5.."}[5m]) / rate(stoa_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning

      - alert: StoaRateLimitStorm
        expr: rate(stoa_rate_limit_exceeded_total[10m]) / rate(stoa_requests_total[10m]) > 0.5
        for: 10m
        labels:
          severity: warning
```

**Day 6 checkpoint**: At least one external health check configured, you'll know within 5 minutes if the gateway goes down.

---

## Day 7: Production Checklist

Before telling anyone "it's ready," run through this checklist.

### Security

| Check | Command | Expected |
|-------|---------|----------|
| TLS enabled | `curl -I https://your-gateway/health` | `HTTP/2 200` |
| Admin API not public | `curl https://your-domain:8000/health` | Connection refused from internet |
| Default credentials changed | Check Keycloak admin password | Not `admin`/`admin` |
| API keys are unique per consumer | `SELECT count(DISTINCT api_key) FROM subscriptions` | Equals total subscriptions |

### Reliability

| Check | Command | Expected |
|-------|---------|----------|
| Gateway restarts clean | `docker compose restart stoa-gateway && curl /health` | 200 within 10s |
| Rate limiting works | Burst test from Day 3 | 429 after limit exceeded |
| Logs rotating | Check Docker log driver config | `max-size` and `max-file` set |

### Operations

| Check | How | Expected |
|-------|-----|----------|
| Monitoring active | Check your monitoring tool | Green/UP status |
| Alerting tested | Trigger a test alert | Alert received in < 5 min |
| Backup procedure documented | Write it down | You know how to restore |
| Incident runbook exists | Create one (template below) | Covers top 3 failure scenarios |

### Minimal Incident Runbook

Save this somewhere your team can find it at 3am:

```markdown
# STOA Incident Runbook

## Gateway returns 5xx
1. docker compose logs stoa-gateway --tail=50
2. docker compose restart stoa-gateway
3. If still down: docker compose down && docker compose up -d

## Consumer locked out (invalid key)
1. Look up consumer: GET /v1/consumers/$TENANT_ID?email=their@email.com
2. Rotate key: POST /v1/subscriptions/$SUB_ID/rotate-key
3. Send new key to consumer

## Rate limit too aggressive
1. GET /v1/admin/policies (find the policy)
2. PATCH /v1/admin/policies/$POLICY_ID with higher limits
3. Changes take effect immediately — no restart
```

**Day 7 checkpoint**: All checklist items green. You're production-ready.

---

## What You've Built in One Week

| Day | What You Did | Why It Matters |
|-----|-------------|----------------|
| 1 | Verified baseline | Confirmed nothing is broken before building on top |
| 2 | Registered a real API | Your first production workload |
| 3 | Added policies | Protection against traffic spikes and browser issues |
| 4 | Onboarded a consumer | Someone can actually use your API |
| 5 | Enabled monitoring | You'll see problems before users do |
| 6 | Set up alerting | You'll know about problems even when you're not looking |
| 7 | Production checklist | Confidence that it's ready for real traffic |

This is the foundation. Everything else — multi-gateway setups, GitOps deployments, MCP for AI agents — builds on these basics.

---

## FAQ

### What if I'm stuck on a specific step?

Check the [full operations guide](/docs/guides/week-1-operations) for detailed troubleshooting for each day. Common issues like 502 errors, Keycloak token expiry, and Docker networking are covered there.

### How do I add more gateways (Kong, Gravitee)?

STOA's adapter pattern supports 7 gateway backends. Once your first gateway is stable, see the [Multi-Gateway Setup Guide](/docs/guides/multi-gateway-setup) to add Kong, Gravitee, Apigee, or others alongside STOA Gateway.

### Where's the community?

- **GitHub Issues**: [github.com/stoa-platform/stoa/issues](https://github.com/stoa-platform/stoa/issues) for bugs and feature requests
- **GitHub Discussions**: for questions and architecture conversations
- **Developer Portal**: your consumers can self-register and browse APIs

### Can I skip days?

The days are sequential because each builds context for the next. But if you already have monitoring (Day 5-6 done), jump to Day 7 for the production checklist.

---

## Next Steps

- **[UAC in 5 Minutes](/blog/uac-in-5-minutes-define-once-expose-everywhere)** — define one contract, expose as REST + MCP
- **[API Security for Freelancers: Part 1](/blog/freelancer-api-security-part-1-vulnerabilities)** — deeper security hardening after Week 1
- **[API Security Checklist for Solo Developers](/blog/api-security-checklist-solo-dev)** — quick security wins
- **[Consumer Onboarding Guide](/docs/guides/consumer-onboarding)** — self-service portal workflows
- **[Observability Guide](/docs/guides/observability)** — full Prometheus + Grafana setup
- **[Authentication Guide](/docs/guides/authentication)** — JWT, OAuth 2.0, and mTLS options
