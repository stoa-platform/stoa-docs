---
sidebar_position: 73
title: "ADR-073: Adopt Envoy as the STOA Data Plane"
sidebar_label: "ADR-073: Envoy Data Plane"
description: "STOA builds on upstream Envoy for its data plane instead of the in-house Rust gateway. Envoy is configured only through xDS served by STOA Link; STOA logic runs in external services called by Envoy, with the MCP module behind Envoy."
keywords: [ADR, Envoy, data plane, xDS, STOA Link, STOA Gateway, MCP, ext_authz, ext_proc, sovereign, architecture decision]
---

# ADR-073: Adopt Envoy as the STOA Data Plane

:::info Accepted — open items
The decision was taken on 2026-10-22, its structural choices were settled on 2026-10-23 and the record was accepted on 2026-10-25. Items marked **[To be confirmed]** are implementation details still open; they do not change the decision.
:::

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-10-22 |
| **Updated** | 2026-10-23 — structural decisions integrated (where STOA logic runs, configuration delivery, editions, meaning of "Link", fate of ADR-024 and ADR-034); 2026-10-25 — accepted |
| **Decision Makers** | Christophe Aboulicam |
| **Supersedes** | [ADR-034](./adr-034-python-rust-migration.md), [ADR-058](./adr-058-pingora-integration.md) |
| **Amends** | [ADR-024](./adr-024-gateway-unified-modes.md) (stays ✅ Accepted, "Amended by ADR-073 (2026-10-23)") |
| **Amends** | [ADR-003](./adr-003-monorepo-architecture.md), [ADR-036](./adr-036-gateway-auto-registration.md), [ADR-039](./adr-039-mtls-cert-bound-tokens.md), [ADR-041](./adr-041-plugin-architecture-community-enterprise.md), [ADR-044](./adr-044-mcp-oauth-gateway-proxy.md), [ADR-057](./adr-057-product-lineup-gateway-link-connect.md), [ADR-059](./adr-059-simplified-deployment-sse.md), [ADR-064](./adr-064-controller-framework.md) |
| **Related** | [ADR-001](./adr-001-api-exposure-strategy.md), [ADR-035](./adr-035-gateway-adapter-pattern.md), [ADR-037](./adr-037-deployment-modes-sovereign-first.md), [ADR-038](./adr-038-sidecar-deployment-strategies-vm.md), [ADR-049](./adr-049-enterprise-ai-native-benchmark.md), [ADR-061](./adr-061-council-multi-stage-review.md) |

## Context

### Current state

- The STOA data plane is the **STOA Gateway**, an in-house gateway written in Rust (Tokio, axum), in production since February 2026 in `edge-mcp` mode ([ADR-024](./adr-024-gateway-unified-modes.md)). An embedded Pingora connection pool is available behind a build feature ([ADR-058](./adr-058-pingora-integration.md)).
- The `proxy`, `sidecar` and `shadow` modes of ADR-024 are documented as planned, not delivered.
- Besides HTTP proxying, the gateway carries JWT and API key authentication, RBAC, embedded OPA evaluation, mTLS with certificate-bound tokens ([ADR-039](./adr-039-mtls-cert-bound-tokens.md)), the MCP protocol and its OAuth 2.1 discovery proxy ([ADR-044](./adr-044-mcp-oauth-gateway-proxy.md)), rate limiting, circuit breaking, Kafka metering, and AI-specific features (guardrails, token compression, LLM routing).
- Deployments follow a single path: Control Plane → SSE → STOA Link → gateway → callback ([ADR-059](./adr-059-simplified-deployment-sse.md)). The control plane never initiates a connection towards the site that hosts the gateway.
- [ADR-057](./adr-057-product-lineup-gateway-link-connect.md) and ADR-059 use "STOA Link" with two different meanings: a Rust sidecar runtime (ADR-057) and the on-site deployment agent, binary `stoa-connect` (ADR-059). This record settles the term.
- The repository already points towards this model: ADR-001 refers to the control plane / data plane split of the Istio / Envoy model, and the sidecar mode of ADR-024 already answers in the `EnvoyExtAuthz` format.

### Forces

The forces below are the reading of the decision recorded by the documentation team **[To be confirmed: official rationale]**.

