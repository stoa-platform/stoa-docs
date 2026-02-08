---
sidebar_position: 3
title: "Multi-Tenant Isolation"
description: "STOA's hard multi-tenancy model with Kubernetes namespace isolation, Keycloak realms, and schema-per-tenant design."
keywords: [multi-tenant, isolation, Kubernetes, Keycloak, security]
---

# Multi-Tenant Isolation

How STOA implements tenant isolation and security.

## Tenant Isolation Model

STOA implements a **hard multi-tenancy** model with strict isolation at multiple layers.

## Isolation Layers

### 1. Kubernetes Namespace Isolation

Each tenant operates in a dedicated namespace:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-acme
  labels:
    stoa.io/tenant-id: acme
    stoa.io/tier: enterprise
```

**Benefits:**
- Resource isolation
- RBAC boundaries
- Network policy enforcement
- Resource quota limits

### 2. Network Isolation

Network policies prevent cross-tenant communication:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: tenant-acme
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          stoa.io/tenant-id: acme
```

### 3. Gateway Isolation

Each tenant gets dedicated Kong Gateway instance:

- Isolated routing rules
- Separate plugin configurations
- Independent rate limiting
- Tenant-specific certificates

### 4. Authentication Isolation

Keycloak multi-realm architecture:

- One realm per tenant
- Isolated user stores
- Separate client configurations
- Independent token validation

### 5. Data Isolation

- Tenant-specific databases or schemas
- Encrypted at rest
- Separate backup policies
- Audit logging per tenant

## Resource Quotas

Each tenant has resource limits:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-quota
  namespace: tenant-acme
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    persistentvolumeclaims: "5"
    services.loadbalancers: "2"
```

## Security Boundaries

### Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-acme
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Service Mesh Integration (Future)

- Mutual TLS between services
- Traffic encryption
- Policy-based access control
- Observability per tenant

## Tenant Tiers

STOA supports different tenant tiers:

| Tier | Resources | Features | SLA |
|------|-----------|----------|-----|
| **Free** | Limited | Basic APIs | Best effort |
| **Starter** | Moderate | APIs + Tools | 99% |
| **Business** | High | Full platform | Per SLA agreement |
| **Enterprise** | Custom | White-label | Custom SLA |

## Monitoring & Observability

Per-tenant metrics:

- API request rates
- Error rates
- Latency percentiles
- Resource utilization
- Cost attribution

---

🚧 **Coming Soon**: Tenant migration procedures, backup/restore guides, and compliance certifications.
