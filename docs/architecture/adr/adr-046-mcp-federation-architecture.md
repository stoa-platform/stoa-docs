---
title: "ADR-046: MCP Federation Architecture"
description: "Decides that STOA supports multi-provider MCP federation via master accounts with RFC 8693 token delegation, per-sub-account metering, and cross-account tool sharing."
keywords: [MCP, federation, multi-tenant, token delegation, RFC 8693, master account, tool composition, agent orchestration]
---

# ADR-046: MCP Federation Architecture

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Date** | 2026-02-17 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-1313 |
| **Council** | 8.25/10 Go |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — edge-mcp mode hosts federation routing
- **ADR-041**: Plugin Architecture — federation as enterprise feature gate
- **ADR-043**: Kafka MCP Event Bridge — metering events per sub-account
- **ADR-044**: MCP OAuth 2.1 Gateway Proxy — OAuth foundation for token delegation
- **ADR-045**: stoa.yaml Declarative Spec — federation section in declarative config

## Context

Enterprise customers need a **single MCP entry point** that aggregates tools from multiple internal teams, business units, or external partners. Today, each developer or AI agent connects independently to the STOA Gateway — there is no concept of a parent account that manages sub-accounts, delegates tokens, or enforces cross-cutting policies.

### The Problem

Two enterprise patterns cannot be served with the current per-connection model:

1. **Master Account (Enterprise IT)**: A platform team provisions a single MCP endpoint. Developers and AI agents connect through it. The platform team controls which tools are visible, enforces rate limits per team, and gets consolidated usage metrics.

2. **Multi-Agent Orchestration**: A single user spawns N agents (Claude Code team, n8n workflows, custom bots). Each agent needs its own quota, audit trail, and tool visibility — but all billing rolls up to the user's account.

