---
title: "ADR-048: Integrated Chat Agent Architecture"
description: "Decides that STOA embeds a browser-based chat agent in the Developer Portal, powered by Anthropic's Messages API with dynamic MCP tool injection, per-tenant API keys, and token metering."
keywords: [chat agent, Anthropic, Messages API, MCP tools, portal, token metering, conversation history, tool injection]
---

# ADR-048: Integrated Chat Agent Architecture

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Date** | 2026-02-17 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-284 |
| **Council** | 8.00/10 Go |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — edge-mcp mode serves tools to the chat agent
- **ADR-043**: Kafka MCP Event Bridge — token metering events flow through Kafka
- **ADR-044**: MCP OAuth 2.1 Gateway Proxy — chat backend authenticates to gateway via OAuth
- **ADR-046**: MCP Federation Architecture — chat-originated tool calls respect sub-account policies
- **ADR-047**: MCP Skills System — skills context injected into chat tool execution

## Context

STOA provides enterprise-grade MCP tool access through the gateway, but users today must configure an external MCP client (Claude Desktop, custom Python scripts, or IDE extensions) to interact with their tools. This creates three problems:

1. **Onboarding friction**: Every user must install, configure, and authenticate a local MCP client before they can use any tool.
2. **No governance**: The enterprise cannot enforce which LLM provider is used, cannot track token costs, and cannot audit conversations.
3. **No centralized cost control**: Each user pays for their own LLM usage independently — no visibility into organizational AI spend.

### What We Need

A **browser-based chat agent** embedded in the Developer Portal that:
- Connects to the user's subscribed MCP tools automatically (zero config)
- Uses the enterprise's LLM provider credentials (not the user's personal keys)
- Tracks token consumption per tenant/user for billing and quota enforcement
- Stores conversation history for audit and session resumption
- Respects all existing gateway policies (federation, skills, quotas)

## Decision

### 1. Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Portal UI         │     │   Chat Backend        │     │   LLM Provider   │
│   (React)           │     │   (CP API router)     │     │   (Anthropic)    │
│                     │     │                       │     │                  │
│  ChatWindow ───SSE──┼────►│  POST /chat/messages  ├────►│  messages.create │
│  MessageList        │     │  GET  /chat/stream    │◄────┤  (streaming)     │
│  ToolCallIndicator  │     │                       │     │                  │
└─────────────────────┘     └──────────┬────────────┘     └──────────────────┘
                                       │
                                       │ MCP SSE transport
                                       ▼
                            ┌──────────────────────┐
                            │   MCP Gateway         │
                            │   (Rust, edge-mcp)    │
                            │                       │
                            │  tools/list           │
                            │  tools/call           │
                            │  (federation + skills │
                            │   + quota enforced)   │
                            └──────────────────────┘
```

**Key architecture choice**: The Chat Backend is an MCP **client** that connects to the MCP Gateway via SSE transport (Council adjustment #4). This means:
- Tool calls from chat go through the same gateway pipeline as external MCP clients
- Federation policies (ADR-046), skills context (ADR-047), and quotas all apply
- The chat agent is not a privileged bypass — it is a first-class MCP consumer

### 2. Chat Provider Abstraction (Council adjustment #1)

The chat backend uses a `ChatProvider` interface to avoid hard coupling to any single LLM vendor:

```python
class ChatProvider(Protocol):
    async def create_message(
        self,
        messages: list[Message],
        tools: list[Tool],
        model: str,
        max_tokens: int,
        stream: bool = True,
    ) -> AsyncIterator[StreamEvent]: ...

    def convert_mcp_tool(self, mcp_tool: MCPTool) -> Tool: ...

    def extract_tool_calls(self, event: StreamEvent) -> list[ToolCall]: ...

    def estimate_cost(
        self, input_tokens: int, output_tokens: int, model: str
    ) -> Decimal: ...
