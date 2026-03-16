---
sidebar_position: 14
title: "Release Notes"
description: "STOA Platform release notes — version history, new features, breaking changes, and migration guides for every release."
keywords:
  - release notes
  - changelog
  - releases
  - version history
  - breaking changes
  - migration
---

# Release Notes

Complete release history for STOA Platform. Each release includes highlights, breaking changes, and upgrade instructions.

:::tip Latest
**v2.3.0** (March 2026) — Pingora connection engine, per-tenant chat settings, zero-config Helm bootstrap.
:::

---

## v2.3.0 (March 2026) {#v230}

**Pingora Engine, Chat Settings, Zero-Config Bootstrap**

[Full release post](/blog/release-v2.3.0)

### Highlights

- **Pingora connection engine** — Cloudflare's battle-tested proxy framework (1T+ req/day) embedded in STOA Gateway behind a `pingora` feature flag. Shared connection pooling replaces per-client reqwest pools at scale ([ADR-058](/docs/architecture/adr/adr-058-pingora-integration))
- **Per-tenant chat settings** — independent Console/Portal chat toggles, daily token budget, source tracking via `X-Chat-Source` header, usage breakdown by app
- **Zero-config Helm bootstrap** — single `helm install` provisions Keycloak realm, 4 RBAC roles, 3 client scopes, 4 OIDC clients, admin user, and default tenant
- **Shared secrets management** — auto-generated internal keys (gateway, chat, JWT) stable across upgrades via Helm `lookup`
- **Real-data demo APIs** — 5 public APIs (Exchange Rate, CoinGecko, OpenWeatherMap, NewsAPI, Alpha Vantage) + echo fallback pre-seeded in portal
- **OAuth hairpin NAT fix** — gateway uses internal Keycloak URL for DCR/token proxy, fixing 502 on K8s clusters with hairpin NAT

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/chat/settings` | Read tenant chat configuration |
| `PUT` | `/v1/chat/settings` | Update chat toggles and budget |

### New Helm Values

| Key | Default | Description |
|-----|---------|-------------|
| `stoa.domain` | — | Base domain for all services |
| `stoa.adminEmail` | — | Admin user email (bootstrap) |
| `stoa.anthropicApiKey` | — | Anthropic API key (optional, enables chat) |
| `stoa.bootstrap.enabled` | `false` | Enable first-time platform provisioning |

### Breaking Changes

None. All changes are backwards compatible.

### PRs

#1806, #1807, #1808, #1809, #1810, #1811, #1812, #1813, #1814, #1816, #1817 (11 PRs)

---

## v2.2.0 (March 2026) {#v220}

**LLM Proxy, Self-Service Signup, Skills System**

[Full release post](/blog/release-v2.2.0)

### Highlights

- **LLM Proxy** — multi-provider routing (OpenAI, Azure OpenAI, Mistral) with per-tenant budget tracking and circuit breakers
- **Self-service signup** — end-to-end tenant provisioning flow with trial limits
- **MCP Protocol 2025-11-25** — resources, prompts, completion endpoints, lazy discovery
- **OAuth 2.1 hardening** — DPoP proof-of-possession binding, RFC 7592 DCR management
- **Skills system** — gateway-native CRUD with circuit breaker health tracking
- **UAC (Universal API Contract)** — JSON Schema v1.0 validator, OpenAPI reverse transform
- **Gateway adapters** — AWS API Gateway + Azure APIM added; Kong, Gravitee, Apigee enhanced
- **PII masking** — middleware + admin endpoints
- **Security posture scanner** — automated security assessment
- **12 new API endpoints** — billing, contracts, data governance, provisioning, PII, signup
- **Gateway Arena** — 20-dimension enterprise AI readiness benchmark
- **Integrated AI chat assistant** — floating widget in Console and Portal

### Breaking Changes

None. All backwards compatible.

---

## v2.0.0 (February 2026) {#v200}

**Rust Gateway, Multi-Gateway Adapters, GitOps**

### Highlights

- **STOA Gateway (Rust)** — replaces Python MCP Gateway as primary gateway (Tokio + axum)
- **Multi-gateway adapter pattern** — Kong, Gravitee, webMethods support
- **Environment management** — dev/staging/production lifecycle
- **Gateway Arena** — continuous benchmarking lab
- **Audit trail** — dual-write to PostgreSQL + OpenSearch
- **ArgoCD GitOps** — declarative deployment on OVH + Hetzner
- **4 CRDs** — Tool, ToolSet, GatewayInstance, GatewayBinding
- **mTLS support** — certificate-bound tokens (RFC 8705)

### Breaking Changes

- Python MCP Gateway moved to `archive/mcp-gateway/`
- Gateway API endpoints changed from `/mcp/*` to `/v1/*`
- CRD API group changed from `stoa.io` to `gostoa.dev`
- Keycloak client audience mapper must include new gateway

### Migration

```bash
# Update CRDs
kubectl apply -f charts/stoa-platform/crds/

# Update Keycloak audience mapper to include stoa-gateway
# Re-deploy all components with new Helm chart
helm upgrade stoa-platform ./charts/stoa-platform -n stoa-system
```

---

## v0.1.0 (February 2026) {#v010}

**Initial Public Release — MVP**

[Full release post](/blog/release-v0.1.0)

First public open-source release of STOA Platform under Apache 2.0 license.

### Highlights

- **Control Plane API** — Python/FastAPI, multi-tenant architecture
- **Python MCP Gateway** — MCP support, OPA policies, API key auth
- **Console UI** — tenant management, user admin, policy configuration
- **Developer Portal** — self-service catalog, subscriptions, usage dashboards
- **Keycloak SSO** — OIDC integration, LDAP federation, multi-realm
- **Helm chart** — full Kubernetes deployment
- **E2E test suite** — Playwright + BDD (Gherkin)

### Breaking Changes

N/A — initial release.

---

## Versioning Policy

STOA Platform follows [Semantic Versioning](https://semver.org/):

| Segment | When Incremented | Example |
|---------|-----------------|---------|
| **Major** (X.0.0) | Breaking API changes | Removed endpoint, changed schema |
| **Minor** (0.X.0) | New features, backwards-compatible | New endpoint, new CRD field |
| **Patch** (0.0.X) | Bug fixes, security patches | Fix regression, update dependency |

## Deprecation Policy

| Stage | Timeline | Action |
|-------|----------|--------|
| **Deprecated** | Announced in release notes | Feature works but logs warnings |
| **Removal planned** | Next major version | Documentation updated, migration guide provided |
| **Removed** | Major version release | Feature removed, breaking change documented |

Deprecated features are supported for at least one major version cycle.

## Stay Updated

- **GitHub Releases**: [github.com/stoa-platform/stoa/releases](https://github.com/stoa-platform/stoa/releases)
- **Blog**: [docs.gostoa.dev/blog](https://docs.gostoa.dev/blog)
- **RSS**: Subscribe to the blog RSS feed for release announcements
- **Roadmap**: [Current roadmap](/docs/roadmap) for planned features

## Related

- [Upgrade Guide](/docs/admin/upgrade) — Version upgrade procedures
- [Roadmap](/docs/roadmap) — Planned features
- Security Changelog (`SECURITY-CHANGELOG.md` in repo root) — Security-specific changes
- [ADRs](/docs/architecture/adr) — Architecture decisions
