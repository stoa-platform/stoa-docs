---
slug: what-is-mcp-gateway
title: "What is an MCP Gateway? The Missing Piece for AI Agent Security"
authors: [christophe]
tags: [mcp, ai, architecture]
description: "Discover what an MCP gateway is and why AI agents need one. Security, governance, audit trails, and production deployment for enterprise AI."
keywords: [MCP gateway, Model Context Protocol, AI API gateway, MCP server, AI agent security, API gateway for AI, AI governance, enterprise AI]
---

<!-- last verified: 2026-02 -->

# What is an MCP Gateway? The Missing Piece for AI Agent Security

As AI agents move from demos to production, enterprises face a critical question: how do you give an LLM secure, governed access to your internal tools and data? The answer is an **MCP gateway** — a new category of infrastructure that sits between AI agents and the services they consume, enforcing security, observability, and policy at every interaction.

<!-- truncate -->

## The Model Context Protocol, Explained

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) is an open standard introduced by Anthropic in late 2024. It defines how AI agents discover, authenticate with, and invoke external tools. Think of it as "OpenAPI for AI agents" — a structured way for an LLM to call a function, read a resource, or receive a prompt template from an external server.

An **MCP server** exposes tools (functions an agent can call), resources (data an agent can read), and prompts (reusable templates). An **MCP client** — typically an AI agent or orchestration framework — connects to one or more MCP servers to extend its capabilities.

The protocol itself is elegant. But deploying raw MCP servers directly into production is like exposing a database port to the internet: technically possible, dangerously naive.

## Why AI Agents Need a Gateway

Traditional API gateways handle REST and GraphQL traffic with mature patterns: rate limiting, authentication, routing, observability. But MCP traffic is fundamentally different:

- **Tool discovery is dynamic.** Agents enumerate available tools at runtime, not at deploy time.
- **Invocations are context-dependent.** The same tool call can have vastly different security implications depending on the agent's context window.
- **Multi-tenancy is critical.** Different teams, different agents, different tool access — all on the same infrastructure.
- **Compliance is non-negotiable.** Enterprises need audit trails of every tool invocation, who requested it, and what data was accessed.

A raw MCP server has none of these capabilities. An MCP gateway provides them all.

### What an MCP Gateway Does

An MCP gateway is a reverse proxy and policy enforcement point purpose-built for Model Context Protocol traffic. It intercepts every interaction between an AI agent and the MCP servers behind it, applying:

| Capability | What It Solves |
|---|---|
| **Authentication** | JWT, API key, or mTLS validation before any tool invocation |
| **Authorization** | OPA-based policies controlling which tenants can invoke which tools |
| **Rate limiting** | Preventing runaway agents from overwhelming backend services |
| **Audit logging** | Full trace of every tool call, resource read, and prompt expansion |
| **Tool filtering** | Exposing only approved tools per tenant, hiding internal-only operations |
| **Observability** | Metrics, distributed tracing, and usage metering per agent and per tool |

## The Architecture: Gateway Between Agents and Tools

Here is how an MCP gateway fits into a typical enterprise deployment:

```
AI Agents (Claude, GPT, Custom)
         |
         | MCP Protocol (JSON-RPC over SSE/HTTP)
         v
  +-----------------+
  |   MCP Gateway   |  <-- Auth, Policy, Metering, Routing
  +-----------------+
     |       |       |
     v       v       v
  [Tool A] [Tool B] [Tool C]   <-- MCP Servers (internal services)
```

The gateway is the single entry point. Agents never talk directly to MCP servers. This is the same pattern that made API gateways essential for microservices — applied to the AI agent layer.

## How STOA Implements the MCP Gateway

STOA's [MCP Gateway](/docs/concepts/mcp-gateway) is built from the ground up for production MCP traffic. While other gateways like Kong have added MCP support via plugins (AI MCP Proxy, MCP OAuth2 since Gateway 3.12), STOA treats MCP as a first-class protocol in the gateway core. Key design decisions include:

### OPA Policy Engine Integration

