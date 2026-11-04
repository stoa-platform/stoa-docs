---
sidebar_position: 1
title: "Guide d'Installation"
description: "Déployer la Plateforme STOA sur Kubernetes — prérequis, installation du chart Helm, référence des valeurs, CRDs et vérification post-installation."
keywords:
  - STOA installation
  - Helm chart
  - Kubernetes deployment
  - API gateway setup
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Guide d'Installation

Déployez la Plateforme STOA sur n'importe quel cluster Kubernetes avec Helm. Ce guide couvre les prérequis, l'installation du chart, la configuration et la vérification post-installation.

## Prérequis

| Prérequis | Version | Utilisation |
|-------------|---------|---------|
| Kubernetes | 1.28+ | Orchestration de conteneurs |
| Helm | 3.12+ | Déploiement du chart |
| kubectl | 1.28+ | Gestion du cluster |
| PostgreSQL | 15+ | Base de données du Control Plane |
| Keycloak | 24+ | Gestion des identités et des accès |

### Composants Optionnels

| Composant | Version | Utilisation |
|-----------|---------|---------|
| Prometheus | 2.50+ | Collecte de métriques |
| Grafana | 10+ | Visualisation des tableaux de bord |
| OpenSearch | 2.11+ | Logs d'audit et recherche |
| Redpanda/Kafka | 23.3+ | Streaming d'événements (métering) |

### Ressources Requises

| Profil | Nœuds | CPU (total) | RAM (total) | Cas d'usage |
|---------|-------|-------------|-------------|----------|
| **Starter** | 1 | 4 vCPU | 8 Go | Développement, évaluation |
| **Standard** | 3 | 12 vCPU | 24 Go | Production modeste |
| **Enterprise** | 5+ | 24+ vCPU | 48+ Go | Production à grande échelle |

Consultez [Ressources Matérielles](/docs/reference/hardware-requirements) pour des recommandations de dimensionnement détaillées.

## Installation Rapide

```bash
# Ajouter le dépôt Helm STOA
helm repo add stoa https://charts.gostoa.dev
helm repo update

# Créer le namespace
kubectl create namespace stoa-system

# Install the gateway without monitoring or the external gateway sync hook
helm install stoa-platform stoa/stoa-platform \
  -n stoa-system \
  --set stoa.domain="<YOUR_DOMAIN>" \
  --set stoaGateway.keycloakUrl="https://auth.<YOUR_DOMAIN>" \
  --set stoaGateway.controlPlaneUrl="https://api.<YOUR_DOMAIN>" \
  --set stoaGateway.serviceMonitor.enabled=false \
  --set controlPlaneApi.serviceMonitor.enabled=false \
  --set gateway.edgeMcp.enabled=false \
  --set gatewaySync.enabled=false
```