1. **Where STOA's value is.** STOA is positioned as a sovereign API / iPaaS platform with an AI agent (MCP) module **[To be confirmed: scope of "iPaaS"]**. Its differentiation is in the contract (UAC), the control plane, policies, multi-tenancy, the portal and the MCP module — not in a general-purpose HTTP proxy.
2. **Cost and risk of an in-house proxy.** TLS, HTTP/2, streaming, connection management, load balancing and resilience are security-critical and need continuous maintenance. Mature open-source proxies already provide each of them.
3. **Expectations of regulated buyers.** The target audience (regulated European organisations) favours components with open governance, a public security process and existing operational knowledge in their teams.
4. **Roadmap pressure.** Several planned gateway capabilities (routing for `proxy` mode, traffic mirroring for `shadow` mode, external authorization) exist natively in Envoy.
5. **Constraints to preserve.** Apache 2.0 licensing for the whole of STOA ([ADR-041](./adr-041-plugin-architecture-community-enterprise.md)); sovereign deployment with no mandatory outbound connection and fully offline installation ([ADR-037](./adr-037-deployment-modes-sovereign-first.md)); the single deployment path of ADR-059.
6. **Experience with the embedded Pingora path.** Error handling on the upstream response path of the embedded connection pool ([ADR-058](./adr-058-pingora-integration.md)) needed specific work to make sure a failure while reading an upstream body is never relayed to the client as a normal response. Envoy's upstream handling covers these cases and is maintained upstream; the R1 gateway keeps receiving its own fixes during maintenance (§9).
7. **Dependency on Envoy and its governance.** Envoy is a Graduated project of the Cloud Native Computing Foundation since 28 November 2018, licensed under Apache 2.0, with vendor-neutral governance, many independent maintainers and a public security disclosure process. STOA uses the unmodified upstream image (§1), so it takes no fork to maintain; the residual risks are the upstream release cadence and the need to mirror and verify images for offline installation (see Mitigations).

## Options considered

| Option | Description | For | Against | Outcome |
|--------|-------------|-----|---------|---------|
| **A. Keep the Rust gateway** | Continue the ADR-024 / ADR-058 roadmap. | Continuity; full control; existing tests and team knowledge. | STOA keeps owning a general-purpose proxy; planned modes still to build. | Rejected |
| **B. Upstream Envoy + xDS served by STOA Link + STOA external services** | Unmodified Envoy; configuration generated from UAC and delivered over xDS; STOA logic in services that Envoy calls (`ext_authz`, `ext_proc`, access logs) and in the MCP module placed behind Envoy. | Proxy concerns delegated to Envoy; STOA keeps its model and control plane; no fork, no in-process extension; same Envoy for every edition. | More components next to Envoy; a UAC → xDS translation layer to build and test; a network hop to each external service. | **Chosen** |
| **C. Envoy through Envoy Gateway** | STOA generates Kubernetes Gateway API resources; Envoy Gateway produces the xDS. | Standard Kubernetes API; less xDS code in STOA. | Configuration would come from a Kubernetes controller, not from STOA Link (contradicts Decision §2); ties the data plane to Kubernetes, while ADR-038 and STOA Link target sites without Kubernetes. | Rejected |
| **D. Envoy AI Gateway for AI / MCP traffic** | Reuse a community AI gateway project on top of Envoy for LLM and MCP traffic. | Community project on the same data plane. | MCP handling stays in the STOA MCP module behind Envoy (Decision §4); overlap with UAC-derived tools; configuration must come from STOA Link only (Decision §2). | Not retained |
| **E. Another proxy** | Full Pingora-based proxy (ADR-058 option A) or another open-source proxy. | — | Not chosen on 2026-10-22. | Rejected |
| **F. Envoy with STOA logic loaded in-process** | Wasm filters, dynamic modules or custom C++ filters carrying STOA logic inside Envoy. | No network hop to external services. | Couples STOA releases to Envoy's extension ABI and build; needs custom builds or runtime loading; weaker isolation. | Rejected (Decision §1) |

The evaluation notes behind options C, D and E are to be attached **[To be confirmed]**.

No performance figure is used to compare options. Any performance statement about the Envoy-based data plane will come from a benchmark run with the methodology of [ADR-049](./adr-049-enterprise-ai-native-benchmark.md) **[To be confirmed: benchmark date]**.

## Decision

**STOA builds on Envoy for its data plane.** The in-house Rust gateway is no longer the strategic data plane. STOA provides the control plane, the configuration Envoy receives, the external services Envoy calls, the policies, the portal and the MCP module.

