---
title: "Architecture Decision Records"
sidebar_position: 0
description: "Index de tous les Architecture Decision Records (ADRs) pour la Plateforme STOA, documentant les choix techniques et architecturaux clés."
keywords: [ADR, architecture decisions, STOA platform, technical decisions]
---

# Architecture Decision Records (ADRs)

> **"Chaque outil à sa fonction"** — Pas de solution universelle

Ce répertoire contient les décisions architecturales structurantes de la Plateforme STOA. Les ADR non encore traduits en français sont signalés par *(EN)* et renvoient vers la version anglaise de référence.

---

## Index des ADRs

### Architecture Fondamentale

| # | Titre | Statut |
|:---:|-------|:------:|
| [003](./adr-003-monorepo-architecture.md) | Architecture Monorepo — Polyglotte Multi-Services (Amendé par ADR-073) | ✅ |
| [004](./adr-004-gateway-adapter-pattern.md) | Patron Adaptateur de Gateway — Orchestration Multi-Gateway | ✅ |
| [005](./adr-005-event-driven-kafka.md) | Architecture Event-Driven — Conception des Topics Kafka | ✅ |
| [006](./adr-006-tool-registry-architecture.md) | Architecture du Registre d'Outils — Conception en 7 Modules | ✅ |
| [035](./adr-035-gateway-adapter-pattern.md) | Patron Adaptateur de Gateway — Orchestration Multi-Gateway | ✅ |
| [045](./adr-045-stoa-yaml-declarative-spec.md) | Spécification Déclarative d'API `stoa.yaml` | ✅ |

### Plateforme & Infrastructure

| # | Titre | Statut |
|:---:|-------|:------:|
| [001](./adr-001-api-exposure-strategy.md) | Stratégie d'Exposition API Tierces — Façade API Publique | ✅ |
| [002](./adr-002-stoactl-cli.md) | Conception du CLI stoactl | 📋 |
| [007](./adr-007-gitops-argocd.md) | GitOps avec Argo CD | ✅ |
| [025](./adr-025-gateway-resilience-zombie.md) | Résilience du Gateway — Patron Anti-Nœud Zombie | 📋 |
| [031](./adr-031-ci-cd-reusable-workflow-architecture.md) | Architecture de Workflows CI/CD Réutilisables | ✅ |
| [040](./adr-040-born-gitops-multi-environment.md) | Born GitOps — Promotion Multi-Environnement | ✅ |
| [043](./adr-043-kafka-mcp-event-bridge.md) | Pont d'Événements Kafka → MCP | 📋 |
| [059](./adr-059-simplified-deployment-sse.md) | Architecture de Déploiement Simplifiée — Chemin Unique via SSE | ✅ |
| [064](/docs/architecture/adr/adr-064-controller-framework) | Framework de Contrôleurs — Maintien des Workers Python, Report de Kopf et Go (Amendé par ADR-073) *(EN)* | ✅ |

### Sécurité & Conformité

| # | Titre | Statut |
|:---:|-------|:------:|
| [011](./adr-011-api-security-modes.md) | Sélection du Mode de Sécurité API — mTLS / OAuth2 / Hybride | ✅ |
| [015](./adr-015-token-optimization-architecture.md) | Architecture d'Optimisation des Jetons | 📋 |
| [018](./adr-018-security-hardening-p0.md) | Durcissement Sécurité P0 — Pentest Team Coca | ✅ |
| [026](./adr-026-multi-iam-federation.md) | Patron de Fédération Multi-IAM — Zéro Stockage Utilisateur (Remplacé par ADR-074) | 🔄 |
| [027](./adr-027-x509-header-authentication.md) | Authentification par En-tête X.509 | ✅ |
| [028](./adr-028-rfc8705-certificate-binding.md) | Liaison de Certificat RFC 8705 | ✅ |
| [029](./adr-029-mtls-certificate-lifecycle.md) | Cycle de Vie des Certificats mTLS | ✅ |
| [039](./adr-039-mtls-cert-bound-tokens.md) | Jetons Liés au Certificat mTLS sur la Passerelle Rust | ✅ |
| [044](./adr-044-mcp-oauth-gateway-proxy.md) | Architecture Proxy Gateway OAuth 2.1 pour MCP | ✅ |
| [054](./adr-054-rbac-taxonomy-v2.md) | Taxonomie RBAC v2 — Rôles Persona & Libellés | ✅ |
| [056](./adr-056-fapi-2-architecture.md) | Architecture de Sécurité FAPI 2.0 | ✅ |
| [074](./adr-074-tenant-model.md) | Modèle de Tenant — Un Realm, Groupes de Tenant, Claim `tenant_id` | ✅ |
| [075](./adr-075-secrets-backend-openbao.md) | Socle de Secrets — OpenBao via l'API Vault | ✅ |

### MCP & Gateway IA

