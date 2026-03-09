---
sidebar_position: 2
slug: /tutorials/expose-rest-as-mcp
title: "Expose a REST API as an MCP Tool in 10 Minutes"
description: "Turn any REST API into an MCP tool that AI agents can discover and call — no code changes needed."
keywords:
  - REST to MCP
  - MCP tool tutorial
  - API gateway MCP
  - AI agent API
  - STOA tutorial
---

# Expose a REST API as an MCP Tool

Turn any REST API into an MCP tool that AI agents can discover and call — no code changes to your API needed.

## What You'll Accomplish

By the end of this tutorial:
- Your REST API is registered in STOA
- It's discoverable via MCP tool discovery
- An AI agent can call it through the governed gateway

## Prerequisites

- A STOA instance (cloud or [self-hosted](/docs/deployment/hybrid))
- A REST API with an OpenAPI spec (or we'll create a simple one)

## Step 1: Register Your API

Log into the [Console](https://console.gostoa.dev) and navigate to **APIs > Create API**.

```bash
# Or via the CLI:
curl -X POST ${STOA_API_URL}/v1/apis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "weather-api",
    "description": "Get weather forecasts by city",
    "version": "1.0.0",
    "spec_url": "https://api.example.com/openapi.json"
  }'
```

STOA reads your OpenAPI spec and creates the API entry with all endpoints mapped.

## Step 2: Enable MCP Exposure

In the Console, go to your API's **Settings** tab and toggle **MCP Exposure** to ON.

STOA automatically transforms your OpenAPI operations into MCP tools:
- `GET /weather/{city}` becomes an MCP tool named `get-weather`
- Parameters become tool input schemas
- Response schemas become tool output descriptions

```bash
# Verify MCP tools are listed
curl ${STOA_GATEWAY_URL}/mcp/tools/list \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "tools": [
    {
      "name": "get-weather",
      "description": "Get weather forecasts by city",
      "inputSchema": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "City name" }
        },
        "required": ["city"]
      }
    }
  ]
}
```

## Step 3: Call the Tool via MCP

An AI agent (or you, via curl) can now call the tool:

```bash
curl -X POST ${STOA_GATEWAY_URL}/mcp/tools/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get-weather",
    "arguments": { "city": "Paris" }
  }'
```

STOA handles:
- **Authentication**: validates your token, applies RBAC
- **Rate limiting**: enforces your subscription plan's quota
- **Audit trail**: logs the tool call with caller identity and response time
- **Protocol translation**: converts the MCP call to the REST backend call

## What Happened Behind the Scenes

```
AI Agent → MCP tools/call → STOA Gateway → REST API backend
                              ↓
                         Auth + RBAC
                         Rate limiting
                         Audit logging
                         Protocol translation
```

Your REST API didn't change at all. STOA sits in front, providing the MCP interface and governance layer.

## Next Steps

- [Subscribe to an API with self-service](/docs/tutorials/self-service-subscription)
- [Configure rate limiting](/docs/guides/subscriptions-lifecycle)
- [Set up observability dashboards](/docs/guides/observability)
- [Develop custom MCP tools](/docs/guides/mcp-tools-development)
