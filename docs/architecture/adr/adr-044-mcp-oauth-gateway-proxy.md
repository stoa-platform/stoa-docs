---
title: "ADR-044: MCP OAuth 2.1 Gateway Proxy Architecture"
description: "Decides that the STOA Gateway acts as OAuth 2.1 proxy between MCP clients and Keycloak, serving curated metadata and normalizing DCR payloads."
keywords: [MCP, OAuth 2.1, RFC 9728, RFC 8414, DCR, PKCE, gateway proxy, Keycloak]
---

# ADR-044: MCP OAuth 2.1 Gateway Proxy Architecture

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-02-15 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-1281 |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — edge-mcp mode (current)
- **ADR-039**: mTLS Cert-Bound Tokens — mTLS bypass for OAuth paths
- **ADR-041**: Plugin Architecture — community vs enterprise feature gates
- **CAB-1094**: MCP OAuth 2.1 implementation (PRs #528, #532, #541)

## Context

STOA's MCP Gateway enables AI agents (Claude.ai, ChatGPT, custom clients) to interact with enterprise APIs via the Model Context Protocol. MCP 2025-03-26 mandates OAuth 2.1 for authentication, using RFC 9728 (Protected Resource Metadata) for discovery.

### The Problem

When Claude.ai connects to `${STOA_GATEWAY_URL}/mcp/sse`, it follows this OAuth discovery chain:

```
1. GET /.well-known/oauth-protected-resource  → reads authorization_servers[0]
2. GET /.well-known/oauth-authorization-server → reads registration_endpoint, token_endpoint
3. POST /oauth/register                       → Dynamic Client Registration (DCR)
4. GET  /authorize (browser)                  → User consent + PKCE
5. POST /oauth/token                          → Exchange code for access token
```

Direct Keycloak integration fails at multiple points:

1. **Keycloak metadata doesn't advertise `"none"` auth method** — MCP clients are public (browser-based, no client_secret). Keycloak's `/.well-known/openid-configuration` only lists `client_secret_basic` and `client_secret_post`, causing clients to fail at step 3.

2. **Keycloak DCR replaces realm scope defaults** — When a client sends `scope: "openid profile stoa:read"` in the DCR payload, Keycloak treats this as an exhaustive scope list, removing all realm default scopes (`profile`, `email`, `roles`, `web-origins`). The client then fails authorization with `invalid_scope`.

3. **Keycloak DCR creates confidential clients** — DCR defaults to `publicClient: false`, requiring a `client_secret` that browser-based MCP clients cannot securely store.

4. **mTLS blocks OAuth discovery** — When mTLS is enabled (ADR-039), the extraction middleware returns `MTLS_CERT_REQUIRED` (401) before the client can discover OAuth endpoints, preventing the `WWW-Authenticate: Bearer` challenge that triggers the OAuth flow.

### Production Incidents

These issues were discovered during Claude.ai integration (Feb 2026):

| PR | Issue | Root Cause | Fix |
|----|-------|------------|-----|
| #528 | OAuth endpoints unreachable | mTLS middleware blocks before OAuth challenge | Hardcoded bypass list for OAuth/MCP paths |
| #532 | `token_endpoint_auth_methods` missing `"none"` | Keycloak metadata doesn't advertise public client support | Gateway serves curated metadata |
| #541 | `invalid_scope` during authorization | DCR `scope` field replaces Keycloak realm defaults | Gateway strips `scope` from DCR payload |

## Decision

### Gateway as OAuth Metadata Curator + Proxy

The STOA Gateway serves as an intermediary between MCP clients and Keycloak, with three responsibilities:

#### 1. Curated OAuth Discovery (RFC 9728 + RFC 8414)

The gateway serves its own `/.well-known/oauth-protected-resource` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414) endpoints with curated metadata:

```
RFC 9728 (Protected Resource):
  resource: ${STOA_GATEWAY_URL}
  authorization_servers: [${STOA_GATEWAY_URL}]    ← gateway, NOT Keycloak
  scopes_supported: [openid, profile, email, stoa:read, stoa:write, stoa:admin]

RFC 8414 (Authorization Server):
  issuer: ${STOA_AUTH_URL}/realms/stoa             ← Keycloak (JWT validation)
  authorization_endpoint: ${STOA_AUTH_URL}/...      ← Keycloak (browser-facing)
  token_endpoint: ${STOA_GATEWAY_URL}/oauth/token   ← gateway proxy
  registration_endpoint: ${STOA_GATEWAY_URL}/oauth/register  ← gateway proxy
  token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"]
  code_challenge_methods_supported: ["S256"]
```

