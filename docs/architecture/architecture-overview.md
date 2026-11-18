---
sidebar_position: 2
title: Architecture Overview
description: High-level architecture of STOA Platform — current production stack and target Envoy data plane (ADR-073, ADR-074, ADR-075)
keywords: [architecture, overview, control plane, data plane, Envoy, xDS, Kubernetes, design]
---

# Architecture Overview

> **Current Production & Target Data Plane** — Verified against `stoa-platform/stoa` (`main`)

STOA Platform is an open-source, cloud-native, multi-tenant gateway platform built for both traditional APIs and AI agents. This document separates two explicit views:

1. **Current Production Stack** — What runs today on `stoa-platform/stoa` `main`
2. **Target Envoy Data Plane ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane))** — How L4/L7 proxy duties are converging onto upstream Envoy while STOA retains the Control Plane, authorization, MCP protocol layer, and Link control loop

---

## Current Production Architecture

```mermaid
flowchart TB
    subgraph Ingress["🔒 Ingress Layer"]
        Ing["Ingress Controller + TLS<br/>*.example.com"]
    end

    subgraph UIs["👥 User Interfaces"]
        Portal["📱 Developer Portal<br/>portal.example.com (React 19)"]
        Console["🖥️ Admin Console<br/>console.example.com (React 19)"]
        CLI["⌨️ stoactl (Go 1.25)"]
    end

    subgraph Core["⚙️ Control Plane & Operator"]
        API["Control Plane API<br/>api.example.com<br/>(FastAPI / Python 3.11)"]
        Op["stoa-operator<br/>(Python / Kopf — Beta)"]
    end

    subgraph DP["🚀 Data Plane & Link"]
        GW["STOA Gateway<br/>mcp.example.com<br/>(Rust / Tokio / axum — Maintenance)"]
        Link["STOA Link (stoa-connect, Go)<br/>Kong/Gravitee/webMethods + opt-in Envoy ADS"]
    end

    subgraph Auth["🔐 Identity & Secrets"]
        KC["Keycloak 26<br/>auth.example.com<br/>Single 'stoa' realm (ADR-074)"]
        Vault["OpenBao 2.7.2 (Vault HTTP API)<br/>Secrets Backend (ADR-075)"]
    end

    subgraph Data["💾 Data & Event Layer"]
        PG["PostgreSQL 15 / 16<br/>Shared schema + tenant_id"]
        Kafka["Redpanda (Kafka API)<br/>Metering & Audit<br/>🔒 Internal Only (ADR-005)"]
        OS["OpenSearch + Data Prepper<br/>Logs & Audit Search"]
    end

    subgraph Obs["📊 Observability"]
        Prom["Prometheus + Alertmanager"]
        Graf["Grafana"]
        Tempo["Tempo (OTLP Traces)"]
    end

    Ing --> Portal & Console & API & GW & KC
    CLI --> API & GW
    Portal & Console --> API
    API --> KC & Vault & PG & Kafka & OS
    Op --> API
    GW --> KC & Kafka
    GW -->|"Fetch signed policies & routes"| API
    Link -->|"Outbound SSE (ADR-059), pull & heartbeat"| API
    Core & DP --> Prom --> Graf
    Core & DP --> Tempo
```

### Core Services on `main`

| Component | Endpoint / Scope | Lifecycle | Stack |
|-----------|------------------|-----------|-------|
| **Developer Portal** | `portal.<domain>` | ✅ Production | React 19, TypeScript (`portal/`) |
| **Admin Console** | `console.<domain>` | ✅ Production | React 19, TypeScript (`control-plane-ui/`) |
| **Control Plane API** | `api.<domain>` | ✅ Production | Python 3.11, FastAPI, SQLAlchemy (`control-plane-api/`) |
| **STOA Gateway** | `mcp.<domain>` / `:8080` | ✅ Production / Maintenance ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | Rust, Tokio, axum, tonic (`stoa-gateway/`) |
| **STOA Link (`stoa-connect`)** | On-premise / cluster agent (`:8090`) | Route adapters implemented (Kong/Gravitee/webMethods) / Opt-in Envoy ADS | Go 1.25 (`stoa-go/cmd/stoa-connect`) |
| **`stoactl` CLI** | Operator workstation / CI | ✅ Production (built from `stoa-go/`) | Go 1.25 (`stoa-go/cmd/stoactl`) |
| **`stoa-operator`** | In-cluster (`GatewayInstance`, `GatewayBinding`) | 🧪 Beta | Python, Kopf (`stoa-operator/`) |
| **Keycloak** | `auth.<domain>` (`stoa` realm) | ✅ Production | Keycloak 26 ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) |
| **OpenBao** | Internal Vault HTTP API | 🔄 Partial rollout | OpenBao 2.7.2, MPL 2.0 ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) |
| **Redpanda** | Internal cluster network only | ✅ Production | Redpanda / Kafka API ([ADR-005](/docs/architecture/adr/adr-005-event-driven-kafka)) |
| **PostgreSQL** | Internal cluster network only | ✅ Production | PostgreSQL 15 (full Compose / prod catalog) or 16 (R1 `quickstart/`), shared schema (`tenant_id`) |
| **Observability** | Internal / operator ingress | ✅ Production | Prometheus, Grafana, OpenSearch, Data Prepper, Tempo |

