---
slug: stoa-vs-kong
title: "STOA vs Kong: Why We Built a New API Gateway for the AI Era"
authors: [christophe]
tags: [comparison, open-source]
description: "An honest comparison of STOA and Kong API gateways. Learn where Kong excels, where STOA excels, and why the AI era demands a new kind of API gateway — a Kong alternative built for MCP and multi-tenancy."
keywords: [Kong alternative, API gateway comparison, open source API gateway, MCP support, Kong vs STOA, AI API gateway, API management]
---

# STOA vs Kong: Why We Built a New API Gateway for the AI Era

If you are evaluating API gateways in 2026, Kong is almost certainly on your shortlist. It deserves to be. Kong is a mature, battle-tested platform with a massive plugin ecosystem and years of production deployments. So why did we build STOA as a **Kong alternative**? Not because Kong is bad — but because the problem has changed.

<!-- truncate -->

## Respect Where It Is Due

Before any comparison, let us be clear: Kong is an excellent API gateway. It pioneered the open-source API gateway space, built a thriving plugin ecosystem, and has proven itself at scale in thousands of organizations. If your needs are purely traditional REST/GraphQL API management, Kong remains a strong choice.

This article is not a hit piece. It is an honest assessment of where the two platforms diverge, written for teams evaluating their options as AI agents become a core part of enterprise architecture.

## The Problem Has Changed

When Kong was designed, the world of API management looked like this:

- **Consumers**: Human developers building web and mobile apps
- **Traffic**: REST and GraphQL over HTTP
- **Security**: OAuth2, API keys, rate limiting
- **Governance**: Developer portal, API versioning, deprecation policies

That world still exists. But a new layer has emerged:

- **Consumers**: AI agents (Claude, GPT, open-source LLMs) acting autonomously
- **Traffic**: Model Context Protocol (MCP) over JSON-RPC/SSE
- **Security**: Tool-level authorization, tenant isolation, agent audit trails
- **Governance**: Which agents can invoke which tools, in which context, with what data

Kong has responded to this shift — adding MCP proxy and OAuth2 plugins in Gateway 3.12 (October 2025), MCP ACLs in 3.13, and a dedicated MCP server for Konnect API discovery. But there is a difference between adding MCP support to an existing HTTP gateway and building an MCP-native gateway from the ground up. That difference is what STOA represents.

## The Comparison

Here is an honest, feature-by-feature comparison:

| Capability | Kong (OSS/Enterprise) | STOA |
|---|---|---|
| **REST/GraphQL proxying** | Excellent — mature, battle-tested | Good — standard reverse proxy capabilities |
| **Plugin ecosystem** | 100+ plugins (auth, transforms, logging) | Growing — focused on AI/MCP-specific plugins |
| **MCP protocol support** | Plugin-based — AI MCP Proxy + OAuth2 plugins (since Gateway 3.12) | Native — MCP is a first-class protocol in the gateway core |
| **Multi-tenancy** | Enterprise tier only (workspaces) | Built-in — CRD-based tenant isolation, all tiers |
| **AI agent authentication** | Possible via custom plugins | Native — JWT, API keys, mTLS with agent-aware context |
| **OPA policy engine** | Community plugin (limited maintenance) | First-class integration — embedded OPA evaluator |
| **Tool discovery & filtering** | N/A | Per-tenant tool catalogs with scope-based filtering |
| **Usage metering** | Enterprise tier (Vitals) | Built-in Kafka-based metering, all tiers |
| **Developer portal** | Kong Developer Portal (Enterprise) | Included — self-service portal with dark mode |
| **Admin console** | Kong Manager (Enterprise) | Included — full admin console with RBAC |
| **Deployment model** | Standalone or Kubernetes (Ingress Controller) | Kubernetes-native with 4 deployment modes |
| **License** | Apache 2.0 (OSS) / Proprietary (Enterprise) | Apache 2.0 (everything) |
| **Data sovereignty** | US-based company, cloud hosted in multiple regions | European-born, self-hosted or sovereign cloud |
| **Community maturity** | Large, established community since 2015 | Early-stage, growing community |
| **Production track record** | Thousands of deployments globally | Early production deployments |

## Where Kong Excels

Let us be specific about Kong's strengths:

### Mature Plugin Ecosystem

Kong's plugin architecture is its greatest asset. Need to transform request headers, inject correlation IDs, integrate with Datadog, or add IP restriction? There is probably a plugin for it. This ecosystem took years to build, and it represents real value for teams with complex API management needs.

### Battle-Tested at Scale

Kong handles billions of requests per day across its customer base. It has been through every edge case, every failure mode, every scaling challenge. That operational maturity is something that cannot be replicated overnight.

### Broad Protocol Support

Kong supports REST, GraphQL, gRPC, and WebSocket traffic out of the box. Its Ingress Controller mode makes it a natural fit for Kubernetes clusters that need a general-purpose API gateway.

### Community and Ecosystem

Kong's community is large and active. You will find answers on Stack Overflow, tutorials on YouTube, and consultants who specialize in Kong deployments. That ecosystem support matters when you are running infrastructure in production.

