---
title: "Architecture Decision Records"
description: "Index de tous les Architecture Decision Records (ADRs) pour la Plateforme STOA, documentant les choix techniques et architecturaux clés."
keywords: [ADR, architecture decisions, STOA platform, technical decisions]
---

# Architecture Decision Records (ADRs)

> **"Chaque outil à sa fonction"** — Pas de solution universelle

Ce répertoire contient les décisions architecturales importantes pour la Plateforme STOA.

---

## 📚 Index des ADRs

### 🏛️ Architecture Fondamentale

| # | Titre | Statut |
|:---:|-------|:------:|
| [003](./adr-003-monorepo-architecture.md) | Architecture Monorepo — Polyglotte Multi-Services | ✅ |
| [004](./adr-004-gateway-adapter-pattern.md) | Patron Adaptateur de Gateway — Orchestration Multi-Gateway | ✅ |
| [005](./adr-005-event-driven-kafka.md) | Architecture Event-Driven — Conception des Topics Kafka | ✅ |
| [006](./adr-006-tool-registry-architecture.md) | Architecture du Registre d'Outils — Conception en 7 Modules | ✅ |

### ⚡ Performance & Fiabilité

| # | Titre | Statut |
|:---:|-------|:------:|
| [008](./adr-008-semantic-caching.md) | Cache Sémantique des Réponses — Stratégie pgvector | ✅ |
| [009](./adr-009-error-snapshots.md) | Instantanés d'Erreurs — Débogage Voyage dans le Temps | ✅ |

### 🏗️ Plateforme & Infrastructure

| # | Titre | Statut |
|:---:|-------|:------:|
| [001](./adr-001-api-exposure-strategy.md) | Stratégie d'Exposition API Tierces — Façade API Publique | ✅ |
| [002](./adr-002-stoactl-cli.md) | Conception du CLI stoactl | 📋 |
| [007](./adr-007-gitops-argocd.md) | GitOps avec Argo CD | ✅ |
| [025](./adr-025-gateway-resilience-zombie.md) | Résilience du Gateway — Patron Anti-Nœud Zombie | 📋 |
| [026](./adr-026-multi-iam-federation.md) | Patron de Fédération Multi-IAM — Zéro Stockage Utilisateur | ✅ |

### 🔐 Sécurité & Conformité

| # | Titre | Statut |
|:---:|-------|:------:|
| [011](./adr-011-api-security-modes.md) | Sélection du Mode de Sécurité API — mTLS / OAuth2 / Hybride | ✅ |
| [018](./adr-018-security-hardening-p0.md) | Durcissement Sécurité P0 — Pentest Team Coca | ✅ |

### 🤖 MCP & Gateway IA

| # | Titre | Statut |
|:---:|-------|:------:|
| [012](./adr-012-mcp-rbac-architecture.md) | Architecture des Outils MCP — RBAC & Gouvernance Multi-Tenant | ✅ |
| [020](./adr-020-runtime-data-governance.md) | Gouvernance des Données en Temps Réel | ✅ |
| [021](./adr-021-uac-driven-observability.md) | Observabilité Pilotée par l'UAC | 📋 |
| [022](./adr-022-uac-tenant-architecture.md) | Architecture Tenant de l'UAC | ✅ |
| [023](./adr-023-zero-blind-spot-observability.md) | Observabilité Sans Angle Mort | ✅ |
| [024](./adr-024-gateway-unified-modes.md) | Architecture Gateway Unifiée — 4 Modes de Déploiement | ✅ |

### 💼 Modèle d'Affaires & Stratégie

| # | Titre | Statut |
|:---:|-------|:------:|
| [019](./adr-019-business-model-moat-strategy.md) | Modèle d'Affaires & Stratégie de Différenciation | ✅ |
| [041](./adr-041-plugin-architecture-community-enterprise.md) | Architecture de Plugins — Cœur Communautaire vs Extensions Entreprise | ✅ |

### 🛠️ Expérience Développeur & Workflow IA

| # | Titre | Statut |
|:---:|-------|:------:|
| [030](./adr-030-ai-context-management.md) | Architecture de Gestion de Contexte AI-Native | ✅ |
| [031](./adr-031-ci-cd-reusable-workflow-architecture.md) | Architecture de Workflows CI/CD Réutilisables | ✅ |
| [032](./adr-032-response-transformation.md) | Transformation des Réponses — Adaptateurs Pluggables | ✅ |

### 🎨 Frontend & UX

| # | Titre | Statut |
|:---:|-------|:------:|
| [033](./adr-033-shared-ui-components.md) | Composants UI Partagés — Abstraction de Thème | ✅ |

### 🦀 Évolution

| # | Titre | Statut |
|:---:|-------|:------:|
| [034](./adr-034-python-rust-migration.md) | Stratégie de Migration Python vers Rust | ✅ |

### 🌐 Gateway & Déploiement

| # | Titre | Statut |
|:---:|-------|:------:|
| [035](./adr-035-gateway-adapter-pattern.md) | Patron Adaptateur de Gateway — Orchestration Multi-Gateway | ✅ |
| [036](./adr-036-gateway-auto-registration.md) | Auto-Enregistrement du Gateway — Intégration Zéro Configuration | ✅ |
| [037](./adr-037-deployment-modes-sovereign-first.md) | Modes de Déploiement — Stratégie Souveraineté en Premier | ✅ |

---

## 🔮 ADRs Planifiés

| # | Titre | Priorité |
|:---:|-------|:--------:|
| 010 | Décision Blockchain — Euro Numérique 2027+ | 🔵 |
| 013 | Patterns Idempotence & Saga — Exactly-Once pour le B2B | 🟡 |
| 014 | Garde-fous de Livraison — Canary & Gel SLO Automatique | 🟡 |
| 015 | Tokens à Contrainte d'Expéditeur — Liaison mTLS, DPoP & DCR | 🟡 |
| 016 | Ingénierie des Versions — Workflow Git & Versionnement | 🟢 |
| 017 | Kafka/Redpanda Interne Uniquement — Zéro Exposition Externe | 🟡 |

**Légende :** ✅ Accepté · 📋 Brouillon · 🟢 Haute · 🟡 Moyenne · 🔵 Basse

## Aperçu des Choix Technologiques

| Catégorie | Choix STOA | Alternatives | Justification |
|----------|-------------|--------------|-----------|
| **Messagerie** | Kafka (Redpanda) | RabbitMQ, NATS | Event sourcing, replay, montée en charge |
| **Base de données** | PostgreSQL | MySQL, MongoDB | ACID, JSON, extensions |
| **Auth** | Keycloak | Auth0, Okta | Auto-hébergé, OIDC complet |
| **Observabilité** | Prometheus + Grafana + Loki | Datadog, ELK | Open source, natif K8s |
| **GitOps** | ArgoCD | Flux, Jenkins | UI, multi-cluster |
| **Automatisation** | ArgoCD + Adaptateurs Gateway | Terraform | Idempotent, auditable |
| **Gateway v1** | webMethods | Kong, APISIX | Expertise legacy |
| **Gateway v2** | Rust + eBPF | Go, C++ | Performance, sécurité |
| **Recherche** | OpenSearch | Elasticsearch | Apache 2.0, sans AWS |

## Principes Directeurs

| Principe | Application |
|-----------|-------------|
| **Open Source d'abord** | Éviter le lock-in, contribuer en amont |
| **Natif K8s** | Opérateurs, CRDs, GitOps |
| **Le bon outil pour le bon usage** | Kafka pour les événements, PostgreSQL pour l'ACID |
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
