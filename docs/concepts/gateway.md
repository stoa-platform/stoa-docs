---
sidebar_position: 5
title: "STOA Gateway Deployment Modes"
description: "Learn about the STOA Gateway's 4 deployment modes: edge-mcp, sidecar, proxy, and shadow for any use case."
keywords: [STOA, gateway, deployment modes, edge-mcp, sidecar, proxy, concepts, API gateway]
---

# STOA Gateway

## Overview

STOA Gateway is the unified API gateway component of the STOA Platform. It provides AI-native API management with 4 deployment modes to fit different use cases.

**Current Implementation**: Python/FastAPI (`mcp-gateway/`)
**Target Implementation**: Rust/Tokio (`stoa-gateway/`) — Q4 2026

See [ADR-024](../architecture/adr/adr-024-gateway-unified-modes) for the architecture decision.

## Architecture Vision

```
                    ┌─────────────────────────────────────────┐
                    │           stoa-gateway                   │
                    │         (single binary)                  │
                    ├─────────────────────────────────────────┤
                    │  --mode=edge-mcp   │  --mode=sidecar    │
                    │  --mode=proxy      │  --mode=shadow     │
                    └─────────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│  AI Agents    │            │ Legacy APIs   │            │  3rd Party    │
│  (Claude,GPT) │            │ (ERP, CRM)    │            │  Gateways     │
└───────────────┘            └───────────────┘            └───────────────┘
```

## Deployment Modes

### Edge-MCP Mode (Current)

**Status**: ✅ Production

The primary mode for AI agent integration via Model Context Protocol (MCP).

**Use Cases**:
- Claude Desktop integration
- Custom LLM agent access to enterprise APIs
- AI-powered automation workflows

**Features**:
- SSE (Server-Sent Events) transport
- JSON-RPC 2.0 message handling
- Dynamic tool registry from Kubernetes CRDs
- OAuth2/OIDC authentication via Keycloak
- OPA policy evaluation
- Kafka metering pipeline

**Example**:
```bash
# Current Python implementation
cd mcp-gateway && uvicorn src.main:app --port 3001

# Future Rust implementation
stoa-gateway --mode=edge-mcp --port=3001
```

**Endpoints**:
- `GET /mcp/sse` — SSE endpoint for Claude Desktop
- `POST /mcp/v1/tools/{name}` — Tool invocation
- `GET /mcp/v1/tools` — List available tools

---

### Sidecar Mode (Planned Q2 2026)

**Status**: 📋 Planned

Deploy STOA behind existing API gateways to add observability and governance without replacing infrastructure.

**Use Cases**:
- Add STOA capabilities to Kong, Envoy, or Apigee
- Gradual migration from legacy gateways
- Enterprise compliance requirements

**Features**:
- Observability injection (OpenTelemetry traces)
- Metering events to Kafka for billing
- UAC compliance validation
- Error snapshot capture for debugging

**Example**:
```bash
stoa-gateway --mode=sidecar \
  --primary-gateway=kong \
  --metering-enabled=true
```

**Architecture**:
```
Client → Kong → stoa-gateway (sidecar) → Backend
                      │
                      ▼
                  Kafka (metering)
                  OpenTelemetry (traces)
```

---

### Proxy Mode (Planned Q3 2026)

**Status**: 📋 Planned

Classic API gateway with full policy enforcement, for greenfield deployments.

**Use Cases**:
- New API deployments needing governance
- Replacing legacy gateways entirely
- Multi-tenant API platforms

**Features**:
- OPA policy evaluation (blocking)
- Rate limiting per tenant/consumer
- Request/response transformation
- Circuit breaker patterns
- mTLS termination

**Example**:
```bash
stoa-gateway --mode=proxy \
  --upstream=http://backend:8080 \
  --opa-endpoint=http://opa:8181
```

---

### Shadow Mode (Deferred)

**Status**: ⏸️ Deferred pending security review

Passive traffic observation for legacy API discovery. Deploy for 2 weeks, auto-generate interface contracts.

**Use Cases**:
- Legacy APIs with no documentation
- Black-box progiciels (SAP, Oracle, etc.)
- API inventory discovery

**Features** (planned):
- Zero modification to requests/responses
- Capture traffic patterns
- Auto-generate UAC contracts (HTTP parsing, no ML)
- Human-in-the-loop validation before promotion

**Example**:
```bash
stoa-gateway --mode=shadow \
  --target=http://legacy-erp:8080 \
  --output=/var/lib/stoa/uac
```

**Security Requirements** (before implementation):
- PII detection/masking before storage
- Explicit opt-in per API/tenant
- Retention < 30 days with auto-purge
- RGPD Article 25 compliance

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_MODE` | Deployment mode | `edge-mcp` |
| `GATEWAY_PORT` | HTTP port | `3001` |
| `KEYCLOAK_URL` | Keycloak base URL | Required |
| `KEYCLOAK_REALM` | Keycloak realm | `stoa` |
| `OPA_ENABLED` | Enable OPA policy evaluation | `true` |
| `METERING_ENABLED` | Enable Kafka metering | `true` |

### Kubernetes CRDs

The gateway watches for Tool and ToolSet CRDs:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: my-api-tool
  namespace: tenant-acme
spec:
  displayName: My API Tool
  description: A sample tool
  endpoint: https://api.example.com/v1/action
  method: POST
```

See [MCP Tools Reference](../reference/mcp-tools) for full schema.

## Current vs Target

| Aspect | Current (Python) | Target (Rust) |
|--------|------------------|---------------|
| Directory | `mcp-gateway/` | `stoa-gateway/` |
| Language | Python 3.11 | Rust (Tokio) |
| Framework | FastAPI | Axum/Hyper |
| Status | Production | Q4 2026 |
| Modes | edge-mcp only | All 4 modes |

## Related Documentation

- [ADR-024: Unified Gateway Architecture](../architecture/adr/adr-024-gateway-unified-modes)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [MCP Gateway API Reference](../api/mcp-gateway)
- [ADR-021: UAC-Driven Observability](../architecture/adr/adr-021-uac-driven-observability)
