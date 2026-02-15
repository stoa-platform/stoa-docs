---
slug: kubernetes-native-api-gateway-patterns
title: "Kubernetes-Native API Gateway Patterns: From Ingress to MCP (2026 Guide)"
description: "Learn the 4 key Kubernetes-native API gateway patterns — Ingress, Gateway API, sidecar, and MCP gateway. Architecture diagrams and implementation guide."
authors: [stoa-team]
tags: [tutorial, api-gateway, architecture]
unlisted: true
keywords:
  - kubernetes native api gateway patterns
  - kubernetes api gateway architecture
  - gateway api vs ingress controller
  - k8s api gateway best practices
  - cloud native api management
---
<!-- last verified: 2026-02 -->

Kubernetes-native API gateway patterns have evolved from simple Ingress controllers to sophisticated multi-mode architectures that support AI agents, service mesh integration, and GitOps workflows. This guide covers the four essential patterns — Ingress Controller, Gateway API, sidecar gateway, and MCP gateway — with architecture diagrams, implementation examples, and a decision framework for choosing the right pattern for your use case.

<!-- truncate -->

## Introduction: Why Kubernetes-Native Matters

As organizations move workloads to Kubernetes, the API gateway becomes a critical piece of infrastructure. Traditional API gateways were designed for VMs and physical servers — they don't understand Pods, Services, or Custom Resource Definitions (CRDs). A **Kubernetes-native API gateway** leverages K8s primitives for configuration, discovery, and lifecycle management, enabling:

- **Declarative configuration** via YAML manifests (GitOps-ready)
- **Automatic service discovery** through K8s Service resources
- **Dynamic scaling** with HorizontalPodAutoscaler
- **Multi-tenancy** via Namespaces and RBAC
- **Observability** integration with Prometheus, OpenTelemetry, and K8s events

This tutorial explores four architectural patterns, from foundational (Ingress Controller) to cutting-edge (MCP Gateway for AI agents).

## Pattern 1: Ingress Controller — The Foundation

The **Ingress Controller** pattern is the most common entry point for HTTP traffic in Kubernetes. Introduced in K8s v1.1, it uses the `Ingress` resource to define routing rules.

### Architecture

```
                    ┌─────────────────┐
  Internet ────────▶│ LoadBalancer    │ (Cloud LB or MetalLB)
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

### Example Manifest

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

### Characteristics

| Feature | Support |
|---------|---------|
| **HTTP routing** | ✅ Host + path-based |
| **TLS termination** | ✅ Via cert-manager |
| **Rate limiting** | ⚠️ Controller-specific annotations |
| **Authentication** | ⚠️ External auth plugins |
| **Multi-protocol** | ❌ HTTP/HTTPS only |
| **Service mesh integration** | ❌ No built-in support |

### Use Cases

- Simple HTTP routing for web applications
- TLS termination with Let's Encrypt (cert-manager)
- Basic path-based routing without complex policies
- Teams familiar with nginx or Traefik configuration

### Limitations

The Ingress resource is **limited to Layer 7 HTTP** and lacks native support for:
- TCP/UDP routing
- Advanced traffic splitting (canary, weighted)
- Cross-namespace routing (requires IngressClass trickery)
- Policy enforcement (rate limiting, CORS) without vendor annotations

This led the Kubernetes SIG Network to design the **Gateway API**.

## Pattern 2: Gateway API — The Standard

The **Gateway API** (formerly Ingress v2) is a Kubernetes SIG project that addresses Ingress limitations with a role-oriented, extensible API. It separates concerns between infrastructure (GatewayClass), cluster (Gateway), and application (HTTPRoute, TCPRoute).

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

### Example Manifests

**GatewayClass** (cluster-scoped, managed by platform team):

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: production-gateway
spec:
  controllerName: stoa.dev/gateway-controller
```

**Gateway** (namespace-scoped, infrastructure config):

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

**HTTPRoute** (namespace-scoped, app config):

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

### Characteristics

