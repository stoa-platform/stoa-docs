---
sidebar_position: 30
slug: /guides/chat-agent
title: "Integrated Chat Agent — Data Flow & API Key Strategy"
description: "How the STOA Console chat agent processes data, manages API keys, and handles GDPR obligations — architecture, token budgets, and data lifecycle."
keywords:
  - STOA chat agent
  - AI data processing
  - API key management
  - GDPR AI compliance
  - token budgets
---

# Integrated Chat Agent — Data Flow & API Key Strategy

The STOA Console includes an integrated chat agent that helps operators manage their APIs through natural language. This guide explains how data flows through the system, how API keys are managed, and how GDPR obligations are met.

## Data Processing Flow

```
User (Console)
  │
  │  1. Chat message (HTTPS, TLS 1.3)
  ▼
Control Plane API (FastAPI)
  │
  │  2. Auth check (Keycloak OIDC token)
  │  3. Tenant isolation (RBAC + row-level filter)
  │  4. Build prompt (system context + user message)
  │  5. PII detection middleware (pre-send scan)
  │
  │  6. API call (HTTPS, ANTHROPIC_API_KEY from Vault)
  ▼
Anthropic API (claude-sonnet-4-6)
  │
  │  7. Streaming response
  ▼
Control Plane API
  │
  │  8. Response logged (without secrets)
  │  9. Conversation stored in PostgreSQL (tenant-scoped)
  │
  │  10. Streamed back (SSE)
  ▼
User (Console)
```

### Key Properties

- **Tenant isolation**: each conversation is scoped to the authenticated user's tenant. No cross-tenant data leakage is possible — queries are filtered by `tenant_id` at the repository layer.
- **No training**: Anthropic API usage is zero-retention by default. Chat data is not used to train models. See [Anthropic's data policy](https://www.anthropic.com/policies/privacy).
- **PII pre-scan**: the gateway PII middleware scans outbound prompts for sensitive patterns (emails, phone numbers, credit cards) before they reach the LLM provider.

## API Key Strategy

### Platform-Level Key

STOA uses a **single platform-level Anthropic API key** stored in HashiCorp Vault and synced to Kubernetes via External Secrets Operator (ESO).

```
HashiCorp Vault
  └── stoa/k8s/anthropic
        └── ANTHROPIC_API_KEY
              │
              │  ESO sync (1h refresh)
              ▼
        K8s Secret: anthropic-api-key
              │
              │  envFrom: secretRef
              ▼
        control-plane-api pod
```

**Why a platform key (not per-tenant)?**

| Approach | Pros | Cons |
|----------|------|------|
| Platform key | Simple rotation, single billing, centralized control | Platform bears cost, shared rate limits |
| Per-tenant key | Tenant pays directly, isolated rate limits | Key management complexity, onboarding friction |

STOA uses the platform key because:
1. The chat agent is a platform feature, not a tenant-provided service
2. Token budgets enforce per-tenant cost control (see below)
3. Key rotation is a single Vault update, not N tenant operations

### Per-Tenant Token Budgets

Each tenant has configurable token limits that prevent any single tenant from exhausting the shared API key:

| Budget | Default | Configurable | Enforcement |
|--------|---------|-------------|-------------|
| Daily token limit | 100,000 tokens | Per-tenant setting | API returns 429 when exceeded |
| Monthly token limit | 2,000,000 tokens | Per-tenant setting | API returns 429 when exceeded |
| Max conversation length | 50 messages | Global setting | Oldest messages trimmed from context |
| Max input tokens per request | 4,096 tokens | Global setting | Request rejected if exceeded |

Token usage is tracked per tenant in PostgreSQL and exposed in the Console under **Settings > Usage**.

## GDPR Compliance

### Data Lifecycle

```
Message sent ──► Stored in PostgreSQL (tenant-scoped)
                    │
                    ├── Active: available in conversation history
                    │
                    ├── 90 days: automatic purge (background worker)
                    │
                    └── On tenant deletion: cascade delete (all conversations)
```

### Right to Deletion

| Trigger | Scope | Mechanism |
|---------|-------|-----------|
| User requests deletion | Single conversation | `DELETE /v1/conversations/{id}` — hard delete |
| User requests full erasure | All conversations | `DELETE /v1/users/{id}/conversations` — cascade |
| Tenant deletion | All tenant data | PostgreSQL `ON DELETE CASCADE` on `tenant_id` FK |
| 90-day retention | Expired conversations | Background worker (`ConversationPurgeWorker`) |

### Data Minimization

- **System prompts** do not include tenant secrets, credentials, or PII
- **Conversation context** is limited to the current session (no cross-session memory)
- **Anthropic receives** only the conversation messages — no tenant metadata, no user identity
- **Logs** record conversation IDs and token counts, never message content

### Audit Trail

Every chat interaction is logged with:
- Timestamp, tenant ID, user ID (pseudonymized)
- Token count (input + output)
- Model used, latency
- No message content in logs (stored separately in PostgreSQL with retention policy)

## Security Considerations

| Layer | Control |
|-------|---------|
| Authentication | Keycloak OIDC token required for every request |
| Authorization | RBAC: `cpi-admin` and `tenant-admin` can use chat; `viewer` read-only |
| Transport | TLS 1.3 end-to-end (Console → CP API → Anthropic) |
| Secret storage | API key in Vault, synced via ESO, never in env files or code |
| Rate limiting | Per-tenant token budgets + global rate limiter middleware |
| PII protection | Pre-send scan blocks sensitive patterns |

## Configuration

The chat agent is controlled by environment variables on the control-plane-api deployment:

| Variable | Source | Description |
|----------|--------|-------------|
| `ANTHROPIC_API_KEY` | Vault (`k8s/anthropic`) | API key for Anthropic |
| `CHAT_AGENT_ENABLED` | ConfigMap | Enable/disable chat feature (`true`/`false`) |
| `CHAT_AGENT_MODEL` | ConfigMap | Model to use (default: `claude-sonnet-4-6`) |
| `CHAT_DEFAULT_DAILY_LIMIT` | ConfigMap | Default daily token limit per tenant |
| `CHAT_RETENTION_DAYS` | ConfigMap | Days before automatic purge (default: 90) |

## Related

- [Authentication Guide](/docs/guides/authentication) — OIDC setup for the Console
- [RBAC Permissions Reference](/docs/reference/rbac-permissions) — role-based access control
- [Security Configuration](/docs/reference/security-configuration) — TLS, mTLS, and security hardening
- [Data Sovereignty & GDPR](/docs/guides/fiches/data-sovereignty-gdpr) — full GDPR compliance guide
