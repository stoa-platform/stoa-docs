---
sidebar_position: 5
title: "Feuille de route STOA Platform : Fonctionnalités & Jalons"
description: "Feuille de route publique de STOA Platform — capacités livrées, transition vers le plan de données Envoy + STOA Link xDS (ADR-073), chantiers planifiés et pistes écartées."
keywords: [roadmap, feuille de route, fonctionnalités, MCP gateway, Envoy, xDS, STOA Link, API management, STOA, open source, LLM proxy]
---

# Feuille de Route

Notre feuille de route d'ingénierie pour STOA Platform — passerelle API et plan de contrôle open source pour les applications d'entreprise et les agents IA.

:::info Document Évolutif
Dernière révision : **novembre 2026**. Les priorités évoluent selon les retours d'exploitation, les décisions d'architecture et les besoins de la communauté. Participez aux échanges sur [Discord](https://discord.gostoa.dev) ou [GitHub Discussions](https://github.com/stoa-platform/stoa/discussions).
:::

:::tip Releases & Versionnement
Depuis avril 2026, STOA publie des **releases indépendantes par composant** (`control-plane-api`, `control-plane-ui`, `portal`, `stoa-gateway`, `stoa-go`) plutôt que des versions monolithiques `vX.Y.Z` (dernière release monolithique : **[v2.3.0](/blog/release-v2.3.0)**, mars 2026). Suivez les versions publiées dans les [Notes de version](/docs/reference/changelog) et la maturité de chaque brique dans le [Statut d'implémentation](/docs/concepts/implementation-status).
:::

---

## Disponible Aujourd'hui

**Plan de Contrôle, Passerelle MCP, Posture de Sécurité & Fédération Multi-Passerelles**

| Capacité | Statut | Référence / Notes |
|----------|--------|-------------------|
| Control Plane API (Python/FastAPI) | Disponible | `control-plane-api` (`v1.14.x`) — catalogue, contrats UAC, abonnements, promotions, piste d'audit |
| Console d'Administration & Portail Développeur (React/TypeScript) | Disponible | `control-plane-ui` (`v1.12.x`, i18n) et `portal` (`v1.3.x`) |
| STOA Gateway — runtime `edge-mcp` (Rust/Tokio/axum) | Disponible | `stoa-gateway` (`v0.9.x`) — plan de données MCP & API en production ; entre en maintenance selon l'[ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) |
| Multi-Tenancy à Realm Unique & Authentification Keycloak | Disponible | Un seul realm `stoa`, un groupe Keycloak par tenant et claim `tenant_id` vérifié par l’API du plan de contrôle et la passerelle ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)). Le courtage OIDC/LDAP/SAML est illustré dans la démo de fédération. L’attribution d’un tenant par courtage dans le realm du produit reste à vérifier |
| Autorisation d'Outils Fail-Closed & Politiques Signées | Disponible | Permissions *deny-by-default*, artefacts signés par le Control Plane avec expiration stricte, sonde `/ready` conditionnée au chargement des politiques pour les tenants configurés dans `policyBootTenants` ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) |
| Backend de Secrets OpenBao (API HTTP Vault) | Partiel / Déploiement | OpenBao `2.7.2`, compatible avec Vault, testé en CI (`hvac`) et disponible avec `bao agent` via le profil Compose optionnel `vault`. La supervision Helm cible OpenBao lorsqu’elle est activée et reste désactivée par défaut. Infisical a été retiré. La migration des secrets du cluster se poursuit ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) |
| Protocole MCP 2025-11-25 | Disponible | Découverte d'outils, transports Streamable HTTP & SSE, ressources, prompts et complétion. Le module de découverte à la demande existe et est initialisé. Son raccord au traitement des requêtes reste à faire ([ADR-051](/docs/architecture/adr/adr-051-lazy-mcp-discovery)) |
| UAC (Universal API Contract) | Disponible | Schéma de contrat unique, validation JSON Schema, projection OpenAPI vers MCP ([ADR-067](/docs/architecture/adr/adr-067-uac-as-llm-optimized-executable-contract)) |
| Proxy LLM, Garde-fous & Maîtrise des Coûts | Disponible | Routage LLM vers plusieurs fournisseurs et mesure de la consommation. Masquage des données personnelles, contrôle des prompts et budgets de tokens par tenant configurables pour les appels d’outils MCP. Le proxy REST observe les corps de requête ([ADR-050](/docs/architecture/adr/adr-050-guardrails-token-budget-state), [ADR-053](/docs/architecture/adr/adr-053-llm-cost-aware-routing)) |
| Système de Skills & Assistant Chat IA Intégré | Disponible | Skills natifs gateway avec circuit breaker ([ADR-047](/docs/architecture/adr/adr-047-mcp-skills-system)) et assistant IA par tenant dans la Console et le Portail ([ADR-048](/docs/architecture/adr/adr-048-integrated-chat-agent)) |
| OAuth 2.1, mTLS & Jetons Liés à l'Émetteur | Disponible | Découverte OAuth & proxy DCR ([ADR-044](/docs/architecture/adr/adr-044-mcp-oauth-gateway-proxy)), jetons liés au certificat RFC 8705 ([ADR-039](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens)), DPoP RFC 9449, politiques OPA, en-têtes OWASP & blocage SSRF |
| Rate Limiting, Circuit Breaker & Métrologie | Disponible | Quotas glissants par consommateur, circuit breaker anti-zombie ([ADR-025](/docs/architecture/adr/adr-025-gateway-resilience-zombie)), métrologie Kafka/Redpanda, APIs de facturation et de gouvernance des données |
| Outil CLI (`stoactl`) | Disponible | CLI déclaratif Go/Cobra dans `stoa-go` (`v0.3.x`) — `apply`, `reconcile`, `deploy`, `bridge`, `mcp`, `gateway`, `audit`, `doctor` ([Référence CLI](/docs/reference/cli)) |
| STOA Link (`stoa-connect`) & Adaptateurs Gateway | Disponible | Link synchronise les routes de webMethods, Kong et Gravitee via un flux SSE sortant ([ADR-059](/docs/architecture/adr/adr-059-simplified-deployment-sse)). Link applique les politiques pour webMethods. Apigee, AWS API Gateway et Azure APIM disposent d’adaptateurs Control Plane ([ADR-035](/docs/architecture/adr/adr-035-gateway-adapter-pattern)). ADS/xDS optionnel pour Envoy en boucle locale avec mTLS. Un [essai isolé avec Envoy réel](https://github.com/stoa-platform/stoa/pull/2908) a vérifié le cycle des routes et la traduction de politiques avec un témoin d’autorisation indépendant |
| Mode Compagnon Gateway (`sidecar`) | Runtime présent | Endpoint allow/deny `POST /authz` dans `stoa-gateway` ; voir [Usage du compagnon](/docs/guides/companion-usage) pour le périmètre et les limites actuelles |
| Chart Kubernetes Gateway, CRDs & Opérateur | Disponible / Bêta | `charts/stoa-platform` déploie le STOA Gateway et 5 CRDs (`Tool`, `ToolSet`, `Skill`, `GatewayInstance`, `GatewayBinding`) ; `charts/stoa-observability` (chart parapluie `charts/stoa-stack`) couvre la télémétrie ; `stoa-operator` (Python/Kopf, **Bêta**) réconcilie `GatewayInstance` & `GatewayBinding` ([Guide d'installation](/docs/admin/installation)) |
| Observabilité, Preuves de Sauvegarde & Runbooks | Disponible | Prometheus, Grafana, audit double écriture OpenSearch, W3C Traceparent, Gateway Arena, preuve CI sauvegarde/restauration PostgreSQL 16 jetable, bascule Redpanda à trois brokers et facteur de réplication 3 vérifiée dans un [essai CI isolé sous Docker Compose](https://github.com/stoa-platform/stoa/actions/runs/42304135706/job/128189174054) (`k8s/redpanda` reste mono-réplica), guides d'[installation hors ligne](/docs/deployment/offline-install), [maintenance](/docs/admin/maintenance), [rotation des secrets](/docs/admin/secret-rotation) et [réponse à incident](/docs/admin/incident-response) |
| Site Public, Tarification & Documentation | Disponible | Site bilingue EN/FR sur [gostoa.dev](https://gostoa.dev), 180+ pages de documentation et 66 ADRs |

---

## En Cours

**Transition du Plan de Données vers Envoy (ADR-073), Boucle xDS & Packaging Plateforme**

| Chantier | Statut | Détails |
|----------|--------|---------|
| Plan de Données Envoy & Services Externes ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | En cours | Adoption d'Envoy upstream non modifié comme plan de données cible, couplé à un adaptateur d'autorisation `ext_authz` fail-closed, un service `ext_proc` et le module MCP placé derrière Envoy |
| Boucle xDS STOA Link & Traduction des Politiques ([ADR-057](/docs/architecture/adr/adr-057-product-lineup-gateway-link-connect), [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | En cours | Extension de la synchronisation des routes et politiques du plan de contrôle via ADS en boucle locale avec mTLS (`CDS`/`LDS`/`RDS`). La traduction couvre `cors`, `rate_limit` local par route et `ip_filter` sur l’adresse du pair direct. Un inventaire non pris en charge ou conflictuel conserve le dernier état acquitté. Validation JWT, OIDC, quotas consommateurs, cache et transformations restent hors de cette traduction |
| Publication d'API Protégée de Bout en Bout via le Control Plane | En cours | Alignement de la publication Control Plane (`POST /v1/tenants/{id}/apis`) sur les garanties JWT entrantes aujourd'hui prouvées via `POST /admin/contracts` |
| Packaging Helm Complet & Topologies HA | En cours | Ajout des déploiements Control Plane API, Console, Portail Développeur et des topologies Kubernetes HA multi-réplicas Keycloak et Redpanda (le contrôle statique Keycloak du dépôt renvoie `HA_STATIC=fail`, et le manifeste Kubernetes Redpanda a un seul réplica), ainsi que la publication d'artefacts Helm/OCI versionnés |
| Circuits d’approbation GitOps | En cours | Finalisation des circuits de promotion et d’approbation par tenant. `stoa-operator` dispose déjà d’une CI automatisée ([ADR-040](/docs/architecture/adr/adr-040-born-gitops-multi-environment)) |

---

## Planifié

**Topologies de Plan de Données, Outillage de Migration & Écosystème**

| Fonctionnalité | Statut | Détails |
|----------------|--------|---------|
| Topologies Proxy & Shadow sur Envoy ([ADR-024](/docs/architecture/adr/adr-024-gateway-unified-modes), [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | Planifié | Déclinaison des modes `proxy` (routage HTTP généré depuis UAC vers des backends existants) et `shadow` (miroir de trafic Envoy vers la découverte UAC) sous forme de profils xDS |
| Outillage de Migration & Rollback Gateway Rust → Envoy | Planifié | Mode d'audit comparatif des décisions, runbooks de bascule et procédures de retour arrière avant la fin de support du gateway Rust ([ADR-073 §9](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) |
| Provider Terraform / OpenTofu | Planifié | Gestion déclarative Infrastructure-as-Code des tenants, contrats UAC et liaisons gateway |
| SDKs Clients Typés (Python, TypeScript) | Planifié | Bibliothèques clientes pour le Control Plane et les intégrations MCP |
| Connecteurs MCP Pré-construits & Modèles ArgoCD | Planifié | Catalogue de connecteurs d'entreprise prêts à l'emploi et modèles GitOps multi-environnements |
| Packaging Hors-Kubernetes / VM pour Envoy + STOA Link ([ADR-038](/docs/architecture/adr/adr-038-sidecar-deployment-strategies-vm)) | Planifié | Bundles systemd/VM autonomes pour les sites opérant sans Kubernetes |

---

## En Exploration

**Pistes de Recherche & Écosystème à Moyen/Long Terme**

- **Aide à la Rédaction de Politiques** — Génération assistée de politiques d'accès OPA/UAC relues et approuvées par un opérateur
- **Partage de Catalogues d'Outils MCP & Contrats UAC** — Définitions signées et réutilisables entre organisations
- **Observabilité des Workflows d'Agents de Bout en Bout** — Traçage causal inter-outils et attribution fine des coûts sur les exécutions multi-étapes
- **Interopérabilité Agent-à-Agent (A2A)** — Évaluation des endpoints expérimentaux de découverte et routage A2A (`/.well-known/agent.json`) derrière le plan de données Envoy

---

## Remplacé / Non Retenu

Par souci de transparence sur l'évolution architecturale de la plateforme, les cibles affichées dans de précédentes versions de cette feuille de route et remplacées ou écartées par une décision d'architecture restent référencées ci-dessous :

| Cible Précédemment Affichée | Statut | Justification & Référence |
|-----------------------------|--------|---------------------------|
| **Moteur de Connexion Pingora** (pool embarqué en Rust) | **Remplacé** | Ajouté derrière la feature Cargo `pingora` dans `stoa-gateway` ([#1801](https://github.com/stoa-platform/stoa/pull/1801), [ADR-058](/docs/architecture/adr/adr-058-pingora-integration)). Remplacé comme couche proxy stratégique par Envoy upstream dans l'[ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane). |
| **Parsing HTTP & Évaluation UAC en eBPF (niveau noyau)** | **Non retenu** | Les crates prototypes (`stoa-ebpf/`) restent dans le dépôt à titre exploratoire, mais l'évaluation HTTP/politiques dans le noyau est écartée de la feuille de route au profit d'Envoy upstream + `ext_authz` ([ADR-073 §10](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)). |
| **Plugins Gateway WebAssembly (Wasm) In-Process** | **Non retenu** | Le chargement de filtres Wasm, Lua ou personnalisés dans le processus Envoy est exclu afin de découpler le cycle de mise à jour de STOA de l'ABI d'Envoy ; les traitements spécifiques s'exécutent hors processus via `ext_authz` et `ext_proc` ([ADR-073 §1 & §10](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)). |
| **Produit Sidecar Rust Distinct (runtime « STOA Link »)** | **Remplacé** | Fusionné avec `stoa-connect` en un unique agent Go installé sur site (**STOA Link**) ; le déploiement en sidecar devient une topologie d'Envoy plutôt qu'un binaire séparé ([ADR-057](/docs/architecture/adr/adr-057-product-lineup-gateway-link-connect), [ADR-073 §7](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)). |

---

## Participer

Nous construisons en public et accueillons les contributions !

- **Discord** : [Rejoindre la communauté](https://discord.gostoa.dev)
- **Issues** : [Signaler des bugs ou demander des fonctionnalités](https://github.com/stoa-platform/stoa/issues)
- **Contribuer** : [Guide de contribution](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- **Contact** : [hello@gostoa.dev](mailto:hello@gostoa.dev)

---

*Cette feuille de route est directionnelle et sujette à évolution. Pour échanger sur la feuille de route enterprise, contactez [sales@gostoa.dev](mailto:sales@gostoa.dev). Toutes les marques citées appartiennent à leurs propriétaires respectifs ([Mentions sur les marques](/docs/legal/trademarks) — All trademarks are the property of their respective owners).*
