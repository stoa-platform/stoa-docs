---
slug: kubernetes-native-api-gateway-patterns
title: "Patterns d'API Gateway Kubernetes : de l'Ingress au MCP (2026)"
description: "Quatre patterns de gateway Kubernetes comparés : Ingress, Gateway API, sidecar et MCP gateway. Diagrammes d'architecture et guide de sélection."
authors: [stoa-team]
tags: [tutorial, api-gateway, architecture]
keywords:
  - kubernetes native api gateway patterns
  - kubernetes api gateway architecture
  - gateway api vs ingress controller
  - k8s api gateway best practices
  - cloud native api management
---
<!-- last verified: 2026-02 -->

Les patterns d'API gateway natifs Kubernetes ont évolué de simples contrôleurs Ingress vers des architectures multi-modes sophistiquées prenant en charge les agents IA, l'intégration service mesh et les workflows GitOps. Ce guide couvre les quatre patterns essentiels — Ingress Controller, Gateway API, sidecar gateway et MCP gateway — avec des diagrammes d'architecture, des exemples d'implémentation et un cadre de décision pour choisir le bon pattern selon votre cas d'usage.

<!-- truncate -->

## Introduction : pourquoi le natif Kubernetes est important

Lorsque les organisations migrent leurs workloads vers Kubernetes, l'API gateway devient une pièce d'infrastructure critique. Les API gateways traditionnels ont été conçus pour des VMs et des serveurs physiques — ils ne comprennent pas les Pods, les Services ni les Custom Resource Definitions (CRDs). Un **API gateway natif Kubernetes** exploite les primitives K8s pour la configuration, la découverte et la gestion du cycle de vie, permettant :

- **Configuration déclarative** via des manifestes YAML (compatible GitOps)
- **Découverte automatique des services** via les ressources Service K8s
- **Scaling dynamique** avec HorizontalPodAutoscaler
- **Multi-tenancy** via les Namespaces et RBAC
- **Intégration d'observabilité** avec Prometheus, OpenTelemetry et les événements K8s

Ce tutoriel explore quatre patterns architecturaux, du fondamental (Ingress Controller) au plus avancé (MCP Gateway pour les agents IA).

## Pattern 1 : Ingress Controller — les fondations

Le pattern **Ingress Controller** est le point d'entrée le plus courant pour le trafic HTTP dans Kubernetes. Introduit en K8s v1.1, il utilise la ressource `Ingress` pour définir les règles de routage.

### Architecture

```
                    ┌─────────────────┐
  Internet ────────▶│ LoadBalancer    │ (Cloud LB ou MetalLB)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Ingress         │
                    │ Controller      │ (nginx, Traefik, HAProxy)
                    │ (Deployment)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │ Service │    │ Service │    │ Service │
         │   A     │    │   B     │    │   C     │
         └─────────┘    └─────────┘    └─────────┘
```

### Exemple de manifeste

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /users
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80
      - path: /orders
        pathType: Prefix
        backend:
          service:
            name: order-service
            port:
              number: 80
```

### Caractéristiques

| Fonctionnalité | Support |
|----------------|---------|
| **Routage HTTP** | ✅ Basé sur l'hôte + le path |
| **Terminaison TLS** | ✅ Via cert-manager |
| **Rate limiting** | ⚠️ Annotations spécifiques au contrôleur |
| **Authentification** | ⚠️ Plugins d'auth externes |
| **Multi-protocoles** | ❌ HTTP/HTTPS uniquement |
| **Intégration service mesh** | ❌ Pas de support natif |

### Cas d'usage

- Routage HTTP simple pour les applications web
- Terminaison TLS avec Let's Encrypt (cert-manager)
- Routage basé sur le path sans politiques complexes
- Équipes familières avec la configuration nginx ou Traefik

### Limitations

La ressource Ingress est **limitée à HTTP Layer 7** et ne supporte pas nativement :
- Routage TCP/UDP
- Répartition de trafic avancée (canary, pondéré)
- Routage inter-namespaces (nécessite des astuces IngressClass)
- Application de politiques (rate limiting, CORS) sans annotations du fournisseur

C'est ce qui a conduit le Kubernetes SIG Network à concevoir la **Gateway API**.

## Pattern 2 : Gateway API — le standard

La **Gateway API** (anciennement Ingress v2) est un projet Kubernetes SIG qui adresse les limitations d'Ingress avec une API orientée rôles et extensible. Elle sépare les préoccupations entre l'infrastructure (GatewayClass), le cluster (Gateway) et l'application (HTTPRoute, TCPRoute).

### Architecture

```
                    ┌─────────────────┐
  Internet ────────▶│ LoadBalancer    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Gateway         │ (GatewayClass: istio, cilium, kong)
                    │ (Infrastructure)│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │HTTPRoute│    │TCPRoute │    │TLSRoute │
         │ (App A) │    │ (App B) │    │ (App C) │
         └────┬────┘    └────┬────┘    └────┬────┘
              │              │              │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │ Service │    │ Service │    │ Service │
         └─────────┘    └─────────┘    └─────────┘
