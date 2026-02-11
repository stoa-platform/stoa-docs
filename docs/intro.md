---
sidebar_position: 1
title: "STOA Platform Documentation"
description: "Get started with STOA — the open-source AI-native API gateway for MCP, multi-tenant isolation, and enterprise API modernization."
keywords: [STOA, API gateway, MCP, documentation, getting started, open source]
---

# Getting Started with STOA

:::info Early Access — Private Beta
STOA Platform is currently in private beta. [Request access](mailto:christophe@hlfh.io) to get started, or explore the [Architecture Overview](/docs/concepts/architecture) and [Enterprise Use Cases](/docs/use-cases) to learn more.
:::

Welcome to **STOA Platform** — an AI-native API management platform for MCP and enterprise workloads.

STOA is a modern, cloud-native API management platform built on Kubernetes, designed for multi-tenant environments with GitOps-first architecture.

## What is STOA?

STOA provides:

- **Multi-tenant API Gateway** - Isolated namespaces per tenant with MCP Gateway routing
- **GitOps-Driven Configuration** - All configuration managed through ArgoCD + AWX
- **Authentication & Authorization** - Integrated Keycloak for OIDC/OAuth2
- **MCP Gateway Support** - Native support for Model Context Protocol
- **Developer Portal** - Self-service API discovery and subscription management

## Quick Start

Once you have beta access, you can interact with STOA in three ways:

| Path | URL | Best For |
|------|-----|----------|
| **Console UI** | [console.gostoa.dev](https://console.gostoa.dev) | Visual management, API catalog |
| **REST API** | [api.gostoa.dev/v1](https://api.gostoa.dev/v1) | Automation, CI/CD |
| **MCP Gateway** | [mcp.gostoa.dev](https://mcp.gostoa.dev) | AI agents (Claude, GPT) |

See the [Quickstart Guide](/docs/guides/quickstart) for a step-by-step walkthrough.

## Architecture Overview

STOA consists of several key components:

- **Control Plane** - API management and orchestration
- **Data Plane** - MCP Gateway per tenant (with optional webMethods adapter for legacy APIs)
- **Auth Layer** - Keycloak for identity management
- **GitOps Engine** - ArgoCD + AWX for declarative configuration
- **MCP Gateway** - Model Context Protocol support

## Next Steps

- [Architecture Overview](/docs/concepts/architecture) - Understand STOA's architecture
- [Quick Start Guide](/docs/guides/quickstart) - Deploy your first tenant
- [Authentication Setup](/docs/guides/authentication) - Configure Keycloak OIDC
- [API Reference](/docs/api/control-plane) - Explore the Control Plane API

