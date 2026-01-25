---
title: Security & Compliance
description: How STOA Platform addresses enterprise security requirements and regulatory compliance (DORA, NIS2, RGPD)
sidebar_position: 2
---

# Security & Compliance

STOA Platform is designed with **European enterprise security requirements** at its core. This page explains how STOA helps organizations meet regulatory obligations while maintaining operational efficiency.

## Regulatory Compliance

### DORA (Digital Operational Resilience Act)

The Digital Operational Resilience Act requires financial entities to strengthen their ICT risk management. STOA addresses key DORA requirements:

| DORA Requirement | How STOA Helps |
|------------------|----------------|
| **ICT Risk Management** | Centralized Control Plane with full audit trail of all API operations |
| **Incident Reporting** | Real-time alerting via Grafana + structured logs in OpenSearch for incident reconstruction |
| **Operational Resilience Testing** | Built-in health checks, circuit breakers, and chaos engineering support |
| **Third-Party Risk** | API subscription governance with approval workflows and usage monitoring |

**DORA Compliance Flow:**

```mermaid
sequenceDiagram
    participant C as 👤 Consumer
    participant GW as ⚡ Gateway
    participant KC as 🔐 Keycloak
    participant CP as ⚙️ Control Plane
    participant LOG as 📋 Audit Log

    C->>GW: API Request (JWT)
    GW->>KC: Validate Token
    KC-->>GW: ✓ Valid + RBAC
    GW->>LOG: Log: WHO, WHAT, WHEN
    GW->>CP: Process Request
    CP->>LOG: Log: Business Event
    CP-->>GW: Response
    GW->>LOG: Log: Result + Trace ID
    GW-->>C: Response

    Note over LOG: 📋 DORA Compliance<br/>• Complete audit trail<br/>• 24h incident reporting<br/>• Microsecond precision
```

:::info Compliance Disclaimer
STOA provides tools and features to support your compliance efforts. Certification, audit, and ultimate compliance responsibility remains with the implementing organization. Consult qualified advisors for your specific regulatory requirements.
:::

### NIS2 (Network and Information Security Directive)

NIS2 expands cybersecurity requirements across essential sectors. STOA supports compliance through:

- **Supply Chain Security** — Full provenance tracking of API dependencies and third-party integrations
- **Sovereignty** — European-hosted Control Plane option with data residency guarantees
- **Incident Handling** — Automated alerting and audit logs meeting 24-hour reporting requirements
- **Access Control** — Role-based access with Keycloak integration and multi-tenant isolation

:::info Compliance Disclaimer
STOA provides tools and features to support your NIS2 compliance efforts. Certification and audit responsibility remains with the implementing organization.
:::

### RGPD (General Data Protection Regulation)

STOA implements privacy-by-design principles:

| Capability | Implementation |
|------------|----------------|
| **Data Minimization** | Configurable log anonymization — mask PII in request/response logs |
| **Data Residency** | Control Plane Cloud EU or Full On-Premise deployment options |
| **Right to Access** | API usage logs per consumer with export capabilities |
| **Data Portability** | Standard OpenAPI contracts, no vendor lock-in |

:::info Compliance Disclaimer
STOA provides privacy-by-design features to support GDPR compliance. Data protection responsibility remains with the data controller.
:::

## Data Residency Architecture

Understanding what data flows where is critical for compliance. STOA's hybrid architecture provides clear boundaries:

```mermaid
flowchart TB
    subgraph Cloud["☁️ CLOUD (EU Region)"]
        Portal["📱 Portal<br/>(Catalogue)"]
        CP["⚙️ Control<br/>Plane"]
        KC["🔐 Keycloak<br/>(federated)"]

        CD["📄 Data: API metadata,<br/>subscriptions, metrics"]
    end

    subgraph OnPrem["🏢 ON-PREMISE"]
        OAM["Oracle<br/>OAM/OIM"]
        WM["webMethods<br/>Gateway"]
        API["Backend<br/>APIs"]

        OD["🔒 Data: User identities,<br/>payloads, credentials"]
    end

    Cloud <-->|"HTTPS/mTLS<br/>(outbound only)"| OnPrem

    style Cloud fill:#dbeafe,stroke:#3b82f6
    style OnPrem fill:#d1fae5,stroke:#10b981
    style CD fill:#eff6ff,stroke:#3b82f6,stroke-dasharray: 5 5
    style OD fill:#f0fdf4,stroke:#10b981,stroke-dasharray: 5 5
```

### What Stays On-Premise

