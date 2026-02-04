---
sidebar_position: 1
---

# Getting Started with STOA

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

Get up and running with STOA in 5 minutes:

```bash
# See Quick Start Guide for installation options
# → Console UI: https://console.gostoa.dev
# → API: https://api.gostoa.dev/v1
# → MCP Gateway: https://mcp.gostoa.dev
```

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

