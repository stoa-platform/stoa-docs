---
title: "ADR-036: Gateway Auto-Registration"
description: "Decides the automatic gateway registration mechanism where gateways self-register with the Control Plane on startup via heartbeat."
keywords: [gateway registration, auto-discovery, heartbeat, Control Plane, operations]
---

# ADR-036: Gateway Auto-Registration

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-02-06 |
| **Migrated from** | stoa repo ADR-028 (number conflict) |

## Context

STOA Control Plane currently requires manual gateway registration via `POST /v1/admin/gateways`. This creates operational friction:

- Operators must copy/paste UUIDs and URLs into registration requests
- Gateway restarts don't preserve registration state in stateless deployments
- Third-party gateways (Kong, Envoy, Apigee) require custom integration per vendor
- No real-time visibility into gateway health between explicit health checks

**Industry comparison:**

| Platform | Registration Model | Mechanism |
|----------|-------------------|-----------|
| Apple iCloud | Automatic | Device certificate + Apple ID |
| Kubernetes | Self-registration | Bootstrap tokens, kubelet heartbeat |
| HashiCorp Consul | Auto-join | Gossip protocol, agent heartbeat |
| HashiCorp Vault | Manual | Token-based unsealing |

The "Apple ecosystem" experience — where devices pair seamlessly — is the target UX for STOA gateways.

## Decision

Implement **Gateway Auto-Registration**: gateways self-register with the Control Plane at startup using a shared API key, then maintain presence via periodic heartbeat.

### Two-Tier Architecture

**Tier 1: STOA Native Gateways** (Full Integration)

- Zero-config: 2 environment variables only
  - `STOA_CONTROL_PLANE_URL` — Control Plane API endpoint
  - `STOA_CONTROL_PLANE_API_KEY` — Shared secret for authentication
- Gateway derives identity from hostname + mode + environment
- Full bidirectional integration:
  - API sync (CP → Gateway via admin API)
  - Policy push (CP → Gateway)
  - MCP tool registration
  - Metering to Kafka

**Tier 2: Third-Party Gateways (Sidecar Pattern)**

- Deploy STOA sidecar alongside existing gateway (Kong, Envoy, Apigee, NGINX, AWS)
- Sidecar auto-registers as `stoa_sidecar` type with reduced capability set
- Main gateway uses `ext_authz` filter → sidecar for policy/metering
- Sidecar provides: policy enforcement, rate limiting, metering, observability

### Registration Protocol

```
┌─────────────┐                    ┌─────────────────┐
│   Gateway   │                    │  Control Plane  │
└──────┬──────┘                    └────────┬────────┘
       │                                    │
       │  1. POST /v1/internal/gateways/register
       │     { hostname, mode, version,     │
       │       environment, capabilities,   │
       │       admin_url }                  │
       │  Header: X-Gateway-Key: gw_xxx    │
       ├───────────────────────────────────►│
       │                                    │
       │  2. 201 Created                    │
       │     { id, name, status: "online" } │
       │◄───────────────────────────────────┤
       │                                    │
       │  3. Every 30s: POST /{id}/heartbeat│
       │     { uptime, routes, policies,    │
       │       requests_total, error_rate } │
       ├───────────────────────────────────►│
       │                                    │
       │  4. 204 No Content                 │
       │◄───────────────────────────────────┤
       │                                    │
       │  [If no heartbeat for 90s]         │
       │                                    │
       │                    Gateway marked  │
       │                    OFFLINE         │
       │                                    │
```

### Identity Derivation

Instance name is deterministic: `{hostname}-{mode}-{environment}`

Examples:
- `stoa-gateway-7f8b9c-edgemcp-prod` — Production edge-mcp gateway
- `stoa-sidecar-kong-abc123-sidecar-staging` — Staging sidecar alongside Kong

This enables:
- Idempotent registration (same gateway re-registers on restart)
- Clear naming in Console UI
- Environment-based filtering

### Security Model

| Aspect | Design | Rationale |
|--------|--------|-----------|
| Authentication | Shared API key per environment | Simple, low barrier to adoption |
| Key transmission | `X-Gateway-Key` header over HTTPS | Standard header pattern |
| Key storage | K8s Secret, injected as env var | No secrets in code or config files |
| Key rotation | Comma-separated list supported | Rolling updates without downtime |
| Endpoint exposure | `/v1/internal/*` not on public ingress | Internal traffic only |

### Capabilities Declaration

Gateways declare capabilities at registration:

```json
{
  "capabilities": [
    "rest",
    "mcp",
    "sse",
    "oidc",
    "rate_limiting",
    "ext_authz",
    "metering"
  ]
}
```

