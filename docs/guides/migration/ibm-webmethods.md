---
sidebar_position: 2
title: IBM webMethods / DataPower
description: Migration guide from IBM webMethods and DataPower to STOA Platform
---

# Migration from IBM webMethods / DataPower

This guide covers migration from Software AG webMethods and IBM DataPower API gateways to STOA Platform.

## What You Have

Typical IBM/Software AG stack:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                                │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              webMethods Integration Server            │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ API      │  │ ESB      │  │  B2B     │           │     │
│   │  │ Gateway  │  │ Mediator │  │ Gateway  │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│                  OR          │                                  │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              IBM DataPower Gateway                    │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ Multi-   │  │ Security │  │  API     │           │     │
│   │  │ Protocol │  │  Token   │  │ Firewall │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  Pain points:                                                   │
│  • Limited visibility into API traffic                         │
│  • Specialized expertise availability challenges               │
│  • Manual API onboarding (weeks, not minutes)                  │
│  • Configuration sprawl across environments                    │
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
│  │  │ Portal   │  │ Config   │  │ Metrics  │              │   │
│  │  │ Catalog  │  │ API      │  │ Grafana  │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                       orchestrates                              │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            webMethods / DataPower (On-Prem)              │   │
│  │                   (unchanged)                            │   │
│  │            Now with unified observability                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Benefits:                                                      │
│  • Real-time visibility via Grafana dashboards                 │
│  • Self-service API onboarding (minutes)                       │
│  • Keep existing gateway investment                            │
│  • Gradual migration path                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Path

### Phase 1: Discovery & Import

**Goal:** Register existing APIs in STOA catalog

1. **Export API Definitions**
   ```bash
   # webMethods: Export from API Portal
   curl -X GET "https://webmethods-portal/apis/export" \
     -H "Authorization: Bearer $TOKEN" \
     -o webmethods-apis.json
   
   # DataPower: Export from Web GUI or CLI
   dp-export --domain api-gateway --format openapi
   ```

2. **Import to STOA**
   ```bash
   # Use STOA CLI to import
   stoa api import --file webmethods-apis.json --format webmethods
   stoa api import --file datapower-apis.json --format openapi
   ```

3. **Verify Catalog**
   - Open STOA Portal
   - Confirm all APIs appear with correct metadata
   - Check endpoint mappings

### Phase 2: Identity Federation

**Goal:** Connect STOA to existing identity infrastructure

For webMethods Integration Server:

```yaml
# keycloak-federation.yaml
kind: IdentityProviderConfig
metadata:
  name: webmethods-federation
spec:
  provider: oidc
  config:
    issuerUri: https://webmethods-oauth/oauth
    clientId: stoa-federation
    clientSecret: ${WEBMETHODS_CLIENT_SECRET}
    scopes: openid,profile,api_access
```

For DataPower with LDAP/AD:

```yaml
# keycloak-ldap.yaml
kind: UserFederation
metadata:
  name: corporate-ldap
spec:
  provider: ldap
  config:
    connectionUrl: ldaps://ldap.corp.local:636
    usersDn: ou=users,dc=corp,dc=local
    bindDn: cn=stoa-service,ou=services,dc=corp,dc=local
    bindCredential: ${LDAP_PASSWORD}
```

### Phase 3: Observability Integration

**Goal:** Unified metrics and logging

1. **Deploy Prometheus Exporter for webMethods**
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: webmethods-exporter
   spec:
     template:
       spec:
         containers:
         - name: exporter
           image: stoa/webmethods-exporter:latest
           env:
           - name: WEBMETHODS_URL
             value: "https://webmethods-is:5555"
   ```

2. **Configure Grafana Data Source**
   ```yaml
   datasources:
   - name: webMethods
     type: prometheus
     url: http://webmethods-exporter:9090
     access: proxy
   ```

3. **Import STOA Dashboards**
   - webMethods API Traffic
   - DataPower Performance
   - Cross-Platform Comparison

### Phase 4: Traffic Migration

**Goal:** Gradually shift traffic through STOA

#### Shadow Mode

STOA receives copy of traffic for validation:

```yaml
# shadow-routing.yaml
apiVersion: networking.stoa.io/v1
kind: TrafficShadow
metadata:
  name: webmethods-shadow
spec:
  source:
    gateway: webmethods
  target:
    gateway: stoa
  percentage: 100
  mode: readonly  # No impact on production
```

#### Canary Deployment

Start with 5% of traffic:

```yaml
# canary-routing.yaml
apiVersion: networking.stoa.io/v1
kind: TrafficSplit
metadata:
  name: webmethods-canary
spec:
  routes:
  - destination: webmethods
    weight: 95
  - destination: stoa
    weight: 5
```

#### Full Migration

When ready, shift all traffic:

```yaml
# full-migration.yaml
apiVersion: networking.stoa.io/v1
kind: TrafficSplit
metadata:
  name: webmethods-migrated
spec:
  routes:
  - destination: stoa
    weight: 100
```

---

## webMethods-Specific Considerations

### License Optimization

| webMethods License | STOA Strategy |
|--------------------|---------------|
| API Gateway | Replace with STOA Gateway (optional) |
| Mediator | Keep for complex transformations |
| Integration Server | Keep for backend integrations |
| API Portal | Replace with STOA Portal |

### Configuration Mapping

| webMethods Concept | STOA Equivalent |
|--------------------|-----------------|
| Application | Subscription |
| API Package | API Group |
| Policy | Policy (STOA format) |
| OAuth Scope | Keycloak Scope |
| Transaction Log | Audit Trail |

### Transformation Migration

Complex webMethods mediations can be:

1. **Kept as-is** — STOA routes to webMethods for transformation
2. **Simplified** — Move simple transformations to STOA
3. **Modernized** — Rewrite in STOA's policy language

---

## DataPower-Specific Considerations

### Multi-Protocol Support

DataPower's strength is multi-protocol handling:

| Protocol | STOA Support |
|----------|--------------|
| HTTP/REST | Native |
| SOAP/XML | Native |
| MQ/JMS | Via adapter |
| FTP | Planned |

### Security Token Service

DataPower STS functions mapped to STOA:

| DataPower STS | STOA Equivalent |
|---------------|-----------------|
| Token validation | Keycloak validation |
| Token transformation | Token Exchange (RFC 8693) |
| SAML assertions | Keycloak SAML broker |
| WS-Security | Not supported (use OIDC) |

---

## Rollback Procedure

At any point, revert to original routing:

```bash
# Immediate rollback
kubectl apply -f original-routing.yaml

# Verify
stoa traffic status --gateway webmethods
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| API imports | 100% registered in STOA |
| Identity federation | SSO working |
| Observability | Dashboards showing data |
| Traffic migration | ≥95% through STOA |
| Latency | ≤ webMethods baseline + 5ms |

---

## Next Steps

- [Oracle OAM Migration](./oracle-oam) — If you also have Oracle identity
- [Hybrid Deployment](/docs/deployment/hybrid) — Architecture options
- [Security & Compliance](/docs/enterprise/security-compliance) — DORA/NIS2 considerations

---

*Need migration assistance? [Contact us](mailto:contact@gostoa.dev) for professional services.*
