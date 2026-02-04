---
sidebar_position: 1
title: Enterprise Use Cases
description: Industry-specific use cases for STOA Platform across Banking, Insurance, Logistics, and Luxury/Retail
---

# Enterprise Use Cases

STOA Platform addresses critical API management challenges across regulated industries. Each vertical faces specific constraints that require tailored solutions.

## Banking & Central Banks

**Target clients:** Commercial banks, European central banks, payment processors

### The Challenge

```mermaid
flowchart LR
    subgraph Today["🔴 TODAY'S REALITY"]
        LG["Legacy Gateway<br/>(DataPower)"]
        MIS["Multiple Identity<br/>Systems"]
        SL["Siloed<br/>Logging"]
        LG --> MIS --> SL
    end

    LG -.- NV["❌ No visibility"]
    MIS -.- TC["❌ Token chaos"]
    SL -.- DC["❌ DORA compliance?"]

    style Today fill:#fee2e2,stroke:#ef4444
    style NV fill:#fef2f2,stroke:#ef4444,stroke-dasharray: 5 5
    style TC fill:#fef2f2,stroke:#ef4444,stroke-dasharray: 5 5
    style DC fill:#fef2f2,stroke:#ef4444,stroke-dasharray: 5 5
```

**Pain points:**
- **DORA compliance pressure** — 24-hour incident reporting with incomplete audit trails
- **Legacy gateway opacity** — Limited observability into existing gateway infrastructure
- **Identity fragmentation** — Multiple token formats, no unified authorization
- **Cost** — Expensive licenses for declining expertise availability

### STOA Solution

```mermaid
flowchart TB
    subgraph STOA["🟢 WITH STOA"]
        subgraph CP["STOA Control Plane"]
            CAT["📋 Catalog"]
            AUD["📊 Audit"]
            MET["📈 Metrics"]
        end

        EG["Existing<br/>Gateway"]
        KC["Keycloak<br/>+ OAM"]
        GF["Grafana<br/>+ Loki"]

        CP --> EG & KC & GF
    end

    EG -.- OR["✅ Orchestrated<br/>not replaced"]
    KC -.- FI["✅ Federated<br/>identity"]
    GF -.- UO["✅ Unified<br/>observability"]

    style STOA fill:#d1fae5,stroke:#10b981
    style CP fill:#a7f3d0,stroke:#10b981
    style OR fill:#f0fdf4,stroke:#10b981,stroke-dasharray: 5 5
    style FI fill:#f0fdf4,stroke:#10b981,stroke-dasharray: 5 5
    style UO fill:#f0fdf4,stroke:#10b981,stroke-dasharray: 5 5
```

**Key benefits:**
- ✅ **DORA-supportive audit trail** — Complete request lifecycle logging
- ✅ **Legacy protection** — Keep existing gateway investment, add control layer
- ✅ **Unified identity** — Keycloak federates with existing OAM/OIM
- ✅ **Cost control** — Open-source core, pay only for enterprise support

### Banking Reference Architecture

| Component | Current | With STOA |
|-----------|---------|-----------|
| Gateway | DataPower/webMethods | Keep existing + STOA orchestration |
| Identity | Oracle OAM/OIM | OAM + Keycloak federation |
| Observability | Scattered logs | Unified Grafana/Loki dashboards |
| API Catalog | Excel/Confluence | Self-service Developer Portal |
| Compliance | Manual reports | DORA-supportive audit trails |

---

## Insurance

**Target clients:** Large insurance groups, reinsurers, insurtechs

### The Challenge

Insurance APIs must handle diverse protocols (SOAP legacy, REST modern, emerging GraphQL) while maintaining strict audit trails for regulatory compliance.

```mermaid
flowchart TB
    subgraph Chaos["🔴 MULTI-PROTOCOL CHAOS"]
        SOAP["SOAP"] --> ESB["ESB"]
        REST["REST"] --> APIGW["API GW"]
        GQL["GraphQL"] --> Q["???"]
        MQ["MQ/JMS"] --> MOM["MOM"]
    end

    Chaos -.- Problem["❌ 4 systems, 4 teams, 4 monitoring stacks, 0 unified view"]

    style Chaos fill:#fee2e2,stroke:#ef4444
    style Problem fill:#fef2f2,stroke:#ef4444,stroke-dasharray: 5 5
```

