---
slug: layer7-ca-api-gateway-migration-stoa
title: "Broadcom Layer7 Migration to Open Source (2026 Guide)"
authors: [stoa-team]
tags: [migration, comparison, api-gateway]
description: "Layer7 assertion-based policies don't translate 1:1. Learn how to map them to modern gateways with this phased enterprise migration plan."
keywords:
  - layer7 migration
  - ca api gateway alternative
  - broadcom layer7 to stoa
  - layer7 api gateway replacement
  - ca api management migration
  - broadcom layer7 open source
  - api gateway migration 2026
  - enterprise api gateway modernization
---

<!-- last verified: 2026-02 -->

# Broadcom Layer7 API Gateway Migration: Moving to Open Source in 2026

Migrating from Broadcom Layer7 API Gateway™ to an open-source alternative is a structured process that can be completed in 4-6 months using a phased, zero-downtime approach. This guide covers feature mapping, a five-phase migration roadmap, and practical guidance on translating Layer7's assertion-based policy model to modern open-source equivalents.

<!-- truncate -->

:::info Part of the API Gateway Migration Series
This article is part of our [complete API gateway migration guide](/blog/api-gateway-migration-guide-2026). Whether you're coming from Layer7, webMethods, Axway, or Apigee, the core migration principles are the same.
:::

## Why Teams Are Evaluating Layer7 Alternatives

Broadcom Layer7 API Gateway™ — originally CA API Gateway, itself rooted in Layer 7 Technologies — has been a mainstay in financial services, healthcare, and government API management for over a decade. Its assertion-based policy model and deep SOAP/XML support made it the default choice for enterprise teams building on WS-Security and SAML. Several shifts are now driving teams to evaluate alternatives.

**Broadcom licensing restructuring.** Broadcom's 2023 acquisition of VMware — and subsequent enterprise software portfolio reorganization — has prompted organizations to reassess Broadcom product licensing economics across the board, including Layer7. Teams that accepted prior contract terms as stable are now renegotiating under materially different conditions.

**Kubernetes-native expectations.** Layer7 was designed for VM and appliance deployments. While Kubernetes support was added, teams that have standardized on Helm, GitOps, and Kubernetes-native observability find adapting Layer7 to these workflows creates ongoing engineering overhead that Kubernetes-native gateways avoid by design.

**AI agent requirements.** MCP (Model Context Protocol), tool discovery, streaming responses, and token-level metering are not add-ons to a modern gateway — they are core design requirements for serving AI agent workloads. Adding these capabilities as extensions to an assertion-based policy engine creates architectural friction that compounds as agent traffic grows.

**European sovereignty.** NIS2 and DORA require demonstrable control over API infrastructure. Self-hosted, open-source gateways with Apache 2.0 licensing provide the auditability, deployment flexibility, and supply chain transparency these regulations require.

## Feature Comparison

Feature availability is based on publicly available documentation as of 2026-02.

<!-- last verified: 2026-02 -->

| Capability | Broadcom Layer7 API Gateway™ | STOA (Open Source) |
|---|---|---|
| **API Routing** | Policy-based routing, routing assertions | Route matching, path normalization, URL rewriting |
| **Authentication** | OAuth2, SAML 2.0, Kerberos, NTLM, mTLS, API key | OAuth2/OIDC (Keycloak), API key, mTLS, JWT |
| **Authorization** | LDAP/AD group-based, custom assertions | OPA policy engine (ABAC), per-tenant scopes |
| **Rate Limiting** | Quota assertions, throughput quotas | Per-tenant, per-tool, per-API quotas |
| **Developer Portal** | CA API Developer Portal (optional add-on) | Developer Portal (React, self-serve subscriptions) |
| **API Catalog** | CA API Management console | Control Plane API + Console UI |
| **Observability** | Layer7 API Monitor, gateway audit logs | Prometheus, Grafana, OpenTelemetry, Loki |
| **Policy Engine** | Policy Manager GUI (assertion-based, 500+ assertion types) | OPA/Rego (code-as-policy, GitOps-managed) |
| **Protocol Support** | REST, SOAP, XML, WS-Security, JMS | REST, MCP, SSE, WebSocket |
| **Deployment** | VM, appliance, Docker, Kubernetes (OTK) | Kubernetes-native (Helm), Docker Compose |
| **Multi-Tenancy** | Service account separation, clustering | Namespace-level isolation (CRDs) |
| **AI Agent Support** | Not natively supported | Native MCP gateway, tool discovery, agent metering |
| **Configuration** | Policy Manager GUI + XML bundle export | Declarative YAML/CRDs, GitOps, stoactl CLI |
| **SSO / Federation** | CA SiteMinder integration, SAML federation | Keycloak (SAML IdP bridge, OIDC native) |
| **Certificate Management** | Built-in certificate store, HSM integration | cert-manager + mTLS module |
| **High Availability** | Active-active clustering | Kubernetes replicas + HPA |
| **Licensing** | Commercial (Broadcom subscription) | Apache 2.0 (fully open source) |

