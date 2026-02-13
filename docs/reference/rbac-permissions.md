---
sidebar_position: 8
title: "RBAC Permission Matrix"
description: "Complete RBAC reference for STOA — 4 roles, OAuth scopes, permission matrix, tenant isolation, and JWT claims structure."
keywords:
  - RBAC
  - permissions
  - roles
  - access control
  - OAuth scopes
  - tenant isolation
---

# RBAC Permission Matrix

Complete reference for STOA's role-based access control — roles, scopes, permissions, and tenant isolation.

## Roles

STOA defines 4 roles, managed in Keycloak as realm roles:

| Role | Scope | Description |
|------|-------|-------------|
| `cpi-admin` | **Platform** | Full access to all tenants, all operations |
| `tenant-admin` | **Tenant** | Full access to own tenant only |
| `devops` | **Tenant** | Deploy, promote, and manage within own tenant |
| `viewer` | **Tenant** | Read-only access to own tenant |

### Role Hierarchy

```
cpi-admin (platform-wide)
  └── tenant-admin (tenant-scoped)
       └── devops (deploy-scoped)
            └── viewer (read-only)
```

Higher roles inherit all permissions of lower roles. A `cpi-admin` can do everything a `viewer` can, plus more.

## OAuth Scopes

The gateway maps roles to OAuth scopes for token-based authorization:

| Scope | Description | Roles |
|-------|-------------|-------|
| `stoa:read` | Read-only access | `viewer`, `devops`, `tenant-admin`, `cpi-admin` |
| `stoa:write` | Create, update, delete | `devops`, `tenant-admin`, `cpi-admin` |
| `stoa:admin` | Platform administration | `cpi-admin` |

## Permission Matrix

### API Management

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| List APIs | Read | Read | Read | Read (all tenants) |
| View API details | Read | Read | Read | Read (all tenants) |
| Create API | — | Create | Create | Create (any tenant) |
| Update API | — | Update | Update | Update (any tenant) |
| Delete API | — | — | Delete | Delete (any tenant) |
| Deploy API | — | Deploy | Deploy | Deploy (any tenant) |
| Promote API | — | Promote | Promote | Promote (any tenant) |

### Subscription Management

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| List subscriptions | Read | Read | Read | Read (all tenants) |
| Create subscription | — | Create | Create | Create |
| Approve subscription | — | — | Approve | Approve |
| Suspend subscription | — | — | Suspend | Suspend |
| Revoke subscription | — | — | Revoke | Revoke |
| Rotate API key | — | Rotate | Rotate | Rotate |

### Consumer Management

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| List consumers | Read | Read | Read | Read (all tenants) |
| Create consumer | — | — | Create | Create |
| Update consumer | — | — | Update | Update |
| Delete consumer | — | — | Delete | Delete |
| Bulk onboard | — | — | Bulk | Bulk |

### Tenant Management

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| List tenants | Own only | Own only | Own only | All tenants |
| View tenant details | Own only | Own only | Own only | All tenants |
| Create tenant | — | — | — | Create |
| Update tenant | — | — | — | Update |
| Delete tenant | — | — | — | Delete |

### MCP Tools

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| List tools | Read | Read | Read | Read |
| Invoke tool | — | Invoke | Invoke | Invoke |
| Register tool (CRD) | — | — | Register | Register |

### Platform Administration

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| View audit logs | Read | Read | Read | Read (all tenants) |
| Manage users | — | — | Own tenant | All tenants |
| Gateway admin | — | — | — | Full access |
| Override read-only env | — | — | — | Override |

## Tenant Isolation

Tenant-scoped roles (`tenant-admin`, `devops`, `viewer`) are restricted to their own tenant:

- A `tenant-admin` for tenant `acme` **cannot** see tenant `globex` resources
- API queries automatically filter by the user's `tenant_id` claim
- Cross-tenant access attempts return `403 Forbidden`

Only `cpi-admin` can access resources across all tenants.

### How Tenant Is Determined

The user's tenant is extracted from the JWT token:

1. **`tenant` claim** (custom claim in Keycloak) — primary source
2. **`tenant-{id}` role** (realm role pattern) — fallback
3. **No tenant** — only valid for `cpi-admin` (platform-wide access)

## JWT Claims Structure

STOA validates these JWT claims from Keycloak:

```json
{
  "sub": "user-uuid-123",
  "preferred_username": "john.doe",
  "email": "john.doe@acme.example.com",
  "tenant": "acme",
  "realm_access": {
    "roles": ["tenant-admin", "offline_access"]
  },
  "scope": "openid stoa:read stoa:write",
  "aud": ["stoa-mcp", "account"],
  "iss": "https://auth.<YOUR_DOMAIN>/realms/stoa",
  "exp": 1708000000,
  "iat": 1707999000
}
```

| Claim | Required | Purpose |
|-------|----------|---------|
| `sub` | Yes | User identifier |
| `exp` | Yes | Token expiration |
| `iat` | Yes | Token issued at |
| `iss` | Yes | Token issuer (Keycloak URL) |
| `aud` | Yes | Audience (must include client ID) |
| `tenant` | No | Tenant ID (required for tenant-scoped roles) |
| `realm_access.roles` | Yes | Keycloak realm roles |
| `scope` | No | OAuth scopes (space-separated) |

## Persona Examples

### Alex — Platform Admin (`cpi-admin`)

Alex manages the entire STOA platform. She can:
- Create and configure tenants
- View all subscriptions across tenants
- Access the gateway admin API
- Override read-only production restrictions
- View platform-wide audit logs

### Bob — Tenant Admin (`tenant-admin`)

Bob manages APIs for the `acme` tenant. He can:
- Create, edit, and delete APIs in `acme`
- Approve subscription requests for `acme` APIs
- Manage consumers and their certificates
- View audit logs for `acme` only
- **Cannot** see resources in other tenants

### Carol — DevOps Engineer (`devops`)

Carol deploys and promotes APIs for `acme`. She can:
- Create and update APIs in `acme`
- Deploy APIs to staging and production
- Rotate API keys for subscriptions
- **Cannot** delete APIs or approve subscriptions
- **Cannot** manage consumers

### Dave — Viewer (`viewer`)

Dave monitors API health for `acme`. He can:
- Browse the API catalog and documentation
- View subscription details and usage metrics
- Read audit logs for `acme`
- **Cannot** create, modify, or delete anything

## Related

- [Authentication Guide](/docs/guides/authentication) — Keycloak and OIDC setup
- [Environment Management](/docs/guides/environment-management) — Environment modes and read-only production
- [OAuth Discovery](/docs/reference/oauth-discovery) — OAuth 2.1 endpoints
- [Multi-Tenant Isolation](/docs/concepts/multi-tenant) — Tenant architecture
