---
slug: dora-nis2-api-gateway-compliance
title: "DORA and NIS2 for API Gateways: What You Must Know"
authors: [christophe]
tags: [compliance, architecture]
description: "Financial and critical sectors face new API requirements. Audit trails, encryption, resilience testing, and third-party risk mandated by DORA and NIS2."
keywords:
  - DORA compliance API
  - NIS2 API gateway
  - European API compliance
  - financial regulation API
  - API gateway compliance
  - digital operational resilience
  - cybersecurity directive
---

The European regulatory landscape has shifted dramatically for organizations managing digital infrastructure. **DORA NIS2 compliance** is no longer a future concern — it is an immediate operational requirement for any organization operating API gateways in financial services, healthcare, energy, or critical infrastructure sectors across the EU.

<!-- truncate -->

If your API gateway handles traffic for regulated industries, you need to understand how these two directives intersect with your API management strategy. This article breaks down what DORA and NIS2 require, how they impact API infrastructure specifically, and what capabilities your gateway should provide to support compliance efforts.

<!-- last verified: 2026-02 -->

> **Disclaimer:** This article provides general information about regulatory requirements and how API gateway capabilities can support compliance efforts. It does not constitute legal advice. Organizations should consult qualified legal counsel for specific compliance requirements.

## What Are DORA and NIS2?

### DORA: Digital Operational Resilience Act

DORA (Regulation (EU) 2022/2554) targets the financial sector. It entered into full application in January 2025 and imposes strict requirements on ICT risk management for banks, insurance companies, payment processors, and their third-party ICT providers.

Key pillars of DORA:

- **ICT risk management** — Organizations must identify, protect against, detect, respond to, and recover from ICT-related incidents.
- **Incident reporting** — Major ICT incidents must be reported to regulators within strict timelines.
- **Digital operational resilience testing** — Regular testing including threat-led penetration testing (TLPT).
- **Third-party risk management** — Critical ICT providers are subject to direct oversight.
- **Information sharing** — Encouraged sharing of cyber threat intelligence.

### NIS2: Network and Information Security Directive

NIS2 (Directive (EU) 2022/2555) is broader in scope. It applies to "essential" and "important" entities across 18 sectors, including energy, transport, health, digital infrastructure, and public administration.

Key requirements of NIS2:

- **Risk management measures** — Technical, operational, and organizational measures to manage cybersecurity risks.
- **Incident notification** — Early warning within 24 hours, full notification within 72 hours.
- **Supply chain security** — Assessment of third-party and supplier risks.
- **Business continuity** — Backup management, disaster recovery, and crisis management.
- **Encryption and access control** — Use of cryptography and multi-factor authentication.

## How DORA and NIS2 Impact API Gateway Infrastructure

API gateways sit at the heart of modern digital architectures. They process every request between clients, services, and increasingly, AI agents. This central position makes them a critical compliance surface for both directives.

### Audit Logging and Traceability

Both DORA and NIS2 require comprehensive logging of security-relevant events. For an API gateway, this means:

- **Every API call** must be logged with caller identity, timestamp, action, and outcome.
- **Authentication events** (successful and failed) must be recorded and retained.
- **Policy decisions** (allow/deny) must be traceable to specific rules.
- **Log integrity** must be guaranteed — logs cannot be tampered with or silently deleted.

An API gateway that only provides basic access logs is insufficient. You need structured, immutable audit trails that can be queried during regulatory investigations.

### Encryption In Transit and At Rest

NIS2 explicitly requires the use of cryptography. For API gateways, this translates to:

- **mTLS** between services (not just TLS termination at the edge).
- **Encryption at rest** for any stored API keys, tokens, or credentials.
- **Certificate management** with automated rotation and revocation.
- **Key management** integrated with a secrets management solution like HashiCorp Vault.

### Incident Detection and Response

DORA mandates that organizations detect anomalies and respond to incidents rapidly. Your API gateway must support:

- **Real-time anomaly detection** — Unusual traffic patterns, authentication failures, rate limit breaches.
- **Automated alerting** — Integration with SIEM and incident management platforms.
- **Circuit breaking and rate limiting** — Automatic mitigation of ongoing attacks.
- **Forensic capability** — The ability to reconstruct the sequence of events during an incident.

### Resilience and Business Continuity

DORA's resilience testing requirements mean your API gateway cannot be a single point of failure:

- **High availability** — Active-active or active-passive deployment across availability zones.
- **Graceful degradation** — The gateway must continue operating (possibly in reduced mode) during partial failures.
- **Disaster recovery** — Documented and tested recovery procedures with defined RTOs and RPOs.
- **Chaos testing** — Regular testing of failure scenarios to validate resilience.

### Third-Party and Supply Chain Risk

If you use a managed API gateway from a cloud provider, DORA may classify that provider as a "critical ICT third-party." This means:

- **Vendor lock-in becomes a compliance risk** — You must demonstrate that you can switch providers.
- **Data sovereignty matters** — Where is your API traffic processed and logged?
- **Open source reduces risk** — Self-hosted, open-source gateways eliminate single-vendor dependency.

## What Features Your API Gateway Needs

