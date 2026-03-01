---
slug: stoa-quickstart-first-api-5-minutes
title: "Publish Your First API in 5 Minutes (Quick Start)"
description: "Docker Compose up, create an API, expose it through the MCP Gateway. Your first API published in 5 minutes with step-by-step instructions."
authors: [stoa-team]
tags: [tutorial, quickstart, docker]
keywords:
  - stoa platform quick start tutorial
  - stoa api gateway getting started
  - mcp gateway docker compose setup
  - open source api gateway tutorial
  - stoa first api tutorial
---
<!-- last verified: 2026-02 -->

**STOA Platform** is an open-source API gateway designed for the AI era. In this tutorial, you'll go from zero to a working API endpoint in **5 minutes**. No complex configuration, no hours reading docs — just clone, run, and publish your first API.

By the end, you'll have STOA's full stack running locally: Control Plane, MCP Gateway, Developer Portal, and Console. You'll create an API, expose it through the gateway, and call it like any production endpoint.

<!-- truncate -->

## What You'll Build

In this quick start, you'll:
1. Deploy STOA locally with Docker Compose (4 core services)
2. Create a tenant and register an API
3. Expose the API through the MCP Gateway
4. Call your API through the gateway
5. View it in the Developer Portal

**Time**: 5 minutes
**Difficulty**: Beginner
**Prerequisites**: Docker, Docker Compose, curl

## Prerequisites

Before starting, ensure you have:

- **Docker Desktop** (or Docker Engine + Docker Compose v2)
- **curl** (for testing endpoints)
- **A terminal** (bash, zsh, or PowerShell)

Verify Docker is running:
```bash
docker --version
docker compose version
```

You should see version 20.10+ for Docker and 2.x for Compose.

## Step 1: Clone and Start STOA

STOA provides a **quickstart repository** with a pre-configured Docker Compose stack. This is the fastest way to run STOA locally.

Clone the repository:
```bash
git clone https://github.com/stoa-platform/stoa-quickstart.git
cd stoa-quickstart
```

Start all services:
```bash
docker compose up -d
```

This launches 5 containers:
- **control-plane-api** — Backend API for managing tenants, APIs, policies
- **control-plane-ui** — Admin Console for configuration
- **mcp-gateway** — Runtime gateway that proxies API requests
- **portal** — Developer Portal for API discovery
- **keycloak** — Identity and access management (pre-configured)

The first run downloads images (~2GB). Subsequent starts take **< 10 seconds**.

## Step 2: Verify Services Are Running

Check that all containers are healthy:
```bash
docker compose ps
```

You should see all services in `Up` state. If any service is restarting, wait 30 seconds and check again.

Test each service's health endpoint:
```bash
# Control Plane API
curl -s http://localhost:8080/health | jq .
# Expected: {"status":"healthy"}

# MCP Gateway
curl -s http://localhost:8081/health | jq .
# Expected: {"status":"ok"}

# Console UI
curl -s http://localhost:3000
# Expected: HTML response

# Portal
curl -s http://localhost:3001
# Expected: HTML response

# Keycloak
curl -s http://localhost:8082/health | jq .
# Expected: {"status":"UP"}
```

If all endpoints respond, you're ready to configure your first API.

## Step 3: Log In to the Console

The **Console** is STOA's admin interface. Open it in your browser:

```
http://localhost:3000
```

**Default credentials**:
- Username: `admin`
- Password: `admin`

After login, you'll see the STOA dashboard. The quickstart environment includes:
- A pre-configured **default tenant** (`default`)
- An **MCP Gateway instance** registered and online
- Role: `cpi-admin` (full platform access)

## Step 4: Create Your First API

Now let's register an API. For this tutorial, we'll use **JSONPlaceholder**, a public REST API for testing.

### Option A: Via Console UI

1. Navigate to **APIs** in the left sidebar
2. Click **Create API**
3. Fill in the form:
   - **Name**: `jsonplaceholder-posts`
   - **Display Name**: `JSONPlaceholder Posts API`
   - **Backend URL**: `https://jsonplaceholder.typicode.com`
   - **Base Path**: `/posts`
   - **Methods**: `GET`, `POST`
   - **Gateway**: Select `mcp-gateway`