| Feature | Support |
|---------|---------|
| **HTTP/TCP/TLS routing** | ✅ Multi-protocol via Routes |
| **Traffic splitting** | ✅ Weighted backends (canary) |
| **Cross-namespace** | ✅ ReferenceGrant for security |
| **Role-based** | ✅ GatewayClass (infra) vs HTTPRoute (app) |
| **Extensibility** | ✅ PolicyAttachment for custom policies |
| **Vendor-neutral** | ✅ Standard API, multiple implementations |

### Use Cases

- Multi-tenant environments (namespace isolation)
- Advanced traffic management (canary, blue-green)
- Platform teams providing self-service routing to app teams
- Organizations migrating from cloud-specific ingress (ALB, GCE)

### Implementation with STOA

STOA supports Gateway API through the **proxy mode** (ADR-024). The gateway controller watches `HTTPRoute` resources and syncs them to STOA's control plane:

```bash
# Deploy STOA in proxy mode
helm install stoa-gateway stoa-platform/stoa-platform \
  --set gateway.mode=proxy \
  --set gateway.gatewayClass=stoa
```

Learn more in the [Gateway Modes guide](/docs/guides/gateway-modes).

## Pattern 3: Sidecar Gateway — Service Mesh Style

The **sidecar gateway** pattern deploys a lightweight gateway instance alongside each application Pod. Popularized by service meshes (Istio, Linkerd), it provides per-service policy enforcement and observability.

### Architecture

```
                    ┌─────────────────┐
  Internet ────────▶│ Edge Gateway    │ (Central entry point)
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

### Deployment with Mutating Webhook

Service meshes inject the sidecar automatically via a MutatingWebhookConfiguration:

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

When a Pod is created in a labeled namespace, the webhook adds a sidecar container:

```yaml
# Original Pod spec
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  containers:
  - name: app
    image: my-app:1.0

# After injection (simplified)
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

### Characteristics

| Feature | Support |
|---------|---------|
| **Zero config for apps** | ✅ Transparent proxy |
| **Fine-grained policies** | ✅ Per-pod rate limiting, mTLS |
| **Observability** | ✅ Per-request metrics |
| **Resource overhead** | ⚠️ N sidecars = N × memory |
| **Upgrade complexity** | ⚠️ Requires rolling restart of all Pods |

### Use Cases

- Microservices with strict security boundaries (mTLS per service)
- Per-service rate limiting or circuit breaking
- Organizations already using a service mesh
- Gradual rollout of gateway policies (sidecar only in labeled namespaces)

### STOA Sidecar Mode

STOA's sidecar mode (ADR-024) provides:
- Automatic OIDC token injection from Kubernetes ServiceAccount
- Per-service metering (usage tracked by pod label)
- MCP protocol translation at the pod level

See [Hybrid Deployment](/docs/deployment/hybrid) for multi-mode strategies.

## Pattern 4: MCP Gateway — AI-Native Pattern

The **MCP Gateway** pattern extends Kubernetes-native API gateways to support the [Model Context Protocol (MCP)](/blog/what-is-mcp-gateway), enabling AI agents to discover and invoke backend APIs through a standardized interface.

### Architecture

```
                    ┌─────────────────┐
  AI Agent ────────▶│ MCP Gateway     │ (Protocol translator)
  (Claude, GPT)     │ (edge-mcp mode) │
                    └────────┬────────┘
                             │
                             │ Discovers K8s Services
                             │ via CRDs (Tool, ToolSet)
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │ Tool    │    │ Tool    │    │ Tool    │
         │ CRD     │    │ CRD     │    │ CRD     │
         │ (users) │    │ (orders)│    │ (pay)   │
         └────┬────┘    └────┬────┘    └────┬────┘
              │              │              │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │ Service │    │ Service │    │ Service │
         │  HTTP   │    │  HTTP   │    │  HTTP   │
         └─────────┘    └─────────┘    └─────────┘
```

### Example CRD

The MCP gateway watches `Tool` custom resources to auto-discover APIs:

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

When an AI agent connects to the MCP gateway, it receives this Tool as:

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

The agent can then invoke the tool:

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

The MCP gateway translates this to:

```bash
GET http://user-service.apps.svc.cluster.local/api/v1/users?email=alice@example.com
Authorization: Bearer <token-from-oauth2>
```

