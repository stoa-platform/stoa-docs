---
sidebar_position: 4
slug: /tutorials/bridge-oracle-oam
title: "Bridge Oracle OAM Tokens via Keycloak (RFC 8693)"
description: "Federate Oracle OAM identity into STOA using IETF Token Exchange (RFC 8693) — no migration, no user disruption."
keywords:
  - Oracle OAM migration
  - token exchange RFC 8693
  - identity federation
  - Keycloak OAM bridge
  - legacy identity bridge
---

# Bridge Oracle OAM Tokens via Keycloak

Connect your Oracle OAM identity provider to STOA without migrating users or disrupting existing applications.

## What You'll Accomplish

By the end of this tutorial:
- Oracle OAM tokens are exchanged for STOA-compatible OIDC tokens via RFC 8693
- Users authenticate with OAM as before — no change for them
- STOA APIs and MCP tools accept the exchanged tokens
- Full audit trail across both identity systems

## The Problem

Your organization uses Oracle OAM for identity. You want to use STOA for API management and MCP governance. But:
- Migrating 10,000 users from OAM to Keycloak is a 6-month project
- Applications depend on OAM tokens — you can't break them
- You need both systems to coexist during the transition

## The Solution: Token Exchange (RFC 8693)

```
User → Oracle OAM → OAM Token
                         ↓
              Keycloak Token Exchange (RFC 8693)
                         ↓
                    OIDC Token (STOA-compatible)
                         ↓
              STOA Gateway → API / MCP Tools
```

The user authenticates with OAM as always. Behind the scenes, Keycloak exchanges the OAM token for an OIDC token that STOA understands.

## Step 1: Configure Keycloak Identity Provider

In Keycloak, create a new Identity Provider for Oracle OAM:

1. Go to **Identity Providers > Add provider > OpenID Connect v1.0**
2. Configure the OAM endpoints:

```
Authorization URL: https://oam.yourcompany.com/oauth2/authorize
Token URL: https://oam.yourcompany.com/oauth2/token
Client ID: stoa-bridge
Client Secret: (from OAM admin)
```

3. Enable **Trust Email** (OAM already verified the email)
4. Set **First Login Flow** to `first broker login`

## Step 2: Enable Token Exchange

In Keycloak, enable the Token Exchange feature for the STOA realm:

1. Go to **Clients > stoa-gateway > Permissions**
2. Add a **token-exchange** permission
3. Allow the `stoa-bridge` client to exchange tokens

Configure the token exchange policy:

```json
{
  "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "audience": "stoa-gateway"
}
```

## Step 3: Exchange the Token

When a user arrives with an OAM token, exchange it for a STOA token:

```bash
# Exchange OAM token → STOA token
curl -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token \
  -d "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
  -d "subject_token=$OAM_TOKEN" \
  -d "subject_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "requested_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "client_id=stoa-bridge" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "audience=stoa-gateway"
```

Response:
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

## Step 4: Use the Exchanged Token

The exchanged token works with all STOA APIs and MCP tools:

```bash
# Call a REST API
curl ${STOA_GATEWAY_URL}/api/v1/data \
  -H "Authorization: Bearer $EXCHANGED_TOKEN"

# Call an MCP tool
curl -X POST ${STOA_GATEWAY_URL}/mcp/tools/call \
  -H "Authorization: Bearer $EXCHANGED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "get-report", "arguments": {"id": "Q4-2025"}}'
```

The user's OAM identity (name, email, groups) is preserved in the exchanged token's claims. STOA RBAC policies work on these claims.

## What Happens During the Transition

| Week | Action | User Impact |
|------|--------|-------------|
| 1 | Configure Keycloak IDP + token exchange | None |
| 2 | Route new API traffic through STOA | None |
| 3-12 | Gradually migrate apps to use STOA tokens directly | None |
| 13+ | Decommission OAM (when ready) | Password reset |

Users never notice the bridge. Applications gradually adopt STOA tokens at their own pace.

## Next Steps

- [Full Oracle OAM Migration Guide](/docs/guides/migration/oracle-oam)
- [OAuth2 Token Exchange Deep Dive](/docs/guides/fiches/oauth2-token-exchange)
- [mTLS Configuration](/docs/guides/mtls-configuration)
- [Service Accounts](/docs/guides/service-accounts)
