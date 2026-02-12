---
sidebar_position: 2
title: "Authentication Setup"
description: "Configure OIDC/OAuth2 authentication with Keycloak for STOA Platform — multi-realm, JWT tokens, and role-based access."
keywords: [authentication, Keycloak, OIDC, OAuth2, JWT, RBAC]
---

# Authentication Setup

Configure authentication and authorization using Keycloak OIDC.

## Overview

STOA uses Keycloak for centralized authentication and authorization:

- **OIDC/OAuth2** - Industry-standard protocols
- **Multi-Realm** - Isolated realm per tenant
- **JWT Tokens** - Stateless token validation
- **SSO Support** - Single Sign-On across APIs

## Keycloak Architecture

```
┌──────────────────────────────────────────────┐
│           Keycloak Master Realm              │
├──────────────────────────────────────────────┤
│  Tenant Realms:                              │
│  ├── realm-acme                              │
│  ├── realm-globex                            │
│  └── realm-initech                           │
└──────────────────────────────────────────────┘
```

Each tenant realm contains:
- Users and groups
- Client applications
- Roles and permissions
- Identity providers (SAML, social login)

## Setup OIDC for an API

### Step 1: Create API Client in Keycloak

STOA automatically creates a client when you register an API:

```bash
stoa api register \
  --tenant acme \
  --name my-api \
  --upstream https://api.example.com \
  --path /my-api \
  --auth-enabled true
```

This creates:
- Client ID: `api-my-api`
- Access Type: `confidential`
- Valid Redirect URIs configured
- Service account enabled

### Step 2: Configure STOA Gateway OIDC

STOA Gateway automatically configures OIDC, but you can customize:

```bash
stoa api auth configure \
  --tenant acme \
  --api my-api \
  --issuer ${STOA_AUTH_URL}/realms/acme \
  --client-id api-my-api \
  --client-secret <secret> \
  --scope openid,profile,email
```

### Step 3: Test Authentication

```bash
# Get access token
TOKEN=$(curl -X POST \
  ${STOA_AUTH_URL}/realms/acme/protocol/openid-connect/token \
  -d "client_id=api-my-api" \
  -d "client_secret=${STOA_CLIENT_SECRET}" \
  -d "grant_type=client_credentials" \
  | jq -r '.access_token')

# Call API with token
curl ${STOA_GATEWAY_URL}/acme/my-api/users \
  -H "Authorization: Bearer $TOKEN"
```

## Authentication Flows

### 1. Client Credentials Flow

For machine-to-machine authentication:

```bash
# Request token
POST /realms/{tenant}/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=api-my-api&
client_secret=${STOA_CLIENT_SECRET}&
grant_type=client_credentials&
scope=api:read api:write
```

### 2. Authorization Code Flow

For user authentication (web apps):

```bash
# Step 1: Redirect user to login
GET /realms/{tenant}/protocol/openid-connect/auth
  ?client_id=my-web-app
  &redirect_uri=https://myapp.com/callback
  &response_type=code
  &scope=openid

# Step 2: Exchange code for token
POST /realms/{tenant}/protocol/openid-connect/token
  client_id=my-web-app&
  code=AUTH_CODE&
  grant_type=authorization_code&
  redirect_uri=https://myapp.com/callback
```

### 3. Resource Owner Password Flow

For trusted applications only:

```bash
POST /realms/{tenant}/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=trusted-app&
client_secret=${STOA_CLIENT_SECRET}&
grant_type=password&
username=user@example.com&
password=userpass
```

## Token Validation

STOA Gateway validates JWT tokens automatically:

1. **Signature Validation** - Verifies token signature using Keycloak's public keys
2. **Expiration Check** - Ensures token hasn't expired
3. **Audience Validation** - Checks token is for correct API
4. **Scope Check** - Validates required scopes are present

## Role-Based Access Control (RBAC)

### Define Roles in Keycloak

```bash
# Create realm role
stoa auth role create \
  --tenant acme \
  --name api-admin \
  --description "API Administrator"

# Assign role to user
stoa auth role assign \
  --tenant acme \
  --user user@example.com \
  --role api-admin
```

### Enforce Roles in STOA Gateway

```bash
# Require specific role for route
stoa api auth require-role \
  --tenant acme \
  --api my-api \
  --path /admin/* \
  --role api-admin
```

## Advanced Configuration

### Custom Token Claims

Add custom claims to JWT tokens:

```bash
stoa auth claim add \
  --tenant acme \
  --name tenant_id \
  --value acme \
  --token-type access
```

### Token Lifetime

Configure token expiration:

```bash
stoa auth token-lifetime set \
  --tenant acme \
  --access-token 3600 \
  --refresh-token 86400
```

### Identity Provider Federation

Connect external IdPs (SAML, Google, GitHub):

```bash
stoa auth idp add \
  --tenant acme \
  --provider google \
  --client-id GOOGLE_CLIENT_ID \
  --client-secret GOOGLE_SECRET
```

## Troubleshooting

### Token Validation Fails

```bash
# Check token details
stoa auth token inspect YOUR_TOKEN

# Verify Keycloak connectivity
stoa auth test-connection --tenant acme
```

### Common Issues

- **Invalid signature**: Check Keycloak public keys are synced
- **Token expired**: Refresh token or request new one
- **Insufficient scope**: Ensure required scopes in token
- **Wrong audience**: Verify client_id matches API configuration

---

## Next Steps

Now that authentication is configured:

- [API Subscriptions](/docs/guides/subscriptions) — Manage access to your APIs
- [API Reference](/docs/api/control-plane) — Explore the Control Plane API
- [MCP Gateway](/docs/api/mcp-gateway) — Connect AI agents to your tools
- [FAQ](/docs/faq) — Common questions answered

---

**Need Help?** [GitHub Issues](https://github.com/stoa-platform/stoa/issues) · [Discord](https://discord.gostoa.dev)