:::note Ce que ce chart installe
Avec les valeurs par défaut, le chart `stoa-platform` installe le **STOA Gateway** (Deployment, Service, ConfigMap des politiques), le CronJob et le hook de synchronisation OpenAPI du gateway, trois ServiceMonitors et un Secret interne (`stoa-internal-keys`, généré à l'installation ; sa clé `gateway-consumer-key` est passée au gateway dans `GATEWAY_API_KEYS`). L'exemple minimal ci-dessus désactive les ServiceMonitors ainsi que le CronJob et le hook de synchronisation. Le paramètre historique `gateway.edgeMcp.enabled` contrôle l'un des ServiceMonitors ; sa désactivation ne désactive pas le gateway Rust.

L'API du Control Plane, la Console, le Portail et Keycloak ne sont **pas** installés par ce chart : remplacez les placeholders `controlPlaneUrl` et `keycloakUrl` par les URL de services existants. Pour activer l'auto-enregistrement, fournissez aussi la clé `STOA_CONTROL_PLANE_API_KEY` dans le Secret désigné par `stoaGateway.secretName` (voir [Auto-enregistrement du Gateway](/docs/guides/gateway-auto-registration)). Sans cette clé, le gateway fonctionne en mode autonome.

Avant de réactiver les ServiceMonitors, installez les CRDs de Prometheus Operator, dont `servicemonitors.monitoring.coreos.com`. Avant de définir `gatewaySync.enabled=true`, rendez accessibles l'API du Control Plane (`gatewaySync.backendUrl`, endpoints `/health/live` et `/openapi.json`) et l'API d'administration webMethods (`gatewaySync.gatewayUrl`), puis créez le Secret désigné par `gatewaySync.credentialsSecret` avec les clés `username` et `password`. Ce paramètre active aussi un hook Helm post-installation/post-mise à jour ; la synchronisation périodique attend une API existante correspondant à `gatewaySync.apiName` et `gatewaySync.apiVersion`.
:::

## Référence du Chart Helm

### Métadonnées du Chart

| Champ | Valeur |
|-------|-------|
| Nom du chart | `stoa-platform` |
| Version du chart | `0.1.0` |
| Version de l'app | `2.0.0` |
| Type | `application` |

### Installation depuis les Sources

```bash
# Cloner le dépôt
git clone https://github.com/stoa-platform/stoa.git
cd stoa

# Vérifier le chart
helm lint charts/stoa-platform

# Installer depuis le chart local
helm install stoa-platform ./charts/stoa-platform \
  -n stoa-system \
  --create-namespace \
  -f my-values.yaml
```

## Référence des Valeurs

### STOA Gateway (Rust)

Le gateway de production principal. Gère le protocole MCP, l'authentification JWT, le rate limiting et le proxying d'API.

```yaml
stoaGateway:
  enabled: true
  image:
    repository: ghcr.io/stoa-platform/stoa-gateway
    tag: latest                 # Pin an immutable tag to reliably restore the previous image
  replicas: 2

  # OIDC Keycloak
  keycloakUrl: ""              # Requis : https://auth.<YOUR_DOMAIN>
  keycloakRealm: stoa
  keycloakClientId: stoa-mcp-gateway

  # Connexion au Control Plane
  controlPlaneUrl: "http://stoa-control-plane-api.stoa-system.svc.cluster.local:80"

  # Mode du gateway (ADR-024)
  mode: edge-mcp               # Options : edge-mcp, sidecar, proxy, shadow, connect

  # Auto-enregistrement (ADR-028)
  autoRegister: true
  environment: dev              # Options : dev, staging, prod

  # Ressources
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi

  # Secrets
  secretName: stoa-gateway-secrets

  # Logs
  logLevel: info                # Options : trace, debug, info, warn, error
  logFormat: json               # Options: json, pretty, compact
```

Helm peut restaurer la configuration et les autres ressources, mais un tag mutable ne permet pas de restaurer de manière fiable la version précédente de l'image.

### Politiques OPA

```yaml
stoaGateway:
  policies:
    enabled: true
    path: /etc/stoa/policies/default.rego
```

### Métering Kafka/Redpanda

```yaml
stoaGateway:
  kafka:
    enabled: false
    brokers: "redpanda.stoa-system.svc.cluster.local:9092"
    meteringTopic: stoa.metering
    errorsTopic: stoa.errors
```

### Watcher Kubernetes

```yaml
stoaGateway:
  k8s:
    enabled: false              # Activer la surveillance CRD pour Tool/ToolSet
```

### ServiceMonitor (Prometheus)

```yaml
stoaGateway:
  serviceMonitor:
    enabled: true
    interval: 15s
    scrapeTimeout: 10s
```

### Mode Sidecar

Pour déployer aux côtés de gateways tiers (Kong, webMethods, Gravitee) :

```yaml
stoaSidecar:
  enabled: false
  targetGateway: webmethods    # Options : webmethods, kong, gravitee, agentgateway, apigee, aws_apigateway, azure_apim
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 256Mi
```

### OIDC Grafana

```yaml
grafana:
  oidc:
    enabled: false
    clientId: stoa-observability
    roleAttributePath: "contains(roles[*], 'stoa:admin') && 'Admin' || 'Viewer'"
    rootUrl: "https://grafana.<YOUR_DOMAIN>"
```

### CronJob de Synchronisation OpenAPI

```yaml
gatewaySync:
  enabled: true
  schedule: "0 */6 * * *"      # Toutes les 6 heures
```

## Définitions de Ressources Personnalisées (CRDs)

STOA fournit 5 CRDs (Tool, ToolSet, GatewayInstance, GatewayBinding et Skill) qui doivent être appliqués avant ou en même temps que le chart Helm :

```bash
kubectl apply -f charts/stoa-platform/crds/
```

### CRD Tool (`tools.gostoa.dev/v1alpha1`)

Définit un outil API individuel pour l'exposition MCP :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: billing-list-invoices
  namespace: <TENANT_NAMESPACE>
spec:
  displayName: List Invoices
  description: Retrieve all invoices for the current billing period
  endpoint: https://billing.<YOUR_DOMAIN>/v1/invoices
  method: GET
  inputSchema:
    type: object
    properties:
      status:
        type: string
        enum: [paid, pending, overdue]
  auth: bearer
  rateLimit: "100/min"
  annotations:
    readOnly: true
    idempotent: true
```

### CRD ToolSet (`toolsets.gostoa.dev/v1alpha1`)

Fédère des outils depuis un serveur MCP amont :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: internal-mcp-server
  namespace: <TENANT_NAMESPACE>
spec:
  upstream:
    url: https://mcp.<YOUR_DOMAIN>/mcp/sse
    transport: sse
    auth:
      type: bearer
      secretRef: mcp-server-token
    timeoutSeconds: 30
  tools: []                     # Vide = découvrir tous les outils
  prefix: internal              # Préfixe des noms d'outils : internal_*
```

### CRD GatewayInstance (`gatewayinstances.gostoa.dev/v1alpha1`)

Enregistre une instance de gateway pour l'orchestration multi-gateway :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: GatewayInstance
metadata:
  name: kong-production
  namespace: stoa-system
spec:
  displayName: Kong Production
  gatewayType: kong
  environment: prod
  baseUrl: https://kong-admin.<YOUR_DOMAIN>:8001
  capabilities: [rest, rate_limiting]
  mode: edge-mcp
```

### CRD GatewayBinding (`gatewaybindings.gostoa.dev/v1alpha1`)

Associe une API à une instance de gateway avec des politiques :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: GatewayBinding
metadata:
  name: billing-api-kong
  namespace: stoa-system
spec:
  apiRef:
    name: billing-api
    version: v1
  gatewayRef:
    name: kong-production
  policies:
    - name: rate-limit
      type: rate_limit
      config:
        per_second: 100
        per_minute: 5000
```

### CRD Skill (`skills.gostoa.dev/v1alpha1`)

Définit des instructions d'agent avec une portée explicite :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Skill
metadata:
  name: api-guidance
  namespace: <TENANT_NAMESPACE>
spec:
  name: API Guidance
  scope: tenant
  instructions: Use the documented API contracts when selecting tools.
  enabled: true
```

## Vérification Post-Installation

### 1. Vérifier l'État des Pods

```bash
kubectl get pods -n stoa-system
```

Sortie attendue :

```
NAME                                 READY   STATUS    RESTARTS   AGE
stoa-gateway-<REPLICASET>-<POD_1>      1/1     Running   0          <AGE>
stoa-gateway-<REPLICASET>-<POD_2>      1/1     Running   0          <AGE>
```

### 2. Vérifier la Santé du Gateway

<EnvSetup />

```bash
curl -s "${STOA_GATEWAY_URL}/health" | jq
```

Attendu :

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "mode": "edge-mcp"
}
```

### 3. Vérifier les CRDs

```bash
kubectl get crd | grep gostoa.dev
```

Attendu :

```
gatewaybindings.gostoa.dev    <CREATED_AT>
gatewayinstances.gostoa.dev   <CREATED_AT>
skills.gostoa.dev             <CREATED_AT>
tools.gostoa.dev              <CREATED_AT>
toolsets.gostoa.dev           <CREATED_AT>
```

### 4. Vérifier l'Endpoint de Métriques

```bash
curl -s "${STOA_GATEWAY_URL}/metrics" | head -5
```

Vous devriez voir des métriques au format Prometheus commençant par `stoa_`.

## Mise à Jour

```bash
helm repo update
helm upgrade stoa-platform stoa/stoa-platform \
  -n stoa-system \
  -f my-values.yaml
```

Les mises à jour des CRDs nécessitent une application manuelle (Helm ne met pas à jour les CRDs automatiquement) :

```bash
kubectl apply -f charts/stoa-platform/crds/
```

## Désinstallation

```bash
helm uninstall stoa-platform -n stoa-system
kubectl delete namespace stoa-system

# Optionnel : supprimer les CRDs (détruit toutes les ressources personnalisées)
kubectl delete crd tools.gostoa.dev toolsets.gostoa.dev \
  gatewayinstances.gostoa.dev gatewaybindings.gostoa.dev skills.gostoa.dev
```

## Dépannage

| Problème | Cause | Solution |
|---------|-------|-----|
| Pod `CrashLoopBackOff` | Variables d'env ou secrets manquants | Vérifier `kubectl logs` et que `secretName` existe |
| Gateway `503` au démarrage | URL Keycloak inaccessible | Vérifier que `keycloakUrl` se résout depuis le cluster |
| CRDs introuvables | CRDs non appliqués | Exécuter `kubectl apply -f charts/stoa-platform/crds/` |
| Métriques non collectées | Labels ServiceMonitor incorrects | Vérifier que le label `prometheus: kube-prometheus-stack` correspond |
| Gateway sidecar inaccessible | NetworkPolicy bloquante | Vérifier `kubectl get networkpolicy -n stoa-system` |

## Voir Aussi

- [Administration Keycloak](/docs/admin/keycloak) -- Configuration du realm et des clients OIDC
- [Monitoring & Alerting](/docs/admin/monitoring) -- Prometheus, Grafana et alertes
- [Ressources Matérielles](/docs/reference/hardware-requirements) -- Guide de dimensionnement
- [Référence de Configuration](/docs/reference/configuration) -- Variables d'environnement
- [Déploiement Hybride](/docs/deployment/hybrid) -- Architecture multi-cloud
