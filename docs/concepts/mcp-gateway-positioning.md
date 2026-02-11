---
sidebar_position: 4
title: MCP Gateway Positioning
description: "Clarify what STOA MCP Gateway manages vs AI providers — tool governance, not token billing."
keywords: [STOA, MCP Gateway, positioning, AI agents, governance, billing, concepts]
---

# MCP Gateway Positioning

A common question when evaluating STOA: **"How does this relate to AI provider billing? Aren't tokens already managed by Claude/OpenAI?"**

This page clarifies exactly what STOA MCP Gateway manages and its relationship to AI providers.

## The Two Layers

| Layer | Who Manages | What's Measured | Billing Model |
|-------|-------------|-----------------|---------------|
| **AI Provider** | Anthropic, OpenAI, etc. | Tokens consumed | Pay per token |
| **MCP Gateway (STOA)** | Your organization | Tool invocations | Pay per request |

:::tip Key Insight
**These are different things.** STOA doesn't re-bill tokens — STOA bills **tool invocations** and provides **governance**.
:::

## What STOA MCP Gateway Does

### 1. Governance & Policy Enforcement

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent (Claude)                     │
│                          │                               │
│                    calls tool                            │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │              STOA MCP Gateway                    │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │    │
│  │  │   OPA   │  │  Audit  │  │  Rate Limiting  │  │    │
│  │  │ Policies│  │  Trail  │  │   per tenant    │  │    │
│  │  └─────────┘  └─────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                    forwards to                           │
│                          ▼                               │
│                   Backend Service                        │
└─────────────────────────────────────────────────────────┘
```

- **OPA Policies**: Fine-grained authorization per tool, per user, per tenant
- **Audit Trail**: Complete log of who called what tool, when, with what parameters
- **Rate Limiting**: Control usage per team, per application, per user

### 2. Multi-Tenancy & Isolation

- **Tenant Isolation**: Each team/department sees only their authorized tools
- **Quotas**: Set limits per tenant (e.g., "Marketing team: 10,000 calls/month")
- **Dashboards**: Usage analytics per team, cost allocation

### 3. Unified Catalog

```
┌─────────────────────────────────────────┐
│           STOA Developer Portal          │
├─────────────────────────────────────────┤
│  REST APIs        │    MCP Tools         │
│  ────────────     │    ──────────        │
│  • Payment API    │    • create_invoice  │
│  • User API       │    • search_orders   │
│  • Product API    │    • generate_report │
└─────────────────────────────────────────┘
         Same portal, same subscription,
              same governance
```

### 4. Developer Experience

- **Subscribe**: One-click subscription to tools
- **Test**: Try tools directly from the portal
- **Monitor**: Real-time usage, latency, error rates
- **API Keys**: Secure key management with 2FA

## What STOA Does NOT Do

:::danger Not in Scope
These are explicitly **not** part of STOA's value proposition:
:::

| ❌ We Don't | Why |
|-------------|-----|
| Re-bill Claude/OpenAI tokens | That's the AI provider's job |
| Intercept LLM responses | Privacy concern, adds latency |
| Create a "Claude API wrapper" | No value-add, just complexity |
| Count tokens in responses | Already done by the provider |

## The Value Equation

**Without STOA MCP Gateway:**
- AI agents call tools directly
- No visibility into usage
- No governance
- No multi-tenant isolation
- Each team manages their own tool access

**With STOA MCP Gateway:**
- Centralized tool catalog
- Policy-as-Code governance
- Complete audit trail
- Usage analytics & cost allocation
- Self-service developer portal

## Summary

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   AI Provider (Claude, OpenAI, etc.)                     │
│   └── Manages: Tokens, reasoning, generation             │
│   └── Bills: Per token consumed                          │
│                                                          │
│   STOA MCP Gateway                                       │
│   └── Manages: Tool access, governance, multi-tenancy    │
│   └── Bills: Per tool invocation (optional)              │
│                                                          │
│   Your Backend Services                                  │
│   └── Execute: Business logic, data access               │
│   └── Own: Your data, your APIs                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**STOA is the governance layer between AI agents and your enterprise tools.**
