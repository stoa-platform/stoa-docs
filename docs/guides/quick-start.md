---
sidebar_position: 1
slug: /guides/quickstart
title: "Quickstart: Connect an AI Agent to Your API"
description: "Connect Claude to your APIs through STOA in under 5 minutes — sign up, get your MCP server URL, and make your first AI tool call."
keywords:
  - STOA quickstart
  - getting started API gateway
  - MCP AI agent tutorial
  - connect Claude to API
  - first tool call
---

# Quickstart: Connect an AI Agent to Your API

Get from zero to your first AI-powered API call in under 5 minutes.

:::info Hosted Cloud
This guide uses STOA's hosted cloud at **mcp.gostoa.dev**. No Docker, no kubectl, no infrastructure needed. Self-hosting? See [Hybrid Deployment](/docs/deployment/hybrid).
:::

## What You'll Accomplish

By the end of this guide, an AI agent (Claude) will discover and call an API through STOA — without you writing a single line of code.

## Step 1: Create Your Account

1. Go to [console.gostoa.dev](https://console.gostoa.dev) and click **Sign Up**
2. Fill in your email and choose a password
3. You're in — STOA creates your tenant automatically

:::tip Already have an account?
Skip to [Step 2](#step-2-connect-claude-to-stoa).
:::

## Step 2: Connect Claude to STOA

1. Open [claude.ai](https://claude.ai) (Pro or Team plan required for MCP)
2. Go to **Settings** → **Integrations** → **Add MCP Server**
3. Enter:
   - **URL**: `https://mcp.gostoa.dev/mcp/sse`
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
TOKEN=$(curl -s -X POST "https://auth.gostoa.dev/realms/stoa/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# List available tools
curl -s "https://mcp.gostoa.dev/mcp/tools/list" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.tools[] | {name, description}'

# Call a tool
curl -s -X POST "https://mcp.gostoa.dev/mcp/tools/call" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "echo", "arguments": {"message": "hello"}}' | jq
```

---

## Next Steps

| Goal | Guide |
|------|-------|
| Connect Claude with zero kubectl | [MCP for Developers](/docs/guides/mcp-developer-guide) |
| Build custom MCP tools | [MCP Tools Development](/docs/guides/mcp-tools-development) |
| Manage API subscriptions | [Subscription Lifecycle](/docs/guides/subscriptions-lifecycle) |
| Deploy on your own infrastructure | [Hybrid Deployment](/docs/deployment/hybrid) |
| Understand MCP protocol | [MCP Protocol Fiche](/docs/guides/fiches/mcp-protocol) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Claude can't connect to MCP server | Check the URL is `https://mcp.gostoa.dev/mcp/sse` — note the `/mcp/sse` path |
| "Unauthorized" after connecting | Re-authenticate: disconnect and reconnect the MCP server in Claude settings |
| No tools appear | Your tenant may have no APIs registered yet — register one in the Console |
| curl returns `401` | Token expired (default: 5 min) — re-run the token command |