> **Scope note (Council adjustment #1)**: Partner federation (cross-IdP trust between separate Keycloak realms or external OIDC providers) is explicitly out of scope for this ADR. It will be addressed in a future ADR once the internal master/sub-account model is proven.

### Current Architecture

The gateway already has federation primitives in `stoa-gateway/src/federation/`:

```
federation/
├── mod.rs           # Module exports
├── upstream.rs      # UpstreamMcpClient — connects to remote MCP servers
└── composition.rs   # ComposedTool, CompositionStep — tool chaining
```

`UpstreamMcpClient` can discover and invoke tools on a remote MCP server. `ComposedTool` chains multiple tool calls into a pipeline. What's missing is the **account hierarchy**, **token delegation**, and **per-sub-account policy enforcement**.

## Decision

### 1. Master Account Model

Introduce a `MasterAccount` entity in the Control Plane API that owns sub-accounts:

```
MasterAccount (tenant-level)
├── SubAccount: team-alpha      (developer team)
│   ├── quota: 10,000 calls/day
│   ├── tools: [api-search, api-create]
│   └── agents: [claude-alpha-1, n8n-deploy]
├── SubAccount: team-beta       (QA team)
│   ├── quota: 5,000 calls/day
│   ├── tools: [api-search]        (read-only subset)
│   └── agents: [qa-bot-1]
└── SubAccount: ci-pipeline     (automation)
    ├── quota: 50,000 calls/day
    ├── tools: [api-create, api-deploy, api-rollback]
    └── agents: [github-actions]
```

**Key properties**:
- A `MasterAccount` belongs to exactly one tenant
- Sub-accounts inherit the tenant's tool catalog but can be restricted via an **allow-list**
- Each sub-account has independent quotas, rate limits, and audit logs
- The master account owner sees aggregated metrics across all sub-accounts

### 2. Token Delegation via RFC 8693

Sub-accounts authenticate via **OAuth 2.0 Token Exchange** (RFC 8693). The master account holds a long-lived service token; sub-accounts exchange it for scoped, short-lived tokens:

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Sub-Account │     │ STOA Gateway │     │   Keycloak   │
│   (Agent)    │     │  (Proxy)     │     │   (IdP)      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       │ 1. POST /oauth/token                     │
       │    grant_type=urn:ietf:params:oauth:      │
       │      grant-type:token-exchange            │
       │    subject_token=<master_token>           │
       │    requested_token_type=access_token      │
       │    scope=stoa:read stoa:write             │
       │    audience=sub-account:team-alpha        │
       ├────────────────────►│                     │
       │                     │ 2. Forward to KC    │
       │                     │    Token Exchange   │
       │                     │    SPI              │
       │                     ├────────────────────►│
       │                     │                     │
       │                     │ 3. Scoped token     │
       │                     │    sub=team-alpha   │
       │                     │    scope=stoa:read  │
       │                     │◄────────────────────┤
       │                     │                     │
       │ 4. Scoped token     │                     │
       │◄────────────────────┤                     │
```

**Why RFC 8693 over custom token minting**:
- Standard protocol — supported by Keycloak (Token Exchange SPI), Auth0, Okta
- Sub-account tokens carry the parent's tenant context (`azp` claim = master client)
- Gateway can validate sub-account scope without additional lookups
- Revocation cascades: revoking the master token invalidates all sub-account tokens

**Keycloak configuration**:
- Enable Token Exchange on the master client
- Create a `token-exchange` permission linking master to sub-account clients
- Sub-account clients are `confidential` with `client_credentials` grant (no user interaction)

**Fallback for KC without Token Exchange SPI (Council adjustment #2)**: When Token Exchange SPI is unavailable (older KC versions, managed IdPs), sub-accounts can authenticate via **dedicated API keys** with embedded sub-account metadata. The gateway maps the API key to a sub-account context, providing the same policy enforcement — without the benefits of short-lived tokens and cascading revocation. This is a degraded mode, not the recommended path.

### 3. CRUD Ownership (Council adjustment #3)

Federation entity management follows the existing Control Plane pattern:

| Layer | Responsibility | Technology |
|-------|---------------|------------|
| **Control Plane API** (Python) | Entity CRUD: master accounts, sub-accounts, tool allow-lists, quotas | SQLAlchemy + Alembic, REST endpoints |
| **STOA Gateway** (Rust) | Runtime enforcement: allow-list cache, sub-account quota, metering | moka cache, Axum middleware |
| **Gateway Admin API** | Read-only projections: `/admin/federation/status`, `/admin/federation/cache/stats` | Existing admin pattern |

The gateway does NOT own federation entity CRUD. It receives configuration from the Control Plane API (same sync pattern as tool registry and API definitions).

### 4. Gateway Federation Routing

The gateway routes tool calls based on the sub-account identity extracted from the JWT:

```
MCP tools/call request
       │
       ▼
┌─────────────────────┐
│  JWT Extraction      │  Extract sub_account_id from token claims
│  (auth middleware)   │  (custom claim or azp + sub combination)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sub-Account Policy  │  Check: is this tool in the sub-account allow-list?
│  (federation layer)  │  Check: has the sub-account exceeded its quota?
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Tool Resolution     │  Resolve tool from:
│  (existing pipeline) │  1. Local tenant tools (tenant registry)
│                      │  2. Federated upstream tools (UpstreamMcpClient)
│                      │  3. Composed tools (ComposedTool pipeline)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Metering            │  Emit Kafka event with sub_account_id dimension
│  (per-sub-account)   │  (extends existing metering — ADR-043)
└──────────────────────┘
```

**Implementation in the gateway** (Rust):
- New `federation` middleware layer between auth and tool resolution
- `SubAccountContext` extension on the Axum request (similar to existing `TenantContext`)
- Sub-account tool allow-list cached in moka (stale-while-revalidate, same pattern as tool registry)
- Quota enforcement reuses existing `quota_middleware` with sub-account granularity

### 5. Cross-Account Tool Sharing

A master account can share tools across sub-accounts via **tool publication**:

| Sharing Model | Mechanism | Use Case |
|---------------|-----------|----------|
| **Internal sharing** | Sub-account allow-list includes tools from other sub-accounts | Team A uses Team B's internal API tool |
| **Composed sharing** | `ComposedTool` chains local + federated tools | Orchestration: validate, transform, call API |

Tool visibility rules:
1. A sub-account can only see tools explicitly listed in its allow-list
2. The allow-list is a subset of the master account's visible tools (which is a subset of the tenant's full catalog)
3. Federated tools (from upstream MCP servers) are treated identically to local tools for policy purposes
4. Tool publication creates a read-only proxy — the publisher controls the tool definition, consumers get a snapshot

### 6. GDPR Data Isolation (Council adjustment #4)

Sub-account audit logs and metering events are **tenant-scoped**:
- Each sub-account's audit trail is isolated within the parent tenant's data boundary
- Aggregated metrics (master account dashboard) must not leak individual sub-account PII
- Kafka metering events include `sub_account_id` but user-identifying fields follow the existing PII masking pipeline (ADR-043, CAB-1177)
- Sub-account deletion triggers cascade deletion of associated audit logs and metering events

## Alternatives Considered

### A. Flat Multi-Tenant (current model, no hierarchy)

Continue with per-tenant isolation, no sub-accounts. Each team gets their own tenant.

**Rejected because**: no consolidated billing, no cross-team tool sharing, no centralized policy enforcement. Enterprise IT cannot manage 50+ tenants.

### B. API Key Scoping (no token exchange)

Use API keys with embedded sub-account metadata instead of RFC 8693.

**Rejected as primary path** (but retained as fallback — see Section 2): API keys are long-lived secrets (rotation burden), cannot carry dynamic scopes, and don't integrate with existing OAuth 2.1 flow (ADR-044). Token exchange is the standard approach for delegation.

### C. Gateway-Side Token Minting

Gateway mints sub-account tokens locally (no Keycloak involvement).

**Rejected because**: splits the token issuer (Keycloak for users, gateway for sub-accounts). Complicates token validation, revocation, and audit. Keycloak's Token Exchange SPI handles this correctly.

## Consequences

### Positive

- **Enterprise-ready**: Master account model matches enterprise procurement (one contract, N teams)
- **Standards-based**: RFC 8693 token exchange, no custom auth protocol
- **Incremental**: Builds on existing federation module (upstream client, tool composition)
- **Observable**: Per-sub-account metering via existing Kafka pipeline (ADR-043)
- **Secure**: Sub-account tokens are scoped and short-lived, revocation cascades from master

### Negative

- **Keycloak dependency**: Token Exchange SPI must be enabled and configured per realm (mitigated by API key fallback)
- **Complexity**: Master to sub-account hierarchy adds a new dimension to policy evaluation
- **Migration**: Existing single-connection tenants need no migration, but new federation features require Control Plane API schema changes (Alembic migration)

### Risks

| Risk | Mitigation |
|------|------------|
| Token Exchange SPI not enabled in customer's Keycloak | API key fallback (degraded mode); document KC requirements; Helm auto-setup |
| Sub-account quota bypass via direct gateway access | All gateway access requires valid JWT — sub-account tokens are the only way to get a scoped JWT |
| Tool allow-list drift (CP vs gateway cache) | Stale-while-revalidate pattern (existing) with configurable TTL per federation account |

## Implementation Phases

### Phase 1: Federation Model + API (~13 pts)

- `MasterAccount` and `SubAccount` models in Control Plane API
- Alembic migration for `master_accounts`, `sub_accounts`, `sub_account_tools` tables
- CRUD endpoints in CP API (`/api/v1/federation/`)
- Keycloak Token Exchange configuration helper (KC admin API calls)
- API key fallback for sub-account auth (degraded mode)
- Unit tests: 20+ tests across model, repository, service, router

### Phase 2: Gateway Federation Routing (~13 pts)

- `SubAccountContext` extraction from JWT claims
- Federation middleware (between auth and tool resolution)
- Sub-account tool allow-list caching (moka, stale-while-revalidate)
- Per-sub-account quota enforcement (extends existing `quota_middleware`)
- Kafka metering events with `sub_account_id` dimension
- Gateway admin read-only endpoints (`/admin/federation/status`, `/admin/federation/cache/stats`)
- Cross-account tool sharing via `FederatedTool` proxying

### Phase 3: Dashboard + Admin UI (~8 pts)

- Console UI: Federation management page (master accounts, sub-accounts, tool assignments)
- Usage dashboard with per-sub-account breakdown (aggregated, GDPR-safe)
- E2E tests: 5+ scenarios covering federation lifecycle

## References

- [RFC 8693: OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [Keycloak Token Exchange](https://www.keycloak.org/docs/latest/securing_apps/#_token-exchange)
- [MCP Specification 2025-03-26](https://spec.modelcontextprotocol.io/)
- [ADR-024: Gateway Unified Modes](/docs/architecture/adr/adr-024-gateway-unified-modes)
- [ADR-043: Kafka MCP Event Bridge](/docs/architecture/adr/adr-043-kafka-mcp-event-bridge)
- [ADR-044: MCP OAuth 2.1 Gateway Proxy](/docs/architecture/adr/adr-044-mcp-oauth-gateway-proxy)
