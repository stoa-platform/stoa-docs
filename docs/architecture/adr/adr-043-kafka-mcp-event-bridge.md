---
title: "ADR-043: Kafka → MCP Event Bridge Architecture"
description: "Architecture decision for connecting Kafka event backbone to MCP Gateway via SSE, enabling real-time push notifications to AI agents — a first in API Management."
keywords: [ADR, Kafka, MCP, SSE, event-driven, notifications, AI agents, Redpanda, bridge, CQRS]
---

# ADR-043: Kafka → MCP Event Bridge Architecture

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Proposed |
| **Date** | 2026-02-15 |
| **Author** | Christophe ABOULICAM |
| **Deciders** | STOA Core Team |
| **Category** | Architecture / Event-Driven / AI-Native |
| **Linear** | CAB-1176 |

### Related Decisions

- **ADR-005**: Event-Driven Kafka — Original topic design and event backbone architecture
- **ADR-024**: Gateway Unified Modes — 4 deployment modes (edge-mcp, sidecar, proxy, shadow)
- **ADR-041**: Plugin Architecture — Community Core vs Enterprise Extensions model

## Context

STOA Platform possesses three operational technology bricks that are not yet connected to each other:

1. **Kafka/Redpanda** — deployed as internal event backbone (CAB-211, CAB-294, CAB-123)
2. **MCP Gateway** — operational with SSE Streamable HTTP Transport (CAB-1082)
3. **SSE Transport** — implemented for server→client communication via MCP

The MCP protocol natively supports **server-initiated notifications** (`notifications/send`) via SSE, allowing the server to push events to connected agents without waiting for a request.

### Problem

Today, AI agents connected to STOA via MCP operate in **pull-only** mode: they call `tools/list` and `tools/call` to interact with the platform. They have no awareness of events occurring on the platform:

- New API published in the catalog
- Subscription approved or revoked
- Security alert (rate limit breach, anomaly)
- Policy change
- Real-time gateway metrics

### Competitive Analysis (February 2026)

| Platform | Kafka | MCP Support | Push Event → Agent |
|-----------|-------|-------------|-------------------|
| **Kong** (Event Gateway, Oct 2025) | Expose Kafka as API | MCP Gateway (3.12) — proxy | No push |
| **Gravitee** (4.10, Jan 2026) | Protocol mediation | MCP proxy + Agent Tool Server | Request/response only |
| **Confluent** | MCP server for Kafka admin | Client MCP for topics | Admin tooling, not event push |
| **Apigee** | N/A | N/A | N/A |
| **STOA** (proposed) | Internal backbone | Native MCP Gateway | Kafka → SSE → MCP notifications |

**No competitor does push event-driven delivery to AI agents connected via MCP.**

<!-- last verified: 2026-02 -->

> Feature comparisons are based on publicly available documentation as of 2026-02.
> Product capabilities change frequently. We encourage readers to verify current
> features directly with each vendor. All trademarks belong to their respective owners.

Sources:
- Kai Waehner (Confluent), "Agentic AI with A2A and MCP using Kafka" (May 2025) — theorizes the architecture but no product
- Gravitee 4.10 release blog (Jan 2026) — AI Gateway + MCP proxy, no push
- Kong Event Gateway (Oct 2025) — exposes Kafka, no bridge to MCP
- mcp-kafka / kafka-mcp-server (GitHub) — Kafka admin via MCP tools, not an event bridge

## Decision

Implement a **Kafka → MCP Event Bridge** in 4 phases, transforming STOA into the first event-driven AI-native API Management platform.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STOA Event Flow                               │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Control Plane │    │    Kafka     │    │  SSE Bridge  │       │
│  │  (Producers)  │───▶│  (Redpanda)  │───▶│  (Consumer)  │       │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘       │
│                             │                    │               │
│                    ┌────────┤              ┌─────▼──────┐       │
│                    │        │              │ MCP Gateway │       │
│                    ▼        ▼              │ notifications│      │
│              ┌──────┐ ┌──────┐            │   /send     │       │
│              │Audit │ │Prom. │            └──────┬───────┘       │
│              │Sink  │ │Bridge│                   │               │
│              └──────┘ └──────┘                   ▼               │
│                                          ┌──────────────┐       │
│                                          │  AI Agents    │       │
│                                          │  (connected)  │       │
│                                          └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Kafka Topics — 8 Families (Central Nervous System)

Kafka serves not only the MCP bridge — it is the **central nervous system** of the entire platform. Every mutation, every event flows through Kafka, feeding 38 consumers across all STOA features.

