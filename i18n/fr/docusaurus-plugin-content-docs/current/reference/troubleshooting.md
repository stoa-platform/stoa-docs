---
sidebar_position: 4
title: Dépannage
description: "Diagnostiquer et résoudre les problèmes courants de STOA Platform — échecs de pods, erreurs d'authentification, problèmes de synchronisation du gateway, CORS Keycloak et dépannage des déploiements Kubernetes"
keywords: [troubleshooting, debugging, errors, Kubernetes, deployment issues]
---

# Dépannage

Problèmes courants rencontrés lors de l'exécution de STOA, avec les étapes de diagnostic et les solutions.

## Installation et Déploiement

### Pods qui ne Démarrent Pas

**Symptôme** : Pods bloqués en `CrashLoopBackOff` ou `Pending`.

**Diagnostic** :

```bash
kubectl describe pod <pod-name> -n stoa-system
kubectl logs <pod-name> -n stoa-system --previous
```

**Causes courantes** :

| Cause | Solution |
|-------|-----|
| Secrets manquants | Créer les secrets requis : `kubectl create secret generic stoa-db-credentials ...` |
| Ressources insuffisantes | Augmenter les ressources des nœuds ou réduire le nombre de replicas |
| Échec de téléchargement d'image | Vérifier que l'image existe et que le pull secret est configuré |
| CRDs non appliquées | Exécuter `kubectl apply -f charts/stoa-platform/crds/` |

### Échec de l'Installation Helm

**Symptôme** : `helm upgrade --install` retourne une erreur.

```bash
# Vérifier le statut de la release Helm
helm status stoa-platform -n stoa-system

# Voir les templates rendus
helm template stoa-platform ./charts/stoa-platform -f values.yaml

# Vérifier le chart
helm lint charts/stoa-platform
```

## Base de Données

### Connexion Refusée

**Symptôme** : `connection refused` ou `could not connect to server` dans les logs API.

**Liste de vérification** :

1. Vérifier que la base de données est en cours d'exécution : `kubectl get pods -l app=postgresql`
2. Vérifier la chaîne de connexion : `DATABASE_URL` doit inclure le bon hôte, port et identifiants
3. Vérifier les network policies : s'assurer que le namespace `stoa-system` peut atteindre la base de données
4. Vérifier les groupes de sécurité (AWS) : RDS doit autoriser le trafic entrant depuis les nœuds EKS

### Échecs de Migration

**Symptôme** : L'API démarre mais retourne des erreurs 500 sur les opérations de données.

```bash
cd control-plane-api
alembic upgrade head
alembic current  # Vérifier l'état de la migration
```

Si les migrations sont bloquées :

```bash
alembic stamp head  # Réinitialiser à l'état actuel (utiliser avec précaution)
```

## Authentification

:::tip Configurer votre environnement
Les exemples ci-dessous utilisent des variables d'environnement. Définissez-les pour votre instance STOA :

```bash
export STOA_API_URL="https://api.gostoa.dev"       # Remplacer par votre domaine
export STOA_AUTH_URL="https://auth.gostoa.dev"      # Fournisseur OIDC Keycloak
export STOA_GATEWAY_URL="https://mcp.gostoa.dev"    # Endpoint MCP Gateway
export STOA_CONSOLE_URL="https://console.gostoa.dev"
```

Hébergé vous-même ? Remplacez `gostoa.dev` par votre domaine.
:::

### 401 Unauthorized sur Toutes les Requêtes

**Liste de vérification** :

1. Token expiré ? Se ré-authentifier : `stoa login --server ...`
2. Keycloak accessible ? `curl ${STOA_AUTH_URL}/health`
3. Realm correct ? Doit être `stoa`
4. ID client correct ? `control-plane-ui` pour la Console, `stoa-portal` pour le Portal
5. Décalage d'horloge ? S'assurer que les horloges du serveur et du client sont synchronisées

### Erreurs CORS Lors de la Connexion

**Symptôme** : La console du navigateur affiche des erreurs CORS lors de la redirection vers/depuis Keycloak.

**Solution** : Dans l'admin Keycloak :

1. Ouvrir la configuration du client (`control-plane-ui` ou `stoa-portal`)
2. Ajouter l'URL de l'application dans **Web Origins** (ex : `${STOA_CONSOLE_URL}`)
3. Ajouter dans **Valid Redirect URIs** (ex : `${STOA_CONSOLE_URL}/*`)

### Token sans les Scopes Requis

**Symptôme** : 403 Forbidden malgré une authentification réussie.

**Solution** : S'assurer que l'utilisateur appartient au bon groupe Keycloak :

| Rôle | Groupe | Scopes |
|------|-------|--------|
| Admin plateforme | `cpi-admin` | `stoa:admin`, `stoa:write`, `stoa:read` |
| Admin tenant | `tenant-admin` | `stoa:write`, `stoa:read` |
| DevOps | `devops` | `stoa:write`, `stoa:read` |
| Observateur | `viewer` | `stoa:read` |

