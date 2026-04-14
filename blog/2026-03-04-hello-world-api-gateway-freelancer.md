---
slug: hello-world-api-gateway-freelancer
title: "First Protected API in 15 Minutes (Freelancer Edition)"
description: "Rate limiting, auth, and monitoring from line one. Build a production-ready API gateway as a freelancer or indie hacker in 15 minutes flat."
authors: [stoa-team]
tags: [tutorial, quickstart, api-gateway, security]
keywords:
  - hello world api gateway tutorial
  - freelancer api gateway setup
  - protect api with rate limiting tutorial
  - open source api gateway getting started
  - stoa platform hello world
  - api gateway for indie hackers
  - first api gateway freelancer
---
<!-- last verified: 2026-02 -->

Most "Hello World" tutorials get you to a running endpoint. This one gets you to a **protected** endpoint — with rate limiting, authentication, and an audit trail — because that's what production actually requires.

This is the freelancer edition: opinionated, fast, and realistic about what breaks first when you launch.

<!-- truncate -->

## Why This Tutorial Is Different

You've probably seen the "deploy nginx in one command" style tutorials. They're great for demos. They're not great for what happens next: a bot hammers your API at 10,000 requests/minute, a script kid discovers your `/admin` endpoint, or a client asks "what was the API doing at 3am last Tuesday?"

STOA solves all three before you even write your first endpoint. This tutorial walks through the full Hello World — from zero to protected API — in about 15 minutes.

**What you'll build:**

1. STOA platform running locally via Docker Compose
2. A backend API (a simple echo server)
3. That API behind STOA's gateway with:
   - Rate limiting (100 requests/minute per consumer)
   - API key authentication
   - Request logging
4. A working `curl` call through the protected gateway
5. A video script outline you can use to record a walkthrough

---

## Prerequisites

- Docker and Docker Compose installed
- `curl` available (macOS/Linux built-in, Windows: Git Bash or WSL)
- 2GB free RAM

That's it. No Kubernetes. No cloud account. No credit card.

---

## Step 1 — Clone and Start STOA

```bash
git clone https://github.com/stoa-platform/stoa-quickstart
cd stoa-quickstart
docker compose up -d
```

Wait ~30 seconds for all services to start, then verify:

```bash
curl -s http://localhost:8080/health | jq .
# {"status":"ok","version":"0.1.0"}
```

**What just started?**

| Service | Port | Purpose |
|---------|------|---------|
| Control Plane API | 8000 | Manage tenants, APIs, consumers |
| Console UI | 3000 | Visual management interface |
| MCP Gateway | 3001 | The gateway your clients call |
| Developer Portal | 3002 | Self-service portal for API consumers |
| PostgreSQL | 5432 | Configuration store |
| Keycloak | 8080 | Identity (auth tokens) |

Your "API management platform" is now running. On your laptop. For free.

---

## Step 2 — Create a Tenant

