---
sidebar_position: 2
title: Vue d'Ensemble de l'Architecture
description: Architecture de haut niveau de la plateforme STOA — stack de production actuelle et plan de données cible Envoy (ADR-073, ADR-074, ADR-075)
keywords: [architecture, overview, control plane, data plane, Envoy, xDS, Kubernetes, design]
---

# Vue d'Ensemble de l'Architecture

> **Production actuelle & Plan de données cible** — Vérifié sur `stoa-platform/stoa` (`main`)

La plateforme STOA est une plateforme de passerelle open source, cloud-native et multi-tenant conçue pour les API traditionnelles et les agents IA. Ce document distingue explicitement deux vues :

1. **Stack de production actuelle** — Ce qui s'exécute aujourd'hui sur `stoa-platform/stoa` (`main`)
2. **Plan de données cible Envoy ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane))** — La convergence des fonctions proxy L4/L7 vers Envoy upstream tandis que STOA conserve le Plan de contrôle, l'autorisation, le protocole MCP et la boucle de contrôle Link

---

## Architecture de Production Actuelle

```mermaid
flowchart TB
    subgraph Ingress["🔒 Couche Ingress"]
        Ing["Contrôleur Ingress + TLS<br/>*.example.com"]
    end

    subgraph UIs["👥 Interfaces Utilisateur"]
        Portal["📱 Portail Développeur<br/>portal.example.com (React 19)"]
        Console["🖥️ Console Admin<br/>console.example.com (React 19)"]
        CLI["⌨️ stoactl (Go 1.25)"]
    end

    subgraph Core["⚙️ Control Plane & Opérateur"]
        API["Control Plane API<br/>api.example.com<br/>(FastAPI / Python 3.11)"]
        Op["stoa-operator<br/>(Python / Kopf — Bêta)"]
    end

    subgraph DP["🚀 Plan de Données & Link"]
        GW["STOA Gateway<br/>mcp.example.com<br/>(Rust / Tokio / axum — Maintenance)"]
        Link["STOA Link (stoa-connect, Go)<br/>Kong/Gravitee/webMethods + ADS Envoy optionnel"]
    end

    subgraph Auth["🔐 Identité & Secrets"]
        KC["Keycloak 26<br/>auth.example.com<br/>Realm unique 'stoa' (ADR-074)"]
        Vault["OpenBao 2.7.2 (API HTTP Vault)<br/>Socle de secrets (ADR-075)"]
    end

    subgraph Data["💾 Données & Événements"]
        PG["PostgreSQL 15 / 16<br/>Schéma partagé + tenant_id"]
        Kafka["Redpanda (API Kafka)<br/>Métrologie & Audit<br/>🔒 Interne Uniquement (ADR-005)"]
        OS["OpenSearch + Data Prepper<br/>Journaux & Audit"]
    end

    subgraph Obs["📊 Observabilité"]
        Prom["Prometheus + Alertmanager"]
        Graf["Grafana"]
        Tempo["Tempo (Traces OTLP)"]
    end

    Ing --> Portal & Console & API & GW & KC
    CLI --> API & GW
    Portal & Console --> API
    API --> KC & Vault & PG & Kafka & OS
    Op --> API
    GW --> KC & Kafka
    GW -->|"Lecture politiques signées & routes"| API
    Link -->|"SSE sortant (ADR-059), pull & heartbeat"| API
    Core & DP --> Prom --> Graf
    Core & DP --> Tempo
```

### Services Principaux sur `main`

| Composant | Point d'entrée / Périmètre | Cycle de vie | Stack |
|-----------|----------------------------|--------------|-------|
| **Portail Développeur** | `portal.<domaine>` | ✅ Production | React 19, TypeScript (`portal/`) |
| **Console Admin** | `console.<domaine>` | ✅ Production | React 19, TypeScript (`control-plane-ui/`) |
| **Control Plane API** | `api.<domaine>` | ✅ Production | Python 3.11, FastAPI, SQLAlchemy (`control-plane-api/`) |
| **STOA Gateway** | `mcp.<domaine>` / `:8080` | ✅ Production / Maintenance ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | Rust, Tokio, axum, tonic (`stoa-gateway/`) |
| **STOA Link (`stoa-connect`)** | Agent sur site / cluster (`:8090`) | Adaptateurs de routes implémentés (Kong/Gravitee/webMethods) / ADS Envoy sur option | Go 1.25 (`stoa-go/cmd/stoa-connect`) |
| **CLI `stoactl`** | Poste opérateur / CI | ✅ Production (compilé depuis `stoa-go/`) | Go 1.25 (`stoa-go/cmd/stoactl`) |
| **`stoa-operator`** | Intra-cluster (`GatewayInstance`, `GatewayBinding`) | 🧪 Bêta | Python, Kopf (`stoa-operator/`) |
| **Keycloak** | `auth.<domaine>` (realm `stoa`) | ✅ Production | Keycloak 26 ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) |
| **OpenBao** | API HTTP Vault interne | 🔄 Déploiement partiel | OpenBao 2.7.2, MPL 2.0 ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) |
| **Redpanda** | Réseau interne du cluster uniquement | ✅ Production | Redpanda / API Kafka ([ADR-005](/docs/architecture/adr/adr-005-event-driven-kafka)) |
| **PostgreSQL** | Réseau interne du cluster uniquement | ✅ Production | PostgreSQL 15 (Compose complet / catalogue prod) ou 16 (R1 `quickstart/`), schéma partagé (`tenant_id`) |
| **Observabilité** | Réseau interne / ingress opérateur | ✅ Production | Prometheus, Grafana, OpenSearch, Data Prepper, Tempo |

