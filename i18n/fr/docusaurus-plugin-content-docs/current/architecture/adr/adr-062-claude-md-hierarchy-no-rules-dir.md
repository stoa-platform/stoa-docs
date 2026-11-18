---
title: "ADR-062 — La hiérarchie CLAUDE.md remplace .claude/rules/"
sidebar_position: 62
---

# ADR-062 — La hiérarchie CLAUDE.md remplace `.claude/rules/`

- **Statut** : Accepté
- **Date** : 2026-04-15
- **Décideurs** : Christophe, Claude Code
- **Remplace** : Remplacement partiel d’ADR-030, limité au répertoire `.claude/rules/` et au champ d’en-tête `globs:`. L'ADR-062 remplace ce modèle de répertoire de règles par la hiérarchie `CLAUDE.md` et le modèle à la demande `.claude/docs/`. Les autres décisions de l'ADR-030 restent valides.

## Contexte

Le répertoire `.claude/rules/` avait atteint 31 fichiers totalisant ~3886 lignes, tous chargés automatiquement dans chaque session Claude Code via le champ d’en-tête `globs:`. Combiné au fichier `CLAUDE.md` racine (206 lignes) et au fichier global utilisateur `~/.claude/CLAUDE.md` (51 lignes), chaque session démarrait avec ~4247 lignes de contexte chargé automatiquement avant la première demande de l’utilisateur.

L’équipe avait relevé plusieurs difficultés.

- **Coût en jetons** : environ 12 000 à 15 000 jetons consommés au démarrage de la session quelle que soit la pertinence pour la tâche. Le coût était le même pour un correctif documentaire et une MEGA transversale.
- **Visibilité des règles critiques** : les règles critiques GO/NOGO (« CI red = P0 », « Council ≥ 8/10 ») étaient noyées dans les détails de protocole (machine à états complète de reprise après incident, formules détaillées de notation Arena, tableaux de méthodes des adaptateurs de passerelle).
- **Risque de dérive** : les motifs de l’en-tête restaient théoriques — en pratique, rien n'imposait quelles règles charger ni à quel moment. Claude les lisait toutes.
- **Lacune d'audit** : aucune frontière nette entre « à connaître en permanence » et « à consulter pour une tâche sur X ».

## Décision

L’ADR remplace `.claude/rules/` par un modèle à deux niveaux.

1. **Hiérarchie `CLAUDE.md`** (racine + par service) — chargée automatiquement. Contient **uniquement** des décisions binaires GO/NOGO, sous forme de consignes impératives d'une ligne. Le plafond est de 250 lignes par fichier. Il est appliqué par `claude-md-budget-lint.sh` dans la CI.
2. **`.claude/docs/<topic>.md`** — jamais chargé automatiquement. Contient les protocoles, les tableaux, les exemples et le dépannage. Chargé à la demande lorsqu'un skill ou une commande le référence, ou lorsque Claude le récupère explicitement pour une tâche pertinente.

Les fichiers `CLAUDE.md` sont répartis par service.

- `/CLAUDE.md` (règles transversales)
- `stoa-gateway/CLAUDE.md` (Rust, spécifique à la passerelle)
- `control-plane-api/CLAUDE.md` (Python, adaptateurs)
- `control-plane-ui/CLAUDE.md`, `portal/CLAUDE.md` (TS, tests)
- `charts/stoa-platform/CLAUDE.md` (K8s, Helm)
- `e2e/CLAUDE.md` (Playwright, protocole d'audit)
- `cli/CLAUDE.md` (stoactl)

Un hook de pré-commit (`.claude/hooks/block-rules-dir.sh`) bloque la recréation de `.claude/rules/`.

## Justification

- **Réduction de 94 % du contexte** au démarrage de la session (4247 → 257 lignes).
- **Contexte par service.** Une modification Rust charge les règles Rust et évite le coût des règles SEO.
- **Contrôle automatique.** La CI vérifie le plafond de 250 lignes.
- **Clarté** : « GO/NOGO → CLAUDE.md, détails → docs/ » est une règle d'une phrase que chacun peut appliquer.

## Conséquences

### Positives

- Les nouvelles sessions démarrent allégées. La délégation aux sous-agents gagne en efficacité (ils reçoivent moins de contexte inutile).
- Le fichier `CLAUDE.md` par service indique quelle équipe est responsable des consignes (l'équipe passerelle est responsable de `stoa-gateway/CLAUDE.md`).
- `.claude/docs/` reste consultable comme documentation de référence, indépendamment du chargement de session.

### Négatives

- **Risque de duplication** : les décisions figurent dans `CLAUDE.md` et leur protocole complet dans `docs/` — si les deux divergent, la documentation devient trompeuse. Atténué par deux facteurs : les décisions tiennent en une ligne (peu sujettes à la dérive) et les fichiers de docs/ servent uniquement de référence (rarement modifiés).
- **Repérage** : Claude doit savoir lire `.claude/docs/<topic>.md` lorsque c'est pertinent. Atténué par des renvois explicites depuis les sections de `CLAUDE.md` et par les références présentes dans les skills.
- **Intégration** : les contributeurs habitués à parcourir `.claude/rules/` doivent apprendre la nouvelle organisation. Atténué par la conservation du répertoire de sauvegarde pendant la transition et par cet ADR.

### Neutres

- Le nombre de fichiers CLAUDE.md par service peut croître indéfiniment — mais le plafond de 250 lignes par fichier évite qu’un fichier concentre les détails de l’ancien `rules/`.

## Application des règles

| Couche | Mécanisme |
|-------|-----------|
| Locale | `.git/hooks/pre-commit` → `.claude/hooks/block-rules-dir.sh` (bloque `.claude/rules/` dès la présence d'un fichier `.md`) |
| CI | `.github/workflows/claude-md-budget.yml` → `scripts/ai-ops/claude-md-budget-lint.sh` (échec bloquant sur tout `CLAUDE.md` > 250 lignes) |
| Coupe-circuit | Variable d'environnement `DISABLE_CLAUDE_MD_BUDGET=1` (urgence uniquement) |

## Références

- Commit de migration : `a2c47bd7` (refactor: nuke .claude/rules/ → CLAUDE.md per service + .claude/docs/)
- Sauvegarde : `.claude/rules-backup-20260415/` (supprimée après validation)
- Associé : ADR-061 (revue multi-étapes du Council) — la règle `council-s3.md` a été migrée vers `.claude/docs/` conformément à cet ADR
