---
title: "ADR-030 : Gestion de Contexte Native pour l'IA"
description: "Décide de l'architecture de gestion de contexte pour les sessions AI Factory, incluant les fichiers mémoire, les règles et les patterns de délégation aux agents."
keywords: [AI Factory, gestion de contexte, Claude Code, mémoire, état de session, agents]
---

# ADR-030 : Architecture de Gestion de Contexte Native pour l'IA

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-02-05 |
| **Auteur** | Christophe Aboulicam + Claude Code |

## Contexte

STOA Platform est construite exclusivement avec l'IA (Claude Code) selon un modèle « AI Factory » où un architecte supervise des travailleurs IA autonomes. La gestion efficace du contexte est critique : chaque session Claude Code démarre à zéro et doit charger rapidement tout le contexte nécessaire pour produire du code correct et cohérent.

### Problèmes actuels

1. **Duplication** : Deux fichiers `CLAUDE.md` (racine et `.stoa-ai/`) contiennent des informations contradictoires. Le `.stoa-ai/CLAUDE.md` référence `backend/` (ancien nom de répertoire, désormais `control-plane-api/`) et indique un objectif de couverture à 80% (réel : 70%).
2. **Deux systèmes de mémoire** : Le `memory.md` racine est activement maintenu ; `.stoa-ai/memory.md` est figé depuis la session de configuration CAB-1068.
3. **Contexte monolithique** : Le `CLAUDE.md` racine fait 11 Ko — toutes les règles (style Python, style TypeScript, Rust, tests, sécurité, déploiement, conventions git, workflow IA) dans un seul fichier, consommant inutilement la fenêtre de contexte.
4. **Pas de contexte par composant** : 6 des 8 composants n'ont aucun `CLAUDE.md`. Lorsque Claude Code travaille dans `control-plane-api/src/routers/`, il n'a aucune guidance spécifique au composant.
5. **Fonctionnalités natives sous-utilisées** : Un seul skill Claude Code (`e2e-test`) existe. Aucun hook configuré. Aucun fichier `.claude/rules/`. Le `.stoa-ai/templates/PROMPT-ENTRY.md` définit « Mode Audit », « Mode Fix », « Mode Refactor » comme du texte copier-coller au lieu de skills natifs invocables.
6. **Permission sprawl** : `settings.local.json` contient 280 règles d'autorisation accumulées lors de sessions ad-hoc, dont des commandes ponctuelles qui ne devraient pas persister.
7. **Pas de contexte multi-repo** : Les 5 repos (stoa, stoa-docs, stoa-web, stoa-quickstart, stoactl) n'ont aucun contexte partagé. Travailler dans stoa-docs ne donne à Claude Code aucune connaissance de l'architecture du monorepo stoa.
8. **Conflit de numérotation ADR** : L'ADR-027 dans `stoa/docs/architecture/adr/` (« Gateway Adapter Pattern ») entre en conflit avec l'ADR-027 dans stoa-docs (« X.509 Header Authentication »).

### Références sectorielles

| Source | Pratique |
|--------|----------|
| Anthropic Claude Code Best Practices | `CLAUDE.md` hiérarchique, `.claude/rules/` pour les instructions modulaires, skills natifs, hooks |
| GitLab Handbook-First | Source unique de vérité, tout documenté dans le repo |
| Stripe RFC Process | Documents de conception (ADRs) avant l'implémentation, décisions tracées |
| Vercel/Turborepo | Contexte par package dans les monorepos |
| AWS AI-DLC | Workflows adaptatifs pour le cycle de vie de développement piloté par l'IA |

## Décision

### 1. CLAUDE.md hiérarchique avec règles modulaires

**`CLAUDE.md` racine** (~3 Ko) sert de point d'entrée compact : vue d'ensemble du projet, carte des composants, URLs clés, workflow de session, et `@import` pour le contexte du sprint en cours. Toutes les règles détaillées sont extraites dans des fichiers `.claude/rules/` que Claude Code charge automatiquement selon les patterns de chemin.

**8 fichiers de règles** dans `.claude/rules/` :

| Fichier | Portée | Contenu |
|---------|--------|---------|
| `code-style-python.md` | `**/*.py` | ruff, black, isort, mypy, longueur de ligne |
| `code-style-typescript.md` | `**/*.{ts,tsx}` | eslint, prettier, alias de chemin |
| `code-style-rust.md` | `stoa-gateway/**` | cargo fmt, clippy |
| `testing.md` | `**/tests/**` | Standards pytest, vitest, playwright |
| `security.md` | `terraform/**, charts/**, deploy/**` | Protection infrastructure, secrets |
| `git-conventions.md` | tous | Format de commit, nommage des branches, template PR |
| `deployment.md` | `charts/**, deploy/**` | Helm, sécurité Terraform, Docker multi-arch |
| `ai-workflow.md` | tous | Règles de session, processus de review, anti-dérive |