### 1. Upstream Envoy, unmodified, with no extension loaded

- STOA ships a pinned upstream Envoy release **[To be confirmed: version and upgrade policy]**.
- STOA does not fork Envoy and loads **no extension into Envoy**: no Wasm filter, no dynamic module, no custom C++ filter, no Lua script. Lua and Wasm are excluded; any exception requires an ADR.
- Envoy only uses the filters shipped with the pinned release (for example JWT authentication, external authorization, external processing, RBAC, local rate limiting, routing, mirroring), all configured through xDS.

### 2. Configuration only through xDS, from the control plane, via STOA Link

- Envoy receives its configuration **only over xDS**, served on the customer site by **STOA Link**. Envoy is never configured by hand, by static listener / route / cluster files or by an administration API.
- The static bootstrap of each Envoy instance is limited to its node identity and to the address of the local Link xDS server **[To be confirmed: bootstrap content and security of the Link ↔ Envoy channel]**.
- The deployment path stays the single path of ADR-059, **for every target**:

  ```text
  Console → CP API → SSE → STOA Link → xDS → Envoy
                              ↓
                   callback SYNCED / FAILED → CP API
  ```

  For a third-party gateway, Link keeps applying the desired state through that gateway's interface, as described in ADR-059. For Envoy, Link publishes the corresponding xDS resources. No second deployment path is introduced, and the control plane still never opens a connection towards the customer site.
- Link reports `SYNCED` when Envoy has accepted the configuration (xDS ACK) and `FAILED` when Envoy rejects it (xDS NACK) **[To be confirmed: rule when several Envoy instances share a Link, and timeout handling]**. Drift detection (ADR-059 `state.report`) relies on the configuration version each Envoy instance has acknowledged.
- The UAC → xDS translation runs in the control plane, in a dedicated component separate from the CP API. Link only serves versioned snapshots of the resulting configuration and keeps the last complete snapshot.

### 3. UAC stays the source of truth

Envoy configuration is generated from UAC contracts, consumers, subscriptions and policies. It is never edited by hand.

### 4. STOA logic runs in external services called by Envoy; the MCP module is behind Envoy

| Service | Envoy interface | Responsibilities | Open points |
|---------|-----------------|------------------|-------------|
| **Authorization service** | External authorization (`ext_authz`) | API keys, subscriptions, tenant isolation, OPA policies at HTTP level, consumer quotas (atomic PostgreSQL update for billed quotas and MCP budgets, batched counters for the others; §10), and the token-binding checks of §5 if Envoy does not perform them | Fails closed (§10): explicit setting (`failure_mode_allow: false`, `status_on_error: 503`), neutral response identical to the 403, no automatic retry for non-idempotent methods or MCP `tools/call`. Timeout: to be set after measurement. Name, language, audit mode for migration **[To be confirmed]**; OPA input document and engine **[To be confirmed]** |
| **Processing service** | External processing (`ext_proc`) | Features that need request or response bodies: guardrails, token budgets, token compression, body transformation | Per-feature assignment settled in the amendment of each ADR concerned (see "Superseded, revised and amended ADRs") |
| **MCP module** | Upstream service behind Envoy | MCP protocol, tool registry, tool-level authorization, federation, lazy discovery, skills | Language, product name **[To be confirmed]** |
| **OAuth 2.1 discovery and DCR proxy (ADR-044)** | Upstream service behind Envoy | Curated metadata, client registration proxy, token proxy | Served by the MCP module or by a dedicated service **[To be confirmed]** |
| **Metering collector** | Access log service | Usage events to Kafka | Transport and event schema compatibility **[To be confirmed]** |

There is no separate rate limit service: consumer quotas are checked by the authorization service, and Envoy's `local_ratelimit` filter only provides coarse protection.

Envoy natively handles listening, TLS and mTLS termination, routing, load balancing, upstream connection pools, timeouts, retries, circuit breaking, outlier detection, health checks, statistics, tracing and access logs.

### 5. Token binding and DPoP — to be verified, not settled

- Envoy's JWT authentication filter validates JWT signatures and standard claims against the Keycloak JWKS.
- Whether the JWT authentication filter of the pinned Envoy release supports **certificate-bound tokens (`cnf.x5t#S256`, RFC 8705)** and **DPoP proof validation (RFC 9449)** is to be verified **[To be confirmed]**.
- **If either is missing, that check runs in the authorization service (`ext_authz`).** In both cases the ADR-039 error contract (`MTLS_*` codes and HTTP statuses), the normalisation rules of ADR-028 and constant-time comparison are kept.
- Which component terminates client TLS (Envoy or an edge terminator) and how certificate data reaches the check (forwarded-client-certificate header, sanitisation of incoming certificate headers) belong to the same verification.

