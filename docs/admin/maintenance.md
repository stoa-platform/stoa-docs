---
sidebar_position: 5
title: Maintenance Cycle
description: Operate STOA upgrade, rollback, and uninstall as one verifiable cycle — pre-checks, controls, and safe teardown — without publishing live secrets.
keywords: [maintenance, upgrade, rollback, uninstall, helm, alembic, operations, on-premises]
---

# Maintenance Cycle

This page is the **verifiable operations procedure** for day-2 maintenance on a STOA site: prepare → upgrade → verify → roll back if needed → or uninstall deliberately. Detailed Helm flags and values stay in [Installation](./installation) and [Upgrade](./upgrade); backups in [Backup and Recovery](./backup-recovery). Use this page as the checklist you tick in the change ticket.

:::info Scope of this guide
- **In scope:** ordered controls for upgrade and rollback, when database downgrade is unsafe, and a safe uninstall path (Helm release, namespace, optional CRDs, data retention decision).
- **Out of scope:** writing a new chart; product release notes content (read them, do not invent breaking-change lists here); incident bridges ([Incident Response](./incident-response)).
- **Placeholders only:** `stoa-system`, `api.example.com`, `<NEW_VERSION>`, `<REVISION>`. No production hostnames or secrets.
:::

The hosted public platform was shut down on 2026-05-23; operators run these steps on their own infrastructure ([ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first)). Air-gapped sites use the same cycle with chart and images already on site ([Offline Installation](../deployment/offline-install)).

## 1. Decide which path you are on

| Intent | Path | Primary pages |
|--------|------|---------------|
| Move to a newer release | Upgrade | This page §2–§4 + [Upgrade](./upgrade) |
| Undo a bad upgrade | Rollback | This page §5 + [Upgrade](./upgrade) § Rolling Back |
| Remove STOA from the cluster | Uninstall | This page §6 + [Installation](./installation) § Uninstall |
| Service is down mid-change | Incident first | [Incident Response](./incident-response), then resume maintenance |

One change window = one path. Do not uninstall “to fix” an upgrade without an explicit data-retention decision.

## 2. Pre-maintenance controls (all paths)

Record answers in the ticket before any Helm command.

1. **Release target** — Chart / image pin you will install or roll back to (no floating `latest` in production).
2. **Backup age** — Successful PostgreSQL backup and Keycloak realm export within your RPO ([Backup and Recovery](./backup-recovery)).
3. **Helm baseline** — `helm history stoa-platform -n stoa-system` captured (revision numbers).
4. **Cluster health** — `kubectl get pods -n stoa-system` shows Ready workloads (or you accept starting from a degraded state and have an incident ticket).
5. **Breaking changes** — Release notes read; CRD and migration notes understood.
6. **Communication** — Maintenance window announced to tenants if customer-visible downtime is possible.
7. **Offline** — Bundle already on site if the cluster has no registry pull to the Internet.

Stop if a control is unanswered.

## 3. Upgrade (ordered)

Follow the detailed commands in [Upgrade](./upgrade). Enforce this order:

1. Pre-controls (§2) green  
2. Apply CRDs **before** `helm upgrade` (Helm does not upgrade CRDs)  
3. Run database migrations only when the release notes require them — prefer migrations that are **additive / backwards-compatible** for zero-downtime ([Upgrade](./upgrade) § Zero-Downtime)  
4. `helm upgrade` with an explicit `--version` (or a local chart path matching that pin)  
5. Verification controls (§4)  
6. Only then close the change ticket  

If step 5 fails → §5 Rollback. Do not “retry with a different values file” without a new ticket line.

## 4. Post-upgrade verification controls

| Control | How | Pass |
|---------|-----|------|
| Pods Ready | `kubectl get pods -n stoa-system` | Desired replicas Ready |
| Image pins | Deploy images match `<NEW_VERSION>` | No unexpected `latest` |
| Health | Site health endpoints for Control Plane and gateway | HTTP 2xx / expected body |
| Smoke | Known route with a non-production probe credential | Success |
| Migrations | If alembic ran: app starts; no migration-error crash loops | Stable |
| Alerts | No new critical paging caused by the upgrade | Quiet or explained |