4. Click **Create**

The Console validates your inputs and registers the API in the Control Plane.

### Option B: Via API (curl)

If you prefer the command line, use the Control Plane API directly:

```bash
curl -X POST http://localhost:8080/v1/apis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token" \
  -d '{
    "name": "jsonplaceholder-posts",
    "display_name": "JSONPlaceholder Posts API",
    "base_url": "https://jsonplaceholder.typicode.com",
    "base_path": "/posts",
    "version": "v1",
    "tenant_id": "default",
    "gateway_id": "mcp-gateway"
  }'
```

**Note**: The quickstart environment uses a simplified `demo-token` for authentication. In production, you'd use Keycloak OIDC tokens.

You should receive a `201 Created` response with the API's metadata.

## Step 5: Sync the API to the Gateway

The API is now registered in the Control Plane, but the **MCP Gateway** doesn't know about it yet. You need to **sync** it.

### Via Console

1. Navigate to **Gateway Instances** in the sidebar
2. Click on `mcp-gateway`
3. Click **Sync APIs**
4. Select `jsonplaceholder-posts` and click **Sync**

The Console sends the API configuration to the Gateway. The Gateway now knows how to route `/posts` requests to the backend.

### Via API

```bash
curl -X POST http://localhost:8080/v1/gateways/mcp-gateway/sync \
  -H "Authorization: Bearer demo-token"
```

This triggers a full sync of all APIs to the selected gateway.

## Step 6: Call Your API Through the Gateway

Now for the moment of truth. The Gateway is listening on port `8081`. Let's call the API:

```bash
curl -s http://localhost:8081/posts | jq '.[0:3]'
```

You should see the first 3 posts from JSONPlaceholder:

```json
[
  {
    "userId": 1,
    "id": 1,
    "title": "sunt aut facere repellat provident...",
    "body": "quia et suscipit..."
  },
  {
    "userId": 1,
    "id": 2,
    "title": "qui est esse",
    "body": "est rerum tempore vitae..."
  },
  {
    "userId": 1,
    "id": 3,
    "title": "ea molestias quasi exercitationem...",
    "body": "et iusto sed quo iure..."
  }
]
```

**What just happened?**
1. Your curl request hit the Gateway at `http://localhost:8081/posts`
2. The Gateway matched the `/posts` path to your registered API
3. It proxied the request to `https://jsonplaceholder.typicode.com/posts`
4. The backend responded with JSON
5. The Gateway returned the response to you

This is the core of STOA: **centralized API management** with decoupled routing. The Gateway doesn't care about backend URLs — the Control Plane manages that.

## Step 7: View the API in the Developer Portal

STOA includes a **Developer Portal** where API consumers discover and subscribe to APIs. Open it:

```
http://localhost:3001
```

You should see `JSONPlaceholder Posts API` listed. Click on it to view:
- API description
- Available endpoints (`GET /posts`, `POST /posts`)
- Example requests
- Subscription options (if you configure API keys or rate limits)

The Portal is auto-generated from your API metadata. Any changes in the Console instantly reflect here.

## What You've Built

In 5 minutes, you've deployed a production-grade API management platform:

