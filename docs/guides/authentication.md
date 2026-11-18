---
sidebar_position: 2
title: "Authentication Setup"
description: "Configure OIDC/OAuth2 authentication with Keycloak for STOA Platform — single shared stoa realm, per-tenant groups, verified tenant_id JWT claims, and RBAC."
keywords: [authentication, Keycloak, OIDC, OAuth2, JWT, RBAC, ADR-074]
---

# Authentication Setup

Configure authentication and authorization for STOA Platform using Keycloak OIDC ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)).

## Overview

STOA uses **Keycloak 26** for centralized authentication and tenant-scoped authorization:

- **Single Shared Realm (`stoa`)** — One OIDC issuer (`/realms/stoa`) across the platform; no separate realm per tenant ([ADR-074](/docs/architecture/adr/adr-074-tenant-model))
- **One Keycloak Group per Tenant** — Provisioned automatically (`setup_tenant_group`) when a tenant is created
- **Verified `tenant_id` JWT Claim** — Enforced after RS256 JWKS verification in both Control Plane API and `stoa-gateway`
- **OAuth 2.1 + PKCE & DCR** — Native MCP agent authentication discovery (`/.well-known/oauth-protected-resource`)

## Keycloak Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Keycloak ('stoa' Realm)                 │
├──────────────────────────────────────────────────────────┤
│  OIDC Clients:                                           │
│  ├── control-plane-ui  (Public, PKCE)                    │
│  ├── stoa-portal       (Public, PKCE)                    │
│  ├── stoactl           (Public, PKCE / Device)           │
│  └── stoa-mcp / API clients (Confidential or DCR)        │
├──────────────────────────────────────────────────────────┤
│  Top-Level Tenant Groups (+ user tenant_id attribute):   │
│  ├── /acme                                               │
│  ├── /globex                                             │
│  └── /initech                                            │
└──────────────────────────────────────────────────────────┘
```

:::info External IdP Federation
Multi-IdP brokering (OIDC, SAML, LDAP) is demonstrated only in separate federation demo realms (`deploy/docker-compose/` profile `federation`) and is not attested in the production `stoa` realm import ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)).
:::

## Setup OIDC for an API

### Step 1: Provision a Tenant and Group

Creating a tenant via `stoactl` or the Control Plane API triggers `TenantProvisioningService`, which creates the corresponding top-level Keycloak group (`/<tenant_id>`) in the `stoa` realm (`keycloak_service.py:setup_tenant_group`), while `add_user_to_tenant` sets the user's `tenant_id` attribute mapped into the JWT claim:

```bash
# Authenticate stoactl against the stoa realm
stoactl auth login

# Create a tenant (--name and --owner-email are required; provisions the /acme Keycloak group)
stoactl tenant create --name acme --display-name "Acme Corp" --owner-email admin@example.com
stoactl tenant status acme
```

### Step 2: Configure STOA Gateway OIDC & Audience

Configure `stoa-gateway` to validate tokens issued by the `stoa` realm and require an explicit audience:

```bash
STOA_KEYCLOAK_URL=https://auth.example.com
STOA_KEYCLOAK_REALM=stoa
STOA_MCP_AUDIENCE=stoa-mcp
# Optional: when running the Envoy gRPC ext_authz server (ADR-073; audience + non-empty scopes required in prod)
STOA_EXT_AUTHZ_GRPC_ADDR=127.0.0.1:9001
STOA_EXT_AUTHZ_AUDIENCE=stoa-api
STOA_EXT_AUTHZ_REQUIRED_SCOPES=stoa:read
```

To expose a JWT-protected REST route on `stoa-gateway`, declare a UAC contract with `"inboundAuth": "jwt"` via `POST /admin/contracts` (matching `quickstart/verify.sh`; `RestBinder` mounts each endpoint under `/apis/{tenant_id}/{contract.name}{endpoint.path}`, and validates `inboundAuthAudience` when set on the contract or the gateway's default OIDC validator otherwise — distinct from `STOA_MCP_AUDIENCE`):

```bash
curl -sS -X POST "${STOA_GATEWAY_URL}/admin/contracts" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "orders-api",
    "version": "1.0.0",
    "tenant_id": "acme",
    "status": "published",
    "classification": "H",
    "inboundAuth": "jwt",
    "endpoints": [
      {
        "path": "/orders",
        "methods": ["GET"],
        "backend_url": "http://orders-backend:8080"
      }
    ]
  }'
```

### Step 3: Test Authentication

Obtain a token from the `stoa` realm (configured so the service client emits `tenant_id: "acme"` and the REST route's expected audience — `inboundAuthAudience` if configured on the contract, otherwise the gateway's default OIDC validator, distinct from `STOA_MCP_AUDIENCE`) and call the mounted `/apis/acme/orders-api/orders` route:

```bash
# Request an access token from the shared 'stoa' realm
TOKEN=$(curl -sS -X POST \
  "${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" \
  | jq -r '.access_token')

# Call the JWT-protected gateway route mounted at /apis/{tenant_id}/{contract.name}{endpoint.path}
curl -i "${STOA_GATEWAY_URL}/apis/acme/orders-api/orders" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Authentication Flows

All OIDC endpoints are served under `/realms/stoa/protocol/openid-connect/`:

### 1. Client Credentials Flow (Machine-to-Machine)

```http
POST /realms/stoa/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=acme-service-client&
client_secret=<CLIENT_SECRET>&
grant_type=client_credentials&
scope=openid stoa:read
```

### 2. Authorization Code + PKCE Flow (Browser UIs, CLI & MCP Agents)

