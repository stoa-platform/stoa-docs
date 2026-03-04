---
title: "ADR-055: Portal/Console Governance — Clear Separation of Concerns"
description: "Establishes a strict Producer/Consumer split: Portal is exclusively for API consumers (discover, subscribe, use). Console is exclusively for API providers and platform admins (create, manage, approve, deploy). Removes 8 provider features from Portal to eliminate UX confusion."
keywords: [portal, console, governance, ux, rbac, producer, consumer, separation-of-concerns, api-management]
---

# ADR-055: Portal/Console Governance — Clear Separation of Concerns

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-03-04 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-1646 |

### Related Decisions

- **ADR-013**: RBAC Model — original 4-role model (`cpi-admin`, `tenant-admin`, `devops`, `viewer`)
- **ADR-054**: RBAC Taxonomy v2 — persona roles (`stoa.product_owner`, `stoa.consumer`, etc.)

## Context

STOA Platform has two frontend applications:

- **Console** (`console.gostoa.dev`) — intended for API providers, tenant admins, and platform admins
- **Portal** (`portal.gostoa.dev`) — intended for API consumers and developers

Over time, provider features have been added to the Portal, creating a **hybrid interface** where tenant-admins must juggle between both UIs without a clear boundary. An audit of both interfaces (March 2026) revealed significant feature duplication and UX confusion.

### Problems

1. **Feature duplication** — API creation (`/my-apis`), MCP server management (`/my-servers`), subscription approval (`/workspace?tab=approvals`), and application management exist on BOTH interfaces, hitting the same API endpoints
2. **Split workflow** — A tenant-admin creates APIs on Portal but must switch to Console for deployments, monitoring, and gateway management. No interface provides the complete provider workflow
3. **Consumer confusion** — A developer (consumer role) sees "My APIs", "My MCP Servers", and "Approval Queue" in the Portal navigation, even though these features require `tenant-admin` role and are irrelevant to consumers
4. **Inverted features** — Webhooks, Credential Mappings, and Contracts/UAC only exist on Portal, not Console, despite being provider/admin features
5. **No documented governance** — There is no ADR defining which features belong where

### Duplication Matrix (pre-decision)

| Feature | Console | Portal | Problem |
|---------|---------|--------|---------|
| Create/Manage APIs | `/apis` (CRUD) | `/my-apis` (CRUD) | Full duplicate |
| Create/Manage MCP Servers | `/mcp-servers` (CRUD) | `/my-servers` (CRUD) | Full duplicate |
| Approve Subscriptions | `/subscriptions` | `/workspace?tab=approvals` | Full duplicate |
| Manage Applications | `/applications` (CRUD) | `/workspace?tab=apps` (CRUD) | Full duplicate |
| Register Consumers | `/consumers` (CRUD) | `/consumers/register` | Partial duplicate |
| Webhooks | ❌ missing | `/webhooks` (CRUD) | Inverted — admin feature on Portal |
| Credential Mappings | ❌ missing | `/credentials` (CRUD) | Inverted — admin feature on Portal |
| Contracts/UAC | ❌ missing | `/contracts` (CRUD) | Inverted — admin feature on Portal |
| Gateway Monitoring | `/gateways` (5 routes) | `/gateways` (read-only) | Leak — ops feature on Portal |

## Decision

**Adopt the "Stripe Model" — strict Producer/Consumer separation.**

### Portal = Consumer ONLY

The Portal is a **Developer Portal** for API consumers. It answers: *"What APIs/tools are available, and how do I use them?"*

Allowed features:
- **Discover**: Marketplace, API Catalog, MCP Server browsing, Favorites, Compare
- **Subscribe**: Subscribe to APIs and MCP tools, manage API keys (rotate, reveal, TOTP)
- **Use**: API Testing Sandbox, Execution History, Usage/Quotas, Rate Limits
- **Self-serve**: Signup, Onboarding Wizard, Profile, Notifications
- **Own resources**: MY Applications (OAuth clients the consumer created), MY Subscriptions

### Console = Provider + Admin

The Console is an **Admin Console** for API providers, tenant admins, and platform admins. It answers: *"How do I publish, manage, and govern my APIs?"*

