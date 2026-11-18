---
sidebar_position: 3
title: "Multi-Tenant Isolation"
description: "STOA's hard multi-tenancy model — tenant lifecycle, 5 isolation layers, RBAC scoping, resource quotas, and per-tenant observability."
keywords: [multi-tenant, isolation, Kubernetes, Keycloak, security, RBAC, tenant]
---

# Multi-Tenant Isolation

STOA implements a **multi-layered tenant isolation** model combining logical identity and data scoping in the Control Plane and Gateway ([ADR-074](/docs/architecture/adr/adr-074-tenant-model), [ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) with optional Kubernetes namespace and CNI network boundaries for tenant workloads. This enables a single STOA deployment to serve multiple organizations without cross-tenant data leakage.

## Tenant Data Model

Each tenant in STOA has the following properties:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Slug identifier (e.g., `oasis`, `acme-corp`) — immutable |
| `name` | string | Display name (e.g., "OASIS Gunters") |
| `description` | string | Optional description |
| `status` | enum | `active`, `suspended`, `archived` |
| `settings` | JSON | Quotas, feature flags, custom config |
| `created_at` | timestamp | Creation date |

### Tenant Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> active: Create tenant
    active --> suspended: Suspend (billing, compliance)
    suspended --> active: Reactivate
    active --> archived: Decommission
    suspended --> archived: Decommission
    archived --> [*]: Delete data
```

- **Active** — Full access to all platform features
- **Suspended** — Read-only access, no API calls, no deployments. Used for billing issues or compliance holds.
- **Archived** — Data retained for audit, no access. Pending deletion per retention policy.

## Five Isolation Layers

### 1. Kubernetes Namespace Isolation

In multi-tenant Kubernetes deployments, operators can place tenant workloads and `Tool` / `ToolSet` CRDs in dedicated namespaces with labels for policy enforcement (operator reference pattern; the gateway-only `charts/stoa-platform` chart does not auto-provision tenant namespaces):

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-acme
  labels:
    stoa.io/tenant-id: acme
    stoa.io/tier: enterprise
    pod-security.kubernetes.io/enforce: restricted
```

Resource quotas prevent a single tenant from consuming cluster resources:

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

### 2. Network Isolation

Network policies prevent cross-tenant communication at the CNI level:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: tenant-acme
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
      - namespaceSelector:
          matchLabels:
            stoa.io/tenant-id: acme
  egress:
    - to:
      - namespaceSelector:
          matchLabels:
            stoa.io/tenant-id: acme
    - to:
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: stoa-system
```

Tenants can communicate with their own namespace and the shared `stoa-system` namespace (for the Control Plane API and Gateway), but never with other tenants.

### 3. Gateway Isolation

The STOA Gateway enforces tenant boundaries at the API and MCP layers:

- **Fail-closed tenant policies** — Signed Ed25519 per-tenant tool policy artifacts (`STOA_POLICY_BOOT_TENANTS`, [ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) deny cross-tenant tool invocation if policy state is missing or invalid
- **Tenant-scoped routing & visibility** — Each API and MCP tool (`stoa://tools/{name}`) is scoped to a verified `tenant_id`
- **Separate rate limits** — Per-tenant quota enforcement
- **Independent policies** — OPA policies evaluate tenant context

In multi-gateway deployments, the Control Plane's 6 gateway adapters ([ADR-035](/docs/architecture/adr/adr-035-gateway-adapter-pattern)) and the on-site `stoa-connect` (STOA Link) agent (Kong, Gravitee, webMethods, and explicit opt-in Envoy xDS) propagate tenant scoping to each target gateway.

### 4. Authentication Isolation

Per [ADR-074](/docs/architecture/adr/adr-074-tenant-model) (which retires the earlier realm-per-tenant draft in ADR-026), STOA uses a **single shared `stoa` Keycloak realm** (`KEYCLOAK_REALM=stoa`) with group-based tenant membership:

- **One top-level Keycloak group per tenant** — Provisioned at `/<tenant_id>` by `setup_tenant_group` (`TenantProvisioningService`) during tenant creation (`POST /v1/tenants`), while `add_user_to_tenant` sets the `tenant_id` user attribute mapped into the JWT
- **Verified `tenant_id` JWT claim** — Read from the JWT claims after RS256 JWKS signature and issuer verification (`Claims::tenant_id()` / `require_tenant` in `stoa-gateway`, `get_current_user` in `control-plane-api`); never trusted from unverified headers or query strings
- **Mandatory tenant-boundary enforcement** — Control Plane RBAC (`require_tenant_access`, and Rust `RbacEnforcer` when the `enforce_tenant_isolation` RBAC policy field is enabled) rejects cross-tenant requests (`403`) unless the caller holds `cpi-admin`; by contrast, MCP `tools/list`, Envoy `ext_authz` gRPC, and published UAC REST routes require a verified `tenant_id` matching the target tenant/route without presuming a `cpi-admin` cross-tenant bypass
- **External IdP brokering** — Multi-IdP federation is demonstrated only in separate demo realms (`deploy/docker-compose/` profile `federation`, not attested in the production `stoa` realm import) rather than per-tenant realms

### 5. Data Isolation

- **Shared PostgreSQL schema with `tenant_id` scoping** — All tenant-owned records (`apis`, `subscriptions`, `consumers`, `mcp_servers`, audit entries) carry an indexed `tenant_id` column filtered by SQLAlchemy repository queries (no schema-per-tenant)
- **Encrypted secrets** — Sensitive credentials are stored via the Vault HTTP API backend (OpenBao by default, [ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) or encrypted at rest
- **Audit logging** — Every control-plane and gateway access is logged with verified `tenant_id` context

## RBAC and Tenant Scoping

STOA's RBAC model combines platform-wide and tenant-scoped roles:

| Role | Scope | Permissions |
|------|-------|-------------|
| `cpi-admin` | **Platform (Control Plane RBAC)** | Cross-tenant administration in the Control Plane API (and Rust `RbacEnforcer` policy checks) |
| `tenant-admin` | **Tenant** | Full access to own tenant only |
| `devops` | **Tenant** | Deploy and promote within own tenant |
| `viewer` | **Tenant** | Read-only access to own tenant |

Key behaviors:
- A `tenant-admin` for tenant `acme` **cannot** see tenant `globex` resources
- A `viewer` can browse APIs and tools but cannot invoke, create, or modify
- A `cpi-admin` sees all tenants and can perform cross-tenant operations in Control Plane RBAC (`require_tenant_access`); data-plane checks on MCP `tools/list`, Envoy `ext_authz` gRPC, and UAC REST routes still require a verified `tenant_id` matching the target tenant/route
- Environment mode (dev/staging/prod) further restricts operations — production is read-only by default

## Tenant Settings

The `settings` JSON field on each tenant allows per-tenant configuration:

```json
{
  "quotas": {
    "max_apis": 50,
    "max_subscriptions": 200,
    "max_rate_limit": 10000
  },
  "features": {
    "mcp_enabled": true,
    "shadow_mode": false,
    "advanced_analytics": true
  },
  "notifications": {
    "webhook_url": "https://hooks.acme.com/stoa",
    "email_alerts": true
  }
}
```

## Tenant Tiers

| Tier | Resources | Features | SLA |
|------|-----------|----------|-----|
| **Community** | Limited | Core APIs, basic MCP | Best effort |
| **Starter** | Moderate | APIs + MCP tools, portal | 99% |
| **Business** | High | Full platform, multi-gateway | Per agreement |
| **Enterprise** | Custom | White-label, dedicated support | Custom SLA |

## Per-Tenant Observability

Every metric in STOA is labeled with the tenant ID, enabling per-tenant dashboards:

- **API request rates** — `stoa_api_requests_total{tenant="acme"}`
- **Error rates** — `stoa_api_errors_total{tenant="acme"}`
- **Latency percentiles** — `stoa_api_duration_seconds{tenant="acme"}`
- **Resource utilization** — CPU, memory, storage per namespace
- **Cost attribution** — Per-tenant resource consumption for billing

Grafana dashboards can be filtered by tenant for tenant-admins, or viewed across all tenants for platform admins.

## Related

- [Architecture Overview](/docs/concepts/architecture) — System architecture
- [MCP Gateway](/docs/concepts/mcp-gateway) — Gateway concepts
- [Subscriptions Guide](/docs/guides/subscriptions) — API subscription management
- [ADR-074: Single Keycloak Realm & Tenant Group Model](/docs/architecture/adr/adr-074-tenant-model) — Tenant identity and PostgreSQL scoping
- [ADR-070: Gateway Fail-Closed Posture](/docs/architecture/adr/adr-070-gateway-fail-closed-posture) — Signed per-tenant tool policy enforcement
- [ADR-022: UAC Tenant Architecture](/docs/architecture/adr/adr-022-uac-tenant-architecture) — Architecture decision