| Topic | Content | Delivery | Retention | Partitions | Status |
|-------|---------|----------|-----------|------------|--------|
| `stoa.api.lifecycle` | API created/updated/deprecated/retired | EXACTLY_ONCE | 7d | 6 | Planned |
| `stoa.subscription.events` | Request → Approved → Revoked | EXACTLY_ONCE | 7d | 6 | Planned |
| `stoa.security.alerts` | Rate limit breach, anomaly detected | AT_LEAST_ONCE | 30d | 3 | Planned |
| `stoa.metering.events` | Usage tracking, billing events | BEST_EFFORT | 3d | 12 | **LIVE** |
| `stoa.audit.trail` | All config changes, who/what/when | EXACTLY_ONCE | 90d | 6 | Planned |
| `stoa.gateway.metrics` | Latency P95, error rates, throughput | BEST_EFFORT | 3d | 12 | Planned |
| `stoa.deployment.events` | ArgoCD sync, CLI deploy, rollback | EXACTLY_ONCE | 7d | 3 | Planned |
| `stoa.resource.lifecycle` | TTL expiry, extension, cleanup | EXACTLY_ONCE | 30d | 6 | Planned |

#### Producers per topic

| Topic | Producers |
|-------|-----------|
| `stoa.api.lifecycle` | Control Plane API, CLI `stoa push`, GitOps webhook |
| `stoa.subscription.events` | Portal (request), Control Plane (approve/reject), Saga orchestrator |
| `stoa.security.alerts` | Gateway Rust (rate limit), Keycloak (auth failures), OPA (policy violations) |
| `stoa.metering.events` | Gateway Rust (every request), MCP Gateway (tool calls) |
| `stoa.audit.trail` | Control Plane (all mutations), Portal (user actions), Gateway (config changes) |
| `stoa.gateway.metrics` | Gateway Rust (per-request metrics), MCP Gateway (tool latency) |
| `stoa.deployment.events` | ArgoCD (sync status), CLI `stoa deploy`, GitHub Actions |
| `stoa.resource.lifecycle` | TTL CronJob, Portal (extension request), Control Plane (cleanup) |

#### Consumer impact — 38 consumers unlocked

Adopting Kafka as backbone unlocks consumer dependencies across the entire backlog: Notification Dispatcher (CAB-376), Onboarding Workflows (CAB-593/594/424), Error Snapshots (CAB-486/487/547), Portal Catalog (CAB-563), Schema Evolution Guard (CAB-464), Vercel-Style DX (CAB-374), Resource TTL (CAB-86), and the full observability infrastructure (CAB-497/498/499/500/501).

### SSE Bridge Design

The bridge is a **Kafka Consumer** that:
1. Consumes topics configured per tenant
2. Applies multi-tenant filtering (isolation via Keycloak namespace)
3. Transforms Kafka events into SSE events
4. Applies backpressure via token-bucket per connection
5. Handles reconnection with offset tracking

### MCP Notification Model

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/send",
  "params": {
    "type": "stoa.api.lifecycle",
    "data": {
      "event": "api.created",
      "api": {
        "name": "customer-api",
        "version": "2.1.0",
        "owner": "team-payments"
      },
      "timestamp": "2026-02-15T10:30:00Z",
      "tenant": "acme-corp"
    },
    "hint": {
      "action": "tools/list",
      "reason": "New API available — refresh tool registry"
    }
  }
}
```

The `hint` field is a STOA innovation: it suggests to the agent what action to take following the event, without imposing (the agent decides).

## Implementation Phases

### Phase 1 — Kafka Event Backbone (8 pts, CAB-1177)

Structure Kafka producers in the Control Plane for all lifecycle events.

- Control Plane → Kafka producers (8 topic families)
- Kafka → PostgreSQL sink (audit, replay)
- Kafka → Prometheus metrics bridge
- Topic policies versioned in Git (delivery semantics per topic)
- JSON Schema defined for each topic

### Phase 2 — Kafka → SSE Bridge (5 pts, CAB-1178)

Kafka Consumer that transforms events into SSE stream for the MCP Gateway.

- KafkaConsumer → SSE EventSource adapter
- Per-tenant filtering (multi-tenant isolation via Keycloak claims)
- Backpressure handling (token-bucket per connection)
- Reconnection logic with offset tracking
- Health check + circuit breaker

### Phase 3 — MCP Notifications (5 pts, CAB-1179)

AI agents connected via MCP receive events in real-time.

- MCP `notifications/send` for critical events
- Agent subscription model (opt-in per event type)
- Event → Tool hint (api.created → suggestion tools/list refresh)
- AsyncAPI 3.0 contract generation from UAC (link with CAB-712)

### Phase 4 — Event-Driven Governance (8 pts, CAB-1180)

Kafka events feed automatic governance rules.

- Policy-as-Event: policy change → instant propagation to all agents
- CQRS: write path (Control Plane) / read path (event-sourced projections)
- Saga patterns for multi-step workflows (approval chains)
- Dead Letter Queue + retry policies per tenant

**Total: 26 points**

## Value Proposition — Third-Party Gateway Cost Reduction

### Problem: Polling Is Expensive

When a client keeps a third-party gateway (webMethods, Kong Enterprise, Apigee) billed per transaction, three patterns exist for monitoring their APIs:

| Pattern | Cost | Latency | Onboarding Impact |
|---------|------|---------|-------------------|
| **Polling** (Control Plane → Gateway) | Ghost transactions (pure monitoring) | Depends on interval | None |
| **Webhook** (Backend → STOA) | Low | Real-time | Heavy (dev required on backend side) |
| **Batch/cron** (file export) | Medium | Hours | Medium |

Concrete example — webMethods billed per transaction:
- **Without Kafka**: polling every 30s × 200 APIs × 5 consumers = ~2.9M transactions/day of pure monitoring
- **With Kafka**: 0 monitoring transactions. Events flow through Kafka, consumers read Kafka (free)

### Solution: Kafka as Free Fan-Out

```
API Request → webMethods (1 transaction) → Kafka event (fire & forget)
                                              ├── Portal (catalog refresh)
                                              ├── Grafana (metrics)
                                              ├── Audit trail (PostgreSQL)
                                              ├── MCP Agent notification
                                              └── Billing metering