```

### Exemples de manifestes

**GatewayClass** (scope cluster, géré par l'équipe plateforme) :

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: production-gateway
spec:
  controllerName: stoa.dev/gateway-controller
```

**Gateway** (scope namespace, configuration infrastructure) :

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: api-gateway
  namespace: infra
spec:
  gatewayClassName: production-gateway
  listeners:
  - name: http
    protocol: HTTP
    port: 80
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      certificateRefs:
      - name: api-tls-cert
```

**HTTPRoute** (scope namespace, configuration app) :

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: user-api-route
  namespace: apps
spec:
  parentRefs:
  - name: api-gateway
    namespace: infra
  hostnames:
  - "api.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /users
    backendRefs:
    - name: user-service
      port: 80
      weight: 90
    - name: user-service-canary
      port: 80
      weight: 10
```

### Caractéristiques

| Fonctionnalité | Support |
|----------------|---------|
| **Routage HTTP/TCP/TLS** | ✅ Multi-protocoles via Routes |
| **Répartition de trafic** | ✅ Backends pondérés (canary) |
| **Inter-namespaces** | ✅ ReferenceGrant pour la sécurité |
| **Basé sur les rôles** | ✅ GatewayClass (infra) vs HTTPRoute (app) |
| **Extensibilité** | ✅ PolicyAttachment pour les politiques personnalisées |
| **Neutre fournisseur** | ✅ API standard, implémentations multiples |

### Cas d'usage

- Environnements multi-tenant (isolation par namespace)
- Gestion avancée du trafic (canary, blue-green)
- Équipes plateforme fournissant du routage en self-service aux équipes app
- Organisations migrant depuis un ingress spécifique au cloud (ALB, GCE)

### Implémentation avec STOA

STOA supporte la Gateway API via le **mode proxy** (ADR-024). Le contrôleur de gateway surveille les ressources `HTTPRoute` et les synchronise vers le control plane de STOA :

```bash
# Déployer STOA en mode proxy
helm install stoa-gateway stoa-platform/stoa-platform \
  --set gateway.mode=proxy \
  --set gateway.gatewayClass=stoa
```

Pour en savoir plus, consultez le [guide des modes Gateway](/docs/guides/gateway-modes).

## Pattern 3 : Sidecar Gateway — style service mesh

Le pattern **sidecar gateway** déploie une instance légère de gateway aux côtés de chaque Pod applicatif. Popularisé par les service meshes (Istio, Linkerd), il fournit une application de politiques et une observabilité par service.

### Architecture

```
                    ┌─────────────────┐
  Internet ────────▶│ Edge Gateway    │ (Point d'entrée central)
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼──────────┐  │  ┌───────────▼─────┐
         │ Pod A         │  │  │ Pod B            │
         │ ┌──────────┐  │  │  │ ┌──────────┐    │
         │ │App       │  │  │  │ │App       │    │
         │ │Container │  │  │  │ │Container │    │
         │ └────▲─────┘  │  │  │ └────▲─────┘    │
         │      │        │  │  │      │          │
         │ ┌────▼─────┐  │  │  │ ┌────▼─────┐    │
         │ │Sidecar   │  │  │  │ │Sidecar   │    │
         │ │Gateway   │◀─┼──┼──┼▶│Gateway   │    │
         │ └──────────┘  │  │  │ └──────────┘    │
         └───────────────┘  │  └─────────────────┘
                            │
                       ┌────▼──────────┐
                       │ Pod C         │
                       │ ┌──────────┐  │
                       │ │App       │  │
                       │ │Container │  │
                       │ └────▲─────┘  │
                       │      │        │
                       │ ┌────▼─────┐  │
                       │ │Sidecar   │  │
                       │ │Gateway   │  │
                       │ └──────────┘  │
                       └───────────────┘
```