### 6. Community and Enterprise: same Envoy, different configuration and services

- Community and Enterprise use **the same upstream Envoy release**. There is **no edition-specific Envoy build**.
- Editions differ only by the configuration STOA generates (which filters and routes are enabled) and by which STOA external services are deployed and enabled.
- The Cargo feature flags of ADR-041 no longer apply to the data plane. The ADR-041 principles (security is not a tier, Community Core is a complete product, Apache 2.0 for everything) are unchanged. The MCP module and mTLS are part of Community. ADR-041 is to be amended to record this, together with the edition of the other features.

### 7. Meaning of "STOA Link"

- **STOA Link is the agent installed on the customer site** (binary `stoa-connect`). It keeps the outbound SSE connection to the control plane, serves the local xDS to Envoy, applies the desired state to third-party gateways, reports `SYNCED` / `FAILED` and the observed state, and registers the data-plane instances it manages ([ADR-036](./adr-036-gateway-auto-registration.md)) **[To be confirmed: registration details for Envoy instances]**.
  - *Implementation status:* the Link xDS server is decided but **not yet implemented**. Today's `stoa-connect` agent synchronises third-party gateways over REST / SSE; serving xDS to Envoy is the target.
- **A sidecar is only one way to deploy Envoy**, not a product. "STOA Gateway" designates the Envoy-based data plane with its STOA services, whatever its topology (standalone or sidecar).
- The `/api/v1/links/…` endpoints and the `stoa_link_connections_active` metric of ADR-059 **do not change**.
- ADR-057 is amended accordingly: its "STOA Link" (Rust sidecar) and "STOA Connect" (Go agent) entries merge into STOA Link, the agent. ADR-003 and ADR-064 are amended to follow.
- The value of the `gateway_mode` registration field used by Envoy instances is set by the ADR-024 revision and the ADR-057 amendment; ADR-057 requires an ADR for any new value **[To be confirmed]**.

### 8. Gateway modes: Amends ADR-024

ADR-024 keeps its number and is rewritten for Envoy. The four functional positions remain; the single Rust binary and the `--mode` flag disappear. A mode becomes a configuration profile generated by STOA plus the set of external services deployed. The target mapping, to be written into ADR-024:

| ADR-024 mode | With Envoy |
|--------------|-----------|
| `edge-mcp` | Envoy in front of AI agents, MCP module behind Envoy, authorization and processing services |
| `proxy` | Envoy routes generated from UAC contracts, with the STOA external services |
| `sidecar` | Envoy deployed as a sidecar next to a third-party gateway or workload, configured by Link over xDS |
| `shadow` | Envoy request mirroring and access logs feeding UAC generation; the security prerequisites of ADR-024 still apply |

For now, a third-party gateway does not call the STOA authorization service (`ext_authz`) directly; the existing `EnvoyExtAuthz` answer format is not used for that purpose.

### 9. The STOA Gateway (Rust) enters maintenance

Security fixes only, until an end-of-support date to be announced **[To be confirmed]**. A migration and rollback guide will be published with the first release that ships the Envoy data plane.

### 10. Policy placement

*Scope status:* the placement and the policy tiers below are **decided scope, not delivered features**. As for the Link xDS server (§7), none of these policies is available yet. The documentation will present only v1-tier policies as available, and only once they are delivered.

#### Where each check runs

| Component | Checks |
|-----------|--------|
| **Envoy — built-in filters, configured over xDS** | Token validation (`jwt_authn`, local JWKS delivered over xDS); coarse RBAC (`rbac`); IP filtering and CORS; local rate limiting (`local_ratelimit`, coarse protection only); access logs |
| **Authorization service (`ext_authz`)** | A gRPC adapter implementing `envoy.service.auth.v3`, placed in front of the existing Rust policy logic (an adapter, not a rewrite). It checks: token binding (`cnf`, `x5t#S256` or DPoP) where the JWT filter does not (§5) **[To be confirmed]**; tenant; active subscription; FAPI profiles; the approval token defined by the operator-approval decision (ADR number to be assigned); consumer quotas |
| **MCP module, behind Envoy** | Per-tenant tool list and guardrails on tool arguments (PII). No `ext_proc` for MCP in v1 |
| **Excluded** | eBPF and Wasm (Lua is already excluded by §1) |

