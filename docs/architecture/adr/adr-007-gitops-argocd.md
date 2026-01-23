# ADR-007: GitOps with Argo CD for STOA Continuous Deployment

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 15 January 2026 |
| **Linear** | [CAB-483](https://linear.app/hlfh-workspace/issue/CAB-483) |

## Context

STOA Platform requires a continuous deployment (CD) strategy suited to its cloud-native Kubernetes architecture. The current CI pipeline (GitLab CI) effectively handles build, tests, SBOM generation and image signing (Cosign).

### Identified Constraints

| Constraint | Impact |
|------------|--------|
| **Enterprise compliance** | Target clients (banking, insurance, logistics) require complete audit trail |
| **R&D tax credit eligibility** | Need for fine-grained R&D activity traceability (who/what/when) |
| **Multi-environment** | Dev → Staging → Prod with differentiated configurations |
| **Supply chain security** | SBOM, SLSA attestations, signed images |
| **Small team** | Minimize operational overhead |

## Decision

**Selected option: GitOps with Argo CD (pull-based)**

CI (GitLab) / CD (Argo CD) separation. The cluster "pulls" the desired state from a dedicated Git repo.

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| **GitLab CI end-to-end** | Push-based, CI runners with cluster access | ❌ High attack surface |
| **GitOps with Argo CD** | Pull-based, cluster pulls from Git | ✅ **Selected** |
| **GitOps with Flux CD** | Pull-based, lighter but no UI | ❌ Less visibility for demos |

### Justification

1. **STOA security alignment**: Pull-based model reinforces "security-first" messaging
2. **R&D tax credit**: Each deployment automatically generates a timestamped proof in Git
3. **MVP demos**: Argo CD UI allows visual demonstration of deployment state
4. **Ecosystem**: De facto standard in the CNCF/Kubernetes ecosystem

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GitLab CI     │     │  Container      │     │   Git Repo      │
│   (CI only)     │────▶│  Registry       │     │  stoa-envs      │
│                 │     │  (GitLab/OCI)   │     │  (desired state)│
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

### Promotion Workflow

1. **Merge to `main`** (stoa-platform) → GitLab CI build → Tagged + signed image → Registry
2. **Automatic PR** on `stoa-envs`: bump image version in `envs/dev/`
3. **Argo CD sync**: automatic dev deployment
4. **Staging promotion**: PR merge `dev` → `staging` (review required)
5. **Prod promotion**: PR merge `staging` → `prod` (approval + smoke tests)

### `stoa-envs` Repo Structure

```
stoa-envs/
├── base/                    # Common resources
│   ├── kustomization.yaml
│   ├── stoa-gateway/
│   ├── stoa-control-plane/
│   └── observability/
├── components/              # Optional components
│   ├── vault-injection/
│   ├── istio-sidecar/
│   └── debug-mode/
├── envs/                    # Per-environment overlays
│   ├── dev/
│   ├── staging/
│   └── prod/
└── argocd/                  # Argo CD configuration
    ├── projects/
    ├── applications/
    └── applicationsets/
```

## GitOps Roadmap

### Phase 1: GitOps Foundation ✅

| Deliverable | Description |
|-------------|-------------|
| Argo CD | Installation + Keycloak SSO |
| `stoa-envs` repo | Kustomize base/overlays structure |
| Applications | Dev (auto-sync), Staging (auto-sync), Prod (manual) |
| External Secrets | Vault integration |

### Phase 2: Progressive Delivery

| Deliverable | Description |
|-------------|-------------|
| **Argo Rollouts** | Canary deployments (20% → 50% → 100%) |
| **AnalysisTemplate** | Auto-rollback based on Prometheus metrics |
| **ApplicationSet** | Dynamic app generation per tenant |

### Phase 3: Enterprise Hardening

| Deliverable | Description |
|-------------|-------------|
| **Gatekeeper/OPA** | Security policies |
| **Drift Detection** | Automatic alerting |
| **KPIs Dashboard** | Grafana with GitOps metrics |

## GitOps KPIs

| KPI | Description | Target |
|-----|-------------|--------|
| **Tenant lead time** | Commit → Prod | < 15 min |
| **Successful rollback rate** | Auto rollbacks without intervention | > 95% |
| **MTTR** | Mean Time To Recovery | < 5 min |
| **Drift resolution** | Drift detection and correction | < 1 min |
| **Traceable deployments** | Git commits with author/date | 100% |

## Consequences

### Positive

- ✅ Complete and automatic audit trail (R&D tax credit value)
- ✅ Instant rollback via Git
- ✅ Automatic drift detection and correction
- ✅ Reduced attack surface (CI without prod access)
- ✅ Deployment state visualization for demos

### Negative (mitigations)

- ⚠️ **Secrets**: External Secrets Operator integrated from the start
- ⚠️ **Training**: Kustomize workflow documentation
- ⚠️ **Complexity**: Well-designed repo structure

## References

- [Argo CD Documentation](https://argo-cd.readthedocs.io/)
- [OpenGitOps Principles](https://opengitops.dev/)
- [CNCF GitOps Working Group](https://github.com/cncf/tag-app-delivery/tree/main/gitops-wg)