```

**Implementations**:

| Provider | SDK | Models | Status |
|----------|-----|--------|--------|
| `AnthropicProvider` | `anthropic` | Claude Sonnet/Opus/Haiku | Phase 1 (primary) |
| `OpenAIProvider` | `openai` | GPT-4o, o3 | Phase 2 (planned) |
| `OllamaProvider` | `httpx` | Llama, Mistral (local) | Phase 3 (community) |

The tenant's configuration specifies which provider and model to use. Enterprise customers can restrict available providers via tenant settings.

### 3. Chat Backend as Feature-Flagged Router (Council adjustment #3)

The chat backend lives inside the Control Plane API as a **separate FastAPI router** with a feature flag:

```python
# control-plane-api/src/routers/chat.py
router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

# Enabled via CHAT_ENABLED=true (default: false)
# When disabled, all endpoints return 404
```

**Why inside CP API (not a separate service)**:
- Reuses existing auth (JWT validation, tenant context, RBAC)
- Reuses existing database (conversation storage alongside tenants/subscriptions)
- Reuses existing Kafka producer (token metering events)
- The Anthropic SDK adds ~2 MB — acceptable overhead
- Feature flag isolates the functionality without deployment complexity

**When to extract**: If chat traffic exceeds 20% of CP API requests, or if the chat backend needs independent scaling, extract to a dedicated `chat-api` service. The `ChatProvider` abstraction makes this a clean cut.

### 4. Tool Injection via MCP Gateway

The chat backend discovers and invokes tools by connecting to the MCP Gateway as an SSE client — not by calling tool backends directly:

```
Chat Backend                    MCP Gateway
     │                               │
     │ 1. SSE connect (OAuth token)  │
     ├──────────────────────────────►│
     │                               │
     │ 2. tools/list                 │
     ├──────────────────────────────►│
     │ 3. [tool definitions]         │
     │◄──────────────────────────────┤
     │                               │
     │ 4. Convert to provider format │
     │    (MCPTool → Anthropic Tool) │
     │                               │
     │ 5. messages.create(tools=[...])│
     │    → LLM decides to call tool │
     │                               │
     │ 6. tools/call (tool_name, args)│
     ├──────────────────────────────►│
     │ 7. [tool result]              │  ← federation + skills + quota enforced here
     │◄──────────────────────────────┤
     │                               │
     │ 8. Feed result back to LLM    │
     │    → LLM generates response   │