### Garanties Architecturales Implémentées sur `main`

- **Identité tenant sur realm unique ([ADR-074](/docs/architecture/adr/adr-074-tenant-model))** : Un unique realm Keycloak partagé (`stoa`), un groupe Keycloak racine par tenant (`/<tenant_id>`, `setup_tenant_group`), des claims JWT `tenant_id` vérifiés (`Claims::tenant_id()` / `require_tenant` sur la passerelle et `require_tenant_access` en Python, `enforce_tenant_isolation` désignant le champ booléen de configuration `RbacPolicy` Rust) et un schéma PostgreSQL partagé filtré par `tenant_id` (remplaçant l'ancienne ébauche d'un realm par tenant d'ADR-026).
- **Posture passerelle fail-closed ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture))** : `stoa-gateway` vérifie les artefacts de politiques signés Ed25519 par tenant (`STOA_POLICY_BOOT_TENANTS`), impose `STOA_MCP_AUDIENCE` et maintient un spool WAL d'audit durable (`STOA_AUDIT_SPOOL_DIR`).
- **MCP `2025-11-25` & Routes de contrats** : Streamable HTTP (`POST /mcp`), SSE (`/mcp/sse`), WebSocket sur option (`/mcp/ws` via `STOA_WEBSOCKET_ENABLED=true`) et déclaration transactionnelle REST + MCP (`POST /admin/contracts`).
- **Orchestration multi-passerelles ([ADR-035](/docs/architecture/adr/adr-035-gateway-adapter-pattern))** : Le Control Plane embarque 6 adaptateurs Python (Kong, Gravitee, webMethods, Apigee, AWS API Gateway, Azure APIM), tandis que l'agent Go sur site `stoa-connect` implémente les adaptateurs de routes pour Kong, Gravitee (aucun client Gravitee en production à ce jour ; les conflits HTTP `409` sur les routes sont masqués) et webMethods, ainsi que l'ADS Envoy opt-in explicite — l'application des politiques par Link est refusée (`unsupported` dans `policy_contract.go`) pour Kong et Gravitee, et active pour webMethods ainsi que les filtres Envoy ADS v1 (`cors`, `rate_limit`, `ip_filter`), sans faire transiter l'orchestration par Kafka.
- **Aucune dépendance Redis** : Les caches de limitation de débit, JWKS et jetons résident en mémoire dans chaque processus ; STOA n'utilise pas Redis.

### Dépôts Git Publics

| Dépôt | Objectif |
|-------|----------|
| `stoa-platform/stoa` | Monorepo : Control Plane API, UI, `stoa-gateway`, `stoa-go` (`stoactl` + `stoa-connect`), `stoa-operator`, `quickstart/`, `deploy/docker-compose/` et charts Helm (`charts/stoa-platform`, `charts/stoa-observability`) |
| `stoa-platform/stoa-docs` | Site de documentation (`docs.gostoa.dev`) |
| `stoa-platform/stoa-web` | Site vitrine (`gostoa.dev`) |