### Characteristics

| Feature | Support |
|---------|---------|
| **AI agent discovery** | ✅ MCP protocol + K8s CRDs |
| **Legacy API bridging** | ✅ REST/SOAP → MCP translation |
| **Automatic auth** | ✅ OAuth2, API key, mTLS injection |
| **Multi-tenant** | ✅ Namespace-scoped Tools |
| **GitOps-ready** | ✅ Declarative Tool manifests |

### Use Cases

- [Connecting AI agents to enterprise APIs](/blog/connecting-ai-agents-enterprise-apis)
- Exposing legacy webMethods, Oracle, or MuleSoft APIs to LLMs
- Multi-tenant SaaS platforms with per-tenant API catalogs
- Organizations building AI-powered workflows (RPA → AI agent migration)

### STOA Edge-MCP Mode

STOA's default `edge-mcp` mode (ADR-024) runs as a central gateway that:
- Watches `Tool` and `ToolSet` CRDs across all tenant namespaces
- Enforces quota and rate limiting per consumer (tracked via `Subscription` CRD)
- Logs all agent-to-API calls to OpenSearch for compliance auditing

```bash
# Deploy STOA in edge-mcp mode (default)
helm install stoa-gateway stoa-platform/stoa-platform \
  --set gateway.mode=edge-mcp \
  --set gateway.mcpEnabled=true
```

Learn more in the [MCP Gateway tutorial](/blog/what-is-mcp-gateway) and [Quick Start guide](/docs/guides/quickstart).

## Pattern Comparison

| Pattern | Complexity | Multi-Protocol | AI Agent Support | GitOps | Best For |
|---------|-----------|----------------|------------------|--------|----------|
| **Ingress** | Low | HTTP only | ❌ | ✅ | Simple web apps, blogs, single-tenant |
| **Gateway API** | Medium | HTTP, TCP, TLS | ❌ | ✅ | Multi-tenant platforms, canary deployments |
| **Sidecar** | High | All (transparent) | ⚠️ Per-pod MCP | ✅ | Microservices with service mesh, strict isolation |
| **MCP Gateway** | Medium | HTTP + MCP | ✅ Native | ✅ | AI-native apps, legacy API exposure to agents |

### When to Use Each Pattern

```
Start here: Need to expose APIs to AI agents?
    ├─ YES → MCP Gateway (edge-mcp or sidecar)
    │         └─ High traffic per service? → Sidecar MCP
    │         └─ Centralized control? → Edge-MCP
    │
    └─ NO → Traditional HTTP routing only?
              ├─ YES → Simple app with 1-5 services?
              │         └─ Ingress Controller (nginx/Traefik)
              │
              └─ NO → Complex multi-tenant platform?
                        └─ Gateway API (role-based, extensible)
                        └─ Already using service mesh?
                              └─ Sidecar Gateway (Istio/Linkerd)
```

### Multi-Mode Strategy

STOA's unified architecture (ADR-024) allows **running multiple modes simultaneously**:

```yaml
# values.yaml
gateway:
  mode: edge-mcp  # Default for MCP traffic
  sidecar:
    enabled: true  # Inject sidecars in labeled namespaces
  shadow:
    enabled: true  # Mirror traffic for testing
```

This enables:
- **Edge-MCP** for AI agent traffic
- **Sidecar** for sensitive microservices needing per-pod isolation
- **Shadow** for testing new policies without affecting production

See [Gateway Modes documentation](/docs/guides/gateway-modes) for implementation details.

## Implementation Guide

### Step 1: Choose Your Pattern

Based on the decision tree above, select the pattern that fits your architecture. For this guide, we'll implement **MCP Gateway** with STOA.

### Step 2: Install STOA Gateway

```bash
# Add Helm repository
helm repo add stoa-platform https://charts.gostoa.dev
helm repo update

# Install in edge-mcp mode
helm install stoa-gateway stoa-platform/stoa-platform \
  --namespace stoa-system \
  --create-namespace \
  --set gateway.mode=edge-mcp \
  --set gateway.mcpEnabled=true \
  --set controlPlane.apiUrl=https://api.example.com
```