```http
# Step 1: Redirect user with PKCE code_challenge
GET /realms/stoa/protocol/openid-connect/auth
  ?client_id=stoa-portal
  &redirect_uri=https://portal.example.com/callback
  &response_type=code
  &scope=openid profile email
  &code_challenge=<BASE64URL_SHA256>
  &code_challenge_method=S256

# Step 2: Exchange authorization code + code_verifier
POST /realms/stoa/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=stoa-portal&
code=<AUTH_CODE>&
code_verifier=<CODE_VERIFIER>&
grant_type=authorization_code&
redirect_uri=https://portal.example.com/callback
```

### 3. OAuth 2.1 Dynamic Client Registration (MCP Clients)

AI agents connecting to `stoa-gateway` discover OAuth metadata at `GET /.well-known/oauth-protected-resource` and `GET /.well-known/oauth-authorization-server`, and register public PKCE clients via `POST /oauth/register` ([ADR-044](/docs/architecture/adr/adr-044-mcp-oauth-gateway-proxy)).

## Token Validation

`stoa-gateway` and the Control Plane API verify RS256 signatures, issuer, and expiration on every Bearer JWT, with path-specific audience and tenant rules:

1. **RS256 Signature & Issuer** — Verified against the `stoa` realm JWKS (`/realms/stoa/protocol/openid-connect/certs`)
2. **Expiration (`exp`)** — Rejects expired tokens (`401 Unauthorized`)
3. **Audience (`aud`) — Path-specific** — `control-plane-api` disables `verify_aud` during JWT decoding (`auth/dependencies.py`). On `stoa-gateway`, MCP endpoints require `STOA_MCP_AUDIENCE` (fail-closed when unset), Envoy `ext_authz` gRPC requires `STOA_EXT_AUTHZ_AUDIENCE` (fail-closed when unset), and published UAC REST routes validate `inboundAuthAudience` when set on the contract (otherwise using the gateway's default OIDC validator)
4. **Tenant Isolation (`tenant_id`)** — Control Plane RBAC (`require_tenant_access`, plus Rust `RbacEnforcer` when its `enforce_tenant_isolation` policy field is enabled) rejects cross-tenant calls with `403 Forbidden` unless the caller holds `cpi-admin`; MCP `tools/list`, Envoy `ext_authz` gRPC, and UAC REST routes require a verified `tenant_id` matching the target tenant/route without a `cpi-admin` cross-tenant bypass

## Role-Based Access Control (RBAC)

STOA maps Keycloak roles in the `stoa` realm to four canonical roles ([ADR-054](/docs/architecture/adr/adr-054-rbac-taxonomy-v2)):

| Role | Scope | Expanded Scopes (`stoa-gateway`) | Permissions |
|------|-------|----------------------------------|-------------|
| `cpi-admin` | Platform (Control Plane RBAC) | `stoa:read`, `stoa:write`, `stoa:execute`, `stoa:deploy`, `stoa:audit` (`stoa:admin` must be explicitly issued) | Cross-tenant Control Plane administration |
| `tenant-admin` | Tenant (`tenant_id`) | `stoa:read`, `stoa:write`, `stoa:execute` | Manage APIs, tools, users, and subscriptions in own tenant |
| `devops` | Tenant (`tenant_id`) | `stoa:read`, `stoa:write`, `stoa:deploy` | Deploy contracts and bindings in own tenant |
| `viewer` | Tenant (`tenant_id`) | `stoa:read` | Read-only catalog and metrics access in own tenant |

## Advanced Configuration

### Protocol Mappers (`tenant_id` Claim)

Keycloak client scopes include a group/attribute protocol mapper that injects the verified `tenant_id` claim into access tokens so downstream policies never rely on client-supplied `X-Tenant-ID` headers.

### Sender-Constrained Tokens (mTLS & DPoP)

For regulated workloads, `stoa-gateway` supports RFC 8705 certificate-bound tokens (`cnf.x5t#S256`, [ADR-039](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens)) and RFC 9449 DPoP proof validation ([ADR-056](/docs/architecture/adr/adr-056-fapi-2-architecture)).

## Troubleshooting

### Check CLI Session & OIDC Discovery

```bash
# Inspect current stoactl authentication status and context
stoactl auth status

# Verify Keycloak OIDC discovery on the 'stoa' realm
curl -sS "${STOA_AUTH_URL}/realms/stoa/.well-known/openid-configuration" | jq '{issuer, jwks_uri}'
```

### Common Issues

- **`401 Unauthorized` (invalid signature or issuer)**: Ensure `STOA_KEYCLOAK_URL` matches the external `iss` claim in the token (use `STOA_KEYCLOAK_INTERNAL_URL` if cluster-internal JWKS routing differs).
- **`401` / `503` (audience mismatch or missing audience)**: Verify `STOA_MCP_AUDIENCE` (or `STOA_EXT_AUTHZ_AUDIENCE`) matches the `aud` claim minted by Keycloak.
- **`403 Forbidden` (tenant mismatch)**: Confirm the user belongs to the target tenant's Keycloak group and the token carries the matching `tenant_id` claim.

---

## Next Steps

- [Multi-Tenant Isolation](/docs/concepts/multi-tenant) — How `stoa` realm groups, `tenant_id`, and signed policies isolate tenants
- [API Subscriptions](/docs/guides/subscriptions) — Manage consumer access to your APIs
- [Control Plane API Reference](/docs/api/control-plane) — Explore Control Plane endpoints
- [MCP Gateway API](/docs/api/mcp-gateway) — Connect AI agents to your tools

---

**Need Help?** [GitHub Issues](https://github.com/stoa-platform/stoa/issues) · [Discord](https://discord.gostoa.dev)