### Where Layer7 Has Strengths

- **SOAP/WS-Security depth.** Layer7 has years of battle-tested support for WS-Security, WS-Trust, and XML encryption. Organizations with large SOAP estates have relied on this for regulatory and partner integration. These workloads require careful policy translation — not replacement.
- **Policy Manager breadth.** 500+ assertion types covering authentication, transformation, routing, auditing, and protocol handling. Teams with complex assertion chains have invested significant time building and maintaining this configuration.
- **CA SiteMinder integration.** Native Layer7-SiteMinder federation is a critical dependency for organizations that standardized on SiteMinder for web SSO. Keycloak can federate via SAML 2.0, making this a bridgeable gap rather than a blocker.
- **HSM integration.** Hardware Security Module support for cryptographic operations in high-security environments. Equivalent HSM configuration is required on the new platform before migrating HSM-dependent services.

### Where Open Source Has Advantages

- **AI-native from the ground up.** MCP protocol support, tool discovery, and agent metering are built into the gateway core — not assertions to configure.
- **GitOps-first.** All configuration is version-controlled YAML. No XML bundle exports or GUI-dependent workflows.
- **Kubernetes-native.** Helm deployment, Kubernetes-native scaling, service mesh integration, cert-manager PKI — designed for the platform.
- **Cost transparency.** Apache 2.0 licensing with no per-gateway, per-API, or per-call fees.

## Migration Roadmap

### Phase 1: Inventory and Classification (Weeks 1-4)

Build a complete picture of your Layer7 deployment before writing a migration plan.

**API inventory — for each service, document:**
- Protocol: REST, SOAP, XML-RPC, WS-Security
- Authentication: OAuth2, SAML, API key, Kerberos, NTLM, mTLS, Basic
- Policy complexity: assertion count, custom assertions, WS-Security usage
- Traffic volume and SLA tier
- Consuming applications

**Infrastructure inventory:**

| Component | What to Document |
|-----------|-----------------|
| Gateway instances | Count, location, version, clustering configuration |
| Policy Manager | Published services, policy fragments, encapsulated assertions |
| Certificates | CA-signed, self-signed, HSM-managed, expiry dates |
| LDAP/AD integration | Directory structure, group mappings, auth chains |
| CA SiteMinder | Federation points, protected resources |
| Traffic patterns | Peak TPS, SOAP vs REST breakdown |

**Classify each service into migration tracks:**

- **Green** — REST + OAuth2/API key, simple routing: migrate in Phases 3-4
- **Yellow** — REST + SAML, LDAP groups, complex routing assertions: migrate in Phases 4-5
- **Red** — SOAP/WS-Security, Kerberos/NTLM, custom Java assertions, HSM: Phase 5-6 or parallel indefinitely

### Phase 2: Sidecar Deployment (Weeks 5-8)

Deploy STOA alongside Layer7 without touching production traffic. All new APIs go through the new gateway from this point forward.

```
Existing flow (unchanged):
  Consumers ──→ Broadcom Layer7 API Gateway™ ──→ Backend APIs

Added in parallel:
  AI Agents ──→ STOA MCP Gateway ──→ Backend APIs
  New APIs  ──→ STOA Gateway     ──→ Backend APIs
```

**Actions:**
1. Deploy STOA via [Helm chart](/docs/deployment/hybrid) or [Docker Compose quickstart](/docs/guides/quickstart)
2. Configure Keycloak federation with your existing identity provider (LDAP, AD, CA SiteMinder SAML)
3. Register 3-5 Green-track APIs on the new gateway for validation
4. Establish monitoring baselines before production traffic arrives

### Phase 3: Identity Federation (Weeks 6-12, overlaps Phase 2)

Federation bridges the new gateway's OIDC-based identity to your existing Layer7 identity stack:

```
Applications → STOA → Keycloak (OIDC) → CA SiteMinder / LDAP / Kerberos (unchanged)
```

