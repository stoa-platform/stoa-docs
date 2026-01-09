---
sidebar_position: 1
---

# Architecture Overview

Understanding STOA's cloud-native architecture.

## High-Level Architecture

STOA Platform is built on Kubernetes with a multi-tenant, GitOps-first approach.

```
┌─────────────────────────────────────────────────────────┐
│                    STOA Platform                         │
├─────────────────────────────────────────────────────────┤
│  Control Plane API                                       │
│  ├── Tenant Management                                   │
│  ├── API/Tool Registration                               │
│  └── Subscription Management                             │
├─────────────────────────────────────────────────────────┤
│  Data Plane (Per Tenant)                                 │
│  ├── Kong Gateway                                        │
│  ├── Route Configuration                                 │
│  └── Policy Enforcement                                  │
├─────────────────────────────────────────────────────────┤
│  Authentication Layer                                    │
│  └── Keycloak (OIDC/OAuth2)                             │
├─────────────────────────────────────────────────────────┤
│  GitOps Engine                                           │
│  ├── ArgoCD (Declarative Sync)                          │
│  └── AWX (Ansible Automation)                           │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### Control Plane

The Control Plane provides the API for:
- Tenant provisioning and isolation
- API/Tool registration
- Subscription management
- Configuration management

### Data Plane

Each tenant gets an isolated data plane:
- Dedicated Kong Gateway instance
- Namespace isolation
- Network policies
- Resource quotas

### Authentication Layer

Keycloak provides:
- OIDC/OAuth2 authentication
- Multi-realm support (one per tenant)
- Role-based access control (RBAC)
- Token validation

### GitOps Engine

ArgoCD + AWX handle:
- Declarative configuration sync
- Infrastructure as Code
- Automated deployment
- Configuration drift detection

## Multi-Tenancy

STOA enforces strict tenant isolation:

- **Namespace Isolation** - Each tenant in separate Kubernetes namespace
- **Network Policies** - Prevent cross-tenant communication
- **Resource Quotas** - CPU/Memory limits per tenant
- **Authentication Realms** - Isolated Keycloak realms

## Scalability

STOA scales horizontally:

- Control Plane API can be replicated
- Each tenant's data plane scales independently
- Stateless architecture for easy scaling
- Kubernetes-native autoscaling support

---

🚧 **Coming Soon**: Detailed architecture diagrams, component specifications, and deployment topologies.
