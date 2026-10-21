---
sidebar_position: 10
title: "MCP for Developers: Zero to Tool Call in 2 Minutes"
description: "Connect Claude.ai, Python, or TypeScript to the MCP gateway of a STOA instance you run — a URL and a token on your domain."
keywords:
  - MCP developer guide
  - connect Claude to MCP
  - STOA MCP tutorial
  - Python MCP client
  - TypeScript MCP client
  - hosted MCP gateway
---

# MCP for Developers

Connect Claude.ai, Python, or TypeScript to the MCP gateway of a STOA instance you already run.

:::info Your gateway
The public gateway at `mcp.stoa.example` was shut down on 23 May 2026. Examples below use `https://mcp.stoa.example`. Replace that host with the gateway of your installation. Install first: [stoactl quickstart](/docs/guides/stoactl-quickstart) or the [Kubernetes guide](/docs/admin/installation).
:::

## Option A: Claude.ai (Fastest)

The fastest path. Claude handles authentication automatically via OAuth 2.1.

### 1. Add the MCP Server

In [claude.ai](https://claude.ai): **Settings** → **Integrations** → **Add MCP Server**

| Field | Value |
|-------|-------|
| URL | `https://mcp.stoa.example/mcp/sse` |
| Name | `STOA Platform` |

Sign in with your STOA credentials when prompted.

### 2. Discover and Call Tools

Ask Claude:

> "List the tools available in STOA, then call the echo tool with the message 'hello world'"

Claude discovers your tools via `tools/list`, calls `tools/call`, and returns the result. That's it.

---

## Option B: Python

Use the MCP Python SDK or plain HTTP.

### With `httpx` (No SDK)

```python
import httpx

GATEWAY = "https://mcp.stoa.example"
TOKEN = "your-access-token"  # See "Get a Token" below

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

# List tools
resp = httpx.post(f"{GATEWAY}/mcp/tools/list", headers=headers, json={})
tools = resp.json()["tools"]
for tool in tools:
    print(f"  {tool['name']}: {tool.get('description', '')}")

# Call a tool
resp = httpx.post(
    f"{GATEWAY}/mcp/tools/call",
    headers=headers,
    json={"name": "echo", "arguments": {"message": "hello from Python"}},
)
print(resp.json())
```

### With the MCP SDK

```python
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    async with sse_client("https://mcp.stoa.example/mcp/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # List tools
            tools = await session.list_tools()
            for tool in tools.tools:
                print(f"  {tool.name}: {tool.description}")

            # Call a tool
            result = await session.call_tool("echo", {"message": "hello"})
            print(result)

import asyncio
asyncio.run(main())
```

> **Install**: `pip install mcp httpx`

---

## Option C: TypeScript

### With `fetch` (No SDK)

```typescript
const GATEWAY = "https://mcp.stoa.example";
const TOKEN = "your-access-token"; // See "Get a Token" below

// List tools
const toolsResp = await fetch(`${GATEWAY}/mcp/tools/list`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});
const { tools } = await toolsResp.json();
console.log("Available tools:", tools.map((t: any) => t.name));

// Call a tool
const callResp = await fetch(`${GATEWAY}/mcp/tools/call`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "echo",
    arguments: { message: "hello from TypeScript" },
  }),
});
console.log(await callResp.json());
```

### With the MCP SDK

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("https://mcp.stoa.example/mcp/sse")
);
const client = new Client(
  { name: "my-app", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

await client.connect(transport);

// List tools
const { tools } = await client.listTools();
console.log("Tools:", tools.map((t) => t.name));

// Call a tool
const result = await client.callTool({
  name: "echo",
  arguments: { message: "hello" },
});
console.log(result);

await client.close();
```

> **Install**: `npm install @modelcontextprotocol/sdk`

---

## Get a Token

For Python/TypeScript (Option B and C), you need an OAuth access token.

### Quick: Client Credentials

```bash
TOKEN=$(curl -s -X POST "https://auth.stoa.example/realms/stoa/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

echo $TOKEN
```

Get your `CLIENT_ID` and `CLIENT_SECRET` from the Console under **API Keys**.

### Quick: SaaS API Key

If you created a scoped API key in the Console (under **API Keys**), use it directly:

```bash
curl -s "https://mcp.stoa.example/mcp/tools/list" \
  -H "X-API-Key: stoa_saas_xxxx_your_key_here" | jq
```

No OAuth flow needed — the API key authenticates directly.

---

## Claude Desktop Config

To use STOA from **Claude Desktop** (local app), add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stoa": {
      "url": "https://mcp.stoa.example/mcp/sse"
    }
  }
}
```

Config file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop after saving. You'll be prompted to authenticate on first use.

---

## What's Next

| Goal | Guide |
|------|-------|
| Register your own backend API | [Quickstart](/docs/guides/quickstart#register-your-own-api) |
| Build custom MCP tools with CRDs | [MCP Tools Development](/docs/guides/mcp-tools-development) |
| Understand MCP protocol internals | [MCP Protocol Fiche](/docs/guides/fiches/mcp-protocol) |
| Self-host STOA on your infra | [Hybrid Deployment](/docs/deployment/hybrid) |
| Full MCP API reference | [MCP Gateway API](/docs/api/mcp-gateway) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` | Token expired (5 min default). Re-run the token command |
| `403 Forbidden` | Your tenant doesn't have access to this tool. Check API key scopes |
| SSE connection drops | Network timeout. The gateway closes idle SSE connections after 5 min |
| "No tools found" | No APIs registered in your tenant. Register one in the Console |
| Claude says "MCP server unavailable" | Check URL ends with `/mcp/sse`. Disconnect and reconnect in Settings |
| Python `ConnectionError` | Verify `httpx` is installed and the URL is reachable: `curl https://mcp.stoa.example/health` |
