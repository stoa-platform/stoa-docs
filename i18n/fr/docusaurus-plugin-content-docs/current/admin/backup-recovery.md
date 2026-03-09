---
sidebar_position: 4
title: "Sauvegarde & Récupération"
description: "Sauvegarde et reprise après sinistre pour la Plateforme STOA — sauvegardes PostgreSQL, gestion des secrets, export de configuration et procédures de restauration."
keywords:
  - backup
  - disaster recovery
  - PostgreSQL
  - secrets backup
  - data export
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Sauvegarde & Récupération

Ce guide couvre les stratégies de sauvegarde, les procédures de reprise après sinistre et les workflows de restauration pour la Plateforme STOA.

## Quoi Sauvegarder

| Composant | Données | Méthode | Fréquence |
|-----------|---------|--------|-----------|
| PostgreSQL | APIs, abonnements, consommateurs, tenants | `pg_dump` | Quotidien |
| Keycloak | Config realm, utilisateurs, clients | Export du realm | Hebdomadaire |
| Infisical/Vault | Secrets de la plateforme | Sauvegarde fournisseur | Hebdomadaire |
| Valeurs Helm | Configuration de déploiement | Git (IaC) | À chaque changement |
| CRDs | Tool, ToolSet, GatewayInstance, GatewayBinding | `kubectl get -o yaml` | Quotidien |
| Grafana | Tableaux de bord, sources de données | Export JSON ou Git | À chaque changement |

### Ce qui N'a PAS Besoin d'Être Sauvegardé

- **État du STOA Gateway** : En mémoire, reconstruit depuis le Control Plane au redémarrage
- **Métriques Prometheus** : Éphémères par conception (configurer la rétention à la place)
- **Images de conteneurs** : Stockées dans GHCR, reproductibles depuis les sources

## Sauvegarde PostgreSQL

### Sauvegarde Automatique Quotidienne

Créez un CronJob pour les sauvegardes automatisées :

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: pg-backup
  namespace: stoa-system
spec:
  schedule: "0 2 * * *"    # Quotidien à 2h UTC
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

### Sauvegarde Manuelle

<EnvSetup />

```bash
# Sauvegarde
kubectl exec -n stoa-system deploy/postgres -- \
  pg_dump -U stoa -d stoa --format=custom --compress=9 \
  > stoa-backup-$(date +%Y%m%d).dump

# Vérifier l'intégrité de la sauvegarde
pg_restore --list stoa-backup-*.dump | head -20
```

### Restauration

```bash
# Restaurer depuis une sauvegarde (remplace toutes les données)
kubectl exec -i -n stoa-system deploy/postgres -- \
  pg_restore -U stoa -d stoa --clean --if-exists \
  < stoa-backup-20260213.dump
```

## Sauvegarde Keycloak

### Export du Realm

```bash
# Exporter la configuration du realm
kubectl exec -n stoa-system deploy/keycloak -- \
  /opt/keycloak/bin/kc.sh export \
  --dir /tmp/export \
  --realm stoa \
  --users realm_file

# Copier l'export en local
kubectl cp stoa-system/keycloak-0:/tmp/export/stoa-realm.json ./keycloak-backup.json
```

### Import du Realm (Restauration)

```bash
# Importer le realm depuis la sauvegarde
kubectl cp ./keycloak-backup.json stoa-system/keycloak-0:/tmp/import/stoa-realm.json

kubectl exec -n stoa-system deploy/keycloak -- \
  /opt/keycloak/bin/kc.sh import \
  --dir /tmp/import \
  --override true
```

## Sauvegarde des CRDs

```bash
# Exporter tous les CRDs STOA
for crd in tools toolsets gatewayinstances gatewaybindings; do
  kubectl get ${crd}.gostoa.dev -A -o yaml > ${crd}-backup.yaml
done
```

### Restaurer les CRDs

```bash
kubectl apply -f tools-backup.yaml
kubectl apply -f toolsets-backup.yaml
kubectl apply -f gatewayinstances-backup.yaml
kubectl apply -f gatewaybindings-backup.yaml
```

## Reprise après Sinistre

### Objectifs de Temps de Récupération

| Scénario | RTO | RPO | Procédure |
|----------|-----|-----|-----------|
| Défaillance d'un pod | Immédiat | 0 | Auto-guérison K8s (réplicas) |
| Défaillance d'un nœud | 5 min | 0 | Replanification K8s |
| Corruption de la base | 30 min | 24h | Restauration depuis pg_dump |
| Perte totale du cluster | 2-4h | 24h | Nouveau cluster + restauration complète |
| Panne de région | 4-8h | 24h | Basculement vers la région secondaire |

### Procédure de Récupération Complète du Cluster

1. **Provisionner un nouveau cluster** (Helm ou Terraform)
2. **Restaurer PostgreSQL** depuis la dernière sauvegarde
3. **Importer le realm Keycloak** depuis l'export
4. **Appliquer les CRDs** depuis la sauvegarde
5. **Installer le chart Helm** avec les valeurs sauvegardées
6. **Vérifier l'état du gateway** et re-synchroniser les APIs
7. **Mettre à jour le DNS** pour pointer vers le nouveau cluster

### Liste de Vérification Post-Restauration

Après toute restauration :

- [ ] `kubectl get pods -n stoa-system` — tous les pods en Running
- [ ] Le Control Plane API répond sur `/health`
- [ ] Le Gateway répond sur `/health`
- [ ] La connexion Keycloak fonctionne
- [ ] Le catalogue d'APIs affiche les données correctes
- [ ] Les abonnements sont intacts
- [ ] La collecte Prometheus reprend

## Politique de Rétention

| Type de sauvegarde | Rétention | Stockage |
|-------------|-----------|---------|
| PostgreSQL quotidien | 30 jours | PVC ou stockage objet |
| Export Keycloak hebdomadaire | 90 jours | Git ou stockage objet |
| Instantanés CRD | 30 jours | Git |
| Valeurs Helm | Indéfinie | Git (IaC) |

## Voir Aussi

- [Guide d'Installation](/docs/admin/installation) -- Déploiement du chart Helm
- [Guide de Mise à Jour](/docs/admin/upgrade) -- Mises à jour de version
- [Référence de Configuration](/docs/reference/configuration) -- Variables d'environnement
