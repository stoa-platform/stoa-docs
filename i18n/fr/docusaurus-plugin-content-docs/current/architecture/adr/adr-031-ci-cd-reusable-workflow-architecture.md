---
sidebar_position: 31
title: "ADR-031 : Architecture de Workflows CI/CD Réutilisables"
description: "Décide de l'architecture de workflows GitHub Actions réutilisables pour des pipelines CI/CD cohérents sur tous les composants de la plateforme STOA."
keywords: [CI/CD, GitHub Actions, workflows réutilisables, automatisation, pipelines]
---

# ADR-031 : Architecture de Workflows CI/CD Réutilisables

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-02-05 |
| **Auteur** | Christophe Aboulicam + Claude Code |
| **Linear** | CAB-1094 |

## Contexte

Le monorepo STOA Platform contient **17 workflows GitHub Actions** répartis sur 7 composants (Python, TypeScript, Rust). Un audit a révélé des problèmes critiques :

### Problèmes actuels

| Problème | Impact |
|---------|--------|
| 5 pipelines CI composant (~350 lignes chacun) avec ~78% de duplication | Maintenance x5, risque de dérive |
| `mcp-gateway-ci.yml` utilise `pytest ... \|\| echo` — les tests ne peuvent jamais échouer | Faux vert, régressions silencieuses |
| Incohérence couverture : `control-plane-api` applique 45% en CI vs 70% dans pyproject.toml | Portes qualité incohérentes |
| Zéro bloc `concurrency:` sur les 17 workflows | Exécutions en double à chaque push PR |
| Toutes les GitHub Actions épinglées par des tags mutables (`@v4`, `@master`) | Vecteur d'attaque supply chain |
| `aquasecurity/trivy-action@master` épinglé à la branche, pas au SHA | Risque de sécurité critique |
| `mypy` s'exécute avec `continue-on-error: true` partout | Sécurité de typage non appliquée |
| Le déploiement utilise `kubectl set image` brut sans rollback | Les déploiements cassés persistent jusqu'à correction manuelle |
| Dependabot manque 4 écosystèmes (control-plane-ui, e2e, stoa-gateway, cli) | Dépendances non surveillées |
| Les tests E2E s'exécutent en single-thread (`workers: 1`), pas de sharding | ~20 min de temps mur |
| Pas de Codecov, pas d'upload JUnit XML, pas de reporting de tests | Zéro visibilité de couverture |

### Carte de duplication

Les blocs suivants sont copiés-collés dans 5+ workflows :

- **Docker Build + Push vers ECR** (~50 lignes) : AWS OIDC, connexion ECR, QEMU, Buildx, metadata, build-push
- **Kubernetes Deploy** (~40 lignes) : Creds AWS, vérification EKS, kubeconfig, kubectl set image, rollout
- **Smoke Test** (~45 lignes) : Setup Node, installation Playwright, BDD gen, 12 secrets de persona
- **Notification Slack** (~35 lignes) : Champs de statut, logique de couleur, webhook

## Décision

Adopter une **architecture en 3 couches** pour tous les workflows CI/CD :

```
Couche 1 : Composite Actions     (.github/actions/*)
           Séquences de setup — Python, Node, Rust, Docker, E2E

Couche 2 : Reusable Workflows    (.github/workflows/reusable-*.yml)
           Pipelines de jobs complets — CI, Docker, Deploy, Smoke, Notify

Couche 3 : Orchestrateurs        (.github/workflows/<composant>-ci.yml)
           Wrappers légers — déclencheurs de chemin + appels uses: (~80 lignes chacun)
```

### 1. Composite Actions (5)

| Action | Objectif |
|--------|----------|
| `setup-python-env` | Checkout + version Python + install pip/poetry + cache |
| `setup-node-env` | Checkout + Node.js + npm ci + cache |
| `setup-rust-env` | Checkout + rust-toolchain + Swatinem/rust-cache |
| `docker-metadata` | QEMU + Buildx + connexion ECR + tags metadata |
| `e2e-setup` | Node + navigateurs Playwright + génération BDD |

