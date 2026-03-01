---
slug: kong-vs-stoa-mcp-gateway
title: "Kong vs STOA: MCP Gateway Comparison for AI Agents"
authors: [stoa-team]
tags: [comparison, mcp, ai, api-gateway]
description: "Kong lacks native MCP support. We benchmark both gateways on tool discovery, OAuth 2.1 PKCE, SSE transport, and AI agent governance."
keywords:
  - Kong MCP gateway
  - Kong vs STOA MCP
  - MCP API gateway comparison
  - AI agent gateway 2026
  - Kong AI MCP proxy
  - MCP tool discovery
  - Kong MCP plugin
  - API gateway for AI agents
  - Model Context Protocol gateway
  - enterprise MCP gateway
---

<!-- last verified: 2026-02 -->

Kong and STOA both support the Model Context Protocol, but they approach it from opposite directions. Kong added MCP via plugins on its proven Nginx/Lua stack. STOA built MCP into the gateway core from day one. This article compares the two specifically on MCP capabilities — tool discovery, transport, authentication, governance, and agent workflow support — so you can choose the right MCP gateway for your AI agent architecture.

<!-- truncate -->

:::info Related Articles
For a general comparison of STOA and Kong (multi-tenancy, licensing, sovereignty), see [STOA vs Kong: API Gateway for the AI Era](/blog/stoa-vs-kong). For MCP protocol fundamentals, see [MCP Protocol Deep Dive](/blog/mcp-protocol-architecture-deep-dive). For a broader gateway landscape, see [Open Source API Gateway Guide 2026](/blog/open-source-api-gateway-2026).
:::

## MCP Support at a Glance

Both gateways can proxy MCP traffic. The difference lies in how deeply MCP is integrated into the gateway's architecture.

| MCP Capability | Kong (Gateway 3.12+) | STOA |
|---|---|---|
| **MCP transport** | HTTP proxy via AI MCP Proxy plugin | Native SSE + JSON-RPC in gateway core |
| **Tool discovery** | Konnect-based API catalog (Enterprise) | Per-tenant CRD-based tool catalogs |
| **OAuth 2.1 for agents** | AI MCP OAuth2 plugin + standard OAuth2 plugin | Native OAuth 2.1 with PKCE, DCR scope stripping |
| **Tool-level authorization** | MCP ACL plugin (since 3.13) | OPA policy engine — per-tool, per-tenant, per-scope |
| **Agent identity** | Standard consumer identity | Agent-aware JWT context injection |
| **Usage metering** | Vitals (Enterprise) or Prometheus plugin | Built-in Kafka metering per agent, per tool, per tenant |
| **Protocol negotiation** | N/A (HTTP proxy) | MCP version negotiation (2025-03-26 / 2025-11-25) |
| **mTLS for agents** | Standard mTLS plugin | mTLS with OAuth bypass paths for MCP discovery |
| **Skill context injection** | N/A | Native `X-Skill-Context` header injection |
| **UAC (define once, expose everywhere)** | N/A | REST + MCP + GraphQL from single API definition |

## Tool Discovery

How AI agents find available tools is the starting point of every MCP interaction.

### Kong's Approach

Kong added an MCP server for its Konnect control plane (cloud-hosted API management). When connected to Konnect, AI agents can discover APIs registered in the service catalog. For self-hosted Kong (no Konnect), tool discovery relies on the agent knowing the tool endpoints in advance — there is no built-in discovery mechanism in the open-source gateway.

The AI MCP Proxy plugin routes MCP requests to upstream MCP servers. It handles the HTTP proxying well but does not add a discovery layer on top. You configure routes per MCP server, and agents must know which route to hit.

### STOA's Approach

STOA uses Kubernetes CRDs (`Tool` and `ToolSet`) as the tool catalog. Each tenant gets a filtered view of available tools based on their scopes and namespace. An AI agent connecting via MCP's SSE transport receives only the tools it is authorized to see — no over-fetching, no manual route configuration.

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: weather-api
  namespace: tenant-acme