```

**Why MCP Gateway, not direct tool calls**:
- All gateway policies apply: federation sub-account limits, skills context injection, rate limiting
- Tool discovery is dynamic — when a user's subscriptions change, tools/list reflects it
- Metering and audit happen at the gateway level (consistent with non-chat tool access)
- The chat backend doesn't need to know tool backends — the gateway handles routing

**MCP client implementation**: The chat backend maintains a long-lived SSE connection per active conversation. Connection pooling with idle timeout (5 min) prevents resource exhaustion.

### 5. Per-Tenant API Keys (Council adjustment #5 — Anthropic ToS Compliance)

**Anthropic Terms of Service (Section 2.4)** prohibit sharing API keys across organizations. STOA enforces this:

| Approach | Description | Compliance |
|----------|-------------|------------|
| **Tenant-provided key** (recommended) | Each tenant registers their own Anthropic API key in STOA Console | Fully compliant |
| **STOA-managed key** (SaaS only) | STOA Platform operates as an Anthropic reseller with separate sub-accounts | Requires Anthropic partnership agreement |

**Implementation**: Tenant API keys are stored encrypted in the CP API database (same encryption as SaaS API keys — AES-256-GCM, key in Infisical). The `ChatProvider` receives the decrypted key per request, never caches it in memory beyond the request lifecycle.

```python
# Tenant settings (Console UI: Settings → AI Chat)
{
    "chat_provider": "anthropic",
    "chat_model": "claude-sonnet-4-20250514",
    "chat_api_key": "<encrypted>",          # Tenant's own Anthropic key
    "chat_max_tokens_per_request": 4096,
    "chat_monthly_budget_usd": 500.00,      # Optional spending cap
    "chat_enabled": true
}
```

**Key rotation**: Tenants can rotate their API key in the Console UI at any time. The old key is immediately invalidated (no grace period — Anthropic keys are instantly revocable).

### 6. Token Metering and Budgets

Every LLM API call emits a Kafka metering event (extending ADR-043):

```json
{
    "event_type": "chat.tokens_used",
    "tenant_id": "acme",
    "user_id": "alice",
    "conversation_id": "conv-123",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "input_tokens": 1250,
    "output_tokens": 380,
    "tool_calls": 2,
    "estimated_cost_usd": 0.0095,
    "timestamp": "2026-02-17T14:30:00Z"
}
```

**Budget enforcement**:
- Per-tenant monthly budget (optional, set in Console)
- Per-user daily token limit (optional, set by tenant admin)
- When budget is 80% consumed: warning event → Console notification
- When budget is 100% consumed: chat returns 429 with "Monthly token budget exceeded"
- Aggregated usage visible in Console dashboard (by tenant, by user, by model)

### 7. Conversation History and GDPR (Council adjustments #2, #6)

**Storage**: Conversations and messages stored in CP API database (PostgreSQL), tenant-scoped.

**Data retention policy**:
- Default: 90 days (configurable per tenant: 30, 60, 90, 180 days, or unlimited)
- Auto-purge: Daily cron job deletes conversations older than retention period
- Right to erasure: `DELETE /api/v1/chat/conversations/{id}` immediately removes all messages
- Tenant deletion cascade: deleting a tenant deletes ALL conversations, messages, and token usage records
- No cross-tenant data access: queries always include `tenant_id` filter (enforced at repository layer)

**What is stored**:

| Stored | Not Stored |
|--------|------------|
| User messages (text) | Anthropic API keys (only encrypted reference) |
| Assistant responses (text) | Raw LLM API request/response bodies |
| Tool call names + arguments | Tool result payloads (only summary) |
| Token counts per message | Full streaming event logs |
| Conversation metadata | User IP addresses |

**Tool result handling**: Tool results from the MCP Gateway can contain sensitive data. The chat backend stores only a **summary** (tool name, success/failure, result size) — not the full result payload. The full result is visible in the chat UI during the session but not persisted.

### 8. API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/v1/chat/messages` | Send message + stream response | JWT (any role) |
| `GET` | `/api/v1/chat/conversations` | List user's conversations | JWT (any role) |
| `GET` | `/api/v1/chat/conversations/{id}` | Get conversation with messages | JWT (owner or admin) |
| `PATCH` | `/api/v1/chat/conversations/{id}` | Rename conversation | JWT (owner) |
| `DELETE` | `/api/v1/chat/conversations/{id}` | Delete conversation + messages | JWT (owner or admin) |
| `GET` | `/api/v1/chat/usage` | Token usage for current user | JWT (any role) |
| `GET` | `/api/v1/chat/usage/tenant` | Token usage for tenant | JWT (tenant-admin+) |

**Streaming protocol**: `POST /chat/messages` returns `text/event-stream` (SSE) with events:

```
event: message_start
data: {"conversation_id": "conv-123", "model": "claude-sonnet-4-20250514"}

event: content_delta
data: {"type": "text", "text": "Let me look up "}

event: tool_use_start
data: {"tool_name": "crm_search", "tool_id": "call_1"}

event: tool_use_result
data: {"tool_id": "call_1", "status": "success", "summary": "Found 3 records"}

event: content_delta
data: {"type": "text", "text": "I found 3 matching records..."}

event: message_end
data: {"input_tokens": 1250, "output_tokens": 380, "tool_calls": 1}
```

### 9. RBAC

| Role | Permissions |
|------|------------|
| `viewer` | Chat with own subscribed tools, view own conversations |
| `devops` | Same as viewer + view team usage stats |
| `tenant-admin` | Same as devops + manage chat settings, view all tenant conversations, set budgets |
| `cpi-admin` | Same as tenant-admin + view all tenants, manage global chat config |

## Alternatives Considered

### A. Gateway-Proxied LLM Calls

Route all LLM API calls through the MCP Gateway (Rust) instead of calling Anthropic directly from the CP API.

**Rejected because**: The gateway is a tool server, not an LLM proxy. Adding Anthropic SDK to Rust increases build complexity (C bindings for tokenizer). The CP API already has the auth context, database access, and Python ecosystem needed for LLM integration. Gateway should remain focused on MCP protocol + tool routing.

### B. Standalone Chat Microservice

Deploy a separate `chat-api` service with its own database.

