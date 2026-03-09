---
sidebar_position: 3
title: "ADR-003 : Architecture Monorepo"
description: "Décide la structure monorepo de la plateforme STOA avec une conception multi-services polyglotte couvrant Python, TypeScript et Rust."
keywords: [monorepo, architecture, polyglotte, Python, TypeScript, Rust, microservices]
---

# ADR-003 : Architecture Monorepo — Conception multi-services polyglotte

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-06 |
| **Linear** | N/A (Fondamental) |

## Contexte

La plateforme STOA est une solution complète de gestion d'API comprenant plusieurs services : une API de plan de contrôle, plusieurs frontends, un gateway natif IA, de l'automatisation d'infrastructure et des outils. Ces composants partagent des dépendances communes, nécessitent des releases coordonnées et bénéficient de pipelines CI/CD unifiés.

La décision architecturale sur la structure du dépôt a un impact significatif sur :

- **Expérience développeur** — Quelle est la facilité de contribuer entre les composants ?
- **Complexité CI/CD** — Comment construire, tester et déployer des services interdépendants ?
- **Partage de code** — Comment partager utilitaires, types et composants ?
- **Coordination des releases** — Comment versionner et publier la plateforme ?

### Le problème

> « Chaque service doit-il avoir son propre dépôt (polyrepo) ou tout doit-il coexister dans un seul dépôt (monorepo) ? »

C'est une décision fondamentale qui affecte chaque aspect du workflow de développement.

## Options envisagées

### 1. Monorepo (dépôt unique)

Tout le code applicatif, les définitions d'infrastructure et les composants partagés dans un seul dépôt. Dépôts séparés uniquement pour la configuration runtime (GitOps) et les secrets d'infrastructure-as-code.

### 2. Polyrepo (plusieurs dépôts)

Chaque service dans son propre dépôt : `stoa-api`, `stoa-console`, `stoa-portal`, `stoa-gateway`, `stoa-cli`, etc.

### 3. Hybride (Monorepo + Satellites)

Services principaux dans un monorepo, avec des composants spécialisés (infrastructure, docs) dans des dépôts séparés.

## Résultat de la décision

**Option retenue : Monorepo hybride** — Code applicatif principal dans `stoa`, avec des dépôts dédiés pour l'infrastructure (`stoa-infra`), la documentation (`stoa-docs`), le quickstart (`stoa-quickstart`) et le CLI (`stoactl`).

### Structure des dépôts

| Dépôt | Objectif | Contenu |
|-------|----------|---------|
| **stoa** | Monorepo applicatif | Tous les services, code partagé, CI/CD |
| **stoa-infra** | IaC infrastructure | Terraform, Ansible, Helm (canonique) |
| **stoa-docs** | Documentation | Site Docusaurus, ADRs |
| **stoa-quickstart** | Quickstart auto-hébergé | Docker Compose |
| **stoactl** | Outil CLI | Go + Cobra |
| **stoa-gitops** | Config runtime | Configs tenant, apps ArgoCD |

## Structure du monorepo

```
stoa/
├── control-plane-api/       # Python 3.11 — Backend FastAPI
├── control-plane-ui/        # React 18 + TypeScript — Console UI
├── portal/                  # React 18 + TypeScript — Portail développeur
├── mcp-gateway/             # Python 3.11 — MCP Gateway (actuel)
├── stoa-gateway/            # Rust (stable) — Gateway unifié futur
├── cli/                     # Python — CLI interne
├── e2e/                     # Playwright + BDD — Tests E2E
├── landing-api/             # Python 3.12 — API de la page d'accueil
│
├── shared/                  # Composants frontend partagés
│   ├── components/          # Composants React (Toast, CommandPalette)
│   └── contexts/            # Contextes React (Theme)
│
├── charts/                  # Charts Helm (synchronisés avec stoa-infra)
│   └── stoa-platform/       # Chart principal de la plateforme
│
├── deploy/                  # Configurations de déploiement
│   ├── argocd/              # ApplicationSets ArgoCD
│   ├── demo/                # Initialisation du tenant de démo
│   ├── docker-compose/      # Développement local
│   └── platform-bootstrap/  # Configuration initiale de la plateforme
│
├── ansible/                 # Playbooks Ansible
│   └── reconcile-webmethods/ # Réconciliation gateway
│
├── scripts/                 # Scripts utilitaires
├── docs/                    # Documentation interne
├── services/                # Services de support
│   └── kafka-bridge/        # Service bridge Kafka
│
├── stoa-catalog/            # Schémas et templates UAC
├── stoa-policy-engine-rs/   # Bibliothèque d'évaluation OPA en Rust
│
├── .github/workflows/       # Workflows CI/CD
└── CLAUDE.md                # Fichier de contexte IA
```