### Key Architectural Guarantees Implemented on `main`

- **Single-realm tenant identity ([ADR-074](/docs/architecture/adr/adr-074-tenant-model))**: One shared Keycloak realm (`stoa`), one top-level Keycloak group per tenant (`/<tenant_id>`, `setup_tenant_group`), verified `tenant_id` JWT claims (`Claims::tenant_id()` / `require_tenant` on the gateway and `require_tenant_access` in Python, with `enforce_tenant_isolation` as the Rust `RbacPolicy` boolean setting), and a shared PostgreSQL schema filtered by `tenant_id` (retiring the older realm-per-tenant draft in ADR-026).
- **Fail-closed gateway posture ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture))**: `stoa-gateway` verifies Ed25519-signed per-tenant policy bundles (`STOA_POLICY_BOOT_TENANTS`), enforces `STOA_MCP_AUDIENCE`, and maintains a durable audit WAL spool (`STOA_AUDIT_SPOOL_DIR`).
- **MCP `2025-11-25` & Contract Routes**: Streamable HTTP (`POST /mcp`), SSE (`/mcp/sse`), opt-in WebSocket (`/mcp/ws` via `STOA_WEBSOCKET_ENABLED=true`), and transactional REST + MCP route registration (`POST /admin/contracts`).
- **Multi-Gateway Orchestration ([ADR-035](/docs/architecture/adr/adr-035-gateway-adapter-pattern))**: The Control Plane provides 6 Python gateway adapters (Kong, Gravitee, webMethods, Apigee, AWS API Gateway, Azure APIM), while the on-site `stoa-connect` Go agent implements route adapters for Kong, Gravitee (no Gravitee client in production yet; HTTP `409` route conflicts are masked), and webMethods, plus explicit opt-in Envoy loopback ADS — Link policy application is rejected (`unsupported` in `policy_contract.go`) for Kong and Gravitee, and active for webMethods and Envoy ADS v1 filters (`cors`, `rate_limit`, `ip_filter`), without routing deployment commands over Kafka.
- **No Redis Dependency**: Rate-limiting, JWKS, and token caches operate in-process; STOA does not deploy or require Redis.

### Public Git Repositories

| Repository | Purpose |
|------------|---------|
| `stoa-platform/stoa` | Monorepo: Control Plane API, UIs, `stoa-gateway`, `stoa-go` (`stoactl` + `stoa-connect`), `stoa-operator`, `quickstart/`, `deploy/docker-compose/`, and Helm charts (`charts/stoa-platform`, `charts/stoa-observability`) |
| `stoa-platform/stoa-docs` | Documentation site (`docs.gostoa.dev`) |
| `stoa-platform/stoa-web` | Landing site (`gostoa.dev`) |

*(Note: Helm charts live inside `stoa-platform/stoa/charts/`; there is no separate active `stoa-helm` chart release repository.)*

### Synchronization Flow

```mermaid
sequenceDiagram
    participant Dev as Operator / GitOps
    participant CP as Control Plane API
    participant Link as STOA Link (stoa-connect)
    participant GW as Target Gateway (Envoy / Kong / Gravitee / webMethods)

    Link->>CP: Open outbound SSE stream (ADR-059) & register
    Dev->>CP: Declare API / Contract / Binding
    CP-->>Link: Stream deployment notification over Link-opened SSE
    Link->>CP: Pull desired route/policy snapshot (HTTPS)
    Link->>GW: Apply routes & policies (Admin API or loopback mTLS ADS)
    GW-->>Link: Sync acknowledgement
    Link->>CP: Heartbeat & reconciliation ACK
```