Consumer quotas are therefore checked by the authorization service (§4). Envoy's `local_ratelimit` filter only provides coarse protection; there is no separate rate limit service.

#### Policy tiers

| Tier | Policies |
|------|----------|
| **v1** | Authentication and authorization; policy registry; part of traffic and quotas (including consumer quotas, below); MCP governance |
| **Later** | Further traffic and quotas policies; further MCP governance policies; dynamic REST proxy; extensions; modes; caching; body transformation |
| **Excluded** | One policy-registry policy (eBPF) and one extension (Wasm) |
| **To be confirmed** | SOAP pass-through **[To be confirmed]** |

#### Consumer quotas (v1)

- **Non-billed quotas:** in-memory counters in the authorization service, written to PostgreSQL in batches. Each batch carries an identifier, so a write can be replayed without side effects. Maximum tolerated loss: to be set after measurement. The local limit of each replica is the quota divided by the number of replicas.
- **Billed quotas and MCP budgets:** an atomic `UPDATE` in PostgreSQL on every request, failing closed. They never go through batched counters.
- **On failure:** bounded degraded mode for non-billed quotas; fail closed for billed quotas and MCP budgets.
- p99 latency and behaviour during a PostgreSQL failover: to be set after measurement. No value is fixed before that measurement.

#### Authorization service failure

- Envoy denies the request. The setting is explicit: `failure_mode_allow: false`, `status_on_error: 503` (Envoy returns 403 by default), and a short timeout whose value is to be set after measurement.
- The response body is neutral and identical to the 403 response, for example `{"error":"service_unavailable","request_id":"…"}`. It carries no service name, no reason and no `x-envoy-*` header. Details are only written to server-side logs, linked to the `request_id`.
- The response carries a bounded `Retry-After`. Envoy does not automatically retry non-idempotent methods or MCP `tools/call` requests, to avoid retry storms and double execution.
- Every MCP request also goes through `ext_authz`, in addition to the OPA policy of the MCP module, with a contract test.

#### Tests

- Contract tests for each v1-tier policy.
- A CI test of offline JWKS rotation, with the JWKS delivered over xDS.

## Consequences

### Positive

- STOA no longer maintains a general-purpose HTTP proxy; engineering effort moves to the contract, policies, control plane and MCP module.
- Planned proxy capabilities (routing for `proxy` mode, mirroring for `shadow` mode, external authorization) become configuration rather than new code.
- One deployment path for every target, unchanged from ADR-059; deployment status reflects what Envoy actually accepted, which strengthens drift detection.
- No edition-specific build and no extension inside Envoy: Envoy upgrades follow the upstream release process, and STOA services evolve independently of Envoy.
- The control plane / data plane split of ADR-001 becomes explicit and standard (xDS).
- Operators can rely on Envoy's documentation, tooling and security process for the proxy layer.

### Negative

- More components in the data plane (Envoy, STOA Link xDS server, authorization and processing services, MCP module, metering collector): more to deploy, version and monitor.
- Every call to an external service adds a network hop; its effect on latency must be measured, not assumed. The latency constraints stated in ADR-050 and ADR-053 must be re-validated.
- A UAC → xDS translation layer must be built and tested for every UAC feature.
- Behaviour differences for clients and backends (header case, error bodies, rate limit windows, metric names) must be documented and handled.
- Documentation, dashboards, Helm charts and automation built around the Rust gateway must be updated; positioning based on Pingora or on the Rust runtime is withdrawn.
- Teams need Envoy and xDS operating and debugging skills.

### Mitigations

| Risk | Mitigation |
|------|-----------|
| External service unavailable | Co-located with Envoy; explicit failure mode per service and per route. Authorization fails closed (§10): explicit setting (`failure_mode_allow: false`, `status_on_error: 503`), neutral response identical to the 403, no automatic retry for non-idempotent methods or MCP `tools/call` |
| Translation errors UAC → xDS | Envoy NACK surfaces as `FAILED`; contract tests per UAC feature; audit mode during migration |
| Policy regressions | Same OPA input document where possible; decision comparison during migration **[To be confirmed]** |
| Latency added by external services | `ext_authz` for decisions without body; `ext_proc` only on routes that need it; measurement before any publication |
| Security of the admin surface | Envoy admin interface bound to loopback and never used for configuration |
| Supply chain in sovereign mode | Upstream Envoy image mirrored for offline installation as required by ADR-037; mirroring and signing process **[To be confirmed]** |

