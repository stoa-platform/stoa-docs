---
title: "ADR-041: Plugin Architecture — Community Core vs Enterprise Extensions"
description: "Architecture decision for tiered feature delivery: a secure, batteries-included Community Core for freelancers and indie developers, with opt-in Enterprise Extensions for large organizations. MCP-to-everything as the core differentiator."
keywords: [ADR, plugin, community, enterprise, MCP, feature-flags, keychain, security, OpenAPI, bridge, stoactl]
---

# ADR-041: Plugin Architecture — Community Core vs Enterprise Extensions

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-02-12 |
| **Decision Makers** | Christophe ABOULICAM, Platform Team |
| **Linear** | CAB-1136 |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — 4 deployment modes (edge-mcp, sidecar, proxy, shadow)
- **ADR-037**: Deployment Modes Sovereign-First — Sovereign, Hybrid, SaaS tiers
- **ADR-039**: mTLS Mutual Authentication — Enterprise-grade certificate auth
- **ADR-040**: Born GitOps — Multi-environment promotion architecture

## Context

### The Problem

STOA has 559 gateway tests, mTLS, circuit breakers, multi-tenant RBAC, OIDC federation, and Kafka metering. All of this is invisible to a freelancer who just wants to expose their REST API to AI agents via MCP.

Today, there is no `stoa init`. No 30-second path from zero to first MCP call. The platform is enterprise-ready but community-hostile.

Meanwhile, the competitive landscape has shifted dramatically:

<!-- last verified: 2026-02 -->

