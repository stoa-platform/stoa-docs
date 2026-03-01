---
sidebar_position: 5
title: Google Apigee
description: "Migrate from Google Apigee to STOA Platform — step-by-step guide for API proxy conversion, policy translation, and European data sovereignty."
keywords: [migration, Apigee, Google Cloud, STOA, API gateway, alternative, Apigee migration, API proxy, data sovereignty]
---

# Migration from Google Apigee

This guide covers migration from Google Apigee (X or hybrid) to STOA Platform, with a focus on European data sovereignty and multi-cloud flexibility.

## What You Have

Typical Apigee stack:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                                │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Apigee (X or Hybrid)                     │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ API      │  │ Policies │  │ Analytics│           │     │
│   │  │ Proxies  │  │ & Flows  │  │          │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Apigee Management Plane                  │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ Developer│  │ API      │  │ Monetize │           │     │
│   │  │ Portal   │  │ Products │  │          │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  Common migration drivers:                                      │
│  • European data sovereignty (GDPR, DORA, NIS2)               │
│  • Multi-cloud strategy (avoid single-cloud dependency)        │
│  • Self-hosted control over gateway infrastructure             │
│  • AI-native MCP support for agent workflows                   │
└─────────────────────────────────────────────────────────────────┘
```

## What STOA Provides

```
┌─────────────────────────────────────────────────────────────────┐
│                    WITH STOA                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              STOA Control Plane (self-hosted)            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ Portal   │  │ Console  │  │ Grafana  │              │   │
│  │  │ Catalog  │  │ Admin    │  │ Metrics  │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                       orchestrates                              │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           STOA Gateway (Rust, EU-hosted)                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ MCP      │  │ REST     │  │ mTLS     │              │   │
│  │  │ Protocol │  │ Proxy    │  │ + OIDC   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Benefits:                                                      │
│  • Full control over infrastructure and data residency         │
│  • Native MCP support for AI agents                            │
│  • Open-source (Apache 2.0) — no vendor lock-in               │
│  • Kubernetes-native deployment                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration Mapping

Apigee concepts map to STOA as follows:

| Apigee Concept | STOA Equivalent | Notes |
|----------------|-----------------|-------|
| API Proxy | API Definition + Routes | OpenAPI-based |
| Target Endpoint | Backend URL | Upstream configuration |
| ProxyEndpoint | API Route | Path + method matching |
| API Product | API Group | Bundling for subscription |
| Developer App | Consumer Subscription | Access management |
| Environment | Tenant / Namespace | K8s-level isolation |
| Organization | Platform Instance | Multi-tenant scope |
| Key Value Map | ConfigMap / Vault | Environment-specific config |
| Custom Report | Grafana Dashboard | Prometheus-powered |

### Policy Translation

| Apigee Policy | STOA Equivalent |
|---------------|-----------------|
| `VerifyAPIKey` | API Key validation (Keycloak) |
| `OAuthV2` | OIDC/OAuth 2.0 (Keycloak) |
| `SpikeArrest` | Rate limiting (per-consumer) |
| `Quota` | Quota management (per-subscription) |
| `AssignMessage` | Response transformation |
| `RaiseFault` | Error policy |
| `XMLToJSON` / `JSONToXML` | Media type transformation |
| `ServiceCallout` | Upstream proxy chain |
| `JavaScript` | Custom policy (Lua or WASM planned) |
| `StatisticsCollector` | Prometheus metrics (native) |
| `MessageLogging` | OpenSearch / structured logs |

---

## Migration Path

### Phase 1: API Inventory & Export (1-2 weeks)

**Goal:** Catalog all Apigee proxies and export configurations.

1. **Export API Proxies**
   ```bash
   # List all proxies in an organization
   curl -H "Authorization: Bearer $TOKEN" \
     "https://apigee.googleapis.com/v1/organizations/$ORG/apis" \
     | jq '.proxies[].name'

   # Export each proxy bundle
   for proxy in $(curl -s -H "Authorization: Bearer $TOKEN" \
     "https://apigee.googleapis.com/v1/organizations/$ORG/apis" \
     | jq -r '.proxies[].name'); do
     curl -H "Authorization: Bearer $TOKEN" \
       "https://apigee.googleapis.com/v1/organizations/$ORG/apis/$proxy/revisions/latest?format=bundle" \
       -o "${proxy}.zip"
   done
   ```

