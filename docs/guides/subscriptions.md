---
sidebar_position: 3
---

# API & Tool Subscriptions

Manage API access through subscription-based model.

## Overview

STOA implements a subscription-based access model:

- **Self-Service Discovery** - Browse available APIs/tools
- **Subscription Management** - Request and manage access
- **Approval Workflows** - Manual or automatic approval
- **Usage Tracking** - Monitor subscription usage
- **Billing Integration** - (Future) Usage-based billing

## Subscription Model

```
User/App → Subscribe → API/Tool → Generate API Key → Access
```

## API Catalog

### Browse Available APIs

```bash
# List all APIs in catalog
stoa catalog list --tenant acme

# Search for specific API
stoa catalog search --query "payment"

# Get API details
stoa catalog get payment-api
```

### API Catalog Entry

Each API includes:

- **Name & Description** - What the API does
- **Version** - API version
- **Documentation** - OpenAPI spec, guides
- **Endpoints** - Available paths
- **Pricing Tier** - Free, paid, etc.
- **Rate Limits** - Request quotas
- **SLA** - Uptime guarantees

## Subscription Lifecycle

### 1. Create Subscription

```bash
# Subscribe to an API
stoa subscription create \
  --tenant acme \
  --api payment-api \
  --plan community \
  --app my-mobile-app

# Response includes:
# - Subscription ID
# - API key (if auto-approved)
# - Status (pending/active)
```

### 2. Approval (if required)

```bash
# API owner reviews subscription request
stoa subscription approve \
  --subscription-id sub-12345 \
  --rate-limit 1000/hour

# Or reject
stoa subscription reject \
  --subscription-id sub-12345 \
  --reason "Invalid use case"
```

### 3. API Key Management

```bash
# List your API keys
stoa apikey list --tenant acme

# Rotate API key
stoa apikey rotate \
  --subscription-id sub-12345

# Revoke API key
stoa apikey revoke \
  --key sk_live_abc123
```

### 4. Monitor Usage

```bash
# Check subscription usage
stoa subscription usage \
  --subscription-id sub-12345 \
  --period last-30-days

# Output:
# Requests: 45,231
# Errors: 23 (0.05%)
# P95 Latency: 124ms
# Quota Used: 45.2%
```

## Subscription Plans

### Plan Tiers

| Plan | Self-Hosted | Managed SaaS | Price |
|------|-------------|--------------|-------|
| **Community** | Unlimited, forever | 1M requests/month | Free |
| **Enterprise** | N/A | Unlimited + SLA 99.9% | €500/month |
| **Sovereign** | On-premise option | Dedicated EU infra | Custom |

:::info Self-Hosted Licensing
STOA is Apache 2.0 licensed. Self-hosted deployments are **free, forever, unlimited**.
We monetize managed services and enterprise support.
:::

### Configure Plan

```bash
# API owner defines subscription plans
stoa api plan create \
  --api payment-api \
  --name enterprise \
  --rate-limit unlimited \
  --quota unlimited \
  --features "SLA 99.9%,Priority support,Webhook notifications"
```

## Developer Portal

### Self-Service Portal

STOA provides a web portal for developers:

- **API Discovery** - Browse catalog
- **Interactive Docs** - Try API endpoints
- **Subscription Management** - Create/manage subscriptions
- **Usage Dashboard** - View analytics
- **Billing** - Manage payment methods

Access portal at: `https://portal.gostoa.dev/{tenant}`

### Portal Configuration

```bash
# Customize developer portal
stoa portal configure \
  --tenant acme \
  --logo https://acme.com/logo.png \
  --primary-color "#4F46E5" \
  --custom-domain portal.acme.com
```

## API Keys

### Types of API Keys

1. **User API Keys** - Tied to individual user
2. **Application Keys** - Tied to application/service
3. **Environment Keys** - Separate keys for dev/staging/prod

### Key Format

```
sk_live_abc123xyz789...     # Production
sk_test_abc123xyz789...     # Sandbox/Test
```

### Using API Keys

```bash
# In request header
curl https://gateway.gostoa.dev/acme/payment-api/charge \
  -H "X-API-Key: sk_live_abc123xyz789"

# Or as query parameter (not recommended)
curl https://gateway.gostoa.dev/acme/payment-api/charge?apikey=sk_live_abc123
```

## Webhooks

Subscribe to events:

```bash
# Register webhook for subscription events
stoa webhook create \
  --tenant acme \
  --url https://myapp.com/webhooks/stoa \
  --events subscription.created,subscription.cancelled \
  --secret whsec_abc123
```

### Webhook Events

- `subscription.created` - New subscription
- `subscription.approved` - Subscription approved
- `subscription.cancelled` - Subscription cancelled
- `subscription.usage_threshold` - Usage quota warning
- `apikey.rotated` - API key rotated
- `apikey.revoked` - API key revoked

## Usage Quotas

### Enforce Quotas

```bash
# Set usage quotas
stoa subscription quota set \
  --subscription-id sub-12345 \
  --requests 50000/month \
  --bandwidth 10GB/month

# Check quota status
stoa subscription quota get \
  --subscription-id sub-12345
```

### Quota Exceeded

When quota exceeded:

- HTTP 429 response (Too Many Requests)
- `X-RateLimit-*` headers included
- Webhook notification sent
- Portal notification displayed

## Advanced Features

### Subscription Groups

Group subscriptions for shared quotas:

```bash
stoa subscription-group create \
  --tenant acme \
  --name mobile-apps \
  --shared-quota 100000/month
```

### Conditional Access

Restrict access based on conditions:

```bash
# Allow access only from specific IPs
stoa subscription acl add \
  --subscription-id sub-12345 \
  --allow-ips 203.0.113.0/24

# Restrict to certain endpoints
stoa subscription scope set \
  --subscription-id sub-12345 \
  --allow-paths "/read/*,/list/*" \
  --deny-paths "/admin/*"
```

---

## Next Steps

- [Authentication Setup](/docs/guides/authentication) — Configure SSO and OIDC
- [API Reference](/docs/api/control-plane) — Full API documentation
- [CLI Reference](/docs/reference/cli) — Manage subscriptions via CLI
- [FAQ](/docs/faq) — Common questions answered