## MCP Gateway

### Tools n'Apparaissent Pas

**Symptôme** : `tools/list` retourne un tableau vide.

**Liste de vérification** :

1. CRDs appliquées ? `kubectl get crds | grep gostoa.dev`
2. Tools créés ? `kubectl get tools -A`
3. Watcher activé ? Définir `K8S_WATCHER_ENABLED=true`
4. Namespace correct ? Les tools doivent être dans les namespaces `tenant-{name}`
5. Gateway redémarré après les changements CRD ? (si le watcher est désactivé)

### Politique OPA Refusant Toutes les Requêtes

**Symptôme** : Toutes les requêtes `tools/call` retournent 403.

```bash
# Vérifier qu'OPA est activé et configuré
kubectl logs -l app=mcp-gateway -n stoa-system | grep opa

# Vérifier que les fichiers de politique sont montés
kubectl exec -it <mcp-gateway-pod> -n stoa-system -- ls /policies/
```

Vérifiez que votre politique Rego a un chemin vers `allow = true` pour votre cas d'usage.

### Erreurs de Metering Kafka

**Symptôme** : Les logs MCP Gateway affichent des erreurs de connexion Kafka.

**Liste de vérification** :

1. Kafka/Redpanda en cours d'exécution ? `kubectl get pods -l app=redpanda`
2. Serveurs bootstrap corrects ? Vérifier `KAFKA_BOOTSTRAP_SERVERS`
3. Topic existant ? `kubectl exec redpanda-0 -- rpk topic list`
4. Les network policies autorisent le trafic ? Vérifier les règles inter-namespace

## Portal

### APIs n'Apparaissent pas dans le Catalogue

**Symptôme** : Le Portal se charge mais le catalogue est vide.

**Liste de vérification** :

1. APIs publiées ? Vérifier dans la Console UI ou via l'API
2. Visibilité Portal activée ? L'API doit avoir `portal.visible: true`
3. L'endpoint API retourne des données ? `curl ${STOA_API_URL}/v1/portal/apis`
4. Auth fonctionnelle ? Le Portal a besoin d'un token valide pour récupérer le catalogue

### La Recherche Retourne 500

**Symptôme** : La recherche dans le Portal retourne HTTP 500.

Il s'agissait d'un problème connu (CAB-1044) causé par des wildcards LIKE non échappés. Assurez-vous d'exécuter une version avec le correctif (commit `2c5672d8` ou ultérieur).

## Synchronisation du Gateway

### API Non Synchronisée avec le Gateway

**Symptôme** : L'API apparaît comme "Publiée" dans la Console mais n'est pas accessible sur le gateway.

**Liste de vérification** :

1. Synchronisation ArgoCD fonctionnelle ? Vérifier le statut de l'application ArgoCD
2. Adaptateur gateway sain ? `curl ${STOA_API_URL}/v1/gateways` — vérifier `status: online`
3. Statut de synchronisation du déploiement ? Vérifier `sync_status` dans la vue déploiement de la Console
4. Identifiants gateway valides ? Vérifier `auth_config` de l'instance gateway dans le Control Plane

### Dérive Détectée

**Symptôme** : La Console affiche le statut "Drift" pour une API.

La dérive signifie que l'état du gateway diffère de l'état désiré dans le Control Plane. Le moteur de réconciliation le détecte automatiquement. Pour déclencher une re-synchronisation manuelle :

```bash
# Via l'API Control Plane
curl -X POST ${STOA_API_URL}/v1/deployments/{deployment_id}/sync \
  -H "Authorization: Bearer $TOKEN"

# Vérifier le statut de synchronisation du déploiement
curl ${STOA_API_URL}/v1/deployments/{deployment_id} \
  -H "Authorization: Bearer $TOKEN"
```

## Vault

### Vault Scellé

**Symptôme** : L'application retourne des erreurs liées à Vault, les logs affichent `VaultSealedException`.

**Solution** : Desceller Vault en utilisant les clés de déscellement :

```bash
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>
```

Ce problème a été résolu dans CAB-1042 avec la détection automatique de l'état scellé (`_ensure_unsealed()`).

## Performance

### Latence API Élevée

1. Vérifier les temps de requête de base de données : Grafana → tableau de bord Control Plane API
2. Vérifier le lag du consumer Kafka : `kubectl exec redpanda-0 -- rpk group describe stoa-events`
3. Vérifier l'utilisation des ressources des pods : `kubectl top pods -n stoa-system`
4. Examiner les logs de requêtes lentes : Loki → `{app="control-plane-api"} | json | duration > 1s`

### Utilisation Mémoire Élevée

1. Vérifier les fuites de pool de connexions : Surveiller l'utilisation de `DB_POOL_SIZE` dans Prometheus
2. Examiner la configuration du consumer Kafka : Réduire la taille des lots si nécessaire
3. Vérifier si de grandes spécifications API sont chargées en mémoire