### Déploiement avec Mutating Webhook

Les service meshes injectent le sidecar automatiquement via une MutatingWebhookConfiguration :

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: stoa-sidecar-injector
webhooks:
- name: sidecar.stoa.dev
  clientConfig:
    service:
      name: stoa-injector
      namespace: stoa-system
      path: /inject
  rules:
  - operations: ["CREATE"]
    apiGroups: [""]
    apiVersions: ["v1"]
    resources: ["pods"]
  namespaceSelector:
    matchLabels:
      stoa-injection: enabled
```

Quand un Pod est créé dans un namespace labellisé, le webhook ajoute un container sidecar :

```yaml
# Spec Pod originale
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  containers:
  - name: app
    image: my-app:1.0

# Après injection (simplifié)
spec:
  containers:
  - name: app
    image: my-app:1.0
  - name: stoa-sidecar
    image: ghcr.io/stoa-platform/stoa-gateway:latest
    env:
    - name: GATEWAY_MODE
      value: sidecar
    - name: UPSTREAM_URL
      value: http://localhost:8080
```

### Caractéristiques

| Fonctionnalité | Support |
|----------------|---------|
| **Zéro config pour les apps** | ✅ Proxy transparent |
| **Politiques granulaires** | ✅ Rate limiting par pod, mTLS |
| **Observabilité** | ✅ Métriques par requête |
| **Overhead de ressources** | ⚠️ N sidecars = N × mémoire |
| **Complexité de mise à jour** | ⚠️ Nécessite un rolling restart de tous les Pods |

### Cas d'usage

- Microservices avec des limites de sécurité strictes (mTLS par service)
- Rate limiting ou circuit breaking par service
- Organisations utilisant déjà un service mesh
- Déploiement progressif des politiques gateway (sidecar uniquement dans les namespaces labellisés)

### Mode sidecar STOA

Le mode sidecar de STOA (ADR-024) fournit :
- Injection automatique de token OIDC depuis le ServiceAccount Kubernetes
- Metering par service (utilisation suivie par label de pod)
- Traduction du protocole MCP au niveau du pod

Consultez le [déploiement hybride](/docs/deployment/hybrid) pour les stratégies multi-modes.

## Pattern 4 : MCP Gateway — le pattern natif IA

Le pattern **MCP Gateway** étend les API gateways natifs Kubernetes pour supporter le [Model Context Protocol (MCP)](/blog/what-is-mcp-gateway), permettant aux agents IA de découvrir et d'invoquer des APIs backend via une interface standardisée.

### Architecture

```
                    ┌─────────────────┐
  Agent IA ────────▶│ MCP Gateway     │ (Traducteur de protocole)
  (Claude, GPT)     │ (mode edge-mcp) │
                    └────────┬────────┘
                             │
                             │ Découvre les Services K8s
                             │ via CRDs (Tool, ToolSet)
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │ Tool    │    │ Tool    │    │ Tool    │
         │ CRD     │    │ CRD     │    │ CRD     │
         │(users)  │    │(orders) │    │ (pay)   │
         └────┬────┘    └────┬────┘    └────┬────┘
              │              │              │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │ Service │    │ Service │    │ Service │
         │  HTTP   │    │  HTTP   │    │  HTTP   │
         └─────────┘    └─────────┘    └─────────┘
```

### Exemple de CRD

Le MCP gateway surveille les ressources personnalisées `Tool` pour auto-découvrir les APIs :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: user-lookup
  namespace: tenant-acme
spec:
  displayName: "User Lookup API"
  description: "Retrieve user profile by ID or email"
  endpoint: http://user-service.apps.svc.cluster.local/api/v1/users
  method: GET
  parameters:
    - name: user_id
      type: string
      required: false
    - name: email
      type: string
      required: false
  authentication:
    type: oauth2
    tokenEndpoint: https://auth.example.com/oauth/token
  responseSchema:
    type: object
    properties:
      id:
        type: string
      email:
        type: string
      created_at:
        type: string
        format: date-time
```

