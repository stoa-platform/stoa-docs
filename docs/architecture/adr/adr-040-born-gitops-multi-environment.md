---
title: "ADR-040: Born GitOps — Multi-Environment Promotion Architecture"
description: "Architecture decision for GitOps-first multi-environment API deployment. Git as the single source of truth, directory-per-environment layout, and UAC-based promotion through dev, staging, and production."
keywords: [ADR, GitOps, multi-environment, deployment, Kubernetes, ArgoCD, promotion, UAC]
---

# ADR-040: Born GitOps — Multi-Environment Promotion Architecture

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-02-11 |
| **Decision Makers** | Christophe ABOULICAM, Platform Team |
| **Linear** | — |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — 4 deployment modes (edge-mcp, sidecar, proxy, shadow)
- **ADR-037**: Deployment Modes Sovereign-First — Sovereign, Hybrid, SaaS tiers
- **ADR-038**: Sidecar Deployment Strategies — VM deployment patterns
- **ADR-031**: CI/CD Reusable Workflow Architecture — GitHub Actions pipelines

## Context

### The Problem

STOA's Console can create, configure, and delete gateways and API contracts. Today, this works in a single environment. As we move toward production readiness with multiple environments (dev, staging, prod), a critical question arises:

> **How do we prevent a Console user from deploying directly to production without validation, while keeping Git as the single source of truth?**

This is not a theoretical concern — it is the #1 blocker for enterprise adoption. No DSI will approve a platform where a UI click can modify production routing without an approval trail.

### How Competitors Handle This

<!-- last verified: 2026-02 — sources linked in References section -->

