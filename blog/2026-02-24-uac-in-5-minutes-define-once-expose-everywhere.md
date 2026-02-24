---
slug: uac-in-5-minutes-define-once-expose-everywhere
title: "UAC in 5 Minutes: Define Once, Expose Everywhere"
description: "Create one API contract and expose it as REST and MCP simultaneously. Hands-on tutorial with STOA's Universal API Contract."
authors: [stoa-team]
tags: [tutorial, quickstart, mcp, api-gateway]
keywords:
  - universal api contract tutorial
  - stoa uac define once expose everywhere
  - api gateway multi-protocol tutorial
  - rest to mcp single contract
  - stoa platform uac getting started
---
<!-- last verified: 2026-02 -->

You define an API once. STOA exposes it as both a REST endpoint and an MCP tool — same policies, same monitoring, zero duplication. That is the Universal API Contract (UAC), and this tutorial walks you through it in 5 minutes.

Most API platforms force you to maintain separate configurations for each protocol: one for REST consumers, another for AI agents via MCP. That means duplicated rate limits, duplicated auth rules, and twice the surface area for misconfiguration. UAC eliminates that.

<!-- truncate -->

## What You'll Build

By the end of this tutorial, you'll have:

1. A single UAC contract defining a weather API
2. A REST endpoint serving traditional HTTP clients
3. An MCP tool serving AI agents — from the same contract
4. A shared rate-limit policy that applies to both protocols

**Time**: 5 minutes
**Difficulty**: Beginner
**Prerequisites**: Running STOA instance ([Quick Start](/blog/stoa-quickstart-first-api-5-minutes)), curl

:::tip Configure your environment
```bash
export STOA_API_URL="http://localhost:8000"      # Control Plane API
export STOA_GATEWAY_URL="http://localhost:3001"   # Gateway endpoint
```

Using the hosted version? Replace with `https://api.<YOUR_DOMAIN>` and `https://mcp.<YOUR_DOMAIN>`.
:::

## Step 1: Get an Admin Token

First, authenticate with the Control Plane API:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/realms/stoa/protocol/openid-connect/token \
  -d "client_id=control-plane-api" \
  -d "client_secret=your-client-secret" \
  -d "grant_type=client_credentials" | jq -r .access_token)
```

You'll use this token for all subsequent API calls.

## Step 2: Create a UAC Contract

A UAC contract is the single source of truth for your API. It defines the backend, authentication, policies, and portal visibility — all in one place.

```bash
CONTRACT_RESPONSE=$(curl -s -X POST "${STOA_API_URL}/v1/contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "weather-api",
    "apiVersion": "1.0.0",
    "tenant": "default",
    "displayName": "Weather API",
    "description": "Current weather data for any city",
    "endpoint": {
      "url": "https://api.open-meteo.com/v1",
      "method": "REST",
      "timeout": "10s"
    },
    "auth": {
      "type": "api_key"
    },
    "policies": [
      {
        "type": "rate_limit",
        "config": {
          "requests_per_minute": 60
        }
      }
    ],
    "portal": {
      "visible": true,
      "categories": ["weather", "demo"]
    }
  }')

CONTRACT_ID=$(echo $CONTRACT_RESPONSE | jq -r .id)
echo "Contract ID: $CONTRACT_ID"
```

That one payload defines everything: the backend URL, authentication method, rate limiting, and portal listing. No gateway-specific configuration needed.

## Step 3: Check the Default Protocol Bindings

When you create a UAC contract, STOA automatically enables a REST binding. Check what bindings are active:

```bash
curl -s "${STOA_API_URL}/v1/contracts/${CONTRACT_ID}/bindings" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected output:

```json
{
  "bindings": [
    {
      "protocol": "rest",
      "enabled": true,
      "path": "/weather-api/v1",
      "created_at": "2026-02-24T10:00:00Z"
    }
  ]
}
```

REST is active by default. Your API is already reachable through the gateway at `/weather-api/v1`. But we want AI agents to access it too — so let's add MCP.

## Step 4: Enable the MCP Binding

Add an MCP binding so AI agents can discover and call your API as an MCP tool:

```bash
curl -s -X POST "${STOA_API_URL}/v1/contracts/${CONTRACT_ID}/bindings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "mcp",
    "enabled": true,
    "tool_name": "get_weather",
    "tool_description": "Get current weather for a city"
  }' | jq .
```

Now the same contract is exposed over two protocols. The rate limit of 60 requests/minute applies to both — no separate policy needed.

## Step 5: Test the REST Endpoint

Call the weather API through the gateway's REST path:

```bash
curl -s "${STOA_GATEWAY_URL}/weather-api/v1/forecast?latitude=48.85&longitude=2.35" \
  -H "X-API-Key: your-api-key" | jq '.current_weather'
```

You should see weather data for Paris. The request passed through STOA's middleware pipeline: authentication, rate limiting, logging — all defined in your UAC contract.

## Step 6: Test the MCP Tool

Now call the same API as an MCP tool. AI agents use this format to discover and invoke tools:

```bash
# List available tools (MCP discovery)
curl -s "${STOA_GATEWAY_URL}/mcp/tools/list" \
  -H "Authorization: Bearer $TOKEN" | jq '.tools[] | select(.name == "get_weather")'
```

Expected output:

```json
{
  "name": "get_weather",
  "description": "Get current weather for a city",
  "inputSchema": {
    "type": "object",
    "properties": {
      "latitude": { "type": "number" },
      "longitude": { "type": "number" }
    }
  }
}
```

