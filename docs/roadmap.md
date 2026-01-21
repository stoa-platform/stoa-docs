---
sidebar_position: 5
title: Roadmap
description: STOA Platform public roadmap and upcoming features
---

# Roadmap

Our vision for STOA Platform — building the gateway for the AI era.

:::info Living Document
This roadmap reflects our current priorities and may evolve based on community feedback and market needs. Have ideas? [Join the discussion on Discord](https://discord.gg/j8tHSSes).
:::

---

## 🚀 Q1 2026 — Foundation

**Theme: Core Platform & MCP Gateway**

| Feature | Status | Notes |
|---------|--------|-------|
| Control Plane API (Python/FastAPI) | ✅ Done | |
| MCP Gateway (Python/FastAPI) | ✅ Done | |
| Developer Portal | ✅ Done | React + TypeScript |
| Admin Console | ✅ Done | React + TypeScript |
| Multi-tenant Architecture | ✅ Done | |
| Keycloak SSO Integration | ✅ Done | |
| API Key Management + Vault | ✅ Done | |
| Subscription Management | ✅ Done | |
| Basic Observability (Prometheus/Grafana) | ✅ Done | |
| Documentation Site | ✅ Done | |
| Helm Charts | ✅ Done | GitLab-hosted |
| OPA Policy Engine | ✅ Done | |
| webMethods Gateway Integration | ✅ Done | API traffic |

---

## 🔧 Q2 2026 — Enterprise Ready

**Theme: Security, Scale & Self-Service**

| Feature | Status |
|---------|--------|
| Rate Limiting & Quotas | 🔄 In Progress |
| Usage Metering & Analytics | 🔄 In Progress |
| RBAC Policies (Fine-grained) | 📋 Planned |
| Audit Logging | 📋 Planned |
| API Versioning | 📋 Planned |
| Schema Registry | 📋 Planned |
| Webhook Notifications | 📋 Planned |
| Backup & Disaster Recovery | 📋 Planned |

---

## 🌐 Q3 2026 — Ecosystem

**Theme: Integrations & Developer Experience**

| Feature | Status |
|---------|--------|
| CLI Tool (`stoa`) | 📋 Planned |
| Terraform Provider | 📋 Planned |
| GitOps Templates (ArgoCD) | 📋 Planned |
| Pre-built MCP Connectors | 📋 Planned |
| SDK (Python, TypeScript) | 📋 Planned |
| OpenAPI Import | 📋 Planned |
| Postman/Insomnia Collections | 📋 Planned |

---

## ⚡ Q4 2026 — Performance & Edge

**Theme: Global Scale & High Performance**

| Feature | Status | Notes |
|---------|--------|-------|
| MCP Gateway (Rust + Tokio) | 📋 Planned | Native implementation |
| eBPF Acceleration | 📋 Planned | Kernel-level performance |
| Edge Deployment | 📋 Planned | |
| WebAssembly Plugins | 📋 Planned | |
| Response Caching | 📋 Planned | |
| Geographic Load Balancing | 📋 Planned | |

:::info Performance Vision
The Rust + eBPF implementation will provide:
- Kernel-level rate limiting and observability
- Sub-millisecond latency overhead
- Memory footprint < 80MB (vs typical ~500MB)
- 10x better performance than user-space solutions
:::

---

## 🔮 2027 & Beyond

**Theme: AI-Native Platform**

- **AI Cost Management** — Token metering per team/project
- **Agent Observability** — Trace AI agent workflows end-to-end
- **Policy as Code** — Define access policies in natural language
- **Marketplace** — Discover and share MCP tool configurations
- **Multi-Cloud** — Native support for AWS, GCP, Azure
- **Native Rust Gateway** — Replace webMethods with STOA-native gateway

---

## Current vs Vision

To help understand where we are today versus where we're heading:

| Component | Current (Q1 2026) | Vision (Q4 2026+) |
|-----------|-------------------|-------------------|
| Control Plane | Python + FastAPI | Python + FastAPI |
| MCP Gateway | Python + FastAPI | Rust + Tokio |
| API Gateway | webMethods | Native Rust + eBPF |
| Performance | User-space | Kernel-level (eBPF) |

---

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Done |
| 🔄 | In Progress |
| 📋 | Planned |

---

## Get Involved

We build in public and welcome contributions!

- 💬 **Discord**: [Join the community](https://discord.gg/j8tHSSes)
- 🐛 **Issues**: [Report bugs or request features](https://github.com/stoa-platform/stoa/issues)
- 🤝 **Contribute**: [Contributing guide](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- 📧 **Contact**: [hello@gostoa.dev](mailto:hello@gostoa.dev)

---

*Last updated: January 2026*
