---
sidebar_position: 1
title: Architecture Overview
description: High-level architecture of the STOA Platform
---

# Architecture Overview

STOA Platform is designed as a cloud-native, multi-tenant gateway platform built for both traditional APIs and AI agents.

## High-Level Architecture

STOA follows a **Control Plane / Data Plane** separation pattern, similar to Kubernetes and Istio.

```mermaid
flowchart TB
    subgraph Users["👥 Users"]
        Dev["🧑‍💻 Developers"]
        Admin["👨‍💼 Platform Admins"]
        AI["🤖 AI Agents"]
    end

    subgraph ControlPlane["⚙️ Control Plane"]
        Portal["📱 Developer Portal"]
        Console["🖥️ Admin Console"]
        CoreAPI["🔧 Core API"]
    end

    subgraph DataPlane["🚀 Data Plane"]
        MCPGateway["MCP Gateway"]
        WMGateway["webMethods Gateway"]
    end

    subgraph Backend["💾 Backend Services"]
        KC["Keycloak"]
        PG["PostgreSQL"]
        Redis["Redis"]
        Vault["HashiCorp Vault"]
    end

    subgraph MCP["🔧 MCP Servers"]
        Tools["Enterprise Tools"]
    end

    Dev & Admin --> Portal & Console
    AI --> MCPGateway
    Portal & Console --> CoreAPI
    CoreAPI -->|"config sync"| MCPGateway & WMGateway
    MCPGateway --> Tools
    CoreAPI --> PG & Redis & KC & Vault
    MCPGateway & WMGateway --> KC
```

### Control Plane vs Data Plane

| Aspect | Control Plane | Data Plane |
|--------|---------------|------------|
| **Role** | Configuration & Management | Traffic Execution |
| **Components** | Core API, Portal, Console | MCP Gateway, webMethods |
| **Latency** | Human-scale (ms OK) | Machine-scale (sub-ms) |
| **Scaling** | Moderate | High (per-request) |

:::tip Architecture Decision
This separation is documented in [ADR-001: API Exposure Strategy](/docs/architecture/adr/adr-001-api-exposure-strategy).
:::

## Core Components

### Control Plane API

The central management API built with **Python** and **FastAPI**.

| Aspect | Details |
|--------|---------|
| Language | Python 3.12+ |
| Framework | FastAPI (async) |
| Database | PostgreSQL + SQLAlchemy |
| Cache | Redis |
| Auth | Keycloak (OIDC) |

**Responsibilities:**
- Subscription management
- Tenant provisioning
- Tool catalog
- Usage tracking
- Policy enforcement

### MCP Gateway

The MCP Gateway handles Model Context Protocol interactions, enabling AI agents to securely consume enterprise tools.

| Aspect | Current Implementation |
|--------|------------------------|
| Language | Python 3.12+ |
| Framework | FastAPI (async) |
| Policy Engine | OPA (Open Policy Agent) |
| Protocol | MCP (Model Context Protocol) |

**Responsibilities:**
- MCP protocol handling
- Request routing
- Authentication validation
- Rate limiting
- Metrics collection

:::info Future Roadmap
A high-performance **Rust + Tokio** implementation is planned for Q4 2026, bringing kernel-level eBPF acceleration. See our [Roadmap](/docs/roadmap) for details.
:::

### API Gateway

Traditional API traffic is handled by **webMethods Gateway** (current implementation).

| Aspect | Details |
|--------|---------|
| Product | Software AG webMethods |
| Features | Rate limiting, transformations, policies |
| Protocol | REST, SOAP, GraphQL |

:::info Future Roadmap
Migration to a native Rust/eBPF gateway is planned for Phase 16+, providing improved performance and reduced operational overhead.
:::

### Portal UI

Self-service developer portal built with **React** and **TypeScript**.

**Features:**
- API/Tool catalog browsing
- Subscription management
- API key generation
- Usage dashboards
- Documentation access

### Console UI

Admin management console built with **React** and **TypeScript**.

**Features:**
- Tenant management
- User administration
- Policy configuration
- System monitoring
- Audit logs

## Security Layer

### Keycloak

Identity and access management providing:
- OIDC/OAuth2 authentication
- SSO (Single Sign-On)
- RBAC (Role-Based Access Control)
- Multi-factor authentication
- User federation

### HashiCorp Vault

Secrets management for:
- API key encryption
- Database credentials
- TLS certificates
- Service tokens

## Data Layer

### PostgreSQL

Primary database storing:
- Subscriptions
- Tenants
- Users
- Tool definitions
- Audit logs

### Redis

In-memory data store for:
- Session management
- Rate limiting counters
- Response caching
- Real-time metrics

### Kafka/Redpanda

Event streaming for:
- Audit events
- Usage metrics
- Cross-service communication

:::warning Internal Only
Kafka is strictly internal with zero external exposure (ADR-017). All external integrations use REST APIs.
:::

## Observability Stack

| Component | Purpose |
|-----------|---------|
| **Prometheus** | Metrics collection |
| **Grafana** | Dashboards & visualization |
| **Loki** | Log aggregation |
| **Alertmanager** | Alert routing |

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

1. **AI Agent** sends a tool invocation request with an API key
2. **MCP Gateway** validates the API key against Keycloak
3. **Gateway** checks subscription status with Control Plane API
4. **Control Plane** verifies the subscription is active
5. **Gateway** forwards the request to the appropriate MCP Server
6. **MCP Server** executes the tool and returns the response
7. **Gateway** returns the response to the AI Agent

## Deployment

STOA Platform runs on **Kubernetes** and can be deployed using:

- **Helm Charts**: Available in `stoa-infra/charts/`
- **GitOps**: ArgoCD compatible
- **IaC**: Terraform modules available

### Kubernetes Namespace

All components run in the `stoa-system` namespace:

```bash
kubectl get pods -n stoa-system
```

### Ingress Endpoints

| Service | URL Pattern |
|---------|-------------|
| Portal | `portal.<domain>` |
| Console | `console.<domain>` |
| API | `api.<domain>` |
| Gateway | `gateway.<domain>` |
| Auth | `auth.<domain>` |

## Technology Stack Summary

| Layer | Technology | Notes |
|-------|------------|-------|
| Control Plane | Python, FastAPI | Management API |
| MCP Gateway | Python, FastAPI, OPA | MCP protocol handling |
| API Gateway | webMethods | Traditional API traffic |
| Frontend | React, TypeScript, Tailwind | Portal & Console |
| Database | PostgreSQL | Primary data store |
| Cache | Redis | Sessions, rate limiting |
| Streaming | Kafka/Redpanda | Internal events |
| Auth | Keycloak | OIDC/OAuth2 |
| Secrets | HashiCorp Vault | Encryption, credentials |
| Observability | Prometheus, Grafana, Loki | Metrics, logs |
| Infrastructure | Kubernetes, Helm, ArgoCD | Deployment |

## Next Steps

- [Quick Start Guide](/docs/guides/quickstart) - Get STOA running locally
- [API Reference](/docs/api/control-plane) - Explore the Control Plane API
- [MCP Gateway](/docs/concepts/mcp-gateway) - Deep dive into MCP integration
