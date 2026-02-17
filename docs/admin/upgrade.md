---
sidebar_position: 5
title: "Upgrade Guide"
description: "Upgrade STOA Platform — version compatibility, migration steps, rolling updates, and rollback procedures."
keywords:
  - upgrade
  - migration
  - version upgrade
  - rolling update
  - rollback
---

# Upgrade Guide

How to upgrade STOA Platform between versions with zero downtime.

## Upgrade Strategy

STOA uses **rolling updates** by default. The upgrade order matters:

```
1. CRDs (if changed)
2. Database migrations (Alembic)
3. Control Plane API
4. STOA Gateway
5. Console UI + Portal
```

## Pre-Upgrade Checklist

- [ ] Read the release notes for breaking changes
- [ ] Back up PostgreSQL (see [Backup & Recovery](/docs/admin/backup-recovery))
- [ ] Export Keycloak realm
- [ ] Note current versions: `helm list -n stoa-system`
- [ ] Verify cluster health: `kubectl get pods -n stoa-system`

## Upgrade Steps

### 1. Update CRDs

Helm does not upgrade CRDs automatically. Apply them manually:

```bash
kubectl apply -f charts/stoa-platform/crds/
```

### 2. Run Database Migrations

If the release includes schema changes:

```bash
kubectl exec -n stoa-system deploy/control-plane-api -- \
  alembic upgrade head
```

### 3. Upgrade Helm Release

```bash
helm repo update
helm upgrade stoa-platform stoa/stoa-platform \
  -n stoa-system \
  -f my-values.yaml \
  --version <NEW_VERSION>
```

Or from local chart:

```bash
helm upgrade stoa-platform ./charts/stoa-platform \
  -n stoa-system \
  -f my-values.yaml
```

### 4. Verify

```bash
# Check pod status
kubectl get pods -n stoa-system

# Verify versions
kubectl get deploy -n stoa-system -o jsonpath='{range .items[*]}{.metadata.name}: {.spec.template.spec.containers[0].image}{"\n"}{end}'

# Health checks
curl -s https://api.<YOUR_DOMAIN>/health
curl -s https://mcp.<YOUR_DOMAIN>/health
```

## Rolling Back

### Helm Rollback

```bash
# List history
helm history stoa-platform -n stoa-system

# Rollback to previous revision
helm rollback stoa-platform <REVISION> -n stoa-system
```

### Database Rollback

If migrations need reverting:

```bash
kubectl exec -n stoa-system deploy/control-plane-api -- \
  alembic downgrade -1
```

## Version Compatibility

| Component | Compatibility Rule |
|-----------|-------------------|
| Control Plane API | Must match database schema version |
| STOA Gateway | Compatible with CP API N and N-1 |
| Console UI | Compatible with CP API N and N-1 |
| Portal | Compatible with CP API N and N-1 |
| CRDs | Must be applied before chart upgrade |
| Keycloak | 24.x supported, test 25.x in staging |

## Zero-Downtime Upgrades

STOA supports zero-downtime upgrades when:

1. **Multiple replicas** are running (`replicas >= 2`)
2. **PodDisruptionBudget** is configured:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: stoa-gateway-pdb
  namespace: stoa-system
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: stoa-gateway
```

3. **Readiness probes** are configured (default in Helm chart)
4. **Database migrations are backwards-compatible** (additive only)

## Related

- [Installation Guide](/docs/admin/installation) -- Initial deployment
- [Backup & Recovery](/docs/admin/backup-recovery) -- Pre-upgrade backups
- [Changelog](/docs/reference/changelog) -- Release notes
