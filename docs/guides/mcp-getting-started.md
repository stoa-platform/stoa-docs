---
sidebar_position: 9
title: "MCP Getting Started: Your First AI Tool in 5 Minutes"
description: "Step-by-step guide to deploying your first MCP tool on STOA — from Tool CRD to AI agent invocation via SSE or REST."
keywords:
  - MCP getting started
  - Model Context Protocol tutorial
  - AI tool deployment
  - MCP server STOA
  - tool invocation
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# MCP Getting Started

Deploy your first MCP tool and invoke it from an AI agent — in 5 minutes.

## Prerequisites

| Requirement | Details |
|-------------|---------|
| STOA Platform | Running instance ([Quick Start](/docs/guides/quickstart)) |
| kubectl | Configured for your cluster |
| Tenant | At least one active tenant (e.g., `oasis`) |
| Keycloak | Token for authentication |

<EnvSetup />

## Step 1 — Define a Tool (CRD)

Create a `Tool` custom resource that wraps an existing API as an MCP tool:

```yaml
# my-tool.yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: get-weather
  namespace: stoa-system
spec:
  displayName: Get Weather
  description: "Returns current weather for a given city. Useful for travel planning and logistics."
  endpoint: https://api.weatherapi.com/v1/current.json
  method: GET
  inputSchema:
    type: object
    properties:
      q:
        type: string
        description: "City name or coordinates"
    required:
      - q
  auth: none
  rateLimit: "60/min"
  annotations:
    readOnly: true
    destructive: false
    idempotent: true
    openWorld: true
```

Apply it:

```bash
kubectl apply -f my-tool.yaml
```

Verify registration:

```bash
kubectl get tools.gostoa.dev -n stoa-system
```

```
NAME          DISPLAY NAME   ENDPOINT                                    REGISTERED
get-weather   Get Weather    https://api.weatherapi.com/v1/current.json  true
```

:::tip Tool Annotations
Annotations help AI agents make safe decisions:
- **readOnly**: Tool only reads data, no side effects
- **destructive**: Tool deletes or modifies data irreversibly
- **idempotent**: Calling twice produces the same result
- **openWorld**: Tool interacts with external systems
:::

## Step 2 — Discover Tools

### Option A: REST API

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/v1/tools" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.tools[].name'
```

### Option B: MCP Protocol (JSON-RPC)

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/tools/list" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.tools[] | {name, description}'
```

Both return the same tools. REST is simpler for scripts; JSON-RPC follows the MCP spec for AI agent integration.

## Step 3 — Invoke a Tool

### REST Invocation

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/v1/tools/invoke" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get-weather",
    "arguments": {"q": "Paris"}
  }' | jq '.content[0].text'
```

### MCP Protocol Invocation (JSON-RPC)

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/tools/call" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get-weather",
    "arguments": {"q": "Paris"}
  }'
```

**Response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"location\":{\"name\":\"Paris\"},\"current\":{\"temp_c\":12.0}}"
    }
  ],
  "isError": false
}
```

## Step 4 — Connect via SSE (Streaming)

For AI agents that need persistent connections, use Server-Sent Events:

```bash
# 1. Initialize a session
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/sse" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": { "tools": {} },
      "clientInfo": { "name": "my-agent", "version": "1.0" }
    },
    "id": 1
  }'
```

**Response includes:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": { "listChanged": true },
      "tokenOptimization": {
        "supported": true,
        "levels": ["none", "moderate", "aggressive"]
      }
    },
    "serverInfo": { "name": "stoa-gateway", "version": "0.1.0" }
  },
  "id": 1
}
```

After initialization, send tool calls on the same endpoint:

```bash
# 2. Call a tool via SSE
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/sse" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get-weather",
      "arguments": {"q": "London"}
    },
    "id": 2
  }'
```

:::info Protocol Versions
STOA supports MCP `2025-03-26` (latest) and `2024-11-05` (backward compatible). The gateway negotiates the highest mutually supported version during initialization.
:::

## Step 5 — Connect a ToolSet (External MCP Server)

To connect an existing MCP server (e.g., a team's internal tools), use the `ToolSet` CRD:

```yaml
# my-toolset.yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: internal-tools
  namespace: stoa-system
spec:
  upstream:
    url: https://tools.internal.example.com/mcp
    transport: sse
    auth:
      type: bearer
      secretRef: internal-tools-token
    timeoutSeconds: 30
  tools: []       # Empty = expose all discovered tools
  prefix: "int"   # Tools become int_tool_name (avoids collisions)
```

Apply and check:

```bash
kubectl apply -f my-toolset.yaml
kubectl get toolsets.gostoa.dev -n stoa-system
```

```
NAME             UPSTREAM                                    TOOLS   CONNECTED
internal-tools   https://tools.internal.example.com/mcp      5       true
```

The gateway automatically discovers tools from the upstream MCP server and exposes them.

## What's Next

| Topic | Link |
|-------|------|
| Build custom tools with CRDs | [MCP Tools Development](/docs/guides/mcp-tools-development) |
| MCP API reference | [MCP Gateway API](/docs/api/mcp-gateway) |
| MCP protocol deep-dive | [MCP Protocol Fiche](/docs/guides/fiches/mcp-protocol) |
| Manage subscriptions | [Subscriptions Guide](/docs/guides/subscriptions) |
| Tool and ToolSet CRD specs | [Kubernetes CRDs](/docs/reference/crds/) |

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Tool not listed | CRD not in `stoa-system` namespace | Check namespace: `kubectl get tools -A` |
| `401 Unauthorized` | Missing or expired token | Refresh Keycloak token |
| `registered: false` on Tool | Gateway hasn't synced | Check gateway logs: `kubectl logs deploy/stoa-gateway -n stoa-system` |
| ToolSet `connected: false` | Upstream unreachable | Verify URL + auth secret: `kubectl describe toolset <name>` |
| `SSRF blocked` on invoke | Backend URL resolves to private IP | Use public URL or container name (not localhost) |
