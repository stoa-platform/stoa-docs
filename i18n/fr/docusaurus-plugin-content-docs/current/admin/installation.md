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

Déployez le **STOA Gateway** et ses Custom Resource Definitions Kubernetes à l'aide du chart Helm `charts/stoa-platform` depuis le dépôt `stoa-platform/stoa`. Ce guide couvre les prérequis, l'installation depuis un checkout local, la configuration `values.yaml` et la vérification post-installation.

## Prérequis

| Prérequis | Version | Utilisation |
|-------------|---------|---------|
| Kubernetes | 1.28+ | Orchestration de conteneurs |
| Helm | 3.12+ | Déploiement du chart |
| kubectl | 1.28+ | Gestion du cluster |
| PostgreSQL | 15+ | Base de données du Control Plane (déployée séparément) |
| Keycloak | 26+ | Gestion des identités et des accès — realm unique `stoa` (déployé séparément) |

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

Aucun index Helm public (`charts.gostoa.dev`) ni archive GitHub Release `helm-v*` n'est publié aujourd'hui. Installez directement le chart depuis un checkout de `stoa-platform/stoa`.

Cet exemple minimal installe les ressources du gateway depuis `./charts/stoa-platform` sans monitoring ni hook de synchronisation externe, mais **ne constitue pas un déploiement Ready complet** tant que la configuration des politiques au démarrage ci-dessous n'est pas finalisée :

```bash
# Cloner le monorepo sur une révision vérifiée
git clone https://github.com/stoa-platform/stoa.git
cd stoa
git checkout 639e8b9a2217695cfc2f590e246ed9d4ce4d4913

# Installer le gateway sans monitoring ni hook de synchronisation externe
helm upgrade --install stoa-platform ./charts/stoa-platform \
  -n stoa-system --create-namespace \
  --set stoa.domain="<YOUR_DOMAIN>" \
  --set stoaGateway.keycloakUrl="https://auth.<YOUR_DOMAIN>" \
  --set stoaGateway.controlPlaneUrl="https://api.<YOUR_DOMAIN>" \
  --set stoaGateway.serviceMonitor.enabled=false \
  --set controlPlaneApi.serviceMonitor.enabled=false \
  --set gateway.edgeMcp.enabled=false \
  --set gatewaySync.enabled=false \
  --set stoaGateway.otelEndpoint=""
```

:::note Ce que ce chart installe (périmètre gateway uniquement)
Avec les valeurs par défaut, `charts/stoa-platform` (`v0.1.0`) installe le **STOA Gateway Rust** (Deployment `stoa-gateway` à 2 réplicas, Service ClusterIP port `80` → port conteneur `8080`, ConfigMap `stoa-gateway-policies`), les 5 CRDs de `crds/` lors de l'installation initiale, le CronJob et le hook de synchronisation OpenAPI, trois ServiceMonitors et un Secret interne (`stoa-internal-keys`, généré à l'installation ; sa clé `gateway-consumer-key` est passée au gateway dans `GATEWAY_API_KEYS`). Le chart voisin `charts/stoa-observability` (et le chart parapluie `charts/stoa-stack`) empaquette la télémétrie optionnelle Grafana Alloy, Tempo et Blackbox. L'exemple minimal ci-dessus désactive les ServiceMonitors, l'export OTLP ainsi que le CronJob et le hook de synchronisation. Le paramètre historique `gateway.edgeMcp.enabled` contrôle l'un des ServiceMonitors ; sa désactivation ne désactive pas le gateway Rust (`stoaGateway.enabled`).

L'**API du Control Plane, la Console, le Portail Développeur, Keycloak, PostgreSQL, Redpanda et OpenBao** ne sont **pas** installés par `charts/stoa-platform` (les sections `controlPlaneApi`, `controlPlaneUi`, `portal`, `keycloak` et `vault` ne génèrent que des objets optionnels HPA/PDB/ServiceMonitor/CronJob pour des workloads déployés séparément). Remplacez les placeholders `controlPlaneUrl` et `keycloakUrl` par les URL de services existants. Pour activer l'auto-enregistrement, fournissez aussi la clé `STOA_CONTROL_PLANE_API_KEY` dans le Secret désigné par `stoaGateway.secretName` (voir [Auto-enregistrement du Gateway](/docs/guides/gateway-auto-registration)). Sans cette clé, le gateway fonctionne en mode autonome.