spec:
  displayName: Weather Lookup
  description: Get current weather for a city
  endpoint: https://api.weather.example/v1/current
  method: GET
  scopes: ["stoa:read"]
```

The gateway resolves these CRDs at runtime. When a new tool is added to a tenant's namespace, agents discover it on their next `tools/list` call without any gateway restart or configuration reload.

### Key Difference

Kong's discovery works at the control plane level (Konnect), requiring an Enterprise subscription for the full experience. STOA's discovery is built into the open-source gateway via Kubernetes CRDs — no commercial tier required.

## Authentication and Authorization

MCP introduces new auth challenges: AI agents are not human developers. They need automated credential flows (no browser redirects) with fine-grained tool-level permissions.

### Kong's Approach

Kong's AI MCP OAuth2 plugin provides OAuth 2.0 flows for MCP connections. Combined with the standard OAuth2 plugin and the new MCP ACL plugin (Gateway 3.13), you can control which consumers access which MCP routes. The ACL plugin supports allow/deny lists per MCP server route.

This is a solid approach that leverages Kong's mature plugin system. The limitation is granularity: ACLs operate at the route level (which MCP server), not at the tool level (which specific tool within a server).

### STOA's Approach

STOA implements OAuth 2.1 with PKCE natively in the gateway, including automated Dynamic Client Registration (DCR). When an AI agent (such as Claude) connects:

1. The agent discovers OAuth metadata via RFC 9728 (`/.well-known/oauth-protected-resource`)
2. DCR creates a public client with PKCE automatically
3. The gateway strips problematic scopes from DCR payloads (preventing Keycloak default scope replacement)
4. Every tool invocation passes through OPA with full context: tenant, scopes, agent identity, and tool metadata

Authorization is per-tool, not per-route. An agent might have `stoa:read` scope (allowing read-only tools) but not `stoa:write` — this is enforced at every `tools/call` invocation by OPA, not at the MCP connection level.

### Key Difference

Kong authorizes at the route/server level via plugins. STOA authorizes at the individual tool invocation level via OPA policies. For architectures where different tools within the same MCP server require different permission levels, STOA's approach provides finer granularity without additional plugin configuration.

## Transport and Protocol

### Kong's Approach

The AI MCP Proxy plugin operates as an HTTP reverse proxy. MCP traffic is proxied as standard HTTP requests to upstream MCP servers. This works well for HTTP-based MCP transports but does not participate in the MCP protocol itself — Kong does not parse or understand the JSON-RPC messages flowing through it.

### STOA's Approach

STOA's gateway understands the MCP protocol natively. It parses JSON-RPC messages, manages SSE connections, and handles protocol version negotiation. This means the gateway can:

- **Filter tool lists** per tenant before they reach the agent (not just proxy the upstream's full list)
- **Inject context** into tool calls (`X-Skill-Context` headers, JWT claims)
- **Meter per tool invocation** with structured data (which agent called which tool, with what parameters, at what cost)
- **Negotiate protocol versions** between agents expecting different MCP spec versions

The trade-off is clear: Kong's proxy approach is simpler and works with any upstream MCP server without modification. STOA's native approach adds a processing layer but enables richer governance.

## Agent Workflow Support

Modern AI agent architectures involve multi-step workflows: an agent discovers tools, selects the right one, calls it with context, and uses the result to decide the next action. The gateway's role in this workflow determines how much control you have over agent behavior.

### Kong

Kong focuses on the proxy layer. It routes MCP requests reliably, applies rate limits and authentication, and logs traffic. The agent workflow logic lives in the agent framework (LangChain, CrewAI, AutoGen) — Kong does not participate in or influence tool selection.

### STOA

STOA participates in the workflow at the governance level:

- **Skill context injection**: When an agent calls a tool, STOA can inject additional context (`_skill_context` parameter) providing the agent with relevant configuration, history, or constraints
- **Tool allow-listing**: Administrators define which tools a tenant's agents can use — the agent never sees disallowed tools
- **Per-tool rate limiting**: Different rate limits per tool (a search tool might allow 100 calls/minute while a write tool allows 10)
- **Audit trails**: Every tool invocation is logged with full context (agent identity, tool, parameters, response) to Kafka for compliance

## When to Choose What

**Choose Kong for MCP if:**
- You already run Kong and want to add basic MCP proxying without changing your stack.
- Your MCP needs are straightforward: proxy MCP traffic to upstream servers, apply standard auth.
- You use Konnect (Enterprise) and want API catalog-based tool discovery for agents.
- Route-level ACLs are sufficient for your authorization model.
- You value Kong's mature plugin ecosystem for non-MCP concerns (transforms, logging, caching).

**Choose STOA for MCP if:**
- MCP is a primary protocol in your architecture, not an add-on to existing REST management.
- You need per-tool authorization (OPA policies) beyond route-level ACLs.
- Multi-tenant tool isolation is required (different tenants see different tool catalogs).
- You want protocol-aware governance: tool filtering, context injection, per-tool metering.
- You prefer open-source tool discovery (CRDs) over a commercial control plane.
- European data sovereignty is a requirement for your MCP traffic.

**Consider both (sidecar mode) if:**
- Kong handles your REST/GraphQL traffic and you want STOA specifically for MCP governance.
- You want to evaluate STOA's MCP capabilities alongside your existing Kong deployment.

## MCP Ecosystem Context

Both Kong and STOA are part of a broader MCP ecosystem. For context on how MCP compares to other AI agent integration approaches, see [MCP vs Function Calling vs LangChain](/blog/mcp-vs-openai-function-calling-vs-langchain). For a hands-on tutorial on building MCP tools, see [Convert REST APIs to MCP Tools](/blog/convert-rest-api-to-mcp-tools).

The MCP protocol is evolving rapidly. Kong's plugin approach allows them to iterate quickly on MCP support as the spec changes. STOA's native approach means protocol updates require gateway releases but ensures deeper integration. Both strategies have merit — the right choice depends on whether MCP is a primary concern or one of many protocols your gateway handles.

---

## FAQ

### Does Kong support MCP natively?

Kong supports MCP through plugins, not natively in its gateway core. The AI MCP Proxy plugin (Gateway 3.12+) proxies MCP traffic, and the AI MCP OAuth2 plugin handles agent authentication. These plugins work well for standard MCP proxying but operate at the HTTP layer rather than parsing MCP protocol messages.

### Can I run Kong and STOA together?

Yes. STOA's sidecar deployment mode is designed for this exact scenario. Route MCP traffic to STOA while Kong continues handling REST and GraphQL. See the [Kong migration guide](/docs/guides/migration/kong) for step-by-step setup.

### Which gateway is better for MCP tool discovery?

It depends on your infrastructure. Kong offers tool discovery through Konnect (Enterprise control plane). STOA offers tool discovery through Kubernetes CRDs (open-source, self-hosted). If you already use Konnect, Kong's discovery integrates seamlessly. If you run self-hosted Kubernetes, STOA's CRD-based discovery requires no commercial subscription.

### Is MCP support stable in both gateways?

Kong added MCP support in Gateway 3.12 (October 2025) with continued improvements in 3.13. STOA has had MCP as a core protocol since its first release. Both implementations are production-ready but the MCP protocol itself is still evolving (current spec: 2025-03-26, with 2025-11-25 in draft).

### How do rate limits work for MCP in each gateway?

Kong applies rate limits at the route level using its standard Rate Limiting plugin. STOA supports per-tool rate limits — different tools within the same MCP connection can have different limits, enforced by OPA policies and tracked via Kafka metering.

---

*Evaluating MCP gateways for your AI agent infrastructure? [Try the STOA quickstart](/docs/guides/quickstart) to see MCP tool discovery, OAuth 2.1, and per-tool governance in action.*

> **Disclaimer:** Feature comparisons are based on publicly available documentation as of February 2026. Product capabilities change frequently. We encourage readers to verify current features directly with each vendor. All trademarks belong to their respective owners.
