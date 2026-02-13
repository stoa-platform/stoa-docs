---
sidebar_position: 5
title: "STOA Platform Roadmap: Features & Milestones"
description: "STOA Platform public roadmap — upcoming features for the open-source AI-native API gateway with MCP support, sidecar mode, CLI, and performance improvements"
keywords: [roadmap, features, release plan, MCP gateway, API management, STOA, open source]
---

# Roadmap

Our vision for STOA Platform — building the gateway for the AI era.

:::info Living Document
This roadmap reflects our current priorities and may evolve based on community feedback and market needs. Have ideas? [Join the discussion on Discord](https://discord.gostoa.dev).
:::

---

## Available Today

**Core Platform, MCP Gateway & Multi-Vendor Support**

| Feature | Status |
|---------|--------|
| Control Plane API (Python/FastAPI) | Done |
| STOA Gateway (Rust/Tokio/axum) | Done |
| MCP Protocol — tool discovery, invocation, SSE | Done |
| Developer Portal — self-service API discovery | Done |
| Admin Console — API catalog, observability, tenant ops | Done |
| Multi-tenant Architecture — namespace-level isolation | Done |
| Keycloak SSO — OIDC, LDAP federation, multi-realm | Done |
| Rate Limiting — per-consumer quotas | Done |
| Circuit Breaker — per-upstream with zombie reaper | Done |
| mTLS — certificate-bound tokens (RFC 8705) | Done |
| Security Headers — OWASP best practices, SSRF blocklist | Done |
| Gateway Adapters — webMethods, Kong, Gravitee | Done |
| Gateway Auto-Registration — zero-config heartbeat | Done |
| Observability — Prometheus, Grafana, OpenSearch | Done |
| Helm Charts — full platform deployment | Done |
| OPA Policy Engine | Done |
| Consumer Onboarding — data model, Keycloak sync, quotas | Done |
| Born GitOps — declarative API lifecycle (ADR-040) | Done |
| Gateway Arena — continuous benchmark lab (STOA vs Kong vs Gravitee) | Done |
| Audit Trail — OpenSearch data pipeline, Fluent Bit | Done |
| ArgoCD Integration — GitOps deployment on OVH + Hetzner | Done |
| CRDs — Tool, ToolSet, GatewayInstance, GatewayBinding | Done |
| SLO Dashboard — APDEX, error budget, availability tracking | Done |
| Documentation v1.0 — 30+ guides, references, and API docs | Done |

---

## In Progress

**GitOps Operator, Sidecar Mode & Developer Experience**

| Feature | Status |
|---------|--------|
| GitOps Reconciliation Operator — K8s operator replacing AWX (ADR-042) | In Progress |
| Gateway Sidecar Mode — coexist with Kong, Envoy, etc. | In Progress |
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

- **AI Cost Management** — Token metering per team/project
- **Agent Observability** — Trace AI agent workflows end-to-end
- **Policy as Code** — Define access policies in natural language
- **Marketplace** — Discover and share MCP tool configurations
- **Multi-Cloud Native** — Provider-specific optimizations

---

## Get Involved

We build in public and welcome contributions!

- **Discord**: [Join the community](https://discord.gostoa.dev)
- **Issues**: [Report bugs or request features](https://github.com/stoa-platform/stoa/issues)
- **Contribute**: [Contributing guide](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- **Contact**: [hello@gostoa.dev](mailto:hello@gostoa.dev)

---

*This roadmap is directional and subject to change. For enterprise roadmap discussions, contact [sales@gostoa.dev](mailto:sales@gostoa.dev).*
