---
slug: mcp-gateway-quickstart-docker
title: How to Deploy an MCP Gateway with Docker Compose (Step-by-Step Guide)
description: Learn how to deploy a production-ready MCP gateway using Docker Compose in under 10 minutes. Complete tutorial with examples.
authors: [stoa-team]
tags: [tutorial, mcp, docker, quickstart, api-gateway]
keywords:
  - MCP gateway Docker Compose
  - deploy MCP gateway
  - Model Context Protocol tutorial
  - MCP gateway setup
  - AI agent gateway
  - MCP Docker deployment
  - STOA Platform tutorial
  - API gateway for AI agents
  - MCP server Docker
  - MCP protocol implementation
  - AI gateway deployment
  - LLM API gateway
---

<!-- last verified: 2026-02 -->

# How to Deploy an MCP Gateway with Docker Compose (Step-by-Step Guide)

AI agents need a secure, standardized way to access your APIs. The Model Context Protocol (MCP) provides that bridge, and STOA Platform makes it trivial to deploy. In this tutorial, you'll learn how to set up a production-ready MCP gateway using Docker Compose in under 10 minutes.

**New to MCP gateways?** Start with our comprehensive guide: [What is an MCP Gateway?](/blog/what-is-mcp-gateway) to understand the architecture and security model before deploying.

By the end of this guide, you'll have a running gateway that exposes your existing REST APIs to AI agents like Claude, connects to authentication, and enforces runtime policies.

<!-- truncate -->

## What You'll Build

You'll deploy a complete MCP gateway stack with:

- **stoa-gateway**: Rust-based MCP server (edge-mcp mode)
- **Keycloak**: OAuth2/OIDC authentication
- **PostgreSQL**: Metadata storage for tools, subscriptions, and policies

This setup mirrors the [STOA quickstart guide](/docs/guides/quickstart) but focuses on the gateway component with hands-on examples.

## Prerequisites

Before you start, make sure you have:

- **Docker** 20.10+ and **Docker Compose** 2.x installed
- **curl** or **httpie** for testing
- **A REST API endpoint** to expose (we'll use JSONPlaceholder as a demo)
- **Basic knowledge** of Docker, REST APIs, and OAuth2

If you're migrating from an existing API gateway, check out our [API Gateway Migration Guide](/blog/api-gateway-migration-guide-2026) first.

## Step 1: Launch the Stack with Docker Compose

Create a new directory for your MCP gateway project:

```bash
mkdir mcp-gateway-demo
cd mcp-gateway-demo
```

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: stoa
      POSTGRES_USER: stoa
      POSTGRES_PASSWORD: changeme
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stoa"]
      interval: 10s
      timeout: 5s
      retries: 5

  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/stoa
      KC_DB_USERNAME: stoa
      KC_DB_PASSWORD: changeme
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_HTTP_ENABLED: "true"
      KC_HOSTNAME_STRICT: "false"
    command: start-dev
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

  stoa-gateway:
    image: ghcr.io/stoa-platform/stoa-gateway:latest
    environment:
      DATABASE_URL: postgresql://stoa:changeme@postgres:5432/stoa
      KEYCLOAK_URL: http://keycloak:8080
      KEYCLOAK_REALM: stoa
      KEYCLOAK_CLIENT_ID: stoa-mcp-gateway
      KEYCLOAK_CLIENT_SECRET: your-client-secret-here
      LOG_LEVEL: info
      MODE: edge-mcp
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      keycloak:
        condition: service_started

volumes:
  postgres_data:
```

Launch the stack:

```bash
docker-compose up -d
```

Verify all services are running:

```bash
docker-compose ps
```

You should see three containers: `postgres`, `keycloak`, and `stoa-gateway` all in the "Up" state.

**Access Keycloak**: Navigate to `http://localhost:8080` and log in with `admin/admin`. You'll need to create the `stoa` realm and `stoa-mcp-gateway` client manually in this quickstart. For production, use the [full Helm chart](/docs/deployment/hybrid) which includes automated realm setup.

## Step 2: Register Your First MCP Tool

An MCP "tool" is a function that AI agents can call. Each tool maps to one of your REST API endpoints. Let's register a tool that searches contacts.

First, get an access token from Keycloak:

```bash
export KEYCLOAK_TOKEN=$(curl -s -X POST \
  'http://localhost:8080/realms/stoa/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=stoa-mcp-gateway' \
  -d 'client_secret=your-client-secret-here' \
  -d 'grant_type=client_credentials' \
  | jq -r '.access_token')
```

Now register the tool via the gateway's admin API:

```bash
curl -X POST http://localhost:3000/admin/tools \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search-contacts",
    "display_name": "Search Contacts",
    "description": "Search for contacts by name or email",
    "tenant_id": "acme",
    "endpoint": "https://jsonplaceholder.typicode.com/users",
    "method": "GET",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query"
        }
      },
      "required": ["query"]
    }
  }'
```

**Response**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "search-contacts",
  "display_name": "Search Contacts",
  "status": "active",
  "created_at": "2026-02-12T10:30:00Z"
}
```

Your tool is now registered and ready to be called by AI agents.

## Step 3: Connect an AI Agent

The gateway exposes an MCP-compliant server endpoint at `http://localhost:3000/mcp`. AI agents connect via **Server-Sent Events (SSE)** or **WebSocket** transport.