Soak at least a short window (suggest ≥ 15 minutes for production) before declaring success.

## 5. Rollback

Rollback restores **service with the previous revision**, not “force the new chart to work”.

### 5.1 Helm rollback (default first move)

```bash
helm history stoa-platform -n stoa-system
helm rollback stoa-platform <REVISION> -n stoa-system
kubectl rollout status deploy -n stoa-system --timeout=5m
```

Re-run §4 controls against the rolled-back revision.

### 5.2 Database downgrade — stop and think

`alembic downgrade` is **destructive** if migrations already wrote or reshaped data.

| Situation | Action |
|-----------|--------|
| Migration was additive only (new nullable column / new table unused) | Helm rollback may be enough; downgrade only if release notes say so |
| Migration backfilled or dropped data | **Do not** blind `downgrade -1` — restore PostgreSQL from the pre-upgrade backup ([Backup and Recovery](./backup-recovery)) |
| Unsure | Treat as SEV-2, open [Incident Response](./incident-response), prefer restore over downgrade |

If you must run a documented downgrade:

```bash
kubectl exec -n stoa-system deploy/control-plane-api -- \
  alembic downgrade -1
```

Then Helm rollback (or re-upgrade to the known-good chart) and §4 controls. Record the alembic revision before and after.

### 5.3 Rollback verification

Same table as §4, plus: confirm `helm history` shows the expected current revision.

## 6. Uninstall

Uninstall is irreversible for in-cluster state once PVCs and CRDs are gone. Prefer rollback (§5) if the goal is “make it work again”.

### 6.1 Pre-uninstall decisions

- [ ] **Data retention** — Keep PostgreSQL PVC / external DB snapshots? Keep Keycloak export?
- [ ] **DNS / ingress** — Who removes public DNS for `api.example.com` / gateway hostnames?
- [ ] **Secrets** — Rotate or destroy site secrets in the secrets backend (OpenBao or HashiCorp Vault) after teardown ([Secret and Key Rotation](./secret-rotation))
- [ ] **CRDs** — Deleting CRDs destroys all CRs cluster-wide for those APIs — confirm no other namespace still needs them

### 6.2 Ordered teardown

```bash
# 1. Remove the release (workloads, most resources)
helm uninstall stoa-platform -n stoa-system

# 2. Optional: delete the namespace (PVCs follow namespace policy — confirm reclaim)
kubectl delete namespace stoa-system

# 3. Optional — ONLY with explicit OK: remove CRDs (destroys all related CRs)
kubectl delete crd \
  tools.gostoa.dev \
  toolsets.gostoa.dev \
  gatewayinstances.gostoa.dev \
  gatewaybindings.gostoa.dev \
  skills.gostoa.dev
```

Leave external databases and object storage alone unless the retention decision says to wipe them.

### 6.3 Post-uninstall controls

| Control | Pass |
|---------|------|
| `helm list -n stoa-system` | Release absent (or namespace gone) |
| `kubectl get ns stoa-system` | Not Found if namespace deleted |
| CRDs | Absent only if step 3 was approved and run |
| Backup copies | Still readable offline per retention decision |
| Ticket | Retention decision and who wiped what recorded |

## 7. Related

- [Upgrade](./upgrade) — command-level upgrade and compatibility table  
- [Installation](./installation) — chart reference and short uninstall snippet  
- [Backup and Recovery](./backup-recovery) — mandatory before upgrade / before destructive uninstall  
- [Incident Response](./incident-response) — when maintenance turns into an outage  
- [Secret and Key Rotation](./secret-rotation) — credentials after teardown  
- [Offline Installation](../deployment/offline-install) — air-gapped pins and bundles  