**Key invariant**: `authorization_servers` in RFC 9728 MUST point to the gateway URL. This ensures clients discover the gateway's curated metadata (with `"none"` auth method) instead of Keycloak's native metadata.

#### 2. DCR Proxy with Payload Normalization

`POST /oauth/register` proxies to Keycloak's DCR endpoint with two modifications:

1. **Scope stripping** — removes the `scope` field from the DCR payload before forwarding. This preserves Keycloak's realm default scopes instead of replacing them.

2. **Public client patching** — after successful DCR, the gateway uses the Keycloak Admin API to:
   - Set `publicClient: true` (removes client_secret requirement)
   - Set `pkce.code.challenge.method: S256` (enables PKCE)

This two-step approach (DCR + admin patch) is necessary because Keycloak's DCR API does not support `publicClient` or PKCE attributes directly.

#### 3. Token Proxy

`POST /oauth/token` is a transparent proxy to Keycloak's token endpoint. No modification — forwards request and response as-is. This ensures token exchange works through the gateway URL advertised in metadata.

### mTLS Bypass (Hardcoded)

OAuth and MCP discovery paths bypass mTLS extraction middleware unconditionally:

```
Bypass prefixes: /.well-known/, /oauth/, /mcp/sse, /mcp/tools/, /mcp/v1/
Bypass exact:    /mcp, /mcp/capabilities, /mcp/health, /health, /ready, /metrics
```

This list is **hardcoded, not configurable** — a deliberate design decision. A misconfigured bypass list would silently break MCP OAuth for all clients, with no obvious error message (mTLS returns 401 before the OAuth challenge).

### MCP Protocol Negotiation

Claude.ai requests MCP protocol version `2025-11-25`. The gateway negotiates down to `2025-03-26` (the latest version the gateway implements). This negotiation is transparent — the client adapts to the negotiated version.

## Architecture Diagram

```
Claude.ai (MCP Client)
    │
    │  1. GET /.well-known/oauth-protected-resource
    ▼
┌─────────────────────────────────────────────────────┐
│  STOA Gateway (${STOA_GATEWAY_URL})                 │
│                                                     │
│  ┌─ discovery.rs ─────────────────────────────────┐ │
│  │  RFC 9728: authorization_servers → [gateway]   │ │
│  │  RFC 8414: token_endpoint → gateway/oauth/token│ │
│  │           registration   → gateway/oauth/register│
│  │           authorization  → Keycloak/auth       │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ proxy.rs ─────────────────────────────────────┐ │
│  │  POST /oauth/register                          │ │
│  │    1. Strip `scope` from payload               │ │
│  │    2. Forward to Keycloak DCR                  │ │
│  │    3. Patch client → public + PKCE S256        │ │
│  │                                                │ │
│  │  POST /oauth/token                             │ │
│  │    → Transparent proxy to Keycloak             │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ mtls.rs ──────────────────────────────────────┐ │
│  │  is_mtls_bypass_path() → hardcoded bypass list │ │
│  │  OAuth/MCP paths skip mTLS entirely            │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────┘
                          │
                          │  DCR + token + admin API
                          ▼
              ┌───────────────────────┐
              │  Keycloak (IdP)       │
              │  ${STOA_AUTH_URL}     │
              │                       │
              │  - Realm: stoa        │
              │  - DCR: enabled       │
              │  - PKCE: supported    │
              │  - Scopes: openid,    │
              │    stoa:read/write/   │
              │    admin              │
              └───────────────────────┘
```

## Rejected Alternatives

### Alternative 1: Direct Keycloak Metadata (No Proxy)

Point `authorization_servers` directly to Keycloak (`${STOA_AUTH_URL}/realms/stoa`). Let MCP clients interact with Keycloak natively.

**Rejected because**:
- Keycloak metadata doesn't advertise `token_endpoint_auth_methods: ["none"]` — public MCP clients cannot register
- No opportunity to normalize DCR payloads (scope stripping)
- No opportunity to patch clients to public + PKCE
- mTLS bypass would need Keycloak-side configuration (not in our control for managed Keycloak deployments)