Avant de réactiver les ServiceMonitors, installez les CRDs de Prometheus Operator, dont `servicemonitors.monitoring.coreos.com`. Avant de définir `gatewaySync.enabled=true`, rendez accessibles l'API du Control Plane (`gatewaySync.backendUrl`, endpoints `/health/live` et `/openapi.json`) et l'API d'administration webMethods (`gatewaySync.gatewayUrl`), puis créez le Secret désigné par `gatewaySync.credentialsSecret` avec les clés `username` et `password`. Ce paramètre active aussi un hook Helm post-installation/post-mise à jour ; la synchronisation périodique attend une API existante correspondant à `gatewaySync.apiName` et `gatewaySync.apiVersion`.
:::

### Politiques au Démarrage et Readiness

`stoaGateway.policyBootTenants` (ainsi que `stoaSidecar.policyBootTenants` lorsque le mode sidecar est activé) vaut `[]` par défaut (`charts/stoa-platform/values.yaml`). Lorsque `controlPlaneUrl` est renseigné et que `policyBootTenants` est vide, `/ready` échoue en mode *fail-closed* avec HTTP `503` ([ADR-070 §4](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) et les pods restent `0/1 Ready`, même si les services externes sont accessibles. Le chart sonde `/ready` ; une réponse `200 OK` sur `/health` ou l'auto-enregistrement ne satisfait pas cette condition de readiness.

Configurez directement les tenants de démarrage via `stoaGateway.policyBootTenants` dans `my-values.yaml` (rendu sous forme de variable `STOA_POLICY_BOOT_TENANTS` séparée par des virgules dans `templates/stoa-gateway-deployment.yaml`, sans recourir à `extraEnv`) et passez `-f my-values.yaml` lors de l'installation ou de la mise à jour :

```yaml
stoaGateway:
  policyBootTenants:
    - "<TENANT_ID>"
```

Remplacez `<TENANT_ID>` par chaque tenant existant dont le gateway doit charger les permissions d'outils au démarrage. Lister les tenants seul ne suffit pas : le gateway doit charger une politique d'outils signée complète et fraîche depuis le Control Plane. Fournissez des services Control Plane et Keycloak accessibles, puis configurez le client de service Keycloak du gateway pour l'authentification `private_key_jwt` avec sa clé de signature montée (`STOA_KEYCLOAK_CLIENT_KEY_PATH`, ainsi que `STOA_KEYCLOAK_CLIENT_KEY_ID` si nécessaire via `extraEnv` et un Secret monté). Cette identité de service doit être autorisée à lire les permissions d'outils du tenant. La clé API d'enregistrement et un secret client Keycloak ne remplacent pas cette authentification par clé de signature pour lire les politiques. Si `STOA_POLICY_TRUST_JWKS_FILE` est configuré, son jeu de clés de confiance doit également être chargé avec succès.

Le chargeur de démarrage récupère et actualise les permissions d'outils des tenants en arrière-plan. Des paramètres manquants, un échec du chargement initial ou une politique périmée maintiennent la readiness en échec. N'attendez `1/1 Ready` qu'après le chargement d'une politique fraîche pour chaque tenant listé et la réussite des autres contrôles de readiness, dont la santé du Control Plane et la découverte OIDC lorsqu'elle est activée. Les paramètres `policies.enabled` et `policies.path` du chart ne renseignent pas les tenants de démarrage et ne remplacent pas ce chargement des politiques d'outils.

## Référence du Chart Helm

### Métadonnées du Chart

| Champ | Valeur |
|-------|-------|
| Nom du chart | `stoa-platform` (`charts/stoa-platform`) |
| Version du chart | `0.1.0` |
| Version de l'app | `2.0.0` |
| Type | `application` |

### Vérification et Installation avec Fichier de Valeurs

```bash
# Depuis la racine du dépôt stoa
helm lint ./charts/stoa-platform

helm upgrade --install stoa-platform ./charts/stoa-platform \
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
    digest: sha256:0ea4741d3b83c4de5f5f221a42969e4afbee17ed1d66d40fb92500d77dce991e
    pullPolicy: IfNotPresent
  replicas: 2

  # Condition de readiness sur les politiques au démarrage (ADR-070 §4)
  policyBootTenants: []          # Renseigner les IDs de tenants lorsque controlPlaneUrl est défini

  # OIDC Keycloak
  keycloakUrl: ""                # Requis : https://auth.<YOUR_DOMAIN>
  keycloakRealm: ""              # Vide hérite de keycloak.realm ("stoa")
  keycloakClientId: stoa-mcp-gateway

  # Connexion au Control Plane
  controlPlaneUrl: "http://stoa-control-plane-api.stoa-system.svc.cluster.local:8000"

  # Mode du gateway (ADR-024)
  mode: edge-mcp                 # Supportés par le runtime Rust : edge-mcp, sidecar, proxy, shadow

  # Auto-enregistrement (ADR-036)
  autoRegister: true
  environment: ""                # Vide hérite de global.environment ("dev")

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
  logLevel: info                 # Options : trace, debug, info, warn, error
  logFormat: json                # Options : json, pretty, compact
```

Le helper `templates/_helpers.tpl` (`stoa-platform.pinnedImage`) exige **à la fois** `image.repository` et `image.digest` (`sha256:` suivi de 64 caractères hexadécimaux en minuscules) et génère `image: "<repository>@<digest>"`. Le champ `image.tag` est ignoré par le template, et un digest absent ou mal formé fait échouer `helm template` / `helm install`.

Le commentaire du chart mentionne aussi `connect`, mais le runtime Rust ne l'accepte pas pour `STOA_GATEWAY_MODE` (utilisez le binaire Go `stoa-connect` pour STOA Link). Utilisez `edge-mcp`, `sidecar`, `proxy` ou `shadow` pour `stoaGateway.mode`.

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

Pour déployer aux côtés de gateways tiers dans le même pod Kubernetes (`stoaSidecar.mainGateway.enabled=true` est requis lorsque `stoaSidecar.enabled=true`, et les deux images doivent définir `repository` et `digest`) :

```yaml
stoaSidecar:
  enabled: false
  targetGateway: webmethods    # Options : webmethods, kong, gravitee, agentgateway, apigee, aws_apigateway, azure_apim
  policyBootTenants: []        # Mêmes règles fail-closed que stoaGateway.policyBootTenants
  image:
    repository: ghcr.io/stoa-platform/stoa-gateway
    digest: sha256:0ea4741d3b83c4de5f5f221a42969e4afbee17ed1d66d40fb92500d77dce991e
  mainGateway:
    enabled: true
    image:
      repository: "<YOUR_GATEWAY_IMAGE_REPO>"
      digest: "sha256:<64_HEX_DIGEST>"
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

Sortie attendue pour l’exemple minimal avant la configuration des politiques au démarrage :

```
NAME                                 READY   STATUS    RESTARTS   AGE
stoa-gateway-<REPLICASET>-<POD_1>      0/1     Running   0          <AGE>
stoa-gateway-<REPLICASET>-<POD_2>      0/1     Running   0          <AGE>
```

Après la configuration des politiques au démarrage et la réussite de tous les contrôles de readiness, la colonne `READY` doit passer à `1/1` pour chaque pod. `/health` ci-dessous vérifie uniquement la liveness ; il peut renvoyer `OK` alors que `/ready` renvoie HTTP 503.

### 2. Vérifier la Santé du Gateway

<EnvSetup />

```bash
curl --fail --silent --show-error "${STOA_GATEWAY_URL}/health"
```

Attendu :

```text
OK
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

Suivez le [Guide de mise à jour](/docs/admin/upgrade) et le [Cycle de maintenance](/docs/admin/maintenance). Depuis votre checkout du dépôt `stoa` sur la révision cible :

```bash
git fetch origin
git checkout <TARGET_COMMIT_OR_TAG>

# Appliquer les CRDs AVANT la mise à jour Helm (Helm ne met pas à jour les CRDs existants)
kubectl apply -f ./charts/stoa-platform/crds/

helm upgrade stoa-platform ./charts/stoa-platform \
  -n stoa-system \
  -f my-values.yaml
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
