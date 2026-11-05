---
sidebar_position: 16
title: "Gateway Modes"
description: "STOA Gateway runtime modes — edge-mcp, sidecar, proxy, and shadow. Sidecar is the companion allow/deny endpoint; see Companion usage for integration limits."
keywords:
  - gateway modes
  - edge-mcp
  - sidecar
  - proxy
  - shadow mode
  - ADR-024
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Gateway Modes

STOA Gateway supports 4 deployment modes (defined in [ADR-024](/docs/architecture/adr/adr-024-gateway-unified-modes)), each optimized for a different integration pattern. Select the mode via the `STOA_GATEWAY_MODE` environment variable.

## Mode Overview

| Mode | Port | MCP Support | Use Case | Status |
|------|------|-------------|----------|--------|
| **edge-mcp** | 8080 | Yes | Standalone MCP gateway with full protocol support | Production |
| **sidecar** | 8081 in the chart (binary default 8080) | No | Allow or deny on `POST /authz` for a host that calls it | Runtime present |
| **proxy** | 8082 | No | Inline request/response transformation | Q3 2026 |
| **shadow** | 8083 | No | Passive traffic capture and UAC generation | Q4 2026 |

```mermaid
graph TB
    subgraph "Mode Selection"
        ENV["STOA_GATEWAY_MODE"]
        ENV -->|edge-mcp| EM[Edge MCP<br/>Full MCP protocol]
        ENV -->|sidecar| SC[Sidecar<br/>Policy enforcement]
        ENV -->|proxy| PX[Proxy<br/>Transformation]
        ENV -->|shadow| SH[Shadow<br/>Traffic analysis]
    end
```

## Mode Capabilities

| Capability | edge-mcp | sidecar | proxy | shadow |
|-----------|----------|---------|-------|--------|
| MCP protocol (SSE) | Yes | No | No | No |
| Tool discovery/invocation | Yes | No | No | No |
| JWT authentication | Yes | No. `/authz` trusts the JSON `user` | Yes | No |
| Rate limiting | Yes | Optional, in-memory, per process | Yes | No |
| Circuit breaker | Yes | No | Yes | No |
| Request transformation | No | No | Yes | No |
| Traffic capture | No | No | No | Yes |
| UAC generation | No | No | No | Yes |
| Requires upstream | No | No | Yes | Yes |
| Passive (read-only) | No | No | No | Yes |

## Edge-MCP Mode (Production)

The default and primary production mode. Implements the full MCP protocol with SSE transport, OAuth 2.1 discovery, tool management, and session handling.

### Configuration

```bash
# Environment variables
STOA_GATEWAY_MODE=edge-mcp

# Edge-MCP specific settings
STOA_SSE_KEEPALIVE=true
STOA_SSE_KEEPALIVE_INTERVAL_SECS=30
STOA_MAX_SESSIONS=10000
STOA_SESSION_TIMEOUT_SECS=3600
```

### Helm Values

```yaml
stoaGateway:
  mode: edge-mcp
  edgeMcp:
    sseKeepalive: true
    sseKeepaliveIntervalSecs: 30
    maxSessions: 10000
    sessionTimeoutSecs: 3600
```

### Exposed Routes

| Path | Method | Purpose |
|------|--------|---------|
| `/.well-known/oauth-authorization-server` | GET | OAuth 2.1 discovery |
| `/.well-known/oauth-protected-resource` | GET | Protected resource metadata |
| `/mcp/sse` | GET | SSE transport endpoint |
| `/mcp/messages` | POST | JSON-RPC message endpoint |
| `/oauth/authorize` | GET | OIDC proxy (to Keycloak) |
| `/oauth/token` | POST | Token proxy (to Keycloak) |
| `/oauth/register` | POST | Dynamic client registration |
| `/admin/*` | Various | Admin API (22 endpoints) |
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |

### When to Use

- Standalone MCP gateway deployment
- AI agent integration (Claude, GPT, custom agents)
- Full API management with rate limiting, quotas, and circuit breaking
- Production workloads requiring SSE transport

## Sidecar Mode

Starts the same binary with `STOA_GATEWAY_MODE=sidecar`. The process exposes `POST /authz` and does not mount MCP routes. The host keeps authentication, routing, and enforcement. A same-pod Helm template exists and is off by default. Live calls from Kong, webMethods, or Envoy are not demonstrated in the repository.

Read [Companion usage](./companion-usage.md) for the three integration shapes (same-pod gateway, application callout, mesh) and the current limits. Mesh adapters are design notes only.

### Configuration

```bash
STOA_GATEWAY_MODE=sidecar
STOA_PORT=8081
```

`STOA_UPSTREAM_TYPE`, `STOA_USER_INFO_HEADER`, and `STOA_TENANT_ID_HEADER` are read into sidecar settings and are not used by `/authz`. `STOA_DECISION_FORMAT` is not read. The response format is status code only: `200`, `401`, `403`, or `429`, with an empty body. JSON, Envoy, and Kong formatters exist in the binary and cannot be selected.

The HTTP listener binds `0.0.0.0` and `STOA_PORT`. `STOA_HOST` does not change that bind. The chart's `STOA_HOST=127.0.0.1` does not make `/authz` loopback-only.

### Exposed Routes

| Path | Method | Purpose |
|------|--------|---------|
| `/authz` | POST | Allow or deny from the shared decision engine |
| `/health`, `/ready` | GET | Health and readiness |
| `/metrics` | GET | Generic Prometheus metrics for the process |

There is no `stoa_sidecar_*` metric in the gateway source.

### When to Use

- A host in the same pod can build the JSON body and call `POST /authz` before it forwards.
- An application can make the same callout. That is not a same-pod companion deployment.
- GitOps synchronization of Kong, Gravitee, webMethods, or Envoy is [`stoa-connect`](./stoa-connect-quickstart.md), which stays off the request path.