2. **Export API Products & Apps**
   ```bash
   # Products
   curl -H "Authorization: Bearer $TOKEN" \
     "https://apigee.googleapis.com/v1/organizations/$ORG/apiproducts" \
     -o apigee-products.json

   # Developer apps
   curl -H "Authorization: Bearer $TOKEN" \
     "https://apigee.googleapis.com/v1/organizations/$ORG/apps" \
     -o apigee-apps.json
   ```

3. **Import to STOA**
   ```bash
   stoa api import --file proxies/ --format apigee
   ```

### Phase 2: Identity Federation (1 week)

**Goal:** Federate Apigee developer identities to Keycloak.

```yaml
# keycloak-apigee-federation.yaml
kind: IdentityProviderConfig
metadata:
  name: apigee-developer-federation
spec:
  provider: oidc
  config:
    # If using Google Identity
    issuerUri: https://accounts.google.com
    clientId: stoa-federation
    scopes: openid,email,profile

  # Bulk import Apigee developers
  developerImport:
    source: apigee-developers.json
    mapping:
      email: email
      firstName: firstName
      lastName: lastName
```

### Phase 3: Parallel Running (2-3 weeks)

**Goal:** Run STOA alongside Apigee with gradual traffic migration.

For Apigee hybrid deployments, both can coexist in the same Kubernetes cluster:

1. **Shadow mode** — STOA receives mirrored traffic (read-only)
2. **Canary** — 5% of traffic through STOA
3. **Gradual** — Increase to 25%, 50%, 75%, 100%
4. **Cutover** — Full production traffic

### Phase 4: Decommission (1 week)

1. Confirm 100% traffic through STOA for 48+ hours
2. Remove Apigee proxy deployments
3. Archive Apigee configuration in Git (for reference)
4. Update DNS if applicable

---

## Why Migrate from Apigee?

### Data Sovereignty

STOA deploys entirely within your infrastructure — EU-hosted Kubernetes clusters ensure full data residency control. No API traffic or metadata leaves your chosen jurisdiction.

### Multi-Cloud Flexibility

STOA runs on any Kubernetes distribution (EKS, GKE, AKS, K3s, bare metal). Avoid dependency on a single cloud provider's API management stack.

### AI-Native Gateway

STOA provides native MCP (Model Context Protocol) support, enabling AI agents to discover and call your APIs automatically — a capability not available in traditional API management platforms.

### Open Source

Apache 2.0 licensed. Full source code access, no license fees, no per-call pricing. Fork, customize, or self-host freely.

---

## Migration Complexity

**Estimated complexity:** Medium
**Estimated timeline:** 4-6 weeks (depends on API count and custom policies)

### Complexity Factors

| Factor | Low | Medium | High |
|--------|-----|--------|------|
| Number of proxies | < 20 | 20-100 | > 100 |
| Custom JavaScript policies | None | 1-5 | > 5 |
| Shared flows | None | 1-3 | > 3 |
| Monetization | Not used | — | Active |
| Apigee Hybrid | Not used | — | Active (easier) |

---

## Rollback Procedure

At any phase, revert to Apigee routing:

```bash
# Revert traffic split
kubectl annotate ingress api-canary \
  nginx.ingress.kubernetes.io/canary-weight="0" --overwrite

# Or revert DNS to Apigee endpoints
# (keep Apigee proxies deployed until fully validated)
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| API imports | 100% registered in STOA |
| Identity federation | SSO working for all developers |
| Observability | Grafana dashboards showing equivalent data |
| Traffic migration | 100% through STOA |
| Latency | Within 5ms of Apigee baseline |

---

## Next Steps

- [IBM webMethods / DataPower](./ibm-webmethods) — If also migrating from IBM stack
- [Kong OSS / Enterprise](./kong) — If migrating from Kong
- [Hybrid Deployment](/docs/deployment/hybrid) — Architecture options
- [Security & Compliance](/docs/enterprise/security-compliance) — DORA/NIS2 considerations

---

> Feature comparisons are based on publicly available documentation as of 2026-02. Product capabilities change frequently. We encourage readers to verify current features directly with each vendor. All trademarks belong to their respective owners. See [trademarks](/docs/legal/trademarks).

---

*Need migration assistance? [Contact us](mailto:contact@gostoa.dev) for professional services.*
