---
slug: multi-tenant-api-gateway-kubernetes
title: "Building a Multi-Tenant API Gateway on Kubernetes: Lessons Learned"
authors: [stoa-team]
tags: [architecture, feature]
description: "How to build a secure multi-tenant API gateway on Kubernetes. Learn the tradeoffs between namespace-per-tenant and shared models, and how STOA implements tenant isolation with Keycloak, OPA, and schema-per-tenant databases."
keywords:
  - multi-tenant API gateway
  - Kubernetes API gateway
  - API gateway multi-tenancy
  - Kubernetes multi-tenancy
  - tenant isolation
  - API gateway Kubernetes
  - multi-tenant architecture
---

Building a **multi-tenant API gateway** is one of the hardest infrastructure challenges in platform engineering. You need strong isolation between tenants, shared infrastructure for efficiency, and the ability to scale without multiplying operational complexity. After years of building multi-tenant API platforms — and applying those lessons to STOA on Kubernetes — here is what we learned.

<!-- truncate -->

Multi-tenancy in API management is not just about routing requests to different backends. It encompasses authentication, authorization, rate limiting, logging, billing, and — critically — the guarantee that one tenant's traffic, data, and configuration cannot affect another's. Getting this right on Kubernetes requires deliberate architectural choices at every layer.

## The Multi-Tenancy Challenge for API Gateways

Traditional API gateways were built for single-tenant deployments. You deploy one gateway, configure your routes, and manage a single set of policies. When you need to serve multiple independent organizations from the same platform, several problems emerge:

- **Configuration bleed** — One tenant's route configuration must never interfere with another's.
- **Data isolation** — API keys, usage logs, and subscription data must be strictly separated.
- **Performance isolation** — A traffic spike from one tenant should not degrade service for others.
- **Security boundaries** — Authentication tokens and policy decisions must be scoped to a single tenant.
- **Operational overhead** — Deploying N separate gateway instances for N tenants does not scale.

## Two Models: Namespace-Per-Tenant vs. Shared Gateway

On Kubernetes, the two primary multi-tenancy models each have distinct tradeoffs.

### Model 1: Namespace-Per-Tenant

In this model, each tenant gets a dedicated Kubernetes namespace with its own gateway instance, database schema, and configuration.

**Advantages:**
- Strong isolation by default (Kubernetes RBAC, NetworkPolicies)
- Independent scaling per tenant
- Simple blast radius — a misconfiguration affects only one tenant
- Natural mapping to Kubernetes resource quotas

**Disadvantages:**
- Operational overhead grows linearly with tenant count
- Resource inefficiency (each gateway instance consumes base memory/CPU)
- Cross-tenant features (global analytics, shared tooling) are harder to implement
- Certificate management and ingress routing become complex

### Model 2: Shared Gateway with Logical Isolation

A single gateway deployment handles all tenants, with isolation enforced at the application layer through tenant context propagation, scoped policies, and partitioned storage.

**Advantages:**
- Efficient resource usage
- Simpler operations (one deployment to monitor and upgrade)
- Easier to implement cross-tenant features
- Lower infrastructure cost

**Disadvantages:**
- Isolation bugs can have wide blast radius
- Requires careful engineering of tenant context at every layer
- Performance isolation requires additional mechanisms (per-tenant rate limiting, priority queues)
- More complex to reason about security

### The Hybrid Approach: What STOA Uses

STOA uses a **hybrid model** that combines the strengths of both approaches. The gateway itself is a shared deployment, but tenant isolation is enforced through three independent mechanisms working in concert.

## How STOA Implements Multi-Tenant Isolation

### Layer 1: Kubernetes Namespace Isolation

Each tenant's custom resources (MCP Tools, ToolSets, Subscriptions) live in a dedicated namespace:

```
tenant-acme/        # Namespace for Acme Corp
  Tool/weather-api
  Tool/billing-api
  ToolSet/public-tools
  Subscription/acme-sub-001

tenant-globex/      # Namespace for Globex
  Tool/inventory-api
  ToolSet/internal-tools
  Subscription/globex-sub-001
```

Kubernetes RBAC ensures that service accounts can only watch resources in their assigned namespaces. NetworkPolicies restrict pod-to-pod communication across tenant boundaries.

