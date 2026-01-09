# STOA Platform Architecture

This document provides an overview of the STOA Platform architecture.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Users["👥 Users"]
        Dev["🧑‍💻 Developers"]
        Admin["👨‍💼 Platform Admins"]
        AI["🤖 AI Agents"]
    end

    subgraph STOA["🏛️ STOA Platform"]
        Portal["📱 Developer Portal"]
        Console["🖥️ Admin Console"]
        API["⚙️ Control Plane API"]
        Gateway["🚀 MCP Gateway"]
    end

    subgraph Security["🔐 Security"]
        KC["Keycloak"]
        Vault["HashiCorp Vault"]
    end

    subgraph Data["💾 Data"]
        PG["PostgreSQL"]
        Redis["Redis"]
    end

    subgraph MCP["🔧 MCP Servers"]
        Tools["Enterprise Tools"]
    end

    Users --> Portal & Console
    Portal & Console --> API
    API --> Gateway
    Gateway --> Tools
    API --> PG & Redis
    API & Gateway --> KC
    API --> Vault
```

## Components

### Core Services

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Control Plane API** | Python, FastAPI | Central management API for subscriptions, tools, tenants |
| **MCP Gateway** | Rust, Tokio, Hyper | High-performance proxy for MCP tool invocations |
| **Portal UI** | React, TypeScript | Developer self-service portal |
| **Console UI** | React, TypeScript | Admin management console |

### Security Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Keycloak** | Java | OIDC/OAuth2 identity provider, RBAC |
| **HashiCorp Vault** | Go | Secrets management, API key storage |

### Data Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| **PostgreSQL** | SQL | Primary database for subscriptions, tenants |
| **Redis** | In-memory | Caching, sessions, rate limiting |

### Observability

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Prometheus** | Go | Metrics collection |
| **Grafana** | Go | Dashboards and visualization |
| **Loki** | Go | Log aggregation |
| **Alertmanager** | Go | Alert routing and notifications |

## Request Flow

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant GW as MCP Gateway
    participant API as Control Plane
    participant MCP as MCP Server

    AI->>GW: Tool Invocation (API Key)
    GW->>GW: Validate API Key
    GW->>API: Check Subscription
    API-->>GW: ✅ Authorized
    GW->>MCP: Forward Request
    MCP-->>GW: Response
    GW-->>AI: Tool Response
```

## Deployment

STOA Platform is designed to run on Kubernetes. See the [Helm chart documentation](https://github.com/stoa-platform/stoa-helm) for deployment instructions.

### Kubernetes Namespace

All components run in the `stoa-system` namespace:

```bash
kubectl get pods -n stoa-system
```

### Ingress

| Service | URL | Purpose |
|---------|-----|---------|
| Portal | `portal.stoa.example.com` | Developer portal |
| Console | `console.stoa.example.com` | Admin console |
| API | `api.stoa.example.com` | Control Plane API |
| Gateway | `gateway.stoa.example.com` | MCP Gateway |
| Auth | `auth.stoa.example.com` | Keycloak |
| Grafana | `grafana.stoa.example.com` | Dashboards |

## Diagrams

Architecture diagrams are available in multiple formats:

- **Mermaid**: `architecture-high-level.mermaid` - For embedding in Markdown
- **SVG**: `architecture-diagram.svg` - For web and presentations
- **Kubernetes**: `architecture-kubernetes.mermaid` - Deployment view

## Related Documentation

- [Getting Started](/getting-started)
- [Deployment Guide](/deployment/helm)
- [API Reference](/api)