**Pain points:**
- **Protocol proliferation** — SOAP, REST, GraphQL, async messaging
- **Partner integration** — Each partner API requires custom integration
- **Audit requirements** — Full transaction history for claims, policies
- **Solvency II** — Operational risk management requirements

### STOA Solution

```mermaid
flowchart TB
    subgraph Protocols["📡 PROTOCOLS"]
        SOAP["SOAP"]
        REST["REST"]
        GQL["GraphQL"]
        MQ["MQ/JMS"]
    end

    subgraph Gateway["🟢 STOA GATEWAY"]
        PA["Protocol Adapters"]
        TR["Translation Layer"]
        PA --> TR
    end

    subgraph Backend["💾 BACKEND SYSTEMS"]
        POL["Policy<br/>System"]
        CLM["Claims<br/>Engine"]
        PTR["Partner<br/>APIs"]
    end

    subgraph Observability["📊 UNIFIED VIEW"]
        CAT["Catalog"]
        METR["Metrics"]
        AUDIT["Audit"]
    end

    SOAP & REST & GQL & MQ --> Gateway
    Gateway --> POL & CLM & PTR
    Gateway -.-> Observability

    style Protocols fill:#fef3c7,stroke:#f59e0b
    style Gateway fill:#d1fae5,stroke:#10b981
    style Backend fill:#f3e8ff,stroke:#8b5cf6
    style Observability fill:#dbeafe,stroke:#3b82f6
```

**Key benefits:**
- ✅ **Protocol translation** — Expose legacy SOAP as modern REST
- ✅ **Partner onboarding** — Self-service subscription to streamline onboarding
- ✅ **Unified audit trail** — Cross-protocol transaction correlation
- ✅ **Real-time monitoring** — SLA tracking across all API types

---

## Logistics & Supply Chain

**Target clients:** Global logistics providers, freight forwarders, 3PLs, shipping lines

### The Challenge

Logistics APIs require real-time data exchange with hundreds of partners, each with different technical capabilities and security requirements.

```mermaid
flowchart TB
    subgraph Partners["🤝 PARTNER DIVERSITY"]
        CA["Carrier A<br/>(REST+OAuth)"]
        CB["Carrier B<br/>(SFTP+CSV)"]
        CU["Customs<br/>(SOAP+Cert)"]
        WH["Warehouse<br/>(EDI+AS2)"]
    end

    subgraph Spaghetti["🔴 CUSTOM INTEGRATIONS"]
        P2P["Point-to-Point<br/>Spaghetti"]
    end

    CA & CB & CU & WH --> Spaghetti

    Spaghetti -.- Problem["❌ Onboarding: 3-6 months per partner"]

    style Partners fill:#fef3c7,stroke:#f59e0b
    style Spaghetti fill:#fee2e2,stroke:#ef4444
    style Problem fill:#fef2f2,stroke:#ef4444,stroke-dasharray: 5 5
```

**Pain points:**
- **Partner diversity** — REST, SOAP, EDI, SFTP, AS2 — each partner is unique
- **Real-time tracking** — Shipment visibility requires sub-second updates
- **Scale variability** — Black Friday 10x traffic spikes
- **Security fragmentation** — Different auth per partner

### STOA Solution

```mermaid
flowchart TB
    subgraph Partners["🤝 PARTNERS"]
        CA["Carrier A"]
        CB["Carrier B"]
        CU["Customs"]
        WH["Warehouse"]
    end

    subgraph STOA["🟢 STOA CONTROL PLANE"]
        subgraph PC["Partner Catalog"]
            C1["Carrier APIs"]
            C2["Customs APIs"]
            C3["Warehouse APIs"]
        end
        PA["Protocol Adapters"]
        EB["Event Bus"]
        PC --> PA --> EB
    end

    subgraph Core["🏢 LOGISTICS CORE"]
        TMS["TMS"]
        WMS["WMS"]
        BI["Analytics"]
    end

    CA & CB & CU & WH --> STOA
    STOA --> TMS & WMS & BI

    STOA -.- Benefit["✅ Streamlined partner onboarding"]

    style Partners fill:#fef3c7,stroke:#f59e0b
    style STOA fill:#d1fae5,stroke:#10b981
    style Core fill:#dbeafe,stroke:#3b82f6
    style Benefit fill:#f0fdf4,stroke:#10b981,stroke-dasharray: 5 5
```