This gives us the **blast radius containment** of namespace-per-tenant without the overhead of deploying separate gateway instances. Learn more in the [multi-tenancy concepts documentation](https://docs.gostoa.dev/docs/concepts/multi-tenant).

### Layer 2: Keycloak Realm Separation

Every tenant maps to a dedicated Keycloak realm. This provides:

- **Independent identity management** — Each tenant manages their own users and groups.
- **Separate OIDC configurations** — Different token lifetimes, MFA requirements, and identity providers per tenant.
- **Isolated client credentials** — API keys and OAuth clients are scoped to a single realm.
- **Federated identity** — Tenants can bring their own IdP (SAML, LDAP, social login) without affecting others.

When a request hits the gateway, the JWT token's `iss` (issuer) claim identifies the Keycloak realm, which maps to a tenant. This mapping is validated before any routing or policy evaluation occurs.

### Layer 3: Schema-Per-Tenant Database

The Control Plane API uses PostgreSQL with a schema-per-tenant model:

```
stoa_db/
  public/           # Shared metadata (tenant registry, global config)
  tenant_acme/      # Acme's APIs, subscriptions, usage data
  tenant_globex/    # Globex's APIs, subscriptions, usage data
```

Every database query includes the tenant schema in the search path, enforced at the connection level by the ORM (SQLAlchemy). This means:

- A bug in a query cannot accidentally return another tenant's data.
- Database backups and restores can be done per-tenant.
- Schema migrations are applied per-tenant, enabling phased rollouts.
- Performance monitoring can track per-tenant query patterns.

## Lessons Learned

After operating this architecture in production, here are the most important lessons.

### Lesson 1: Tenant Context Must Be Immutable After Authentication

The single most important design decision: once a request is authenticated and the tenant context is established, that context must be **immutable and unforgeable** for the entire request lifecycle. We propagate tenant context as a validated claim in the JWT, not as a header that can be spoofed.

Early in development, we experimented with tenant identification via HTTP headers (`X-Tenant-ID`). This led to subtle bugs where internal service-to-service calls could accidentally forward the wrong tenant header. JWT-based tenant binding eliminated this entire class of bugs.

### Lesson 2: OPA Policies Must Be Tenant-Aware From Day One

We use Open Policy Agent (OPA) for fine-grained authorization. A critical lesson: every policy rule must include the tenant dimension from the beginning. Retrofitting tenant scoping into existing policies is error-prone and creates a window for privilege escalation.

In STOA, OPA policies receive the full tenant context as input and enforce that resources requested by the caller belong to the correct tenant:

```rego
allow {
    input.resource.namespace == input.caller.tenant_namespace
    input.caller.roles[_] == "tenant-admin"
}
```

This ensures that even a misconfigured route cannot expose one tenant's resources to another. See the [architecture overview](https://docs.gostoa.dev/docs/concepts/architecture) for details on how policies flow through the system.

### Lesson 3: Rate Limiting Must Be Per-Tenant, Not Global

A shared gateway with a single global rate limit is a denial-of-service vector. One tenant can exhaust the rate limit, effectively blocking all other tenants.

STOA implements **hierarchical rate limiting**:

1. **Global limit** — Protects the infrastructure from total overload.
2. **Per-tenant limit** — Each tenant gets a guaranteed allocation.
3. **Per-subscription limit** — Individual API keys have their own limits within the tenant allocation.

This ensures fair resource distribution and prevents noisy-neighbor problems.

### Lesson 4: Observability Needs Tenant Dimensions

Every metric, log, and trace must carry the tenant identifier. Without this, debugging a performance issue becomes a guessing game across all tenants.

STOA tags all observability data with `tenant_id`, enabling:

- Per-tenant dashboards in Grafana
- Tenant-scoped log queries in OpenSearch
- SLA monitoring per tenant
- Usage-based billing from metering data

### Lesson 5: CRDs Are the Right Abstraction for Tenant Resources

Kubernetes Custom Resource Definitions (CRDs) turned out to be an excellent way to model tenant-specific API configurations. CRDs give us:

- **Declarative configuration** — Tenants describe what they want, not how to achieve it.
- **Kubernetes-native RBAC** — Namespace-scoped RBAC applies directly.
- **Watch-based sync** — The gateway watches CRD changes and updates routing in real time.
- **GitOps compatibility** — Tenant configurations can be managed via ArgoCD.

### Lesson 6: Test Multi-Tenancy With Adversarial Scenarios

Standard integration tests are not sufficient. You need tests that specifically try to violate tenant boundaries:

- Authenticate as tenant A, try to access tenant B's resources.
- Send requests with manipulated tenant headers.
- Create resources in one namespace and verify they are invisible from another.
- Exhaust one tenant's rate limit and verify others are unaffected.

We run these adversarial tests as part of our E2E suite on every PR.

## When to Choose Which Model

| Scenario | Recommended Model |
|---|---|
| < 10 tenants, strong compliance requirements | Namespace-per-tenant (dedicated instances) |
| 10-100 tenants, SaaS platform | Hybrid (shared gateway, namespace isolation) |
| 100+ tenants, self-service onboarding | Shared gateway with application-layer isolation |
| Financial services (DORA) | Hybrid with dedicated data plane per tenant |

## Get Started With Multi-Tenant API Management

STOA's multi-tenant architecture is available out of the box. Whether you are building a platform for internal teams or a SaaS product with external tenants, the isolation model scales with you.

- Read the [Multi-Tenancy Concepts](https://docs.gostoa.dev/docs/concepts/multi-tenant) documentation
- Explore the [Architecture Overview](https://docs.gostoa.dev/docs/concepts/architecture)
- Try STOA with the [Quickstart Guide](https://docs.gostoa.dev/docs/guides/quickstart)
- Deploy on your own Kubernetes cluster with the [Hybrid Deployment Guide](https://docs.gostoa.dev/docs/deployment/hybrid)

---

*The STOA Team builds open-source API management for the AI era. Follow us on [GitHub](https://github.com/stoa-platform).*