### Alternative 2: Keycloak SPI Extension

Write a Keycloak SPI plugin to customize DCR behavior (auto-public client, scope normalization, metadata override).

**Rejected because**:
- Keycloak SPI development is complex and version-coupled (API breaks between KC 23/24/25)
- Deployment friction: custom JAR in every Keycloak instance
- Not portable to other IdPs (Auth0, Okta, Azure AD)
- Gateway proxy is simpler, testable, and IdP-agnostic

### Alternative 3: Configurable Bypass List

Make the mTLS bypass paths configurable via environment variable or config file.

**Rejected because**:
- A misconfigured bypass list silently breaks MCP OAuth for all clients
- The error mode is opaque: mTLS returns 401 before OAuth challenge, giving no hint about the root cause
- The bypass paths are protocol-defined (RFC 9728, MCP spec) and should not change
- Hardcoded list is simpler, safer, and self-documenting

## Keycloak Version Compatibility

| Feature | KC 23 | KC 24 | KC 25 | Notes |
|---------|-------|-------|-------|-------|
| DCR endpoint | ✅ | ✅ | ✅ | Stable across versions |
| `scope` in DCR replaces defaults | ✅ | ✅ | ✅ | Consistent behavior (by design) |
| Admin API client patch | ✅ | ✅ | ✅ | PUT `/admin/realms/{r}/clients/{id}` |
| `publicClient` attribute | ✅ | ✅ | ✅ | Supported in all versions |
| PKCE attributes | ✅ | ✅ | ✅ | Via `attributes.pkce.code.challenge.method` |
| Allowed Client Scopes policy | ✅ | ✅ | ✅ | Component-based policy in DCR |

**Known risk**: future Keycloak versions may change DCR scope handling behavior. The scope stripping logic in the gateway is a safe hedge — if KC stops replacing defaults, stripping scope is a no-op (no harm).

## Competitive Context

As of February 2026, STOA is the only open-source API gateway implementing the full MCP OAuth 2.1 flow:

- **RFC 9728** Protected Resource Metadata discovery
- **RFC 8414** Authorization Server Metadata with curated public client support
- **Dynamic Client Registration** with scope normalization and PKCE patching
- **mTLS coexistence** — OAuth and mTLS on the same gateway without conflict

Kong, Gravitee, and Tyk support OAuth 2.0 for API consumers but none implement MCP-specific OAuth discovery or DCR proxy patterns.

<!-- Feature comparisons are based on publicly available documentation as of 2026-02. Product capabilities change frequently. We encourage readers to verify current features directly with each vendor. All trademarks belong to their respective owners. -->

## Consequences

### Positive

- **MCP clients work out of the box** — no Keycloak configuration required beyond DCR enablement and scope creation
- **IdP-agnostic** — the proxy pattern can work with any OAuth 2.0/OIDC provider, not just Keycloak
- **Safe mTLS coexistence** — hardcoded bypass prevents config-level mistakes
- **Testable** — each proxy function has unit tests with wiremock (15 tests in `proxy.rs`, 7 in `discovery.rs`)

### Negative

- **Dependency on Keycloak Admin API** — PKCE patching requires `KEYCLOAK_ADMIN_PASSWORD` env var. Without it, clients are created as confidential (logged as warning, not fatal)
- **Two-step DCR** — client registration + admin patch is not atomic. A crash between steps leaves a confidential client in Keycloak (harmless but untidy)
- **Metadata drift risk** — if Keycloak adds new grant types or scopes, the gateway's curated metadata must be updated manually

### Regression Protection

| Layer | Tests | What's Covered |
|-------|-------|----------------|
| Unit (`proxy.rs`) | 15 | Token proxy, DCR proxy, scope stripping, error cases |
| Unit (`discovery.rs`) | 7 | Metadata fields, URL construction, defaults |
| Unit (`mtls.rs`) | 4 | Bypass paths (OAuth, MCP, infra, non-bypass) |
| Contract (`oauth.rs`) | 3 | Snapshot: `authorization_servers`, metadata shape |
| Integration (`mcp.rs`) | 12 | OAuth discovery endpoints, metadata validation |
| E2E (bash) | 9 steps | Full flow: discovery → DCR → token (manual) |