**Rejected for Phase 1 because**: Adds deployment complexity (new Docker image, Helm chart, Kubernetes resources) for a feature that initially serves low traffic. The CP API already handles auth, DB, and Kafka. The feature-flagged router approach (Decision #3) allows extraction later if needed.

### C. Client-Side LLM Calls (Browser → Anthropic)

The Portal UI calls Anthropic directly from the browser, with the CP API only managing tool results.

**Rejected because**: Exposes the tenant's API key to the browser (security risk). No server-side metering or budget enforcement. Cannot inject MCP skills context. Loses conversation history on page refresh.

### D. Shared STOA API Key Across Tenants

STOA uses a single Anthropic API key for all tenants, with internal metering.

**Rejected because**: Violates Anthropic Terms of Service Section 2.4 (no key sharing across organizations). Creates a single point of billing failure. A compromised shared key affects all tenants.

## Consequences

### Positive

- **Zero-config UX**: Users chat with their tools without installing any external client
- **Enterprise governance**: Centralized cost control, audit trail, RBAC enforcement
- **Multi-provider ready**: `ChatProvider` abstraction supports Anthropic, OpenAI, local models
- **Policy-compliant tool calls**: Chat uses the same MCP Gateway pipeline as external clients
- **Competitive moat**: No open-source API gateway offers integrated AI chat with enterprise tool injection

### Negative

- **Anthropic dependency**: Phase 1 requires Anthropic API access (mitigated by provider abstraction)
- **Token cost**: LLM API calls are expensive — requires clear budget UX to avoid bill shock
- **Conversation storage**: New GDPR surface area (mitigated by retention policies + cascade deletion)
- **CP API scope growth**: Adding chat to CP API increases its responsibility (mitigated by feature flag + extractability)

### Risks

| Risk | Mitigation |
|------|------------|
| Anthropic API outage | ChatProvider returns clear error; tool calls via MCP continue working without chat |
| Token budget exhaustion mid-conversation | Graceful 429 with remaining budget info; conversation is preserved for later resumption |
| Conversation data breach | Tenant-scoped queries (always filtered by tenant_id), encrypted API keys, no PII in metering events |
| Tool result contains PII | Only tool call summary persisted, not full result payload |
| Provider pricing changes | Cost estimation updated per provider; budget alerts warn tenants proactively |
| MCP Gateway SSE connection drops | Auto-reconnect with exponential backoff; pending tool calls retried once |

## Implementation Phases

### Phase 1: Chat Backend + Anthropic Provider (~13 pts)

- `ChatProvider` protocol + `AnthropicProvider` implementation
- Chat router in CP API (`/api/v1/chat/`) with feature flag
- `Conversation` and `Message` models + Alembic migration
- MCP Gateway SSE client for tool discovery and execution
- Token metering via Kafka events
- Tenant API key storage (encrypted, same pattern as SaaS API keys)
- Unit tests: 25+ tests (provider, router, tool injection, metering)

### Phase 2: Portal Chat UI (~8 pts)

- `ChatWindow`, `MessageList`, `MessageBubble`, `ToolCallIndicator`, `ChatInput` components
- SSE streaming integration (EventSource)
- Conversation sidebar (list, search, delete)
- Markdown rendering + code syntax highlighting
- 4-persona RBAC tests
- Unit tests: 20+ tests

### Phase 3: Usage Dashboard + Multi-Provider (~8 pts)

- Token usage dashboard in Console (by tenant, by user, by model, by period)
- Budget configuration UI (monthly cap, daily per-user limit, alerts)
- `OpenAIProvider` implementation
- Conversation export (JSON/Markdown)
- E2E tests: 5+ scenarios
- Documentation: Chat agent guide in stoa-docs

## References

- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Anthropic Terms of Service](https://www.anthropic.com/policies/terms-of-service)
- [MCP Specification 2025-03-26](https://spec.modelcontextprotocol.io/)
- [ADR-024: Gateway Unified Modes](/docs/architecture/adr/adr-024-gateway-unified-modes)
- [ADR-043: Kafka MCP Event Bridge](/docs/architecture/adr/adr-043-kafka-mcp-event-bridge)
- ADR-046: MCP Federation Architecture (planned)
- ADR-047: MCP Skills System (planned)