| # | Titre | Statut |
|:---:|-------|:------:|
| [012](./adr-012-mcp-rbac-architecture.md) | Architecture des Outils MCP — RBAC & Gouvernance Multi-Tenant | ✅ |
| [020](./adr-020-runtime-data-governance.md) | Gouvernance des Données en Temps Réel | ✅ |
| [021](./adr-021-uac-driven-observability.md) | Observabilité Pilotée par l'UAC | 📋 |
| [022](./adr-022-uac-tenant-architecture.md) | Architecture Tenant de l'UAC | ✅ |
| [023](./adr-023-zero-blind-spot-observability.md) | Observabilité Sans Angle Mort | ✅ |
| [024](./adr-024-gateway-unified-modes.md) | Architecture Gateway Unifiée — 4 Modes de Déploiement | ✅ |
| [046](./adr-046-mcp-federation-architecture.md) | Architecture de Fédération MCP | 📋 |
| [047](./adr-047-mcp-skills-system.md) | Système de Skills MCP — Injection de Contexte | 📋 |
| [048](./adr-048-integrated-chat-agent.md) | Architecture d'Agent Conversationnel Intégré | 📋 |
| [051](./adr-051-lazy-mcp-discovery.md) | Découverte MCP Paresseuse (Cache-First) | ✅ |
| [066](/docs/architecture/adr/adr-066-stoa-token-compression) | Compression de Jetons STOA (STC) — Compression Sans Perte pour Agents LLM *(EN)* | ✅ |
| [067](/docs/architecture/adr/adr-067-uac-as-llm-optimized-executable-contract) | UAC comme Contrat Exécutable Optimisé pour LLM *(EN)* | 📋 |

### Performance & Observabilité

| # | Titre | Statut |
|:---:|-------|:------:|
| [008](./adr-008-semantic-caching.md) | Cache Sémantique des Réponses — Stratégie pgvector | ✅ |
| [009](./adr-009-error-snapshots.md) | Instantanés d'Erreurs — Débogage Voyage dans le Temps | ✅ |
| [049](./adr-049-enterprise-ai-native-benchmark.md) | Benchmark Passerelle Entreprise AI-Native | ✅ |
| [050](./adr-050-guardrails-token-budget-state.md) | Guardrails V2 — Gestion d'État des Budgets de Jetons | ✅ |
| [052](./adr-052-benchmark-opensearch-persistence.md) | Persistance OpenSearch des Benchmarks & Routage LLM | ✅ |
| [053](./adr-053-llm-cost-aware-routing.md) | Routage LLM Sensible aux Coûts | ✅ |
| [068](/docs/architecture/adr/adr-068-audit-log-actor-resource-views) | Vues Acteur et Ressource du Journal d'Audit *(EN)* | ✅ |

### Gateway & Déploiement

| # | Titre | Statut |
|:---:|-------|:------:|
| [034](./adr-034-python-rust-migration.md) | Stratégie de Migration Python vers Rust (Remplacé par ADR-073) | 🔄 |
| [036](./adr-036-gateway-auto-registration.md) | Auto-Enregistrement du Gateway — Intégration Zéro Configuration | ✅ |
| [037](./adr-037-deployment-modes-sovereign-first.md) | Modes de Déploiement — Stratégie Souveraineté en Premier | ✅ |
| [038](./adr-038-sidecar-deployment-strategies-vm.md) | Déploiement Sidecar sur Infrastructure VM | 📋 |
| [057](./adr-057-product-lineup-gateway-link-connect.md) | Gamme Produit — STOA Gateway, STOA Link, STOA Connect (Amendé par ADR-073) | ✅ |
| [058](./adr-058-pingora-integration.md) | Intégration Pingora — Pool de Connexions Embarqué (Remplacé par ADR-073) | 🔄 |
| [070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture) | Posture Fail-Closed de la Passerelle *(EN)* | ✅ |
| [073](./adr-073-adopt-envoy-data-plane.md) | Adopter Envoy comme Plan de Données STOA | ✅ |

### Frontend & UX

| # | Titre | Statut |
|:---:|-------|:------:|
| [032](./adr-032-response-transformation.md) | Transformation des Réponses — Adaptateurs Pluggables | ✅ |
| [033](./adr-033-shared-ui-components.md) | Composants UI Partagés — Abstraction de Thème | ✅ |
| [055](./adr-055-portal-console-governance.md) | Gouvernance Portail/Console — Séparation Claire des Responsabilités | ✅ |
| [060](/docs/architecture/adr/adr-060-ai-verified-ui-testing) | Framework de Tests UI Vérifiés par IA — Validation en 4 Couches *(EN)* | ✅ |

### Modèle d'Affaires & Stratégie

| # | Titre | Statut |
|:---:|-------|:------:|
| [019](./adr-019-business-model-moat-strategy.md) | Modèle d'Affaires & Stratégie de Différenciation | ✅ |
| [041](./adr-041-plugin-architecture-community-enterprise.md) | Architecture de Plugins — Cœur Communautaire vs Extensions Entreprise | ✅ |

### Expérience Développeur & Workflow IA