Quand un agent IA se connecte au MCP gateway, il reçoit ce Tool sous la forme :

```json
{
  "tools": [
    {
      "name": "user_lookup",
      "description": "Retrieve user profile by ID or email",
      "inputSchema": {
        "type": "object",
        "properties": {
          "user_id": {"type": "string"},
          "email": {"type": "string"}
        }
      }
    }
  ]
}
```

L'agent peut ensuite invoquer le tool :

```json
{
  "method": "tools/call",
  "params": {
    "name": "user_lookup",
    "arguments": {
      "email": "alice@example.com"
    }
  }
}
```

Le MCP gateway traduit cela en :

```bash
GET http://user-service.apps.svc.cluster.local/api/v1/users?email=alice@example.com
Authorization: Bearer <token-from-oauth2>
```

### Caractéristiques

| Fonctionnalité | Support |
|----------------|---------|
| **Découverte par agents IA** | ✅ Protocole MCP + CRDs K8s |
| **Bridge APIs legacy** | ✅ Traduction REST/SOAP → MCP |
| **Auth automatique** | ✅ Injection OAuth2, API key, mTLS |
| **Multi-tenant** | ✅ Tools scopés par namespace |
| **Compatible GitOps** | ✅ Manifestes Tool déclaratifs |

### Cas d'usage

- [Connecter les agents IA aux APIs enterprise](/blog/connecting-ai-agents-enterprise-apis)
- Exposer les APIs legacy webMethods, Oracle ou MuleSoft aux LLMs
- Plateformes SaaS multi-tenant avec catalogues d'API par tenant
- Organisations construisant des workflows pilotés par IA (migration RPA → agent IA)

### Mode Edge-MCP STOA

Le mode `edge-mcp` par défaut de STOA (ADR-024) fonctionne comme gateway central qui :
- Surveille les CRDs `Tool` et `ToolSet` dans tous les namespaces tenant
- Applique les quotas et rate limiting par consommateur (suivis via le CRD `Subscription`)
- Journalise tous les appels agent-vers-API dans OpenSearch pour l'audit de conformité

```bash
# Déployer STOA en mode edge-mcp (par défaut)
helm install stoa-gateway stoa-platform/stoa-platform \
  --set gateway.mode=edge-mcp \
  --set gateway.mcpEnabled=true
```

Pour en savoir plus, consultez le [tutoriel MCP Gateway](/blog/what-is-mcp-gateway) et le [guide de démarrage rapide](/docs/guides/quickstart).

## Comparaison des patterns

| Pattern | Complexité | Multi-protocoles | Support agents IA | GitOps | Idéal pour |
|---------|-----------|-----------------|------------------|--------|-----------|
| **Ingress** | Faible | HTTP uniquement | ❌ | ✅ | Apps web simples, blogs, mono-tenant |
| **Gateway API** | Moyenne | HTTP, TCP, TLS | ❌ | ✅ | Plateformes multi-tenant, déploiements canary |
| **Sidecar** | Élevée | Tous (transparent) | ⚠️ MCP par pod | ✅ | Microservices avec service mesh, isolation stricte |
| **MCP Gateway** | Moyenne | HTTP + MCP | ✅ Natif | ✅ | Apps natives IA, exposition d'APIs legacy aux agents |

### Quand utiliser chaque pattern

```
Commencez ici : devez-vous exposer des APIs aux agents IA ?
    ├─ OUI → MCP Gateway (edge-mcp ou sidecar)
    │         └─ Trafic élevé par service ? → Sidecar MCP
    │         └─ Contrôle centralisé ? → Edge-MCP
    │
    └─ NON → Routage HTTP traditionnel uniquement ?
              ├─ OUI → App simple avec 1 à 5 services ?
              │         └─ Ingress Controller (nginx/Traefik)
              │
              └─ NON → Plateforme multi-tenant complexe ?
                        └─ Gateway API (basé sur les rôles, extensible)
                        └─ Déjà sur service mesh ?
                              └─ Sidecar Gateway (Istio/Linkerd)
```

### Stratégie multi-modes

L'architecture unifiée de STOA (ADR-024) permet **d'exécuter plusieurs modes simultanément** :