In STOA, everything lives inside a **tenant** (think: your workspace or your client's workspace). Let's create one.

Open the Console at `http://localhost:3000` and log in with:
- Username: `admin@gostoa.dev`
- Password: `admin`

Then create your first tenant:

1. Click **Tenants → Create Tenant**
2. Name: `hello-world`
3. Domain: `hello-world.local`
4. Click **Create**

Or via API:

```bash
# Get admin token
TOKEN=$(curl -s -X POST http://localhost:8080/realms/stoa/protocol/openid-connect/token \
  -d "client_id=control-plane-api&client_secret=change-me&grant_type=client_credentials" \
  | jq -r .access_token)

# Create tenant
curl -s -X POST http://localhost:8080/v1/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello-world",
    "domain": "hello-world.local",
    "plan": "free"
  }' | jq .
```

Note the `id` returned — you'll need it next.

---

## Step 3 — Register Your Backend API

Your "backend API" can be anything — your Flask app, a Node.js service, an existing REST endpoint. For this tutorial, we'll use a public echo server so you don't need to deploy anything extra.

```bash
TENANT_ID="<your-tenant-id>"

curl -s -X POST http://localhost:8080/v1/tenants/$TENANT_ID/apis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "echo-api",
    "display_name": "Echo API",
    "description": "A simple echo server for testing",
    "backend_url": "https://httpbin.org",
    "version": "1.0.0",
    "spec_type": "rest"
  }' | jq .
```

Note the `api_id` returned.

---

## Step 4 — Add Rate Limiting (The Important Part)

This is where most tutorials say "add rate limiting" and show you one config line. Here's why it actually matters:

- Without rate limiting: one misbehaving client (bot, script, forgotten while loop) can bring your backend down
- With rate limiting: misbehaving client gets `429 Too Many Requests`, your backend stays healthy

Let's add a 100 requests/minute limit:

```bash
API_ID="<your-api-id>"

# Step 1: Create the rate limit policy
POLICY_ID=$(curl -s -X POST http://localhost:8080/v1/admin/policies \
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
  }' | jq -r .id)

# Step 2: Bind the policy to your API
curl -s -X POST http://localhost:8080/v1/admin/policies/bindings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "'$POLICY_ID'",
    "api_catalog_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq .
```

Policies are reusable: the same rate limit policy can be bound to multiple APIs. Each consumer gets their own 100 req/min bucket.

---

## Step 5 — Create a Consumer (API Key)

A **consumer** is anyone calling your API — a client, a service, yourself. Each consumer gets an API key.

```bash
curl -s -X POST http://localhost:8080/v1/consumers/$TENANT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "freelancer-client-001",
    "name": "My First Client",
    "email": "client@example.com"
  }' | jq .
```

The response includes a `consumer_id`. To get the API key for this consumer, create a subscription:

```bash
CONSUMER_ID="<consumer-id-from-above>"

curl -s -X POST http://localhost:8080/v1/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": "'$CONSUMER_ID'",
    "api_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq .api_key
```

Copy the `api_key` — this is what your client sends with every request.

---

## Step 6 — Call Your Protected API

Time for the actual Hello World moment:

```bash
API_KEY="<your-api-key>"

# Call through the gateway
curl -s http://localhost:8080/echo-api/get \
  -H "X-API-Key: $API_KEY" | jq .
```

You should see a response from httpbin.org, routed through STOA's gateway:

```json
{
  "headers": {
    "X-Api-Key": "your-key-here",
    "X-Consumer-Id": "hello-world-consumer",
    "X-Request-Id": "abc-123",
    "X-Forwarded-For": "172.19.0.1"
  },
  "origin": "172.19.0.1",
  "url": "http://localhost:8080/echo-api/get"
}
```

Notice the injected headers — STOA automatically adds `X-Consumer-Id` and `X-Request-Id` to every proxied request. Your backend knows who called and has a trace ID for debugging.

**Test the rate limiting:**

```bash
# Hammer the API 110 times
for i in $(seq 1 110); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/echo-api/get \
    -H "X-API-Key: $API_KEY"
done
```

You'll see `200` for the first 100 requests, then `429` for the next 10. Rate limiting works.

---

## Step 7 — View the Audit Trail

STOA logs every request with consumer identity, timestamp, response code, and latency. Check the Console at `http://localhost:3000` → **Logs** to see your requests.

Or query via API:

```bash
curl -s "http://localhost:8080/v1/audit/$TENANT_ID?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs[] | {consumer, path, status, latency_ms}'
```

This is your audit trail. When a client asks "why was my API slow at 3am?", you have the answer.

---

## Step 8 — What You Now Have

In 15 minutes, you've built:

| Feature | Status |
|---------|--------|
| API Gateway | ✅ Running |
| Rate Limiting | ✅ 100 req/min per consumer |
| API Key Auth | ✅ Consumer-scoped keys |
| Request Logging | ✅ Full audit trail |
| Consumer Management | ✅ Add/revoke without code changes |

This is the same architecture used in production API management platforms. You're running it on your laptop for free.

---

## Video Script Outline

If you want to record a walkthrough of this tutorial, here's a script outline:

**Intro (30s)**
> "Most tutorials show you a running endpoint. This one shows you a protected endpoint — with rate limiting, auth, and an audit trail — because that's what production needs. Let's build your first API gateway in 15 minutes."

**Act 1: Clone and start (2min)**
> Show `git clone` + `docker compose up -d` + health check. Emphasize: "6 services, zero configuration."

**Act 2: Create tenant + register API (3min)**
> Use the Console UI for visual effect. Show the API being registered with the backend URL.

**Act 3: Rate limiting (2min)**
> Add the policy. Run the 110-request loop. Show the `429` responses. "This is the moment most apps are missing."

**Act 4: API key consumer (2min)**
> Create consumer via Console. Copy the API key. First `curl` through the gateway.

**Act 5: Audit trail (1min)**
> Show the Logs view in Console. "When your client asks 'what happened at 3am', you have this."

**Outro (30s)**
> "That's a fully protected API, running locally, in 15 minutes. Next steps: add your real backend, invite your first client to the Developer Portal, and when you're ready to deploy — it's one command with Helm."

---

## Next Steps

Now that you have a working protected API, here's what to explore next:

1. **[Week 1 Operations Runbook](/docs/guides/week-1-operations)** — monitoring, logs rotation, first policy tuning, onboarding your first real consumer
2. **[Developer Portal Guide](/docs/guides/portal)** — let clients self-register for API access
3. **[Security Hardening Series](/blog/tags/security)** — deeper dive into auth patterns, audit trails, and compliance
4. **[Docker Compose Local Development](/blog/stoa-docker-compose-local-development)** — tips for integrating STOA into your existing Docker setup

---

## FAQ

### Is STOA free to use?

Yes — Apache 2.0 license, fully open source. You can run it anywhere, modify it, and deploy it commercially without paying anything. [More on why Apache 2.0](/blog/why-apache-2-not-bsl).

### Can I use my existing backend instead of httpbin?

Absolutely. Replace `https://httpbin.org` with `http://host.docker.internal:your-port` (macOS/Windows) or `http://172.17.0.1:your-port` (Linux) to point at a local service. Any HTTP backend works.

### What happens when I go to production?

The same Docker Compose setup can be deployed to any VM or Kubernetes cluster. See the [Quick Start guide](/docs/guides/quickstart) for Docker Compose deployment, or the [Helm chart](/docs/deployment/hybrid) for Kubernetes.

### How do I add more rate limiting tiers?

Create multiple consumer groups (free/pro/enterprise) with different rate limit policies. Consumers get different API keys scoped to their plan. This is covered in detail in the [Consumer Onboarding guide](/docs/guides/consumer-onboarding).

### Can STOA handle MCP (AI agents)?

Yes — that's actually STOA's core differentiator. Every API you register can also be exposed as an MCP tool, making it callable by AI agents like Claude. See [converting REST APIs to MCP tools](/blog/convert-rest-api-to-mcp-tools).
