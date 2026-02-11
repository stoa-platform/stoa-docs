---
sidebar_position: 2
title: "GitOps with ArgoCD: Declarative API Management"
description: "How STOA leverages GitOps principles with ArgoCD for declarative, auditable configuration management — automated sync, self-healing, and Git as source of truth"
keywords: [GitOps, ArgoCD, Kubernetes, declarative, infrastructure as code]
---

# GitOps with ArgoCD + AWX

How STOA leverages GitOps for declarative configuration management.

## GitOps Philosophy

STOA embraces GitOps principles:

- **Git as Single Source of Truth** - All configuration stored in Git
- **Declarative Configuration** - Desired state defined, not imperative steps
- **Automated Sync** - ArgoCD continuously reconciles actual vs desired state
- **Audit Trail** - Git history provides complete audit log

## ArgoCD Integration

ArgoCD manages Kubernetes resources:

```yaml
# Example: Tenant Application
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tenant-acme
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://gitlab.com/stoa-platform/stoa-gitops
    targetRevision: main
    path: tenants/acme
  destination:
    server: https://kubernetes.default.svc
    namespace: tenant-acme
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Benefits

- **Declarative Tenant Configuration** - Define tenant resources in YAML
- **Automatic Sync** - Changes in Git automatically applied to cluster
- **Self-Healing** - Drift detection and automatic remediation
- **Rollback** - Easy rollback via Git history

## AWX Integration

AWX (Ansible Tower) handles:

- **Pre-provisioning Tasks** - Setup tasks before K8s resources
- **External System Integration** - Configure Keycloak, databases, etc.
- **Post-deployment Hooks** - Validation and notifications
- **Complex Orchestration** - Multi-step provisioning workflows

### Example Workflow

1. **API Request** - User creates tenant via Control Plane API
2. **Git Commit** - Control Plane commits tenant config to Git
3. **AWX Job** - Triggered to create Keycloak realm, DB schema
4. **ArgoCD Sync** - Detects new tenant config, deploys K8s resources
5. **Validation** - AWX runs post-deployment checks
6. **Notification** - User notified of tenant readiness

## Configuration Repository Structure

```
stoa-tenants/
├── tenants/
│   ├── acme/
│   │   ├── mcp-gateway-deployment.yaml
│   │   ├── mcp-gateway-service.yaml
│   │   ├── ingress.yaml
│   │   └── network-policy.yaml
│   └── globex/
│       └── ...
├── argocd-apps/
│   ├── tenant-acme.yaml
│   └── tenant-globex.yaml
└── ansible/
    ├── playbooks/
    └── roles/
```

## Best Practices

- **Immutable Configuration** - Never manually edit cluster resources
- **Pull Requests** - All changes go through PR review
- **Environments** - Separate repos/branches for dev/staging/prod
- **Secrets Management** - Use sealed-secrets or external secret stores

---

🚧 **Coming Soon**: Detailed GitOps workflows, ArgoCD application examples, and AWX playbook templates.
