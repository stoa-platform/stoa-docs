---
slug: webmethods-migration-guide
title: "webMethods API Gateway Migration to Open Source (2026)"
authors: [stoa-team]
tags: [migration, comparison, api-gateway]
description: "Software AG licensing costs rising? Migrate webMethods policies, IS services, and aliases to an open-source gateway with this phased roadmap."
keywords:
  - webmethods migration
  - software ag webmethods alternative
  - webmethods api gateway replacement
  - webmethods to open source
  - software ag migration 2026
  - webmethods integration server migration
  - webmethods ibm licensing
  - api gateway migration webmethods
  - webmethods open source alternative
  - enterprise api gateway modernization
---

<!-- last verified: 2026-02 -->

# Software AG webMethods API Gateway Migration: Moving to Open Source in 2026

Migrating from Software AG webMethods API Gateway™ to an open-source alternative is achievable in 4-6 months using a phased, zero-downtime approach. This guide covers what makes webMethods migrations distinct — the Integration Server (IS) dependency, the Designer-based policy model, the IBM licensing entanglement — and provides a concrete roadmap for platform teams ready to act.

<!-- truncate -->

:::info Part of the API Gateway Migration Series
This article is part of our [complete API gateway migration guide](/blog/api-gateway-migration-guide-2026). Whether you're coming from webMethods, Layer7, Axway, or Apigee, the core migration principles are the same — but the platform-specific challenges differ significantly.
:::

## Why Teams Are Evaluating webMethods Alternatives in 2026

Software AG webMethods API Gateway has been a fixture in financial services, telecommunications, and public sector API management for well over a decade. Its tight integration with the webMethods Integration Server, its robust service registry, and its deep XML/EDI handling made it the default choice for enterprises building on SOA infrastructure in the 2000s and 2010s. Several forces are now prompting serious evaluation of alternatives.

### The IBM Licensing Inflection Point

The elephant in the room for most webMethods customers is IBM licensing. webMethods installations in large enterprises frequently co-exist with — or depend upon — IBM middleware (MQ, DataPower, WebSphere), and licensing costs for these stacks have been a persistent pain point. As enterprises renegotiate software agreements in 2025-2026, the combined cost of webMethods runtime licensing plus IBM middleware integration is increasingly difficult to justify against open-source alternatives that provide comparable functionality at infrastructure cost only.

This is not an abstract concern. Platform teams in financial services that have been running webMethods for 10+ years are now being asked by their CFOs to quantify the cost of continuing versus the cost of migrating. In many cases, the migration pays for itself within 18-24 months on licensing savings alone.

### Integration Server as a Liability

The webMethods Integration Server is both webMethods' greatest strength and its primary migration obstacle. IS handles the heavy lifting for enterprise integration — complex message transformation, EDI processing, trading partner management, B2B protocols — and is deeply intertwined with the API Gateway layer. APIs managed by webMethods API Gateway often depend on IS services for authentication, transformation, or routing logic that cannot be cleanly separated.

For teams whose webMethods deployment is primarily API Gateway (REST APIs, OAuth2/API key authentication, developer portal), this dependency is manageable. For teams whose webMethods deployment is a full ESB implementation with IS at the center, the gateway migration must be sequenced carefully to avoid disrupting IS-dependent services before a replacement integration layer is in place.

The key insight: **webMethods API Gateway migration and webMethods Integration Server migration are different projects with different timelines and risk profiles.** This guide covers API Gateway migration specifically.

### Kubernetes and GitOps Friction

webMethods was designed for VM and JEE application server deployments. Containerized deployment (via Docker) is supported, but the operational model — Designer-based policy configuration, proprietary deployment packages, centralized Administrator UI — does not map naturally to GitOps workflows, Helm-based deployment, or Kubernetes-native autoscaling. Teams that have invested in Kubernetes infrastructure find that operating webMethods on it requires ongoing adaptation work rather than native integration.

### Zombie APIs and Catalogue Invisibility