Here's how Claude Desktop connects to your gateway. Add this to your Claude Desktop MCP settings (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "stoa-acme": {
      "url": "http://localhost:3000/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_GATEWAY_API_KEY",
        "X-Tenant-ID": "acme"
      }
    }
  }
}
```

Restart Claude Desktop. You should now see "search-contacts" available as a tool in Claude's interface.

**Test the tool from Claude**:

```
User: Find contacts with the name "Leanne"
Claude: [calls search-contacts tool with query="Leanne"]
```

The gateway proxies the request to `https://jsonplaceholder.typicode.com/users?query=Leanne`, transforms the response, and returns it to Claude in MCP format.

### Python SDK Example

If you're building a custom AI agent, use the STOA Python SDK:

```python
from stoa_sdk import STOAClient

client = STOAClient(
    gateway_url="http://localhost:3000",
    api_key="YOUR_GATEWAY_API_KEY",
    tenant_id="acme"
)

# List available tools
tools = client.list_tools()
print(f"Available tools: {[t['name'] for t in tools]}")

# Call a tool
result = client.call_tool(
    name="search-contacts",
    arguments={"query": "Leanne"}
)
print(result)
```

This approach decouples your agent code from the underlying API structure. If you switch from JSONPlaceholder to your own CRM API, the agent code remains unchanged.

## Step 4: Add a Runtime Policy

The gateway supports Open Policy Agent (OPA) policies for dynamic authorization, rate limiting, and data filtering.

Create a policy file `policies/rate-limit.rego`:

```rego
package stoa.policies

import future.keywords.if
import future.keywords.in

default allow := false

# Allow up to 100 requests per hour per tenant
allow if {
    input.method == "GET"
    count(quota_usage[input.tenant_id]) < 100
}

quota_usage[tenant_id] := requests if {
    tenant_id := input.tenant_id
    requests := [r | r := data.requests[_]; r.tenant_id == tenant_id]
}
```

Load the policy into the gateway:

```bash
curl -X POST http://localhost:3000/admin/policies \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "rate-limit-acme",
    "tenant_id": "acme",
    "policy": "'"$(cat policies/rate-limit.rego)"'",
    "enabled": true
  }'
```

Now, tenant "acme" is limited to 100 tool calls per hour. The 101st call returns:

```json
{
  "error": "quota_exceeded",
  "message": "Tenant acme has exceeded rate limit",
  "retry_after": 3600
}
```

Policies are evaluated **before** proxying to your backend API, so you never waste backend capacity on unauthorized requests.

## Step 5: Monitor and Debug

The gateway exposes Prometheus metrics at `http://localhost:3000/metrics`:

```bash
curl http://localhost:3000/metrics | grep stoa_tool_calls_total
```

**Sample metrics**:

```
stoa_tool_calls_total{tenant_id="acme",tool_name="search-contacts",status="success"} 42
stoa_tool_calls_total{tenant_id="acme",tool_name="search-contacts",status="error"} 2
stoa_policy_evaluations_total{tenant_id="acme",policy_name="rate-limit-acme",result="allow"} 40
```

For structured logs, check the gateway container:

```bash
docker-compose logs -f stoa-gateway
```

You'll see:

```json
{
  "level": "info",
  "timestamp": "2026-02-12T10:45:00Z",
  "tenant_id": "acme",
  "tool_name": "search-contacts",
  "duration_ms": 123,
  "status": 200
}
```

