---
title: Garde-fous de la livraison assistée par IA
sidebar_label: Garde-fous de la livraison assistée par IA
description: "Outils, contrôles et garde-fous appliqués aux contributions assistées par IA à STOA, tels qu’ils sont vérifiables dans les dépôts publics."
---

# Garde-fous de la livraison assistée par IA

Cette page recense les contrôles qui s’appliquent aux contributions à STOA lorsqu’un assistant IA écrit ou relit une partie du changement. Elle ne décrit que ce qui peut être lu dans les dépôts publics `stoa` et `stoa-docs` : règles de contribution, hooks git, workflows GitHub Actions, décisions d’architecture publiées. Chaque affirmation cite le fichier dont elle provient ; les liens sont épinglés aux révisions examinées dans la section [révisions des sources](#révisions-des-sources).

Un changement assisté par IA suit le même parcours que tout autre changement : branche, pull request, contrôles sur la révision de la pull request, revue par un mainteneur, squash merge, release. La page [processus de livraison](./delivery-process.md) décrit ce parcours et les workflows CI par composant. Cette page se concentre sur les contrôles eux-mêmes et sur ce qu’ils prouvent ou non.

## Règles de lecture

- Une décision d’architecture explique pourquoi un contrôle existe. Le fichier de workflow à une révision donnée définit ce qui s’exécute. Le journal d’une exécution montre ce qui s’est exécuté. Garder les trois distincts pour évaluer un changement.
- La protection de branche, la liste des contrôles requis et les variables de dépôt sont des paramètres du dépôt, pas des fichiers. Les fichiers de workflow documentent les valeurs attendues ; les paramètres eux-mêmes doivent être vérifiés sur le dépôt.
- Plusieurs contrôles sont consultatifs ou en avertissement seul à la révision examinée. Ils sont signalés comme tels ci-dessous. Une exécution verte ne prouve pas qu’un contrôle consultatif a réussi.

## Règles applicables à chaque commit

| Règle | Où elle est définie | Comment elle est appliquée |
| --- | --- | --- |
| Sign-off Developer Certificate of Origin | [CONTRIBUTING.md][contributing] (section DCO), [CLA.md][cla], texte [DCO][dco] | Exigé par les règles de contribution pour chaque commit (`git commit -s`). La même exigence figure dans les [règles de contribution][docs-contributing] du dépôt de documentation. |
| Messages de commit conventionnels | [CONTRIBUTING.md][contributing], [commitlint.config.js][commitlint] | Validés localement par le [hook commit-msg][husky-commit-msg]. Les types autorisés sont listés dans la configuration ; les scopes relèvent d’une règle de niveau avertissement. |
| Lint des fichiers indexés | [hook pre-commit][husky-pre-commit] | Exécute `lint-staged` avant chaque commit. |
| Anglais pour tout ce qui est commité ou publié | [CONTRIBUTING.md][contributing] (section Language) | S’applique aux titres de pull request, messages de commit, commentaires, documentation et notes de version. |
| Commits signés | [required-checks.yml][required-checks], [check-signed-commits.py][signed-commits-script] | Les commits humains datés à partir de la date de référence fixée dans le script doivent porter une signature vérifiée ; les commits de bots et de comptes de service sont exemptés. Le job s’exécute avec `continue-on-error` : il est en avertissement seul à cette révision. |
| Revue par un mainteneur | [CODEOWNERS][codeowners], [GOVERNANCE.md][governance] | Chaque chemin exige une revue de l’équipe des mainteneurs ; les chemins des workflows, de l’authentification, de la sécurité, des charts, du déploiement et de la documentation sont listés explicitement. La gouvernance exige une approbation de mainteneur et une CI verte avant fusion, et une décision d’architecture pour les changements d’architecture. |
| Liste de contrôle de pull request | [PULL_REQUEST_TEMPLATE.md][pr-template] | Déclare le type de changement, les ruptures de compatibilité, la façon dont il a été testé, et une liste qualité (tests passés, aucun nouvel avertissement de lint, aucun secret, format des commits). |
| Signalement de vulnérabilité | [SECURITY.md][security-policy] | Canal de signalement privé, processus d’accusé de réception et de divulgation, clause de safe harbor. Ce n’est pas un contrôle de pull request, mais la référence pour toute découverte de sécurité remontée par un relecteur, humain ou automatisé. |

## Contrôles automatisés sur chaque pull request

| Contrôle | Workflow | Ce qu’il fait | Bloquant à cette révision |
| --- | --- | --- | --- |
| CI Gate | [ci-gate.yml][ci-gate], [script d’agrégation][ci-gate-aggregate] | Détecte les composants modifiés, appelle leurs workflows CI et le workflow de sécurité, agrège les résultats, impose l’épinglage des images de conteneurs. Voir le [processus de livraison](./delivery-process.md#non-régression-et-contrôles-qualité) pour les contrôles par composant. | Oui pour les composants sélectionnés ; les composants non sélectionnés doivent être ignorés. |
| Image Pinning Guard | [required-checks.yml][required-checks], [check_image_pinning.py][image-pinning] | Exige des images de conteneurs épinglées dans les fichiers modifiés. | Oui. |
| License Compliance | [required-checks.yml][required-checks], [check_licences_offline.py][licences-script] | Contrôle hors ligne des licences de l’arbre de dépendances, avec un rapport en artefact. Le mode vient de la variable de dépôt `LICENSES_MODE` ; la valeur par défaut `warn` ne fait jamais échouer le job. | Seulement si la variable vaut `deny` ou `enforce`. |
| SBOM Generation | [required-checks.yml][required-checks] | Produit des nomenclatures logicielles CycloneDX et SPDX avec Trivy et les publie en artefacts. | Oui (le job doit aboutir). |
| Regression Test Guard | [regression-guard.yml][regression-guard] | Détecte les pull requests correctives et exige un test de régression ajouté ou modifié. Les corrections limitées à la documentation et à la configuration sont exemptées ; le label `skip-regression` est une dérogation explicite. | Oui, avec les exemptions documentées. |
| Security Scan | [security-scan.yml][security-scan] | Appelé par le CI Gate sur les pull requests, ainsi que sur les pushes vers `main` et quotidiennement : SAST pour Rust (Clippy), Python (Bandit, sévérité et confiance moyennes) et JavaScript (plugin ESLint security, deux règles en erreur ; l’étape de rapport à zéro avertissement est non bloquante) ; audits de dépendances (`cargo audit`, `pip-audit`, `npm audit`) ; recherche de secrets avec Gitleaks sur l’intervalle de commits de la pull request selon [.gitleaks.toml][gitleaks-config] ; scan OpSec avec [opsec-scan.sh][opsec-scan] pour les adresses d’infrastructure, données financières, références clients, mots de passe par défaut et motifs de clés ; scan de conteneurs Trivy signalant les findings critiques et élevés. | Les scans SAST, secrets et OpSec font échouer le job. Le job de scan de conteneurs et plusieurs étapes d’audit de dépendances portent `continue-on-error` avec une raison suivie dans le fichier. |
| Dependency Review | [dependency-review.yml][dependency-review] | Échoue sur les nouvelles dépendances présentant des vulnérabilités de sévérité élevée et refuse les licences GPL-3.0, AGPL-3.0 et SSPL-1.0. | Oui. |
| Garde des chemins purgés | [purged-paths-guard.yml][purged-paths], [purged-paths-guard.sh][purged-paths-script] | Échoue si un chemin retiré de l’historique réapparaît dans l’arbre ou dans l’intervalle de commits. Les chemins ne sont stockés que sous forme d’empreintes SHA-256. | Oui. |
| AI Context Lint | [ai-context-lint.yml][ai-context-lint], [ai_context_lint.py][ai-context-lint-script] | Sur les changements de `CLAUDE.md`, `AGENTS.md`, `README.md` ou `.claude/`, bloque les marqueurs obsolètes (composants retirés, chemins inexistants, versions de stack dépassées) qu’une édition pilotée par LLM pourrait réintroduire. | Oui, sur les chemins listés. |
| OpenSSF Scorecard | [scorecard.yml][scorecard] | S’exécute sur les pushes vers `main` et selon une planification ; les résultats vont dans l’onglet sécurité du dépôt. | Pas un contrôle de pull request. |
| Mises à jour de dépendances | [dependabot.yml][dependabot] | Mises à jour mineures et correctives hebdomadaires groupées avec le préfixe `chore(deps)` ; les mises à jour majeures sont ignorées pour les écosystèmes configurés. | Pas un contrôle ; produit des pull requests qui passent par les contrôles ci-dessus. |

L’en-tête de [required-checks.yml][required-checks] consigne les jobs que la protection de branche considérait comme requis au moment de la rédaction de ce fichier. Confirmer la liste dans les paramètres du dépôt avant de s’y fier.

## Contrôles propres aux changements assistés par IA

### Revue IA consultative des pull requests

L’[ADR-065](/docs/architecture/adr/adr-065-pr-guardian) établit une revue automatisée consultative, le STOA PR Guardian. Le [workflow][pr-guardian], le [skill][pr-guardian-skill] et le [pack de règles][pr-guardian-policy] la définissent :

- S’exécute à l’ouverture d’une pull request, à son passage en « prête pour revue » ou à sa mise à jour. Ignorée pour les brouillons, les auteurs bots, les pull requests issues de forks, les labels `skip-guardian` et `wip`, et lorsque la variable de dépôt `DISABLE_PR_GUARDIAN` est positionnée.
- Les diffs de plus de 1000 lignes ne sont pas relus ; le workflow publie un avis indiquant qu’une revue humaine est requise.
- Trois axes : conformité aux décisions d’architecture, régression de sécurité, odeur de code IA. Le verdict est binaire (GO ou NO-GO) avec un niveau de confiance. Tout signalement de sécurité fait passer le verdict à NO-GO.
- Règles dures du skill : ne jamais approuver, ne jamais demander de changements via l’API de revue, commenter seulement, commentaires en anglais, commentaire de synthèse commençant par un marqueur fixe pour pouvoir être remplacé de façon idempotente.
- L’agent s’exécute avec un jeu d’outils restreint (lecture, glob, grep, shell), une limite de tours et un modèle épinglé dans le workflow. L’exécution est en `continue-on-error` : un échec est signalé par un commentaire, non masqué, et ne bloque pas la pull request.

Le Guardian ne remplace pas la revue par un mainteneur. Il n’approuve jamais, et la règle [CODEOWNERS][codeowners] continue de s’appliquer.

### Revue multi-étapes et revue de code de l’étape 3

L’[ADR-061](/docs/architecture/adr/adr-061-council-multi-stage-review) décrit une revue en trois étapes : pertinence du ticket, validation du plan, puis revue de code avant fusion. La revue de code de l’étape 3 est implémentée par [council-gate.yml][council-gate] et [council-review.sh][council-script] :

- Quatre axes évalués indépendamment sur le diff (conformité, dette, surface d’attaque, impact sur les contrats), agrégés en un score ; le script approuve à 8,0 ou plus et renvoie un code de sortie « rework » en dessous.
- Le job du workflow est en `continue-on-error`, documenté dans le fichier comme mode « shadow » : les résultats sont publiés en commentaire de pull request et ne bloquent pas la fusion.
- Ignoré pour les comptes bots Dependabot, Claude et GitHub Actions et pour les pull requests issues de forks ; désactivé par la variable de dépôt `COUNCIL_S3_ENABLED` ; une clé d’API absente transforme le job en no-op.
- Le script exécute un pré-contrôle Gitleaks et refuse d’envoyer un diff contenant un secret détecté.

### Implémentation pilotée par IA à partir d’issues

[claude-issue-to-pr.yml][issue-to-pr] permet à un membre du dépôt de confier une issue à un agent IA qui ouvre une pull request. Les contrôles présents dans le fichier sont :

- Des étapes enchaînées par des commandes humaines explicites : revue de pertinence du ticket, puis un commentaire `/go`, puis validation du plan, puis un commentaire `/go-plan`, puis implémentation. Les commentaires `/go` et `/go-plan` ne sont honorés que depuis des utilisateurs dont l’association est propriétaire, membre ou collaborateur. Les issues étiquetées `ship-fast-path` par l’étape 1 (changements en mode ship estimés à cinq points ou moins) sautent la validation du plan, et le workflow publie lui-même le commentaire `/go-plan`, comme consigné dans l’[ADR-061](/docs/architecture/adr/adr-061-council-multi-stage-review).
- Une variable de dépôt `DISABLE_L1_IMPLEMENT` désactive les déclencheurs sur événements réels ; le déclenchement manuel exécute exactement une étape pour des rejeux contrôlés.
- Chaque étape a une limite de tours et un délai maximal de job.
- La pull request résultante passe par les contrôles de pull request listés plus haut. Noter que le Guardian et la revue de l’étape 3 ignorent les pull requests dont l’auteur est un bot ; ces axes reviennent donc à la revue par un mainteneur pour ces pull requests.

### Contrat de contexte IA

L’[ADR-062](/docs/architecture/adr/adr-062-claude-md-hierarchy-no-rules-dir), qui remplace en partie l’[ADR-030](./adr/adr-030-ai-context-management.md), définit les fichiers d’instructions qu’une session IA charge : un [CLAUDE.md][claude-md] racine plus des fichiers par composant, limités à des règles binaires, les protocoles détaillés étant tenus dans des documents chargés à la demande. Les règles liées à la livraison dans le fichier racine à la révision examinée incluent :

- Une CI rouge sur `main` est la priorité absolue ; rien ne fusionne et rien ne démarre tant qu’elle n’est pas verte.
- Le gate qualité pre-push est obligatoire ; `--no-verify` est interdit hors urgence explicite.
- Les pull requests de plus de 300 lignes modifiées doivent être découpées.
- Un `fix` sans test de régression est bloqué ; les tests sont écrits avant le code pour les fonctionnalités et les corrections ; le plancher de couverture de l’API est de 70 pour cent et ne baisse jamais.
- Les fusions sont des squash merges avec suppression de branche ; aucun push direct sur `main` ; les force push, resets durs et suppressions de branches tierces exigent de demander d’abord.
- Les secrets ne sont jamais codés en dur ; les manifestes Kubernetes de secrets utilisent un marqueur de substitution ; les fichiers `.env*`, `*.pem`, `*.key`, `*.tfvars` et `*credentials*` ne sont jamais commités.
- Les identifiants ne sont jamais réinitialisés, modifiés ou renouvelés par l’assistant ; les opérations d’infrastructure destructives exigent une confirmation explicite.

[AI Context Lint][ai-context-lint] protège ces fichiers contre les contenus obsolètes, comme indiqué dans la section précédente.

### Hooks de session et sous-agents restreints

[.claude/settings.json][claude-settings] branche des hooks shell qui s’exécutent dans une session IA avant ou après les appels d’outils. À la révision examinée, les hooks pré-outil incluent :

- [pre-edit-protect-infra.sh][hook-protect-infra] : bloque les éditions de chemins d’infrastructure protégés sans confirmation explicite.
- [pre-edit-no-k8s-secrets.sh][hook-no-secrets] : bloque l’écriture de valeurs ressemblant à de vrais identifiants dans les manifestes Kubernetes Secret ou la configuration Docker.
- [pre-push-quality-gate.sh][hook-pre-push] : avant un `git push`, détecte les composants modifiés et exécute leurs contrôles, dont le scan OpSec ; les interrupteurs de désactivation sont documentés en tête du fichier.

Les définitions de sous-agents dans [.claude/agents/][claude-agents] déclarent les outils autorisés et interdits : par exemple le [relecteur sécurité][agent-security] ne peut ni écrire ni éditer de fichiers, et le [rédacteur de documentation][agent-docs] n’a pas d’accès shell.

Ces hooks ne s’exécutent que dans une session IA locale utilisant cette configuration. Ils constituent une première ligne de défense pour l’opérateur, pas un contrôle côté serveur ; les workflows de pull request restent la couche appliquée.

### Changements d’interface utilisateur écrits par IA

L’[ADR-060](/docs/architecture/adr/adr-060-ai-verified-ui-testing) décide une validation en quatre couches pour les changements d’interface produits par des agents IA : données de test préchargées, assertions sur l’arbre d’accessibilité, références de régression visuelle et gate d’accessibilité. Les workflows correspondants sont [e2e-a11y-gate.yml][e2e-a11y] et [e2e-visual-regression.yml][e2e-visual] ; lire leurs déclencheurs à la révision évaluée, car ils ne font pas partie de l’agrégation du CI Gate.

## Contrôles du dépôt de documentation

Les changements de ce site de documentation passent par leurs propres contrôles dans le dépôt `stoa-docs` :

- [ADR Lint][adr-lint] avec [adr_lint.py][adr-lint-script] : numéros d’ADR uniques, en-tête cohérent avec le nom de fichier, et un ensemble de règles de cohérence bloquantes ; les lignes de statut ou de date manquantes sont des avertissements.
- [Docs Audit][docs-audit] : un audit des noms de clients sur la documentation et un scan de conformité du contenu des articles de blog pour les affirmations comparatives ou réglementaires non sourcées, sur les pull requests et les pushes vers `main`.
- [docusaurus.config.ts][docusaurus-config] : les liens cassés, ancres cassées et liens markdown cassés font échouer le build.
- Les mêmes règles de sign-off DCO et de commits conventionnels que le dépôt principal, énoncées dans le [CONTRIBUTING.md][docs-contributing] de la documentation.

## Limites des preuves

- Les contrôles consultatifs (Guardian, revue de l’étape 3) n’approuvent jamais et ne bloquent jamais. L’approbation par un mainteneur selon [CODEOWNERS][codeowners] et [GOVERNANCE.md][governance] est l’étape d’approbation.
- Contrôles en avertissement seul à cette révision : vérification des commits signés, conformité des licences en mode par défaut, plusieurs étapes d’audit de dépendances. Lire le résumé du job, pas seulement son statut.
- Les variables de dépôt nommées dans les workflows (`DISABLE_PR_GUARDIAN`, `COUNCIL_S3_ENABLED`, `DISABLE_L1_IMPLEMENT`, `LICENSES_MODE`) changent le comportement sans changement de code. Leurs valeurs ne sont pas visibles dans le dépôt.
- Rien sur cette page n’est une certification ni une attestation. C’est une carte de l’endroit où chaque contrôle est défini, pour qu’un relecteur puisse le vérifier pour un commit donné.

## Vérifier un changement donné

1. Relever la pull request, son commit de tête et le commit fusionné.
2. Ouvrir les fichiers de workflow à ce commit et lister les jobs qu’ils définissent pour un événement de pull request.
3. Comparer cette liste avec les contrôles rapportés sur la pull request ; noter tout job marqué `continue-on-error` ou ignoré par un label ou une variable.
4. Pour les changements assistés par IA, chercher le commentaire de synthèse du Guardian et le commentaire de l’étape 3, et lire le statut de sign-off et de signature de chaque commit.
5. Conserver ensemble le commit, les liens d’exécution et l’approbation du mainteneur dans le dossier de revue.

## Révisions des sources

Les liens sont épinglés aux révisions examinées. Pour une autre révision, examiner les mêmes chemins à ce commit.

[contributing]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/CONTRIBUTING.md
[cla]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/CLA.md
[dco]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/DCO
[commitlint]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/commitlint.config.js
[husky-commit-msg]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.husky/commit-msg
[husky-pre-commit]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.husky/pre-commit
[codeowners]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/CODEOWNERS
[governance]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/GOVERNANCE.md
[pr-template]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/PULL_REQUEST_TEMPLATE.md
[security-policy]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/SECURITY.md
[required-checks]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/required-checks.yml
[signed-commits-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/scripts/check-signed-commits.py
[ci-gate]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/ci-gate.yml
[ci-gate-aggregate]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/scripts/ci-gate-aggregate.sh
[image-pinning]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/ci/check_image_pinning.py
[licences-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/ci/check_licences_offline.py
[regression-guard]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/regression-guard.yml
[security-scan]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/security-scan.yml
[gitleaks-config]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.gitleaks.toml
[opsec-scan]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/opsec-scan.sh
[dependency-review]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/dependency-review.yml
[purged-paths]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/purged-paths-guard.yml
[purged-paths-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/ci/purged-paths-guard.sh
[ai-context-lint]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/ai-context-lint.yml
[ai-context-lint-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/ai_context_lint.py
[scorecard]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/scorecard.yml
[dependabot]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/dependabot.yml
[pr-guardian]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/pr-guardian.yml
[pr-guardian-skill]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/skills/pr-guardian/SKILL.md
[pr-guardian-policy]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/docs/ai/pr-guardian-policy.md
[council-gate]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/council-gate.yml
[council-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/council-review.sh
[issue-to-pr]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/claude-issue-to-pr.yml
[claude-md]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/CLAUDE.md
[claude-settings]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/settings.json
[hook-protect-infra]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/hooks/pre-edit-protect-infra.sh
[hook-no-secrets]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/hooks/pre-edit-no-k8s-secrets.sh
[hook-pre-push]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/hooks/pre-push-quality-gate.sh
[claude-agents]: https://github.com/stoa-platform/stoa/tree/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/agents
[agent-security]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/agents/security-reviewer.md
[agent-docs]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/agents/docs-writer.md
[e2e-a11y]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/e2e-a11y-gate.yml
[e2e-visual]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/e2e-visual-regression.yml
[docs-contributing]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/CONTRIBUTING.md
[adr-lint]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/.github/workflows/adr-lint.yml
[adr-lint-script]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/scripts/adr_lint.py
[docs-audit]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/.github/workflows/docs-audit.yml
[docusaurus-config]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/docusaurus.config.ts
