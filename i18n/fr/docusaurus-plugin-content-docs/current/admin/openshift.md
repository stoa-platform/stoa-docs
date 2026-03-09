---
sidebar_position: 7
title: "Déploiement OpenShift"
description: "Déployer la Plateforme STOA sur Red Hat OpenShift — Routes, SecurityContextConstraints, compatibilité Operator et configuration spécifique OCP."
keywords:
  - OpenShift
  - OCP
  - Routes
  - SCC
  - Red Hat
---

# Déploiement OpenShift

La Plateforme STOA fonctionne sur Red Hat OpenShift (4.12+) avec quelques ajustements de configuration mineurs. Ce guide couvre les différences par rapport à Kubernetes standard.

## Différences Clés avec Kubernetes

| Fonctionnalité | Kubernetes | OpenShift |
|----------------|-----------|-----------|
| Ingress | Ressource `Ingress` | Ressource `Route` (ou Ingress via HAProxy) |
| Sécurité | PodSecurityStandards | SecurityContextConstraints (SCC) |
| Registry | N'importe quel (GHCR, ECR) | Registry interne + pull secrets |
| TLS | cert-manager | OpenShift intégré ou cert-manager |
| Réseau | Calico/Cilium | OVN-Kubernetes (par défaut) |

## Routes (À la Place d'Ingress)

Remplacez les Ingress Kubernetes par des Routes OpenShift :

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: stoa-gateway
  namespace: stoa-system
spec:
  host: mcp.<VOTRE_DOMAINE>
  to:
    kind: Service
    name: stoa-gateway
    weight: 100
  port:
    targetPort: http
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

Créez des routes pour chaque service :

| Service | Hôte | Port Cible |
|---------|------|------------|
| Gateway | `mcp.<VOTRE_DOMAINE>` | `http` (8080) |
| API | `api.<VOTRE_DOMAINE>` | `http` (8000) |
| Console | `console.<VOTRE_DOMAINE>` | `http` (8080) |
| Portail | `portal.<VOTRE_DOMAINE>` | `http` (8080) |
| Keycloak | `auth.<VOTRE_DOMAINE>` | `http` (8080) |

### Surcharge Helm

Désactivez Ingress et utilisez des Routes à la place :

```yaml
# values-openshift.yaml
stoaGateway:
  ingress:
    enabled: false

# Appliquez les routes séparément
# kubectl apply -f openshift/routes/
```

## SecurityContextConstraints

Les conteneurs STOA s'exécutent sans droits root avec le SCC `restricted-v2` (défaut OpenShift pour les nouveaux projets).

### Vérifier la Compatibilité SCC

```bash
# Vérifier quel SCC est assigné
oc get pods -n stoa-system -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.annotations.openshift\.io/scc}{"\n"}{end}'
```

Tous les conteneurs STOA doivent s'exécuter sous `restricted-v2`. Si les pods ne se planifient pas :

```bash
# Accorder restricted-v2 explicitement (généralement non nécessaire)
oc adm policy add-scc-to-user restricted-v2 \
  -z default -n stoa-system
```

### Prérequis des Conteneurs

Les conteneurs STOA sont déjà compatibles avec `restricted-v2` :

- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `capabilities.drop: [ALL]`
- Pas de réseau hôte ni de mode privilégié

## Configuration des Images

Si vous utilisez le registry interne OpenShift :

```bash
# Tagger et pousser vers le registry interne
oc registry login
docker tag ghcr.io/stoa-platform/stoa-gateway:latest \
  image-registry.openshift-image-registry.svc:5000/stoa-system/stoa-gateway:latest
docker push image-registry.openshift-image-registry.svc:5000/stoa-system/stoa-gateway:latest
```

Ou configurez un pull secret pour GHCR :

```bash
oc create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<GITHUB_USER> \
  --docker-password=<GITHUB_TOKEN> \
  -n stoa-system

oc secrets link default ghcr-pull-secret --for=pull -n stoa-system
```

## Compatibilité des Operators

STOA fonctionne avec ces Operators OpenShift :

| Operator | Objectif | Notes |
|----------|---------|-------|
| **Keycloak Operator** (RHSSO) | Gestion des identités | À utiliser à la place de Keycloak autonome |
| **Prometheus Operator** | Monitoring | Inclus dans le Monitoring OpenShift |
| **Elasticsearch Operator** | Journalisation | Pour remplacer OpenSearch |
| **cert-manager Operator** | Certificats TLS | Disponible depuis OperatorHub |

### Utiliser le Monitoring OpenShift

OpenShift inclut une stack Prometheus intégrée. Activez le monitoring des workloads utilisateur :

```yaml
# ConfigMap cluster-monitoring-config
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
data:
  config.yaml: |
    enableUserWorkload: true
```

Les ServiceMonitors de STOA seront automatiquement découverts par l'instance Prometheus des workloads utilisateur.

## Installation sur OpenShift

```bash
# Créer le projet
oc new-project stoa-system

# Appliquer les CRDs
oc apply -f charts/stoa-platform/crds/

# Installer avec les valeurs spécifiques OpenShift
helm install stoa-platform ./charts/stoa-platform \
  -n stoa-system \
  -f values-openshift.yaml

# Créer les routes
oc apply -f openshift/routes/
```

## Dépannage

| Problème | Cause | Solution |
|---------|-------|---------|
| Pod `CrashLoopBackOff` | Violation SCC | Vérifier `oc describe pod` pour les erreurs SCC |
| Route inaccessible | Mauvaise terminaison TLS | Utiliser `edge` pour les backends HTTPS derrière HTTP |
| Échec de récupération d'image | Pas de pull secret | Créer et lier `ghcr-pull-secret` |
| ServiceMonitor introuvable | Monitoring workload utilisateur désactivé | Activer dans `cluster-monitoring-config` |
| Politique réseau bloque le trafic | Syntaxe OVN-Kubernetes vs Calico | Utiliser `networking.k8s.io/v1` (standard) |

## Voir Aussi

- [Guide d'Installation](/docs/admin/installation) -- Déploiement Kubernetes standard
- [Durcissement Sécurité](/docs/admin/security-hardening) -- Configuration sécurité
- [Monitoring & Alerting](/docs/admin/monitoring) -- Configuration Prometheus
