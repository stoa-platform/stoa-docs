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
<!-- last verified: 2026-03 -->

**STOA Platform** is an open-source API gateway designed for the AI era. In this tutorial, you'll go from zero to a working API endpoint in **5 minutes**. No complex configuration, no hours reading docs — just clone, run, and publish your first API.

By the end, you'll have STOA's full stack running locally: Control Plane API, MCP Gateway, Developer Portal, Keycloak, and observability. You'll create an API, expose it through the gateway, and discover MCP capabilities.

<!-- truncate -->

## What You'll Build

In this quick start, you'll:
1. Deploy STOA locally with Docker Compose (10 services including observability)
2. Get an auth token and register an API
3. Discover MCP capabilities via the gateway
4. View your API in the Developer Portal

**Time**: 5 minutes
**Difficulty**: Beginner
**Prerequisites**: Docker, Docker Compose, curl

## Prerequisites

Before starting, ensure you have:

- **Docker Desktop** (or Docker Engine + Docker Compose v2)
- **curl** (for testing endpoints)
- **jq** (for JSON formatting)
- **4GB RAM minimum** (8GB recommended for full observability stack)

Verify Docker is running:
```bash
docker --version
docker compose version
```

You should see version 24+ for Docker and 2.x for Compose.

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

This launches the full STOA stack:
- **control-plane** — FastAPI backend for managing tenants, APIs, policies
- **stoa-gateway** — Rust MCP Gateway (edge-mcp mode)
- **portal** — Developer Portal for API discovery
- **keycloak** — Identity and access management (pre-configured with demo users)
- **postgres** — Primary database
- **redis** — Cache and sessions
- **prometheus** — Metrics collection
- **grafana** — Dashboards and visualization
- **loki + promtail** — Log aggregation
- **metrics-simulator** — Demo traffic generator

The first run downloads images (~3GB). Subsequent starts take **< 30 seconds**.

## Step 2: Verify Services Are Running

Check that all containers are healthy:
```bash
docker compose ps
```

You should see all services in `Up` state. Keycloak can take 30-60 seconds to start.

Test the key service health endpoints:
```bash
# Control Plane API
curl -s http://localhost:8080/health | jq .
# Expected: {"status":"healthy"}

# MCP Gateway
curl -s http://localhost:8082/health | jq .
# Expected: {"status":"ok"}

# Portal
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
```

If all endpoints respond, you're ready to configure your first API.

## Step 3: Register Your First API

Let's register an API using the Control Plane API. For this tutorial, we'll use **JSONPlaceholder**, a public REST API for testing.

First, get an auth token from the Control Plane:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}' | jq -r '.access_token')
```

Get the default tenant ID:

```bash
TENANT_ID=$(curl -s http://localhost:8080/v1/tenants \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
```

Register an API in the catalog:

```bash
curl -s -X POST "http://localhost:8080/v1/tenants/$TENANT_ID/apis" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "jsonplaceholder",
    "display_name": "JSONPlaceholder API",
    "version": "v1",
    "upstream_url": "https://jsonplaceholder.typicode.com",
    "base_path": "/jsonplaceholder",
    "description": "Free REST API for testing"
  }' | jq
```

You should receive a `201 Created` response with the API's metadata.

## Step 4: Discover MCP Capabilities

STOA's MCP Gateway exposes MCP discovery endpoints. Let's explore what's available:

```bash
# MCP discovery
curl -s http://localhost:8082/mcp | jq

# MCP capabilities
curl -s http://localhost:8082/mcp/capabilities | jq
```

You should see a response like:

```json
{
  "tools": true,
  "resources": true,
  "prompts": true
}
```

This confirms the MCP Gateway is running and ready to serve AI agent requests.

## Step 5: View the API in the Developer Portal

STOA includes a **Developer Portal** where API consumers discover and subscribe to APIs. Open it:

```
http://localhost:3000
```

Log in with `admin` / `admin` (or `developer` / `developer` for a consumer view). You should see the API catalog with pre-loaded OASIS-themed demo APIs and your newly registered JSONPlaceholder API.

## Step 6: Explore Grafana Dashboards

The quickstart includes a full observability stack. Open Grafana:

```
http://localhost:3001
```

Log in with `admin` / `stoa-demo`. You'll find:
- **STOA Platform Overview** — Live traffic by tenant, error rates, latency percentiles
- **API Traffic** — Requests per API, HTTP methods breakdown
- **System Health** — Service status, log streams

Metrics start generating immediately thanks to the built-in simulator.

## What You've Built

In 5 minutes, you've deployed a production-grade API management platform:

```
┌─────────────────────────────────────────────────────────────┐
│                       STOA Platform                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Portal (Developers)    Grafana (Dashboards)               │
│  localhost:3000          localhost:3001                     │
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
│           localhost:8082                                   │
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
- **MCP Gateway**: Rust gateway for MCP protocol, AI agent discovery, and API proxying
- **Tenant**: Logical isolation unit (multi-tenancy support)
- **Developer Portal**: Self-service API catalog for consumers

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Portal** | http://localhost:3000 | `admin` / `admin` |
| **MCP Gateway** | http://localhost:8082 | — |
| **Grafana** | http://localhost:3001 | `admin` / `stoa-demo` |
| **API** | http://localhost:8080 | — |
| **Prometheus** | http://localhost:9090 | — |
| **Keycloak** | http://localhost:8081 | `admin` / `admin` |

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
- [MCP Gateway Quick Start with Docker](/blog/mcp-gateway-quickstart-docker) — Standalone gateway deployment
- [CLI Reference](/docs/reference/cli) — Automate API management with `stoactl`
- [Configuration Reference](/docs/reference/configuration) — Environment variables, feature flags, and tuning

## Troubleshooting

### Services won't start
**Issue**: `docker compose up -d` fails with "port already in use"

**Solution**: Another service is using ports 8080-8082 or 3000-3001. Stop conflicting services or change ports in `docker-compose.yml`.

### Gateway returns 404
**Issue**: Calling the MCP Gateway returns unexpected errors

**Solution**: Ensure all services are healthy with `docker compose ps`. The gateway depends on the control-plane and keycloak being fully started.

### Keycloak login fails
**Issue**: Portal login returns "Invalid credentials"

**Solution**: The quickstart uses `admin/admin` by default. Keycloak can take 30-60 seconds to start. Check: `docker compose logs keycloak | grep "started in"`

### Not enough memory
**Issue**: Services keep restarting

**Solution**: STOA requires ~4GB RAM. Check: `docker stats --no-stream`. If running low, disable observability temporarily by commenting out prometheus, grafana, loki, promtail, and metrics-simulator services.

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
