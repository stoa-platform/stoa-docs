---
sidebar_position: 10
title: Implementation Status
description: "Track STOA Platform's current implementation status across all components — Control Plane, Gateway, Portal, Console, and supporting infrastructure."
keywords: [STOA, implementation, status, roadmap, architecture, components, Rust gateway, MCP]
---

# Implementation Status

Track the current state of each STOA Platform component. This page is updated with each release.

:::info Last Updated
February 2026 — Cycle 7 complete, Rust gateway in production.
:::

## Core Components

| Component | Technology | Status | Description |
|-----------|------------|--------|-------------|
| Control Plane API | Python 3.11, FastAPI, SQLAlchemy | **Production** | API catalog, tenant management, subscriptions, gateway orchestration |
| STOA Gateway | Rust, Tokio, axum | **Production** | High-performance gateway with MCP, REST proxy, rate limiting, mTLS |
| Console UI | React 18, TypeScript, Keycloak-js | **Production** | Admin dashboard for API management, observability, and tenant operations |
| Developer Portal | React, Vite, TypeScript | **Production** | Self-service API discovery, documentation, and subscription management |
| Auth Layer | Keycloak 25 | **Production** | OIDC/OAuth2, LDAP federation, multi-realm tenant isolation |
| CLI | Python, Typer, Rich | **Beta** | Command-line interface for API and tenant management |

## Gateway Capabilities

The STOA Gateway (Rust) is the primary data plane component, replacing the earlier Python-based MCP Gateway (archived February 2026).

| Capability | Status | Details |
|------------|--------|---------|
| MCP Protocol (edge-mcp mode) | **Production** | Tool discovery, invocation, SSE streaming |
| REST Proxy | **Production** | Dynamic upstream routing with health checks |
| Rate Limiting | **Production** | Per-consumer quotas with sliding window |
| Circuit Breaker | **Production** | Per-upstream with configurable thresholds |
| mTLS | **Production** | Certificate-bound tokens (RFC 8705) |
| OIDC Authentication | **Production** | Keycloak JWT validation |
| Security Headers | **Production** | OWASP recommended headers, SSRF blocklist |
| Sidecar Mode | **Planned (Q2 2026)** | Run alongside existing gateways (Kong, Envoy, etc.) |
| Proxy Mode | **Planned (Q3 2026)** | Transparent proxy for legacy backends |
| Shadow Mode | **Planned** | Traffic mirroring for validation |

## Gateway Adapters

STOA supports orchestrating multiple gateway vendors through the [Gateway Adapter Pattern](/docs/architecture/adr/adr-035-gateway-adapter-pattern):

| Adapter | Status | Notes |
|---------|--------|-------|
| STOA (native) | **Production** | Full integration |
| webMethods | **Production** | REST Admin API reconciliation |
| Kong (DB-less) | **Production** | Declarative config sync |
| Gravitee (APIM v4) | **Production** | API + plan management |
| AWS API Gateway | **Planned** | — |
| Azure APIM | **Planned** | — |

## Infrastructure

| Component | Technology | Status |
|-----------|------------|--------|
| Database | PostgreSQL (managed) | **Production** |
| Observability | Prometheus + Grafana | **Production** |
| Log Management | OpenSearch 2.11 | **Production** |
| Secrets | HashiCorp Vault | **Partial** (K8s Secrets used on Hetzner/OVH) |
| GitOps | ArgoCD | **Production** (Hetzner staging) |
| CI/CD | GitHub Actions | **Production** |
| Container Registry | GHCR | **Production** |
| DNS/TLS | Cloudflare + Let's Encrypt | **Production** |

## Deployment Environments

| Environment | Infrastructure | Status |
|-------------|---------------|--------|
| Production | OVH MKS (GRA9, 3x B2-15) | **Active** — 9 pods, 22/22 smoke tests |
| Staging | Hetzner K3s (5x cx33, nbg1) | **Active** — 9 HTTPS services |
| Local Dev | Docker Compose | **Active** — Full stack with federation |

## Test Coverage

| Component | Unit Tests | Integration | E2E | Total |
|-----------|-----------|-------------|-----|-------|
| STOA Gateway (Rust) | 559 cargo tests | 30 integration | 15 E2E | **604** |
| Console UI | 415 vitest | — | — | **415** |
| Developer Portal | 427 vitest | — | — | **427** |
| Control Plane API | ~200 pytest | — | — | **~200** |

## Roadmap

See the full [Roadmap](/docs/roadmap) for upcoming features and priorities.

### Near-Term (Q1-Q2 2026)

- Gateway sidecar mode for existing gateway coexistence
- Born GitOps — tenant-owned approval workflows (ADR-040)
- CLI tool general availability
- Terraform provider

### Medium-Term (Q3-Q4 2026)

- Gateway proxy and shadow modes
- WebAssembly plugin system
- Edge deployment support
- SDK (Python, TypeScript)

---

*For detailed architecture decisions, see the [ADR index](/docs/architecture/adr/).*
