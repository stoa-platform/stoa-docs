---
sidebar_position: 1
---

# Quick Start Guide

Get your first STOA tenant up and running in 5 minutes.

## Prerequisites

Before you begin, ensure you have:

- Kubernetes cluster (v1.28+)
- `kubectl` configured
- `helm` CLI (v3.0+)
- Access to STOA Control Plane

## Step 1: Install STOA Platform

```bash
# Add STOA Helm repository
helm repo add stoa https://charts.gostoa.dev
helm repo update

# Install STOA Control Plane
helm install stoa-control-plane stoa/control-plane \
  --namespace stoa-system \
  --create-namespace \
  --set domain=api.your-domain.com
```

## Step 2: Create Your First Tenant

```bash
# Using STOA CLI
stoa tenant create \
  --name acme \
  --tier starter \
  --admin-email admin@acme.com

# Or via API
curl -X POST https://api.gostoa.dev/v1/tenants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "acme",
    "tier": "starter",
    "admin_email": "admin@acme.com"
  }'
```

## Step 3: Register an API

```bash
# Register your first API
stoa api register \
  --tenant acme \
  --name my-api \
  --upstream https://api.example.com \
  --path /my-api

# This creates:
# - Kong route: /acme/my-api -> https://api.example.com
# - API entry in catalog
# - Default policies (rate limiting, auth)
```

## Step 4: Test Your API

```bash
# Get your tenant's gateway endpoint
GATEWAY_URL=$(stoa tenant get acme -o json | jq -r '.gateway_url')

# Call your API through STOA
curl $GATEWAY_URL/my-api/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Step 5: Enable Authentication

```bash
# Configure Keycloak OIDC for your API
stoa api auth configure \
  --tenant acme \
  --api my-api \
  --provider keycloak \
  --issuer https://auth.gostoa.dev/realms/acme

# Now your API requires valid JWT tokens
```

## Next Steps

Congratulations! You now have:
- A running STOA tenant
- An API registered and proxied through Kong
- Authentication enabled via Keycloak

### Learn More

- [Authentication Setup](/docs/guides/authentication) - Configure advanced auth scenarios
- [API Subscriptions](/docs/guides/subscriptions) - Manage API access
- [Architecture Overview](/docs/concepts/architecture) - Deep dive into STOA architecture
- [API Reference](/docs/api/control-plane) - Full API documentation

### Common Tasks

- **Add More APIs**: Repeat Step 3 for additional APIs
- **Configure Rate Limiting**: `stoa api policy add-rate-limit`
- **Enable Monitoring**: `stoa tenant metrics enable`
- **Custom Domains**: `stoa tenant domain add`

---

🚧 **Need Help?** Join our [Discord community](https://discord.gg/stoa-platform) or check [GitHub Issues](https://github.com/stoa-platform/stoa/issues).