- **Business Data** — All API request/response payloads containing business information
- **User Identities** — Oracle OAM/OIM remains the master identity provider
- **Credentials** — Secrets, certificates, and sensitive configuration
- **Raw Logs** — Detailed transaction logs (only aggregated metrics sent to cloud)

### What Goes to Cloud

- **API Metadata** — Catalogue information, OpenAPI specifications
- **Aggregated Metrics** — Request counts, latency percentiles, error rates
- **Subscription Data** — Who has access to which APIs
- **Federated Tokens** — Short-lived tokens via Keycloak federation (not credentials)

## Security Architecture

### Authentication & Authorization

```mermaid
sequenceDiagram
    participant C as 👤 Consumer
    participant KC as 🔐 Keycloak<br/>(Federated)
    participant OAM as 🏢 Oracle OAM<br/>(Master)
    participant GW as ⚡ webMethods<br/>Gateway

    C->>KC: 1. Authenticate
    KC->>OAM: 2. Federate identity
    OAM-->>KC: 3. User validated
    KC-->>C: 4. JWT Token
    C->>GW: 5. API Request + JWT
    KC->>GW: 6. Token Exchange (RFC 8693)
    GW-->>C: 7. API Response

    Note over KC,OAM: OIDC Federation<br/>No migration required
```

- **OIDC Federation** — Keycloak federates with existing Oracle OAM, no migration required
- **Token Exchange** — RFC 8693 compliant token exchange for service-to-service calls
- **mTLS** — Mutual TLS between Control Plane and Gateway components
- **RBAC** — Role-based access control with tenant isolation

### Secrets Management

STOA integrates with **HashiCorp Vault** for secrets management:

- Dynamic secrets generation for database credentials
- Automatic credential rotation
- Audit logging of all secret access
- Kubernetes-native integration via CSI driver

### Network Security

| Layer | Protection |
|-------|------------|
| **Edge** | WAF integration, DDoS protection via Cloudflare |
| **Transport** | TLS 1.3, mTLS for internal communication |
| **Application** | Input validation, rate limiting, circuit breakers |
| **Data** | Encryption at rest (AES-256), field-level encryption for PII |

### Trust Boundary Architecture

STOA implements a Zero Trust architecture with clearly defined security zones:

```mermaid
flowchart LR
    subgraph External["🔴 EXTERNAL<br/>(Untrusted)"]
        CL["Clients"]
        ATK["Attackers"]
    end

    subgraph DMZ["🟡 DMZ"]
        ING["Nginx<br/>Ingress"]
        GW["API<br/>Gateway"]
        MCP["MCP<br/>Gateway"]
    end

    subgraph Internal["🟢 INTERNAL<br/>(Trusted)"]
        CP["Control<br/>Plane"]
        KC["Keycloak"]
        DB["PostgreSQL"]
        KF["Kafka<br/>🔒 Internal Only"]
    end

    CL --> ING
    ATK -.->|"❌ BLOCKED"| KF
    ING --> GW & MCP
    GW & MCP --> CP
    CP --> KC & DB & KF

    style External fill:#fee2e2,stroke:#ef4444
    style DMZ fill:#fef3c7,stroke:#f59e0b
    style Internal fill:#d1fae5,stroke:#10b981
```

**Zone Definitions:**
- **External (Red)** — Untrusted internet traffic, potential attackers
- **DMZ (Amber)** — Semi-trusted zone with ingress controllers and gateways
- **Internal (Green)** — Trusted zone with core services, databases, and message queues

## Audit & Observability

### Audit Trail

Every action in STOA is logged with:

- **Who** — User identity, tenant, role
- **What** — Action type, affected resources
- **When** — Timestamp with microsecond precision
- **Where** — Source IP, geographic location
- **Result** — Success/failure, error details

### Log Retention

| Log Type | Default Retention | Configurable |
|----------|-------------------|--------------|
| Access Logs | 90 days | Yes |
| Audit Logs | 1 year | Yes |
| Metrics | 13 months | Yes |
| Security Events | 2 years | Yes |

### Compliance Reporting

Built-in dashboards for:

- API usage by consumer/team
- Authentication failures and anomalies
- Data access patterns
- SLA compliance metrics

## Security Certifications (Roadmap)

| Certification | Status | Target |
|---------------|--------|--------|
| SOC 2 Type II | Planned | Q4 2026 |
| ISO 27001 | Planned | 2027 |
| ISAE 3402 | Planned | 2027 |

---

## Next Steps

- [Hybrid Deployment Options](/docs/deployment/hybrid) — Choose your deployment model
- [Enterprise Use Cases](/docs/enterprise/use-cases) — Industry-specific implementations
- [Migration Guides](/docs/guides/migration) — Move from legacy platforms