Control Plane uses capabilities to:
- Filter which gateways can receive specific deployments
- Display accurate feature badges in Console UI
- Route MCP requests to capable gateways

## Consequences

### Positive

- **Zero friction onboarding**: Start gateway with 2 env vars → appears in Console within 5 seconds
- **Real-time status**: Heartbeat provides sub-minute visibility into gateway health
- **Unified experience**: Same registration pattern for native and sidecar gateways
- **Self-healing**: Gateway restart automatically re-registers, no manual intervention
- **Capability-aware routing**: CP knows what each gateway can handle
- **Idempotent**: Multiple registrations with same identity update rather than duplicate

### Negative

- **Shared secret model**: Compromised key allows rogue gateway registration
- **Network dependency**: Gateway requires CP connectivity at startup
- **Heartbeat traffic**: N gateways x 2 requests/min (negligible but non-zero)
- **Startup delay**: Gateway waits for registration response before serving traffic

### Mitigations

| Risk | Mitigation |
|------|------------|
| Rogue registration | Rate limit endpoint, log all registrations with source IP |
| CP unavailable at startup | Graceful degradation: gateway runs in standalone mode |
| Heartbeat traffic | Lightweight payload, exponential backoff on errors |
| Key compromise | Key rotation without restart, audit logging |

## Alternatives Considered

### 1. mTLS with Per-Gateway Certificates

**Pros**: Cryptographically strong identity, no shared secrets
**Cons**: Complex PKI setup, certificate rotation overhead
**Verdict**: Deferred to Phase 2 for high-security deployments

### 2. Push-Based Discovery (CP → Gateways)

**Pros**: CP controls timing, no registration endpoint needed
**Cons**: Requires network path from CP to all gateways, blocked by NAT/firewalls
**Verdict**: Rejected — pull model works across all network topologies

### 3. Kubernetes Service Discovery Only

**Pros**: Native K8s integration, no custom registration
**Cons**: K8s-only, doesn't work for VM/bare-metal deployments
**Verdict**: Rejected — STOA must support non-K8s environments

### 4. Manual Registration (Status Quo)

**Pros**: Explicit control, no new code
**Cons**: Operational friction, doesn't scale
**Verdict**: Remains available for brownfield integrations

## Implementation Notes

### Control Plane (Python)

1. New router: `src/routers/gateway_internal.py`
   - `POST /v1/internal/gateways/register` — Self-registration
   - `POST /v1/internal/gateways/{id}/heartbeat` — Heartbeat

2. New worker: `src/workers/gateway_health_worker.py`
   - Runs every 30s
   - Marks gateways OFFLINE if `last_health_check < now() - 90s`

3. Config: `STOA_GATEWAY_API_KEYS` — Comma-separated list of valid keys

### STOA Gateway (Rust)

1. New module: `src/control_plane/registration.rs`
   - `GatewayRegistrar::register()` — Called at startup
   - `GatewayRegistrar::start_heartbeat()` — Background tokio task

2. Config additions:
   - `environment` — For identity derivation (default: "dev")

### New Gateway Type

Add `STOA_SIDECAR` to `GatewayType` enum for sidecars with reduced capabilities.

## Implementation Status

| Component | Status | PR |
|-----------|--------|-----|
| Control Plane API — registration, heartbeat, health worker | ✅ Complete | — |
| Control Plane API — config fetch (real deployments/policies) | ✅ Complete | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| STOA Gateway (Rust) — registration, heartbeat with real metrics | ✅ Complete | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| STOA Gateway (Rust) — deep readiness probe (CP + OIDC checks) | ✅ Complete | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| Console UI — auto-refresh, detail panel, live indicator | ✅ Complete | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| Helm chart — `control-plane-api-key` in deployment + ExternalSecret | ✅ Complete | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| K8s deployment.yaml — secret documentation | ✅ Complete | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| Sidecar mode (Tier 2) | Planned | Q2 2026 |
| mTLS per-gateway certificates | Planned | Phase 2 |

## Related ADRs

- [ADR-035: Gateway Adapter Pattern](./adr-035-gateway-adapter-pattern.md) — Defines the interface used by CP to orchestrate gateways
- [ADR-024: Unified Gateway Architecture](./adr-024-gateway-unified-modes.md) — Defines edge-mcp, sidecar, proxy, shadow modes
- [ADR-037: Deployment Modes — Sovereign First](./adr-037-deployment-modes-sovereign-first.md) — Deployment strategy

## References

- [Kubernetes Node Heartbeats](https://kubernetes.io/docs/concepts/architecture/nodes/#heartbeats)
- [HashiCorp Consul Agent Registration](https://developer.hashicorp.com/consul/docs/services/usage/register-services-checks)
- [Apple Device Enrollment](https://developer.apple.com/documentation/devicemanagement)
