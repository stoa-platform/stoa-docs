---
sidebar_position: 10
title: Implementation Status
description: "Track STOA Platform's current implementation status across Control Plane, Gateway, Envoy data-plane transition (ADR-073), STOA Link, adapters, Helm packaging, and test suites."
keywords: [STOA, implementation, status, roadmap, architecture, components, Rust gateway, Envoy, STOA Link, MCP]
---

# Implementation Status

Track the real runtime state of each STOA Platform component in the `stoa-platform/stoa` repository.

:::info Last Updated
**November 2026** — Per-component SemVer releases are active ([Release Notes](/docs/reference/changelog)). The single-realm tenant model ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) and fail-closed signed tool policies ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) are in place. The OpenBao rollout is partial ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)). The Envoy + STOA Link xDS data-plane transition is underway ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)).
:::

## Core Components

| Component | Technology | Status | Description |
|-----------|------------|--------|-------------|
| Control Plane API | Python 3.11+, FastAPI, SQLAlchemy | **Production** | API catalog, UAC contracts, tenant & subscription lifecycle, gateway orchestration (`control-plane-api` `v1.14.x`) |
| STOA Gateway (Rust) | Rust, Tokio, axum | **Production (Maintenance)** | Current `edge-mcp` and API data plane (`stoa-gateway` `v0.9.x`); maintained while the Envoy data plane matures ([ADR-073 §9](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) |
| Envoy Data Plane | Upstream Envoy + xDS + `ext_authz` / `ext_proc` | **In Progress** | Target data plane configured over xDS by STOA Link, with STOA policy and MCP services running out-of-process ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) |
| Console UI | React 19.3.1 on `main`, TypeScript, Vite | **Production** | Admin dashboard for catalog, policies, observability, and tenant operations (`control-plane-ui` `v1.12.x`) |
| Developer Portal | React 19.3.1 on `main`, TypeScript, Vite | **Production** | Self-service API & MCP tool discovery, subscriptions, and credentials (`portal` `v1.3.x`) |
| Auth Layer | Keycloak 26 | **Production** | Single `stoa` realm, one group per tenant, and `tenant_id` JWT claim ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)); multi-IdP OIDC/LDAP/SAML brokering shown in the separate federation demo |
| CLI (`stoactl`) | Go, Cobra (`stoa-go`) | **Production** | Declarative GitOps reconciliation, OpenAPI-to-MCP bridge, and resource management (`stoa-go` `v0.3.x`, [CLI Reference](/docs/reference/cli)) |
| STOA Link (`stoa-connect`) | Go (`stoa-go`) | **Production / Expanding** | On-site outbound SSE agent syncing third-party gateways and serving loopback mTLS ADS/xDS snapshots to Envoy ([ADR-057](/docs/architecture/adr/adr-057-product-lineup-gateway-link-connect), [ADR-059](/docs/architecture/adr/adr-059-simplified-deployment-sse)) |
| Kubernetes Operator (`stoa-operator`) | Python, Kopf | **Beta** | Reconciles `GatewayInstance` and `GatewayBinding` CRDs against the Control Plane API. Ships standalone Kubernetes manifests and runs Python tests in CI on changes to the operator. |

## Data Plane & Gateway Capabilities

Today's production traffic runs through **STOA Gateway (Rust)** in `edge-mcp` mode while the **Envoy data plane ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane))** is being built out:

| Capability | Status | Details |
|------------|--------|---------|
| MCP Protocol (`edge-mcp` mode) | **Production** | MCP 2025-11-25 — tool discovery/invocation, Streamable HTTP & SSE, resources, prompts, completion |
| Fail-Closed Signed Tool Policies | **Production** | Control Plane-signed policy artifacts with strict expiry; `/ready` requires `policyBootTenants` ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) |
| Dynamic REST & LLM Proxy | **Production** | Dynamic REST routing with observe-only guardrails. The dedicated LLM proxy forwards the request body as received and meters token usage for OpenAI, Azure, Anthropic, and Mistral. |
| MCP Tool-Call Guardrails | **Configurable** | MCP tool calls support PII redaction, prompt-injection and content checks, and token-budget enforcement. |
| OAuth 2.1, mTLS & DPoP | **Production** | Keycloak JWT validation, OAuth discovery/DCR proxy ([ADR-044](/docs/architecture/adr/adr-044-mcp-oauth-gateway-proxy)), RFC 8705 cert-bound tokens, RFC 9449 DPoP |
| Rate Limiting, Circuit Breaker & Security Headers | **Production** | Per-consumer sliding-window quotas, per-upstream circuit breaker, OWASP headers, SSRF blocklist |
| Companion / Sidecar Mode (`POST /authz`) | **Runtime present** | Allow/deny status-code endpoint in `stoa-gateway`; no live third-party gateway callout demonstrated in CI. See [Companion usage](/docs/guides/companion-usage) |
| Envoy Loopback ADS/xDS (`STOA_GATEWAY_TYPE=envoy`) | **In Progress** | mTLS loopback ADS (`CDS`/`LDS`/`RDS`), fail-closed `ext_authz` wiring, and `cors` / `rate_limit` / `ip_filter` v1 policies in `stoa-connect`; external `ext_authz` service and JWT/OIDC/transform policies in progress |
| Proxy & Shadow Modes | **Planned (on Envoy)** | Targeted as Envoy xDS routing and traffic-mirroring profiles under [ADR-073 §8](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) |