```
┌─────────────────────────────────────────────────────────────┐
│                       STOA Platform                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Console (Admin)          Portal (Developers)              │
│  localhost:3000           localhost:3001                   │
│       │                          │                          │
│       └──────────┬───────────────┘                          │
│                  │                                          │
│                  ▼                                          │
│         Control Plane API                                  │
│         localhost:8080                                     │
│                  │                                          │
│                  │ (sync)                                   │
│                  ▼                                          │
│           MCP Gateway                                      │
│           localhost:8081                                   │
│                  │                                          │
│                  │ (proxy)                                  │
│                  ▼                                          │
│         Backend API (JSONPlaceholder)                      │
│         jsonplaceholder.typicode.com                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key concepts you've learned**:
- **Control Plane**: Centralized API registry and policy management
- **MCP Gateway**: Runtime proxy that enforces policies and routes requests
- **Tenant**: Logical isolation unit (multi-tenancy support)
- **API Sync**: Pushing configuration from Control Plane to Gateway
- **Developer Portal**: Self-service API catalog for consumers

## Next Steps

Now that you have STOA running, explore these guides:

### Add Security and Governance
- [Authentication and Authorization](/docs/guides/authentication) — Configure OIDC, API keys, and role-based access
- [Subscriptions and API Keys](/docs/guides/subscriptions) — Enable consumer self-service
- [Portal Configuration](/docs/guides/portal) — Customize branding and API documentation

### Integrate with AI Agents
STOA's MCP Gateway is designed for AI-native workflows. Learn how to:
- [Connect AI Agents to Enterprise APIs](/blog/connecting-ai-agents-enterprise-apis) — Expose your APIs as MCP tools
- [Convert REST APIs to MCP Tools](/blog/convert-rest-api-to-mcp-tools) — Auto-generate AI-friendly interfaces
- [What is an MCP Gateway?](/blog/what-is-mcp-gateway) — Deep dive into the Model Context Protocol

### Understand the Architecture
- [Architecture Overview](/docs/concepts/architecture) — How Control Plane, Gateway, and Portal work together
- [Gateway Modes](/docs/concepts/gateway) — Edge, sidecar, proxy, and shadow deployment patterns
- [GitOps in 10 Minutes](/blog/gitops-in-10-minutes) — Deploy STOA with Kubernetes and ArgoCD

### Migrate from Legacy Gateways
If you're evaluating STOA as a replacement for an existing gateway:
- [API Gateway Migration Guide 2026](/blog/api-gateway-migration-guide-2026) — Comprehensive migration playbook
- [Open Source API Gateway Comparison](/blog/open-source-api-gateway-2026) — Feature matrix and decision guide

### Explore Advanced Features
- [MCP Gateway Quick Start with Docker](/blog/mcp-gateway-quickstart-docker) — Production-ready deployment
- [CLI Reference](/docs/reference/cli) — Automate API management with `stoactl`
- [Configuration Reference](/docs/reference/configuration) — Environment variables, feature flags, and tuning

## Troubleshooting

### Services won't start
**Issue**: `docker compose up -d` fails with "port already in use"

**Solution**: Another service is using ports 8080-8082 or 3000-3001. Stop conflicting services or change ports in `docker-compose.yml`.

### Gateway returns 404
**Issue**: Calling `http://localhost:8081/posts` returns `{"error":"route not found"}`

**Solution**: The API wasn't synced. Go to **Gateway Instances** → `mcp-gateway` → **Sync APIs** and select your API.

### Keycloak login fails
**Issue**: Console login returns "Invalid credentials"

**Solution**: The quickstart uses `admin/admin` by default. If you changed it, check `docker-compose.yml` for `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD` values.

### API returns 502 Bad Gateway
**Issue**: Gateway proxies the request but the backend is unreachable

**Solution**: Verify the backend URL is accessible from within Docker:
```bash
docker exec stoa-mcp-gateway curl -s https://jsonplaceholder.typicode.com/posts
```

If this fails, check your network configuration or use a different test API.

## FAQ

### Can I use STOA in production?
Yes. STOA is **Apache 2.0 licensed** and production-ready. The quickstart environment is for local development. For production, deploy STOA on Kubernetes with [Helm charts](/docs/deployment/hybrid) or use the [GitOps deployment guide](/blog/gitops-in-10-minutes).

### How does STOA compare to Kong or Apigee?
STOA is **AI-native** (built for MCP protocol), **open source** (no vendor lock-in), and **multi-gateway** (orchestrates Kong, Apigee, and STOA Gateway from one control plane). See the [open source API gateway comparison](/blog/open-source-api-gateway-2026) for a detailed feature matrix.

### Do I need to know Kubernetes to use STOA?
No. This quick start runs entirely on Docker Compose. For production Kubernetes deployments, STOA provides [Helm charts](/docs/deployment/hybrid) and [GitOps workflows](/blog/gitops-in-10-minutes), but these are optional.

---

**Ready to build?** Clone the [stoa-quickstart](https://github.com/stoa-platform/stoa-quickstart) repository and have your first API running in 5 minutes.

**Join the community**: [GitHub Discussions](https://github.com/stoa-platform/stoa/discussions) | [Discord](https://discord.gg/stoa) | [Documentation](https://docs.gostoa.dev)
