# ADR-007: GitOps avec Argo CD pour le déploiement continu STOA

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 15 January 2026 |
| **Linear** | [CAB-483](https://linear.app/hlfh-workspace/issue/CAB-483) |

## Context

STOA Platform nécessite une stratégie de déploiement continu (CD) adaptée à son architecture cloud-native Kubernetes. Le pipeline CI actuel (GitLab CI) gère efficacement le build, les tests, la génération SBOM et la signature des images (Cosign).

### Contraintes identifiées

| Contrainte | Impact |
|------------|--------|
| **Compliance entreprise** | Clients cibles (banque, assurance, logistique) exigent audit trail complet |
| **Éligibilité CIR** | Besoin de traçabilité fine des activités R&D (qui/quoi/quand) |
| **Multi-environnements** | Dev → Staging → Prod avec configurations différenciées |
| **Sécurité supply chain** | SBOM, SLSA attestations, images signées |
| **Équipe réduite** | Minimiser la charge opérationnelle |

## Decision

**Option retenue : GitOps avec Argo CD (pull-based)**

Séparation CI (GitLab) / CD (Argo CD). Le cluster "tire" l'état désiré depuis un repo Git dédié.

### Options considérées

| Option | Description | Verdict |
|--------|-------------|---------|
| **GitLab CI end-to-end** | Push-based, runners CI avec accès clusters | ❌ Surface d'attaque élevée |
| **GitOps avec Argo CD** | Pull-based, cluster tire depuis Git | ✅ **Retenu** |
| **GitOps avec Flux CD** | Pull-based, plus léger mais pas d'UI | ❌ Moins de visibilité démos |

### Justification

1. **Alignement sécurité STOA** : Le modèle pull-based renforce le message "security-first"
2. **CIR** : Chaque déploiement génère automatiquement une preuve horodatée dans Git
3. **Démos MVP** : L'UI Argo CD permet de montrer visuellement l'état des déploiements
4. **Écosystème** : Standard de facto dans l'écosystème CNCF/Kubernetes

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GitLab CI     │     │  Container      │     │   Git Repo      │
│   (CI only)     │────▶│  Registry       │     │  stoa-envs      │
│                 │     │  (GitLab/OCI)   │     │  (état désiré)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌───────────────────────────┘
                              │ pull (reconciliation loop)
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

1. **Merge sur `main`** (stoa-platform) → GitLab CI build → Image taggée + signée → Registry
2. **PR automatique** sur `stoa-envs` : bump version image dans `envs/dev/`
3. **Argo CD sync** : déploiement dev automatique
4. **Promotion staging** : PR merge `dev` → `staging` (review requise)
5. **Promotion prod** : PR merge `staging` → `prod` (approbation + tests smoke)

### Structure du repo `stoa-envs`

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

## Roadmap GitOps

### Phase 1 : GitOps Foundation ✅

| Livrable | Description |
|----------|-------------|
| Argo CD | Installation + SSO Keycloak |
| Repo `stoa-envs` | Structure Kustomize base/overlays |
| Applications | Dev (auto-sync), Staging (auto-sync), Prod (manuel) |
| External Secrets | Intégration Vault |

### Phase 2 : Progressive Delivery

| Livrable | Description |
|----------|-------------|
| **Argo Rollouts** | Canary deployments (20% → 50% → 100%) |
| **AnalysisTemplate** | Auto-rollback basé sur métriques Prometheus |
| **ApplicationSet** | Génération dynamique d'apps par tenant |

### Phase 3 : Enterprise Hardening

| Livrable | Description |
|----------|-------------|
| **Gatekeeper/OPA** | Policies de sécurité |
| **Drift Detection** | Alerting automatique |
| **KPIs Dashboard** | Grafana avec métriques GitOps |

## KPIs GitOps

| KPI | Description | Cible |
|-----|-------------|-------|
| **Lead time tenant** | Commit → Prod | < 15 min |
| **Taux rollback réussi** | Rollbacks auto sans intervention | > 95% |
| **MTTR** | Mean Time To Recovery | < 5 min |
| **Drift resolution** | Détection et correction drift | < 1 min |
| **Déploiements traçables** | Commits Git avec auteur/date | 100% |

## Consequences

### Positive

- ✅ Audit trail complet et automatique (valeur CIR)
- ✅ Rollback instantané via Git
- ✅ Détection et correction automatique des drifts
- ✅ Réduction surface d'attaque (CI sans accès prod)
- ✅ Visualisation état déploiements pour démos

### Negative (mitigations)

- ⚠️ **Secrets** : External Secrets Operator intégré dès le départ
- ⚠️ **Formation** : Documentation workflow Kustomize
- ⚠️ **Complexité** : Structure repo bien conçue

## References

- [Argo CD Documentation](https://argo-cd.readthedocs.io/)
- [OpenGitOps Principles](https://opengitops.dev/)
- [CNCF GitOps Working Group](https://github.com/cncf/tag-app-delivery/tree/main/gitops-wg)