A pattern encountered consistently in mature webMethods deployments is what practitioners call "zombie APIs": services registered in the webMethods Service Registry that are no longer actively maintained, whose owners have changed, whose consumer base is unknown, and whose documentation is outdated or absent. The Service Registry was designed to solve catalogue problems, but without active governance it becomes a historical archive rather than a living catalogue.

Modern API portal solutions — self-service subscription, automated onboarding, consumer analytics — make zombie API identification and remediation a byproduct of normal operations rather than a dedicated governance project.

### AI Agent Integration Requirements

webMethods was not designed for AI agents as API consumers. MCP (Model Context Protocol) support, tool discovery for agentic workloads, streaming response handling, and per-agent metering require capabilities that are not available in the webMethods API Gateway architecture and cannot be added as extensions without significant custom development.

## Feature Comparison

The following table maps webMethods API Gateway capabilities to their open-source equivalents. Feature availability is based on publicly available documentation.

| Capability | Software AG webMethods API Gateway™ | Open-Source Alternative (STOA) |
|---|---|---|
| **API Routing** | Flow-based routing via IS services | Route matching, path normalization, URL rewriting |
| **Authentication** | OAuth2, API key, Basic, SAML, LDAP, JWT | OAuth2/OIDC (Keycloak), API key, mTLS, JWT |
| **Authorization** | Role-based, LDAP groups, IS-based custom | OPA policy engine (ABAC), per-tenant scopes |
| **Rate Limiting** | Quota policies per application, per API | Per-tenant, per-tool, per-API quotas |
| **API Portal** | webMethods Developer Portal | Developer Portal (React, API discovery + subscriptions) |
| **API Catalogue** | webMethods Service Registry | Control Plane API + Console UI |
| **Traffic Monitoring** | webMethods Mediator + API Analytics | Prometheus metrics, Grafana dashboards, OpenTelemetry |
| **Policy Engine** | Designer-based flow services (IS) | OPA/Rego policies (code-as-policy, GitOps) |
| **Protocol Support** | REST, SOAP, XML, EDI, JMS, JDBC | REST, MCP, SSE, WebSocket |
| **Deployment** | VM, JEE, Docker (limited Kubernetes) | Kubernetes-native (Helm), Docker Compose |
| **Multi-Tenancy** | Multi-stage environments, IS tenant isolation | Namespace-level tenant isolation (CRDs) |
| **AI Agent Support** | Not natively supported | Native MCP gateway, tool discovery, agent metering |
| **Configuration** | Designer GUI + deployment packages | Declarative YAML/CRDs, GitOps, CLI |
| **SSO/Federation** | SAML federation, IS LDAP integration | Keycloak (SAML IdP bridge, OIDC native) |
| **Certificate Management** | webMethods keystore, IS truststore | cert-manager + mTLS module |
| **High Availability** | IS clustering, API Gateway HA | Kubernetes replicas + HPA |
| **B2B/EDI** | Trading Networks, EDI processing via IS | Out of scope — keep IS for B2B workloads |
| **Licensing** | Commercial (Software AG subscription) | Apache 2.0 (fully open source) |

### Where webMethods Has Strengths

webMethods' platform reflects 20+ years of enterprise integration expertise:

- **Integration Server depth**: IS handles complex message transformation, protocol mediation, and B2B processing at a level of maturity that open-source alternatives have not fully replicated. For B2B workloads, EDI processing, and trading partner management, IS remains the appropriate tool.
- **Designer tooling**: The webMethods Designer provides a visual flow-based development environment that many enterprise teams find productive for complex integration logic. Teams that have standardized on Designer workflows have significant institutional knowledge invested.
- **Service Registry governance**: The webMethods Service Registry, when actively governed, provides a single source of truth for enterprise API and service catalogue that integrates with the IS deployment pipeline.
- **Mediator observability**: webMethods Mediator provides detailed API traffic analytics including payload logging (with masking), consumer tracking, and SLA monitoring — capabilities that enterprise compliance teams rely on.

### Where Open Source Has Advantages