:::caution Event Backbone vs Config Sync
Control Plane synchronization is **not** Kafka-driven ([ADR-059](/docs/architecture/adr/adr-059-simplified-deployment-sse)). Redpanda/Kafka is strictly internal for asynchronous metering, audit, and error snapshots ([ADR-005](/docs/architecture/adr/adr-005-event-driven-kafka)).
:::

---

## Target Data Plane Architecture ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane))

Rather than building a custom kernel/eBPF proxy or rewriting the Control Plane in Go, [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) delegates commodity L4/L7 proxy functions (TLS/mTLS, HTTP/1-2-3, connection pooling, retries, circuit breaking) to **upstream Envoy** while keeping STOA's differentiators in dedicated processes:

```mermaid
flowchart TB
    Client["API Client / AI Agent"] --> Envoy["Upstream Envoy Proxy<br/>TLS, HTTP/2, Native Filters"]
    Link["STOA Link (stoa-connect, Go)<br/>Loopback mTLS xDS ADS (127.0.0.1:18000)"] -->|"Outbound SSE & pull"| CP["Control Plane API<br/>(FastAPI)"]
    Link -->|"CDS / LDS / RDS"| Envoy
    Envoy -->|"gRPC ext_authz Check"| Authz["STOA ExtAuthzService (Rust)<br/>JWT, tenant_id, aud/scopes & DecisionEngine"]
    Envoy -->|"MCP routes"| MCPMod["STOA MCP Module (Rust)<br/>JSON-RPC tools/call, SSE & signed tool policy (ADR-070)"]
    Envoy -->|"REST / gRPC routes"| Upstream["Enterprise Backends"]
```

### Delivered Building Blocks vs Pending Migration on `main`

| Capability | Status on `main` | Implementation Proof |
|------------|------------------|----------------------|
| **Loopback mTLS xDS ADS server in `stoa-connect`** | ✅ Implemented (opt-in via `STOA_GATEWAY_TYPE=envoy`) | `stoa-go/cmd/stoa-connect/envoy.go`, `stoa-go/cmd/stoa-connect/ENVOY.md`; translates v1 `cors`, per-process `rate_limit`, and direct-peer `ip_filter` |
| **gRPC `ExtAuthzService` in `stoa-gateway`** | ✅ Implemented (opt-in via `STOA_EXT_AUTHZ_GRPC_ADDR`, `STOA_EXT_AUTHZ_AUDIENCE`, and non-empty `STOA_EXT_AUTHZ_REQUIRED_SCOPES` in `prod`) | `stoa-gateway/src/authz/ext_authz_grpc.rs`, `stoa-gateway/src/config/loader.rs:212-223` (validates JWT, `tenant_id`, audience/scopes & `DecisionEngine`; distinct from MCP tool-permission JWS checks) |
| **Offline Envoy + Link + gRPC acceptance harness** | 🧪 Manual offline harness (`workflow_dispatch`) | `docs/testing/o1-offline-envoy.md`, `.github/workflows/o1-envoy-real-proof.yml` (real Envoy + Link + independent gRPC `Check` witness + synthetic auth/SQLite; not an automated per-PR CI check or live Rust `ExtAuthzService`/JWT test) |
| **Full policy translator parity** | 🚧 In progress | `jwt_validation`, OIDC, `logging`, `caching`, and `transform` are not yet translated into Envoy filters by `stoa-connect` |
| **Streaming `ext_proc` & standalone MCP split** | 📋 Planned ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | Token metering / guardrail `ext_proc` and decoupling MCP from standalone proxy listener |
| **Default Helm & Compose topology cut-over** | 📋 Planned | `charts/stoa-platform` and `deploy/docker-compose/` still deploy `stoa-gateway` directly as the default ingress gateway |

See [Data Plane Architecture](/docs/architecture/data-plane) for line-level code references and migration phases.

---

## Deployed Kubernetes CRDs (`gostoa.dev/v1alpha1`)

Five Custom Resource Definitions are shipped today in `charts/stoa-platform/crds/` under the `gostoa.dev/v1alpha1` API group:

