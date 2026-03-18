# ADR-059: STOA Connect — VPS Gateway Agent Architecture

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-03-18 |
| **Tickets** | CAB-1870, CAB-1871 |
| **Author** | Christophe Aboulicam |
| **PRs** | stoa #1851 (monorepo move), #1853 (OTel core), #1855 (VPS connectivity), #1856 (ingress fix) |

## Context

STOA Platform manages multiple API gateways (Kong, Gravitee, webMethods, Apigee, Azure APIM) via the **Adapter pattern** in the Control Plane API. These adapters work well when the gateway admin API is network-reachable from the K8s cluster. However, on-premise and VPS-hosted gateways sit behind firewalls where inbound connections from the Control Plane are impossible.

**stoa-connect** solves this by running as a lightweight agent _alongside_ the gateway on the VPS. It initiates outbound connections to the Control Plane, reversing the communication direction. No inbound ports, no VPN, no firewall changes required.

### Requirements

1. Bridge VPS-hosted gateways to the Control Plane without inbound connectivity
2. Auto-discover APIs on the local gateway and report them to the CP
3. Sync policies from the CP to the local gateway (rate limits, CORS, auth)
4. Provide distributed tracing visibility into VPS agents from Grafana
5. Run as a single static binary with zero dependencies (systemd, no Docker)

## Decision

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ VPS (Contabo / OVH / On-Premise)                                │
│                                                                  │
│  ┌──────────────┐    admin API     ┌──────────────────────────┐ │
│  │  Kong /       │ ◄──────────────  │  stoa-connect            │ │
│  │  Gravitee /   │                  │  (Go binary, systemd)    │ │
│  │  webMethods   │                  │                          │ │
│  └──────────────┘                  │  - Registration          │ │
│                                     │  - Heartbeat (30s)       │ │
│                                     │  - Discovery loop (60s)  │ │
│                                     │  - Policy sync loop      │ │
│                                     │  - OTel traces           │ │
│                                     └──────────┬───────────────┘ │
└──────────────────────────────────────────────────┼───────────────┘
                                                   │ outbound HTTPS
                                    ┌──────────────▼──────────────┐
                                    │  Control Plane API           │
                                    │  api.gostoa.dev              │
                                    │                              │
                                    │  POST /v1/internal/gateways/ │
                                    │    register                  │
                                    │    {id}/heartbeat            │
                                    │    {id}/discovery            │
                                    │    {id}/config               │
                                    │    {id}/sync-ack             │
                                    └──────────────────────────────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  otlp.gostoa.dev             │
                                    │  (nginx ingress → Alloy)     │
                                    │  OTLP/HTTP, basic auth       │
                                    └──────────────────────────────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  Grafana (Tempo)             │
                                    │  console.gostoa.dev          │
                                    └──────────────────────────────┘
```

### CP Registration Protocol

stoa-connect registers with `gateway_mode="connect"` at startup:

| Step | Endpoint | Method | Payload |
|------|----------|--------|---------|
| Register | `/v1/internal/gateways/register` | POST | hostname, mode, version, capabilities |
| Heartbeat | `/v1/internal/gateways/{id}/heartbeat` | POST | uptime, routes_count, discovered_apis |
| Discovery | `/v1/internal/gateways/{id}/discovery` | POST | discovered API list |
| Fetch Config | `/v1/internal/gateways/{id}/config` | GET | — |
| Sync Ack | `/v1/internal/gateways/{id}/sync-ack` | POST | synced_policies results |

Auth: `X-Gateway-Key` header (shared secret per gateway instance).

### Gateway Adapter Interface (Local)

stoa-connect uses a local adapter interface (`adapters.GatewayAdapter`) to interact with the co-located gateway admin API:

```go
type GatewayAdapter interface {
    DiscoverAPIs(ctx context.Context, adminURL string) ([]DiscoveredAPI, error)
    ApplyPolicy(ctx context.Context, adminURL, name string, action PolicyAction) error
    RemovePolicy(ctx context.Context, adminURL, name string, policyType string) error
}
```

Implementations: `KongAdapter` (DB-less `/config`), `GraviteeAdapter` (Management API v2). New adapters follow the same interface — one file, three methods.

### OpenTelemetry Instrumentation

Every agent operation creates OTel spans with semantic attributes:

| Span | Key Attributes |
|------|---------------|
| `stoa-connect.register` | `stoa.instance_name`, `stoa.environment`, `stoa.gateway_id` |
| `stoa-connect.heartbeat` | `stoa.gateway_id`, `stoa.uptime_seconds`, `stoa.discovered_apis` |
| `stoa-connect.discovery` | `stoa.gateway_id`, `stoa.discovered_apis` |
| `stoa-connect.sync` | `stoa.gateway_id`, `stoa.pending_policies` |
| `stoa-connect.sync.fetch-config` | `stoa.gateway_id`, `stoa.pending_policies` |
| `stoa-connect.sync.ack` | `stoa.policies_applied`, `stoa.policies_removed`, `stoa.policies_failed` |

HTTP client is wrapped with `otelhttp.NewTransport` for automatic W3C `traceparent` propagation to the Control Plane API.

#### Graceful Degradation

If `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, a no-op tracer is used (zero overhead). The same binary works with or without a collector.