### 2. CLAUDE.md au niveau composant (chargement paresseux)

Chacun des 8 composants reçoit un `CLAUDE.md` (~1-2 Ko) chargé uniquement lorsque Claude Code lit des fichiers dans ce répertoire. Contient : vue d'ensemble, stack technique, commandes clés, structure des répertoires, patterns utilisés, et relations de dépendances.

Composants : `control-plane-api/`, `control-plane-ui/`, `portal/`, `mcp-gateway/`, `stoa-gateway/`, `cli/`, `e2e/`, `charts/stoa-platform/`.

### 3. Skills natifs remplaçant les workflows basés sur des templates

Conversion des modes de `.stoa-ai/templates/PROMPT-ENTRY.md` en 7 skills Claude Code natifs invocables via la commande `/` :

| Skill | Remplace | Objectif |
|-------|----------|----------|
| `/fix-bug` | « Mode Fix Rapide » | Reproduire, corriger, vérifier, commiter |
| `/implement-feature` | Prompt standard | Planifier, coder, tester, commiter |
| `/audit-component` | « Mode Audit » | Analyse en lecture seule |
| `/refactor` | « Mode Refactor » | Refactoring sûr avec garde-fou de test |
| `/create-adr` | (nouveau) | Création d'ADR depuis le template |
| `/review-pr` | (nouveau) | Checklist de review PR |
| `/update-memory` | (nouveau) | Mise à jour de memory.md avec l'état actuel |

### 4. Hooks pour l'automatisation et les garde-fous

Configurer `.claude/settings.json` (commité) avec :
- **Hook PreToolUse** sur Edit/Write : Bloquer les modifications des chemins d'infrastructure protégés (terraform/environments/prod, .github/workflows)

### 5. memory.md unique avec format structuré

Un seul `memory.md` à la racine (suppression de `.stoa-ai/memory.md`). Structuré avec des tableaux pour l'état de session, une section décisions et les problèmes connus. Les éléments de plus de 2 semaines sont archivés dans `docs/archive/`.

### 6. Contexte multi-repo via ~/.claude/CLAUDE.md

Un `~/.claude/CLAUDE.md` au niveau utilisateur fournit un contexte partagé à tous les repos STOA : tableau des repos, règles inter-repos (les changements d'API nécessitent une mise à jour de la documentation, le quickstart doit correspondre aux valeurs Helm par défaut), et standards partagés.

### 7. Suppression de .stoa-ai/ entièrement

L'infrastructure AI Factory (`.stoa-ai/`) est antérieure aux skills, hooks et règles natifs de Claude Code. Tout le contenu utile est migré :
- Les templates deviennent des skills dans `.claude/skills/`
- Le workflow de session devient une règle dans `.claude/rules/ai-workflow.md`
- Les scripts (`slack-notify.sh`, `daily-digest.sh`) sont déplacés vers `scripts/ai-ops/`
- Les plans de phase sont archivés dans `docs/archive/phases/`

### 8. Modèle de permissions simplifié

Réduire `settings.local.json` de 280 règles à ~30 en utilisant des patterns glob (`Bash(cargo:*)` au lieu de sous-commandes cargo individuelles).

## Conséquences

### Positives

- **Pas de duplication** — source unique de vérité pour chaque type de contexte
- **Chargement de contexte plus rapide** — 3 Ko racine + fichiers composants paresseux vs. monolithe 11 Ko
- **Intégration native** — les skills, hooks et règles fonctionnent avec les fonctionnalités intégrées de Claude Code
- **Conscience multi-repo** — l'IA connaît les 5 repos quelle que soit la repo où elle travaille
- **Scalable** — ajouter un nouveau composant = ajouter un fichier CLAUDE.md
- **Traçable** — décisions journalisées, patterns documentés, ADRs indexés
- **Maintenable** — les règles modulaires sont plus faciles à mettre à jour qu'un seul grand fichier

### Négatives

- **Plus de fichiers** — ~35 nouveaux fichiers dans le repo (règles, skills, docs composants)
- **Effort de migration** — coût unique pour restructurer le contexte existant
- **Courbe d'apprentissage** — l'équipe doit comprendre le modèle de chargement hiérarchique

### Atténuations

- Tous les nouveaux fichiers sont petits (1-2 Ko chacun) et focalisés sur une seule préoccupation
- La migration est automatisée en une seule session
- La hiérarchie est documentée dans cet ADR et dans le CLAUDE.md racine lui-même

## Références

- [Anthropic Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [AWS AI-DLC](https://aws.amazon.com/blogs/devops/open-sourcing-adaptive-workflows-for-ai-driven-development-life-cycle-ai-dlc/)
- [GitLab Handbook-First](https://about.gitlab.com/company/culture/all-remote/handbook-first-documentation/)
- ADR-024 : Modes Unifiés du Gateway (référencé pour le contexte d'architecture des composants)
