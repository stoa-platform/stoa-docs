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
- [ ] Exporter le realm Keycloak
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

### 3. Mettre à Jour la Release Helm

```bash
helm repo update
helm upgrade stoa-platform stoa/stoa-platform \
  -n stoa-system \
  -f my-values.yaml \
  --version <NOUVELLE_VERSION>
```

Ou depuis un chart local :

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

## Rollback

### Rollback Helm

```bash
# Lister l'historique
helm history stoa-platform -n stoa-system

# Rollback vers la révision précédente
helm rollback stoa-platform <REVISION> -n stoa-system
```

### Rollback de Base de Données

Si les migrations doivent être annulées :

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
| Keycloak | 24.x pris en charge, tester 25.x en staging |

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
