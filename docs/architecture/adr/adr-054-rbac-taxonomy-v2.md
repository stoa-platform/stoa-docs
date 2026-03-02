---
title: "ADR-054: RBAC Taxonomy v2 — Persona Roles & Display Names"
description: "Introduces a three-layer role taxonomy (persona, core, additive) with alias resolution, display names, and a metadata endpoint. Chooses additive alias resolution (Option A) over role migration (Option B) and Keycloak realm mapping (Option C)."
keywords: [rbac, roles, persona, display-names, alias, normalize, permissions, scopes, self-service]
---

# ADR-054: RBAC Taxonomy v2 — Persona Roles & Display Names

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-03-02 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-1634 |

### Related Decisions

- **ADR-013**: RBAC Model — original 4-role model (`cpi-admin`, `tenant-admin`, `devops`, `viewer`)
- **ADR-024**: Gateway Unified Modes — gateway respects scopes from JWT
- **ADR-046**: MCP Federation — federated tools use scopes for access control

## Context

The original RBAC model (ADR-013) defines 4 core roles using internal jargon (`cpi-admin`, `tenant-admin`, `devops`, `viewer`). These names are meaningless to OSS users and enterprise customers. CAB-604 previously defined 7 persona roles (`stoa.admin`, `stoa.product_owner`, `stoa.developer`, `stoa.consumer`, `stoa.security`, `stoa.agent`) in `ROLE_TO_SCOPES`, but they were never wired into `ROLE_PERMISSIONS` — the RBAC engine ignored them completely.

### Problems

1. **UX friction** — Console and Portal show `cpi-admin` instead of "Platform Admin"
2. **Dead code** — persona roles exist in scope mapping but not in permission checking
3. **No metadata endpoint** — frontends hard-code role labels instead of querying the backend
4. **Missing self-service** — Portal has "My MCP Servers" but no "My APIs" for tenant self-service

### Constraints

- Zero breaking changes — existing JWTs with core roles must continue to work identically
- No Keycloak realm reconfiguration required (separate ops task, out of scope)
- Display names must be backend-driven (single source of truth, no UI-local mappings)
- Persona roles are additive (resolve to core + persona, never replace core)

## Options

### Option A: Additive Alias Resolution (Chosen)

Persona roles are resolved at JWT extraction time. `normalize_roles()` expands aliases: `["stoa.admin"]` becomes `["cpi-admin", "stoa.admin"]`. The core role drives permission checks, the persona role enables display name lookups.

```
JWT arrives with roles: ["stoa.admin"]
  → normalize_roles() → ["cpi-admin", "stoa.admin"]
  → Permission check uses "cpi-admin" (existing ROLE_PERMISSIONS)
  → Display name lookup uses "stoa.admin" → "STOA Admin"
  → Both roles available in /v1/me response
```

**Pros:**
- Zero migration — old tokens work unchanged, new tokens get richer metadata
- Idempotent — `normalize_roles(["cpi-admin", "stoa.admin"])` returns the same set (no duplicates)
- Backend-driven — single `ROLE_METADATA` dict serves roles endpoint and `/v1/me`

**Cons:**
- Two names for the same permission set (alias + core) may confuse API consumers
- Role list grows from 4 to 10 entries

### Option B: Role Migration (Rejected)

Rename core roles in Keycloak and all code: `cpi-admin` → `stoa.admin`, `tenant-admin` → `stoa.product_owner`, etc.

**Rejected because:**
- Breaking change — all existing JWTs, Keycloak configs, and gateway rules would need migration
- Coordinated deploy — API, gateway, and Keycloak must be updated atomically
- Risk of lockout — a misconfigured role mapping silently removes all permissions

### Option C: Keycloak Realm Mapping (Rejected)

Configure Keycloak client mappers to translate persona roles to core roles at token issuance time.

**Rejected because:**
- Keycloak-specific — ties the solution to a single IdP (STOA supports OIDC generically)
- Invisible transformation — debugging JWT content requires Keycloak admin access
- No display name support — still need a metadata endpoint for human-readable names

## Decision

**Option A — Additive Alias Resolution.** The three-layer role taxonomy provides backward-compatible persona roles with display names, driven entirely from the backend.

## Architecture

### Three-Layer Role Taxonomy

```
Layer 1: Persona Roles (user-facing, semantic)
  stoa.admin → "STOA Admin"
  stoa.product_owner → "Product Owner"
  stoa.developer → "Developer"
  stoa.consumer → "Consumer"

Layer 2: Core Roles (internal, functional)
  cpi-admin → 18 permissions (full platform)
  tenant-admin → 13 permissions (tenant-scoped)
  devops → 11 permissions (deploy/manage)
  viewer → 5 permissions (read-only)

Layer 3: Additive Roles (standalone, not aliases)
  stoa.security → 5 permissions (audit read-only)
  stoa.agent → 2 permissions (M2M minimal read)
```

