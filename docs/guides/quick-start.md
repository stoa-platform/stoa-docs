---
sidebar_position: 1
slug: /guides/quickstart
title: "Quickstart: Connect an AI Agent to Your API"
description: "Connect Claude to your APIs through a STOA instance you run yourself — install, set your MCP server URL, and make your first AI tool call."
keywords:
  - STOA quickstart
  - getting started API gateway
  - MCP AI agent tutorial
  - connect Claude to API
  - first tool call
---

# Quickstart: Connect an AI Agent to Your API

Get from zero to your first AI-powered API call in under 5 minutes.

:::info Self-hosted only
The public STOA cloud (console, signup, API, and the MCP gateway) was shut down on 23 May 2026. This guide assumes a STOA instance **you** install. The documentation site at [docs.gostoa.dev](https://docs.gostoa.dev) is unchanged.

Examples use the reserved name `stoa.example`. Replace it with the domain of your installation.
:::

## What You'll Accomplish

By the end of this guide, an AI agent (Claude) will discover and call an API through your STOA gateway.

## Step 1: Install STOA

Pick one path:

1. **Local, with Docker** — [Self-host in 5 minutes with stoactl](/docs/guides/stoactl-quickstart)
2. **Kubernetes** — [Installation guide](/docs/admin/installation)

Then note the URLs of **your** instance:

| Component | Example |
|-----------|---------|
| MCP gateway | `https://mcp.stoa.example/mcp/sse` |
| Keycloak | `https://auth.stoa.example` |
| Console | `https://console.stoa.example` |


## Step 2: Connect Claude to STOA

1. Open [claude.ai](https://claude.ai) (Pro or Team plan required for MCP)
2. Go to **Settings** → **Integrations** → **Add MCP Server**
3. Enter:
   - **URL**: `https://mcp.stoa.example/mcp/sse`
   - **Name**: `STOA Platform`
4. Authenticate with your STOA credentials when prompted

That's it. Claude is now connected to your STOA gateway.

## Step 3: Make Your First AI Tool Call

Ask Claude:

> "What tools are available in STOA?"

Claude uses the MCP connection to discover your API catalog and shows you the available tools.

Then ask:

> "Use the echo tool to send a test message"

Claude will call the tool through STOA and return the result.

**You just experienced "Time To First Agent Call"** — an AI agent discovered and called an API autonomously.

---

## What Happened Behind the Scenes

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Claude  │────▶│ STOA Gateway │────▶│ Backend API │
│ (Agent)  │◀────│  (MCP + Auth)│◀────│             │
└──────────┘     └──────────────┘     └─────────────┘
```

STOA handled:
- **Discovery**: Claude found available tools via MCP `tools/list`
- **Authentication**: OAuth 2.1 with PKCE (no secrets exposed)
- **Authorization**: Verified your tenant access
- **Routing**: Forwarded the call to the correct backend
- **Observability**: Logged the call for analytics

---

## Register Your Own API

Ready to expose your own backend API as an AI tool?

1. In the Console, go to **Backend APIs** → **Register API**
2. Enter your API's name and backend URL
3. STOA auto-generates MCP tools from your OpenAPI spec
4. Create a **scoped API key** under **API Keys** for programmatic access

Your API is now callable by any connected AI agent.

---

## Alternative: Use curl Instead of Claude

If you prefer the command line, you can call STOA directly:

```bash
# Get an OAuth token
TOKEN=$(curl -s -X POST "https://auth.stoa.example/realms/stoa/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# List available tools
curl -s "https://mcp.stoa.example/mcp/tools/list" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.tools[] | {name, description}'

# Call a tool
curl -s -X POST "https://mcp.stoa.example/mcp/tools/call" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "echo", "arguments": {"message": "hello"}}' | jq
```

---

## Next Steps

| Goal | Guide |
|------|-------|
| Connect an agent to your gateway | [MCP for Developers](/docs/guides/mcp-developer-guide) |
| Build custom MCP tools | [MCP Tools Development](/docs/guides/mcp-tools-development) |
| Manage API subscriptions | [Subscription Lifecycle](/docs/guides/subscriptions-lifecycle) |
| Choose a deployment layout | [Deployment models](/docs/deployment/hybrid) |
| Understand MCP protocol | [MCP Protocol Fiche](/docs/guides/fiches/mcp-protocol) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Claude can't connect to MCP server | Use your gateway URL, for example `https://mcp.stoa.example/mcp/sse` — note the `/mcp/sse` path |
| "Unauthorized" after connecting | Re-authenticate: disconnect and reconnect the MCP server in Claude settings |
| No tools appear | Your tenant may have no APIs registered yet — register one in the Console |
| curl returns `401` | Token expired (default: 5 min) — re-run the token command |