Every tool invocation passes through an [Open Policy Agent (OPA)](https://www.openpolicyagent.org/) evaluation. Policies are written in Rego and can enforce rules like:

- Tenant A can only invoke tools in the `analytics` namespace.
- The `delete-user` tool requires an additional approval scope.
- Agents running in the `staging` environment cannot access production data tools.

This is not simple RBAC — it is attribute-based access control (ABAC) that can evaluate any combination of tenant, tool, scope, environment, and request context.

### Multi-Tenant Tool Isolation

STOA's gateway enforces strict tenant isolation using Kubernetes CRDs. Each tenant sees only the tools they have been granted access to. Tool definitions are [Kubernetes Custom Resources](/docs/reference/crds/) that can be managed via GitOps, CLI, or the admin console.

### Kafka-Based Metering

Every tool invocation generates a metering event published to Kafka. This powers usage dashboards, billing, and anomaly detection. If an agent suddenly starts making 10x more tool calls than usual, you will know immediately.

### Four Operating Modes

STOA's gateway supports [four deployment modes](/docs/concepts/architecture):

1. **Edge-MCP** — The gateway is the front door for all MCP traffic (current default).
2. **Sidecar** — Deployed alongside existing API gateways for gradual adoption.
3. **Proxy** — Transparent pass-through with policy enforcement.
4. **Shadow** — Mirror traffic for testing without affecting production.

This flexibility lets enterprises adopt MCP governance incrementally, without a rip-and-replace migration.

## MCP Gateway vs. Exposing Raw MCP Servers

To make the distinction concrete:

| Concern | Raw MCP Server | MCP Gateway |
|---|---|---|
| Authentication | None (or DIY) | JWT, API keys, mTLS |
| Authorization | None | OPA policies per tenant, tool, and scope |
| Multi-tenancy | Single-tenant only | Full tenant isolation with CRDs |
| Audit trail | Application logs (maybe) | Structured audit events per invocation |
| Rate limiting | None | Per-tenant, per-tool quotas |
| Tool discovery | All tools visible to all clients | Filtered per tenant and scope |
| Observability | Prometheus scrape (maybe) | Metrics, tracing, metering built-in |
| Deployment | Each server exposed individually | Single gateway endpoint, many backends |

The difference is the same as exposing a PostgreSQL port publicly vs. putting an API in front of it. The gateway is the API layer for your AI agent infrastructure.

## When Do You Need an MCP Gateway?

You need an MCP gateway as soon as:

- **More than one team** needs AI agent access to internal tools.
- **Compliance requirements** mandate audit trails for AI interactions (NIS2, DORA, SOC 2).
- **Multiple AI providers** (Claude, GPT, open-source models) need to share the same tool infrastructure.
- **You are moving from POC to production** and need governance that scales.

If you are still in the experimentation phase with a single developer running a single MCP server, you can start without a gateway. But the moment you need multi-tenancy, security, or compliance, the gateway becomes non-negotiable.

## Getting Started with STOA's MCP Gateway

STOA is open-source (Apache 2.0) and designed for self-hosted or cloud deployment. You can go from zero to a working MCP gateway in under 15 minutes:

1. **[Quickstart Guide](/docs/guides/quickstart)** — Docker Compose setup with a working MCP gateway, portal, and console.
2. **[MCP Gateway Concepts](/docs/concepts/mcp-gateway)** — Deep dive into architecture, policy engine, and tool management.
3. **[Console](https://console.gostoa.dev)** — Try the hosted version to explore the admin interface.

The MCP gateway is the infrastructure layer that makes AI agents enterprise-ready. As more organizations move from AI experiments to production deployments, this is the piece that will separate governed, secure AI operations from the next generation of shadow IT.

## Frequently Asked Questions

### What is the difference between an MCP gateway and an API gateway?

An MCP gateway is purpose-built for AI agent traffic and the Model Context Protocol, while traditional API gateways focus on REST/GraphQL. MCP gateways handle dynamic tool discovery, context-dependent invocations, and AI-specific patterns like streaming and token optimization. Traditional gateways like Kong have added MCP support via plugins, but STOA treats MCP as a first-class protocol in the gateway core. See our [2026 API Gateway Comparison](/blog/open-source-api-gateway-2026) for detailed technical differences.

### Do I need an MCP gateway for Claude or GPT?

If you're using Claude or GPT in isolation with public APIs, no. But if you want to give AI agents secure access to your internal tools, enforce policies, track usage, or support multiple tenants, then yes. The MCP gateway sits between the AI agent and your backend systems, providing authentication, authorization, audit logging, and rate limiting. Learn more in [Connecting AI Agents to Enterprise APIs](/blog/connecting-ai-agents-enterprise-apis).

### Is STOA's MCP gateway open source?

Yes. STOA Platform is Apache 2.0 licensed, including the MCP gateway component. You can deploy it on your own infrastructure, modify it, and use it commercially without restrictions. We chose Apache 2.0 over business source licenses to avoid lock-in and enable community contributions. Read our reasoning in [Why Apache 2.0, Not BSL](/blog/why-apache-2-not-bsl).

## Related Articles

Explore more about MCP gateways and AI agent infrastructure:

- [ESB is Dead, Long Live MCP](/blog/esb-is-dead-long-live-mcp) — How the Model Context Protocol replaces traditional integration middleware
- [Connecting AI Agents to Enterprise APIs](/blog/connecting-ai-agents-enterprise-apis) — Patterns for secure AI agent integration
- [MCP Gateway Quickstart with Docker](/blog/mcp-gateway-quickstart-docker) — Deploy a working MCP gateway in 10 minutes
- [MCP Protocol Deep Dive](/blog/mcp-protocol-architecture-deep-dive) — Architecture, message flow, and transport layers
- [AI Agent Security: 5 Authentication Patterns](/blog/ai-agent-security-authentication-patterns) — OAuth2, mTLS, API keys, token exchange, and certificate binding
- [Convert REST APIs to MCP Tools](/blog/convert-rest-api-to-mcp-tools) — Step-by-step guide to exposing your APIs to AI agents
- [MCP vs OpenAI Function Calling vs LangChain Tools](/blog/mcp-vs-openai-function-calling-vs-langchain) — Which approach should you use?

---

*Ready to secure your AI agent infrastructure? [Start with the quickstart guide](/docs/guides/quickstart) or [explore the MCP gateway documentation](https://docs.gostoa.dev/docs/concepts/mcp-gateway).*