### Step 3: Apply CRDs

STOA uses Custom Resource Definitions for declarative API management:

```bash
kubectl apply -f https://raw.githubusercontent.com/stoa-platform/stoa/main/charts/stoa-platform/crds/tools.gostoa.dev_v1alpha1.yaml
kubectl apply -f https://raw.githubusercontent.com/stoa-platform/stoa/main/charts/stoa-platform/crds/toolsets.gostoa.dev_v1alpha1.yaml
kubectl apply -f https://raw.githubusercontent.com/stoa-platform/stoa/main/charts/stoa-platform/crds/subscriptions.gostoa.dev_v1alpha1.yaml
```

### Step 4: Define a Tool

Create a `Tool` manifest for an existing Kubernetes Service:

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

Apply it:

```bash
kubectl apply -f customer-api-tool.yaml
```

### Step 5: Verify Tool Discovery

The MCP gateway automatically discovers the Tool:

```bash
# Port-forward to the gateway
kubectl port-forward -n stoa-system svc/stoa-gateway 8080:8080

# List available tools (MCP protocol)
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

Expected response:

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

### Step 6: GitOps Integration

For production, manage Tools via GitOps (ArgoCD, Flux):

```bash
# Directory structure
manifests/
├── tools/
│   ├── customer-api.yaml
│   ├── order-api.yaml
│   └── payment-api.yaml
└── toolsets/
    └── ecommerce-suite.yaml
