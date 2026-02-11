---
sidebar_position: 5
title: "STOA Platform Roadmap: Features & Milestones"
description: "STOA Platform public roadmap — upcoming features for the open-source AI-native API gateway with MCP support, sidecar mode, CLI, and performance improvements"
keywords: [roadmap, features, release plan, MCP gateway, API management, STOA, open source]
---

# Roadmap

Our vision for STOA Platform — building the gateway for the AI era.

:::info Living Document
This roadmap reflects our current priorities and may evolve based on community feedback and market needs. Have ideas? [Join the discussion on Discord](https://discord.gg/j8tHSSes).
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
| Helm Charts | Done |
| OPA Policy Engine | Done |
| Consumer Onboarding — data model, Keycloak sync, quotas | Done |
| Born GitOps — declarative API lifecycle (ADR-040) | Done |

---

## In Progress

**Sidecar Mode, CLI & Developer Experience**

| Feature | Status |
|---------|--------|
| Gateway Sidecar Mode — coexist with Kong, Envoy, etc. | In Progress |
| CLI Tool (`stoa`) — kubectl-style management | In Progress |
| Terraform Provider | Planned |
| OpenAPI Import — auto-register from spec | Planned |
| SDK (Python, TypeScript) | Planned |

---

## Planned

**Performance, Scale & Ecosystem**

| Feature | Status |
|---------|--------|
| Gateway Proxy Mode — transparent proxy for legacy backends | Planned |
| Gateway Shadow Mode — traffic mirroring for validation | Planned |
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

- **Discord**: [Join the community](https://discord.gg/j8tHSSes)
- **Issues**: [Report bugs or request features](https://github.com/stoa-platform/stoa/issues)
- **Contribute**: [Contributing guide](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- **Contact**: [hello@gostoa.dev](mailto:hello@gostoa.dev)

---

*This roadmap is directional and subject to change. For enterprise roadmap discussions, contact [sales@gostoa.dev](mailto:sales@gostoa.dev).*
