---
sidebar_position: 20
title: "Week 1 with STOA: Operations Runbook"
description: "Your first week operating STOA in production. Covers monitoring, log management, policy tuning, consumer onboarding, and incident response basics."
---

# Week 1 with STOA: Operations Runbook

You've deployed STOA and your first API is live. Now what?

This runbook covers the practical operations tasks for your first 7 days — the things that aren't in the "quick start" guide but that you'll actually need to do. Think of it as the manual your future self wishes you had read.

**Who this is for:** Freelancers, indie hackers, and small teams running STOA in production for the first time.

---

## Day 1: Verify Your Deployment

### Check All Services Are Healthy

```bash
# If running Docker Compose
docker compose ps

# All services should show "Up" and "healthy"
# Expected output:
# control-plane-api   Up   0.0.0.0:8000->8000/tcp   healthy
# control-plane-ui    Up   0.0.0.0:3000->3000/tcp   healthy
# stoa-gateway        Up   0.0.0.0:3001->3001/tcp   healthy
# developer-portal    Up   0.0.0.0:3002->3002/tcp   healthy
# postgres            Up   0.0.0.0:5432->5432/tcp   healthy
# keycloak            Up   0.0.0.0:8080->8080/tcp   healthy
```

### Verify the Gateway Responds

```bash
curl -s ${STOA_GATEWAY_URL}/health
# Expected: {"status":"ok","version":"0.1.0","uptime_seconds":3600}
```

### Confirm Your API Is Reachable

```bash
# Replace with your API key and path
curl -s ${STOA_GATEWAY_URL}/your-api/endpoint \
  -H "X-API-Key: your-api-key" \
  -w "\nHTTP Status: %{http_code}\nLatency: %{time_total}s\n"
```

If you see `HTTP Status: 200` and a reasonable latency (under 500ms for local backends), you're good.

### Check Keycloak Is Accessible

```bash
curl -s ${STOA_AUTH_URL}/health/ready
# Expected: {"status":"UP"}
```

---

## Day 2: Set Up Monitoring

### Enable STOA's Built-in Metrics

STOA exposes Prometheus metrics at `/metrics`. If you're using Docker Compose with the observability stack:

```bash
# Check Prometheus is scraping STOA
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "stoa-gateway") | .health'
# Expected: "up"
```

Open Grafana at `http://localhost:3003` to see the pre-built dashboards:
- **Gateway Overview**: request rate, error rate, latency percentiles
- **Consumer Usage**: requests by consumer, top consumers by volume
- **Rate Limiting**: rejected requests over time

### Create a Simple Health Check Script

Save this as `check-stoa.sh` and run it via cron:

```bash
#!/bin/bash
# check-stoa.sh — run every 5 minutes via cron

GATEWAY_URL="${STOA_GATEWAY_URL:-http://localhost:3001}"
ALERT_EMAIL="you@example.com"

response=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health")

if [ "$response" != "200" ]; then
  echo "ALERT: STOA gateway returned $response at $(date)" | mail -s "STOA Health Alert" "$ALERT_EMAIL"
fi
```

Add to cron:
```bash
crontab -e
# Add:
*/5 * * * * /path/to/check-stoa.sh
```

### Set Up Uptime Monitoring

