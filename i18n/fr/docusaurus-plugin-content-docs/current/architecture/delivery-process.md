---
title: Processus de livraison
sidebar_label: Processus de livraison
description: "Comment STOA planifie les évolutions, vérifie la non-régression, versionne les composants et relie les releases au code et aux décisions d’architecture."
---

# Processus de livraison

Ce document décrit les preuves disponibles dans les dépôts pour la livraison de STOA, plateforme souveraine d’API et d’intégration avec un module MCP. La [décision relative au data plane Envoy](./adr/adr-073-adopt-envoy-data-plane.md), acceptée, définit la cible : le data plane utilise Envoy amont, la configuration arrive par STOA Link via xDS et le module MCP fonctionne derrière Envoy. L’ADR recense aussi des détails d’implémentation ouverts ; son acceptation ne prouve pas que tous ses éléments ont été livrés.

## Cycles de planification et parcours de livraison

Le travail est planifié par cycles, avec des éléments de périmètre défini et un suivi de leur achèvement. La capacité est évaluée à partir du travail engagé et de la vélocité observée ; l’outillage lit le cycle courant sans supposer de dates fixes. Voir le [processus de cycle][cycles] du dépôt. Un cycle de planification se distingue d’une release de composant : le [workflow de release][release] s’exécute sur les changements de `main` et crée des releases seulement lorsque Release Please en produit.

Le [processus de contribution][contributing] demande un objectif défini, des livrables et des critères d’achèvement vérifiables. Les changements passent par une branche et une pull request, les tests applicables, la mise à jour de la documentation et la revue. Le [guide de contribution](../community/contributing.md) publié décrit ce parcours. La chaîne de preuves est :

```text
Évolution délimitée → pull request → contrôles de sa révision → commit fusionné
                   → release/tag du composant → notes et comparaison du code
```

L’automatisation des releases et les changelogs des composants fournissent les dernières étapes ; la planification apporte du contexte, pas la preuve d’une livraison. [Sources : workflow de release][release], [changelog du composant][api-changelog].

## Non-régression et contrôles qualité

L’[ADR-031](./adr/adr-031-ci-cd-reusable-workflow-architecture.md) décrit l’architecture CI réutilisable : actions de préparation, workflows partagés et orchestrateurs par composant. Pour connaître les contrôles exacts, lire le workflow à la révision évaluée ; l’ADR décrit la décision, tandis que les fichiers exécutables déterminent les contrôles lancés.

| Preuve | Contrôles exécutés |
| --- | --- |
| [CI Python][python-ci] et [orchestrateur API][api-ci] | Ruff, mypy, pytest et couverture ; l’API dispose aussi de tests d’intégration utilisant PostgreSQL. |
| [CI Node][node-ci] | Lint, formatage si présent, tests (avec couverture si demandée) et build si activé par l’appelant. |
| [CI Rust][rust-ci] | Formatage, Clippy et tests ; la couverture et son seuil configuré sont contrôlés sur les pushes de main et les exécutions planifiées. Ces éléments prouvent les contrôles du composant testé, pas l’achèvement de la migration Envoy. |
| [Regression Guard][regression] | Détecte les pull requests correctives et recherche des changements de tests de régression. Le workflow prévoit des exemptions explicites, dont les corrections limitées à la documentation/configuration et un label de dérogation. |
| [CI Gate][gate] et [script d’agrégation][aggregate] | Détectent les composants modifiés, exécutent leurs workflows et agrègent les résultats. La détection et la sécurité doivent réussir ; les composants sélectionnés doivent réussir et les autres être ignorés. Un résultat absent ou incohérent provoque un échec. Le gate contrôle aussi l’épinglage des images. |

Un agrégat vert dépend donc de la détection et des workflows sélectionnés ; il ne signifie pas que tous les tests du dépôt ont été exécutés. Le typage Python peut être informatif via `mypy-enforce` ; le contrôle des clés de traduction Node est également informatif. Examiner ces paramètres et les journaux des jobs pour évaluer une régression. [Sources : CI Python][python-ci], [CI Node][node-ci], [script d’agrégation][aggregate].

Pour une revue de livraison, conserver ensemble le commit testé et ses résultats de contrôles. Distinguer les builds, tests et `ci-gate` applicables des jobs de déploiement ou de synchronisation en aval : leurs périmètres diffèrent dans les [orchestrateurs de composants][api-ci] et le [CI Gate][gate].

## Versions sémantiques et cadence des releases