```

Commit to Git, let ArgoCD sync:

```bash
git add manifests/
git commit -m "feat(tools): add customer, order, payment APIs"
git push origin main
```

See the [GitOps in 10 Minutes](/blog/gitops-in-10-minutes) tutorial for ArgoCD setup.

## Performance Considerations

Different patterns have different resource profiles. Based on STOA's [Gateway Arena benchmarks](/blog/stoa-gateway-performance-benchmarks):

| Pattern | Latency (p50) | Latency (p95) | Memory per Instance | CPU (1000 req/s) |
|---------|--------------|--------------|-------------------|-----------------|
| **Ingress** | 2ms | 8ms | 50 MB | 0.1 cores |
| **Gateway API** | 3ms | 10ms | 80 MB | 0.15 cores |
| **Sidecar** | 1ms | 4ms | 30 MB × N pods | 0.05 × N |
| **MCP Gateway** | 4ms | 12ms | 120 MB | 0.2 cores |

**Key insights**:
- **Sidecar** has lowest per-request latency (no network hop) but highest aggregate memory
- **MCP Gateway** adds ~2ms overhead for protocol translation (acceptable for AI agent workflows)
- **Ingress** is most resource-efficient for simple HTTP routing

For high-throughput scenarios (>10K req/s), consider [multi-tenant strategies](/blog/multi-tenant-api-gateway-kubernetes) with HorizontalPodAutoscaler.

## Security Best Practices

Regardless of pattern, follow these Kubernetes-native security principles:

### 1. Network Policies

Restrict traffic between gateway and backend services:

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

### 2. RBAC for CRDs

Limit who can create `Tool` resources:

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

### 3. Secret Management

Use Sealed Secrets or External Secrets Operator for authentication tokens:

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

Enforce restricted Pod Security Standard on gateway namespaces:

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

## Migration Strategies

### From Ingress to Gateway API

1. **Deploy Gateway API CRDs** (vendor-specific, e.g., Istio, Cilium)
2. **Create GatewayClass and Gateway** resources
3. **Convert Ingress rules to HTTPRoute** (automated tools available)
4. **Test with traffic shadowing** before switching DNS
5. **Decommission Ingress** after 30-day overlap

### From Monolithic Gateway to Sidecar

1. **Enable sidecar injection** in one namespace (`stoa-injection: enabled`)
2. **Validate metrics** match central gateway behavior
3. **Gradually label** additional namespaces
4. **Scale down** central gateway after 100% sidecar coverage

### From Traditional API Gateway to MCP Gateway

1. **Inventory existing APIs** (OpenAPI specs)
2. **Generate Tool CRDs** from OpenAPI (STOA CLI: `stoactl bridge`)
3. **Deploy MCP gateway** alongside existing gateway
4. **Onboard AI agents** to MCP endpoint
5. **Sunset legacy gateway** after agent migration complete

See the [Open Source API Gateway 2026 Guide](/blog/open-source-api-gateway-2026) for vendor-specific migration paths.

## FAQ

### What's the difference between Gateway API and Ingress?

Gateway API is the next-generation standard designed to replace Ingress. Key differences:

- **Role-oriented**: Separates infrastructure (GatewayClass), cluster (Gateway), and application (HTTPRoute) concerns, enabling better RBAC
- **Multi-protocol**: Native support for HTTP, TCP, TLS, UDP, and gRPC (Ingress only supports HTTP/HTTPS)
- **Extensibility**: PolicyAttachment CRD for vendor-specific features without annotations
- **Cross-namespace**: HTTPRoute can reference backends in different namespaces with ReferenceGrant

Gateway API is GA as of Kubernetes v1.29 and supported by major implementations (Istio, Cilium, Kong, NGINX Gateway Fabric). For new deployments, start with Gateway API unless your use case is simple HTTP-only routing.

### When should I use a sidecar gateway instead of a central gateway?

Use a sidecar gateway when:

- **Strict isolation** is required (financial services, healthcare) — each service needs its own policy enforcement
- **Per-service mTLS** — sidecar can terminate mTLS using pod-specific certificates
- **Service mesh** is already deployed (Istio, Linkerd) — sidecars are free infrastructure
- **Zero-trust architecture** — every pod validates incoming requests independently

Avoid sidecars if:

- **Resource overhead** is a concern (100 microservices = 100 sidecar instances)
- **Centralized observability** is preferred (single gateway dashboard vs. aggregating N sidecars)
- **Simple routing** is sufficient (Ingress or Gateway API is lighter weight)

STOA's multi-mode architecture lets you mix both: central edge-mcp gateway for AI agents, sidecar mode for payment/auth services.

### How does MCP gateway handle authentication for legacy APIs?

The MCP gateway supports five authentication mechanisms via the `Tool` CRD:

1. **Bearer token**: Static API key stored in K8s Secret
2. **OAuth2 Client Credentials**: Gateway exchanges client_id/secret for access token
3. **mTLS**: Gateway presents client certificate (from Secret or cert-manager)
4. **Basic Auth**: Gateway injects `Authorization: Basic <base64>` header
5. **Custom headers**: Any static header (e.g., `X-API-Key`)

For OAuth2, the gateway **caches tokens** until expiry and auto-refreshes. For mTLS, it watches cert-manager Certificate resources and reloads on renewal. This allows AI agents to call legacy APIs without knowing authentication details — the gateway injects credentials transparently.

Example OAuth2 Tool:

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

The gateway obtains a token on first request and refreshes it before expiry (based on `expires_in` field).

## Conclusion

Kubernetes-native API gateway patterns have evolved far beyond simple Ingress controllers. The four patterns — Ingress, Gateway API, sidecar, and MCP gateway — address different architectural needs:

- **Ingress** for simple HTTP routing
- **Gateway API** for multi-tenant platforms with complex traffic management
- **Sidecar** for service mesh integration and strict per-service isolation
- **MCP Gateway** for AI-native applications and legacy API exposure to agents

STOA Platform's unified architecture (ADR-024) supports all four modes, enabling organizations to adopt the right pattern for each use case without rewriting infrastructure. Start with the [Quick Start guide](/docs/guides/quickstart) to deploy your first MCP-enabled gateway, or explore the [Architecture documentation](/docs/concepts/architecture) for multi-mode strategies.

For migration from proprietary API gateways, see the [Open Source API Gateway 2026 Guide](/blog/open-source-api-gateway-2026).

---

> **About pattern comparisons**: Information in this guide is based on Kubernetes SIG Network specifications (Gateway API), CNCF projects (Istio, Linkerd), and STOA Platform's open-source implementation as of February 2026. Gateway capabilities evolve frequently — consult each project's documentation for current features. All trademarks belong to their respective owners. See [trademarks](/docs/trademarks) for details.