*(Note : les charts Helm résident directement dans `stoa-platform/stoa/charts/` ; il n'existe pas de dépôt de chart actif distinct `stoa-helm`.)*

### Flux de Synchronisation

```mermaid
sequenceDiagram
    participant Dev as Opérateur / GitOps
    participant CP as Control Plane API
    participant Link as STOA Link (stoa-connect)
    participant GW as Passerelle Cible (Envoy / Kong / Gravitee / webMethods)

    Link->>CP: Ouvrir le flux SSE sortant (ADR-059) & s'enregistrer
    Dev->>CP: Déclarer API / Contrat / Binding
    CP-->>Link: Diffuser la notification de déploiement sur le SSE ouvert par Link
    Link->>CP: Récupérer le snapshot de routes/politiques désiré (HTTPS)
    Link->>GW: Appliquer routes & politiques (Admin API ou ADS mTLS loopback)
    GW-->>Link: Acquittement de synchronisation
    Link->>CP: Heartbeat & ACK de réconciliation
```

:::caution Bus d'événements vs Synchronisation de configuration
La synchronisation du Plan de contrôle n'est **pas** pilotée par Kafka ([ADR-059](/docs/architecture/adr/adr-059-simplified-deployment-sse)). Redpanda/Kafka est strictement interne pour la métrologie asynchrone, l'audit et les snapshots d'erreurs ([ADR-005](/docs/architecture/adr/adr-005-event-driven-kafka)).
:::

---

## Plan de Données Cible Envoy ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane))

Plutôt que de maintenir un proxy noyau/eBPF sur mesure ou de réécrire le Control Plane en Go, [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) délègue les fonctions proxy L4/L7 commoditisées (TLS/mTLS, HTTP/1-2-3, pools de connexions, retries, circuit breaking) à **Envoy upstream**, tout en conservant la valeur différenciante de STOA dans des services dédiés :

```mermaid
flowchart TB
    Client["Client API / Agent IA"] --> Envoy["Proxy Envoy Upstream<br/>TLS, HTTP/2, Filtres natifs"]
    Link["STOA Link (stoa-connect, Go)<br/>xDS ADS mTLS loopback (127.0.0.1:18000)"] -->|"SSE sortant & pull"| CP["Control Plane API<br/>(FastAPI)"]
    Link -->|"CDS / LDS / RDS"| Envoy
    Envoy -->|"Check ext_authz gRPC"| Authz["STOA ExtAuthzService (Rust)<br/>JWT, tenant_id, aud/scopes & DecisionEngine"]
    Envoy -->|"Routes MCP"| MCPMod["Module STOA MCP (Rust)<br/>JSON-RPC tools/call, SSE & politique d'outils signée (ADR-070)"]
    Envoy -->|"Routes REST / gRPC"| Upstream["Backends Entreprise"]
```

### Briques Livrées vs Migration Restante sur `main`

| Capacité | Statut sur `main` | Preuve d'implémentation |
|----------|-------------------|-------------------------|
| **Serveur xDS ADS mTLS loopback dans `stoa-connect`** | ✅ Implémenté (sur option via `STOA_GATEWAY_TYPE=envoy`) | `stoa-go/cmd/stoa-connect/envoy.go`, `stoa-go/cmd/stoa-connect/ENVOY.md` ; traduit en v1 `cors`, `rate_limit` par processus et `ip_filter` pair direct |
| **`ExtAuthzService` gRPC dans `stoa-gateway`** | ✅ Implémenté (sur option via `STOA_EXT_AUTHZ_GRPC_ADDR`, `STOA_EXT_AUTHZ_AUDIENCE` et `STOA_EXT_AUTHZ_REQUIRED_SCOPES` non vide en `prod`) | `stoa-gateway/src/authz/ext_authz_grpc.rs`, `stoa-gateway/src/config/loader.rs:212-223` (valide JWT, `tenant_id`, audience/scopes & `DecisionEngine` ; chemin distinct des politiques d'outils JWS MCP) |
| **Harnais d'acceptation hors ligne Envoy + Link + gRPC** | 🧪 Harnais manuel hors ligne (`workflow_dispatch`) | `docs/testing/o1-offline-envoy.md`, `.github/workflows/o1-envoy-real-proof.yml` (Envoy réel + Link + témoin gRPC `Check` indépendant + auth synthétique/SQLite ; ni contrôle CI automatique par PR ni test Rust `ExtAuthzService`/JWT) |
| **Parité complète du traducteur de politiques** | 🚧 En cours | `jwt_validation`, OIDC, `logging`, `caching` et `transform` ne sont pas encore traduits en filtres Envoy par `stoa-connect` |
| **`ext_proc` streaming & découplage MCP autonome** | 📋 Prévu ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | Métrologie jetons / garde-fous `ext_proc` et séparation du module MCP |
| **Bascule de topologie par défaut Helm & Compose** | 📋 Prévu | `charts/stoa-platform` et `deploy/docker-compose/` déploient encore `stoa-gateway` directement comme passerelle d'entrée par défaut |

Consultez [Architecture du plan de données](/docs/architecture/data-plane) pour les références fichier/ligne exactes et les étapes de migration.

---

## CRD Kubernetes Déployées (`gostoa.dev/v1alpha1`)

Cinq Custom Resource Definitions sont livrées aujourd'hui dans `charts/stoa-platform/crds/` sous le groupe d'API `gostoa.dev/v1alpha1` :

- **Surveillées par `stoa-gateway`** (`STOA_K8S_ENABLED=true`, binaire compilé avec la feature Cargo `k8s`) : `Tool`, `ToolSet`, `Skill`
- **Réconciliées par `stoa-operator`** : `GatewayInstance`, `GatewayBinding`

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: billing-api
  namespace: stoa-system
spec:
  displayName: Billing API
  description: Consulter les factures client
  endpoint: https://billing.internal.example.com/v1/invoices
  method: GET
  inputSchema:
    type: object
    properties:
      customer_id:
        type: string
---
apiVersion: gostoa.dev/v1alpha1
kind: GatewayInstance
metadata:
  name: prod-edge-mcp
  namespace: stoa-system
spec:
  displayName: Production Edge MCP Gateway
  gatewayType: stoa_edge_mcp
  environment: prod
  baseUrl: https://mcp.example.com
```

Consultez la [Référence des CRD Kubernetes](/docs/reference/crds) pour les schémas complets et les enums imposés.

---

## Comparaison de la Stack Technologique

| Couche | Production actuelle (`main`) | Évolution cible |
|--------|------------------------------|-----------------|
| **Plan de données L4/L7** | `stoa-gateway` (Rust, Tokio, axum — Maintenance) | Envoy upstream + `stoa-connect` ADS mTLS loopback ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) |
| **Moteur d'autorisation** | Middleware Rust embarqué + OPA + politiques signées ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) | Serveur gRPC Rust `ExtAuthzService` appelé par Envoy (`STOA_EXT_AUTHZ_GRPC_ADDR`) |
| **Couche protocole MCP** | Intégrée dans `stoa-gateway` (Rust) | Service Rust MCP dédié derrière Envoy |
| **Control Plane API** | Python 3.11, FastAPI | Python 3.11, FastAPI |
| **CLI & Agent Link** | Go 1.25 (`stoactl`, `stoa-connect`) | Go 1.25 (`stoactl`, `stoa-connect` / STOA Link) |
| **Opérateur Kubernetes** | Python, Kopf (`stoa-operator`, Bêta) | Python, Kopf (`stoa-operator`) |
| **Frontend** | React 19, TypeScript, Tailwind | React 19, TypeScript, Tailwind |
| **Base de données** | PostgreSQL 15 / 16 (schéma partagé, `tenant_id`) | PostgreSQL 15 / 16 ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) |
| **Bus d'événements** | Redpanda (API Kafka, interne uniquement) | Redpanda ([ADR-005](/docs/architecture/adr/adr-005-event-driven-kafka)) |
| **Identité** | Keycloak 26 (realm unique `stoa`, groupes par tenant) | Keycloak 26 ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) |
| **Secrets** | OpenBao 2.7.2 / API HTTP Vault (déploiement partiel) | Couverture complète OpenBao / API HTTP Vault ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) |
| **Observabilité** | Prometheus, Grafana, OpenSearch, Data Prepper, Tempo | Métriques, journaux et traces OpenTelemetry |

---

## Zones de Sécurité

| Zone | Niveau de Confiance | Composants |
|------|---------------------|------------|
| **Externe** | Non fiable | Clients API, Agents IA, Interfaces Web |
| **DMZ** | Semi-fiable | Contrôleur Ingress, `stoa-gateway`, Envoy + `stoa-connect` |
| **Interne** | Fiable | Control Plane API, `stoa-operator`, Keycloak, PostgreSQL, Redpanda, OpenBao, OpenSearch |

Principes de sécurité clés :
- Redpanda/Kafka n'a **aucune exposition externe** ([ADR-005](/docs/architecture/adr/adr-005-event-driven-kafka))
- L'isolation multi-tenant repose sur le realm unique Keycloak `stoa`, un groupe par tenant et le claim JWT `tenant_id` vérifié ([ADR-074](/docs/architecture/adr/adr-074-tenant-model))
- L'autorisation d'outils passerelle opère en mode fail-closed si un artefact de politique signé est absent ou invalide ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture))
- Livraison GitOps déclarative avec Argo CD ([ADR-007](/docs/architecture/adr/adr-007-gitops-argocd)) et images Helm épinglées par digest
- Secrets gérés via l'API HTTP Vault : OpenBao par défaut ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao))

---

## Documents Associés

- [Architecture du plan de données](/docs/architecture/data-plane) — Architecture détaillée Envoy + STOA Link + `ext_authz`
- [Modes de déploiement de la passerelle](/docs/concepts/gateway) — `edge-mcp`, `sidecar`, `proxy` et `shadow`
- [Décisions d'Architecture (ADR)](/docs/architecture/adr) — Index complet des ADR
- [Référence des CRD Kubernetes](/docs/reference/crds) — Schémas `gostoa.dev/v1alpha1`