- **AI agent support**: Native MCP protocol, tool discovery, and agent metering — designed for the current API consumer landscape.
- **GitOps-first operations**: All configuration is declarative YAML in Git. No Designer dependency, no package deployment pipeline, no proprietary format.
- **Kubernetes-native**: Helm deployment, Kubernetes-native scaling, service mesh integration.
- **Cost transparency**: Apache 2.0 licensing with no per-core, per-API, or per-transaction fees.
- **Developer self-service**: Modern portal UX that reduces API onboarding from days to minutes.

## Understanding the webMethods Architecture Before You Migrate

A successful migration requires understanding which components of your webMethods deployment are in scope and which are not. webMethods is not a single product — it is a suite, and the migration scope depends on which components you are actually using.

**In scope for API Gateway migration:**

- webMethods API Gateway (the gateway runtime handling inbound API traffic)
- webMethods Developer Portal (the consumer-facing API catalogue and subscription management)
- webMethods API Analytics (traffic monitoring and reporting)
- Gateway-level policy configuration (OAuth2, rate limiting, routing, transformation at the gateway boundary)

**Out of scope — maintain IS for these:**

- webMethods Integration Server flows that implement business logic
- Trading Networks (B2B/EDI processing)
- webMethods Broker / Universal Messaging (event streaming)
- IS-based adapter framework (SAP, Salesforce, database adapters)

The boundary between "gateway" and "IS" is not always clean in mature webMethods deployments. APIs that appear to be simple REST proxies may actually route through IS flow services that perform transformation, enrichment, or orchestration. The IS dependency mapping in Phase 1 of the migration is critical precisely because of this blurring.

## Migration Roadmap

### Phase 1: Assessment and IS Dependency Mapping (Weeks 1-5)

The webMethods-specific risk in Phase 1 is IS dependency discovery. Before you can classify any API as a migration candidate, you need to know whether it routes through IS and, if so, what the IS flow service does.

**IS dependency mapping:**

For each API registered in the API Gateway, document:
- Does it proxy directly to a backend, or does it route through an IS flow service?
- If through IS: what does the flow service do? (Transform only? Orchestrate multiple backends? Apply business rules?)
- Can that IS logic be replaced by an OPA policy on the new gateway, moved to the backend service, or does it require IS to remain in the path?

The output of this mapping determines which APIs can migrate independently and which require a parallel IS migration project.

**Service Registry export:**

Export a full snapshot of the webMethods Service Registry. This is your starting inventory. For each registered service, document: version, owner team, consumer list (from API Analytics), last deployment date, SLA tier, and authentication method.

Flag services with no consumer activity in the prior 90 days as zombie API candidates — these can be deprecated rather than migrated, which reduces migration scope.

**Infrastructure assessment:**

| Component | What to Document |
|-----------|-----------------|
| IS instances | Count, version, clustering mode, package list |
| API Gateway instances | Count, version, staging environments |
| Developer Portal | Version, customizations, SSO integration |
| Identity integration | LDAP structure, OAuth2 provider, SAML federation points |
| IBM MQ integration | Queue bindings that API flows depend on |
| Certificates | API Gateway keystore, IS truststore contents |
| Traffic patterns | TPS per API, peak load, SLA thresholds |

### Phase 2: Sidecar Deployment (Weeks 6-9)

Deploy the new gateway alongside webMethods without touching production traffic. The new gateway handles only new APIs and AI agent traffic at this stage.

```
Existing flow (unchanged):
  All consumers → webMethods API Gateway → IS → Backend APIs

New flow (added in parallel):
  AI Agents   → STOA MCP Gateway  → Backend APIs
  New APIs    → STOA API Gateway  → Backend APIs
```

**Rule established in Phase 2**: All new APIs go through STOA from this point forward. webMethods receives no new services after this date. This is the moment the migration becomes real for the organization — enforce it explicitly.

Configure Keycloak to federate with your existing identity provider. If your webMethods deployment uses LDAP for API consumer authentication, configure Keycloak's LDAP provider. If it uses a SAML federation point, configure Keycloak as a SAML SP. The goal is identity continuity — API consumers should not need to re-authenticate or receive new credentials during the migration.

### Phase 3: Cockpit and Observability Activation (Weeks 8-11, overlaps Phase 2)

