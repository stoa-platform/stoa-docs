---
sidebar_position: 4
title: Kong OSS / Enterprise
description: "Migrate from Kong Gateway OSS or Enterprise to STOA Platform while preserving your existing configs, plugins, and routes."
keywords: [migration, Kong, Kong Gateway, STOA, API gateway, alternative, Kong migration, Kong OSS, Kong Enterprise, declarative config]
---

# Migration from Kong OSS / Enterprise

This guide covers migration from Kong Gateway (OSS or Enterprise) to STOA Platform, leveraging Kong's declarative configuration model for a smooth transition.

## What You Have

Typical Kong stack:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                                │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Kong Gateway (OSS or Enterprise)         │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ Services │  │ Routes   │  │ Plugins  │           │     │
│   │  │ & Upst.  │  │          │  │          │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Kong Manager / Konnect (optional)        │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ Dev      │  │ Analytics│  │ Runtime  │           │     │
│   │  │ Portal   │  │          │  │ Groups   │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  Common migration drivers:                                      │
│  • Seeking unified MCP + REST gateway                          │
│  • European data sovereignty requirements                      │
│  • Multi-tenant isolation at the Kubernetes namespace level     │
│  • GitOps-first configuration management                       │
└─────────────────────────────────────────────────────────────────┘
```

## What STOA Provides

```
┌─────────────────────────────────────────────────────────────────┐
│                    WITH STOA                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              STOA Control Plane (Cloud)                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ Portal   │  │ Console  │  │ API      │              │   │
│  │  │ Catalog  │  │ Admin    │  │ Metrics  │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                       orchestrates                              │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           STOA Gateway (Rust, high-performance)          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ MCP      │  │ REST     │  │ Rate     │              │   │
│  │  │ Protocol │  │ Proxy    │  │ Limiting │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Benefits:                                                      │
│  • Native MCP support for AI agents                            │
│  • Namespace-level tenant isolation                             │
│  • GitOps-first (ArgoCD) configuration                         │
│  • European hosting with data residency controls               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration Mapping

Kong's declarative model maps naturally to STOA concepts:

| Kong Concept | STOA Equivalent | Notes |
|--------------|-----------------|-------|
| Service | API Definition | Backend upstream configuration |
| Route | API Route | Path + method matching |
| Plugin | STOA Policy | Rate limiting, auth, transforms |
| Consumer | Consumer / Subscription | API access management |
| Consumer Group | Tenant | Multi-tenant isolation |
| Upstream | Backend URL | Health checks included |
| Certificate | TLS Certificate | Managed via Keycloak/cert-manager |
| Workspace (Enterprise) | Tenant Namespace | K8s namespace isolation |

### Plugin Mapping

| Kong Plugin | STOA Equivalent |
|-------------|-----------------|
| `rate-limiting` | Native rate limiting (per-consumer quotas) |
| `key-auth` | API Key via Keycloak |
| `jwt` | OIDC/JWT via Keycloak |
| `oauth2` | OAuth 2.0 via Keycloak |
| `cors` | CORS policy |
| `request-transformer` | Response transformation (ADR-032) |
| `acl` | RBAC policies |
| `prometheus` | Native Prometheus metrics |
| `opentelemetry` | OpenTelemetry integration |
| `ip-restriction` | Network policy (K8s-level) |

---

## Migration Path

### Phase 1: Export & Import (1 week)

**Goal:** Register existing Kong APIs in STOA catalog.

1. **Export Kong Configuration**
   ```bash
   # Kong DB-less mode — already declarative
   kong config db_export kong-config.yaml

   # Or via Admin API
   curl -s http://kong-admin:8001/ | jq '.' > kong-dump.json

   # Export specific services
   curl -s http://kong-admin:8001/services | jq '.data[]' > kong-services.json
   ```

2. **Map to STOA Format**
   ```bash
   # Use STOA CLI to import Kong config
   stoa api import --file kong-config.yaml --format kong
   ```

3. **Verify in STOA Console**
   - Confirm all APIs appear in the catalog
   - Check route mappings and upstream URLs
   - Verify policy translations

### Phase 2: Identity Integration (1 week)

**Goal:** Connect STOA Keycloak to Kong's consumer authentication.

Kong consumers using `key-auth` or `jwt` can be federated:

```yaml
# keycloak-kong-migration.yaml
kind: IdentityProviderConfig
metadata:
  name: kong-consumer-migration
spec:
  provider: oidc
  config:
    # If Kong uses an external IdP
    issuerUri: https://your-idp/oauth
    clientId: stoa-federation
    scopes: openid,profile

  # For key-auth consumers: bulk import to Keycloak
  consumerImport:
    source: kong-consumers.json
    mapping:
      username: custom_id
      groups: acls
```

### Phase 3: Parallel Running (1-2 weeks)

**Goal:** Run STOA alongside Kong with shadow traffic.

Since Kong and STOA can coexist behind a load balancer:

```yaml
# traffic-split at ingress level
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: stoa-gateway
            port:
              number: 8080
```

Increase the canary weight from 10% to 50% to 100% as confidence grows.

### Phase 4: Cutover

**Goal:** Full production traffic through STOA.

1. Set canary weight to 100%
2. Monitor error rates and latency for 48 hours
3. Remove Kong ingress rules
4. Decommission Kong pods (keep config in Git for rollback)

---

## Migration Complexity

**Estimated complexity:** Low to Medium
**Estimated timeline:** 2-4 weeks

Kong's declarative configuration model and standard plugin ecosystem map well to STOA's GitOps approach. Custom Kong plugins require individual assessment.

### Complexity Factors

| Factor | Low | Medium | High |
|--------|-----|--------|------|
| Number of APIs | < 20 | 20-100 | > 100 |
| Custom plugins | None | 1-3 | > 3 |
| Consumer count | < 100 | 100-1000 | > 1000 |
| DB-less mode | Yes | — | No (requires export) |
| Enterprise features | Not used | Workspaces | Vitals, Dev Portal |

---

## Rollback Procedure

At any phase, revert to Kong routing:

```bash
# Immediate rollback — revert ingress canary
kubectl annotate ingress api-canary \
  nginx.ingress.kubernetes.io/canary-weight="0" --overwrite

# Verify Kong is handling all traffic
curl -s http://kong-admin:8001/status
```

---

## Next Steps

- [IBM webMethods / DataPower](./ibm-webmethods) — If migrating from IBM stack
- [Google Apigee](./apigee) — If migrating from Apigee
- [Hybrid Deployment](/docs/deployment/hybrid) — Architecture options
- [Security & Compliance](/docs/enterprise/security-compliance) — DORA/NIS2 considerations

---

> Feature comparisons are based on publicly available documentation as of 2026-02. Product capabilities change frequently. We encourage readers to verify current features directly with each vendor. All trademarks belong to their respective owners. See [trademarks](/docs/legal/trademarks).

---

*Need migration assistance? [Contact us](mailto:contact@gostoa.dev) for professional services.*
