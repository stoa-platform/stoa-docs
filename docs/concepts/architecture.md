---
sidebar_position: 1
title: Architecture Overview
description: "Understand the high-level architecture of STOA Platform with its Control Plane and Data Plane separation."
keywords: [STOA, architecture, control plane, data plane, concepts, API gateway, cloud-native]
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
        MCPGateway["STOA Gateway<br/>(Rust)"]
    end

    subgraph Backend["💾 Backend Services"]
        KC["Keycloak"]
        PG["PostgreSQL"]
        Kafka["Kafka/Redpanda"]
        Vault["HashiCorp Vault"]
    end

    subgraph MCP["🔧 MCP Servers"]
        Tools["Enterprise Tools"]
    end

    Dev & Admin --> Portal & Console
    AI --> MCPGateway
    Portal & Console --> CoreAPI
    CoreAPI -->|"config sync"| MCPGateway
    MCPGateway --> Tools
    CoreAPI --> PG & Kafka & KC & Vault
    MCPGateway --> KC
```

### Control Plane vs Data Plane

| Aspect | Control Plane | Data Plane |
|--------|---------------|------------|
| **Role** | Configuration & Management | Traffic Execution |
| **Components** | Core API, Portal, Console | STOA Gateway (Rust) |
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
| Event Streaming | Kafka/Redpanda |
| Auth | Keycloak (OIDC) |

**Responsibilities:**
- Subscription management
- Tenant provisioning
- Tool catalog
- Usage tracking
- Policy enforcement

### STOA Gateway

The STOA Gateway is the unified data plane component, handling both MCP protocol interactions for AI agents and traditional API traffic. Built with **Rust** and **Tokio/axum**, it has been in production since February 2026.

| Aspect | Details |
|--------|---------|
| Language | Rust (stable) |
| Framework | Tokio + axum |
| Policy Engine | OPA (Open Policy Agent) |
| Protocol | MCP, REST |

**Responsibilities:**
- MCP protocol handling (tools/list, tools/call, SSE)
- OAuth2/OIDC authentication via Keycloak
- Request routing and rate limiting
- Metrics collection and observability
- Multi-gateway adapter orchestration (Kong, Gravitee, Apigee, Azure APIM, AWS API Gateway, webMethods)

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
| STOA Gateway | Rust, Tokio, axum | MCP + API traffic |
| Frontend | React, TypeScript, Tailwind | Portal & Console |
| Database | PostgreSQL | Primary data store |
| Event Streaming | Kafka/Redpanda | Internal events |
| Streaming | Kafka/Redpanda | Internal events |
| Auth | Keycloak | OIDC/OAuth2 |
| Secrets | HashiCorp Vault | Encryption, credentials |
| Observability | Prometheus, Grafana, Loki | Metrics, logs |
| Infrastructure | Kubernetes, Helm, ArgoCD | Deployment |

## Next Steps

- [Quick Start Guide](/docs/guides/quickstart) - Get STOA running locally
- [API Reference](/docs/api/control-plane) - Explore the Control Plane API
- [MCP Gateway](/docs/concepts/mcp-gateway) - Deep dive into MCP integration