One of the immediate value captures of the migration is replacing webMethods' siloed analytics with unified observability across the old and new gateway. Deploy the observability stack (Prometheus, Grafana, Loki) and configure it to collect metrics from both the new STOA gateway and — where possible — from webMethods Mediator via JMX or Prometheus JMX exporter.

The outcome is a single Grafana dashboard showing traffic across both gateways during the migration period. This gives platform teams immediate visibility into the migration progress and gives compliance teams a continuous audit trail.

Activate the STOA Control Plane for the APIs already running on the new gateway. The Control Plane provides self-service subscription management that replaces the manual email-and-meeting workflow typically used for webMethods API access requests. This is an immediate productivity win that builds stakeholder confidence in the migration.

### Phase 4: Policy Translation (Weeks 10-17)

webMethods policy translation has two tracks: gateway-level policies (which translate cleanly) and IS-dependent policies (which require a separate decision).

**Gateway-level policy translation:**

| webMethods Policy | Open-Source Equivalent | Notes |
|---|---|---|
| OAuth2 token validation | JWT validation (built-in) | Standard OIDC flow |
| API key authentication | API key policy | Direct equivalent |
| LDAP group authorization | Keycloak LDAP + OPA policy | Groups surfaced as OIDC claims |
| Rate limiting per application | Per-tenant quota policy | Configurable per API, per consumer |
| Request/response transformation (gateway-level) | Gateway transformation policy | Simple transforms only |
| IP allowlist/denylist | Kubernetes NetworkPolicy + gateway | Native Kubernetes networking |
| SSL/TLS termination | cert-manager + Kubernetes ingress | Standard Kubernetes pattern |
| Audit logging | OpenTelemetry + structured logs | Standards-based audit trail |
| CORS policy | Gateway CORS policy | Direct equivalent |

**IS-dependent policy decisions:**

For each API with IS flow service dependencies, you have three options:

*Option A: Absorb into gateway.* If the IS flow service performs only simple transformation (field mapping, format conversion) with no orchestration or business logic, implement the equivalent as a gateway transformation policy. Remove the IS dependency.

*Option B: Move to service layer.* If the IS flow service performs orchestration or business logic, move that logic to a microservice in the backend tier. The gateway becomes a pure proxy; the business logic moves to where it belongs.

*Option C: Maintain IS in the path.* If the IS flow service is complex, business-critical, and not worth the translation effort, keep IS running and proxy to it from the new gateway. The new gateway handles consumer-facing policy (auth, rate limiting, routing) while IS continues to handle the integration logic. This is a valid long-term architecture for many organizations.

Option C is particularly relevant for organizations with large IS estates: you can migrate the API Gateway layer and defer the IS modernization decision indefinitely.

### Phase 5: Traffic Migration (Weeks 15-22)

Canary traffic migration follows the standard sequence. For webMethods, pay particular attention to:

**Consumer credential continuity.** If your webMethods deployment issued API keys or OAuth2 client credentials to consumers, those credentials must remain valid during the transition. Configure the new gateway to honor existing credentials (by importing them or by maintaining a bridge through Keycloak) or coordinate a credential rotation with consumers before their traffic migrates.

**Mediator analytics continuity.** If compliance or audit teams depend on webMethods Mediator analytics for regulatory reporting, ensure that equivalent data is available in the new observability stack before migrating traffic. Do not create a gap in the audit trail.

**IS-in-path APIs.** For Option C APIs (IS in the path), the traffic migration is simpler: the new gateway becomes the consumer-facing entry point, IS remains as the backend. Validate that the gateway-to-IS connection (typically REST or SOAP) is correctly configured and tested before migrating production traffic.

Standard canary sequence:

| Stage | New Gateway Traffic | Observation |
|-------|-------------------|-------------|
| Canary | 5% | 48 hours, monitor latency + errors |
| Early | 25% | 1 week |
| Split | 50% | 1 week |
| Late | 90% | 2 weeks |
| Full | 100% | webMethods on standby |

### Phase 6: Developer Portal Migration (Weeks 18-24, parallel track)

