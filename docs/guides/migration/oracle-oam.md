---
sidebar_position: 3
title: Oracle OAM / API Platform
description: "Migrate from Oracle Access Manager, OIM, and Oracle API Platform to STOA with Keycloak federation."
keywords: [migration, Oracle OAM, Oracle API Platform, STOA, Keycloak, identity, Oracle migration]
---

# Migration from Oracle OAM / API Platform

This guide covers migration from Oracle Access Manager (OAM), Oracle Identity Manager (OIM), and Oracle API Platform to STOA Platform.

## What You Have

Typical Oracle stack:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                                │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Oracle Access Manager (OAM)              │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ WebGate  │  │  OAM     │  │ Access   │           │     │
│   │  │ Agents   │  │  Server  │  │ Policies │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Oracle Identity Manager (OIM)            │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ User     │  │ Workflow │  │ Entitle- │           │     │
│   │  │ Store    │  │ Engine   │  │ ments    │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Oracle API Platform (optional)           │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ API      │  │ Developer│  │ Analytics│           │     │
│   │  │ Gateway  │  │ Portal   │  │          │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  Pain points:                                                   │
│  • Rigid claims structure — hard to customize tokens           │
│  • Limited modern auth support (no native OIDC federation)     │
│  • Organizations often seek alternatives for cost optimization │
│  • Complex administration requiring specialized expertise       │
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
│  │  │ Portal   │  │ Config   │  │ Keycloak │              │   │
│  │  │ Catalog  │  │ API      │  │ (OIDC)   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                 federates with (not replaces)                   │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Oracle OAM/OIM (On-Prem)                    │   │
│  │                  Remains master IdP                      │   │
│  │           Keycloak federates for token flexibility       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Benefits:                                                      │
│  • Keep Oracle as master identity store                        │
│  • Add OIDC/OAuth2 flexibility via Keycloak                    │
│  • Token Exchange (RFC 8693) for service-to-service            │
│  • Self-service API subscriptions                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Path

### Phase 1: Keycloak Federation with OAM

**Goal:** Establish Keycloak as OIDC layer over OAM

#### Architecture

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Consumer  │────▶│  Keycloak  │────▶│  Oracle    │
│            │     │ (Federated)│     │  OAM/OIM   │
└────────────┘     └────────────┘     └────────────┘
       │                  │
       │           Token Exchange
       │           (RFC 8693)
       ▼                  │