## Where STOA Excels

### MCP-Native Architecture

Both STOA and Kong support MCP — but the architectural approach differs fundamentally. Kong added MCP via plugins on its Nginx/Lua stack: the AI MCP Proxy plugin bridges MCP-to-HTTP, and the AI MCP OAuth2 plugin handles agent auth. These are solid additions.

STOA takes a different approach: MCP is a first-class protocol in the gateway core, not a plugin on top of an HTTP proxy. This means:

- **Tool discovery and filtering** are per-tenant by default, using Kubernetes CRDs — not per-route plugin configuration.
- **OPA policies** evaluate every tool invocation with full tenant, scope, and agent context.
- **Kafka-based metering** tracks usage per agent, per tool, per tenant — built into the core, not bolted on.
- **UAC (Universal API Contract)** lets you define an API once and expose it as REST, MCP, and GraphQL — Kong requires separate plugin configuration per protocol.

The difference is not "can it do MCP?" — both can. It is "was MCP a day-one architectural decision or a plugin added to an existing HTTP gateway?"

### Multi-Tenancy by Default

Kong's multi-tenancy (workspaces) is an Enterprise-tier feature. In STOA, multi-tenancy is foundational. Every API, every tool, every policy is tenant-scoped by default. Tenant isolation is enforced at the [Kubernetes CRD level](/docs/reference/crds/), which means it is impossible to accidentally leak tools across tenant boundaries.

### European Data Sovereignty

For organizations subject to GDPR, NIS2, or DORA, the legal jurisdiction of your API gateway matters. Kong is a US-based company. While they offer multi-region cloud deployments, the CLOUD Act means that US authorities can compel access to data processed by US companies, regardless of where the data is physically stored.

STOA is European-born and designed for [self-hosted deployment](/docs/deployment/hybrid). Your data never leaves your infrastructure. Read more about this in our article on [API management and European sovereignty](/blog/api-management-europe-sovereignty).

### Everything Included in Open Source

Kong splits its feature set between the open-source core and the proprietary Enterprise tier. Key features like the developer portal, admin GUI, RBAC, workspaces, and advanced analytics require a commercial license.

STOA is Apache 2.0 across the board. The developer portal, admin console, multi-tenancy, OPA integration, and metering are all open source. No feature gates, no enterprise-only capabilities.

## Migration Path: Kong to STOA

If you are currently running Kong and want to evaluate STOA, you do not need to rip and replace. STOA's [sidecar deployment mode](/docs/concepts/architecture) lets you run STOA alongside your existing Kong installation:

1. **Phase 1**: Deploy STOA in sidecar mode, routing only MCP traffic through it while Kong handles REST/GraphQL.
2. **Phase 2**: Gradually migrate API management to STOA's control plane as your team gains confidence.
3. **Phase 3**: Consolidate on a single platform when ready.

We have a detailed [Kong migration guide](/docs/guides/migration/kong) that walks through this process step by step, including how to map Kong plugins to STOA equivalents and how to migrate API key management.

## When to Choose What

**Choose Kong if:**
- You need a battle-tested gateway with a decade of production history.
- You rely heavily on specific Kong plugins with no equivalent elsewhere.
- Kong's plugin-based MCP support (AI MCP Proxy, MCP OAuth2) meets your needs.
- Your organization has existing Kong expertise and operational runbooks.

**Choose STOA if:**
- AI agents and MCP are part of your architecture (now or soon).
- Multi-tenancy is a requirement, and you do not want to pay for Enterprise tier.
- European data sovereignty and compliance (NIS2, DORA) are priorities.
- You want a single platform that handles both traditional APIs and AI agent traffic.

**Consider both if:**
- You want to keep Kong for existing REST APIs and add STOA specifically for MCP gateway capabilities (sidecar mode).

## The Bigger Picture

The API gateway market is at an inflection point. The last major shift was from hardware appliances (F5, NGINX Plus) to cloud-native software gateways (Kong, Envoy, Traefik). The next shift is from HTTP-only gateways to protocol-aware AI gateways that understand MCP, manage agent identities, and enforce AI-specific policies.

We built STOA because we believe the AI-native use case benefits from a purpose-built foundation — where MCP, multi-tenancy, and legacy gateway orchestration are core architectural decisions, not additions to an HTTP proxy. Kong is a worthy competitor that has moved fast on AI. We differentiate on architecture, sovereignty, and the UAC "define once, expose everywhere" model.

## Try STOA

See the difference for yourself:

- **[Quickstart Guide](/docs/guides/quickstart)** — Running instance in 15 minutes.
- **[API Gateway Patterns](/docs/guides/fiches/api-gateway-patterns)** — Deep dive into architectural patterns.
- **[Kong Migration Guide](/docs/guides/migration/kong)** — Step-by-step migration path.
- **[Console](https://console.gostoa.dev)** — Explore the admin interface.

---

*Evaluating API gateways for your AI strategy? [Start with the quickstart](/docs/guides/quickstart) and see how STOA handles both traditional APIs and MCP traffic in a single platform.*
