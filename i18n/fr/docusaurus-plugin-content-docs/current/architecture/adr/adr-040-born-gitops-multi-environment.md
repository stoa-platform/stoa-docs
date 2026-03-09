---
title: "ADR-040 : Born GitOps — Architecture de Promotion Multi-Environnement"
description: "Décision d'architecture pour le déploiement d'API multi-environnement GitOps-first. Git comme source unique de vérité, structure de répertoire par environnement, et promotion basée sur UAC à travers dev, staging et production."
keywords: [ADR, GitOps, multi-environnement, déploiement, Kubernetes, ArgoCD, promotion, UAC]
---

import GitOpsArchitecture from '@site/src/components/GitOpsArchitecture';

# ADR-040 : Born GitOps — Architecture de Promotion Multi-Environnement

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-02-11 |
| **Décideurs** | Christophe ABOULICAM, Platform Team |
| **Linear** | — |

### Décisions Associées

- **ADR-024** : Modes Unifiés du Gateway — 4 modes de déploiement (edge-mcp, sidecar, proxy, shadow)
- **ADR-037** : Modes de Déploiement Souveraineté d'Abord — niveaux Souverain, Hybride, SaaS
- **ADR-038** : Stratégies de Déploiement Sidecar — patterns de déploiement VM
- **ADR-031** : Architecture de Workflows CI/CD Réutilisables — pipelines GitHub Actions

## Contexte

### Le Problème

La Console STOA peut créer, configurer et supprimer des gateways et des contrats API. Aujourd'hui, cela fonctionne dans un environnement unique. En progressant vers la préparation à la production avec plusieurs environnements (dev, staging, prod), une question critique se pose :

> **Comment empêcher un utilisateur de la Console de déployer directement en production sans validation, tout en gardant Git comme source unique de vérité ?**

Ce n'est pas une préoccupation théorique — c'est le blocage n°1 pour l'adoption en entreprise. Aucun DSI n'approuvera une plateforme où un clic dans l'interface peut modifier le routage de production sans piste d'audit.

### Comment les Concurrents Gèrent Cela

<!-- last verified: 2026-02 — sources liées dans la section Références -->

| Plateforme | Modèle Multi-Env | Statut GitOps | Mécanisme de Promotion | Workflow d'Approbation |
|------------|----------------|---------------|----------------------|------------------------|
| **Kong** (Konnect) | Runtime Groups (1 par env) | decK CLI (première release 2019) ajouté à la plateforme database-backed Konnect | `deck dump` staging → éditer → `deck sync` prod | Reviews PR GitHub (pas de gate natif) |
| **Apigee** (Google) | Environment Groups + Revisions | Plugins Maven + apigeecli ajoutés à la plateforme database-backed | Même révision déployée sur tous les envs, TargetServers/KVMs spécifiques à l'env | RBAC uniquement (pas d'approbation native) |
| **Gravitee** | Cockpit + GKO (K8s Operator) | GKO v1.0 sorti en 2023 ; Cockpit est SaaS | Promotion UI via Cockpit SaaS | Intégré (Cockpit enterprise) |
| **Tyk** | tyk-sync + Tyk Operator | tyk-sync est un CLI impératif ; Tyk Operator ajouté pour K8s | Export dev → Git → Import staging/prod | Manuel (pas de gate natif) |
| **WSO2** | Workflow Engine | UI-first ; CI/CD via WSO2 apictl ajouté plus tard | Publisher soumet → Admin approuve | Moteur de workflow natif |
| **MuleSoft** | Environment Promotion | UI-first ; Anypoint CLI pour l'automatisation | Promotion du schéma API dev → staging → prod | Gouvernance enterprise |

**Observation clé** (à partir de février 2026) : Les principales plateformes de gestion d'API ont été conçues à l'origine avec des plans de contrôle database-backed. Les outils GitOps (decK, plugins Maven, tyk-sync, GKO, apictl) ont été ajoutés progressivement pour permettre des workflows déclaratifs. Aucune n'a été conçue de bout en bout avec Git comme plan de contrôle principal. STOA a l'opportunité d'être **Born GitOps** — où Git EST le plan de contrôle, pas une cible de synchronisation.

### Consensus de l'Industrie