Based on DORA and NIS2 requirements, here is a compliance checklist for API gateway infrastructure:

| Requirement | DORA | NIS2 | Gateway Capability Needed |
|---|:---:|:---:|---|
| Immutable audit logs | Yes | Yes | Structured logging with tamper-proof storage |
| mTLS / encryption | Yes | Yes | End-to-end TLS, mTLS between services |
| Access control (RBAC) | Yes | Yes | Fine-grained, role-based access with MFA |
| Incident alerting | Yes | Yes | Real-time monitoring, SIEM integration |
| Rate limiting | Yes | - | Configurable per-tenant, per-endpoint limits |
| Circuit breaking | Yes | - | Automatic failover on backend failures |
| Resilience testing | Yes | - | Chaos engineering support, health probes |
| Data sovereignty | - | Yes | On-premise / hybrid deployment option |
| Supply chain transparency | Yes | Yes | SBOM generation, dependency auditing |
| Disaster recovery | Yes | Yes | Multi-AZ deployment, backup/restore |

## How STOA Addresses DORA and NIS2 Requirements

STOA was designed with European regulatory requirements as a first-class concern. Here is how the platform maps to each compliance area:

### Comprehensive Audit Trail

STOA integrates with [OpenSearch for centralized logging](/docs/enterprise/security-compliance), providing structured, queryable audit logs for every API call, authentication event, and policy decision. Logs include tenant context, caller identity, and full request metadata.

### Hybrid Deployment for Data Sovereignty

STOA's [hybrid architecture](/docs/deployment/hybrid) separates the Control Plane (which can run in the cloud) from the Data Plane (which runs on-premise). This means sensitive API traffic never leaves your infrastructure, addressing NIS2 data sovereignty requirements directly.

### Built-In Resilience

The STOA Gateway implements circuit breaking, retry policies with exponential backoff, and health-check-based routing. The Kubernetes-native deployment model provides high availability across zones, with pod disruption budgets and rolling updates ensuring zero-downtime operations.

### Open Source Transparency

As an Apache 2.0 licensed project, STOA provides full source code transparency. Every build generates SBOMs (Software Bill of Materials) in both CycloneDX and SPDX formats, enabling supply chain auditing as required by both DORA and NIS2.

### Multi-Tenant Isolation

STOA's multi-tenant architecture uses Kubernetes namespace isolation, Keycloak realm separation, and schema-per-tenant database design. This ensures that a compliance incident in one tenant does not affect others — a critical requirement for financial services platforms.

### Policy-as-Code with OPA

STOA uses Open Policy Agent (OPA) for policy enforcement, enabling auditable, version-controlled security policies. Every policy decision is logged and traceable, which simplifies regulatory reporting.

## Building Your Compliance Roadmap

Building toward DORA and NIS2 alignment is not a one-time project. It requires:

1. **Gap assessment** — Map your current API infrastructure against the requirements table above.
2. **Architecture review** — Evaluate whether your gateway supports hybrid deployment and data sovereignty.
3. **Logging and monitoring** — Implement structured, immutable audit logging before anything else.
4. **Resilience testing** — Establish regular chaos testing and document recovery procedures.
5. **Vendor assessment** — If using managed services, evaluate lock-in risk and exit strategies.

## Get Started

If you are evaluating API gateway platforms for regulated industries, STOA provides security, auditability, and deployment flexibility that support DORA and NIS2 compliance efforts.

- Explore the [Security and Compliance documentation](https://docs.gostoa.dev/docs/enterprise/security-compliance)
- Learn about [Hybrid Deployment](https://docs.gostoa.dev/docs/deployment/hybrid)
- Try STOA today with the [Quickstart Guide](https://docs.gostoa.dev/docs/guides/quickstart)
- Sign up for the [STOA Console](https://console.gostoa.dev) to see the platform in action

---

## Further Reading

- [Complete API Gateway Migration Guide 2026](/blog/api-gateway-migration-guide-2026) — Decision framework for legacy gateway modernization
- [API Management in Europe: Data Sovereignty](/blog/api-management-europe-sovereignty) — How gateway jurisdiction impacts compliance
- [Enterprise Security Compliance](/docs/enterprise/security-compliance) — Detailed regulatory mapping
- [STOA Security Architecture: Defense-in-Depth](/blog/stoa-api-security-architecture) — Five-layer security model supporting DORA resilience requirements
- [OAuth 2.1 + PKCE for MCP Gateways](/blog/oauth-pkce-mcp-gateway) — Standards-based authentication supporting NIS2 access control requirements
- [OWASP API Security Top 10 & STOA](/blog/owasp-api-security-top-10-stoa) — OWASP risk mapping complementing regulatory compliance
- [Zero Trust for API Gateways (Part 1)](/blog/zero-trust-api-gateways-part-1) — Zero Trust architecture aligns with DORA/NIS2 access management controls

---

*Christophe Aboulicam is the Founder & CTO at HLFH, building STOA Platform to bring AI-native API management to European enterprises.*

> **Disclaimer:** STOA Platform provides technical capabilities that support regulatory compliance efforts. This does not constitute legal advice or a guarantee of compliance. Organizations should consult qualified legal counsel for compliance requirements.