## Matrice de la stack technologique

| Composant | Langage | Framework | Runtime |
|-----------|---------|-----------|---------|
| **control-plane-api** | Python 3.11 | FastAPI, SQLAlchemy 2.0 | Async |
| **control-plane-ui** | TypeScript | React 18, Vite, Zustand | Node 20 |
| **portal** | TypeScript | React 18, Vite | Node 20 |
| **mcp-gateway** | Python 3.11 | FastAPI, OPA | Async |
| **stoa-gateway** | Rust (stable) | Tokio, Axum | Natif |
| **cli** | Python 3.11 | Typer, Rich | Sync |
| **e2e** | TypeScript | Playwright, BDD | Node 20 |
| **landing-api** | Python 3.12 | FastAPI | Async |

## Architecture CI/CD

### Déclencheurs basés sur les chemins

Chaque composant dispose de son propre workflow CI déclenché par des modifications de chemin :

```yaml
# .github/workflows/control-plane-api-ci.yml
on:
  push:
    paths:
      - 'control-plane-api/**'
      - 'shared/**'  # Dépendances partagées
```

### Matrice des workflows

| Composant | Workflow | Déclencheurs | Actions |
|-----------|----------|--------------|---------|
| control-plane-api | `control-plane-api-ci.yml` | `control-plane-api/**` | ruff, mypy, pytest, bandit |
| control-plane-ui | `control-plane-ui-ci.yml` | `control-plane-ui/**`, `shared/**` | eslint, vitest |
| mcp-gateway | `mcp-gateway-ci.yml` | `mcp-gateway/**` | ruff, mypy, pytest |
| stoa-gateway | `stoa-gateway-ci.yml` | `stoa-gateway/**` | cargo test, clippy |
| portal | `portal-ci.yml` | `portal/**`, `shared/**` | eslint, vitest |
| e2e | `e2e-tests.yml` | Manuel, PR | Playwright BDD |

### Workflows réutilisables

```
.github/workflows/
├── reusable-python-ci.yml    # Lint, tests, couverture Python
├── reusable-node-ci.yml      # Lint, tests Node
├── reusable-rust-ci.yml      # Build, test, clippy Rust
├── reusable-docker-ecr.yml   # Build Docker, push ECR
└── reusable-k8s-deploy.yml   # Déploiement Kubernetes
```

## Stratégie de code partagé

### Composants frontend partagés

```
shared/
├── components/
│   ├── CommandPalette/       # Recherche globale
│   ├── Toast/                # Notifications
│   ├── ThemeToggle/          # Mode sombre/clair
│   ├── Breadcrumb/
│   ├── ConfirmDialog/
│   ├── EmptyState/
│   ├── FormWizard/
│   └── Skeleton/
└── contexts/
    └── ThemeContext.tsx      # Fournisseur de thème
```

`control-plane-ui` et `portal` importent depuis `shared/` :

```typescript
// portal/src/App.tsx
import { ThemeProvider } from '../../shared/contexts/ThemeContext';
import { Toast } from '../../shared/components/Toast';
```

### Patterns partagés Python

Les composants Python partagent des patterns par copie (pas par packages) en raison de contextes de déploiement différents :

- **Patterns d'authentification** : décorateurs RBAC, intégration Keycloak
- **Logging** : configuration structlog
- **Intégration OPA** : client d'évaluation de policies

## Gestion des dépendances

### Python (pyproject.toml par composant)

