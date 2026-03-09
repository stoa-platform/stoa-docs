---
sidebar_position: 1
title: "STOA Platform Documentation"
description: "Get started with STOA — the open-source AI-native API gateway for MCP, multi-tenant isolation, and enterprise API modernization."
keywords: [STOA, API gateway, MCP, documentation, getting started, open source, AI gateway, Model Context Protocol]
---

# Getting Started with STOA

:::info Early Access — Private Beta
STOA Platform is currently in private beta. [Request access](mailto:christophe@hlfh.io) to get started, or explore the [Architecture Overview](/docs/concepts/architecture) and [Enterprise Use Cases](/docs/use-cases) to learn more.
:::

Welcome to **STOA Platform** — an open-source, AI-native API management platform designed for the MCP era.

STOA bridges traditional APIs and AI agents through the [Model Context Protocol (MCP)](/docs/concepts/mcp-gateway), enabling Claude, GPT, and other AI agents to discover and call your APIs automatically — with full governance, tenant isolation, and audit trails.

## What is STOA?

STOA is a cloud-native API gateway and management platform built on Kubernetes. It combines the features of a traditional API gateway with native support for AI agent protocols:

- **MCP Gateway** — AI agents discover and invoke your APIs via the Model Context Protocol, with automatic schema generation and tool registration
- **Multi-Tenant Isolation** — Each tenant gets its own Kubernetes namespace, Keycloak realm, and database schema for complete data separation
- **GitOps-First Configuration** — All API definitions, policies, and tenant configurations managed declaratively through Git and ArgoCD
- **OIDC/OAuth2 Authentication** — Integrated Keycloak for standards-based identity federation, supporting LDAP, SAML, and social providers
- **Developer Portal** — Self-service API discovery, documentation browsing, and subscription management for developers and API consumers
- **Enterprise Observability** — Prometheus metrics, Grafana dashboards, and OpenSearch for logs and error snapshots — all built-in

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                    CONTROL PLANE (Cloud)                      │
│                                                              │
│   Console    Portal     API       Auth       Observability   │
│   (React)   (React)  (FastAPI) (Keycloak)  (Grafana+Prom)  │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │  orchestrates
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    DATA PLANE (On-Premise or Cloud)           │
│                                                              │
│   STOA Gateway (Rust)          Legacy Adapters               │
│   • MCP Protocol               • webMethods                  │
│   • REST Proxy                  • Kong                       │
│   • Rate Limiting               • Gravitee                   │
│   • mTLS                        • Apigee                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The **Control Plane** handles API catalog management, authentication, and observability. The **Data Plane** runs your gateway (Rust-based STOA Gateway or a sidecar alongside existing gateways) close to your APIs.

## Quick Start

Once you have beta access, you can interact with STOA in three ways:

| Path | URL | Best For |
|------|-----|----------|
| **Console UI** | [console.gostoa.dev](https://console.gostoa.dev) | Visual management, API catalog, observability |
| **REST API** | [api.gostoa.dev/v1](https://api.gostoa.dev/v1) | Automation, CI/CD pipelines, scripting |
| **MCP Gateway** | [mcp.gostoa.dev](https://mcp.gostoa.dev) | AI agents (Claude, GPT, custom agents) |

See the [Quickstart Guide](/docs/guides/quickstart) for a step-by-step walkthrough.

## Key Differentiators

| Feature | Traditional Gateway | STOA |
|---------|-------------------|------|
| AI Agent Support | Not designed for it | Native MCP Gateway |
| API Discovery | Manual documentation | Auto-discovery via MCP |
| First API Call | Days to weeks | Seconds (with MCP) |
| Tenant Isolation | Shared infrastructure | Namespace-level isolation |
| Configuration | GUI or imperative API | GitOps-first (ArgoCD) |
| Hosting | Vendor-managed | Self-hosted, EU-ready |
| License | Proprietary | Apache 2.0 |

## Who is STOA For?

- **Platform teams** modernizing legacy API gateways (webMethods, DataPower, Oracle OAM)
- **Enterprise architects** building multi-tenant API platforms with strong isolation
- **AI/ML teams** connecting AI agents to enterprise APIs through MCP
- **Regulated industries** (finance, healthcare, government) needing European data sovereignty and NIS2/DORA supportive features

## Next Steps

- [Tutorials](/docs/tutorials) — Hands-on guides: expose a REST API as MCP tool, self-service subscription, Oracle OAM bridge
- [Architecture Overview](/docs/concepts/architecture) — Understand STOA's component architecture
- [Quick Start Guide](/docs/guides/quickstart) — Deploy your first tenant and register an API
- [Authentication Setup](/docs/guides/authentication) — Configure Keycloak OIDC
- [MCP Gateway Concepts](/docs/concepts/mcp-gateway) — Learn how AI agents interact with STOA
- [Migration Guides](/docs/guides/migration) — Migrate from webMethods, Kong, Apigee, or Oracle OAM
- [API Reference](/docs/api/control-plane) — Explore the Control Plane API
