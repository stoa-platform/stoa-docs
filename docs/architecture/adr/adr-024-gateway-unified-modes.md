---
sidebar_position: 24
---

# ADR-024: Unified Gateway Architecture with Mode-Based Configuration

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-01-26 |
| **Linear** | [CAB-958](https://linear.app/stoa/issue/CAB-958) |

## Context

STOA Platform has naming confusion between two gateway components:

- `mcp-gateway/` (Python/FastAPI) — production, MCP protocol support
- `stoa-gateway/` (Rust/Axum) — emerging, research

This creates cognitive load for contributors and users. Even the project creator forgot the distinction. This is day-0 technical debt before having a single customer.

### The Problem

> "Is it mcp-gateway or stoa-gateway? What's the difference?"
> — Every new contributor

## Decision

Adopt a **unified gateway architecture** with 4 deployment modes, configured via `--mode` flag:

| Mode | Position | Function | Use Case |
|------|----------|----------|----------|
| **edge-mcp** | AI agents front | MCP protocol, tools/call, SSE | Claude, GPT, custom LLM agents |
| **sidecar** | Behind 3rd-party GW | Observability, enrichment | Kong, webMethods, Apigee existing |
| **proxy** | Inline active | Policy enforcement, rate limit, transform | Classic API Management |
| **shadow** | Passive MITM | Observe, log, auto-generate UAC | Legacy APIs, undocumented progiciels |

### Naming Convention

| Artifact | Name |
|----------|------|
| Component name | `stoa-gateway` |
| Binary | `stoa-gateway` |
| Helm Chart | `stoa-gateway` |
| Docker Image | `ghcr.io/hlfh/stoa-gateway` |
| Config file | `stoa-gateway.yaml` |
| K8s resources | `stoa-gateway` |

**KILL**: `mcp-gateway` as component name. It's just `--mode=edge-mcp`.

## Current State

```
mcp-gateway/           # Python/FastAPI — PRODUCTION
├── src/
│   ├── handlers/mcp_sse.py      # SSE transport
│   ├── services/tool_registry/  # Tool management
│   └── k8s/watcher.py           # CRD watcher
└── Dockerfile

stoa-gateway/          # Rust/Axum — EMERGING/RESEARCH
├── src/
│   ├── uac/enforcer.rs          # UAC enforcement
│   ├── mcp/handlers.rs          # MCP handlers
│   └── router/shadow.rs         # Shadow router
└── Cargo.toml
```

## Target State (Q4 2026)

Single `stoa-gateway` Rust binary with `--mode` flag:

```
stoa-gateway/          # Rust/Tokio/Hyper — TARGET
├── src/
│   ├── main.rs                  # Entry point, --mode flag
│   ├── modes/
│   │   ├── mod.rs               # Mode trait
│   │   ├── edge_mcp.rs          # MCP protocol (port from Python)
│   │   ├── sidecar.rs           # Behind 3rd-party gateway
│   │   ├── proxy.rs             # Inline policy enforcement
│   │   └── shadow.rs            # Traffic capture, UAC generation
│   ├── auth/
│   │   └── oidc.rs              # Keycloak JWT validation
│   └── observability/
│       └── metrics.rs           # Prometheus
├── Cargo.toml
└── Dockerfile
```

Python `mcp-gateway/` deprecated after Rust reaches feature parity.

## Migration Strategy

1. **Keep Python mcp-gateway in production** during transition
2. **Port mode-by-mode** to Rust (edge-mcp first, shadow last)
3. **Shadow mirror** Python vs Rust for validation
4. **Cut over** when Rust achieves >99.9% request compatibility

### Migration Phases

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Phase 16 | Now | ADR + documentation (this document) |
| Phase 17 | Q2 2026 | Rust gateway foundation + edge-mcp port |
| Phase 18 | Q3 2026 | proxy + sidecar modes |
| Phase 19 | Q4 2026 | shadow mode (after security review) |

## Consequences

### Positive

- **Clear naming**: one component, multiple modes
- **Single language** (Rust) for all new gateway code
- **Incremental migration** reduces risk
- **No breaking changes** during transition

### Negative

- **Two codebases** during transition period
- **Documentation overhead**: must clarify "current (Python)" vs "target (Rust)"

## Mode Details

### Edge-MCP Mode (Current)

**Status**: ✅ Production (Python)

AI-native API gateway implementing Model Context Protocol:

- SSE transport for real-time streaming
- JSON-RPC 2.0 message handling
- Dynamic tool registry from K8s CRDs
- OAuth2/OIDC authentication via Keycloak

```bash
stoa-gateway --mode=edge-mcp --port=3001
```

### Sidecar Mode (Planned)

**Status**: 📋 Planned Q2 2026

Deploy behind existing API gateways to add STOA capabilities:

- Observability injection (OpenTelemetry)
- Metering events to Kafka
- UAC compliance validation
- Error snapshot capture

```bash
stoa-gateway --mode=sidecar --primary-gateway=kong
```

### Proxy Mode (Planned)

**Status**: 📋 Planned Q3 2026

Classic API gateway with policy enforcement:

- OPA policy evaluation
- Rate limiting per tenant/consumer
- Request/response transformation
- Circuit breaker patterns

```bash
stoa-gateway --mode=proxy --upstream=http://backend:8080
```

### Shadow Mode (Deferred)

**Status**: ⏸️ Deferred pending security review

Passive traffic observation for legacy API discovery:

- Zero modification to requests/responses
- Capture traffic patterns
- Auto-generate UAC contracts (no ML, just HTTP parsing)
- Human-in-the-loop validation before promotion

```bash
stoa-gateway --mode=shadow --target=http://legacy-erp:8080
```

## Shadow Mode - Security Deferral

Shadow mode captures potentially sensitive traffic. Implementation deferred until security framework complete:

- [ ] PII detection/masking **before** Kafka emission
- [ ] Explicit opt-in per API/tenant (no silent capture)
- [ ] Retention policy < 30 days with auto-purge
- [ ] Audit log: who accessed observations, when, why
- [ ] RGPD Article 25 (Privacy by Design) compliance documentation
- [ ] Team Coca security review sign-off

### Commercial Pitch (30 seconds)

> "Got legacy APIs with no docs? Black-box progiciels? Deploy STOA in Shadow mode for 2 weeks. We observe traffic, auto-generate interface contracts. Zero risk, zero changes. Then you decide: keep just the docs, or activate governance."

## Configuration

### Environment Variables

```bash
# Mode selection
GATEWAY_MODE=edge-mcp  # edge-mcp | sidecar | proxy | shadow

# Common settings
GATEWAY_PORT=3001
GATEWAY_LOG_LEVEL=info

# Keycloak (all modes)
KEYCLOAK_URL=https://auth.gostoa.dev
KEYCLOAK_REALM=stoa
KEYCLOAK_CLIENT_ID=stoa-gateway

# Mode-specific
SHADOW_TARGET_BACKEND=http://legacy:8080
SIDECAR_PRIMARY_GATEWAY=kong
PROXY_OPA_ENDPOINT=http://opa:8181
```

### Helm Values (Prepared)

```yaml
gateway:
  mode: edge-mcp
  image:
    repository: ghcr.io/hlfh/stoa-gateway
    tag: latest

  edgeMcp:
    enabled: true
    port: 3001

  sidecar:
    enabled: false
    primaryGateway: ""

  proxy:
    enabled: false
    opaEndpoint: ""

  shadow:
    enabled: false  # DEFERRED
```

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [STOA UAC Schema](https://github.com/stoa-platform/stoa/blob/main/stoa-catalog/schemas/uac.schema.json)
- [Team Coca P0 Security Audit](./adr-018-security-hardening-p0.md)

## Decision Record

| Date | Decision | Author |
|------|----------|--------|
| 2026-01-26 | ADR created, unified architecture adopted | CAB-958 |
| 2026-01-26 | Shadow mode deferred for security review | Team Coca |

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds ✅*