La recherche sur Kong, Apigee, Gravitee, Tyk, ArgoCD, Flux CD et Backstage (à partir de février 2026) révèle des patterns clairs :

1. **Répertoire par environnement >> Branche par environnement** — complexité constante, pas de dérive, rollback facile
2. **Piloté par Git >> Piloté par UI** pour la production — piste d'audit, approbation via PR, rollback via `git revert`
3. **Même artifact entre les environnements** — seule la config spécifique à l'env change (URLs, replicas, rate limits)
4. **UI pour le prototypage, Git pour la gouvernance** — Kong recommande explicitement « UI pour les tests, decK pour la production »

### Position Unique de STOA

STOA n'a aucun plan de contrôle legacy database-backed à maintenir. Le Control Plane API utilise PostgreSQL pour l'état runtime, mais les contrats API (UACs), configs de gateway et politiques peuvent être entièrement représentés en YAML déclaratif. Cela signifie que STOA peut être conçu **dès le premier jour** avec Git comme source faisant autorité — une plateforme « Born GitOps ».

## Décision

### 1. Git est le Plan de Contrôle

Toute la configuration API affectant le routage, la sécurité et le comportement est stockée dans Git en YAML déclaratif. La base de données stocke l'état runtime (métriques, logs, données de session) mais pas la vérité de configuration.

<GitOpsArchitecture />

**Justification** : Kong, Apigee et Tyk recommandent tous Git comme source de vérité pour la production, mais leurs plans de contrôle restent database-backed avec Git comme mécanisme de synchronisation. STOA inverse cela : Git est primaire, la base de données met en cache ce que Git déclare.

### 2. Modes Console par Environnement

La Console fonctionne dans différents modes selon l'environnement cible :

| Environnement | Mode Console | Écriture UI | Écriture Git | Approbation Requise |
|--------------|-------------|-------------|-------------|---------------------|
| **dev** | Écriture complète | Appel API direct | Optionnel | Aucune |
| **staging** | Écriture complète | Appel API direct | Optionnel | PR optionnel |
| **prod** | Lecture + Promotion | Désactivé* | PR obligatoire | PR + CODEOWNERS |

*\*Exception : correctif d'urgence avec piste d'audit renforcée (journalisé, alerté, limité dans le temps).*

**Comment cela fonctionne en prod** :
- La Console affiche toutes les données de production (APIs, trafic, santé, consommateurs) en mode **lecture seule**
- Le bouton « Modifier » sur n'importe quelle ressource génère une **PR Git** au lieu d'appeler l'API directement
- Le bouton « Promouvoir en Prod » sur une ressource staging génère une PR avec les transformations spécifiques à l'env appliquées

**Visibilité du Workflow Console** : La Console fournit le statut en temps réel des workflows de promotion :

| État | Affichage Console | Source |
|------|------------------|--------|
| PR Créée | « Promotion en attente — en attente de review » + lien PR | Webhook API GitHub |
| PR Approuvée | « Approuvée par [reviewer] — fusion » | Webhook API GitHub |
| Fusionnée | « Fusionnée — déploiement en prod » | Webhook API GitHub |
| ArgoCD en synchronisation | « Déploiement — 10% canary » + barre de progression | Polling API ArgoCD |
| Synchronisé + Sain | « En production » + badge vert | Polling API ArgoCD |
| Rollback | « Rollback — dégradation des métriques détectée » + alerte | Webhook Argo Rollouts |

Cela permet au demandeur de suivre le cycle de vie complet sans quitter la Console.

### 3. UAC comme Unité de Promotion

Le Universal API Contract (UAC) est l'artifact immuable qui transite entre les environnements. Comme une Revision Apigee, la définition UAC est identique entre les environnements — seuls les overlays spécifiques à l'environnement changent.

