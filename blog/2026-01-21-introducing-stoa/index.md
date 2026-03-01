---
slug: introducing-stoa
title: "Introducing STOA: Open-Source AI-Native API Gateway"
authors: [christophe, stoa-team]
tags: [announcement, mcp]
description: "MCP support, multi-tenant isolation, and a developer portal for the enterprise AI era. Why we built STOA Platform and what makes it different."
keywords:
  - STOA platform
  - open source API gateway
  - AI-native API gateway
  - MCP gateway
  - API management platform
  - multi-tenant API gateway
  - Model Context Protocol
---

# Introducing STOA Platform

STOA Platform is an open-source, AI-native API gateway built for the Model Context Protocol (MCP) era. It bridges legacy APIs and AI agents with unified governance, European sovereignty, and zero vendor lock-in — all under Apache 2.0.

We're excited to announce **STOA** — an API Gateway built for the AI era.

<!-- truncate -->

## Why STOA?

The rise of AI agents and the Model Context Protocol (MCP) has created new challenges for enterprise API management:

- **AI agents need secure access** to enterprise tools and data
- **Traditional API gateways** were not originally designed for MCP traffic
- **Enterprises need governance** over how AI interacts with their systems

STOA bridges this gap by providing a unified platform for both traditional APIs and MCP-enabled AI agents.

## What is STOA?

STOA is a cloud-native, multi-tenant gateway platform that combines:

- **MCP Gateway** — Secure AI agent access to enterprise tools
- **API Gateway** — Traditional REST/GraphQL API management
- **Developer Portal** — Self-service API/tool discovery and subscription
- **Admin Console** — Centralized governance and monitoring

### Architecture

STOA follows a **Control Plane / Data Plane** separation:

```
Control Plane: Core API, Portal, Console
     ↓ config sync
Data Plane: MCP Gateway, webMethods Gateway
```

This architecture enables independent scaling and deployment of management vs. traffic components.

## Key Features

### For Developers

- Browse and subscribe to APIs and MCP tools
- Generate API keys with fine-grained scopes
- View usage dashboards and documentation

### For Platform Teams

- Multi-tenant isolation
- RBAC with 6 personas and 12 scopes
- 35 MCP tools for platform operations
- GitOps-native with ArgoCD support

### For Security Teams

- mTLS / OAuth2 / Hybrid security modes
- OPA policy engine integration
- Audit logging and compliance

## What's Next?

We're targeting **MVP release (v0.1.0) on February 26, 2026**.

Check out our [Roadmap](/docs/roadmap) for the full timeline, including:

- Q2 2026: Rate limiting, usage metering, audit logging
- Q3 2026: CLI tool, Terraform provider, SDKs
- Q4 2026: High-performance Rust gateway (planned)

## Get Started

- [Documentation](https://docs.gostoa.dev)
- [GitHub](https://github.com/stoa-platform)
- [Discord](https://discord.gostoa.dev)

We're building in public and welcome contributions. Join us!

---

## Frequently Asked Questions

### Is STOA free?

Yes, STOA is fully open source under Apache 2.0. There are no enterprise-only features or paywalls. Multi-tenancy, the developer portal, admin console, and all governance capabilities are included in the open-source distribution. Read more about our licensing philosophy in [Why Apache 2.0, Not BSL](/blog/why-apache-2-not-bsl).

### What makes STOA different from Kong or Envoy?

STOA is the first open-source gateway with native MCP support — the protocol that AI agents use to discover and invoke tools. While Kong and Envoy are excellent HTTP proxies, STOA is built from the ground up for multi-tenancy, European data sovereignty, and hybrid deployment models. See our detailed comparison in [Open Source API Gateway Guide 2026](/blog/open-source-api-gateway-2026).

### How do I get started?

The fastest way to try STOA is with our Docker Compose quick start. You can have a running instance with the gateway, portal, and console in under 15 minutes. Check out the [Quick Start Guide](/docs/guides/quickstart) for step-by-step instructions.

---

*The STOA Team*