## Proxy Mode

Sits inline in the request path, transforming requests and responses between clients and backends. Supports header injection, body transformation, and WebSocket passthrough.

### Configuration

```bash
STOA_GATEWAY_MODE=proxy

# Proxy specific settings
STOA_TRANSFORM_REQUEST=false
STOA_TRANSFORM_RESPONSE=false
STOA_INJECT_HEADERS=true
STOA_WEBSOCKET_PASSTHROUGH=false
STOA_CONNECTION_POOL_SIZE=100
```

### Capabilities

| Feature | Default | Description |
|---------|---------|-------------|
| Request transformation | Off | Modify request headers/body before forwarding |
| Response transformation | Off | Modify response headers/body before returning |
| Header injection | On | Add tenant, trace, and correlation headers |
| WebSocket passthrough | Off | Forward WebSocket connections |
| Connection pooling | 100 | Upstream connection pool size |

### When to Use

- Request/response transformation between clients and backends
- Adding observability headers to existing API traffic
- WebSocket proxying with policy enforcement
- Environments requiring inline traffic manipulation

## Shadow Mode

Passively captures traffic for analysis and automatic UAC (Universal API Contract) generation. Does not modify or block any requests.

### Configuration

```bash
STOA_GATEWAY_MODE=shadow

# Shadow specific settings
STOA_CAPTURE_METHOD=Inline       # Options: EnvoyTap, PortMirror, Inline, KafkaReplay
STOA_UAC_OUTPUT_DIR=/var/stoa/uac
STOA_AUTO_CREATE_MR=false
STOA_MIN_REQUESTS_FOR_UAC=100
STOA_ANALYSIS_WINDOW_HOURS=168   # 7 days
```

### Capture Methods

| Method | Description | Infrastructure |
|--------|-------------|----------------|
| `Inline` | STOA captures traffic directly | No extra infra |
| `EnvoyTap` | Envoy tap filter forwards copies | Envoy sidecar |
| `PortMirror` | Network-level traffic mirroring | Switch/router config |
| `KafkaReplay` | Replay from Kafka topic | Redpanda/Kafka |

### UAC Generation

After collecting `min_requests_for_uac` requests over `analysis_window_hours`, shadow mode generates a Universal API Contract:

```
1. Capture traffic (requests + responses)
2. Analyze patterns (endpoints, schemas, error codes)
3. Generate OpenAPI spec + STOA UAC annotations
4. Output to UAC_OUTPUT_DIR (or auto-create MR if configured)
```

### Exposed Routes

| Path | Method | Purpose |
|------|--------|---------|
| `/shadow/status` | GET | Capture statistics |
| `/shadow/generate` | POST | Trigger UAC generation |
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |

### When to Use

- Discovering undocumented APIs in legacy environments
- Automatically generating API contracts from live traffic
- Pre-migration analysis before moving to STOA
- Compliance auditing of API traffic patterns

## Mode Selection Guide

```mermaid
graph TD
    Start[Need an API Gateway?] -->|New deployment| Q1{AI/MCP agents?}
    Q1 -->|Yes| EM[edge-mcp]
    Q1 -->|No| PX[proxy]

    Start -->|Existing gateway| Q2{Replace or augment?}
    Q2 -->|Augment| SC[sidecar]
    Q2 -->|Replace gradually| Q3{Know your APIs?}
    Q3 -->|Yes| EM
    Q3 -->|No| SH[shadow first]
    SH --> EM
```

| Scenario | Recommended Mode |
|----------|-----------------|
| Greenfield MCP deployment | `edge-mcp` |
| Allow or deny beside a host that calls `POST /authz` | Companion (`sidecar` runtime). See [Companion usage](./companion-usage.md) |
| API transformation layer | `proxy` |
| Legacy API discovery | `shadow` → then `edge-mcp` |
| Keep a third-party gateway and sync desired state | [`stoa-connect`](./stoa-connect-quickstart.md). A same-pod companion is a separate callout and is not a recorded webMethods integration |

## Runtime Configuration

Set the mode via environment variable or Helm values:

```bash
# Environment variable (highest priority)
export STOA_GATEWAY_MODE=edge-mcp

# Helm values
stoaGateway:
  mode: edge-mcp
```

The mode is logged at startup:

```
INFO Starting STOA Gateway version=2.0.0 mode=edge-mcp
```

The gateway listens on the mode's default port (8080-8083) unless overridden.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Unknown mode" on startup | Invalid `STOA_GATEWAY_MODE` value | Use: `edge-mcp`, `sidecar`, `proxy`, or `shadow` |
| MCP endpoints return 404 | Wrong mode selected | Only `edge-mcp` serves MCP routes |
| Sidecar answers with a status and an empty body | `/authz` format is fixed to status code | Send the JSON body in [Companion usage](./companion-usage.md). `STOA_DECISION_FORMAT` is not read |
| Shadow not capturing traffic | Capture method requires infra | Use `Inline` if no Envoy/Kafka available |
| Proxy dropping WebSocket | Passthrough disabled | Set `STOA_WEBSOCKET_PASSTHROUGH=true` |

## Related

- [Companion usage](./companion-usage.md) -- Same-pod, application, and mesh limits
- [Multi-Gateway Orchestration](/docs/guides/multi-gateway-setup) -- Multi-gateway adapter pattern
- [MCP Gateway API](/docs/api/mcp-gateway) -- Edge-MCP protocol reference
- [Gateway Admin API](/docs/api/gateway-admin-api) -- Admin endpoints
- [Installation Guide](/docs/admin/installation) -- Helm chart configuration
- [Architecture Overview](/docs/concepts/architecture) -- Platform architecture