Allowed features:
- **API Lifecycle**: Create, update, deploy, deprecate, delete APIs
- **MCP Management**: Create, sync, toggle MCP servers and tools
- **Governance**: Approve/reject subscriptions, manage consumers, assign roles
- **Contracts**: Create and manage Universal API Contracts (UAC), protocol bindings
- **Integration**: Webhooks, Credential Mappings (consumer→backend auth)
- **Operations**: Gateway fleet management, deployments, monitoring, observability
- **Platform Admin**: User management, federation, security posture, audit logs

### Boundary Rule

> **If a feature CREATES or MANAGES a resource that other users consume, it belongs on Console.**
> **If a feature DISCOVERS or USES a resource created by someone else, it belongs on Portal.**

Exceptions:
- Portal users can CREATE their own Applications (OAuth clients) — these are consumer-scoped resources
- Portal users can CREATE subscriptions (requests) — but approval happens on Console

## Migration Plan

### Phase 1 — Move inverted features to Console (no Portal removal yet)

Add to Console the 3 features that currently ONLY exist on Portal:
1. Webhooks management (`/webhooks`) → Console `/webhooks`
2. Credential Mappings (`/credentials`) → Console `/credentials`
3. Contracts/UAC (`/contracts`) → Console `/contracts`

### Phase 2 — Remove provider features from Portal

Remove 8 routes/pages from Portal:
1. `/my-apis` → use Console `/apis`
2. `/my-servers` → use Console `/mcp-servers`
3. `/workspace?tab=approvals` → use Console `/subscriptions`
4. `/consumers/register` → use Console `/consumers`
5. `/webhooks` → now on Console
6. `/credentials` → now on Console
7. `/contracts/*` → now on Console
8. `/gateways` → already on Console

### Phase 3 — Portal navigation cleanup

- Remove provider-only nav items for `viewer` and `devops` roles
- Simplify Portal sidebar to: Marketplace, My Apps, My Subscriptions, Usage, Notifications
- Update Portal onboarding wizard to remove provider steps

## Alternatives Considered

### Option B — Backstage Model (Portal = Self-Service Hub for everyone)

Portal becomes the unified hub with role-based views. Console becomes Platform Ops only (cpi-admin).

**Rejected because:**
- Contradicts existing documentation ("Portal = developers consuming APIs")
- Requires rebuilding Console features inside Portal (monitoring, gateway mgmt, etc.)
- More work for less clarity — role-based views still confuse the navigation
- No industry precedent in API management (Kong, Apigee, Azure APIM all use strict separation)

### Option C — Merge into Single Application

Replace both Console and Portal with a single unified application using role-based routing.

**Rejected because:**
- Massive rewrite (2 React apps → 1)
- Loses the clean deployment boundary (Portal can be public-facing, Console internal)
- Increases attack surface (single app with admin features exposed to consumer traffic)
- Doesn't match multi-tenant SaaS conventions

## Consequences

### Positive

- **Clear mental model** — consumers go to Portal, providers go to Console. No ambiguity
- **Reduced Portal complexity** — Portal drops from ~30 routes to ~15 routes
- **Better security posture** — Portal no longer exposes admin endpoints
- **Consistent with market** — Kong, Apigee, AWS API Gateway, Azure APIM all follow this model
- **Simpler RBAC on Portal** — Portal only needs `stoa:catalog:read`, `apps:read`, `stoa:tools:execute`

### Negative

- **Provider needs 2 bookmarks** — API providers use Console (not Portal) for all management tasks
- **3 features to build on Console** — Webhooks, Credential Mappings, Contracts need Console pages
- **Redirects needed** — Old Portal URLs for removed features should redirect to Console equivalents

### Neutral

- Portal and Console continue to share the same Control Plane API — no backend changes needed
- Keycloak OIDC clients remain separate (`stoa-portal`, `control-plane-ui`)

## Compliance

- No impact on RBAC model (ADR-013, ADR-054) — roles and permissions unchanged
- No impact on API contracts — same backend endpoints, different frontend routing
- Aligns with content compliance rules — Portal is the public-facing surface

## References

- Kong Developer Portal vs Kong Manager — [Kong Docs](https://docs.konghq.com)
- Apigee Portal vs Apigee Console — separate apps, strict separation
- Azure API Management — Publisher Portal (admin) vs Developer Portal (consumer)
- Stripe Dashboard — single app but strict role-based feature gating
