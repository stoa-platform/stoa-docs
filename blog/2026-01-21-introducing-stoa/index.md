---
slug: introducing-stoa
title: Introducing STOA Platform
authors: [christophe, stoa-team]
tags: [announcement, mcp]
---

# Introducing STOA Platform

We're excited to announce **STOA** — the API Gateway built for the AI era.

<!-- truncate -->

## Why STOA?

The rise of AI agents and the Model Context Protocol (MCP) has created new challenges for enterprise API management:

- **AI agents need secure access** to enterprise tools and data
- **Traditional API gateways** weren't designed for MCP traffic
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
- Q4 2026: Rust + eBPF high-performance gateway

## Get Started

- [Documentation](https://docs.gostoa.dev)
- [GitHub](https://github.com/stoa-platform)
- [Discord](https://discord.gg/j8tHSSes)

We're building in public and welcome contributions. Join us!

---

*The STOA Team*