### 2. Reusable Workflows (7)

| Workflow | Inputs | Objectif |
|----------|--------|----------|
| `reusable-python-ci` | component, python-version, coverage-threshold, mypy-enforce | Ruff + mypy + pytest + JUnit + couverture |
| `reusable-node-ci` | component, node-version, run-build | ESLint + vitest + build + artifact |
| `reusable-rust-ci` | component, run-audit | fmt ‖ clippy, test, cargo-audit |
| `reusable-docker-ecr` | component, ecr-repository, platforms, build-args | Build multi-arch + push ECR |
| `reusable-k8s-deploy` | component, image-tag, namespace, verify-endpoint | Déploiement + sauvegarde état rollback |
| `reusable-smoke-test` | component, test-grep | E2E @smoke avec auth persona |
| `reusable-notify` | component, ci-result, deploy-result | Notification Slack |

### 3. Durcissement de sécurité

- **Épinglage SHA** : Les 22 GitHub Actions distinctes épinglées par digest SHA immuable
- **SLSA Niveau 2** : `actions/attest-build-provenance` sur toutes les images Docker
- **CodeQL** : Analyse Python + JavaScript (hebdomadaire + PR)
- **Dependency Review** : Bloquer les PRs introduisant des vulnérabilités HIGH+
- **OpenSSF Scorecard** : Surveillance hebdomadaire
- **Rollback automatisé** : `kubectl rollout undo` sur échec du smoke test

### 4. Infrastructure de tests

- **Correction des faux verts** : Supprimer le pattern `|| echo`, appliquer les seuils réels
- **Intégration Codecov** : Upload de couverture pour Python (XML), TypeScript (Cobertura), Rust (tarpaulin)
- **Sharding E2E** : 3 shards Playwright avec rapports fusionnés
- **JUnit XML** : Tous les workflows CI produisent des résultats de tests lisibles par machine
- **dorny/test-reporter** : Annotations PR pour les échecs de tests

### 5. Contrôles de concurrence

Les 17 workflows reçoivent tous :
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```
Les exécutions PR annulent les prédécesseurs obsolètes. Les exécutions push-to-main se mettent en file d'attente (pas d'annulation pour préserver l'ordre de déploiement).

## Conséquences

### Positives

- **Point de changement unique** : Les mises à jour Docker/deploy/notify nécessitent d'éditer 1 fichier au lieu de 5-6
- **Réduction de 78% des lignes** par workflow composant (350 → 80 lignes)
- **Rollback automatisé** empêche les déploiements cassés de persister
- **Sécurité supply chain** : Actions SHA-épinglées + provenance SLSA + signature Cosign
- **Visibilité couverture** : Dashboard Codecov avec flags par composant et commentaires PR
- **E2E 50% plus rapide** : Le sharding réduit le temps mur de ~20min à ~10min
- **Pas d'exécutions en double** : Les groupes de concurrence annulent les exécutions PR obsolètes

### Négatives

- **Complexité des déclencheurs de chemin** : Les orchestrateurs doivent lister les fichiers de workflow réutilisables dans le filtre `paths:`
- **Profondeur de débogage** : Les logs de workflow réutilisables sont imbriqués, légèrement plus difficiles à naviguer
- **Passage de secrets** : L'utilisation de `secrets: inherit` passe tous les secrets (acceptable pour les workflows du même repo)

### Atténuations

- Documenter les exigences de déclencheurs de chemin dans les commentaires du workflow
- L'interface GitHub Actions gère bien la visualisation des workflows imbriqués
- Le risque de `secrets: inherit` est minimal pour un monorepo single-repository

## Références

- [GitHub Reusable Workflows](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)
- [GitHub Composite Actions](https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action)
- [OpenSSF Scorecard](https://securityscorecards.dev/)
- [SLSA Framework](https://slsa.dev/)
- ADR-024 : Architecture Gateway (4 modes)
- ADR-030 : Architecture de Gestion de Contexte Native pour l'IA
