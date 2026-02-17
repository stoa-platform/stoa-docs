---
sidebar_position: 4
title: "Backup & Recovery"
description: "STOA Platform backup and disaster recovery — PostgreSQL backups, secrets management, configuration export, and recovery procedures."
keywords:
  - backup
  - disaster recovery
  - PostgreSQL
  - secrets backup
  - data export
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Backup & Recovery

This guide covers backup strategies, disaster recovery procedures, and restore workflows for STOA Platform.

## What to Back Up

| Component | Data | Method | Frequency |
|-----------|------|--------|-----------|
| PostgreSQL | APIs, subscriptions, consumers, tenants | `pg_dump` | Daily |
| Keycloak | Realm config, users, clients | Realm export | Weekly |
| Infisical/Vault | Platform secrets | Provider backup | Weekly |
| Helm values | Deployment configuration | Git (IaC) | Every change |
| CRDs | Tool, ToolSet, GatewayInstance, GatewayBinding | `kubectl get -o yaml` | Daily |
| Grafana | Dashboards, datasources | JSON export or Git | Every change |

### What Does NOT Need Backup

- **STOA Gateway state**: In-memory, reconstructed from Control Plane on restart
- **Prometheus metrics**: Ephemeral by design (configure retention instead)
- **Container images**: Stored in GHCR, reproducible from source

## PostgreSQL Backup

### Automated Daily Backup

Create a CronJob for automated backups:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: pg-backup
  namespace: stoa-system
spec:
  schedule: "0 2 * * *"    # Daily at 2 AM UTC
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:15-alpine
              command:
                - /bin/sh
                - -c
                - |
                  pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE \
                    --format=custom \
                    --compress=9 \
                    -f /backups/stoa-$(date +%Y%m%d-%H%M%S).dump
              envFrom:
                - secretRef:
                    name: postgres-credentials
              volumeMounts:
                - name: backup-storage
                  mountPath: /backups
          volumes:
            - name: backup-storage
              persistentVolumeClaim:
                claimName: pg-backups-pvc
          restartPolicy: OnFailure
```

### Manual Backup

<EnvSetup />

```bash
# Backup
kubectl exec -n stoa-system deploy/postgres -- \
  pg_dump -U stoa -d stoa --format=custom --compress=9 \
  > stoa-backup-$(date +%Y%m%d).dump

# Verify backup integrity
pg_restore --list stoa-backup-*.dump | head -20
```

### Restore

```bash
# Restore from backup (replaces all data)
kubectl exec -i -n stoa-system deploy/postgres -- \
  pg_restore -U stoa -d stoa --clean --if-exists \
  < stoa-backup-20260213.dump
```

## Keycloak Backup

### Realm Export

```bash
# Export realm configuration
kubectl exec -n stoa-system deploy/keycloak -- \
  /opt/keycloak/bin/kc.sh export \
  --dir /tmp/export \
  --realm stoa \
  --users realm_file

# Copy export locally
kubectl cp stoa-system/keycloak-0:/tmp/export/stoa-realm.json ./keycloak-backup.json
```

### Realm Import (Restore)

```bash
# Import realm from backup
kubectl cp ./keycloak-backup.json stoa-system/keycloak-0:/tmp/import/stoa-realm.json

kubectl exec -n stoa-system deploy/keycloak -- \
  /opt/keycloak/bin/kc.sh import \
  --dir /tmp/import \
  --override true
```

## CRD Backup

```bash
# Export all STOA CRDs
for crd in tools toolsets gatewayinstances gatewaybindings; do
  kubectl get ${crd}.gostoa.dev -A -o yaml > ${crd}-backup.yaml
done
```

### Restore CRDs

```bash
kubectl apply -f tools-backup.yaml
kubectl apply -f toolsets-backup.yaml
kubectl apply -f gatewayinstances-backup.yaml
kubectl apply -f gatewaybindings-backup.yaml
```

## Disaster Recovery

### Recovery Time Objectives

| Scenario | RTO | RPO | Procedure |
|----------|-----|-----|-----------|
| Single pod failure | Immediate | 0 | K8s self-healing (replicas) |
| Node failure | 5 min | 0 | K8s rescheduling |
| Database corruption | 30 min | 24h | Restore from pg_dump |
| Full cluster loss | 2-4h | 24h | New cluster + restore all |
| Region outage | 4-8h | 24h | Failover to secondary region |

### Full Cluster Recovery Procedure

1. **Provision new cluster** (Helm or Terraform)
2. **Restore PostgreSQL** from latest backup
3. **Import Keycloak realm** from export
4. **Apply CRDs** from backup
5. **Install Helm chart** with saved values
6. **Verify gateway health** and re-sync APIs
7. **Update DNS** to point to new cluster

### Verification Checklist

After any restore:

- [ ] `kubectl get pods -n stoa-system` — all pods Running
- [ ] Control Plane API responds on `/health`
- [ ] Gateway responds on `/health`
- [ ] Keycloak login works
- [ ] API catalog shows correct data
- [ ] Subscriptions are intact
- [ ] Prometheus scraping resumes

## Retention Policy

| Backup Type | Retention | Storage |
|-------------|-----------|---------|
| Daily PostgreSQL | 30 days | PVC or object storage |
| Weekly Keycloak export | 90 days | Git or object storage |
| CRD snapshots | 30 days | Git |
| Helm values | Indefinite | Git (IaC) |

## Related

- [Installation Guide](/docs/admin/installation) -- Helm chart deployment
- [Upgrade Guide](/docs/admin/upgrade) -- Version upgrades
- [Configuration Reference](/docs/reference/configuration) -- Environment variables