**Key benefits:**
- ✅ **Rapid partner onboarding** — Pre-built adapters, self-service portal
- ✅ **Real-time events** — Webhook and event streaming support
- ✅ **Elastic scaling** — Auto-scale for peak periods
- ✅ **Unified monitoring** — Track all partner SLAs in one dashboard

---

## Luxury & Retail

**Target clients:** Luxury conglomerates, premium brands, omnichannel retailers

### The Challenge

Luxury retail requires seamless omnichannel experiences with extreme scalability during product launches and fashion events.

```mermaid
flowchart TB
    subgraph Channels["🛍️ CHANNELS"]
        EC["E-commerce"]
        BT["Boutique"]
        MB["Mobile App"]
        CL["Clienteling"]
    end

    subgraph Fragmented["🔴 FRAGMENTED BACKENDS"]
        PIM["PIM"]
        OMS["OMS"]
        CRM["CRM"]
        WMS["WMS"]
        STK["Stock"]
    end

    EC & BT & MB & CL --> Fragmented

    Fragmented -.- Problem["❌ Product launch: 100x traffic in 30 seconds"]

    style Channels fill:#fce7f3,stroke:#ec4899
    style Fragmented fill:#fee2e2,stroke:#ef4444
    style Problem fill:#fef2f2,stroke:#ef4444,stroke-dasharray: 5 5
```

**Pain points:**
- **Event-driven traffic** — Product launches, fashion weeks, VIP events
- **Omnichannel consistency** — Same data across all touchpoints
- **VIP treatment** — Priority access for high-value customers
- **Global reach** — Low latency from Paris to Shanghai

### STOA Solution

```mermaid
flowchart TB
    subgraph Channels["🛍️ CHANNELS"]
        EC["E-commerce"]
        BT["Boutique"]
        MB["Mobile"]
        CL["Clienteling"]
    end

    subgraph Gateway["🟢 STOA GATEWAY"]
        subgraph TM["Traffic Management"]
            RL["Rate Limiting"]
            PQ["Priority Queues"]
            CB["Circuit Breakers"]
        end
    end

    subgraph Backend["💾 BACKEND"]
        PIM["PIM"]
        OMS["OMS"]
        CRM["CRM"]
    end

    subgraph Scale["⚡ SCALING"]
        S1["High throughput"]
        S2["Low latency"]
        S3["VIP Priority"]
    end

    EC & BT & MB & CL --> Gateway
    Gateway --> PIM & OMS & CRM
    Gateway -.-> Scale

    style Channels fill:#fce7f3,stroke:#ec4899
    style Gateway fill:#d1fae5,stroke:#10b981
    style Backend fill:#f3e8ff,stroke:#8b5cf6
    style Scale fill:#dbeafe,stroke:#3b82f6
```

**Key benefits:**
- ✅ **Event scalability** — Designed to scale to high request volumes during peak events
- ✅ **VIP priority** — Tiered rate limiting, priority queues
- ✅ **Global edge** — CDN integration, multi-region deployment
- ✅ **Real-time inventory** — Consistent stock across channels

---

## Cross-Industry Capabilities

Regardless of vertical, STOA provides:

| Capability | Description |
|------------|-------------|
| **Self-Service Portal** | Developers find and subscribe to APIs without IT tickets |
| **Unified Observability** | Single dashboard for all APIs, all protocols |
| **Compliance-Supporting Features** | Built-in audit trails to support DORA, NIS2, RGPD compliance efforts |
| **Hybrid Deployment** | Control Plane cloud + Gateway on-premises |
| **No Rip & Replace** | Augment existing gateways, don't replace them |

---

## Next Steps

- [Security & Compliance](/docs/enterprise/security-compliance) — DORA, NIS2, RGPD details
- [Hybrid Deployment](/docs/deployment/hybrid) — Architecture options
- [Request a Demo](mailto:contact@gostoa.dev) — See STOA in action for your industry

---

*Have a specific use case not covered here? [Contact us](mailto:contact@gostoa.dev) to discuss your requirements.*