This means Layer7's identity infrastructure — SiteMinder, Active Directory, Kerberos — does not need to migrate. Keycloak federates via SAML 2.0 (SiteMinder), LDAP provider (AD), and SPNEGO (Kerberos), translating each to OIDC tokens that STOA validates natively.

Validate each authentication pattern in non-production before it carries traffic: SAML attribute mapping to OIDC claims, Kerberos constrained delegation, group membership propagation, and token refresh behavior.

### Phase 4: Assertion Translation (Weeks 9-18)

Translate Layer7 Policy Manager assertion chains to their open-source equivalents.

**Translation methodology:**
1. **Document the assertion chain's intent** in plain language — what business rule does it enforce? Many chains contain accumulated workarounds for limitations or bugs that don't need to be replicated.
2. **Implement to intent, not implementation** — OPA/Rego policies are more expressive than GUI assertions, so the equivalent policy is often simpler.
3. **Validate with shadow traffic** — mirror production requests to the new gateway and compare responses before promoting.

**Assertion translation reference:**

| Layer7 Assertion | Open-Source Equivalent | Notes |
|---|---|---|
| Authenticate against LDAP | Keycloak LDAP federation | Groups surfaced as OIDC claims |
| OAuth2 / OpenID Connect token | JWT validation (gateway built-in) | Standard OIDC flow |
| SAML token validation | Keycloak SAML bridge | Attribute → OIDC claim mapping |
| Kerberos / SPNEGO | Keycloak Kerberos federation | Transparent SPNEGO → OIDC bridge |
| Rate limit / throughput quota | Per-tenant quota policy | CRD or API configurable |
| WS-Security XML signature | SOAP proxy + mTLS boundary | Move WS-Security to service layer |
| XML/SOAP transformation | XSLT proxy or service layer | Shift transforms out of gateway |
| Custom assertion (Java) | OPA/Rego policy or service logic | Document intent first |
| Encapsulated assertion | OPA policy module (reusable) | Version-controlled, auditable |
| IP allow/deny | Kubernetes NetworkPolicy + gateway rule | K8s-native networking |
| Audit / log to SIEM | OpenTelemetry → existing SIEM | Standards-based, no vendor lock-in |

Custom Java assertions are the highest-risk translation item. For each: document the business purpose, then choose — OPA/Rego policy (for auth/authz logic), service layer microservice (for data transformation), or parallel Layer7 operation (for assertions where translation cost exceeds benefit).

### Phase 5: Canary Traffic Migration (Weeks 16-24)

Shift production load in controlled increments. Layer7 continues running throughout — rollback is a DNS or ingress change at any stage.

| Stage | STOA Traffic | Observation | Rollback |
|-------|-------------|-------------|---------|
| Canary | 5% | 48 hours | < 1 min |
| Early majority | 25% | 1 week | < 1 min |
| Split | 50% | 1 week | < 1 min |
| Late majority | 90% | 2 weeks | < 1 min |
| Full cutover | 100% | — | Layer7 on standby |

Monitor at each stage: P50/P95/P99 latency, error rate, authentication success rate, throughput. Advance only when all metrics are within 5% of Layer7 baseline with no unexplained anomalies.

### Phase 6: Decommission (Weeks 22-30)

After two weeks of zero production traffic on Layer7:

1. Export and archive all policy bundles, service configurations, and certificates
2. Update Broadcom licensing agreements per contractual terms
3. Remove DNS records, firewall rules, and monitoring for Layer7 instances
4. Notify all dependent teams and update runbooks

## Common Challenges

### WS-Security Workloads

Layer7 has deep WS-Security support — XML signature, XML encryption, WS-Trust — that REST-native gateways handle differently.

**Approach:** Treat each WS-Security service as a separate work stream. For each, evaluate: (a) modernize the service contract to REST/mTLS, (b) deploy a SOAP proxy that terminates WS-Security and passes REST internally, or (c) keep Layer7 in parallel for that service indefinitely. Option (c) is valid — not every SOAP contract is worth the translation effort.

### CA SiteMinder Federation

SiteMinder federation is a critical dependency for organizations that have standardized on it for web SSO.

**Approach:** Configure Keycloak as a SAML 2.0 Service Provider with SiteMinder as the IdP. STOA then authenticates against Keycloak using OIDC. This bridges SiteMinder to the new gateway without requiring SiteMinder migration. See the [authentication guide](/docs/guides/quickstart) for Keycloak configuration details.