For a free external health check, use [UptimeRobot](https://uptimerobot.com) or [Better Stack](https://betterstack.com/uptime):
- Monitor: `https://your-gateway-domain/health`
- Check interval: every 5 minutes
- Alert: email or Slack webhook

This catches situations where your server is up but STOA is down.

---

## Day 3: Manage Your Logs

### Where Are the Logs?

STOA logs to stdout by default (Docker captures these). View them:

```bash
# Gateway logs (requests, errors, rate limit events)
docker compose logs stoa-gateway --tail=100 --follow

# API logs (control plane, tenant management)
docker compose logs control-plane-api --tail=100 --follow
```

### What to Look For

**Normal (ignore these):**
```
INFO  request completed path=/health status=200 latency=1ms
INFO  rate_limit_check consumer=my-consumer remaining=95/100
```

**Investigate these:**
```
WARN  rate_limit_exceeded consumer=my-consumer path=/api/endpoint
ERROR backend_error path=/api/endpoint status=502 error="connection refused"
ERROR auth_failed path=/api/endpoint reason="invalid_api_key"
```

**Fix immediately:**
```
ERROR database_connection_failed
PANIC recovery triggered  # This shouldn't happen — file a bug report
```

### Set Up Log Retention

By default, Docker keeps logs indefinitely. Add log rotation to your `docker-compose.yml`:

```yaml
services:
  stoa-gateway:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"   # Max 100MB per log file
        max-file: "5"      # Keep 5 rotated files = 500MB max
```

Restart services after updating:
```bash
docker compose up -d
```

### Query Logs for Specific Events

```bash
# Find all 5xx errors in the last hour
docker compose logs stoa-gateway --since=1h 2>/dev/null | grep '"status":5'

# Find rate limit events for a specific consumer
docker compose logs stoa-gateway 2>/dev/null | grep "rate_limit_exceeded.*my-consumer"

# Count requests by status code
docker compose logs stoa-gateway --since=24h 2>/dev/null | grep -oP '"status":\d+' | sort | uniq -c

# Query audit logs via API (structured, filterable)
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs[] | {action, resource, user, created_at}'
```

---

## Day 4: Tune Your Policies

### Review Your Rate Limits

After a few days of traffic, check if your limits are right:

```bash
TOKEN="your-admin-token"
TENANT_ID="your-tenant-id"

# Get rate limit events from the last 24h
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?event_type=rate_limit_exceeded&hours=24" \
  -H "Authorization: Bearer $TOKEN" | jq '.total_events'
```

**Tune based on what you see:**

| Events/Day | Action |
|-----------|--------|
| 0 | Your limits might be too generous — OK unless you have high traffic |
| 1-50 | Normal — clients occasionally burst over the limit |
| 50-500 | Review which consumers are hitting limits — might need tiered plans |
| 500+ | Either a misbehaving client or your limits are too low for your traffic |

### Update a Rate Limit Policy

```bash
POLICY_ID="your-policy-id"

curl -s -X PATCH "${STOA_API_URL}/v1/admin/policies/$POLICY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "requests_per_minute": 200,
      "burst": 20
    }
  }' | jq .
```

Rate limit changes take effect immediately — no restart required.

### Add a CORS Policy (If Serving Browser Clients)



If your API is called from web browsers, you need CORS headers:

```bash
CORS_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
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
      "headers": ["Content-Type", "X-API-Key"],
      "max_age": 3600
    }
  }' | jq -r .id)

# Bind to your API
curl -s -X POST "${STOA_API_URL}/v1/admin/policies/bindings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "'$CORS_POLICY_ID'",
    "api_catalog_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq .
```

---

## Day 5: Onboard Your First Consumer

### Invite a Client to the Developer Portal

Your clients can self-register at `http://localhost:3002` (or your production portal URL). Walk them through:

1. **Sign up**: click "Request Access", fill in name + email
2. **Browse APIs**: they see your published APIs with descriptions
3. **Subscribe**: click "Subscribe" on the API they need
4. **Get their key**: after you approve, they get an API key in their dashboard

You approve subscriptions in the Console: **Subscriptions → Pending → Approve**.

### Programmatic Consumer Creation (For Automation)

If you're building a SaaS and want to auto-provision API keys when users sign up:

```bash
# Step 1: Create the consumer
CONSUMER_ID=$(curl -s -X POST "${STOA_API_URL}/v1/consumers/$TENANT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "user-'$(date +%s)'",
    "name": "user-12345",
    "email": "user@example.com",
    "consumer_metadata": {
      "user_id": "12345",
      "plan": "starter"
    }
  }' | jq -r .id)

# Step 2: Create a subscription (get the API key)
API_KEY=$(curl -s -X POST "${STOA_API_URL}/v1/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": "'$CONSUMER_ID'",
    "api_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq -r .api_key)

echo "API Key: $API_KEY"
```

Store this key in your user's account. You can revoke it later:

```bash
SUBSCRIPTION_ID="subscription-id-from-above"
curl -s -X POST "${STOA_API_URL}/v1/subscriptions/$SUBSCRIPTION_ID/revoke" \
  -H "Authorization: Bearer $TOKEN"
```

### Set Consumer-Specific Limits

To give a premium consumer a higher rate limit, create a dedicated policy at the tenant scope and bind it to their consumer:

```bash
# Create a high-limit policy scoped to a specific consumer
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "premium-rate-limit-'$CONSUMER_ID'",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "tenant",
    "config": {
      "requests_per_minute": 1000,
      "burst": 50
    },
    "priority": 50
  }' | jq .
```

Higher priority (lower number) policies override lower priority ones for the same consumer.

---

## Day 6: Prepare for Incidents

### Build Your Runbook

Before something goes wrong, write down what you'll do. Keep it simple:

```markdown
# STOA Incident Runbook

## Gateway Down (5xx on health check)
1. Check service: docker compose ps
2. Check logs: docker compose logs stoa-gateway --tail=50
3. Restart if needed: docker compose restart stoa-gateway
4. If still down: docker compose down && docker compose up -d

## Database Down
1. Check: docker compose ps postgres
2. Check logs: docker compose logs postgres --tail=20
3. Restart: docker compose restart postgres
4. Wait 30s, then restart dependent services

## Consumer Locked Out (invalid key)
1. Look up consumer: GET /v1/consumers/$TENANT_ID (filter by email)
2. Get their subscriptions: GET /v1/subscriptions/tenant/$TENANT_ID
3. Rotate key: POST /v1/subscriptions/$SUBSCRIPTION_ID/rotate-key
4. Send new key to client

## Rate Limit Misconfiguration
1. Identify policy: GET /v1/tenants/$TENANT_ID/policies
2. Adjust: PATCH /v1/tenants/$TENANT_ID/policies/$POLICY_ID
3. Changes take effect immediately
```

### Test Your Recovery Procedures

Practice before you need them:

```bash
# Test restart (should take <10s)
time docker compose restart stoa-gateway

# Test full stop/start (should take <30s)
time (docker compose down && docker compose up -d)

# Test key rotation
curl -s -X POST "${STOA_API_URL}/v1/tenants/$TENANT_ID/consumers/$CONSUMER_ID/rotate-key" \
  -H "Authorization: Bearer $TOKEN" | jq .api_key
```

---

## Day 7: Weekly Review Checklist

Run this every week:

```bash
#!/bin/bash
# weekly-stoa-review.sh

echo "=== STOA Weekly Review $(date +%Y-%m-%d) ==="

echo ""
echo "--- Service Health ---"
docker compose ps

echo ""
echo "--- Error Rate (last 7 days) ---"
docker compose logs stoa-gateway --since=168h 2>/dev/null | grep -c '"status":5' || echo "0 errors"

echo ""
echo "--- Top Rate Limited Consumers ---"
curl -s "${STOA_API_URL}/v1/tenants/$TENANT_ID/logs?event_type=rate_limit_exceeded&hours=168" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | group_by(.consumer) | map({consumer: .[0].consumer, count: length}) | sort_by(.count) | reverse | .[0:5]'

echo ""
echo "--- Active Consumers ---"
curl -s "${STOA_API_URL}/v1/tenants/$TENANT_ID/consumers" \
  -H "Authorization: Bearer $TOKEN" | jq '.total'

echo ""
echo "--- Disk Usage ---"
docker system df
```

### What to Act On

| Finding | Action |
|---------|--------|
| Any service unhealthy | Investigate logs immediately |
| Error rate >1% | Find root cause, fix before it grows |
| Consumer hitting rate limits daily | Consider upgrading their plan or increasing their limit |
| Disk >80% | Clean old logs: `docker system prune` (removes unused images/containers) |
| No requests for 24h+ | Check your client integration — something may have broken |

---

## Common Week 1 Issues

### "Consumer gets 401 on every request"

The API key is either wrong or not associated with the right API:
```bash
# Verify the consumer and their API associations
curl -s "${STOA_API_URL}/v1/tenants/$TENANT_ID/consumers?email=client@example.com" \
  -H "Authorization: Bearer $TOKEN" | jq '.consumers[0] | {api_key, api_ids}'
```

### "Gateway returns 502 Bad Gateway"

Your backend is unreachable from the gateway container:
```bash
# Test backend connectivity from inside the gateway container
docker compose exec stoa-gateway curl -s http://your-backend:port/health
```

Common causes:
- Using `localhost` for backend URL (doesn't work inside Docker — use `host.docker.internal` on Mac/Windows)
- Backend service isn't started
- Firewall blocking the connection

### "Logs fill up disk within days"

Add the log rotation config from Day 3, or reduce your log verbosity:
```yaml
# In docker-compose.yml
environment:
  - LOG_LEVEL=warn  # Only log warnings and errors (default is info)
```

### "Keycloak token expired, admin API returns 401"

Tokens expire after 5 minutes by default:
```bash
# Always get a fresh token before admin API calls
get_token() {
  curl -s -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token \
    -d "client_id=control-plane-api&client_secret=${KC_SECRET}&grant_type=client_credentials" \
    | jq -r .access_token
}

TOKEN=$(get_token)
```

---

## What Comes Next

After week 1, you should have a stable, monitored API gateway. From here:

- **[Security Series: Part 1 — Your APIs Are More Vulnerable Than You Think](/blog/freelancer-api-security-part-1-vulnerabilities)** — deeper security hardening
- **[Rate Limiting Strategies That Actually Work](/blog/freelancer-api-security-part-2-rate-limiting)** — beyond basic rate limiting
- **[Authentication Guide](/docs/guides/authentication)** — JWT, OAuth 2.0, and mTLS options
- **[Observability Guide](/docs/guides/observability)** — full Prometheus + Grafana setup
- **[Consumer Onboarding](/docs/guides/consumer-onboarding)** — self-service portal workflows
