---
sidebar_position: 10
title: Statut d'Implémentation
description: "Suivez l'état d'implémentation réel de STOA Platform — Control Plane, Gateway Rust, transition vers Envoy (ADR-073), STOA Link, adaptateurs, charts Helm et suites de tests."
keywords: [STOA, implementation, statut, roadmap, architecture, composants, Rust gateway, Envoy, STOA Link, MCP]
---

# Statut d'Implémentation

Suivez l'état réel au runtime de chaque composant de la plateforme STOA dans le dépôt `stoa-platform/stoa`.

:::info Dernière Mise à Jour
**Novembre 2026** — Les composants disposent de versions SemVer indépendantes ([Notes de version](/docs/reference/changelog)). Le modèle multi-tenant à realm unique ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) et les politiques d’outils signées *fail-closed* ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) sont en place. Le déploiement d’OpenBao reste partiel ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)). Le plan de données évolue vers Envoy et STOA Link xDS ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)).
:::

## Composants Principaux

| Composant | Technologie | Statut | Description |
|-----------|-------------|--------|-------------|
| Control Plane API | Python 3.11+, FastAPI, SQLAlchemy | **Production** | Catalogue d'APIs, contrats UAC, cycle de vie des tenants et abonnements, orchestration des passerelles (`control-plane-api` `v1.14.x`) |
| STOA Gateway (Rust) | Rust, Tokio, axum | **Production (Maintenance)** | Plan de données `edge-mcp` et API actuel (`stoa-gateway` `v0.9.x`) ; maintenu pendant la montée en puissance du plan de données Envoy ([ADR-073 §9](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) |
| Plan de Données Envoy | Envoy upstream + xDS + `ext_authz` / `ext_proc` | **En cours** | Plan de données cible configuré en xDS par STOA Link, avec les services de politiques et le module MCP hors processus ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) |
| Console UI | React 19.3.1 sur `main`, TypeScript, Vite | **Production** | Interface d'administration pour le catalogue, les politiques, l'observabilité et l'exploitation multi-tenant (`control-plane-ui` `v1.12.x`) |
| Developer Portal | React 19.3.1 sur `main`, TypeScript, Vite | **Production** | Découverte en libre-service des APIs et outils MCP, abonnements et identifiants (`portal` `v1.3.x`) |
| Couche d'Authentification | Keycloak 26 | **Production** | Unique realm `stoa`, un groupe par tenant et claim JWT `tenant_id` ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)) ; fédération multi-IdP OIDC/LDAP/SAML démontrée dans la démo de fédération séparée |
| CLI (`stoactl`) | Go, Cobra (`stoa-go`) | **Production** | Réconciliation GitOps déclarative, pont OpenAPI vers MCP et gestion des ressources (`stoa-go` `v0.3.x`, [Référence CLI](/docs/reference/cli)) |
| STOA Link (`stoa-connect`) | Go (`stoa-go`) | **Production / En extension** | Agent sur site à flux SSE sortant synchronisant les passerelles tierces et servant les snapshots ADS/xDS mTLS loopback à Envoy ([ADR-057](/docs/architecture/adr/adr-057-product-lineup-gateway-link-connect), [ADR-059](/docs/architecture/adr/adr-059-simplified-deployment-sse)) |
| Opérateur Kubernetes (`stoa-operator`) | Python, Kopf | **Bêta** | Réconcilie les CRDs `GatewayInstance` et `GatewayBinding` via l’API du Control Plane. Les manifestes Kubernetes sont autonomes. La CI exécute les tests Python quand l’opérateur change. |

## Capacités du Plan de Données & de la Passerelle

Le trafic de production passe aujourd'hui par **STOA Gateway (Rust)** en mode `edge-mcp`, tandis que le **plan de données Envoy ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane))** est en cours d'assemblage :