### Impact on other components

| Area | Impact |
|------|--------|
| Deployment path ([ADR-059](./adr-059-simplified-deployment-sse.md)) | Unchanged in principle; for Envoy targets "apply the desired state" means "publish xDS resources", and `SYNCED` / `FAILED` come from ACK / NACK |
| Product lineup ([ADR-057](./adr-057-product-lineup-gateway-link-connect.md)) | STOA Gateway = Envoy + STOA services; STOA Link = the on-site agent; the Rust sidecar runtime disappears; registration protocol unchanged |
| Controller framework ([ADR-064](./adr-064-controller-framework.md)) | The UAC → xDS translation runs in a dedicated control-plane component, separate from the CP API process; the xDS server lives in STOA Link, the Go agent outside the CP API process, the slot ADR-064 already assigns to `stoa-connect`; CP API workers stay as they are, and the paths retired by ADR-059 are not re-enabled |
| Gateway admin API | Not used to configure the Envoy data plane; any read-only diagnostics that remain are to be listed **[To be confirmed]** |
| Gateway Adapter pattern ([ADR-035](./adr-035-gateway-adapter-pattern.md)) | Third-party gateway adapters unchanged; the "STOA native" target is reached through Link and xDS, never by a push from the control plane |
| Non-Kubernetes sites ([ADR-038](./adr-038-sidecar-deployment-strategies-vm.md)) | Envoy, STOA services and Link run on VMs; packaging to be specified **[To be confirmed]** |
| Documentation | Pages describing the Rust gateway as the current data plane, and the published benchmark figures measured on it, must be updated or annotated |

## Superseded, revised and amended ADRs

| ADR | Title | Change | Reason |
|-----|-------|--------|--------|
| [ADR-034](./adr-034-python-rust-migration.md) | Python to Rust Migration Strategy | 🔄 Superseded by ADR-073 | The Rust data-plane target is replaced; its migration method (shadow, canary, rollback) can be reused for the Envoy cut-over |
| [ADR-058](./adr-058-pingora-integration.md) | Pingora Integration — Embedded Connection Pool | 🔄 Superseded by ADR-073 | Upstream connection management moves to Envoy; no in-house proxy path remains |
| [ADR-024](./adr-024-gateway-unified-modes.md) | Unified Gateway Architecture — 4 Deployment Modes | Amended (same number); stays ✅ Accepted, "Amended by ADR-073 (2026-10-23)" | Modes kept as functional positions and rewritten for Envoy (Decision §8) |
| [ADR-057](./adr-057-product-lineup-gateway-link-connect.md) | Product Lineup — Gateway, Link, Connect | Amended | Gateway = Envoy + STOA services; Link = the on-site agent (`stoa-connect`); Link and Connect entries merged; sidecar is a topology (Decision §7) |
| [ADR-059](./adr-059-simplified-deployment-sse.md) | Simplified Deployment via SSE | Amended (clarification) | Single path applies to every target; Link serves xDS to Envoy; ACK / NACK give `SYNCED` / `FAILED` (Decision §2) |
| [ADR-003](./adr-003-monorepo-architecture.md) | Monorepo Architecture | Amended | Status note: data plane per ADR-073; `stoa-link` and `stoa-connect` designate the same agent |
| [ADR-064](./adr-064-controller-framework.md) | Controller Framework | Amended | xDS server in Link (Go, outside the CP API) recorded against the Go re-evaluation trigger; Link naming per Decision §7 |
| [ADR-036](./adr-036-gateway-auto-registration.md) | Gateway Auto-Registration | Amended | Link registers the Envoy instances it serves; protocol unchanged |
| [ADR-039](./adr-039-mtls-cert-bound-tokens.md) | Rust Gateway mTLS Cert-Bound Tokens | Amended | Binding checks in Envoy's JWT filter or in `ext_authz` (Decision §5); error contract kept |
| [ADR-041](./adr-041-plugin-architecture-community-enterprise.md) | Community Core vs Enterprise Extensions | Amended | Editions by configuration and external services, no Cargo flags and no specific Envoy build (Decision §6) |
| [ADR-044](./adr-044-mcp-oauth-gateway-proxy.md) | MCP OAuth 2.1 Gateway Proxy | Amended | Same behaviour, served by a STOA service behind Envoy; the hard-coded mTLS exemption list becomes route configuration generated by STOA |