```

1 Kafka event → N independent consumers. Zero additional transactions on the paid gateway.

### Impact on Onboarding

**Without Kafka** — onboarding an API:
1. Declare the API in the Portal
2. Configure webhook backend → STOA (dev required on backend team side)
3. Handle callback auth (mutual TLS, API key...)
4. Implement retries on backend side (if STOA is down, events are lost)
5. Test webhook end-to-end

**With Kafka** — onboarding an API:
1. Declare the API in the Portal
2. Done.

The backend does not change a single line of code. The gateway emits the event into Kafka. Total decoupling.

### 30-Second Client Pitch

> "You keep your gateway. We place Kafka alongside it. Your monitoring costs drop to zero, API onboarding goes from 5-10 days to 2 clicks, and your AI agents get notified in real-time. Your backends don't change a single line of code."

## Consequences

### Positive

- **Unique differentiator**: first APIM to push real-time events to AI agents
- **Maximum reuse**: Kafka, SSE and MCP Gateway are already deployed — only the glue is missing
- **Roadmap alignment**: fits the "ESB is Dead" vision and event-driven positioning
- **Immediate client value**: an architect can see in real-time when their APIs are consumed

### Negative

- **Operational complexity**: Kafka adds a maintenance layer (mitigated by Redpanda, simpler)
- **Additional latency**: Control Plane → Kafka → SSE Bridge → MCP adds ~50-100ms vs direct
- **Attack surface**: new information leak vector if tenant filtering is poorly implemented
- **MCP speculation**: `notifications/send` is in the spec but poorly implemented on client side — risk of slow adoption

### Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| MCP clients don't support notifications | Medium | Medium | Fallback polling + client documentation |
| Cross-tenant leak via SSE | Low | Critical | Systematic isolation tests + audit |
| Kafka latency too high | Low | Low | Redpanda optimized for latency, P95 monitoring |
| Gravitee implements same pattern | Medium | Medium | First-mover advantage |

## Alternatives Considered

### Alternative A: Direct WebSocket (without Kafka)

Control Plane → WebSocket → Agents. Simpler but loses durability, replay, and multi-consumer fan-out.

**Rejected**: no replay, no decoupling, no persistence.

### Alternative B: Enhanced Polling

Agents do long-polling on a `/events` endpoint of the Control Plane.

**Rejected**: anti-pattern for real-time, server load proportional to number of agents, not event-driven.

### Alternative C: CloudEvents + Webhook

Push events via CloudEvents webhooks to agents.

**Rejected**: requires agents to expose an HTTP endpoint (reversed), not compatible with MCP SSE model.

## References

- [MCP Spec — Transports (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [RFC 8693 — OAuth 2.0 Token Exchange](https://tools.ietf.org/html/rfc8693)
- [AsyncAPI 3.0 Specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
- [Kai Waehner — Agentic AI with Kafka, MCP and A2A](https://www.kai-waehner.de/blog/2025/05/26/agentic-ai-with-the-agent2agent-protocol-a2a-and-mcp-using-apache-kafka-as-event-broker/)
- [Gravitee 4.10 Release](https://www.gravitee.io/blog/gravitee-4.10-one-control-point-to-secure-govern-ai-agents-mcp-and-llms)
- [Kong Event Gateway](https://konghq.com/blog/enterprise/how-to-productize-event-data-and-event-apis)
- STOA Internal: CAB-211 (Event-Driven Architecture), CAB-123 (Metering Pipeline), CAB-1082 (MCP SSE Transport)