### Kerberos / NTLM Authentication

Kerberos Constrained Delegation and NTLM are common in government and financial services Layer7 deployments.

**Approach:** Keycloak's SPNEGO/Kerberos provider accepts Kerberos tokens and translates them to OIDC claims. Configure once at the Keycloak level — STOA validates OIDC tokens, never Kerberos tickets directly. This isolates Kerberos complexity at the identity layer.

### HSM-Managed Cryptography

High-security Layer7 deployments use Hardware Security Modules for key storage and cryptographic operations.

**Approach:** cert-manager supports HSM integration via PKCS#11. Configure cert-manager to use your HSM for key generation and certificate signing before migrating HSM-dependent services. Validate HSM-backed operations under load in non-production.

### Custom Assertion Inventory

Large Layer7 deployments accumulate custom Java assertions over years. These represent the highest-effort translation items.

**Approach:** Audit all custom assertions and classify each: (a) implement as OPA/Rego policy, (b) move to service layer, (c) keep on Layer7 in parallel. Prioritize (a) and (b) for assertions that carry security or governance logic. Prioritize (c) for specialized protocol handling where the translation cost exceeds the value.

## Timeline Summary

For a mid-size deployment (50-150 services, 2-3 gateway instances):

| Phase | Duration | Team Size | Risk |
|-------|----------|-----------|------|
| Inventory and Classification | 4 weeks | 2 architects | None |
| Sidecar Deployment | 4 weeks | 1-2 platform engineers | Low |
| Identity Federation | 4 weeks (overlaps) | 1-2 engineers | Low-Medium |
| Assertion Translation | 6-10 weeks | 2-4 engineers | Low-Medium |
| Canary Traffic Migration | 6 weeks | 2-3 engineers | Medium (canary mitigated) |
| Decommission | 4-6 weeks | 1-2 engineers | Low |
| **Total** | **4-6 months** | **Peak: 4-6 people** | |

Add 2-4 weeks per 30% of services that are SOAP/WS-Security or Kerberos-authenticated.

## Frequently Asked Questions

### How long does a Layer7 migration typically take?

For a mid-size deployment (50-150 services), expect 4-6 months using the phased approach above. The largest variable is assertion translation complexity — SOAP/WS-Security and Kerberos services take significantly longer than REST/OAuth2 services. Run a discovery sprint in Phase 1 to size the translation effort before committing to a timeline.

### Can I keep Layer7 for some services and use STOA for others?

Yes. Indefinitely, if needed. Many organizations route AI agent traffic, new REST APIs, and Green-track services through the new gateway while Layer7 handles SOAP/WS-Security and Kerberos workloads. The hybrid model runs until the economics of parallel operation outweigh the translation effort for remaining services.

### Do I need to migrate CA SiteMinder as part of this?

No. Keycloak federates with SiteMinder via SAML 2.0 — SiteMinder continues serving as the identity source unchanged. Gateway migration and IdP migration are independent work streams.

### Is the migration reversible?

Yes, at every phase. During Phases 2-5, Layer7 continues running in parallel. Reverting is a DNS or ingress change in under a minute. The only irreversible step is Phase 6 (decommission), which should only execute after 2+ weeks of confirmed zero traffic on Layer7.

### What happens to my Policy Manager policy bundles?

Export all bundles as XML archives before decommission. Beyond archival value, the bundle XML serves as documentation of the original business rules implemented in each assertion chain — useful even years after migration when understanding why a policy behaves a certain way.

## Next Steps

- **[API Gateway Migration Guide 2026](/blog/api-gateway-migration-guide-2026)** — Vendor-neutral framework covering all legacy platforms
- **[Open-Source API Gateway Comparison 2026](/blog/open-source-api-gateway-2026)** — Compare STOA, Kong, Gravitee, and more
- **[Quickstart Guide](/docs/guides/quickstart)** — Deploy STOA in 15 minutes to evaluate
- **[Hybrid Deployment Guide](/docs/deployment/hybrid)** — Cloud control plane + on-premises gateway reference architecture

---

> This guide describes technical migration steps and does not imply any deficiency in the source platform. Migration decisions depend on specific organizational requirements. All trademarks belong to their respective owners.

> Feature comparisons are based on publicly available documentation as of 2026-02. Product capabilities change frequently. We encourage readers to verify current features directly with each vendor. See [trademarks](/docs/trademarks) for details.
