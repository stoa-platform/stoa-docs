---
sidebar_position: 3
slug: /tutorials/self-service-subscription
title: "Self-Service API Subscription in 2 Clicks"
description: "Let developers discover, try, and subscribe to your APIs without waiting for approval — from the Developer Portal."
keywords:
  - API subscription
  - self-service portal
  - developer portal tutorial
  - API key provisioning
  - STOA portal
---

# Self-Service API Subscription

Let developers discover, try, and subscribe to your APIs without waiting for email threads and meetings.

## What You'll Accomplish

By the end of this tutorial:
- A developer finds your API in the Portal
- They subscribe in 2 clicks
- They get an API key instantly
- They make their first call — all self-service

## Prerequisites

- A STOA instance with at least one API published
- The Developer Portal accessible at your `portal` URL

## Step 1: Discover the API

Open the [Developer Portal](https://portal.gostoa.dev) and browse the API catalog.

Each API shows:
- **Description** and version
- **Available plans** (Free, Standard, Premium) with rate limits
- **OpenAPI documentation** with try-it-out
- **MCP tools** (if MCP exposure is enabled)

## Step 2: Subscribe

Click **Subscribe** on the API you want. Choose a plan:

| Plan | Rate Limit | Approval |
|------|-----------|----------|
| Free | 100 req/min | Automatic |
| Standard | 1,000 req/min | Automatic |
| Premium | 10,000 req/min | Manual approval |

For Free and Standard plans, your subscription is **instantly active**. No waiting.

## Step 3: Get Your API Key

After subscribing, the Portal shows your API key:

```
Your API Key: sk-stoa-xxxxxxxxxxxxxxxxxxxx

Use this key in the Authorization header:
Authorization: Bearer sk-stoa-xxxxxxxxxxxxxxxxxxxx
```

You can also retrieve it from the **My Subscriptions** page at any time.

## Step 4: Make Your First Call

```bash
# REST call
curl ${STOA_GATEWAY_URL}/weather/paris \
  -H "Authorization: Bearer sk-stoa-xxxxxxxxxxxxxxxxxxxx"

# Or via MCP (if enabled)
curl -X POST ${STOA_GATEWAY_URL}/mcp/tools/call \
  -H "Authorization: Bearer sk-stoa-xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "get-weather", "arguments": {"city": "Paris"}}'
```

## What the Admin Sees

In the Console, the API owner sees:
- New subscription with developer details
- Usage metrics per subscriber
- The ability to revoke or upgrade plans

No email was sent. No meeting was scheduled. The developer went from discovery to first call in under 2 minutes.

## Next Steps

- [Expose your REST API as MCP tools](/docs/tutorials/expose-rest-as-mcp)
- [API key rotation guide](/docs/guides/api-key-rotation)
- [Subscription lifecycle management](/docs/guides/subscriptions-lifecycle)
- [Consumer onboarding guide](/docs/guides/consumer-onboarding)