| Platform | MCP Support | Open Source | Community Tier | "MCP to Everything" |
|----------|-------------|-------------|----------------|---------------------|
| **Kong** | [Enterprise MCP Gateway](https://konghq.com/blog/product-releases/enterprise-mcp-gateway) + [Context Mesh](https://konghq.com/company/press-room/press-release/kong-launches-context-mesh-to-connect-enterprise-data-to-ai-agents) (Feb 2026) | Community Edition (BSL for enterprise features) | Limited — no MCP in OSS | Kong-managed APIs only |
| **Gravitee** | [4.10 MCP Proxy](https://www.gravitee.io/blog/gravitee-4.10-one-control-point-to-secure-govern-ai-agents-mcp-and-llms) + [AI Agent Management](https://www.gravitee.io/platform/ai-agent-management) (Jan 2026) | OSS (enterprise features gated) | Limited — MCP is enterprise | Gravitee-managed APIs only |
| **STOA** | MCP Gateway (Rust, production) | Apache 2.0 (no BSL, no feature gating) | **Missing** | **Any API, any protocol** |

### The Insight: MCP to Everything, Not MCP to MCP

Kong transforms APIs **already managed by Kong** into MCP tools. Gravitee proxies MCP traffic **between MCP-aware components**. Neither bridges non-MCP backends to MCP.

STOA's differentiator is **MCP to Everything**:

```
REST API      ──→ UAC ──→ MCP Tools
SOAP Service  ──→ UAC ──→ MCP Tools
GraphQL API   ──→ UAC ──→ MCP Tools
gRPC Service  ──→ UAC ──→ MCP Tools
Legacy HTTP   ──→ UAC ──→ MCP Tools
```

The UAC (Universal API Contract) is the translation layer. "Define Once, Expose Everywhere" — including to AI agents.

### The Strategic Question

> How do we make STOA accessible to freelancers in 30 seconds while keeping enterprise features available for large organizations?

## Decision

### Principle #1: Security Is Not a Tier

Security features are **always included**, even in the free Community Core. Credential storage uses the OS keychain by default — never plaintext files. This is a fundamental design principle, not a premium feature.

This positions STOA against every competitor:
- Kong: admin tokens in headers, no native keychain
- kubectl: tokens in plaintext `~/.kube/config`
- AWS CLI: credentials in plaintext `~/.aws/credentials`
- Docker: tokens in base64 (not encrypted) in `~/.docker/config.json`

### Principle #2: Community Core = Complete Product

The Community Core is not a crippled trial. It is a fully functional API-to-MCP gateway that a freelancer can use in production, forever, for free.

### Principle #3: Enterprise Extensions = Opt-In Activation

Enterprise features are already implemented in the codebase. They are activated via Cargo feature flags, configuration, or Keycloak setup — not via license keys or paywalls.

### Two-Tier Architecture

#### Tier 1 — Community Core (Apache 2.0, free forever)

| Category | Feature | Status |
|----------|---------|--------|
| **Gateway** | Proxy + routing | ✅ Implemented |
| **Gateway** | Rate limiting | ✅ Implemented |
| **Gateway** | API key authentication | ✅ Implemented |
| **Gateway** | SSRF protection | ✅ Implemented |
| **Gateway** | Security headers | ✅ Implemented |
| **Gateway** | Prometheus metrics | ✅ Implemented |
| **Bridge** | OpenAPI → MCP auto-bridge | **To build** |
| **Bridge** | SOAP (WSDL) → MCP bridge | Planned (Q3) |
| **Bridge** | GraphQL → MCP bridge | Planned (Q3) |
| **CLI** | `stoactl init` (project scaffold) | **To build** |
| **CLI** | `stoactl bridge` (import + expose) | **To build** |
| **CLI** | `stoactl doctor` (diagnostic) | **To build** |
| **Security** | OS Keychain credential storage | **To build** |
| **Security** | Key rotation (`stoactl auth rotate-key`) | **To build** |
| **Security** | Credential access audit log | **To build** |
| **Packaging** | Docker image `stoa:community` | **To build** |
| **Docs** | "Getting Started in 5 Minutes" guide | **To build** |

#### Tier 2 — Enterprise Extensions (opt-in, same Apache 2.0 license)

| Category | Feature | Activation | Status |
|----------|---------|------------|--------|
| **Auth** | mTLS mutual authentication | Config + `--features mtls` | ✅ Implemented (PR #224) |
| **Auth** | OIDC federation (multi-realm) | Keycloak config | ✅ Implemented |
| **Auth** | Multi-tenant RBAC | Keycloak config | ✅ Implemented |
| **Resilience** | Circuit breaker | Gateway config | ✅ Implemented (PR #218) |
| **Observability** | Kafka metering | `--features kafka` | ✅ Implemented |
| **Observability** | OpenTelemetry tracing | `--features otel` | Planned |
| **Deployment** | Sidecar mode (Kong/Envoy/NGINX) | `STOA_MODE=sidecar` | Stub (Q2) |
| **Deployment** | Shadow mode (traffic → UAC auto-gen) | `STOA_MODE=shadow` | Partial |
| **Deployment** | K8s CRD watcher + federation | `--features k8s` | Planned |
| **Deployment** | Multi-environment promotion | GitOps (ADR-040) | ✅ Implemented |
| **Packaging** | Docker image `stoa:enterprise` | All features compiled | **To build** |
| **Support** | SLA + consulting | Commercial contract | — |

### Credential Storage Architecture

API keys and tokens MUST be stored in the OS keychain. Never in plaintext files.

#### Resolution Hierarchy (priority order)

```
1. --api-key flag          (one-time use, never persisted)
2. STOA_API_KEY env var    (CI/CD and containers only)
3. OS Keychain             (macOS Keychain / Linux secret-service / Windows Credential Manager)
4. ❌ NEVER a plaintext file
```

#### Implementation

| OS | Backend | Library |
|----|---------|---------|
| macOS | Security.framework (Keychain) | Go: `go-keyring`, Rust: `keyring` crate |
| Linux | D-Bus Secret Service (GNOME Keyring / KWallet) | Go: `go-keyring`, Rust: `keyring` crate |
| Windows | Credential Manager (WinCred) | Go: `go-keyring`, Rust: `keyring` crate |
| CI/headless | Env var fallback (`STOA_API_KEY`) | Native |
| Container | Mounted file (`/run/secrets/stoa`) | Native |

#### Security Requirements (Epictetus review)

- **Auto-rotation**: `stoactl auth rotate-key --auto --interval 90d` schedules key rotation
- **Audit log**: every keychain read/write logged to `~/.stoa/audit.log` (local, not sent anywhere)
- **`stoactl auth status`**: shows "Key stored in: macOS Keychain" (never shows the key itself)
- **No `~/.stoa/credentials`**: the file must not exist. If detected, `stoactl doctor` warns and offers migration

### The 30-Second Path: `stoactl init` → `stoactl bridge`

```bash
# Freelance: zero to MCP in 30 seconds
$ stoactl init my-project
✓ Created docker-compose.yml (gateway + echo backend)
✓ Created stoa.yaml (minimal config)
✓ Run: cd my-project && docker compose up -d

$ stoactl bridge ./openapi.yaml
✓ Parsed OpenAPI 3.x spec
✓ Generated 8 MCP tools from 8 endpoints
✓ Registered tools on gateway
✓ MCP endpoint: http://localhost:8080/mcp/sse

# Done. Any MCP client (Claude, GPT, etc.) can call your API.
```

#### `stoactl doctor` (Zeno review)

Diagnostic command that verifies the full stack:

```bash
$ stoactl doctor
✓ Docker: running (v27.5.1)
✓ Gateway: healthy (http://localhost:8080/health)
✓ Keychain: accessible (macOS Keychain)
✓ API key: valid (expires in 87 days)
✓ Port 8080: available
✓ MCP endpoint: responding (3 tools registered)
✗ OpenAPI spec: 2 warnings (circular ref in #/components/schemas/Node)
```

### Growth Path

The same user, same codebase, scales from freelance to enterprise:

| Stage | What They Use | Cost |
|-------|---------------|------|
| **Day 1** — Freelance | `stoactl init` + `bridge` → REST to MCP | 0€ |
| **Day 30** — Growing | + API keys for clients + rate limiting + monitoring | 0€ |
| **Day 90** — Scale-up | + custom domains + multi-API catalog | 0€ |
| **Day 180** — Enterprise | + mTLS + RBAC + federation + sidecar mode + SLA | Support contract |

### Docker Packaging

Two images, same Dockerfile with build args:

| Image | Features Compiled | Size Target | Use Case |
|-------|-------------------|-------------|----------|
| `ghcr.io/stoa-platform/gateway:community` | Default (no optional features) | < 30 MB | Freelance, indie, small teams |
| `ghcr.io/stoa-platform/gateway:enterprise` | `--all-features` (kafka, k8s, otel, mtls) | < 50 MB | Large organizations |
| `ghcr.io/stoa-platform/gateway:latest` | Alias for `community` | < 30 MB | Default pull |

Both images are Apache 2.0. The enterprise image is not "paid" — it just includes heavier dependencies (rdkafka, k8s client, etc.) that most freelancers don't need.

## Consequences

### Positive

- **Community adoption**: 30-second onboarding removes the #1 friction
- **MCP-to-everything positioning**: unique vs Kong (MCP-for-Kong) and Gravitee (MCP-to-MCP proxy)
- **Security by default**: keychain-first is a genuine differentiator against every competitor
- **No BSL trap**: Apache 2.0 for everything, including enterprise features — trust signal for OSS community
- **Enterprise upsell natural**: same platform, same code, just activate more features + buy support

### Negative

- **OpenAPI bridge complexity**: circular refs, `allOf`/`oneOf`/`anyOf`, discriminators, polymorphic schemas require a robust parser — not a simple mapping
- **Cross-OS keychain testing**: macOS Keychain, GNOME Keyring, KWallet, Windows Credential Manager all behave differently
- **Two Docker images = two CI pipelines**: build matrix, testing matrix, release coordination
- **No revenue gate**: enterprise features are free — revenue comes only from support/consulting

### Mitigations

- OpenAPI bridge: use proven parser (`utoipa` for Rust, `libopenapi` for Go) — don't hand-roll
- Keychain: `keyring` crate/library abstracts all OS backends behind one API
- Docker: single Dockerfile with `ARG FEATURES=""`, conditional `cargo build`
- Revenue: shadow mode is the closer — "we analyze your traffic estate for free, you pay for the migration consulting"

## Alternatives Considered

### Alternative A: BSL/SSPL License for Enterprise Features

Kong and Elastic use BSL (Business Source License) to gate features. Revenue-protective but community-hostile.

**Rejected**: STOA's positioning is explicitly anti-BSL. Apache 2.0 is a trust signal. Changing license would destroy credibility before building it.

### Alternative B: Feature Flags via License Key

Traditional SaaS model — enterprise features require a license key file.

**Rejected**: adds complexity, creates support burden, doesn't align with "security is not a tier" principle. Cargo feature flags at compile time are simpler and more transparent.

### Alternative C: Separate Enterprise Codebase (Fork)

Maintain a private fork with enterprise-only code.

**Rejected**: maintenance nightmare, merge conflicts, community contributions can't benefit from enterprise hardening. Single codebase with feature flags is strictly better.

## Implementation Plan

### Phase 1 — Community CLI (`stoactl`) — CAB-1136-P1

| Step | Deliverable |
|------|-------------|
| 1 | `stoactl init` — scaffold project (docker-compose + config) |
| 2 | `stoactl doctor` — diagnostic command |
| 3 | Keychain integration (`go-keyring`) — store/retrieve/rotate API keys |
| 4 | `stoactl auth` — login, status, rotate-key with keychain backend |
| 5 | Audit log for credential access |

### Phase 2 — OpenAPI-to-MCP Bridge — CAB-1136-P2

| Step | Deliverable |
|------|-------------|
| 1 | OpenAPI 3.x parser (handle refs, allOf/oneOf/anyOf, circular refs) |
| 2 | MCP tool generator (endpoint → tool mapping, parameter extraction) |
| 3 | `stoactl bridge` command (parse + generate + register on gateway) |
| 4 | Hot-reload: file watcher on spec file, auto-update tools on change |

### Phase 3 — Docker Packaging + Documentation — CAB-1136-P3

| Step | Deliverable |
|------|-------------|
| 1 | Dockerfile with `ARG FEATURES` for community/enterprise builds |
| 2 | CI pipeline for dual-image build + push |
| 3 | "Getting Started in 5 Minutes" guide on docs.gostoa.dev |
| 4 | Feature toggle reference documentation |

### Phase 4 — Extended Protocol Bridges — CAB-1136-P4

| Step | Deliverable |
|------|-------------|
| 1 | SOAP (WSDL) → UAC → MCP bridge |
| 2 | GraphQL (introspection) → UAC → MCP bridge |
| 3 | gRPC (proto) → UAC → MCP bridge |

## Competitive Positioning Summary

```
Kong:      "MCP for Kong-managed APIs"     → Vendor lock-in
Gravitee:  "MCP proxy for MCP traffic"     → MCP-to-MCP only
STOA:      "MCP for everything"            → Any API, any protocol, free forever

Kong:      Enterprise MCP Gateway           → $$$$
Gravitee:  Enterprise AI Agent Management   → $$$
STOA:      Community Core + stoactl bridge  → 0€, Apache 2.0

Kong:      Credentials in headers           → Not secure by default
Gravitee:  Standard config files            → Not secure by default
STOA:      OS Keychain by default           → Secure by design, even free tier
```

> **"Kong fait MCP pour Kong. Gravitee fait MCP pour Gravitee. STOA fait MCP pour tout le monde."**

## References

- [Kong Enterprise MCP Gateway](https://konghq.com/blog/product-releases/enterprise-mcp-gateway) — Feb 2026
- [Kong Context Mesh announcement](https://konghq.com/company/press-room/press-release/kong-launches-context-mesh-to-connect-enterprise-data-to-ai-agents) — Feb 10, 2026
- [Kong AI/MCP Gateway technical breakdown](https://konghq.com/blog/engineering/ai-gateway-mcp-gateway-mcp-server-breakdown)
- [Kong MCP Registry (Tech Preview)](https://konghq.com/blog/product-releases/kong-mcp-registry-tech-preview)
- [Gravitee 4.10 — AI, MCP, LLMs](https://www.gravitee.io/blog/gravitee-4.10-one-control-point-to-secure-govern-ai-agents-mcp-and-llms) — Jan 22, 2026
- [Gravitee MCP Proxy](https://www.gravitee.io/blog/mcp-proxy-unified-governance-for-agents-tools)
- [Gravitee AI Agent Management](https://www.gravitee.io/platform/ai-agent-management)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Go Keyring library](https://github.com/zalando/go-keyring)
- [Rust keyring crate](https://crates.io/crates/keyring)
