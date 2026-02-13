---
sidebar_position: 1
title: "Installation Guide"
description: "Deploy STOA Platform on Kubernetes — prerequisites, Helm chart installation, values reference, CRDs, and post-install verification."
keywords:
  - STOA installation
  - Helm chart
  - Kubernetes deployment
  - API gateway setup
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Installation Guide

Deploy STOA Platform on any Kubernetes cluster using Helm. This guide covers prerequisites, chart installation, configuration, and post-install verification.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Kubernetes | 1.28+ | Container orchestration |
| Helm | 3.12+ | Chart deployment |
| kubectl | 1.28+ | Cluster management |
| PostgreSQL | 15+ | Control Plane database |
| Keycloak | 24+ | Identity and access management |

### Optional Components

| Component | Version | Purpose |
|-----------|---------|---------|
| Prometheus | 2.50+ | Metrics collection |
| Grafana | 10+ | Dashboard visualization |
| OpenSearch | 2.11+ | Audit logs and search |
| Redpanda/Kafka | 23.3+ | Event streaming (metering) |

### Resource Requirements

| Profile | Nodes | CPU (total) | RAM (total) | Use Case |
|---------|-------|-------------|-------------|----------|
| **Starter** | 1 | 4 vCPU | 8 GB | Development, evaluation |
| **Standard** | 3 | 12 vCPU | 24 GB | Small production (up to 100 APIs) |
| **Enterprise** | 5+ | 24+ vCPU | 48+ GB | Large production (100+ APIs) |

See [Hardware Requirements](/docs/reference/hardware-requirements) for detailed sizing guidance.

## Quick Install

```bash
# Add the STOA Helm repository
helm repo add stoa https://charts.gostoa.dev
helm repo update

# Create namespace
kubectl create namespace stoa-system

# Install with default values
helm install stoa-platform stoa/stoa-platform \
  -n stoa-system \
  --set stoaGateway.keycloakUrl="https://auth.<YOUR_DOMAIN>"
```

## Helm Chart Reference

### Chart Metadata

| Field | Value |
|-------|-------|
| Chart name | `stoa-platform` |
| Chart version | `0.1.0` |
| App version | `2.0.0` |
| Type | `application` |

### Installation from Source

```bash
# Clone the repository
git clone https://github.com/stoa-platform/stoa.git
cd stoa

# Lint the chart
helm lint charts/stoa-platform

# Install from local chart
helm install stoa-platform ./charts/stoa-platform \
  -n stoa-system \
  --create-namespace \
  -f my-values.yaml
```

## Values Reference

### STOA Gateway (Rust)

The primary production gateway. Handles MCP protocol, JWT authentication, rate limiting, and API proxying.

```yaml
stoaGateway:
  enabled: true
  image:
    repository: ghcr.io/stoa-platform/stoa-gateway
    tag: latest
  replicas: 2

  # Keycloak OIDC
  keycloakUrl: ""              # Required: https://auth.<YOUR_DOMAIN>
  keycloakRealm: stoa
  keycloakClientId: stoa-mcp-gateway

  # Control Plane connection
  controlPlaneUrl: "http://control-plane-api.stoa-system.svc.cluster.local:8000"

  # Gateway mode (ADR-024)
  mode: edge-mcp               # Options: edge-mcp, sidecar, proxy, shadow

  # Auto-registration (ADR-028)
  autoRegister: true
  environment: dev              # Options: dev, staging, prod

  # Resources
  resources:
    requests:
      cpu: 100m
      memory: 64Mi
    limits:
      cpu: 500m
      memory: 256Mi

  # Secrets
  secretName: stoa-gateway-secrets

  # Logging
  logLevel: info                # Options: trace, debug, info, warn, error
  logFormat: json               # Options: json, text
```

### OPA Policies

```yaml
stoaGateway:
  opa:
    enabled: true
    policyPath: /etc/stoa/policies/default.rego
```

### Kafka/Redpanda Metering

```yaml
stoaGateway:
  kafka:
    enabled: false
    brokers: "redpanda.stoa-system.svc.cluster.local:9092"
    topic: stoa.metering
```

### Kubernetes Watcher

```yaml
stoaGateway:
  k8sWatcher:
    enabled: false              # Enable CRD watching for Tool/ToolSet
```

### ServiceMonitor (Prometheus)

```yaml
stoaGateway:
  serviceMonitor:
    enabled: true
    interval: 15s
    scrapeTimeout: 10s
```

### Sidecar Mode

For deploying alongside third-party gateways (Kong, webMethods, Envoy):

```yaml
stoaSidecar:
  enabled: false
  gatewayType: webmethods      # Options: webmethods, kong, envoy, apigee, generic
  resources:
    requests:
      cpu: 50m
      memory: 32Mi
    limits:
      cpu: 200m
      memory: 128Mi
```