```yaml
# values.yaml
gateway:
  mode: edge-mcp  # Par défaut pour le trafic MCP
  sidecar:
    enabled: true  # Injecter des sidecars dans les namespaces labellisés
  shadow:
    enabled: true  # Miroir du trafic pour les tests
```

Cela permet :
- **Edge-MCP** pour le trafic des agents IA
- **Sidecar** pour les microservices sensibles nécessitant une isolation par pod
- **Shadow** pour tester de nouvelles politiques sans impacter la production

Consultez la [documentation des modes Gateway](/docs/guides/gateway-modes) pour les détails d'implémentation.

## Guide d'implémentation

### Étape 1 : choisir votre pattern

Sur la base de l'arbre de décision ci-dessus, sélectionnez le pattern adapté à votre architecture. Pour ce guide, nous allons implémenter le **MCP Gateway** avec STOA.

### Étape 2 : installer STOA Gateway

```bash
# Ajouter le dépôt Helm
helm repo add stoa-platform https://charts.gostoa.dev
helm repo update

# Installer en mode edge-mcp
helm install stoa-gateway stoa-platform/stoa-platform \
  --namespace stoa-system \
  --create-namespace \
  --set gateway.mode=edge-mcp \
  --set gateway.mcpEnabled=true \
  --set controlPlane.apiUrl=https://api.example.com
```

### Étape 3 : appliquer les CRDs

STOA utilise des Custom Resource Definitions pour la gestion déclarative des APIs :

```bash
kubectl apply -f https://raw.githubusercontent.com/stoa-platform/stoa/main/charts/stoa-platform/crds/tools.gostoa.dev_v1alpha1.yaml
kubectl apply -f https://raw.githubusercontent.com/stoa-platform/stoa/main/charts/stoa-platform/crds/toolsets.gostoa.dev_v1alpha1.yaml
kubectl apply -f https://raw.githubusercontent.com/stoa-platform/stoa/main/charts/stoa-platform/crds/subscriptions.gostoa.dev_v1alpha1.yaml
```

### Étape 4 : définir un Tool

Créez un manifeste `Tool` pour un Service Kubernetes existant :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: customer-api
  namespace: production
spec:
  displayName: "Customer Management API"
  description: "CRUD operations for customer records"
  endpoint: http://customer-service.production.svc.cluster.local/api/v1/customers
  method: POST
  parameters:
    - name: action
      type: string
      required: true
      enum: ["create", "update", "delete", "get"]
    - name: customer_id
      type: string
      required: false
    - name: data
      type: object
      required: false
  authentication:
    type: bearer
    secretRef:
      name: customer-api-token
      key: token
```

Appliquez-le :

```bash
kubectl apply -f customer-api-tool.yaml
```

### Étape 5 : vérifier la découverte du Tool

Le MCP gateway découvre automatiquement le Tool :

```bash
# Port-forward vers le gateway
kubectl port-forward -n stoa-system svc/stoa-gateway 8080:8080

# Lister les tools disponibles (protocole MCP)
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

Réponse attendue :

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "customer_api",
        "description": "CRUD operations for customer records",
        "inputSchema": {
          "type": "object",
          "properties": {
            "action": {"type": "string", "enum": ["create", "update", "delete", "get"]},
            "customer_id": {"type": "string"},
            "data": {"type": "object"}
          },
          "required": ["action"]
        }
      }
    ]
  }
}
```

### Étape 6 : intégration GitOps

En production, gérez les Tools via GitOps (ArgoCD, Flux) :

```bash
# Structure de répertoire
manifests/
├── tools/
│   ├── customer-api.yaml
│   ├── order-api.yaml
│   └── payment-api.yaml
└── toolsets/
    └── ecommerce-suite.yaml
