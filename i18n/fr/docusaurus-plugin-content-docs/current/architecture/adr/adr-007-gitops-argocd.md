---
sidebar_position: 7
title: "ADR-007 : GitOps avec Argo CD"
description: "Décide l'adoption d'Argo CD pour le déploiement continu basé sur GitOps des composants de la plateforme STOA sur Kubernetes."
keywords: [GitOps, Argo CD, déploiement continu, Kubernetes, infrastructure as code]
---

# ADR-007 : GitOps avec Argo CD pour le déploiement continu de STOA

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 15 janvier 2026 |
| **Linear** | [CAB-483](https://linear.app/hlfh-workspace/issue/CAB-483) |

## Contexte

La plateforme STOA nécessite une stratégie de déploiement continu (CD) adaptée à son architecture cloud-native Kubernetes. Le pipeline CI actuel (GitLab CI) gère efficacement les builds, les tests, la génération de SBOM et la signature d'images (Cosign).

### Contraintes identifiées

| Contrainte | Impact |
|------------|--------|
| **Conformité enterprise** | Les clients cibles (banques, assurances, logistique) exigent une piste d'audit complète |
| **Éligibilité CIR** | Besoin d'une traçabilité fine des activités R&D (qui/quoi/quand) |
| **Multi-environnement** | Dev → Staging → Prod avec configurations différenciées |
| **Sécurité de la chaîne d'approvisionnement** | SBOM, attestations SLSA, images signées |
| **Petite équipe** | Minimiser la charge opérationnelle |

## Décision

**Option retenue : GitOps avec Argo CD (pull-based)**

Séparation CI (GitLab) / CD (Argo CD). Le cluster « tire » l'état désiré depuis un dépôt Git dédié.

### Options envisagées

| Option | Description | Verdict |
|--------|-------------|---------|
| **GitLab CI bout en bout** | Push-based, runners CI avec accès cluster | ❌ Surface d'attaque élevée |
| **GitOps avec Argo CD** | Pull-based, le cluster tire depuis Git | ✅ **Retenu** |
| **GitOps avec Flux CD** | Pull-based, plus léger mais sans interface | ❌ Visibilité insuffisante pour les démos |

### Justification

1. **Alignement sécurité STOA** : le modèle pull-based renforce le message « security-first »
2. **CIR** : chaque déploiement génère automatiquement une preuve horodatée dans Git
3. **Démos MVP** : l'interface Argo CD permet de visualiser l'état des déploiements
4. **Écosystème** : standard de facto dans l'écosystème CNCF/Kubernetes

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GitLab CI     │     │  Registre de    │     │   Dépôt Git     │
│   (CI seulement)│────▶│  Conteneurs     │     │  stoa-envs      │
│                 │     │  (GitLab/OCI)   │     │  (état désiré)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌───────────────────────────┘
                              │ pull (boucle de réconciliation)
                              ▼
                        ┌─────────────────┐
                        │    Argo CD      │
                        │  (in-cluster)   │
                        └────────┬────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
    ┌───────────┐          ┌───────────┐          ┌───────────┐
    │    Dev    │          │  Staging  │          │   Prod    │
    │  Cluster  │          │  Cluster  │          │  Cluster  │
    └───────────┘          └───────────┘          └───────────┘
```

### Workflow de promotion

1. **Merge vers `main`** (stoa-platform) → Build GitLab CI → Image taguée + signée → Registre
2. **PR automatique** sur `stoa-envs` : bump de version d'image dans `envs/dev/`
3. **Sync Argo CD** : déploiement dev automatique
4. **Promotion staging** : merge PR `dev` → `staging` (revue requise)
5. **Promotion prod** : merge PR `staging` → `prod` (approbation + tests de fumée)

### Structure du dépôt `stoa-envs`

```
stoa-envs/
├── base/                    # Ressources communes
│   ├── kustomization.yaml
│   ├── stoa-gateway/
│   ├── stoa-control-plane/
│   └── observability/
├── components/              # Composants optionnels
│   ├── vault-injection/
│   ├── istio-sidecar/
│   └── debug-mode/
├── envs/                    # Overlays par environnement
│   ├── dev/
│   ├── staging/
│   └── prod/
└── argocd/                  # Configuration Argo CD
    ├── projects/
    ├── applications/
    └── applicationsets/
```

## Feuille de route GitOps

### Phase 1 : Fondations GitOps ✅

| Livrable | Description |
|----------|-------------|
| Argo CD | Installation + SSO Keycloak |
| Dépôt `stoa-envs` | Structure Kustomize base/overlays |
| Applications | Dev (auto-sync), Staging (auto-sync), Prod (manuel) |
| External Secrets | Intégration Vault |

### Phase 2 : Livraison progressive

| Livrable | Description |
|----------|-------------|
| **Argo Rollouts** | Déploiements canary (20% → 50% → 100%) |
| **AnalysisTemplate** | Rollback automatique basé sur les métriques Prometheus |
| **ApplicationSet** | Génération dynamique d'applications par tenant |

### Phase 3 : Durcissement entreprise

| Livrable | Description |
|----------|-------------|
| **Gatekeeper/OPA** | Policies de sécurité |
| **Drift Detection** | Alertes automatiques |
| **Dashboard KPIs** | Grafana avec métriques GitOps |

## KPIs GitOps

| KPI | Description | Cible |
|-----|-------------|-------|
| **Lead time tenant** | Commit → Prod | < 15 min |
| **Taux de rollback réussi** | Rollbacks automatiques sans intervention | > 95% |
| **MTTR** | Temps moyen de récupération | < 5 min |
| **Résolution de dérive** | Détection et correction de dérive | < 1 min |
| **Déploiements traçables** | Commits Git avec auteur/date | 100% |

## Conséquences

### Positives

- ✅ Piste d'audit complète et automatique (valeur CIR)
- ✅ Rollback instantané via Git
- ✅ Détection et correction automatique de dérive
- ✅ Surface d'attaque réduite (CI sans accès prod)
- ✅ Visualisation de l'état des déploiements pour les démos

### Négatives (avec atténuations)

- ⚠️ **Secrets** : External Secrets Operator intégré dès le départ
- ⚠️ **Formation** : Documentation du workflow Kustomize
- ⚠️ **Complexité** : Structure de dépôt bien conçue

## Références

- [Documentation Argo CD](https://argo-cd.readthedocs.io/)
- [Principes OpenGitOps](https://opengitops.dev/)
- [CNCF GitOps Working Group](https://github.com/cncf/tag-app-delivery/tree/main/gitops-wg)