For production observability, integrate with Grafana and Loki. See [ADR-023: Zero Blind Spot Observability](/docs/architecture/adr/adr-023-zero-blind-spot-observability) for details.

## What You've Learned

You now have a working MCP gateway that:

1. **Exposes REST APIs** as MCP tools for AI agents
2. **Authenticates** via OAuth2/OIDC (Keycloak)
3. **Enforces policies** (rate limiting, authorization) with OPA
4. **Monitors** tool usage with Prometheus metrics

This is the foundation for production deployments. Next steps:

- **Add more tools**: Each backend API endpoint becomes a tool
- **Enable mTLS**: Secure gateway-to-backend communication ([ADR-039](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens))
- **Deploy to Kubernetes**: Use the [Helm chart](/docs/deployment/hybrid)
- **Integrate with your Control Plane**: Manage tools via UI instead of curl

## Further Reading

- [MCP Gateway Concepts](/docs/concepts/mcp-gateway) — Architecture and design
- [Quickstart Guide](/docs/guides/quickstart) — Full platform setup (Control Plane + Gateway)
- [API Gateway Migration Guide](/blog/api-gateway-migration-guide-2026) — Migrate from Kong, Apigee, webMethods
- [ADR-024: Gateway Modes](/docs/architecture/adr/adr-024-gateway-unified-modes) — Edge-MCP, Sidecar, Proxy, Shadow
- [Tool CRD Reference](/docs/reference/crds/tool) — GitOps approach to tool management

## Production Checklist

Before deploying to production:

- [ ] Replace `changeme` passwords with secrets from a vault
- [ ] Enable TLS for all services (gateway, Keycloak, Postgres)
- [ ] Configure Keycloak realm export for disaster recovery
- [ ] Set up log aggregation (ELK, Loki, or CloudWatch)
- [ ] Configure Prometheus alerts for quota exceeded, auth failures
- [ ] Test failover scenarios (Postgres down, Keycloak unavailable)
- [ ] Document your tool catalog in a Git repository

## Version Note

This tutorial uses:

- **STOA Gateway**: v0.6.0 (Rust, edge-mcp mode)
- **Keycloak**: 23.0
- **PostgreSQL**: 15

For the latest versions, check the [STOA releases page](https://github.com/stoa-platform/stoa/releases).

## Frequently Asked Questions

### What are the minimum Docker requirements for running an MCP gateway?

You need Docker 20.10+ and Docker Compose 2.x. For development/testing, allocate at least 4GB RAM to Docker Desktop. For production, deploy on a Linux server with 8GB+ RAM and persistent volumes for PostgreSQL data. The gateway itself is lightweight (Rust binary, ~50MB RAM under load), but Keycloak and PostgreSQL require more resources. See the [quickstart guide](/docs/guides/quickstart) for Kubernetes deployment options.

### Is this setup production-ready?

The Docker Compose setup is suitable for development, testing, and low-traffic production deployments. Before production use, replace all `changeme` passwords with secrets from a vault, enable TLS for all services, configure log aggregation, and set up Prometheus alerts. For high-availability production deployments with multiple replicas, use the [Helm chart](/docs/guides/quickstart) on Kubernetes.

### What's the next step after completing this quickstart?

After the quickstart, add more tools by registering additional REST API endpoints, enable mTLS for gateway-to-backend security, integrate with your Control Plane for UI-based tool management instead of curl, and deploy to Kubernetes for production use. Explore the full platform capabilities in the [MCP gateway concepts guide](/blog/what-is-mcp-gateway) and [architecture documentation](https://docs.gostoa.dev/docs/concepts/architecture).

---

**About STOA Platform**: STOA is the open-source API gateway built for AI agents. Define your API contract once with the Universal API Contract (UAC), and expose it everywhere: MCP, REST, GraphQL, gRPC. Apache 2.0 licensed. [Get started today](/docs/guides/quickstart).

**Need help?** Join our [Discord community](https://discord.gostoa.dev) or check the [troubleshooting guide](/docs/reference/troubleshooting).

> **Disclaimer**: Product capabilities and configuration options may change between versions. This guide reflects the state of STOA Platform as of February 2026. For the most current setup instructions, refer to the [official documentation](https://docs.gostoa.dev).