```

Committez dans Git, laissez ArgoCD synchroniser :

```bash
git add manifests/
git commit -m "feat(tools): add customer, order, payment APIs"
git push origin main
```

Consultez le tutoriel [GitOps en 10 minutes](/blog/gitops-in-10-minutes) pour la configuration ArgoCD.

## Considérations de performance

Les différents patterns ont des profils de ressources différents. Sur la base des [benchmarks Gateway Arena](/blog/stoa-gateway-performance-benchmarks) de STOA :

| Pattern | Latence (p50) | Latence (p95) | Mémoire par instance | CPU (1 000 req/s) |
|---------|--------------|--------------|---------------------|-----------------|
| **Ingress** | 2 ms | 8 ms | 50 Mo | 0,1 core |
| **Gateway API** | 3 ms | 10 ms | 80 Mo | 0,15 core |
| **Sidecar** | 1 ms | 4 ms | 30 Mo × N pods | 0,05 × N |
| **MCP Gateway** | 4 ms | 12 ms | 120 Mo | 0,2 core |

**Insights clés** :
- **Sidecar** a la plus faible latence par requête (pas de saut réseau) mais la mémoire agrégée la plus élevée
- **MCP Gateway** ajoute ~2 ms d'overhead pour la traduction de protocole (acceptable pour les workflows d'agents IA)
- **Ingress** est le plus économe en ressources pour le routage HTTP simple

Pour les scénarios à fort débit (>10 000 req/s), envisagez des [stratégies multi-tenant](/blog/multi-tenant-api-gateway-kubernetes) avec HorizontalPodAutoscaler.

## Bonnes pratiques de sécurité

Quel que soit le pattern, suivez ces principes de sécurité natifs Kubernetes :

### 1. Network Policies

Restreignez le trafic entre gateway et services backend :

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-gateway
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: customer-service
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: stoa-system
      podSelector:
        matchLabels:
          app: stoa-gateway
    ports:
    - protocol: TCP
      port: 8080
```

### 2. RBAC pour les CRDs

Limitez qui peut créer des ressources `Tool` :

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tool-admin
  namespace: production
rules:
- apiGroups: ["gostoa.dev"]
  resources: ["tools", "toolsets"]
  verbs: ["get", "list", "create", "update", "delete"]
```

### 3. Gestion des secrets

Utilisez Sealed Secrets ou External Secrets Operator pour les tokens d'authentification :

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: customer-api-token
  namespace: production
spec:
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: customer-api-token
  data:
  - secretKey: token
    remoteRef:
      key: customer-api/token
```

### 4. Pod Security Standards

Appliquez le Pod Security Standard restreint sur les namespaces gateway :

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: stoa-system
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## Stratégies de migration

### De Ingress vers Gateway API

1. **Déployer les CRDs Gateway API** (spécifiques au fournisseur, ex : Istio, Cilium)
2. **Créer les ressources GatewayClass et Gateway**
3. **Convertir les règles Ingress en HTTPRoute** (outils automatisés disponibles)
4. **Tester avec le mirroring de trafic** avant de changer le DNS
5. **Décommissionner l'Ingress** après 30 jours de coexistence

### Du gateway monolithique vers le Sidecar

1. **Activer l'injection sidecar** dans un namespace (`stoa-injection: enabled`)
2. **Valider que les métriques** correspondent au comportement du gateway central
3. **Labelliser progressivement** des namespaces supplémentaires
4. **Réduire le gateway central** après 100 % de couverture sidecar

### De l'API Gateway traditionnel vers le MCP Gateway

1. **Inventorier les APIs existantes** (specs OpenAPI)
2. **Générer les CRDs Tool** depuis OpenAPI (CLI STOA : `stoactl bridge`)
3. **Déployer le MCP gateway** aux côtés du gateway existant
4. **Onboarder les agents IA** vers l'endpoint MCP
5. **Décommissionner l'ancien gateway** après la migration des agents

Consultez le [Guide des API gateways open source 2026](/blog/open-source-api-gateway-2026) pour les chemins de migration spécifiques aux fournisseurs.

## Foire aux questions

### Quelle est la différence entre Gateway API et Ingress ?

Gateway API est le standard de nouvelle génération conçu pour remplacer Ingress. Différences clés :

- **Orienté rôles** : sépare l'infrastructure (GatewayClass), le cluster (Gateway) et l'application (HTTPRoute), permettant un RBAC amélioré
- **Multi-protocoles** : support natif de HTTP, TCP, TLS, UDP et gRPC (Ingress ne supporte que HTTP/HTTPS)
- **Extensibilité** : CRD PolicyAttachment pour les fonctionnalités spécifiques aux fournisseurs sans annotations
- **Inter-namespaces** : HTTPRoute peut référencer des backends dans différents namespaces avec ReferenceGrant