### Grafana OIDC

```yaml
grafana:
  oidc:
    enabled: false
    clientId: stoa-observability
    roleAttributePath: "contains(roles[*], 'stoa:admin') && 'Admin' || 'Viewer'"
    rootUrl: "https://grafana.<YOUR_DOMAIN>"
```

### OpenAPI Sync CronJob

```yaml
gatewayOpenapiSync:
  enabled: true
  schedule: "0 */6 * * *"      # Every 6 hours
```

## Custom Resource Definitions

STOA ships 4 CRDs that must be applied before or alongside the Helm chart:

```bash
kubectl apply -f charts/stoa-platform/crds/
```

### Tool CRD (`tools.gostoa.dev/v1alpha1`)

Defines an individual API tool for MCP exposure:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: billing-list-invoices
  namespace: tenant-acme
spec:
  displayName: List Invoices
  description: Retrieve all invoices for the current billing period
  endpoint: https://billing.internal/v1/invoices
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

### ToolSet CRD (`toolsets.gostoa.dev/v1alpha1`)

Federates tools from an upstream MCP server:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: internal-mcp-server
  namespace: tenant-acme
spec:
  upstream:
    url: http://mcp-server.internal:3000/mcp/sse
    transport: sse
    auth:
      type: bearer
      secretRef: mcp-server-token
    timeoutSeconds: 30
  tools: []                     # Empty = discover all tools
  prefix: internal              # Prefix tool names: internal_*
```

### GatewayInstance CRD (`gatewayinstances.gostoa.dev/v1alpha1`)

Registers a gateway instance for multi-gateway orchestration:

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
  baseUrl: https://kong-admin.internal:8001
  capabilities: [rest, rate_limiting]
  mode: edge-mcp
```

### GatewayBinding CRD (`gatewaybindings.gostoa.dev/v1alpha1`)

Binds an API to a gateway instance with policies:

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

## Post-Install Verification

### 1. Check Pod Status

```bash
kubectl get pods -n stoa-system
```

Expected output:

```
NAME                                 READY   STATUS    RESTARTS   AGE
stoa-gateway-xxx-yyy                 1/1     Running   0          2m
control-plane-api-xxx-yyy            1/1     Running   0          2m
```

### 2. Verify Gateway Health

<EnvSetup />

```bash
curl -s "${STOA_GATEWAY_URL}/health" | jq
```

Expected:

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "mode": "edge-mcp"
}
```

### 3. Verify CRDs

```bash
kubectl get crd | grep gostoa.dev
```

Expected:

```
gatewaybindings.gostoa.dev    2026-01-15T10:00:00Z
gatewayinstances.gostoa.dev   2026-01-15T10:00:00Z
tools.gostoa.dev              2026-01-15T10:00:00Z
toolsets.gostoa.dev           2026-01-15T10:00:00Z
```

### 4. Verify Metrics Endpoint

```bash
curl -s "${STOA_GATEWAY_URL}/metrics" | head -5
```

You should see Prometheus-format metrics starting with `stoa_`.

## Upgrade

```bash
helm repo update
helm upgrade stoa-platform stoa/stoa-platform \
  -n stoa-system \
  -f my-values.yaml
```

CRD updates require manual application (Helm does not upgrade CRDs):

```bash
kubectl apply -f charts/stoa-platform/crds/
```

## Uninstall

```bash
helm uninstall stoa-platform -n stoa-system
kubectl delete namespace stoa-system

# Optional: remove CRDs (destroys all custom resources)
kubectl delete crd tools.gostoa.dev toolsets.gostoa.dev \
  gatewayinstances.gostoa.dev gatewaybindings.gostoa.dev
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Pod `CrashLoopBackOff` | Missing env vars or secrets | Check `kubectl logs` and verify `secretName` exists |
| Gateway `503` on startup | Keycloak URL unreachable | Verify `keycloakUrl` resolves from within the cluster |
| CRDs not found | CRDs not applied | Run `kubectl apply -f charts/stoa-platform/crds/` |
| Metrics not scraped | ServiceMonitor labels mismatch | Ensure `prometheus: kube-prometheus-stack` label matches |
| Sidecar gateway unreachable | Network policy blocking | Check `kubectl get networkpolicy -n stoa-system` |

## Related

- [Keycloak Administration](/docs/admin/keycloak) -- Realm setup and OIDC clients
- [Monitoring Setup](/docs/admin/monitoring) -- Prometheus, Grafana, and alerting
- [Hardware Requirements](/docs/reference/hardware-requirements) -- Sizing guide
- [Configuration Reference](/docs/reference/configuration) -- Environment variables
- [Hybrid Deployment](/docs/deployment/hybrid) -- Multi-cloud architecture
