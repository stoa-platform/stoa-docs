---
sidebar_position: 24
title: "ADR-024: Unified Gateway Modes"
description: "Decides the unified gateway architecture with mode-based configuration supporting edge-MCP, sidecar, proxy, and shadow deployment modes."
keywords: [gateway modes, unified architecture, edge-MCP, sidecar, proxy, configuration]
---

import GatewayModesArchitecture from '@site/src/components/GatewayModesArchitecture';

# ADR-024: Unified Gateway Architecture with Mode-Based Configuration

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-01-26 |
| **Updated** | 2026-01-26 |
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

Adopt a **unified gateway architecture** with 4 deployment modes, configured via `--mode` flag.

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

### Four Deployment Modes

<GatewayModesArchitecture />

#### Mode Overview

| Mode | Position | Function | Use Case |
|------|----------|----------|----------|
| **edge-mcp** | AI agents front | MCP protocol, tools/call, SSE | Claude, GPT, custom LLM agents |
| **sidecar** | Behind 3rd-party GW | Observability, enrichment | Kong, webMethods, Apigee existing |
| **proxy** | Inline active | Policy enforcement, rate limit, transform | Classic API Management |
| **shadow** | Passive MITM | Observe, log, auto-generate UAC | Legacy APIs, undocumented progiciels |

## Mode Details

### Edge-MCP Mode

**Status**: ✅ Production (Python) → Rust Q2 2026

AI-native API gateway implementing Model Context Protocol:

- SSE transport for real-time streaming
- JSON-RPC 2.0 message handling
- Dynamic tool registry from K8s CRDs
- OAuth2/OIDC authentication via Keycloak

```bash
stoa-gateway --mode=edge-mcp --port=3001
```

#### Configuration

```yaml
gateway:
  mode: edge-mcp
  mcp:
    protocol_version: "2024-11-05"
    transports:
      - http
      - websocket
      - sse
    tool_discovery:
      enabled: true
      cache_ttl: 300s
    rate_limiting:
      requests_per_minute: 1000
    authentication:
      type: jwt
      issuer: https://auth.<YOUR_DOMAIN>
```

### Proxy Mode

**Status**: 📋 Planned Q3 2026

Classic API gateway with policy enforcement:

- OPA policy evaluation
- Rate limiting per tenant/consumer
- Request/response transformation
- Circuit breaker patterns

```bash
stoa-gateway --mode=proxy --upstream=http://backend:8080
```

#### Configuration

```yaml
gateway:
  mode: proxy
  proxy:
    routing:
      strip_path: true
      preserve_host: false
    rate_limiting:
      enabled: true
      requests_per_second: 100
    authentication:
      type: jwt
      issuer: https://auth.<YOUR_DOMAIN>
    transforms:
      request:
        add_headers:
          X-Tenant-ID: "{{ .tenant }}"
      response:
        remove_headers:
          - X-Internal-Secret
```

### Sidecar Mode

**Status**: 📋 Planned Q2 2026

Deploy behind existing API gateways to add STOA capabilities:

- Observability injection (OpenTelemetry)
- Metering events to Kafka
- UAC compliance validation
- Error snapshot capture

```bash
stoa-gateway --mode=sidecar --primary-gateway=kong
```

#### Configuration

```yaml
gateway:
  mode: sidecar
  sidecar:
    upstream_gateway: kong  # or: webmethods, apigee, custom
    features:
      error_snapshot: true      # Time-travel debugging
      observability: true       # Prometheus, traces
      uac_validation: true      # Contract compliance
      pii_masking: true         # RGPD compliance
    passthrough:
      preserve_headers: true
      preserve_body: true
```

### Shadow Mode (💎 Killer Feature)

**Status**: 🔬 Experimental — Python shadow middleware exists in `mcp-gateway/src/middleware/shadow.py` (passive capture only, no modification). Rust implementation deferred to Q4 2026.

Passive traffic observation for legacy API discovery:

- Zero modification to requests/responses
- Capture traffic patterns
- Auto-generate UAC contracts (no ML, just HTTP parsing + heuristics)
- Human-in-the-loop validation before promotion

```bash
stoa-gateway --mode=shadow --target=http://legacy-erp:8080
```

#### Configuration

```yaml
gateway:
  mode: shadow
  shadow:
    capture:
      requests: true
      responses: true
      headers: true
      bodies: true  # PII masking applied
    uac_generation:
      enabled: true
      confidence_threshold: 0.8
      export_to_control_plane: true
      require_human_review: true
    target:
      backend: http://legacy-erp:8080
```

#### Security Deferral Checklist

Shadow mode captures potentially sensitive traffic. Implementation deferred until:

