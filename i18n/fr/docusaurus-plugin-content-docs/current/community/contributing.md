---
sidebar_position: 5
title: "Contribuer à STOA : Guide Développeur"
description: Comment contribuer à la Plateforme STOA — configuration du développement, standards de code, workflow PR, tests et bonnes pratiques communautaires
keywords: [contributing, development, pull request, coding standards, open source]
---

# Contribuer à STOA

Que vous corrigiez une faute de frappe ou développiez une fonctionnalité majeure, chaque contribution compte. Ce guide vous aide à démarrer.

---

## Démarrage Rapide

```bash
# 1. Forker et cloner
git clone https://github.com/YOUR_USERNAME/stoa.git
cd stoa

# 2. Choisir un composant
cd control-plane-api   # Python 3.11, FastAPI
cd portal              # React 18, TypeScript, Vite
cd control-plane-ui    # React 18, TypeScript, Vite
cd stoa-gateway        # Rust, Tokio, axum

# 3. Installer les dépendances
make setup             # ou par composant : npm install / pip install -e ".[dev]"

# 4. Lancer les tests
make test              # tous les composants
```

---

## Trouver Quelque Chose à Faire

### Bonnes Premières Issues

Nous maintenons une liste d'issues adaptées aux débutants :

- [**Toutes les good-first-issues**](https://github.com/stoa-platform/stoa/issues?q=is%3Aopen+label%3A%22good+first+issue%22) — Commencez ici
- [**Difficulté débutant**](https://github.com/stoa-platform/stoa/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3A%22difficulty%3Abeginner%22) — Aucune connaissance préalable de STOA requise
- [**Documentation**](https://github.com/stoa-platform/stoa/issues?q=is%3Aopen+label%3Adocumentation+label%3A%22good+first+issue%22) — Améliorer les guides et exemples

Chaque issue inclut :
- Une description claire de ce qu'il faut faire
- Le résultat attendu
- Les fichiers et commandes pertinents
- Le niveau de difficulté (débutant / intermédiaire / avancé)

### Autres Façons de Contribuer

| Type | Où | Impact |
|------|----|----|
| Rapports de bugs | [GitHub Issues](https://github.com/stoa-platform/stoa/issues/new) | Nous aider à trouver des problèmes |
| Documentation | [stoa-docs](https://github.com/stoa-platform/stoa-docs) | Aider les autres à apprendre |
| Traductions | Répertoires `i18n/` | Toucher plus d'utilisateurs |
| Revues de code | PRs ouvertes | Améliorer la qualité |
| Aide communautaire | Discord `#help` | Soutenir les nouveaux utilisateurs |

---

## Configuration du Développement

### Prérequis

| Outil | Version | Requis Pour |
|-------|---------|------------|
| Python | 3.11+ | API, MCP Gateway, CLI |
| Node.js | 20+ | Portal, Console UI |
| Rust | stable | STOA Gateway |
| Docker | latest | Services locaux |
| kubectl | latest | Développement K8s (optionnel) |

### Configuration par Composant

#### Control Plane API (Python)

```bash
cd control-plane-api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/ --cov=src -q
```

#### Portal ou Console UI (TypeScript)

```bash
cd portal  # ou control-plane-ui
npm install
npm run dev          # Serveur de développement
npm run test -- --run  # Tests
npm run lint         # Vérification lint
```

#### STOA Gateway (Rust)

```bash
cd stoa-gateway
cargo build
cargo test
cargo clippy --all-targets --all-features
```

---

## Workflow PR

### 1. Créer une Branche

```bash
git checkout -b feat/add-rate-limiting   # ou fix/, docs/, test/
```

Préfixes de branche : `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`

### 2. Apporter les Modifications

- Gardez les PRs ciblées — une préoccupation par PR
- Ajoutez des tests pour les nouvelles fonctionnalités
- Mettez à jour la documentation si le comportement change

### 3. Committer avec les Conventional Commits

```bash
git commit -s -m "feat(api): add rate limiting per tenant"
```

Format : `type(scope): description`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation |
| `test` | Tests |
| `refactor` | Restructuration du code |
| `chore` | Maintenance |

Le drapeau `-s` ajoute votre signature DCO (obligatoire).

### 4. Lancer les Vérifications de Qualité

```bash
# Python
ruff check . && black --check . && pytest tests/ -q

# TypeScript
npm run lint && npm run format:check && npm run test -- --run

# Rust
cargo fmt --check && cargo clippy --all-targets && cargo test
```

### 5. Soumettre votre PR

```bash
git push -u origin HEAD
```

Puis ouvrez une PR sur GitHub. Incluez :
- Ce qui a changé et pourquoi
- Comment le tester
- Lien vers l'issue associée (le cas échéant)

---

## Style de Code

| Langage | Formateur | Linter | Longueur de Ligne |
|---------|-----------|--------|-------------------|
| Python | black | ruff | 120 (API), 100 (autres) |
| TypeScript | prettier | eslint | 100 |
| Rust | cargo fmt | clippy | standard |

### En-têtes de Licence

Tous les fichiers sources nécessitent un en-tête Apache 2.0 :

```python
# Copyright 2026 STOA Platform Authors
# SPDX-License-Identifier: Apache-2.0
```

Exécutez `python scripts/add-license-headers.py --check .` pour vérifier.

---

## Tests

Chaque PR devrait inclure des tests. Nous utilisons :

| Composant | Framework | Exécution |
|-----------|-----------|-----------|
| API | pytest + pytest-asyncio | `pytest tests/ -q` |
| Portal / UI | vitest + React Testing Library | `npm run test -- --run` |
| Gateway | cargo test | `cargo test --all-features` |
| E2E | Playwright + BDD | `npx playwright test` |

---

## Obtenir de l'Aide

- **Discord** — [discord.gostoa.dev](https://discord.gostoa.dev) — posez vos questions dans `#contributors`
- **GitHub Discussions** — [stoa-platform/stoa/discussions](https://github.com/stoa-platform/stoa/discussions)
- **Email** — [contributors@gostoa.dev](mailto:contributors@gostoa.dev)

---

## Reconnaissance

Tous les contributeurs sont mentionnés dans [CONTRIBUTORS.md](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTORS.md) et dans les notes de version. Les contributions génèrent également des points dans notre [Programme de Récompenses](/docs/community/rewards).

---

*Consultez le [CONTRIBUTING.md](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md) complet sur GitHub pour des informations supplémentaires.*
