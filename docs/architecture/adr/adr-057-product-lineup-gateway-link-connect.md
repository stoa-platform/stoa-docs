# ADR-057: Product Lineup — STOA Gateway, STOA Link, STOA Connect

- **Status**: Accepted
- **Date**: 2026-03-14
- **Decision Makers**: Christophe Aboulicam
- **Related**: ADR-024 (Gateway Modes), CAB-1817 (STOA Connect MEGA), CAB-1783 (STOA Link deployment)

## Context

STOA Platform connects APIs to the MCP ecosystem following the "Define Once, Expose Everywhere" principle. As adoption grows across different infrastructure profiles (cloud-native K8s, hybrid, bare-metal on-prem), a single deployment model cannot serve all customers.

We now have three distinct runtime products, each targeting a different deployment context. This ADR formalizes the product lineup, their boundaries, and the decision criteria for choosing between them.

## Decision

### Product Lineup

| Product | Runtime | Tech | Distribution | Primary Use Case |
|---------|---------|------|-------------|-----------------|
| **STOA Gateway** | Full MCP gateway | Rust (Tokio, axum) | Helm chart, K8s | Standalone AI-native gateway — MCP serving, tool discovery, auth chain, policies |
| **STOA Link** | Sidecar | Rust (same binary, sidecar mode) | K8s sidecar pod (ArgoCD) | Policy enforcement alongside third-party gateways in K8s (Kong, Gravitee, webMethods, agentGateway) |
| **STOA Connect** | Lightweight agent | Go | `brew install` / apt / binary | Connect third-party gateways to STOA Control Plane without Docker or K8s |

### Architectural Boundaries

```
                    ┌─────────────────────────────────────────┐
                    │          STOA Control Plane              │
                    │   (API, Console, Auth, Portal)           │
                    └────┬──────────┬──────────┬──────────────┘
                         │          │          │
              Registration + Heartbeat Protocol (shared)
                         │          │          │
                ┌────────┴───┐ ┌────┴────┐ ┌───┴──────────┐
                │   Gateway  │ │  Link   │ │   Connect    │
                │   (Rust)   │ │ (Rust)  │ │   (Go)       │
                │            │ │         │ │              │
                │ MCP Serve  │ │ MCP Srv │ │ NO MCP       │
                │ Tool Disc  │ │ Tool Ds │ │ GW Discovery │
                │ Auth Chain │ │ Policy  │ │ Policy Sync  │
                │ Rate Limit │ │ Enforce │ │ Health Mon   │
                │ Metering   │ │ Meter   │ │              │
                └────────────┘ └─────────┘ └──────────────┘
                   K8s only      K8s only    Anywhere
                  (Helm/Argo)  (sidecar pod) (brew/apt/bin)
```

**Critical boundary**: STOA Connect does **NOT** serve MCP protocol. It is a management agent that syncs configuration and policies between the Control Plane and a third-party gateway's admin API. MCP serving remains exclusive to the Rust runtime (Gateway and Link).

### Decision Matrix — When to Choose What

```
Has K8s cluster?
├── YES
│   ├── Want full MCP gateway (replace existing)?
│   │   └── YES → STOA Gateway
│   │   └── NO → Keep existing gateway
│   │       ├── Want MCP + full policy enforcement?
│   │       │   └── YES → STOA Link (sidecar)
│   │       └── Want lightweight policy sync only?
│   │           └── YES → STOA Connect (can run in K8s too)
│   │           └── NO → STOA Link (sidecar)
└── NO (VPS, bare metal, VM)
    └── STOA Connect (only option without K8s)
```

| Criterion | Gateway | Link | Connect |
|-----------|---------|------|---------|
| **K8s required** | Yes | Yes | No |
| **Docker required** | Yes | Yes | No |
| **MCP protocol serving** | Yes | Yes | **No** |
| **Tool discovery** | Yes | Yes | No |
| **Policy enforcement** | Full (inline) | Full (sidecar) | Sync (push to GW admin API) |
| **Auth chain (mTLS, OIDC)** | Yes | Yes | Delegated to GW |
| **Metering/telemetry** | Yes | Yes | Health reporting only |
| **Latency overhead** | ~1-3ms (inline) | ~2-5ms (sidecar hop) | 0ms (out-of-band sync) |
| **Binary size** | ~15MB | ~15MB (same binary) | ~8MB |
| **Install time** | Helm deploy (~2min) | ArgoCD sync (~1min) | `brew install` (~10s) |
| **Gateway support** | Standalone (no GW) | Kong, Gravitee, wM, agentGW | Kong, Gravitee, wM |

### CP Registration Protocol (Stable Contract)

All three products share the same registration protocol with the Control Plane:

```
POST /v1/internal/gateways/register
{
  "instance_name": "kong-prod-01",
  "gateway_mode": "edge_mcp" | "sidecar" | "connect",
  "version": "0.12.0",
  "features": ["mcp", "policies", "metering"],
  "environment": "production"
}
→ 200 { "gateway_id": "uuid", "heartbeat_interval_s": 30 }

POST /v1/internal/gateways/{gateway_id}/heartbeat
{
  "status": "healthy",
  "uptime_s": 3600,
  "metrics": { "requests_total": 1234 }
}
→ 200 OK
```

**Contract guarantees**:
- Endpoint paths are stable (no breaking changes without ADR)
- `gateway_mode` enum: `edge_mcp`, `sidecar`, `connect` (new modes require ADR)
- Heartbeat interval: server-defined (currently 30s), client must respect
- All instances appear on Console `/gateways/modes` page with their mode

### Shared Code (Go monorepo)

STOA Connect and stoactl share code via `github.com/stoa-platform/stoa-go`:

```
stoa-go/
├── cmd/stoactl/          # CLI tool
├── cmd/stoa-connect/     # Connect agent
├── pkg/auth/             # OIDC/PKCE + keyring (shared)
├── pkg/config/           # Multi-context YAML config (shared)
├── pkg/client/           # CP API HTTP client (shared)
└── internal/connect/     # Connect-specific runtime
```

## Consequences

### Positive
- Clear product-market fit for each segment (cloud-native, hybrid, on-prem)
- "Define Once, Expose Everywhere" becomes concrete with 3 deployment paths
- Shared registration protocol ensures consistent Console experience
- Go agent lowers barrier to entry (no K8s/Docker dependency)
- Shared Go packages reduce maintenance (stoactl + Connect)

### Negative
- Three runtimes to maintain (Rust x2 modes + Go)
- Risk of protocol divergence between Rust and Go implementations
- Connect cannot offer MCP serving — customers wanting MCP must use Gateway or Link
- Go agent feature parity will lag behind Rust runtime

### Mitigations
- CP registration protocol is the integration contract — tested by both runtimes
- Connect scope is deliberately limited (no MCP) — prevents feature creep
- Shared Go packages ensure auth/config consistency with stoactl
- Arena L2 platform verification covers all three products

## Alternatives Considered

1. **Single Rust binary for all modes** — Rejected: Rust binary requires Docker/K8s toolchain. Customers without K8s cannot use it. Go provides native install via `brew`/`apt`.

2. **Python agent (reuse CP API codebase)** — Rejected: Python requires runtime. Go produces static binaries. Also, stoactl is already Go — sharing code is natural.

3. **No lightweight agent (Link-only)** — Rejected: Excludes the on-prem VPS market entirely. Many European enterprises run gateways on bare metal.
