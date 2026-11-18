---
sidebar_position: 5
title: "STOA Platform Roadmap: Features & Milestones"
description: "STOA Platform public roadmap — delivered capabilities, Envoy + STOA Link xDS data-plane transition (ADR-073), planned features, and superseded targets."
keywords: [roadmap, features, release plan, MCP gateway, Envoy, xDS, STOA Link, API management, STOA, open source, LLM proxy]
---

# Roadmap

Our engineering roadmap for STOA Platform — an open-source API gateway and control plane for enterprise applications and AI agents.

:::info Living Document
Last reviewed: **November 2026**. Priorities evolve based on production feedback, architecture decisions, and community input. Join the discussion on [Discord](https://discord.gostoa.dev) or [GitHub Discussions](https://github.com/stoa-platform/stoa/discussions).
:::

:::tip Releases & Versioning
Since April 2026, STOA publishes **independent per-component releases** (`control-plane-api`, `control-plane-ui`, `portal`, `stoa-gateway`, `stoa-go`) rather than monolithic `vX.Y.Z` bundles (last monolithic release: **[v2.3.0](/blog/release-v2.3.0)**, March 2026). Track published component tags in the [Release Notes](/docs/reference/changelog) and component readiness in [Implementation Status](/docs/concepts/implementation-status).
:::

---

## Available Today

**Core Control Plane, MCP Gateway, Security Posture & Multi-Gateway Federation**

| Capability | Status | Reference / Notes |
|------------|--------|-------------------|
| Control Plane API (Python/FastAPI) | Done | `control-plane-api` (`v1.14.x`) — catalog, UAC contracts, subscriptions, promotions, audit |
| Admin Console & Developer Portal (React/TypeScript) | Done | `control-plane-ui` (`v1.12.x`, i18n) and `portal` (`v1.3.x`) |
| STOA Gateway — `edge-mcp` runtime (Rust/Tokio/axum) | Done | `stoa-gateway` (`v0.9.x`) — production MCP & API data plane; enters maintenance under [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) |
| Single-Realm Multi-Tenancy & Keycloak Auth | Done | Single `stoa` realm, one Keycloak group per tenant, and `tenant_id` claim checked by Control Plane API and Gateway ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)). OIDC/LDAP/SAML brokering is demonstrated in the federation demo. Tenant assignment through brokering in the product realm remains unverified |
| Fail-Closed Tool Authorization & Signed Policies | Done | Deny-by-default permissions, Control Plane-signed policy artifacts with strict expiry, `/ready` requires loaded policies for the configured `policyBootTenants` ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) |
| OpenBao Secrets Backend (Vault HTTP API) | Partial / Rollout | Vault-compatible OpenBao `2.7.2` tested in CI (`hvac`) and available with `bao agent` under the opt-in Compose `vault` profile. Helm monitoring targets OpenBao when enabled and is off by default. Infisical retired. Cluster secret migration continues ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) |
| MCP Protocol 2025-11-25 | Done | Tool discovery, Streamable HTTP & SSE transports, resources, prompts, and completion. The lazy discovery module exists and is initialized. Wiring it into request handling remains pending ([ADR-051](/docs/architecture/adr/adr-051-lazy-mcp-discovery)) |
| UAC (Universal API Contract) | Done | Define-once contract schema, JSON Schema validation, OpenAPI-to-MCP projection ([ADR-067](/docs/architecture/adr/adr-067-uac-as-llm-optimized-executable-contract)) |
| LLM Proxy, Guardrails & Cost Management | Done | Multi-provider LLM routing and usage metering. Configurable PII redaction, prompt checks, and tenant token budgets on MCP tool calls. REST proxy body checks run in observation mode ([ADR-050](/docs/architecture/adr/adr-050-guardrails-token-budget-state), [ADR-053](/docs/architecture/adr/adr-053-llm-cost-aware-routing)) |
| Skills System & Integrated AI Chat Assistant | Done | Gateway-native context skills with circuit breaker ([ADR-047](/docs/architecture/adr/adr-047-mcp-skills-system)) and per-tenant Console/Portal chat ([ADR-048](/docs/architecture/adr/adr-048-integrated-chat-agent)) |
| OAuth 2.1, mTLS & Sender-Constrained Tokens | Done | OAuth discovery & DCR proxy ([ADR-044](/docs/architecture/adr/adr-044-mcp-oauth-gateway-proxy)), RFC 8705 cert-bound tokens ([ADR-039](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens)), RFC 9449 DPoP, OPA policies, OWASP headers & SSRF blocklist |
| Rate Limiting, Circuit Breaker & Metering | Done | Per-consumer sliding-window quotas, anti-zombie circuit breaker ([ADR-025](/docs/architecture/adr/adr-025-gateway-resilience-zombie)), Kafka/Redpanda usage metering, billing & data governance APIs |
| CLI Tool (`stoactl`) | Done | Declarative Go/Cobra CLI in `stoa-go` (`v0.3.x`) — `apply`, `reconcile`, `deploy`, `bridge`, `mcp`, `gateway`, `audit`, `doctor` ([CLI Reference](/docs/reference/cli)) |
| STOA Link (`stoa-connect`) & Gateway Adapters | Done | Link uses outbound SSE ([ADR-059](/docs/architecture/adr/adr-059-simplified-deployment-sse)) to sync routes for webMethods, Kong, and Gravitee. Link policy application is supported for webMethods. Apigee, AWS API Gateway, and Azure APIM have Control Plane adapters ([ADR-035](/docs/architecture/adr/adr-035-gateway-adapter-pattern)). Opt-in loopback mTLS ADS/xDS for Envoy. An [isolated test with real Envoy](https://github.com/stoa-platform/stoa/pull/2908) exercised route lifecycle and policy translation with an independent authorization witness |
| Gateway Companion Mode (`sidecar`) | Runtime present | `POST /authz` allow/deny endpoint in `stoa-gateway`; see [Companion Usage](/docs/guides/companion-usage) for current scope and integration limits |
| Kubernetes Gateway Chart, CRDs & Operator | Done / Beta | `charts/stoa-platform` installs the STOA Gateway and 5 CRDs (`Tool`, `ToolSet`, `Skill`, `GatewayInstance`, `GatewayBinding`); `charts/stoa-observability` (`charts/stoa-stack` umbrella) packages telemetry; `stoa-operator` (Python/Kopf, **Beta**) reconciles `GatewayInstance` & `GatewayBinding` ([Installation Guide](/docs/admin/installation)) |
| Observability, Backup Proofs & Operational Runbooks | Done | Prometheus, Grafana, OpenSearch dual-write audit, W3C Traceparent, Gateway Arena, disposable PostgreSQL 16 backup/restore CI proof, Redpanda failover with 3 brokers and replication factor 3 verified in an [isolated Docker Compose CI run](https://github.com/stoa-platform/stoa/actions/runs/42304135706/job/128189174054) (`k8s/redpanda` remains single-replica), [offline install](/docs/deployment/offline-install), [maintenance](/docs/admin/maintenance), [secret rotation](/docs/admin/secret-rotation), and [incident response](/docs/admin/incident-response) |
| Public Website, Pricing & Documentation | Done | Bilingual EN/FR site at [gostoa.dev](https://gostoa.dev), 180+ documentation pages, and 66 ADRs |

---

## In Progress

**Envoy Data-Plane Transition (ADR-073), xDS Control Loop & Platform Packaging**

| Feature | Status | Details |
|---------|--------|---------|
| Envoy Data Plane & External Services ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | In Progress | Adopting unmodified upstream Envoy as the strategic data plane, paired with a fail-closed `ext_authz` authorization adapter, `ext_proc` body processing, and the MCP module placed behind Envoy |
| STOA Link xDS Control Loop & Policy Translation ([ADR-057](/docs/architecture/adr/adr-057-product-lineup-gateway-link-connect), [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | In Progress | Extending existing Control Plane route and policy synchronization through loopback mTLS ADS (`CDS`/`LDS`/`RDS`). Translation currently covers `cors`, local per-route `rate_limit`, and direct-peer `ip_filter`. Unsupported or conflicting policy inventories keep the last acknowledged state. JWT validation, OIDC, consumer quotas, caching, and transforms remain outside this translation |
| End-to-End Protected API Publication via Control Plane | In Progress | Extending Control Plane route publication (`POST /v1/tenants/{id}/apis`) to enforce the same inbound JWT policy guarantees currently verified via `POST /admin/contracts` |
| Full-Platform Helm Packaging & HA Topologies | In Progress | Adding Control Plane API, Console, Developer Portal, and multi-replica Kubernetes topologies for Keycloak and Redpanda (in-repo Keycloak static check reports `HA_STATIC=fail`, and the Redpanda Kubernetes manifest has one replica), plus versioned Helm/OCI distribution |
| GitOps Approval Gates | In Progress | Completing tenant-scoped promotion and approval workflows. `stoa-operator` already has automated CI ([ADR-040](/docs/architecture/adr/adr-040-born-gitops-multi-environment)) |

---

## Planned

**Data-Plane Topologies, Migration Tooling & Ecosystem**

| Feature | Status | Details |
|---------|--------|---------|
| Gateway Proxy & Shadow Topologies on Envoy ([ADR-024](/docs/architecture/adr/adr-024-gateway-unified-modes), [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | Planned | Delivering `proxy` (UAC-generated routing for existing HTTP backends) and `shadow` (Envoy traffic mirroring into UAC discovery) as xDS configuration profiles |
| Rust Gateway → Envoy Migration & Rollback Tooling | Planned | Decision-comparison audit mode, cut-over runbooks, and rollback procedures ahead of Rust gateway end-of-support ([ADR-073 §9](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) |
| Terraform / OpenTofu Provider | Planned | Declarative infrastructure-as-code management for tenants, UAC contracts, and gateway bindings |
| Typed Client SDKs (Python, TypeScript) | Planned | Programmatic Control Plane and MCP client libraries |
| Pre-built MCP Connectors & ArgoCD Templates | Planned | Curated enterprise connector catalog and multi-environment GitOps templates |
| Non-Kubernetes / VM Packaging for Envoy + STOA Link ([ADR-038](/docs/architecture/adr/adr-038-sidecar-deployment-strategies-vm)) | Planned | Standalone systemd/VM bundles for sites operating without Kubernetes |

---

## Exploring

**Longer-Term Research & Ecosystem Ideas**

- **Natural-Language Policy Authoring** — Assisted generation of reviewable OPA/UAC access policies with human approval gates
- **MCP Tool & Contract Catalog Sharing** — Reusable, signed UAC and MCP tool definitions across organizations
- **End-to-End Agent Workflow Observability** — Cross-tool causal tracing and cost attribution across multi-step agent runs
- **Agent-to-Agent (A2A) Interoperability** — Evaluating experimental A2A discovery and routing (`/.well-known/agent.json`) behind the Envoy data plane

---

## Superseded / Not Planned

To keep architectural changes transparent, items listed on earlier roadmaps that have been superseded or excluded by accepted Architecture Decision Records remain documented below:

| Previously Listed Item | Status | Rationale & Reference |
|------------------------|--------|-----------------------|
| **Pingora Connection Engine** (embedded Rust pool) | **Superseded** | Added behind the `pingora` Cargo feature in `stoa-gateway` ([#1801](https://github.com/stoa-platform/stoa/pull/1801), [ADR-058](/docs/architecture/adr/adr-058-pingora-integration)). Superseded as the strategic upstream proxy layer by unmodified Envoy in [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane). |
| **eBPF Kernel-Level HTTP Parsing & UAC Enforcement** | **Not planned** | Prototype crates (`stoa-ebpf/`) remain in the repository for research, but kernel-level HTTP and policy evaluation are excluded from the data-plane roadmap in favor of upstream Envoy + `ext_authz` ([ADR-073 §10](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)). |
| **In-Process WebAssembly (Wasm) Gateway Plugins** | **Not planned** | Loading Wasm, Lua, or custom in-process filters into Envoy is excluded so STOA upgrades stay decoupled from Envoy's extension ABI; custom processing runs out-of-process via `ext_authz` and `ext_proc` ([ADR-073 §1 & §10](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)). |
| **Separate Rust Sidecar Product ("STOA Link" runtime)** | **Superseded** | Merged with `stoa-connect` into a single Go on-site agent (**STOA Link**); sidecar is treated as an Envoy deployment topology rather than a distinct binary ([ADR-057](/docs/architecture/adr/adr-057-product-lineup-gateway-link-connect), [ADR-073 §7](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)). |

---

## Get Involved

We build in public and welcome contributions!

- **Discord**: [Join the community](https://discord.gostoa.dev)
- **Issues**: [Report bugs or request features](https://github.com/stoa-platform/stoa/issues)
- **Contribute**: [Contributing guide](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- **Contact**: [hello@gostoa.dev](mailto:hello@gostoa.dev)

---

*This roadmap is directional and subject to change. For enterprise roadmap discussions, contact [sales@gostoa.dev](mailto:sales@gostoa.dev). All trademarks are the property of their respective owners ([Trademark Notice](/docs/legal/trademarks)).*
