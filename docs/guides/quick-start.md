---
sidebar_position: 1
slug: /guides/quickstart
title: "Quickstart: Your First API in 5 Minutes"
description: Deploy your first API through STOA and call it from an AI agent
---

# ⚡ Quickstart: Your First API in 5 Minutes

:::info Early Access — Private Beta
STOA Platform is currently in private beta. The walkthrough below shows what the experience looks like once you have access. [Request access](mailto:christophe@hlfh.io) to get started.
:::

Get from zero to your first AI-accessible API in under 5 minutes.

## What You'll Build

By the end of this guide, you'll have:
- ✅ An API registered in STOA's catalog
- ✅ A subscription with API credentials
- ✅ A working call through the MCP Gateway
- ✅ An AI agent (Claude) discovering and calling your API

## Prerequisites

Choose your path:

| Path | You Need | Best For |
|------|----------|----------|
| **🤖 AI-First** | Claude.ai Pro/Team with MCP enabled | Experiencing the "Time To First Agent Call" |
| **🖥️ Console** | Browser + STOA account | Visual learners, no CLI needed |
| **⌨️ API** | `curl` + terminal | Automation, scripting, CI/CD |

---

## Option A: AI-First Path (Recommended) 🤖

*Experience STOA's killer feature: AI agents discovering and calling APIs autonomously.*

### Step 1: Connect Claude to STOA (one-time setup)

1. Open [Claude.ai](https://claude.ai) → Settings → Integrations
2. Add MCP Server:
   ```
   URL: https://mcp.gostoa.dev/mcp/sse
   Name: STOA Platform
   ```
3. Authenticate with your STOA credentials

### Step 2: Discover Available APIs

Simply ask Claude:

> "What APIs are available in STOA?"

Claude will use the `stoa_catalog` tool and show you the API catalog.

### Step 3: Subscribe to an API

Ask Claude:

> "Subscribe me to the Billing API with the standard plan"

Claude will:
1. Check if you have access (`stoa_subscription` → `list`)
2. Create the subscription (`stoa_subscription` → `create`)
3. Return your credentials

### Step 4: Make Your First Call

Ask Claude:

> "Use my Billing API subscription to list recent invoices"

🎉 **Congratulations!** You just experienced "Time To First Agent Call" — an AI agent discovered, subscribed to, and called an API without you writing a single line of code.

---

## Option B: Console Path 🖥️

*Visual, no-code approach through the STOA Portal.*

### Step 1: Access the Portal

Open [portal.gostoa.dev](https://portal.gostoa.dev) and sign in.

### Step 2: Browse the API Catalog

1. Navigate to **Catalog** in the sidebar
2. Browse available APIs by category
3. Click on an API to see its documentation

### Step 3: Subscribe

1. Click **Subscribe** on any API
2. Select a plan (Community, Enterprise, Sovereign)
3. Name your application (e.g., "My First App")
4. Click **Request Access**

### Step 4: Get Your Credentials

1. Go to **My Subscriptions**
2. Find your subscription
3. Click **View Credentials**
4. Copy your API Key

### Step 5: Test Your API

Use the built-in **API Playground**:
1. Select your subscription
2. Choose an endpoint
3. Click **Try It**
4. See the response!

---

## Option C: API Path ⌨️

*For developers who prefer curl and automation.*

### Step 1: Get an Access Token

```bash
# Set your credentials
export STOA_URL="https://api.gostoa.dev"
export CLIENT_ID="your-client-id"
export CLIENT_SECRET="your-client-secret"

# Get OAuth token from Keycloak
TOKEN=$(curl -s -X POST "https://auth.gostoa.dev/realms/stoa/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

echo "Token obtained: ${TOKEN:0:20}..."
```

### Step 2: List Available APIs

```bash
curl -s "${STOA_URL}/v1/portal/apis" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.apis[] | {name, description, status}'
```

Expected output:
```json
{
  "name": "billing-api",
  "description": "Invoice and payment management",
  "status": "active"
}
```

### Step 3: Subscribe to an API

```bash
curl -X POST "${STOA_URL}/v1/subscriptions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "api_id": "billing-api",
    "plan": "standard",
    "application_name": "my-first-app"
  }' | jq
```

Response:
```json
{
  "id": "sub-abc123",
  "status": "active",
  "api_key": "stoa_sk_live_xxxxxxxxxxxxx"
}
```

### Step 4: Call Your API

```bash
API_KEY="stoa_sk_live_xxxxxxxxxxxxx"

curl "${STOA_URL}/gateway/billing-api/v1/invoices" \
  -H "X-API-Key: ${API_KEY}" | jq
```

🎉 **Done!** Your first API call through STOA.

---

## What Just Happened?

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  You/Agent  │────▶│    STOA     │────▶│ Backend API │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌─────▼─────┐
              │  Auth     │ │  Metrics  │
              │ (Keycloak)│ │ (Prom/OT) │
              └───────────┘ └───────────┘
```

STOA handled:
- **Authentication**: Validated your credentials
- **Authorization**: Checked your subscription
- **Rate Limiting**: Applied your plan's limits
- **Observability**: Logged the call for analytics
- **Routing**: Forwarded to the correct backend

---

## Next Steps

Now that you've made your first call, explore further:

| Goal | Guide |
|------|-------|
| Add your own API to the catalog | [Control Plane API](/docs/api/control-plane) |
| Understand the architecture | [Architecture Overview](/docs/concepts/architecture) |
| Connect more AI agents | [MCP Integration](/docs/concepts/mcp-gateway) |
| Deploy STOA on your infrastructure | [Hybrid Deployment](/docs/deployment/hybrid) |

---

## Troubleshooting

### "Unauthorized" error

- Check your token hasn't expired (default: 5 minutes)
- Verify `client_id` and `client_secret` are correct
- Ensure the client has the right scopes

### "Subscription not found"

- Confirm the subscription is `active` (not `pending`)
- Check you're using the correct API key

### MCP connection fails in Claude

- Verify the MCP server URL is correct
- Check your STOA account has MCP access enabled
- Try disconnecting and reconnecting

---

## Need Help?

- 📚 [Full Documentation](https://docs.gostoa.dev)
- 💬 [Discord Community](https://discord.gg/j8tHSSes)
- 📧 [Request Beta Access](mailto:christophe@hlfh.io)
