---
sidebar_position: 1
title: "ADR-001: Third-Party API Exposure Strategy"
description: "Decides the public API facade strategy for exposing third-party APIs through STOA with unified authentication and governance."
keywords: [API exposure, public facade, third-party APIs, API governance, strategy]
---

# ADR-001: Third-Party API Exposure Strategy — Public API Façade

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 18 January 2026 |
| **Linear** | [CAB-669](https://linear.app/hlfh-workspace/issue/CAB-669) (Epic) |

## Context

STOA Platform evolves with several components in parallel: Control-Plane API (FastAPI), MCP Gateway, Developer Portal (React), Console (React), and webMethods Gateway.

### Identified Problems

| Problem | Impact | Severity |
|---------|--------|----------|
| **Cross dependencies** | Each component directly accesses PostgreSQL, GitLab, Keycloak | 🔴 High |
| **Unclear webMethods role** | Used for admin AND runtime, difficult to scale | 🔴 High |
| **Logic duplication** | Validation, auth, tenant isolation repeated everywhere | 🟡 Medium |
| **Coupled deployment** | Impossible to deploy Portal without MCP Gateway | 🟡 Medium |

### Architectural Question

> **How to structure STOA components so they are independently deployable, while maintaining GitLab as source of truth and clarifying each element's role?**

## Decision

Adopt a **Control Plane / Data Plane** architecture with Core API as central hub.

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| **A. Modular monolith** | Everything in one artifact | ❌ Against open-core, all-or-nothing scaling |
| **B. Pure microservices** | One service per domain | ❌ Overkill for team size |
| **C. Control Plane / Data Plane** | Clear separation of responsibilities | ✅ **Selected** |

### Architecture

```mermaid
graph TB
    subgraph CP["CONTROL PLANE"]
        Portal["Portal<br/><small>SPA</small>"]
        Console["Console<br/><small>SPA</small>"]
        MCP["MCP Server"]
        CoreAPI["STOA Core API<br/><small>Central hub</small>"]
        PG[("PostgreSQL<br/><small>runtime</small>")]
        GL[("GitLab<br/><small>source</small>")]
        KC[("Keycloak<br/><small>IAM</small>")]

        Portal --> CoreAPI
        Console --> CoreAPI
        MCP --> CoreAPI
        CoreAPI --> PG
        CoreAPI --> GL
        CoreAPI --> KC
    end

    subgraph DP["DATA PLANE"]
        GW["webMethods Gateway<br/><small>Routing · Rate Limit · Auth · Transform</small>"]
    end

    CoreAPI -- "GitOps Sync" --> GW

    style CP fill:#1a1a2e,stroke:#3b82f6,color:#e2e8f0
    style DP fill:#1a1a2e,stroke:#10b981,color:#e2e8f0
    style CoreAPI fill:#3b82f6,stroke:#3b82f6,color:#fff
    style GW fill:#10b981,stroke:#10b981,color:#fff
```

### Components

| Component | Type | Role | Dependencies |
|-----------|------|------|--------------|
| **STOA Core API** | Backend (FastAPI) | Central hub, all business logic | PostgreSQL, GitLab, Keycloak |
| **STOA Portal** | Frontend (React) | Developer self-service | Core API only |
| **STOA Console** | Frontend (React) | Platform administration | Core API only |
| **STOA MCP Server** | Backend (Python) | AI/LLM interface | Core API only |
| **webMethods Gateway** | Data Plane | API runtime traffic execution | Config sync from Core API |

### Architecture Rules

#### Rule 1: Unidirectional Dependencies

```mermaid
graph LR
    Portal --> CoreAPI["Core API"]
    Console --> CoreAPI
    MCP["MCP Server"] --> CoreAPI
    CoreAPI --> PG["PostgreSQL"]
    CoreAPI --> GL["GitLab"]
    CoreAPI --> KC["Keycloak"]

    style CoreAPI fill:#3b82f6,stroke:#3b82f6,color:#fff
```

**Forbidden:** Portal → PostgreSQL (direct), MCP Server → GitLab (direct)

#### Rule 2: GitLab = Source of Truth for Definitions

```yaml
# What lives in GitLab (stoa-catalog)
stoa-catalog/
  tenants/{tenant}/
    apis/{api}/
      api.yaml       # API definition
      openapi.yaml   # OpenAPI spec

# What lives in PostgreSQL
- subscriptions, api_keys, audit_logs, rate_limit_usage, mcp_sessions
```

#### Rule 3: webMethods = Data Plane Only

✅ **DO:** Routing, Rate limiting, JWT validation, Transformation, Caching
❌ **DON'T:** Serve UIs, Manage subscriptions, Store data

## Public API Façade

### Architecture

```mermaid
graph LR
    subgraph Internal["INTERNAL"]
        Portal --> CoreAPI["Core API"]
        Console --> CoreAPI
        MCP["MCP Server"] --> CoreAPI
        CoreAPI --> DB["PostgreSQL / GitLab / Keycloak"]
    end

    subgraph External["EXTERNAL (third-party)"]
        TP["Third-party"] --> WM["webMethods<br/><small>rate limit</small>"]
        WM --> Facade["Public API<br/><small>façade</small>"]
    end

    Facade --> CoreAPI

    style Internal fill:#1a1a2e,stroke:#3b82f6,color:#e2e8f0
    style External fill:#1a1a2e,stroke:#f59e0b,color:#e2e8f0
    style CoreAPI fill:#3b82f6,stroke:#3b82f6,color:#fff
    style Facade fill:#f59e0b,stroke:#f59e0b,color:#fff
```

### Endpoints Exposed to Third Parties

```yaml
/v1/portal/:
  catalog:           # Public or API key
    GET /apis, GET /apis/{id}, GET /apis/{id}/spec
  subscriptions:     # OAuth2 required
    GET/POST/DELETE /subscriptions
  me:                # OAuth2 required
    GET /me, GET /me/usage
```

**NEVER exposed:** `/v1/admin/*`, `/v1/tenants/*/members`, `/v1/gateway/*`

## Consequences

### Positive

- ✅ Independent component deployment
- ✅ GitLab remains source of truth
- ✅ Clear Control Plane / Data Plane separation
- ✅ Secure third-party exposure

### Negative

- ⚠️ Additional latency (MCP → Core API vs direct DB)
- ⚠️ Migration effort

## References

- Kubernetes Control Plane / Data Plane separation
- Istio Pilot (control) vs Envoy (data)
- Kong Konnect architecture
- [ADR-012: MCP Tools Architecture](./adr-012-mcp-rbac-architecture.md)
