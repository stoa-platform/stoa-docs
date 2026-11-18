---
sidebar_position: 5
title: "Guide de Mise à Jour"
description: "Mettre à jour la Plateforme STOA — compatibilité des versions, étapes de migration, mises à jour progressives et procédures de rollback."
keywords:
  - upgrade
  - migration
  - version upgrade
  - rolling update
  - rollback
---

# Guide de Mise à Jour

Pour la liste complète de contrôle (mise à jour → vérification → rollback → désinstallation), consultez [Maintenance Cycle](/docs/admin/maintenance).

Comment mettre à jour la Plateforme STOA entre versions sans interruption de service.

## Stratégie de Mise à Jour

STOA utilise des **mises à jour progressives** par défaut. L'ordre de mise à jour est important :

```
1. CRDs (si modifiés)
2. Migrations de base de données (Alembic)
3. Control Plane API
4. STOA Gateway
5. Console UI + Portail
```

## Liste de Vérification Pré-Mise à Jour

- [ ] Lire les notes de version pour les changements cassants
- [ ] Sauvegarder PostgreSQL (voir [Sauvegarde & Récupération](/docs/admin/backup-recovery))
- [ ] Exporter le realm Keycloak partagé `stoa` ([ADR-074](/docs/architecture/adr/adr-074-tenant-model))
- [ ] Noter les versions actuelles : `helm list -n stoa-system`
- [ ] Vérifier la santé du cluster : `kubectl get pods -n stoa-system`

## Étapes de Mise à Jour

### 1. Mettre à Jour les CRDs

Helm ne met pas à jour les CRDs automatiquement. Appliquez-les manuellement :

```bash
kubectl apply -f charts/stoa-platform/crds/
```

### 2. Exécuter les Migrations de Base de Données

Si la version inclut des changements de schéma :

```bash
kubectl exec -n stoa-system deploy/control-plane-api -- \
  alembic upgrade head
```

### 3. Mettre à Jour la Release Helm Passerelle

Le chart `charts/stoa-platform` réside directement dans le checkout `stoa-platform/stoa` (aucun dépôt Helm distant n'est publié à ce jour) et déploie la passerelle ainsi que les CRD ; mettez à jour en parallèle Control Plane, UI et Keycloak via vos manifestes GitOps/déploiement :

```bash
helm upgrade stoa-platform ./charts/stoa-platform \
  -n stoa-system \
  -f my-values.yaml
```

### 4. Vérifier

```bash
# Vérifier l'état des pods
kubectl get pods -n stoa-system

# Vérifier les versions
kubectl get deploy -n stoa-system -o jsonpath='{range .items[*]}{.metadata.name}: {.spec.template.spec.containers[0].image}{"\n"}{end}'

# Vérifications de santé
curl -s https://api.<VOTRE_DOMAINE>/health
curl -s https://mcp.<VOTRE_DOMAINE>/health
```

## Rollback {#rolling-back}

Privilégiez la séquence ordonnée décrite dans [Maintenance Cycle](/docs/admin/maintenance) §5. En résumé :

### Rollback Helm

```bash
# Lister l'historique
helm history stoa-platform -n stoa-system

# Rollback vers la révision précédente
helm rollback stoa-platform <REVISION> -n stoa-system
kubectl rollout status deploy -n stoa-system --timeout=5m
```

Relancez les contrôles de vérification post-mise à jour après le rollback.

### Rollback de Base de Données

:::warning Opération destructive
`alembic downgrade` peut détruire ou altérer des données. Si la migration a déjà transformé ou supprimé des colonnes, **restaurez PostgreSQL depuis la sauvegarde pré-mise à jour** plutôt que de rétrograder ([Sauvegarde & Récupération](./backup-recovery), [Maintenance Cycle](/docs/admin/maintenance) §5.2).
:::

Uniquement lorsque les notes de version documentent un retour arrière sûr :

```bash
kubectl exec -n stoa-system deploy/control-plane-api -- \
  alembic downgrade -1
```

## Compatibilité des Versions

| Composant | Règle de Compatibilité |
|-----------|------------------------|
| Control Plane API | Doit correspondre à la version du schéma de base de données |
| STOA Gateway | Compatible avec CP API N et N-1 |
| Console UI | Compatible avec CP API N et N-1 |
| Portail | Compatible avec CP API N et N-1 |
| CRDs | Doivent être appliqués avant la mise à jour du chart |
| Keycloak | 26.x (realm `stoa`, [ADR-074](/docs/architecture/adr/adr-074-tenant-model)) ; tester les montées majeures en staging |

## Mises à Jour Sans Interruption

STOA prend en charge les mises à jour sans interruption lorsque :

1. **Plusieurs réplicas** sont en cours d'exécution (`replicas >= 2`)
2. **PodDisruptionBudget** est configuré :

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

3. **Les sondes de disponibilité** sont configurées (par défaut dans le chart Helm)
4. **Les migrations de base de données sont rétrocompatibles** (additives uniquement)

## Voir Aussi

- [Guide d'Installation](/docs/admin/installation) -- Déploiement initial
- [Sauvegarde & Récupération](/docs/admin/backup-recovery) -- Sauvegardes pré-mise à jour
- [Changelog](/docs/reference/changelog) -- Notes de version