Gateway API est GA depuis Kubernetes v1.29 et supporté par les principales implémentations (Istio, Cilium, Kong, NGINX Gateway Fabric). Pour les nouveaux déploiements, commencez avec Gateway API sauf si votre cas d'usage est du routage HTTP simple.

### Quand devrais-je utiliser un sidecar gateway plutôt qu'un gateway central ?

Utilisez un sidecar gateway quand :

- **Une isolation stricte** est requise (services financiers, santé) — chaque service a besoin de son propre enforcement de politiques
- **mTLS par service** — le sidecar peut terminer mTLS en utilisant des certificats spécifiques au pod
- **Un service mesh** est déjà déployé (Istio, Linkerd) — les sidecars sont de l'infrastructure gratuite
- **Architecture zero-trust** — chaque pod valide indépendamment les requêtes entrantes

Évitez les sidecars si :

- **L'overhead de ressources** est une préoccupation (100 microservices = 100 instances sidecar)
- **L'observabilité centralisée** est préférée (tableau de bord gateway unique vs. agréger N sidecars)
- **Un routage simple** est suffisant (Ingress ou Gateway API est plus léger)

L'architecture multi-modes de STOA permet de combiner les deux : gateway edge-mcp central pour les agents IA, mode sidecar pour les services de paiement/auth.

### Comment le MCP gateway gère-t-il l'authentification pour les APIs legacy ?

Le MCP gateway supporte cinq mécanismes d'authentification via le CRD `Tool` :

1. **Bearer token** : API key statique stockée dans un Secret K8s
2. **OAuth2 Client Credentials** : le gateway échange client_id/secret contre un access token
3. **mTLS** : le gateway présente un certificat client (depuis un Secret ou cert-manager)
4. **Basic Auth** : le gateway injecte le header `Authorization: Basic <base64>`
5. **Headers personnalisés** : tout header statique (ex : `X-API-Key`)

Pour OAuth2, le gateway **met en cache les tokens** jusqu'à expiration et les renouvelle automatiquement. Pour mTLS, il surveille les ressources Certificate de cert-manager et recharge lors du renouvellement. Cela permet aux agents IA d'appeler des APIs legacy sans connaître les détails d'authentification — le gateway injecte les credentials de manière transparente.

Exemple de Tool OAuth2 :

```yaml
spec:
  authentication:
    type: oauth2
    tokenEndpoint: https://auth.example.com/oauth/token
    clientId: api-client
    clientSecretRef:
      name: oauth-secret
      key: client_secret
    scopes: ["api.read", "api.write"]
```

Le gateway obtient un token à la première requête et le renouvelle avant expiration (basé sur le champ `expires_in`).

## Conclusion

Les patterns d'API gateway natifs Kubernetes ont évolué bien au-delà des simples contrôleurs Ingress. Les quatre patterns — Ingress, Gateway API, sidecar et MCP gateway — répondent à des besoins architecturaux différents :

- **Ingress** pour le routage HTTP simple
- **Gateway API** pour les plateformes multi-tenant avec une gestion complexe du trafic
- **Sidecar** pour l'intégration service mesh et l'isolation stricte par service
- **MCP Gateway** pour les applications natives IA et l'exposition d'APIs legacy aux agents

L'architecture unifiée de STOA Platform (ADR-024) supporte les quatre modes, permettant aux organisations d'adopter le bon pattern pour chaque cas d'usage sans réécrire l'infrastructure. Commencez avec le [guide de démarrage rapide](/docs/guides/quickstart) pour déployer votre premier gateway MCP, ou explorez la [documentation Architecture](/docs/concepts/architecture) pour les stratégies multi-modes.

Pour la migration depuis des API gateways propriétaires, consultez le [Guide des API gateways open source 2026](/blog/open-source-api-gateway-2026).

---

> **À propos des comparaisons de patterns** : les informations dans ce guide sont basées sur les spécifications du Kubernetes SIG Network (Gateway API), les projets CNCF (Istio, Linkerd) et l'implémentation open source de STOA Platform en février 2026. Les capacités des gateways évoluent fréquemment — consultez la documentation de chaque projet pour les fonctionnalités actuelles. Toutes les marques déposées appartiennent à leurs propriétaires respectifs. Voir [marques déposées](/docs/legal/trademarks) pour les détails.