#### OTLP Export Path (VPS → K8s)

```
stoa-connect → OTLP/HTTP (port 4318) → otlp.gostoa.dev (nginx ingress, basic auth)
             → Alloy (collector, monitoring namespace)
             → Tempo (trace storage)
             → Grafana (visualization)
```

- **Protocol**: OTLP/HTTP (not gRPC) — HTTP/1.1 works natively through nginx ingress without extra config
- **Auth**: Basic auth via `OTEL_EXPORTER_OTLP_HEADERS` env var (nginx ingress `auth-type: basic`)
- **TLS**: Let's Encrypt via cert-manager (`letsencrypt-prod` ClusterIssuer)
- **Endpoint detection**: URLs starting with `http://` or `https://` use OTLP/HTTP; plain `host:port` uses OTLP/gRPC (for K8s-internal use)

### Deployment Model

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Binary | Single static Go binary | Zero dependencies, easy to deploy via SCP |
| Process manager | systemd | Standard on all Linux VPS, restart on failure |
| Config | `EnvironmentFile=/opt/secrets/stoa-connect.env` | Vault Agent renders secrets into env file |
| Security | `NoNewPrivileges`, `ProtectSystem=strict`, `ReadOnlyPaths=/` | systemd hardening |
| Source repo | `stoa/stoa-go/` (monorepo) | Shared Go modules with stoactl (CAB-1871) |

### Environment Variables

| Variable | Source | Required | Description |
|----------|--------|----------|-------------|
| `STOA_CONTROL_PLANE_URL` | Vault | Yes | CP API base URL |
| `STOA_GATEWAY_API_KEY` | Vault | Yes | `X-Gateway-Key` for internal endpoints |
| `STOA_INSTANCE_NAME` | systemd | No | Instance identifier (defaults to hostname) |
| `STOA_ENVIRONMENT` | systemd | No | Environment name (defaults to `production`) |
| `STOA_HEARTBEAT_INTERVAL` | systemd | No | Heartbeat interval (default `30s`) |
| `STOA_CONNECT_PORT` | systemd | No | Health endpoint port (default `8090`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | systemd | No | OTLP collector URL (no-op if absent) |
| `OTEL_EXPORTER_OTLP_HEADERS` | Vault | No | Basic auth header for OTLP ingress |
| `OTEL_SAMPLE_RATE` | systemd | No | Trace sample rate 0.0-1.0 (default `1.0`) |
| `STOA_DISCOVERY_GATEWAY_ADMIN_URL` | Vault | No | Local gateway admin API URL |
| `STOA_DISCOVERY_GATEWAY_TYPE` | env | No | Gateway type: `kong`, `gravitee` |
| `STOA_DISCOVERY_INTERVAL` | env | No | Discovery loop interval (default `60s`) |

## Consequences

### Positive

- **No inbound firewall rules**: VPS agents initiate all connections outbound
- **Zero-dependency binary**: No Docker, no runtime, no package manager — just SCP and systemd
- **Full observability**: Distributed traces from VPS visible in Grafana alongside K8s services
- **Graceful degradation**: Binary works identically with or without OTel collector
- **Adapter extensibility**: Adding a new gateway type = one file with three methods

### Negative

- **Pull-based sync**: Policies sync on interval (60s), not push. Acceptable for config changes but not for real-time enforcement
- **Single binary per VPS**: No HA — if the agent crashes, systemd restarts it but there's a brief gap
- **Basic auth for OTLP**: Not mTLS. Acceptable because traces contain no PII and the channel is TLS-encrypted

### Risks

| Risk | Mitigation |
|------|-----------|
| VPS agent sends stale heartbeats | CP marks gateway "unhealthy" after 3 missed heartbeats (90s) |
| OTLP ingress becomes a bottleneck | Alloy batch processor + 4MB payload limit + 30s read timeout |
| Gateway admin API unavailable | Adapter returns error, sync-ack reports "failed", retries next cycle |
| Vault Agent not yet deployed on workers | Static env file as interim solution (CAB-1799 for Vault Agent) |

## Related

- [ADR-024: Gateway Modes](/architecture/adr/adr-024-gateway-modes) — edge-mcp, sidecar, proxy, shadow + connect
- [Gateway Adapters](/concepts/gateway) — adapter pattern for multi-gateway orchestration
- CAB-1799: Vault Agent on VPS services (Phase 3 of secrets MEGA)