```yaml
# base/apis/payments-api.yaml — IMMUABLE entre les environnements
apiVersion: gostoa.dev/v1alpha1
kind: UniversalAPIContract
metadata:
  name: payments-api
  labels:
    stoa.dev/version: "2.1.0"
spec:
  openapi: ./specs/payments-openapi.yaml
  mcp:
    tools:
      - name: create-payment
        description: Create a new payment
      - name: get-payment
        description: Retrieve payment by ID
      - name: refund
        description: Process a refund
  gateway:
    mode: edge-mcp
    authentication: oauth2
    rateLimit:
      enabled: true

---
# overlays/staging/apis/payments-api-patch.yaml
apiVersion: gostoa.dev/v1alpha1
kind: UniversalAPIContract
metadata:
  name: payments-api
spec:
  gateway:
    replicas: 2
    rateLimit:
      requestsPerMinute: 1000
    upstream:
      url: https://payments-staging.internal:8443

---
# overlays/prod/apis/payments-api-patch.yaml
apiVersion: gostoa.dev/v1alpha1
kind: UniversalAPIContract
metadata:
  name: payments-api
spec:
  gateway:
    replicas: 5
    rateLimit:
      requestsPerMinute: 10000
    upstream:
      url: https://payments.internal:8443
    canary:
      enabled: true
      initialWeight: 10
```

**Justification** : Les TargetServers + KVMs d'Apigee séparent la config spécifique à l'env de l'artifact proxy. Les overlays Kustomize réalisent le même pattern nativement dans l'écosystème Kubernetes. L'UAC devient l'unité portable — « Define Once, Expose Everywhere » s'étend à « Define Once, **Promote** Everywhere. »

### 4. Répertoire par Environnement (Pas Branche par Environnement)

Tous les environnements sont gérés dans une seule branche Git (`main`) avec des overlays basés sur les répertoires.

*L'onglet interactif **Architecture** ci-dessus montre la structure de répertoire complète avec des overlays d'environnement cliquables.*

**Pourquoi pas les branches** :
- La branche par environnement cause de la dérive (correctif en prod jamais fusionné en dev)
- La complexité évolue linéairement avec N environnements (N branches à maintenir)
- Conflits de fusion entre des branches divergentes
- Branche unique = complexité constante quel que soit le nombre d'environnements

### 5. Workflow de Promotion : « Promouvoir avec Confiance »

La Console fournit un bouton « Promouvoir en Prod » qui automatise l'ensemble du workflow de promotion tout en gardant Git comme autorité :

*Voir l'onglet interactif **Promotion** ci-dessus pour la visualisation du workflow en 4 étapes.*

**Différenciation par rapport aux concurrents** (à partir de février 2026) :
- **vs Kong** : Le CLI decK de Kong nécessite `deck dump` → édition → `deck sync` manuels. STOA automatise l'ensemble du flux via Console → PR Git.
- **vs Gravitee** : Gravitee promeut via Cockpit SaaS. STOA promeut via Git (ouvert, auditable, pas de dépendance SaaS).
- **vs Apigee** : Le déploiement UI d'Apigee est limité par RBAC mais sans workflow d'approbation natif. STOA utilise les reviews de PR Git comme mécanisme d'approbation.
- **vs WSO2** : Le moteur de workflow WSO2 est intégré au produit. STOA utilise des workflows Git-natifs (agnostique aux outils, fonctionne avec GitHub, GitLab, Bitbucket).

### 6. Détection de Dérive et Réconciliation

ArgoCD compare continuellement l'état déclaré par Git à l'état du cluster live. Tout changement manuel (`kubectl edit`, appel API direct) est détecté et signalé.

| Type de Dérive | Détection | Action |
|---------------|-----------|--------|
| `kubectl edit` manuel | ArgoCD OutOfSync | Retour automatique (auto-sync ArgoCD) |
| Appel API Console direct (dev) | Autorisé | Écrit dans Git en async (sync en arrière-plan) |
| Appel API Console direct (prod) | Bloqué par mode Console | N/A — Console génère PR à la place |
| Correctif d'urgence | Autorisé avec audit | Limité dans le temps, génère une PR rétroactive |

**Dashboard de Dérive Console** : La Console affiche un indicateur de dérive par environnement — vert (synchronisé), jaune (synchronisation en attente), rouge (dérive manuelle détectée).

### 7. Isolation Multi-Tenant par Environnement

Chaque tenant peut avoir sa propre progression d'environnement, délimitée par namespace :

*Voir l'onglet interactif **Multi-Tenant** ci-dessus pour la structure de répertoire par tenant.*

### 8. Routing d'Approbation Appartenant au Tenant

Les approbateurs de promotion sont définis **par le propriétaire du tenant**, pas par un fichier CODEOWNERS de plateforme. Cela utilise une approche hybride combinant le RBAC AppProject ArgoCD avec les métadonnées du Control Plane :