The webMethods Developer Portal migration can run in parallel with traffic migration. The new portal (STOA) should be operational and populated with API documentation before consumers are asked to use it.

Key steps:

- Import API specifications from the Service Registry (OpenAPI/Swagger format)
- Configure self-service subscription workflows to replace manual access request processes
- Migrate existing consumer application registrations to the new portal
- Redirect the developer portal DNS to the new portal
- Communicate the transition to all registered consumers with adequate notice

The new portal's self-service subscription capability — request access, auto-approve or owner-approve, receive credentials instantly — is typically the most visible improvement for API consumers and generates the clearest positive feedback during the migration.

### Phase 7: Decommission (Weeks 22-30)

webMethods decommission requires specific attention to IS dependencies. Even if API Gateway traffic has been fully migrated, IS may still be running and serving Option C APIs (IS in the path from the new gateway). The decommission plan must distinguish between:

- **API Gateway decommission**: Remove webMethods API Gateway instances, update ingress rules, archive gateway configuration packages.
- **Developer Portal decommission**: Archive portal content, decommission portal servers, remove DNS entries.
- **IS continued operation**: IS instances that serve Option C APIs remain running. These are maintained under a separate IS operations model, not decommissioned.
- **Service Registry archival**: Export Service Registry contents for archival before decommission. This is the historical record of every API that was ever managed by webMethods.

## Common Challenges and Solutions

### Challenge 1: IS Dependency Entanglement

The most common source of migration delays is discovering IS dependencies that were not visible in the initial inventory. A REST API that appears to proxy directly to a backend may actually route through an IS flow service for authentication, enrichment, or logging — and that IS service may depend on other IS services, IS adapters, or IBM MQ queues.

**Solution:** Instrument IS before starting the migration. Add logging to IS flow services that records which API Gateway services invoke them. Run this instrumentation for 30 days to build a complete picture of the IS invocation graph. The result is a dependency map that makes Option A/B/C decisions straightforward.

### Challenge 2: Zombie API Remediation

Mature webMethods deployments typically contain a significant percentage of registered services with zero or near-zero traffic. Migrating these services consumes time and resources without delivering value.

**Solution:** Before migration begins, publish a zombie API list to service owners and request confirmation within 30 days. Services with no confirmed owner and no traffic are candidates for deprecation. Reducing migration scope by even 20% through deprecation has significant impact on overall timeline and cost.

### Challenge 3: IBM MQ Integration

APIs that depend on IBM MQ for message delivery (via IS adapter or direct MQ binding) require special handling. The new gateway does not have native IBM MQ integration.

**Solution:** This is an Option C scenario. Keep IS in the path for MQ-dependent APIs. The new gateway handles consumer-facing authentication and rate limiting; IS continues to handle MQ interaction. This is a valid long-term architecture — IBM MQ integration is not a dependency that needs to be eliminated on the gateway migration timeline.

### Challenge 4: Designer Workflow Replacement

Platform teams that have standardized on webMethods Designer for API development and deployment have a workflow change challenge as significant as the technical migration. Designer provides a visual development environment that teams find productive; replacing it with YAML-based GitOps requires training and tooling.

**Solution:** Invest in GitOps tooling and training alongside the technical migration. The investment pays off over time in auditability, reproducibility, and CI/CD integration — but it requires explicit change management, not just a tool swap.

### Challenge 5: webMethods Analytics Replacement

Compliance teams that depend on webMethods Mediator analytics for regulatory reporting need assurance that equivalent data is available in the new observability stack before the migration completes.

**Solution:** Run the new observability stack (Prometheus, Grafana, Loki) in parallel with webMethods Mediator during the traffic migration phase. Demonstrate equivalence to compliance teams before migrating high-criticality APIs. Export Mediator historical data for archival before decommission.

### Challenge 6: Hybrid Cloud Complexity

Many enterprises run webMethods in a hybrid configuration — some gateway instances on-premises, some in cloud. This complicates migration sequencing and network connectivity planning.