## Gateway Adapters

STOA orchestrates external gateways through Control Plane management adapters ([ADR-035](/docs/architecture/adr/adr-035-gateway-adapter-pattern)) and the on-site **STOA Link (`stoa-connect`)** agent:

| Target Gateway | Control Plane Adapter (`control-plane-api`) | STOA Link Agent (`stoa-connect`) | Notes |
|----------------|---------------------------------------------|----------------------------------|-------|
| STOA Gateway (Rust) | **Production** | — (native auto-registration) | Direct Control Plane sync & signed tool policies |
| Envoy (upstream) | **In Progress** (UAC → xDS) | **In Progress** (loopback mTLS ADS) | Strategic data plane per [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) |
| webMethods | **Production** | **Production** | REST Admin API discovery, route/policy/alias sync |
| Kong (DB-less / Admin API) | **Implemented** | **Implemented** | Control Plane applies declarative configuration and policies. Link discovers APIs and syncs routes, with policy application unsupported. Arena benchmarks proxy traffic. |
| Gravitee (APIM v4) | **Implemented** | **Implemented** | Control Plane reconciles APIs, plans, and policies. Link discovers APIs and syncs routes, with policy application and removal unsupported. Arena benchmarks proxy traffic. |
| Apigee | **Implemented** | — | Control Plane mapper & adapter (`adapters/apigee/`) |
| AWS API Gateway | **Implemented** | — | Control Plane mapper & adapter (`adapters/aws/`) |
| Azure APIM | **Implemented** | — | Control Plane mapper & adapter (`adapters/azure/`) |

## Packaging & Infrastructure

| Component | Technology | Status | Notes |
|-----------|------------|--------|-------|
| Helm Chart (`charts/stoa-platform`) | Helm 3.12+ | **Gateway-scoped** | Installs STOA Gateway, 5 CRDs, and optional sync/monitoring resources from repository checkout; Control Plane, Console, Portal, Keycloak, and PostgreSQL are deployed separately ([Installation Guide](/docs/admin/installation)) |
| Observability Chart (`charts/stoa-observability`) | Grafana Alloy, Tempo, Blackbox Exporter | **Available** | Packages optional OTLP collection, tracing, and synthetic probes. Provides data source configuration for an existing Grafana instance. |
| Database | PostgreSQL 15 / 16 | **Production** | Shared schema with `tenant_id` scoping; automated backup/restore verified in CI on disposable PostgreSQL 16 |
| Event Backbone | Redpanda / Kafka | **Production** | Metering and deployment events. The dedicated Docker Compose proof tests loss of one broker with 3 brokers and RF3. The standard Compose and `k8s/redpanda` deployments remain single-broker. |
| Audit & Log Search | OpenSearch 2.11 | **Production** | Dual-write audit trail and log indexing |
| Secrets Backend | OpenBao (Vault API, [ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) | **Partial** | CI tests `hvac` against OpenBao `2.7.2`. The optional Compose `vault` profile runs `bao agent` against an external server. Helm provides optional monitoring for an existing server. Cluster workloads still use Kubernetes Secrets in parts of the platform. |
| Identity HA Proof | Keycloak HA checker | **Not proven in-repo** | The static checker (`deploy/keycloak/ha-proof`) reports `HA_STATIC=fail` for the in-repo definitions. `charts/stoa-platform` has no Keycloak StatefulSet or PodDisruptionBudget. |
| GitOps & CI/CD | ArgoCD + GitHub Actions + GHCR | **Production** | SAST, container/OS-layer scans, SBOMs, digest pinning, and regression guards |

## Automated Test Suite (November 2026)

The table gives approximate test volumes from source on `stoa-platform/stoa` at [`639e8b9a`](https://github.com/stoa-platform/stoa/tree/639e8b9a). File counts use the configured pytest and Vitest file patterns, Rust files with test attributes, and Go `_test.go` files.

| Component | Test Suite | Files | Automated Tests |
|-----------|------------|-------|-----------------|
| Control Plane API | `pytest` (unit, contract, API, adapters) | 467 | **7,400+** |
| STOA Gateway (Rust) | `cargo test` (unit, contract, security, integration) | 251 | **2,870+** |
| Console UI | `vitest` | 184 | **1,760+** |
| Developer Portal | `vitest` | 101 | **~980** |
| `stoa-go` (`stoactl` + `stoa-connect`) | `go test` (CLI, connect loops, adapters, Envoy ADS) | 85 | **490+** |
| End-to-End & Resilience | Playwright BDD + CI backup/failover checks | — | Smoke, critical CUJs, disposable PG 16 restore, Redpanda failover in a dedicated 3-broker Compose setup, static Keycloak HA check |

## Roadmap & Architecture Decisions

- For in-progress Envoy + xDS milestones, planned features, and superseded targets (Pingora, eBPF, Wasm), see the [Roadmap](/docs/roadmap).
- For detailed architectural trade-offs and records, see the [ADR Index](/docs/architecture/adr/).

---

*All trademarks are the property of their respective owners ([Trademark Notice](/docs/legal/trademarks)).*