| Capacité | Statut | Détails |
|----------|--------|---------|
| Protocole MCP (mode `edge-mcp`) | **Production** | MCP 2025-11-25 — découverte et appel d'outils, Streamable HTTP & SSE, ressources, prompts, complétion |
| Politiques d'Outils Signées Fail-Closed | **Production** | Artefacts signés par le Control Plane avec expiration stricte ; `/ready` requiert `policyBootTenants` ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) |
| Proxy REST Dynamique & Proxy LLM | **Production** | Routage REST dynamique avec des garde-fous en mode observation. Le proxy LLM dédié transmet le corps des requêtes tel qu’il le reçoit et mesure la consommation de jetons pour OpenAI, Azure, Anthropic et Mistral. |
| Garde-fous des appels d’outils MCP | **Configurables** | Les appels d’outils MCP prennent en charge le masquage des données personnelles, les contrôles d’injection de prompt et de contenu, ainsi que l’application du budget de jetons. |
| OAuth 2.1, mTLS & DPoP | **Production** | Validation JWT Keycloak, découverte OAuth et proxy DCR ([ADR-044](/docs/architecture/adr/adr-044-mcp-oauth-gateway-proxy)), jetons liés au certificat RFC 8705, DPoP RFC 9449 |
| Rate Limiting, Circuit Breaker & En-têtes de Sécurité | **Production** | Quotas à fenêtre glissante par consommateur, circuit breaker par amont, en-têtes OWASP, blocage SSRF |
| Mode Compagnon / Sidecar (`POST /authz`) | **Runtime présent** | Endpoint allow/deny par code HTTP dans `stoa-gateway` ; aucun appel réel depuis une passerelle tierce démontré en CI. Voir [Usage du compagnon](/docs/guides/companion-usage) |
| ADS/xDS Loopback Envoy (`STOA_GATEWAY_TYPE=envoy`) | **En cours** | Serveur ADS mTLS loopback (`CDS`/`LDS`/`RDS`), câblage `ext_authz` fail-closed et politiques v1 `cors` / `rate_limit` / `ip_filter` dans `stoa-connect` ; service `ext_authz` externe et politiques JWT/OIDC/transform en cours |
| Modes Proxy & Shadow | **Implémentations Rust partielles** | Proxy démarre avec un registre de routes vide et sans transformateurs raccordés. Shadow expose les routes UAC sans source de capture. L’[ADR-073 §8](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) définit la cible Envoy pour le routage et la mise en miroir du trafic. |

## Adaptateurs de Passerelles

STOA orchestre les passerelles externes via les adaptateurs d'administration du Control Plane ([ADR-035](/docs/architecture/adr/adr-035-gateway-adapter-pattern)) et l'agent sur site **STOA Link (`stoa-connect`)** :

| Passerelle Cible | Adaptateur Control Plane (`control-plane-api`) | Agent STOA Link (`stoa-connect`) | Notes |
|------------------|------------------------------------------------|----------------------------------|-------|
| STOA Gateway (Rust) | **Production** | — (auto-enregistrement natif) | Synchronisation directe Control Plane & politiques d'outils signées |
| Envoy (upstream) | **En cours** (UAC → xDS) | **En cours** (ADS mTLS loopback) | Plan de données stratégique selon l'[ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) |
| webMethods | **Production** | **Production** | Découverte REST Admin API, synchronisation routes/politiques/alias |
| Kong (DB-less / Admin API) | **Implémenté** | **Implémenté** | Le Control Plane applique la configuration déclarative et les politiques. Link découvre les APIs et synchronise les routes. L’application des politiques par Link reste indisponible. Arena mesure le trafic proxy. |
| Gravitee (APIM v4) | **Implémenté** | **Implémenté** | Le Control Plane réconcilie les APIs, les plans et les politiques. Link découvre les APIs et synchronise les routes. L’application et le retrait des politiques par Link restent indisponibles. Arena mesure le trafic proxy. |
| Apigee | **Implémenté** | — | Mapper et adaptateur Control Plane (`adapters/apigee/`) |
| AWS API Gateway | **Implémenté** | — | Mapper et adaptateur Control Plane (`adapters/aws/`) |
| Azure APIM | **Implémenté** | — | Mapper et adaptateur Control Plane (`adapters/azure/`) |

## Packaging & Infrastructure