Persona roles (Layer 1) resolve to core roles (Layer 2) via `ROLE_ALIASES`. Additive roles (Layer 3) have their own permission sets and do not alias to any core role.

### Alias Resolution

```python
ROLE_ALIASES = {
    "stoa.admin": "cpi-admin",
    "stoa.product_owner": "tenant-admin",
    "stoa.developer": "devops",
    "stoa.consumer": "viewer",
}

def normalize_roles(raw_roles: list[str]) -> list[str]:
    result = set(raw_roles)
    for role in raw_roles:
        aliased = ROLE_ALIASES.get(role)
        if aliased:
            result.add(aliased)
    return sorted(result)
```

Called once at JWT extraction time (`auth/dependencies.py`). Uses lazy import to avoid circular dependency with the RBAC module.

### Scopes vs Permissions

| Concept | Granularity | Used By | Example |
|---------|-------------|---------|---------|
| **Permissions** | Fine-grained | API authorization (`has_permission()`) | `tenants:create`, `apis:write` |
| **Scopes** | Coarse-grained | OAuth2 token, gateway enforcement | `stoa:admin`, `stoa:read` |

`ROLE_TO_SCOPES` maps each role to OAuth2 scopes for gateway-level enforcement. `ROLE_PERMISSIONS` maps each role to fine-grained permissions for API-level checks. Both are kept separate intentionally — a scope grants access to a category of endpoints, a permission grants access to a specific operation.

### API Surface

#### `GET /v1/roles`

Returns all 10 roles with metadata, permissions, and alias mappings:

```json
{
  "roles": [
    {
      "name": "cpi-admin",
      "display_name": "Platform Admin",
      "description": "Full platform access across all tenants",
      "scope": "platform",
      "category": "core",
      "permissions": ["tenants:create", "tenants:read", "..."],
      "inherits_from": null
    },
    {
      "name": "stoa.admin",
      "display_name": "STOA Admin",
      "description": "Platform administrator (maps to Platform Admin)",
      "scope": "platform",
      "category": "persona",
      "permissions": ["tenants:create", "tenants:read", "..."],
      "inherits_from": "cpi-admin"
    }
  ],
  "aliases": {
    "stoa.admin": "cpi-admin",
    "stoa.product_owner": "tenant-admin",
    "stoa.developer": "devops",
    "stoa.consumer": "viewer"
  }
}
```

Persona roles inherit permissions from their core role. The `inherits_from` field makes this explicit.

#### `GET /v1/me` (enhanced)

Adds `role_display_names` to the existing response:

```json
{
  "roles": ["cpi-admin", "stoa.admin"],
  "role_display_names": {
    "cpi-admin": "Platform Admin",
    "stoa.admin": "STOA Admin"
  },
  "permissions": ["tenants:create", "..."],
  "effective_scopes": ["stoa:admin", "stoa:write", "stoa:read"]
}
```

Frontends use `role_display_names` for UI rendering. Fallback: if a role has no display name, show the role slug.

### UI Integration

**Console sidebar** — displays `role_display_names` from `/v1/me`:
```typescript
user.roles.map((r) => user.role_display_names?.[r] || r).join(', ')
```

**Portal profile** — same pattern, shows persona names when available.

**Portal "My APIs" page** — new self-service page for tenant-scoped API management, accessible to `tenant-admin` and `cpi-admin`. Mirrors the existing "My MCP Servers" pattern.

## Consequences

### Positive

- **Better UX** — users see "Platform Admin" instead of "cpi-admin" across Console and Portal
- **Zero migration** — existing tokens, Keycloak config, and gateway rules unchanged
- **Extensible** — new persona roles or additive roles can be added without schema changes
- **Backend-driven** — frontends query `/v1/roles` or `/v1/me`, never hard-code role labels
- **Self-service parity** — Portal now has "My APIs" alongside "My MCP Servers"

### Negative

- **Larger role list** — 10 entries instead of 4 (manageable, documented in `/v1/roles`)
- **Dual naming** — API consumers may be confused by `cpi-admin` vs `stoa.admin` (mitigated by `inherits_from` field and documentation)

### Risks

- **Keycloak sync** — if Keycloak realm roles are reconfigured to emit persona roles, `normalize_roles()` must be tested with mixed input (both alias and core role present). Current implementation is idempotent for this case.

## Implementation

| Phase | Scope | PR | LOC |
|-------|-------|----|-----|
| 1 | Role metadata endpoint + display names in `/v1/me` | #1353 | ~250 |
| 2 | Wire persona roles + `normalize_roles()` + additive roles | #1353 | ~200 |
| 3 | Portal "My APIs" self-service page | #1353 | ~400 |
| 4 | Console + Portal display name integration | #1355 | ~100 |
| 5 | ADR-054 documentation | This PR | ~200 |