- **Watched by `stoa-gateway`** (`STOA_K8S_ENABLED=true`, compiled with the `k8s` Cargo feature): `Tool`, `ToolSet`, `Skill`
- **Reconciled by `stoa-operator`**: `GatewayInstance`, `GatewayBinding`

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: billing-api
  namespace: stoa-system
spec:
  displayName: Billing API
  description: Query customer invoices
  endpoint: https://billing.internal.example.com/v1/invoices
  method: GET
  inputSchema:
    type: object
    properties:
      customer_id:
        type: string
---
apiVersion: gostoa.dev/v1alpha1
kind: GatewayInstance
metadata:
  name: prod-edge-mcp
  namespace: stoa-system
spec:
  displayName: Production Edge MCP Gateway
  gatewayType: stoa_edge_mcp
  environment: prod
  baseUrl: https://mcp.example.com
```

See the [Kubernetes CRDs Reference](/docs/reference/crds) for complete schemas and enforced enum values.

---

## Technology Stack Comparison

| Layer | Current Production (`main`) | Target Evolution |
|-------|-----------------------------|------------------|
| **L4/L7 Data Plane** | `stoa-gateway` (Rust, Tokio, axum — Maintenance) | Upstream Envoy + `stoa-connect` loopback mTLS ADS ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) |
| **Authorization Engine** | In-process Rust middleware + OPA + signed policies ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) | Rust `ExtAuthzService` gRPC server called by Envoy (`STOA_EXT_AUTHZ_GRPC_ADDR`) |
| **MCP Protocol Layer** | Integrated in `stoa-gateway` (Rust) | Dedicated Rust MCP service behind Envoy |
| **Control Plane API** | Python 3.11, FastAPI | Python 3.11, FastAPI |
| **CLI & Link Agent** | Go 1.25 (`stoactl`, `stoa-connect`) | Go 1.25 (`stoactl`, `stoa-connect` / STOA Link) |
| **Kubernetes Operator** | Python, Kopf (`stoa-operator`, Beta) | Python, Kopf (`stoa-operator`) |
| **Frontend** | React 19, TypeScript, Tailwind | React 19, TypeScript, Tailwind |
| **Database** | PostgreSQL 15 / 16 (shared schema, `tenant_id`) | PostgreSQL 15 / 16 ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) |
| **Event Backbone** | Redpanda (Kafka API, internal only) | Redpanda ([ADR-005](/docs/architecture/adr/adr-005-event-driven-kafka)) |
| **Identity** | Keycloak 26 (single `stoa` realm, tenant groups) | Keycloak 26 ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) |
| **Secrets** | OpenBao 2.7.2 / Vault HTTP API (partial rollout) | Full OpenBao / Vault HTTP API coverage ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) |
| **Observability** | Prometheus, Grafana, OpenSearch, Data Prepper, Tempo | OpenTelemetry-native metrics, logs, and traces |

---

## Security Zones

| Zone | Trust Level | Components |
|------|-------------|------------|
| **External** | Untrusted | API Clients, AI Agents, Browser UIs |
| **DMZ** | Semi-trusted | Ingress Controller, `stoa-gateway`, Envoy + `stoa-connect` |
| **Internal** | Trusted | Control Plane API, `stoa-operator`, Keycloak, PostgreSQL, Redpanda, OpenBao, OpenSearch |

Key security principles:
- Redpanda/Kafka has **zero external exposure** ([ADR-005](/docs/architecture/adr/adr-005-event-driven-kafka))
- Multi-tenant isolation uses a single `stoa` Keycloak realm, per-tenant groups, and verified `tenant_id` JWT claims ([ADR-074](/docs/architecture/adr/adr-074-tenant-model))
- Gateway tool authorization fails closed on missing or invalid signed policy bundles ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture))
- Declarative GitOps delivery with Argo CD ([ADR-007](/docs/architecture/adr/adr-007-gitops-argocd)) and digest-pinned Helm images
- Secrets managed through the Vault HTTP API backend: OpenBao by default ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao))

---

## Related Documents

- [Data Plane Architecture](/docs/architecture/data-plane) — Detailed Envoy + STOA Link + `ext_authz` architecture
- [Gateway Deployment Modes](/docs/concepts/gateway) — `edge-mcp`, `sidecar`, `proxy`, and `shadow`
- [Architecture Decision Records (ADRs)](/docs/architecture/adr) — Full decision log
- [Kubernetes CRDs Reference](/docs/reference/crds) — `gostoa.dev/v1alpha1` schemas