*Voir l'onglet interactif **Multi-Tenant** ci-dessus pour la visualisation du routing d'approbation en 3 couches.*

**Pourquoi appartenant au tenant, pas CODEOWNERS de plateforme** :

| Approche | Avantages | Inconvénients |
|----------|-----------|---------------|
| GitHub CODEOWNERS (par chemin) | Simple, natif GitHub | L'équipe plateforme doit éditer le fichier pour chaque changement de tenant ; pas de self-service |
| Règles d'Approbation GitLab | Sections par chemin, flexible | Nécessite migration vers GitLab |
| **Métadonnées CP API + GH Actions** (choisi) | Self-service tenant, piloté par API, UI Console | GitHub Action personnalisé nécessaire |
| ArgoCD AppProject RBAC | Défense en profondeur, K8s-natif | Au niveau sync uniquement, pas au niveau PR |

L'approche choisie (métadonnées CP API appliquées par GitHub Actions, sauvegardée par ArgoCD AppProject) fournit :
- **Self-service** : Les propriétaires de tenant gèrent leurs propres approbateurs via l'UI Console
- **Défense en profondeur** : Même si GH Actions est contourné, ArgoCD AppProject bloque les syncs non autorisés
- **Auditabilité** : Les changements d'approbateurs sont suivis dans le journal d'audit CP API

## Conséquences

### Positives

1. **Gouvernance de niveau entreprise** — chaque changement de production a un commit Git, une review PR et une piste d'approbation
2. **Prêt pour la conformité** — DORA, SOC 2, PCI-DSS nécessitent tous des pistes d'audit de gestion des changements ; Git les fournit nativement
3. **Rollback en secondes** — `git revert` + auto-sync ArgoCD vs rollback UI manuel dans les plateformes concurrentes
4. **Pas de lock-in vendeur** — Git + Kustomize + ArgoCD sont des standards ouverts ; pas d'API de promotion propriétaire
5. **Expérience développeur** — les développeurs connaissent déjà Git ; pas de nouvel outil à apprendre (vs decK, apigeecli, tyk-sync)
6. **« Define Once, Promote Everywhere »** — l'UAC est l'unité portable, les overlays gèrent la config spécifique à l'env
7. **Position unique sur le marché** — « Born GitOps » est un différenciateur défendable contre les concurrents qui ont adopté GitOps progressivement

### Négatives

1. **Latence pour les changements prod** — PR → review → fusion → sync ArgoCD = 5-15 minutes (vs clic UI instantané en dev)
   - *Atténuation* : Chemin de correctif d'urgence avec audit renforcé ; dev/staging restent instantanés
2. **Courbe d'apprentissage** — les opérateurs doivent comprendre les overlays Kustomize et les workflows Git
   - *Atténuation* : La Console génère tout le YAML automatiquement ; les utilisateurs n'écrivent jamais de YAML manuellement
3. **Complexité pour les setups simples** — les développeurs solo n'ont pas besoin de gouvernance multi-env
   - *Atténuation* : L'environnement dev reste en écriture complète ; la gouvernance ne s'active que pour staging/prod
4. **Taille du repository Git** — les déploiements importants avec de nombreuses APIs peuvent générer une config verbeuse
   - *Atténuation* : Les patches Kustomize sont petits ; les définitions de base sont partagées

### Risques

| Risque | Probabilité | Impact | Atténuation |
|--------|-------------|--------|-------------|
| Changement prod d'urgence bloqué par review PR | Moyen | Élevé | Chemin de fast-track : auto-merge avec review post-hoc + alerte d'audit |
| Décalage de réconciliation ArgoCD | Faible | Moyen | Intervalle de sync configurable (prod : 1min, dev : immédiat) |
| Conflits Git lors de promotions concurrentes | Faible | Faible | Les patches Kustomize sont délimités par API ; les conflits sont rares |
| Désynchronisation Console ↔ Git | Moyen | Moyen | Réconciliation en arrière-plan ; la Console lit depuis Git, pas DB, pour la config |

## Alternatives Considérées

### A. Plan de Contrôle Database-Backed + Sync Git (modèle Kong/Tyk)

Le Control Plane API possède la configuration dans PostgreSQL. Un mécanisme de synchronisation (comme decK) exporte périodiquement vers Git.