| # | Titre | Statut |
|:---:|-------|:------:|
| [030](./adr-030-ai-context-management.md) | Architecture de Gestion de Contexte AI-Native (Partiellement remplacé par ADR-062) | ✅ |
| [061](/docs/architecture/adr/adr-061-council-multi-stage-review) | Système de Revue Multi-Étapes Council *(EN)* | ✅ |
| [062](/docs/architecture/adr/adr-062-claude-md-hierarchy-no-rules-dir) | Hiérarchie `CLAUDE.md` en Remplacement de `.claude/rules/` *(EN)* | ✅ |
| [063](/docs/architecture/adr/adr-063-sdd-l1-impact-mcp) | SDD Niveau 1 + Agent de Connaissance MCP `stoa-impact` *(EN)* | ✅ |
| [065](/docs/architecture/adr/adr-065-pr-guardian) | STOA PR Guardian — Revue IA Consultative sur GitHub Actions *(EN)* | ✅ |

---

## ADRs Planifiés

| # | Titre | Priorité |
|:---:|-------|:--------:|
| 010 | Décision Blockchain — Euro Numérique 2027+ | Basse |
| 013 | Patterns Idempotence & Saga — Exactly-Once pour le B2B | Moyenne |
| 014 | Garde-fous de Livraison — Canary & Gel SLO Automatique | Moyenne |
| 016 | Ingénierie des Versions — Workflow Git & Versionnement | Haute |
| 017 | Kafka/Redpanda Interne Uniquement — Zéro Exposition Externe | Moyenne |

**Légende :** ✅ Accepté · 📋 Brouillon/Proposé · 🔄 Remplacé

## Aperçu des Choix Technologiques

| Catégorie | Choix STOA | Alternatives | Justification |
|-----------|------------|--------------|---------------|
| **Messagerie** | Redpanda (API Kafka) | RabbitMQ, NATS | Event sourcing, replay, usage strictement interne |
| **Base de données** | PostgreSQL | MySQL, MongoDB | ACID, JSONB, schéma partagé + `tenant_id` ([ADR-074](./adr-074-tenant-model.md)) |
| **Auth** | Keycloak (realm `stoa`) | Auth0, Okta | Auto-hébergé, realm unique + groupes par tenant ([ADR-074](./adr-074-tenant-model.md)) |
| **Observabilité** | Prometheus + Grafana + OpenSearch + Tempo | Datadog, ELK | Open source, natif K8s, OTLP |
| **GitOps** | ArgoCD | Flux, Jenkins | UI, multi-cluster ([ADR-007](./adr-007-gitops-argocd.md)) |
| **Agent sur site & xDS** | STOA Link (`stoa-connect`, Go) | Push sur mesure | SSE sortant, adaptateurs passerelles & ADS mTLS loopback ([ADR-057](./adr-057-product-lineup-gateway-link-connect.md), [ADR-059](./adr-059-simplified-deployment-sse.md)) |
| **Plan de données (cible)** | Envoy upstream + services externes STOA | Proxy Rust/Pingora maison | Proxy L4/L7 éprouvé + services `ext_authz` / MCP ([ADR-073](./adr-073-adopt-envoy-data-plane.md)) |
| **Plan de données (actuel)** | STOA Gateway (Rust/Tokio/axum) | Prototype Python | Production / Maintenance + `ExtAuthzService` gRPC ([ADR-073](./adr-073-adopt-envoy-data-plane.md)) |
| **Recherche** | OpenSearch | Elasticsearch | Apache 2.0, sans AWS |
| **Secrets** | OpenBao (API Vault) | HashiCorp Vault, Infisical | MPL 2.0, audit inclus, API Vault conservée ([ADR-075](./adr-075-secrets-backend-openbao.md)) |

## Principes Directeurs

| Principe | Application |
|----------|-------------|
| **Open Source d'abord** | Éviter le lock-in, contribuer en amont |
| **Natif K8s** | Opérateurs, CRDs, GitOps |
| **Le bon outil pour le bon usage** | Envoy pour le proxy L4/L7, Rust pour authz/MCP, PostgreSQL pour l'ACID |
| **Auto-hébergement possible** | Aucune dépendance SaaS obligatoire |
| **Licence permissive** | Apache 2.0, MIT — éviter GPL, SSPL |
| **Cloud-agnostique** | Aucun service managé obligatoire |

## Template ADR

Utilisez le template ci-dessous pour créer de nouveaux ADRs.

```markdown
# ADR-XXX: [Titre]

## Métadonnées
| Champ | Valeur |
|-------|-------|
| **Statut** | 📋 Brouillon / ✅ Accepté / ❌ Rejeté / 🔄 Remplacé |
| **Date** | YYYY-MM-DD |
| **Linear** | [CAB-XXX](lien) |

## Contexte
[Pourquoi cette décision est-elle nécessaire ?]

## Décision
[Qu'a-t-on décidé ?]

## Conséquences
### Positives
### Négatives
### Atténuations

## Références
```