- [ ] PII detection/masking **before** Kafka emission
- [ ] Explicit opt-in per API/tenant (no silent capture)
- [ ] Retention policy &lt; 30 days with auto-purge
- [ ] Audit log: who accessed observations, when, why
- [ ] RGPD Article 25 (Privacy by Design) compliance documentation
- [ ] Team Coca security review sign-off

## Transition Strategy: Shadow → Proxy

For organizations migrating from observation to enforcement:

```yaml
gateway:
  mode: proxy
  shadow:
    keep_observing: true  # Dual-mode: enforce AND observe
  canary:
    enabled: true
    proxy_percentage: 10  # 10% through proxy, 90% direct
    observation_percentage: 100  # All traffic observed
```

### Migration Path

1. **Week 1-2**: Shadow mode — observe, generate UAC drafts
2. **Week 3**: Human review — validate contracts, adjust
3. **Week 4**: Canary — 10% through Proxy with enforcement
4. **Week 5-6**: Ramp up — 50%, 80%, 100%
5. **Week 7+**: Full Proxy — disable Shadow or keep for audit

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
4. **Cut over** when Rust achieves &gt;99.9% request compatibility

### Migration Phases

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Phase 16 | Now | ADR + documentation (this document) |
| Phase 17 | Q2 2026 | Rust gateway foundation + edge-mcp port |
| Phase 18 | Q3 2026 | proxy + sidecar modes |
| Phase 19 | Q4 2026 | shadow mode (after security review) |

## Configuration Reference

### Environment Variables

```bash
# Mode selection
GATEWAY_MODE=edge-mcp  # edge-mcp | sidecar | proxy | shadow

# Common settings
GATEWAY_PORT=3001
GATEWAY_LOG_LEVEL=info

# Keycloak (all modes)
KEYCLOAK_URL=https://auth.<YOUR_DOMAIN>
KEYCLOAK_REALM=stoa
KEYCLOAK_CLIENT_ID=stoa-gateway

# Mode-specific
SHADOW_TARGET_BACKEND=http://legacy:8080
SIDECAR_PRIMARY_GATEWAY=kong
PROXY_OPA_ENDPOINT=http://opa:8181
```

### Helm Values

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
    enabled: false  # Experimental — Python middleware exists, Rust deferred Q4 2026
```

## Consequences

### Positive

- **Clear naming**: one component, multiple modes
- **Single language** (Rust) for all new gateway code
- **Incremental migration** reduces risk
- **No breaking changes** during transition
- **Shadow mode differentiation**: Auto UAC generation from observed traffic

### Negative

- **Two codebases** during transition period
- **Documentation overhead**: must clarify "current (Python)" vs "target (Rust)"
- **Binary size**: Four modes in one binary may increase size (mitigated by feature flags)

## Validation

### OSS Contributor Persona

> *"Encore un projet qui veut tout faire? Shadow + Proxy + MCP + Sidecar dans le même binaire? Ça va être un monstre inmaintenable."*

**Response:**
- Core commun minimal (HTTP handling, auth, metrics)
- Modes = feature flags, not separate code branches
- Shadow is simplest (read-only)
- Complexity increases progressively: Shadow &lt; Proxy &lt; Sidecar &lt; Edge-MCP

### Enterprise Architect Persona

> *"Le mode Shadow c'est exactement ce qu'il nous faut pour les progiciels. On a 50 APIs non documentées, les éditeurs ne répondent plus, les devs d'origine sont partis."*

**Validated:**
- ✅ Shadow = minimal risk (passive, read-only)
- ✅ UAC generation = automatic documentation
- ✅ Natural progression: Shadow → Proxy → Full governance
- ✅ Compatible with existing gateways (sidecar mode)

> *"Par contre, comment on gère la transition Shadow → Proxy sans coupure?"*

**Response:**
- Dual-mode: Shadow continues observing while Proxy enforces
- Canary: 10% through Proxy, 90% direct, 100% observed
- Feature flag: `shadow.keep_observing=true` even in Proxy mode

## Commercial Pitch (30 seconds)

> "Got legacy APIs with no docs? Deploy STOA in Shadow mode for 2 weeks. It observes traffic and auto-generates interface contracts with minimal disruption to existing infrastructure. Then you decide: keep just the docs, or activate governance."

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [STOA UAC Schema](https://github.com/stoa-platform/stoa/blob/main/stoa-catalog/schemas/uac.schema.json)
- [Team Coca P0 Security Audit](./adr-018-security-hardening-p0.md)

## Decision Record

| Date | Decision | Author |
|------|----------|--------|
| 2026-01-26 | ADR created, unified architecture adopted | CAB-958 |
| 2026-01-26 | Shadow mode deferred for security review | Team Coca |
| 2026-01-26 | Added YAML configs, transition strategy, validation personas | CAB-958 |

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds ✅*