The following ADRs keep their functional decision; their implementation sections describe the Rust gateway and are realigned in a follow-up amendment set, after this record: [ADR-004](./adr-004-gateway-adapter-pattern.md), [ADR-021](./adr-021-uac-driven-observability.md), [ADR-023](./adr-023-zero-blind-spot-observability.md), [ADR-025](./adr-025-gateway-resilience-zombie.md), [ADR-027](./adr-027-x509-header-authentication.md), [ADR-028](./adr-028-rfc8705-certificate-binding.md), [ADR-031](./adr-031-ci-cd-reusable-workflow-architecture.md), [ADR-035](./adr-035-gateway-adapter-pattern.md), [ADR-037](./adr-037-deployment-modes-sovereign-first.md), [ADR-038](./adr-038-sidecar-deployment-strategies-vm.md), [ADR-043](./adr-043-kafka-mcp-event-bridge.md), [ADR-045](./adr-045-stoa-yaml-declarative-spec.md), [ADR-046](./adr-046-mcp-federation-architecture.md), [ADR-047](./adr-047-mcp-skills-system.md), [ADR-048](./adr-048-integrated-chat-agent.md), [ADR-049](./adr-049-enterprise-ai-native-benchmark.md), [ADR-050](./adr-050-guardrails-token-budget-state.md), [ADR-051](./adr-051-lazy-mcp-discovery.md), [ADR-053](./adr-053-llm-cost-aware-routing.md), [ADR-056](./adr-056-fapi-2-architecture.md), [ADR-066](./adr-066-stoa-token-compression.md). For each, the new location of the logic follows Decision §4: an external service called by Envoy or the MCP module, never an extension loaded into Envoy.

[ADR-001](./adr-001-api-exposure-strategy.md) is unchanged and reinforced by this decision.

In the ADR index, the legend gains `🔄 Superseded`, and the "Technology Choices Overview" row *Gateway v2 — Rust (Pingora)* becomes *Data plane — Envoy (upstream) + STOA external services*.

## Validation

Council review following [ADR-061](./adr-061-council-multi-stage-review.md), then approval by the decision maker. Not yet run.

## References

- [Envoy documentation](https://www.envoyproxy.io/docs/envoy/latest/)
- [xDS protocol](https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol)
- [External authorization filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter)
- [External processing filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_proc_filter)
- [JWT authentication filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/jwt_authn_filter)
- [Local rate limiting](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/local_rate_limit_filter)
- [CNCF — Envoy project](https://www.cncf.io/projects/envoy/)
- [RFC 8705 — OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens](https://www.rfc-editor.org/rfc/rfc8705)
- [RFC 9449 — OAuth 2.0 Demonstrating Proof of Possession (DPoP)](https://www.rfc-editor.org/rfc/rfc9449)

## Decision Record

| Date | Decision | Author |
|------|----------|--------|
| 2026-10-22 | Decision taken: the STOA data plane moves to Envoy | Christophe Aboulicam |
| 2026-10-22 | ADR skeleton drafted | Documentation team |
| 2026-10-23 | Structural decisions: STOA logic in external services, MCP module behind Envoy, no extension in Envoy; configuration only over xDS via Link, single path for every target; editions without specific Envoy build; ADR-024 amended, ADR-034 superseded; "Link" = the on-site agent | Christophe Aboulicam |
| 2026-10-23 | Record rewritten as ADR-072 | Documentation team |
| 2026-10-23 | Open questions answered: UAC → xDS translation in a dedicated control-plane component, Link serves versioned snapshots; ADR-024 stays Accepted, amended by ADR-073; Lua and Wasm excluded; MCP module and mTLS in Community; no direct call to `ext_authz` by third-party gateways for now | Architect |
| 2026-10-23 | Policy placement: `ext_authz` adapter in front of the existing logic, policies in three tiers, consumer quotas in v1; explicit `ext_authz` failure behaviour (Decision §10) | Christophe Aboulicam |
| 2026-10-25 | Renumbered ADR-073 (number 072 was already in use); record accepted | Christophe Aboulicam |

ADR numbers 069 to 072 are reserved.

---

*Envoy is a trademark of The Linux Foundation. All trademarks are the property of their respective owners.*