**Solution:** STOA's hybrid architecture — cloud control plane, on-premises gateway runtime — is designed for exactly this pattern. The control plane (portal, API catalogue, observability) runs in cloud; the gateway runtime that handles traffic runs on-premises. This preserves data residency for on-premises APIs while providing cloud-managed operational simplicity. See the [hybrid deployment guide](/docs/deployment/hybrid).

## Timeline Summary

For a mid-size webMethods deployment (50-150 APIs, 2-3 IS instances, modest IS integration complexity):

| Phase | Duration | Team | Risk |
|-------|----------|------|------|
| Assessment + IS mapping | 5 weeks | 2 architects | None |
| Sidecar deployment | 4 weeks | 1-2 platform engineers | Low |
| Observability activation | 3 weeks (parallel) | 1 engineer | Low |
| Policy translation | 7 weeks | 2-4 engineers | Low-Medium |
| Traffic migration | 7 weeks | 2-3 engineers | Medium (canary) |
| Portal migration | 6 weeks (parallel) | 1-2 engineers | Low |
| Decommission | 4-6 weeks | 1-2 engineers | Low |
| **Total** | **5-7 months** | **Peak: 4-6 people** | |

IS integration complexity is the primary variable. Add 2-4 weeks for each significant IS dependency track that requires Option B (move to service layer) rather than Option C (keep IS in path).

## Frequently Asked Questions

### Do I need to migrate webMethods Integration Server at the same time?

No. IS migration and API Gateway migration are independent projects. Most organizations migrate API Gateway first (3-6 months) and make a separate decision about IS modernization on a longer timeline. Option C (keep IS in the path from the new gateway) is a supported long-term architecture.

### What happens to my webMethods API Gateway policies during migration?

Gateway-level policies (OAuth2, rate limiting, routing, CORS) translate to equivalent policies on the new gateway. IS-dependent policies require a separate decision (absorb, move to service layer, or maintain IS). Policy bundles can be exported from the Administrator UI for archival.

### Can the new gateway coexist with webMethods during migration?

Yes. The sidecar deployment pattern keeps webMethods running in parallel throughout the migration. Traffic can be switched back to webMethods with a DNS or ingress change in under a minute at any stage.

### What about webMethods Trading Networks and B2B workloads?

Out of scope for API Gateway migration. Trading Networks is an IS-tier capability for EDI and B2B processing — it has no equivalent in modern API gateways and should be maintained on IS. A separate B2B platform modernization project (if needed) would address Trading Networks independently.

### How does this affect my Software AG licensing agreement?

Consult your Software AG licensing agreement regarding the terms for reducing licensed capacity or decommissioning instances. In most enterprise agreements, webMethods licensing is tied to processor cores or named user counts on specific server instances. Decommissioning gateway instances reduces the licensed footprint — coordinate with Software AG at Phase 6 (decommission), not before.

### Is STOA available as an on-premises deployment for regulated environments?

Yes. STOA is designed for on-premises deployment in regulated environments. The control plane (portal, catalogue, observability) can run on-premises or in a private cloud; the gateway runtime runs on-premises by default. This architecture meets European data residency requirements under NIS2 and DORA. See the [hybrid deployment guide](/docs/deployment/hybrid).

## Next Steps

- **[API Gateway Migration Guide 2026 →](/blog/api-gateway-migration-guide-2026)** — Vendor-neutral migration framework applicable to all legacy platforms
- **[Broadcom Layer7 Migration Guide →](/blog/layer7-ca-api-gateway-migration-stoa)** — Detailed guidance for teams migrating from Layer7
- **[STOA Hybrid Deployment Guide →](/docs/deployment/hybrid)** — Architecture reference for cloud control plane + on-premises gateway runtime
- **[STOA Quickstart →](/docs/guides/quickstart)** — Deploy in 15 minutes to evaluate

---

> This guide describes technical migration steps and does not imply any deficiency in the source platform. Migration decisions depend on specific organizational requirements. All trademarks (Software AG, webMethods, IBM, IBM MQ) belong to their respective owners.

> Feature comparisons are based on publicly available documentation as of 2026-02. Product capabilities change frequently — verify current features directly with each vendor. See [trademarks](/docs/trademarks) for details.
