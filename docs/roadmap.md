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

## 🎯 MVP Demo — February 26, 2026

**Theme: Production-Ready Core Platform**

| Feature | Status |
|---------|--------|
| Control Plane API (FastAPI) | ✅ Done |
| Developer Portal (React) | ✅ Done |
| Admin Console (React) | ✅ Done |
| Multi-tenant Architecture | ✅ Done |
| Keycloak SSO Integration | ✅ Done |
| API Key Management + Vault | ✅ Done |
| Subscription Management | ✅ Done |
| Observability Stack (Prometheus/Grafana/Loki) | ✅ Done |
| MCP Gateway (23 tools via webMethods) | ✅ Done |
| Error Snapshots (Flight Recorder) | ✅ Done |
| GitOps Foundation (ArgoCD) | ✅ Done |
| Documentation Site | ✅ Done |
| Helm Charts | ✅ Done |
| Quick Start Docker Compose | 🔄 In Progress |
| Getting Started Tutorial | 🔄 In Progress |
| E2E Testing (Portal) | 📋 Planned |

---

## 🚀 Q1 2026 — Foundation & Community Launch

**Theme: Open Source Release**

| Feature | Status |
|---------|--------|
| GitHub Repository (`stoa-core`) | 📋 Planned |
| CONTRIBUTING.md + PR Templates | 🔄 In Progress |
| Community Discord Launch | 📋 Planned |
| Design Partner Program | 📋 Planned |
| Apache 2.0 Licensing | ✅ Done |
| Trademark Registration (INPI) | ✅ Done |

---

## 🔧 Q2 2026 — Enterprise Ready

**Theme: Security, Scale & Self-Service**

| Feature | Status |
|---------|--------|
| Rate Limiting & Quotas | 🔄 In Progress |
| Usage Metering & Analytics | 🔄 In Progress |
| RBAC Policies (Fine-grained) | 📋 Planned |
| Audit Logging (NIS2/DORA) | 📋 Planned |
| API Versioning | 📋 Planned |
| Schema Registry | 📋 Planned |
| Webhook Notifications | 📋 Planned |
| Backup & Disaster Recovery | 📋 Planned |
| Supply Chain Security (SBOM, SLSA) | 📋 Planned |

---

## 🌐 Q3 2026 — v1.0 & Ecosystem

**Theme: Integrations & Developer Experience**

| Feature | Status |
|---------|--------|
| CLI Tool (`stoa`) | 📋 Planned |
| Terraform Provider | 📋 Planned |
| GitOps Templates (ArgoCD) | 📋 Planned |
| Pre-built MCP Connectors | 📋 Planned |
| SDK (Python, TypeScript) | 📋 Planned |
| OpenAPI Import/Export | 📋 Planned |
| Postman/Insomnia Collections | 📋 Planned |
| Migration Adapters (Kong, webMethods) | 📋 Planned |

---

## ⚡ Q4 2026 — Performance & AI Gateway

**Theme: Native Gateway & AI Optimization**

| Feature | Status |
|---------|--------|
| Native Rust/eBPF Gateway | 📋 Planned |
| AI Gateway (LLM Cost Optimization) | 📋 Planned |
| Semantic Caching | 📋 Planned |
| Smart Routing (Model Selection) | 📋 Planned |
| Token Metering per Team/Project | 📋 Planned |
| Response Caching | 📋 Planned |

---

## 🔮 2027 & Beyond

**Theme: AI-Native Platform**

- **Agent Observability** — Trace AI agent workflows end-to-end
- **Policy as Code** — Define access policies in natural language
- **Marketplace** — Discover and share MCP tool configurations
- **Multi-Cloud** — Native support for AWS, GCP, Azure
- **Edge Deployment** — Global edge network
- **Euro Numérique** — CBDC integration (regulatory timeline dependent)

---

## Architecture Highlights

### Current Stack (MVP)

| Component | Technology |
|-----------|------------|
| Control Plane | FastAPI (Python) |
| Data Plane | webMethods Gateway |
| Authentication | Keycloak (OIDC) |
| Secrets | HashiCorp Vault |
| Database | PostgreSQL |
| Search | OpenSearch |
| Messaging | Kafka/Redpanda |
| Observability | Prometheus + Grafana + Loki |
| GitOps | ArgoCD |

### Future Stack (v1.0+)

| Component | Technology |
|-----------|------------|
| Data Plane | Native Rust + eBPF |
| AI Gateway | Semantic cache + Smart routing |

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

*Last updated: January 21, 2026*