```toml
# control-plane-api/pyproject.toml
[project]
name = "control-plane-api"
requires-python = ">=3.11"

[tool.ruff]
line-length = 120

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

### Node (package.json par composant + racine)

```json
// package.json racine — gestion des workspaces
{
  "workspaces": ["control-plane-ui", "portal", "e2e"],
  "devDependencies": {
    "commitlint": "^19.0.0",
    "husky": "^9.0.0"
  }
}
```

### Rust (Cargo.toml par composant)

```toml
# stoa-gateway/Cargo.toml
[package]
name = "stoa-gateway"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
axum = "0.7"
```

## Règles de synchronisation inter-dépôts

| Règle | Source | Destination |
|-------|--------|-------------|
| Modifications API | `stoa/control-plane-api` | `stoa-docs/docs/api/` |
| Charts Helm | `stoa/charts/` | `stoa-infra/charts/` |
| Définitions CRD | `stoa-infra/charts/stoa-platform/crds/` | Source de vérité |
| Commandes CLI | `stoa/cli/` ou `stoactl/` | `stoa-docs/docs/reference/cli.md` |

## Conséquences

### Positives

- **Modifications atomiques** — Les changements multi-composants sont des PRs uniques avec revue unifiée
- **CI partagé** — Les workflows réutilisables réduisent la charge de maintenance
- **Visibilité des dépendances** — Les changements cassants sont détectés au moment de la PR
- **Onboarding simplifié** — Un seul clone, un seul script de configuration
- **Releases coordonnées** — Release Please gère le versionnage entre composants

### Négatives

- **Taille du dépôt** — Le clone inclut tous les composants (~500 Mo avec l'historique)
- **Complexité CI** — Les déclencheurs basés sur les chemins nécessitent une configuration soignée
- **Échecs partiels** — Un composant cassé peut bloquer la branche principale
- **Performances IDE** — Un grand monorepo peut ralentir certains IDE

### Atténuations

| Défi | Atténuation |
|------|-------------|
| Clone volumineux | Clone superficiel pour CI (`--depth=1`) |
| Complexité CI | Workflows réutilisables + propriété claire |
| Échecs partiels | Vérifications de statut requises par composant |
| Performances IDE | Configurations `.vscode/` spécifiques aux composants |

## Justification des dépôts satellites

### stoa-infra (Séparé)

- **Sécurité** — State Terraform, identifiants AWS, secrets Vault
- **Contrôle d'accès** — Restreint aux opérateurs de plateforme
- **Piste d'audit** — Historique git séparé pour la conformité

### stoa-docs (Séparé)

- **Site public** — docs.gostoa.dev servi via Vercel
- **Contributions communautaires** — Barrière réduite pour les PRs de documentation
- **Build Docusaurus** — Pipeline de build indépendant

### stoa-quickstart (Séparé)

- **Autonome** — Les utilisateurs clonent sans le monorepo complet
- **Docker Compose** — Configuration locale simple
- **Versionné** — Les tags correspondent aux releases de la plateforme

### stoactl (Séparé)

- **Binaire Go** — Chaîne de build différente
- **Release indépendante** — Le CLI peut évoluer plus vite que la plateforme
- **Distribution** — Homebrew, apt, téléchargement direct

## Validation

### Persona contributeur OSS

> *« Je veux contribuer une feature au portal. Je dois tout cloner ? »*

**Réponse :**

```bash
# Accès au dépôt accordé aux participants bêta
# Demander l'accès : christophe@hlfh.io
git clone --depth=1 <repository-url>
cd stoa/portal
npm install
npm run dev
```

L'historique complet est inutile. Le CI basé sur les chemins exécute uniquement les tests du portal.

### Persona architecte entreprise

> *« Comment vous gérez les dépendances entre control-plane-api et mcp-gateway ? »*

**Réponse :**
- Les deux sont Python 3.11 avec des patterns partagés (copie, pas de package)
- Les modifications d'API nécessitent que les deux pipelines CI passent
- Testés en intégration via la suite E2E
- Schémas partagés dans `stoa-catalog/`

## Références

- [ADR-024 — Architecture Gateway Unifiée](./adr-024-gateway-unified-modes.md)
- [ADR-031 — Workflows CI/CD Réutilisables](./adr-031-ci-cd-reusable-workflow-architecture.md)
- [CONTRIBUTING.md](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- [Monorepo vs Polyrepo — Thoughtworks](https://www.thoughtworks.com/insights/blog/monorepos)

---

*Standard Marchemalo : Un architecte vétéran de 40 ans comprend en 30 secondes*