| Platform | Multi-Env Model | GitOps Status | Promotion Mechanism | Approval Workflow |
|----------|----------------|---------------|--------------------|--------------------|
| **Kong** (Konnect) | Runtime Groups (1 per env) | decK CLI (first released 2019, [GitHub](https://github.com/Kong/deck)) added to database-backed Konnect | `deck dump` staging → edit → `deck sync` prod | GitHub PR reviews (no native gate) |
| **Apigee** (Google) | Environment Groups + Revisions | Maven plugins ([apigee-deploy-maven-plugin](https://github.com/apigee/apigee-deploy-maven-plugin), 2015) + apigeecli added to database-backed platform | Same revision deployed across envs, env-specific TargetServers/KVMs | RBAC only (no native approval) |
| **Gravitee** | Cockpit + GKO (K8s Operator) | GKO [v1.0 released 2023](https://www.gravitee.io/blog/gitops-for-api-management); Cockpit is SaaS-based | UI promotion via Cockpit SaaS | Built-in (Cockpit enterprise) |
| **Tyk** | tyk-sync + Tyk Operator | tyk-sync ([docs](https://docs.tyk.technology/api-management/automations/sync)) is imperative CLI; Tyk Operator added for K8s | Export dev → Git → Import staging/prod | Manual (no native gate) |
| **WSO2** | Workflow Engine | UI-first; CI/CD via [WSO2 apictl](https://apim.docs.wso2.com/en/4.3.0/) added later | Publisher submits → Admin approves | Native workflow engine |
| **MuleSoft** | Environment Promotion | UI-first; [Anypoint CLI](https://docs.mulesoft.com/anypoint-cli/latest/) for automation | API schema promotion dev → staging → prod | Enterprise governance |

**Key observation** (as of February 2026): The major API management platforms were originally designed with database-backed control planes. GitOps tooling (decK, Maven plugins, tyk-sync, GKO, apictl) was added incrementally to enable declarative workflows. None were designed from the ground up with Git as the primary control plane. STOA has the opportunity to be **Born GitOps** — where Git IS the control plane, not a sync target.

### Industry Consensus

Research across Kong, Apigee, Gravitee, Tyk, ArgoCD, Flux CD, and Backstage (as of February 2026) reveals clear patterns:

1. **Directory-per-environment >> Branch-per-environment** — constant complexity, no drift, easy rollback
2. **Git-driven >> UI-driven** for production — audit trail, approval via PR, rollback via `git revert`
3. **Same artifact across environments** — only env-specific config changes (URLs, replicas, rate limits)
4. **UI for prototyping, Git for governance** — Kong explicitly recommends "UI for testing, decK for production"

### STOA's Unique Position

STOA has no legacy database-backed control plane to maintain. The Control Plane API uses PostgreSQL for runtime state, but API contracts (UACs), gateway configs, and policies can be fully represented as declarative YAML. This means STOA can be designed **from day one** with Git as the authoritative source — a "Born GitOps" platform.

## Decision

### 1. Git Is the Control Plane

All API configuration that affects routing, security, and behavior is stored in Git as declarative YAML. The database stores runtime state (metrics, logs, session data) but not configuration truth.

```
┌──────────────────────────────────────────────────────────┐
│                     Git Repository                        │
│          (Source of Truth — all config here)               │
│                                                           │
│  stoa-config/                                             │
│  ├── base/                 # Shared across all envs       │
│  │   ├── apis/             # UAC definitions              │
│  │   ├── gateways/         # Gateway configurations       │
│  │   ├── policies/         # Security policies, RBAC      │
│  │   └── consumers/        # Consumer registrations       │
│  ├── overlays/                                            │
│  │   ├── dev/              # Dev patches                  │
│  │   ├── staging/          # Staging patches              │
│  │   └── prod/             # Prod patches                 │
│  └── kustomization.yaml                                   │
└──────────────────────────────────────────────────────────┘
         │                    │                    │
    ArgoCD sync          ArgoCD sync          ArgoCD sync
         │                    │                    │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │   Dev   │         │ Staging │         │  Prod   │
    │ Cluster │         │ Cluster │         │ Cluster │
    └─────────┘         └─────────┘         └─────────┘
```

**Rationale**: Kong, Apigee, and Tyk all recommend Git as the source of truth for production, but their control planes remain database-backed with Git as a sync mechanism. STOA inverts this: Git is primary, the database caches what Git declares.

### 2. Console Modes per Environment

The Console operates in different modes depending on the target environment:

| Environment | Console Mode | UI Write | Git Write | Approval Required |
|------------|-------------|----------|-----------|-------------------|
| **dev** | Full write | Direct API call | Optional | None |
| **staging** | Full write | Direct API call | Optional | PR optional |
| **prod** | Read + Promote | Disabled* | PR mandatory | PR + CODEOWNERS |

*\*Exception: emergency hotfix with enhanced audit trail (logged, alerted, time-limited).*

**How it works in prod**:
- The Console displays all production data (APIs, traffic, health, consumers) in **read-only** mode
- The "Edit" button on any resource generates a **Git PR** instead of calling the API directly
- The "Promote to Prod" button on a staging resource generates a PR with env-specific transformations applied

**Console Workflow Visibility**: The Console provides real-time status of promotion workflows:

| State | Console Display | Source |
|-------|----------------|--------|
| PR Created | "Promotion pending — awaiting review" + PR link | GitHub API webhook |
| PR Approved | "Approved by [reviewer] — merging" | GitHub API webhook |
| Merged | "Merged — deploying to prod" | GitHub API webhook |
| ArgoCD Syncing | "Deploying — 10% canary" + progress bar | ArgoCD API polling |
| Synced + Healthy | "Live in production" + green badge | ArgoCD API polling |
| Rollback | "Rolled back — metric degradation detected" + alert | Argo Rollouts webhook |

This enables the requester to track the full lifecycle without leaving the Console.

**Rationale**: Apigee enterprises disable direct UI deployment to production and force CI/CD pipelines. WSO2 adds approval workflows. STOA combines both: the Console IS the approval workflow UI, but it writes to Git, not the database.

### 3. UAC as the Unit of Promotion

The Universal API Contract (UAC) is the immutable artifact that travels between environments. Like an Apigee Revision, the UAC definition is identical across environments — only environment-specific overlays change.

```yaml
# base/apis/payments-api.yaml — IMMUTABLE across environments
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

**Rationale**: Apigee's TargetServers + KVMs separate env-specific config from the proxy artifact. Kustomize overlays achieve the same pattern natively in the Kubernetes ecosystem. The UAC becomes the portable unit — "Define Once, Expose Everywhere" extends to "Define Once, **Promote** Everywhere."

### 4. Directory-per-Environment (Not Branch-per-Environment)

All environments are managed in a single Git branch (`main`) with directory-based overlays.

```
stoa-config/
├── base/                        # Shared definitions
│   ├── apis/
│   │   ├── payments-api.yaml
│   │   └── inventory-api.yaml
│   ├── gateways/
│   │   └── edge-gateway.yaml
│   └── policies/
│       ├── rate-limit.yaml
│       └── cors.yaml
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml   # replicas: 1, debug: true
│   │   └── patches/
│   ├── staging/
│   │   ├── kustomization.yaml   # replicas: 2, staging URLs
│   │   └── patches/
│   └── prod/
│       ├── kustomization.yaml   # replicas: 5, prod URLs, strict limits
│       └── patches/
└── kustomization.yaml
```

**Why not branches**:
- Branch-per-environment causes drift (hotfix in prod never merged to dev)
- Complexity scales linearly with N environments (N branches to maintain)
- Merge conflicts between divergent branches
- Single branch = constant complexity regardless of number of environments

**Rationale**: Flux CD documentation, Codefresh, and Cloudogu all recommend directory-per-environment as the standard GitOps pattern. Kong uses per-environment YAML files (same principle). ArgoCD ApplicationSets map naturally to directory structures.

### 5. Promotion Workflow: "Promote with Confidence"

The Console provides a "Promote to Prod" button that automates the entire promotion workflow while keeping Git as the authority:

```
┌─────────────────────────────────────────────────────────────┐
│ Console (Staging view)                                       │
│                                                              │
│  payments-api v2.1.0                                         │
│  Status: ✅ Healthy | Traffic: 450 req/min | Errors: 0.01%  │
│                                                              │
│  [Promote to Prod]                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Generate PR                                          │
│  - Copy staging UAC overlay → prod overlay                   │
│  - Apply env-specific transformations (URLs, replicas, etc.) │
│  - Attach staging health report (latency, error rate, uptime)│
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Review & Approve                                     │
│  - PR created with full diff visible                         │
│  - CODEOWNERS review required                                │
│  - Staging metrics attached as PR comment                    │
│  - Console shows PR status in real-time                      │
└──────────────┬──────────────────────────────────────────────┘
               │  (human approves PR)
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Merge & Deploy                                       │
│  - Squash merge to main                                      │
│  - ArgoCD detects change in prod overlay                     │
│  - Reconciliation: Gateway config updated                    │
│  - Progressive delivery (canary 10% → 50% → 100%)           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Verify & Rollback                                    │
│  - Prometheus metrics monitored (error rate, latency)        │
│  - If degradation: automatic rollback (git revert + sync)    │
│  - Console shows deployment progress with live metrics       │
└─────────────────────────────────────────────────────────────┘
```

**Differentiation from competitors** (as of February 2026):
- **vs Kong**: Kong's decK CLI requires manual `deck dump` → edit → `deck sync` ([docs](https://developer.konghq.com/deck/gateway/sync/)). STOA automates the entire flow via Console → Git PR.
- **vs Gravitee**: Gravitee promotes via Cockpit SaaS ([blog](https://www.gravitee.io/blog/gitops-for-api-management)). STOA promotes via Git (open, auditable, no SaaS dependency).
- **vs Apigee**: Apigee's UI deployment is RBAC-gated but has no native approval workflow ([docs](https://docs.apigee.com/api-platform/deploy/deploying-proxies-ui)). STOA uses Git PR reviews as the approval mechanism.
- **vs WSO2**: WSO2's workflow engine is built into the product ([docs](https://apim.docs.wso2.com/en/4.3.0/deploy-and-publish/deploy-on-gateway/deploy-api/revision-deployment-workflow/)). STOA uses Git-native workflows (tool-agnostic, works with GitHub, GitLab, Bitbucket).

### 6. Drift Detection and Reconciliation

ArgoCD continuously compares the Git-declared state against the live cluster state. Any manual change (`kubectl edit`, direct API call) is detected and flagged.

| Drift Type | Detection | Action |
|-----------|-----------|--------|
| Manual `kubectl edit` | ArgoCD OutOfSync | Auto-revert (ArgoCD auto-sync) |
| Direct Console API call (dev) | Allowed | Written to Git async (background sync) |
| Direct Console API call (prod) | Blocked by Console mode | N/A — Console generates PR instead |
| Emergency hotfix | Allowed with audit | Time-limited, generates retroactive PR |

**Console Drift Dashboard**: The Console displays a drift indicator per environment — green (in sync), yellow (pending sync), red (manual drift detected).

### 7. Multi-Tenant Environment Isolation

Each tenant can have its own environment progression, scoped by namespace:

```
stoa-config/
├── tenants/
│   ├── acme-corp/
│   │   ├── base/
│   │   └── overlays/
│   │       ├── dev/
│   │       ├── staging/
│   │       └── prod/
│   └── globex/
│       ├── base/
│       └── overlays/
│           ├── dev/
│           ├── staging/
│           └── prod/
```

### 8. Tenant-Owned Approval Routing

Promotion approvers are defined **by the tenant owner**, not by a platform-wide CODEOWNERS file. This uses a hybrid approach combining ArgoCD AppProject RBAC with Control Plane metadata:

```
┌─────────────────────────────────────────────────────────┐
│ Control Plane API (source of truth for approvers)        │
│                                                          │
│  Tenant: acme-corp                                       │
│    owner: alice@acme.com                                 │
│    promotion_approvers:                                  │
│      - alice@acme.com     (tenant admin)                │
│      - bob@acme.com       (devops lead)                 │
│    approval_policy: "any_one"  (1 of N approvers)       │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ GitHub Actions (enforce approval before merge)           │
│                                                          │
│  on: pull_request (paths: overlays/prod/tenants/acme/*) │
│    1. Query CP API: GET /tenants/acme/promotion-approvers│
│    2. Check PR approvals match required approvers        │
│    3. Block merge if no matching approval                │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ ArgoCD AppProject (defense in depth)                     │
│                                                          │
│  Project: acme-corp                                      │
│    sourceRepos: [stoa-config]                            │
│    destinations: [namespace: tenant-acme]                │
│    roles:                                                │
│      - name: sync-admin                                  │
│        policies: ["p, proj:acme:sync-admin, app, sync,  │
│                    acme-corp/*, allow"]                   │
│        groups: [acme-admins]                             │
└─────────────────────────────────────────────────────────┘
```

**Why tenant-owned, not platform-wide CODEOWNERS**:

| Approach | Pros | Cons |
|----------|------|------|
| GitHub CODEOWNERS (per-path) | Simple, native GitHub | Platform team must edit file for every tenant change; no self-service |
| GitLab Approval Rules | Per-path sections, flexible | Requires GitLab migration |
| **CP API metadata + GH Actions** (chosen) | Tenant self-service, API-driven, Console UI | Custom GH Action needed |
| ArgoCD AppProject RBAC | Defense in depth, K8s-native | Sync-level only, not PR-level |

The chosen approach (CP API metadata enforced by GitHub Actions, backed by ArgoCD AppProject) provides:
- **Self-service**: Tenant owners manage their own approvers via Console UI
- **Defense in depth**: Even if GH Actions bypassed, ArgoCD AppProject blocks unauthorized syncs
- **Auditability**: Approver changes tracked in CP API audit log

## Consequences

### Positive

1. **Enterprise-grade governance** — every production change has a Git commit, PR review, and approval trail
2. **Compliance-ready** — DORA, SOC 2, PCI-DSS all require change management audit trails; Git provides this natively
3. **Rollback in seconds** — `git revert` + ArgoCD auto-sync vs manual UI rollback in competitor platforms
4. **No vendor lock-in** — Git + Kustomize + ArgoCD are open standards; no proprietary promotion API
5. **Developer experience** — developers already know Git; no new tool to learn (vs decK, apigeecli, tyk-sync)
6. **"Define Once, Promote Everywhere"** — UAC is the portable unit, overlays handle env-specific config
7. **Unique market position** — "Born GitOps" is a defensible differentiator against retrofitted competitors

### Negative

1. **Latency for prod changes** — PR → review → merge → ArgoCD sync = 5-15 minutes (vs instant UI click in dev)
   - *Mitigation*: Emergency hotfix path with enhanced audit; dev/staging remain instant
2. **Learning curve** — operators must understand Kustomize overlays and Git workflows
   - *Mitigation*: Console generates all YAML automatically; users never write YAML manually
3. **Complexity for simple setups** — solo developers don't need multi-env governance
   - *Mitigation*: Dev environment remains full-write; governance only kicks in for staging/prod
4. **Git repository size** — large deployments with many APIs may generate verbose config
   - *Mitigation*: Kustomize patches are small; base definitions are shared

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Emergency prod change blocked by PR review | Medium | High | Fast-track path: auto-merge with post-hoc review + audit alert |
| ArgoCD reconciliation lag | Low | Medium | Configurable sync interval (prod: 1min, dev: immediate) |
| Git conflicts during concurrent promotions | Low | Low | Kustomize patches are scoped per API; conflicts are rare |
| Console ↔ Git desync | Medium | Medium | Background reconciliation; Console reads from Git, not DB, for config |

## Alternatives Considered

### A. Database-Backed Control Plane + Git Sync (Kong/Tyk model)

Control Plane API owns the configuration in PostgreSQL. A sync mechanism (like decK) exports to Git periodically.

**Rejected because**: This makes Git a mirror, not the source of truth. Drift is inevitable (someone edits the DB directly). Two sources of truth = two sources of bugs.

### B. Approval Workflow Engine (WSO2 model)

Build a custom approval workflow engine into the Console with role-based gates.

**Rejected because**: Reinventing the wheel. Git PRs already provide review, approval, audit trail, and rollback. Adding a proprietary workflow engine adds complexity without adding value.

### C. Branch-per-Environment

Use `dev`, `staging`, `prod` branches. Merge dev → staging → prod for promotion.

**Rejected because**: Industry consensus against this pattern. Drift between branches, merge conflicts, complexity scales with N environments.

### D. UI-Only Governance (MuleSoft model)

All governance happens in the Console UI with RBAC-gated deployments.

**Rejected because**: No immutable audit trail. RBAC prevents unauthorized changes but doesn't provide reviewability or rollback. Not aligned with GitOps principles.

## Implementation Plan

### Phase 1: Foundation (Q1 2026)

- **P1.1**: Define UAC CRD schema with Kustomize overlay support
- **P1.2**: Create `stoa-config/` repository structure (base + overlays for dev/staging/prod)
- **P1.3**: ArgoCD ApplicationSet for multi-environment reconciliation
- **P1.4**: Console environment selector (tab-based UI, per-env views)

### Phase 2: Console Modes (Q2 2026)

- **P2.1**: Console read-only mode for production
- **P2.2**: "Edit" button generates Git PR via GitHub API
- **P2.3**: PR status tracking in Console (pending, approved, merged, synced)
- **P2.4**: Staging health report attachment to promotion PRs

### Phase 3: Promote with Confidence (Q2-Q3 2026)

- **P3.1**: "Promote to Prod" button with env-specific transformation
- **P3.2**: CODEOWNERS integration for approval routing
- **P3.3**: Drift detection dashboard in Console
- **P3.4**: Progressive delivery integration (Argo Rollouts canary)

### Phase 4: Enterprise (Q3-Q4 2026)

- **P4.1**: Multi-tenant environment isolation (per-tenant overlays)
- **P4.2**: Configurable approval policies per tenant
- **P4.3**: Automated rollback on metric degradation
- **P4.4**: Audit log export for compliance (DORA, SOC 2)

## References

- [Kong decK GitOps Workflow](https://konghq.com/blog/engineering/gitops-for-kong-managing-kong-declaratively-with-deck-and-github-actions)
- [Kong Runtime Groups](https://konghq.com/blog/product-releases/managing-multiple-environments-with-konnect-and-runtime-groups)
- [Apigee API Development Lifecycle](https://docs.apigee.com/api-platform/fundamentals/api-development-lifecycle)
- [Apigee Environment Groups](https://cloud.google.com/apigee/docs/api-platform/fundamentals/environments-overview)
- [Gravitee GitOps + GKO](https://www.gravitee.io/blog/gitops-for-api-management)
- [Tyk Sync Documentation](https://docs.tyk.technology/api-management/automations/sync)
- [Flux CD Repository Structure](https://fluxcd.io/flux/guides/repository-structure/)
- [ArgoCD ApplicationSets](https://argo-cd.readthedocs.io/en/stable/user-guide/application-set/)
- [Codefresh: How to Model GitOps Environments](https://codefresh.io/blog/how-to-model-your-gitops-environments-and-promote-releases-between-them/)
- [Cloudogu: GitOps Promotion Patterns](https://platform.cloudogu.com/en/blog/gitops-repository-patterns-part-4-promotion-patterns/)
- [WSO2 Revision Deployment Workflow](https://apim.docs.wso2.com/en/4.3.0/deploy-and-publish/deploy-on-gateway/deploy-api/revision-deployment-workflow/)
- [Argo Rollouts Progressive Delivery](https://argoproj.github.io/argo-rollouts/)
- [Kong decK GitHub Repository](https://github.com/Kong/deck) (first commit: 2019)
- [Apigee Deploy Maven Plugin](https://github.com/apigee/apigee-deploy-maven-plugin) (first commit: 2015)
- [Apigee UI Deployment](https://docs.apigee.com/api-platform/deploy/deploying-proxies-ui)
- [WSO2 apictl CLI](https://apim.docs.wso2.com/en/4.3.0/)
- [MuleSoft Anypoint CLI](https://docs.mulesoft.com/anypoint-cli/latest/)

> Feature comparisons are based on publicly available documentation as of
> February 2026. Product capabilities change frequently. We encourage readers
> to verify current features directly with each vendor. All trademarks
> belong to their respective owners.