| Composant | Technologie | Statut | Notes |
|-----------|-------------|--------|-------|
| Chart Helm (`charts/stoa-platform`) | Helm 3.12+ | **Périmètre Gateway** | Déploie le STOA Gateway, les 5 CRDs et les ressources optionnelles de synchronisation/monitoring depuis un clone du dépôt ; le Control Plane, la Console, le Portail, Keycloak et PostgreSQL se déploient séparément ([Guide d'installation](/docs/admin/installation)) |
| Chart Observabilité (`charts/stoa-observability`) | Grafana Alloy, Tempo, Blackbox Exporter | **Disponible** | Fournit la collecte OTLP, le traçage et les sondes synthétiques en option. Inclut la configuration des sources de données pour une instance Grafana existante. |
| Base de données | PostgreSQL 15 / 16 | **Production** | Schéma partagé filtré par `tenant_id` ; sauvegarde et restauration vérifiées en CI sur PostgreSQL 16 jetable |
| Bus d'événements | Redpanda / Kafka | **Production** | Métrologie et événements de déploiement. Le test Docker Compose dédié vérifie la perte d’un broker sur 3 avec un facteur de réplication de 3. Le Compose standard et `k8s/redpanda` restent mono-broker. |
| Audit & Recherche de logs | OpenSearch 2.11 | **Production** | Piste d'audit en double écriture et indexation des journaux |
| Backend de secrets | OpenBao (API Vault, [ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) | **Partiel** | La CI teste `hvac` avec OpenBao `2.7.2`. Le profil Compose optionnel `vault` lance `bao agent`, qui se connecte à un serveur externe. Helm fournit une surveillance optionnelle pour un serveur existant. Une partie des workloads utilise encore des Secrets Kubernetes. |
| Preuve HA Identité | Vérificateur HA Keycloak | **Non prouvée dans le dépôt** | Le contrôle statique (`deploy/keycloak/ha-proof`) renvoie `HA_STATIC=fail` pour les définitions du dépôt. `charts/stoa-platform` ne fournit ni StatefulSet Keycloak ni PodDisruptionBudget Keycloak. |
| GitOps & CI/CD | ArgoCD + GitHub Actions + GHCR | **Production** | SAST, scans d'images sans cache OS, SBOMs, épinglage par digest et gardes de non-régression |

## Suite de Tests Automatisés (Novembre 2026)

Le tableau donne des ordres de grandeur à partir des sources de `stoa-platform/stoa` au commit [`639e8b9a`](https://github.com/stoa-platform/stoa/tree/639e8b9a). Le comptage des fichiers suit les motifs configurés de pytest et Vitest, les attributs de test Rust et les fichiers Go `_test.go`.

| Composant | Suite de Tests | Fichiers | Tests Automatisés |
|-----------|----------------|----------|-------------------|
| Control Plane API | `pytest` (unitaires, contrats, API, adaptateurs) | 467 | **7 400+** |
| STOA Gateway (Rust) | `cargo test` (unitaires, contrats, sécurité, intégration) | 251 | **2 870+** |
| Console UI | `vitest` | 184 | **1 760+** |
| Developer Portal | `vitest` | 101 | **~980** |
| `stoa-go` (`stoactl` + `stoa-connect`) | `go test` (CLI, boucles connect, adaptateurs, ADS Envoy) | 85 | **490+** |
| Bout-en-bout & Résilience | Playwright BDD + contrôles sauvegarde/failover CI | — | Smoke, parcours critiques, restauration PG 16 jetable, bascule Redpanda dans un environnement Compose dédié à 3 brokers, contrôle statique de la HA Keycloak |

## Feuille de Route & Décisions d'Architecture

- Pour le suivi des chantiers Envoy + xDS en cours, des fonctionnalités planifiées et des cibles remplacées ou écartées (Pingora, eBPF, Wasm), consultez la [Feuille de route](/docs/roadmap).
- Pour le détail des choix et compromis d'architecture, consultez l'[Index des ADRs](/docs/architecture/adr/).

---

*Toutes les marques citées appartiennent à leurs propriétaires respectifs ([Mentions sur les marques](/docs/legal/trademarks) — All trademarks are the property of their respective owners).*