Call the tool:

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/tools/call" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_weather",
    "arguments": {
      "latitude": 48.85,
      "longitude": 2.35
    }
  }' | jq .
```

Same backend. Same rate limit. Same audit trail. Two protocols.

## Step 7: Verify Shared Policies

The rate limit applies across both protocols. Let's verify by checking the policy attached to the contract:

```bash
curl -s "${STOA_API_URL}/v1/contracts/${CONTRACT_ID}" \
  -H "Authorization: Bearer $TOKEN" | jq '.policies'
```

```json
[
  {
    "type": "rate_limit",
    "config": {
      "requests_per_minute": 60
    },
    "applied_to": ["rest", "mcp"]
  }
]
```

The `applied_to` field confirms that both bindings share the policy. If a consumer burns 50 requests via REST, they have 10 left for MCP calls — it's a single quota pool.

---

## What You've Built

In 5 minutes, you've experienced STOA's core value proposition:

| What | Traditional Approach | UAC Approach |
|------|---------------------|--------------|
| **API definition** | One config per gateway | One UAC contract |
| **Protocol support** | Separate REST + MCP configs | Single contract, multiple bindings |
| **Rate limiting** | Duplicate policies per protocol | Shared policy, single quota |
| **Monitoring** | Separate dashboards | Unified audit trail |

This is the "Define Once, Expose Everywhere" model. As STOA adds protocol bindings (GraphQL and gRPC are on the [roadmap](/docs/roadmap)), your existing contracts gain new capabilities without reconfiguration.

---

## Real-World Scenario: A SaaS With Human and AI Consumers

Imagine you run a logistics SaaS. Your REST API serves your web dashboard and mobile app. Now a customer wants their AI assistant to query shipment status automatically.

Without UAC, you'd build and maintain a separate MCP integration: new routes, new auth config, new rate limits, new monitoring. When you update the shipment schema, you update it in two places. When you change rate limits, you change them in two places. When something breaks, you debug two systems.

With UAC, you add one line — the MCP binding — and your existing contract, policies, and monitoring cover both use cases. The AI assistant gets the same auth, the same rate limits, and the same audit trail as your web dashboard. Schema changes propagate to both protocols automatically because there's only one source of truth.

This is not a hypothetical. As AI agents become first-class API consumers alongside humans, the platforms that treat them as just another protocol binding will scale. The ones that maintain parallel API stacks will not.

---

## How UAC Works Under the Hood

The UAC is a **normalized, gateway-agnostic API definition**. When you create a contract, STOA's control plane stores it as the source of truth. When you add bindings, the [Gateway Adapter](/docs/concepts/uac) translates the UAC into whatever format the target gateway needs.

```
           ┌──── REST binding ──── HTTP clients
UAC ───────┤
           └──── MCP binding  ──── AI agents (Claude, GPT, etc.)
```

If you later connect a Kong or Gravitee gateway, the same UAC contract syncs to their native format automatically. See the [architecture overview](/docs/concepts/architecture) for the full picture.

The key insight is that protocol bindings are **views** of the contract, not copies. There's no synchronization problem because there's nothing to synchronize — one contract, multiple read paths.

### What Happens When You Change Something?

| Action | Effect on REST | Effect on MCP |
|--------|---------------|---------------|
| Update backend URL | Immediate | Immediate |
| Change rate limit | Applies to REST requests | Applies to MCP tool calls |
| Rotate API key | REST calls need new key | MCP auth unchanged (uses OAuth) |
| Add a new field to the schema | Available in REST response | Available in MCP tool output |
| Disable the API | REST returns 404 | MCP tool disappears from listing |

No dual maintenance. No drift between configurations.

---

## FAQ

### Can I add GraphQL or gRPC bindings?

Not yet. REST and MCP are currently supported. GraphQL and gRPC bindings are planned — check the [roadmap](/docs/roadmap) for timeline. When they ship, your existing UAC contracts will support them without changes.

### How is this different from creating two separate APIs?

Two separate APIs mean two sets of policies, two monitoring streams, and two points of failure. With UAC, you manage one contract. Changes to rate limits, auth rules, or backend URLs propagate to all protocol bindings instantly.

### What about authentication?

UAC supports `oauth2`, `api_key`, `basic`, and `none` auth types. The auth configuration applies across all bindings. For protocol-specific auth (e.g., MCP OAuth 2.1 with PKCE), STOA handles the translation at the gateway layer.

### Can I use UAC with my existing Kong or Apigee gateway?

Yes. STOA's adapter pattern supports [7 gateway backends](/docs/concepts/architecture), including Kong, Gravitee, Apigee, Azure APIM, and AWS API Gateway. The UAC contract is translated to each gateway's native format.

---

## Next Steps

- **[UAC Concept Deep-Dive](/docs/concepts/uac)** — understand the full UAC schema, policy types, and GitOps flow
- **[Quick Start: First API in 5 Minutes](/blog/stoa-quickstart-first-api-5-minutes)** — deploy STOA locally with Docker Compose
- **[MCP Gateway with Docker](/blog/mcp-gateway-quickstart-docker)** — hands-on MCP gateway setup
- **[Week 1 with STOA: Operations Runbook](/blog/week-1-with-stoa-operations-runbook)** — from install to production-ready in 7 days
- **[What Is an MCP Gateway?](/blog/what-is-mcp-gateway)** — architecture and security model explained