┌────────────┐           │
│   STOA     │◀──────────┘
│  Gateway   │
└────────────┘
```

#### Configuration

1. **Create Keycloak Identity Provider for OAM**

   ```json
   {
     "alias": "oracle-oam",
     "providerId": "oidc",
     "enabled": true,
     "config": {
       "issuer": "https://oam.corp.local/oauth2",
       "authorizationUrl": "https://oam.corp.local/oauth2/authorize",
       "tokenUrl": "https://oam.corp.local/oauth2/token",
       "userInfoUrl": "https://oam.corp.local/oauth2/userinfo",
       "clientId": "keycloak-federation",
       "clientSecret": "${OAM_CLIENT_SECRET}",
       "defaultScope": "openid profile email",
       "syncMode": "IMPORT"
     }
   }
   ```

2. **Configure User Attribute Mapping**

   Map OAM attributes to Keycloak claims:

   ```json
   {
     "mappers": [
       {
         "name": "employee-id",
         "protocol": "openid-connect",
         "protocolMapper": "oidc-usermodel-attribute-mapper",
         "config": {
           "user.attribute": "employeeId",
           "claim.name": "employee_id",
           "jsonType.label": "String"
         }
       },
       {
         "name": "department",
         "protocol": "openid-connect",
         "protocolMapper": "oidc-usermodel-attribute-mapper",
         "config": {
           "user.attribute": "department",
           "claim.name": "department",
           "jsonType.label": "String"
         }
       }
     ]
   }
   ```

3. **Enable Token Exchange**

   ```bash
   # Enable token exchange in Keycloak
   /opt/keycloak/bin/kcadm.sh update realms/stoa \
     -s 'attributes.token-exchange-enabled=true'
   ```

### Phase 2: API Registration

**Goal:** Import Oracle API Platform definitions to STOA

1. **Export from Oracle API Platform**

   ```bash
   # Export API definitions
   curl -X GET "https://oracle-apip/apiplatform/management/v1/apis" \
     -H "Authorization: Bearer $TOKEN" \
     -o oracle-apis.json
   ```

2. **Transform to OpenAPI**

   ```bash
   # Use STOA CLI to convert
   stoa api convert --input oracle-apis.json \
     --format oracle --output openapi-apis.json
   ```

3. **Import to STOA**

   ```bash
   stoa api import --file openapi-apis.json
   ```

### Phase 3: Policy Migration

**Goal:** Translate Oracle policies to STOA format

#### Policy Mapping

| Oracle OAM Policy | STOA Equivalent |
|-------------------|-----------------|
| Authentication Policy | Keycloak Client Policy |
| Authorization Policy | STOA Authorization Policy |
| Session Policy | Keycloak Session Settings |
| Token Policy | Keycloak Token Settings |
| Resource Protection | STOA Route Policy |

#### Example: Authorization Policy

Oracle OAM:
```xml
<AuthorizationPolicy name="api-access">
  <Resource>/api/v1/*</Resource>
  <Rule>
    <Condition>group=api-consumers</Condition>
    <Effect>ALLOW</Effect>
  </Rule>
</AuthorizationPolicy>
```

STOA equivalent:
```yaml
apiVersion: policy.stoa.io/v1
kind: AuthorizationPolicy
metadata:
  name: api-access
spec:
  rules:
  - to:
    - operation:
        paths: ["/api/v1/*"]
    from:
    - source:
        principals: ["group:api-consumers"]
```

### Phase 4: Traffic Migration

**Goal:** Route traffic through STOA with OAM authentication

1. **Configure STOA to validate OAM tokens (via Keycloak)**

   ```yaml
   apiVersion: security.stoa.io/v1
   kind: JWTValidator
   metadata:
     name: oam-jwt
   spec:
     issuer: https://keycloak.stoa.cloud/realms/stoa
     jwksUri: https://keycloak.stoa.cloud/realms/stoa/protocol/openid-connect/certs
     audiences:
     - stoa-gateway
     claimMappings:
       sub: user_id
       employee_id: employee_id
       department: department
   ```

2. **Shadow Traffic Testing**

   ```yaml
   apiVersion: networking.stoa.io/v1
   kind: TrafficShadow
   metadata:
     name: oam-shadow
   spec:
     source:
       idp: oracle-oam
     target:
       idp: keycloak-federated
     percentage: 100
     mode: readonly
   ```

3. **Gradual Cutover**

   ```yaml
   apiVersion: networking.stoa.io/v1
   kind: TrafficSplit
   metadata:
     name: oam-migration
   spec:
     routes:
     - authentication: oracle-oam-direct
       weight: 50
     - authentication: keycloak-federated
       weight: 50
   ```

---

## Oracle-Specific Considerations

### What Stays with Oracle

| Component | Recommendation |
|-----------|----------------|
| OIM User Store | Keep as master |
| OIM Workflows | Keep for provisioning |
| OAM WebGate | Remove when fully migrated |
| OAM Policies | Migrate to Keycloak/STOA |

### What Moves to STOA/Keycloak

| Component | Destination |
|-----------|-------------|
| OAuth/OIDC | Keycloak |
| API Gateway | STOA Gateway |
| Developer Portal | STOA Portal |
| Analytics | STOA + Grafana |

### Token Format Changes

| Attribute | Oracle OAM | Keycloak/STOA |
|-----------|------------|---------------|
| Token Format | OAM proprietary | JWT (RFC 7519) |
| Claims | Limited, rigid | Flexible, customizable |
| Lifetime | OAM session | Configurable per client |
| Refresh | Complex | Standard refresh_token |

### Claims Flexibility

One of the main pain points with OAM is rigid claims structure. With Keycloak:

```javascript
// Custom claim mapper (JavaScript)
token.setOtherClaims("custom_permissions", 
  user.getAttributes().get("permissions").toString());

token.setOtherClaims("api_tier",
  user.getGroups().stream()
    .filter(g => g.getName().startsWith("api-tier-"))
    .findFirst()
    .map(g => g.getName().replace("api-tier-", ""))
    .orElse("basic"));
```

---

## Handling OAM Sessions

### Session Synchronization

To maintain session consistency during migration:

```yaml
apiVersion: session.stoa.io/v1
kind: SessionSync
metadata:
  name: oam-keycloak-sync
spec:
  source:
    type: oracle-oam
    sessionCookie: OAM_JSESSIONID
  target:
    type: keycloak
    sessionCookie: KC_SESSION
  synchronization:
    enabled: true
    direction: bidirectional
```

### Single Logout

Configure OIDC back-channel logout:

```yaml
apiVersion: security.stoa.io/v1
kind: LogoutConfig
metadata:
  name: federated-logout
spec:
  backChannelLogout:
    enabled: true
    url: https://oam.corp.local/oam/logout
  frontChannelLogout:
    enabled: true
    redirectUri: https://portal.corp.local/logged-out
```

---

## Rollback Procedure

Oracle OAM remains fully operational throughout migration:

```bash
# Immediate rollback
kubectl apply -f oam-direct-routing.yaml

# Verify OAM is handling auth
curl -I https://api.corp.local/health \
  -H "Authorization: Bearer $OAM_TOKEN"
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Federation | Keycloak ↔ OAM working |
| Token Exchange | RFC 8693 operational |
| SSO | Single sign-on preserved |
| API Migration | 100% registered in STOA |
| User Experience | No disruption to end users |

---

## Next Steps

- [IBM webMethods Migration](./ibm-webmethods) — If you also have webMethods
- [Hybrid Deployment](/docs/deployment/hybrid) — Architecture options
- [Security & Compliance](/docs/enterprise/security-compliance) — DORA/NIS2 considerations

---

*Need migration assistance? [Contact us](mailto:contact@gostoa.dev) for professional services.*
