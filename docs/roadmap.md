---
sidebar_position: 5
title: "STOA Platform Roadmap: Features & Milestones"
description: "STOA Platform public roadmap — upcoming features for the open-source AI-native API gateway with MCP support, LLM proxy, sidecar mode, CLI, and multi-vendor adapters"
keywords: [roadmap, features, release plan, MCP gateway, API management, STOA, open source, LLM proxy]
---

# Roadmap

Our vision for STOA Platform — building the gateway for the AI era.

:::info Living Document
This roadmap reflects our current priorities and may evolve based on community feedback and market needs. Have ideas? [Join the discussion on Discord](https://discord.gostoa.dev).
:::

:::tip Latest Release
**[v2.2.0](/blog/release-v2.2.0)** (March 2026) — LLM Proxy, Self-Service Signup, Skills System, MCP 2025-11-25, OAuth 2.1 DPoP, and 12 new API endpoints.
:::

---

## Available Today

**Core Platform, MCP Gateway, LLM Proxy & Multi-Vendor Support**

| Feature | Status | Since |
|---------|--------|-------|
| Control Plane API (Python/FastAPI) | Done | v0.1.0 |
| STOA Gateway (Rust/Tokio/axum) | Done | v0.2.0 |
| MCP Protocol 2025-11-25 — tool discovery, resources, prompts, completion | Done | v2.2.0 |
| Developer Portal — self-service API discovery + signup | Done | v0.1.0 |
| Admin Console — API catalog, observability, tenant ops | Done | v0.1.0 |
| Multi-tenant Architecture — namespace-level isolation | Done | v0.1.0 |
| Keycloak SSO — OIDC, LDAP federation, multi-realm | Done | v0.1.0 |
| LLM Proxy — multi-provider routing (OpenAI, Azure, Mistral) | Done | v2.2.0 |
| LLM Cost Management — per-tenant budgets, enforcement, dashboard | Done | v2.2.0 |
| Self-Service Signup — tenant provisioning, trial limits | Done | v2.2.0 |
| Skills System — gateway-native CRUD with circuit breaker | Done | v2.2.0 |
| UAC (Universal API Contract) — JSON Schema validator, OpenAPI transform | Done | v2.2.0 |
| OAuth 2.1 — DPoP binding, RFC 7592 DCR management | Done | v2.2.0 |
| Rate Limiting — per-consumer quotas | Done | v0.2.0 |
| Circuit Breaker — per-upstream with zombie reaper | Done | v0.2.0 |
| mTLS — certificate-bound tokens (RFC 8705) | Done | v0.2.0 |
| Security Headers — OWASP best practices, SSRF blocklist | Done | v0.2.0 |
| PII Masking — middleware + admin endpoints | Done | v2.2.0 |
| Security Posture Scanner | Done | v2.2.0 |
| Gateway Adapters — webMethods, Kong, Gravitee, Apigee, AWS, Azure APIM | Done | v2.2.0 |
| Gateway Auto-Registration — zero-config heartbeat | Done | v0.2.0 |
| Observability — Prometheus, Grafana, OpenSearch | Done | v0.1.0 |
| Gateway Arena — continuous benchmark lab (20 enterprise dimensions) | Done | v2.2.0 |
| Platform Continuous Verification — 3 CUJs every 15 min | Done | v2.2.0 |
| W3C Traceparent — distributed tracing propagation | Done | v2.2.0 |
| Helm Charts — full platform deployment | Done | v0.1.0 |
| OPA Policy Engine | Done | v0.1.0 |
| Consumer Onboarding — data model, Keycloak sync, quotas | Done | v0.2.0 |
| Born GitOps — declarative API lifecycle (ADR-040) | Done | v0.2.0 |
| Audit Trail — PG dual-write + OpenSearch pipeline | Done | v2.2.0 |
| ArgoCD Integration — GitOps deployment on OVH + Hetzner | Done | v0.2.0 |
| CRDs — Tool, ToolSet, GatewayInstance, GatewayBinding | Done | v0.2.0 |
| Usage Metering Pipeline | Done | v2.2.0 |
| Billing — budgets, consumers, models API | Done | v2.2.0 |
| Contract Lifecycle Management | Done | v2.2.0 |
| Data Governance Endpoints | Done | v2.2.0 |
| SCIM-to-Gateway Reconciliation | Done | v2.2.0 |
| i18n Framework (Console) | Done | v2.2.0 |
| Integrated AI Chat Assistant | Done | v2.2.0 |
| Tenant Export/Import (Disaster Recovery) | Done | v2.2.0 |
| Documentation — 100+ guides, references, ADRs, and API docs | Done | v2.2.0 |

---

## In Progress

**GitOps Operator, Sidecar Mode & Developer Experience**

| Feature | Status |
|---------|--------|
| GitOps Reconciliation Operator — K8s operator replacing AWX (ADR-042) | In Progress |
| Gateway Sidecar Mode — coexist with Kong, Envoy, etc. (ADR-024) | In Progress |
| CLI Tool (`stoactl`) — kubectl-style management (Go/Cobra) | In Progress |
| Landing Page & Pricing (gostoa.dev) | In Progress |

---

## Planned

**Performance, Scale & Ecosystem**

| Feature | Status |
|---------|--------|
| Gateway Proxy Mode — transparent proxy for legacy backends | Planned (Q3 2026) |
| Gateway Shadow Mode — traffic mirroring and UAC generation | Planned (Q4 2026) |
| Terraform Provider | Planned |
| OpenAPI Import — auto-register from spec | Planned |
| SDK (Python, TypeScript) | Planned |
| Edge Deployment | Planned |
| WebAssembly Plugins | Planned |
| Response Caching | Planned |
| Pre-built MCP Connectors | Planned |
| GitOps Templates (ArgoCD) | Planned |
| Public Helm Registry | Planned |

---

## Under Consideration

- **Policy as Code** — Define access policies in natural language
- **Marketplace** — Discover and share MCP tool configurations
- **Multi-Cloud Native** — Provider-specific optimizations
- **Agent Observability** — End-to-end AI agent workflow tracing

---

## Get Involved

We build in public and welcome contributions!

- **Discord**: [Join the community](https://discord.gostoa.dev)
- **Issues**: [Report bugs or request features](https://github.com/stoa-platform/stoa/issues)
- **Contribute**: [Contributing guide](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- **Contact**: [hello@gostoa.dev](mailto:hello@gostoa.dev)

---

*This roadmap is directional and subject to change. For enterprise roadmap discussions, contact [sales@gostoa.dev](mailto:sales@gostoa.dev).*