Les [notes de version](../reference/changelog.md) publiées documentent des versions sémantiques indépendantes pour `control-plane-api`, `control-plane-ui`, `portal`, `stoa-gateway` et `stoa-go`. Cet ensemble n’a pas de version commune unique. La [configuration de release][release-config] sélectionne une stratégie par composant, des pull requests de release séparées et des tags préfixés par composant ; le [manifeste][manifest] conserve les versions suivies.

Les versions utilisent `MAJOR.MINOR.PATCH`, avec des tags de forme `component-vMAJOR.MINOR.PATCH`. La [politique de versionnage](../reference/changelog.md) publiée associe les incréments majeurs aux changements d’API incompatibles, les mineurs aux fonctionnalités rétrocompatibles, et les correctifs aux corrections de bugs et de sécurité. Ne pas déduire la compatibilité du seul numéro : lire les changements incompatibles et les instructions de mise à niveau des [notes de version](../reference/changelog.md). La configuration active explicitement `bump-minor-pre-major` et `bump-patch-for-minor-pre-major` ; les changements avant 1.0 doivent donc être interprétés selon ces paramètres. [Source : configuration de release][release-config].

Cette configuration associe les types de commits conventionnels à des rubriques : `feat` à Features, `fix` à Bug Fixes, `perf` à Performance et `security` à Security. Les rubriques documentation, maintenance, refactorisation, tests et CI sont masquées. Les notes constituent donc une sélection, pas un inventaire complet des commits. [Source : configuration de release][release-config].

Ces fichiers ne définissent aucune fréquence calendaire de release : [Release Please][release] réagit à `main`, tandis que les cycles délimitent le travail. La fin d’un cycle ne prouve pas à elle seule l’existence d’une nouvelle version de composant.

## Changelog publié et décisions d’architecture

Les [notes de version](../reference/changelog.md) présentent versions par composant, dates et liens de release. Le [workflow de synchronisation][changelog-sync] documentaire s’exécute sur événement de release, selon une planification quotidienne ou sur déclenchement manuel, et propose une pull request documentaire. Son [script][changelog-script] met à jour les résumés générés en anglais et en français depuis les releases GitHub. Publier une release et fusionner sa mise à jour documentaire sont deux étapes distinctes.

L’[index des ADR](./adr/README.md) donne accès aux décisions d’architecture publiées. Lire le statut, les amendements et les liens de remplacement de chaque décision : l’[ADR-073](./adr/adr-073-adopt-envoy-data-plane.md), par exemple, remplace des décisions antérieures sur le data plane et en amende d’autres. L’ADR explique le choix ; les preuves de release et de commit établissent sa disponibilité.

## Tracer les évolutions entre deux versions

La procédure de revue suivante s’appuie sur le [changelog du composant][api-changelog], la [configuration de release][release-config] et les [notes de version](../reference/changelog.md) publiées :

1. Identifier le composant et les deux tags de release. Pour une installation de la plateforme, relever séparément la version de chaque composant.
2. Ouvrir les releases correspondantes et le lien de comparaison du changelog. Le changelog API contient des comparaisons concrètes entre tags et des liens de commits.
3. Suivre commits et pull requests pour examiner le diff complet, les tests et les résultats de contrôles à la révision concernée. Inclure les types de commits masqués dans les notes.
4. Lire les ADR liés et les instructions de migration du comportement modifié ; distinguer conception acceptée, code implémenté et artefacts publiés.
5. Consigner les deux tags, le lien de comparaison, les pull requests/commits pertinents, les preuves CI et les liens ADR dans la revue. La conclusion devient reproductible sans assimiler un statut de cycle ou un ADR seul à une preuve de livraison.

## Révisions des sources

Les liens de dépôt ci-dessous sont épinglés aux révisions examinées. Pour une autre release, examiner les mêmes chemins au commit de cette release.

[cycles]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.claude/skills/fill-cycle/SKILL.md
[contributing]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/CONTRIBUTING.md
[release]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/release-please.yml
[release-config]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/release-please-config.json
[manifest]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.release-please-manifest.json
[api-changelog]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/control-plane-api/CHANGELOG.md
[python-ci]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/reusable-python-ci.yml
[api-ci]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/control-plane-api-ci.yml
[node-ci]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/reusable-node-ci.yml
[rust-ci]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/reusable-rust-ci.yml
[regression]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/regression-guard.yml
[gate]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/ci-gate.yml
[aggregate]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/scripts/ci-gate-aggregate.sh
[changelog-sync]: https://github.com/stoa-platform/stoa-docs/blob/03012e0a0e23f9660b58bd96e7da347c4325078f/.github/workflows/sync-changelog.yml
[changelog-script]: https://github.com/stoa-platform/stoa-docs/blob/03012e0a0e23f9660b58bd96e7da347c4325078f/scripts/update-changelog.sh