**Rejeté** : Cela fait de Git un miroir, pas la source de vérité. La dérive est inévitable (quelqu'un édite la DB directement). Deux sources de vérité = deux sources de bugs.

### B. Moteur de Workflow d'Approbation (modèle WSO2)

Construire un moteur de workflow d'approbation personnalisé dans la Console avec des gates basées sur les rôles.

**Rejeté** : Réinventer la roue. Les PRs Git fournissent déjà review, approbation, piste d'audit et rollback. Ajouter un moteur de workflow propriétaire ajoute de la complexité sans ajouter de valeur.

### C. Branche par Environnement

Utiliser les branches `dev`, `staging`, `prod`. Fusionner dev → staging → prod pour la promotion.

**Rejeté** : Consensus de l'industrie contre ce pattern. Dérive entre les branches, conflits de fusion, complexité évolue avec N environnements.

### D. Gouvernance UI Uniquement (modèle MuleSoft)

Toute la gouvernance se passe dans l'UI Console avec des déploiements limités par RBAC.

**Rejeté** : Pas de piste d'audit immuable. Le RBAC empêche les changements non autorisés mais ne fournit pas de reviewabilité ou de rollback. Pas aligné avec les principes GitOps.

## Plan d'Implémentation

### Phase 1 : Fondation (T1 2026)

- **P1.1** : Définir le schéma CRD UAC avec support d'overlay Kustomize
- **P1.2** : Créer la structure de repository `stoa-config/` (base + overlays pour dev/staging/prod)
- **P1.3** : ArgoCD ApplicationSet pour la réconciliation multi-environnement
- **P1.4** : Sélecteur d'environnement Console (UI à onglets, vues par env)

### Phase 2 : Modes Console (T2 2026)

- **P2.1** : Mode lecture seule Console pour la production
- **P2.2** : Le bouton « Modifier » génère une PR Git via l'API GitHub
- **P2.3** : Suivi du statut PR dans la Console (en attente, approuvé, fusionné, synchronisé)
- **P2.4** : Rapport de santé staging attaché aux PRs de promotion

### Phase 3 : Promouvoir avec Confiance (T2-T3 2026)

- **P3.1** : Bouton « Promouvoir en Prod » avec transformation spécifique à l'env
- **P3.2** : Intégration CODEOWNERS pour le routing d'approbation
- **P3.3** : Dashboard de détection de dérive dans la Console
- **P3.4** : Intégration de livraison progressive (canary Argo Rollouts)

### Phase 4 : Entreprise (T3-T4 2026)

- **P4.1** : Isolation d'environnement multi-tenant (overlays par tenant)
- **P4.2** : Politiques d'approbation configurables par tenant
- **P4.3** : Rollback automatisé sur dégradation des métriques
- **P4.4** : Export de journal d'audit pour la conformité (DORA, SOC 2)

## Références

- [Kong decK GitOps Workflow](https://konghq.com/blog/engineering/gitops-for-kong-managing-kong-declaratively-with-deck-and-github-actions)
- [Kong Runtime Groups](https://konghq.com/blog/product-releases/managing-multiple-environments-with-konnect-and-runtime-groups)
- [Apigee API Development Lifecycle](https://docs.apigee.com/api-platform/fundamentals/api-development-lifecycle)
- [Gravitee GitOps + GKO](https://www.gravitee.io/blog/gitops-for-api-management)
- [Flux CD Repository Structure](https://fluxcd.io/flux/guides/repository-structure/)
- [ArgoCD ApplicationSets](https://argo-cd.readthedocs.io/en/stable/user-guide/application-set/)
- [WSO2 Revision Deployment Workflow](https://apim.docs.wso2.com/en/4.3.0/deploy-and-publish/deploy-on-gateway/deploy-api/revision-deployment-workflow/)
- [Argo Rollouts Progressive Delivery](https://argoproj.github.io/argo-rollouts/)

> Les comparaisons de fonctionnalités sont basées sur la documentation publiquement disponible à partir de
> février 2026. Les capacités des produits changent fréquemment. Nous encourageons les lecteurs
> à vérifier les fonctionnalités actuelles directement auprès de chaque vendeur. Toutes les marques déposées
> appartiennent à leurs propriétaires respectifs.
