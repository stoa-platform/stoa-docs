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

Deploy the **STOA Gateway** and its Kubernetes Custom Resource Definitions using the `charts/stoa-platform` Helm chart from the `stoa-platform/stoa` repository. This guide covers prerequisites, local-checkout chart installation, `values.yaml` configuration, and post-install verification.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Kubernetes | 1.28+ | Container orchestration |
| Helm | 3.12+ | Chart deployment |
| kubectl | 1.28+ | Cluster management |
| PostgreSQL | 15+ | Control Plane database (deployed separately) |
| Keycloak | 26+ | Identity and access management — single `stoa` realm (deployed separately) |

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
| **Standard** | 3 | 12 vCPU | 24 GB | Small production |
| **Enterprise** | 5+ | 24+ vCPU | 48+ GB | Large production |

See [Hardware Requirements](/docs/reference/hardware-requirements) for detailed sizing guidance.

## Quick Install

No public Helm chart index (`charts.gostoa.dev`) or `helm-v*` release tarball is published today. Install directly from a checkout of `stoa-platform/stoa`.

This minimal example installs the gateway resources from `./charts/stoa-platform` without monitoring or the external gateway sync hook, but is **not a complete Ready deployment** until you complete the startup policy setup below:

```bash
# Clone the monorepo at a verified revision
git clone https://github.com/stoa-platform/stoa.git
cd stoa
git checkout 639e8b9a2217695cfc2f590e246ed9d4ce4d4913

# Install the gateway without monitoring or the external gateway sync hook
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

:::note What this chart installs (gateway-only scope)
With default values, `charts/stoa-platform` (`v0.1.0`) installs the **Rust STOA Gateway** (`stoa-gateway` Deployment with 2 replicas, ClusterIP Service port `80` → container port `8080`, `stoa-gateway-policies` ConfigMap), the 5 CRDs in `crds/` on initial install, the gateway OpenAPI sync CronJob and hook, three ServiceMonitors, and an internal Secret (`stoa-internal-keys`, generated at install; its `gateway-consumer-key` is passed to the gateway as `GATEWAY_API_KEYS`). Sibling chart `charts/stoa-observability` (and umbrella `charts/stoa-stack`) packages optional Grafana Alloy, Tempo, and Blackbox telemetry. The minimal example above disables the ServiceMonitors, OTLP export, and both the sync CronJob and hook. The legacy `gateway.edgeMcp.enabled` setting controls one ServiceMonitor; disabling it does not disable the Rust gateway (`stoaGateway.enabled`).

The **Control Plane API, Console, Developer Portal, Keycloak, PostgreSQL, Redpanda, and OpenBao** are **not** installed by `charts/stoa-platform` (values under `controlPlaneApi`, `controlPlaneUi`, `portal`, `keycloak`, and `vault` only render optional HPA/PDB/ServiceMonitor/CronJob integration objects for separately deployed workloads). Replace the `controlPlaneUrl` and `keycloakUrl` placeholders with existing service URLs. To enable auto-registration, also provide the `STOA_CONTROL_PLANE_API_KEY` key in the Secret named by `stoaGateway.secretName` (see [Gateway Auto-Registration](/docs/guides/gateway-auto-registration)). Without this key, the gateway runs in standalone mode.

Before re-enabling the ServiceMonitors, install the Prometheus Operator CRDs, including `servicemonitors.monitoring.coreos.com`. Before setting `gatewaySync.enabled=true`, make the Control Plane API (`gatewaySync.backendUrl`, endpoints `/health/live` and `/openapi.json`) and the webMethods administration API (`gatewaySync.gatewayUrl`) reachable, then create the Secret named by `gatewaySync.credentialsSecret` with `username` and `password` keys. This setting also enables a Helm post-install/post-upgrade hook; the periodic sync expects an existing API matching `gatewaySync.apiName` and `gatewaySync.apiVersion`.
:::

### Startup Policy and Readiness

`stoaGateway.policyBootTenants` (and `stoaSidecar.policyBootTenants` when sidecar mode is enabled) defaults to `[]` (`charts/stoa-platform/values.yaml`). When `controlPlaneUrl` is set and `policyBootTenants` is empty, `/ready` fails closed with HTTP `503` ([ADR-070 §4](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) and pods remain `0/1 Ready`, even if external services are reachable. The chart probes `/ready`; a `200 OK` on `/health` or successful auto-registration does not satisfy this readiness gate.

Configure startup tenants directly via `stoaGateway.policyBootTenants` in `my-values.yaml` (rendered as comma-separated `STOA_POLICY_BOOT_TENANTS` in `templates/stoa-gateway-deployment.yaml`; no `extraEnv` workaround is needed) and pass `-f my-values.yaml` when installing or upgrading:

```yaml
stoaGateway:
  policyBootTenants:
    - "<TENANT_ID>"
```

Replace `<TENANT_ID>` with each existing tenant whose tool permissions the gateway must load at boot. Listing tenants alone is insufficient: the gateway must load a complete, fresh signed tool policy from the Control Plane. Provide reachable Control Plane and Keycloak services, and configure the gateway's Keycloak service client for `private_key_jwt` authentication with its mounted signing key (`STOA_KEYCLOAK_CLIENT_KEY_PATH`, plus `STOA_KEYCLOAK_CLIENT_KEY_ID` when needed via `extraEnv` and mounted Secret). That service identity must be authorized to read the tenant's tool permissions. The registration API key and a Keycloak client secret do not replace this signing-key authentication for policy reads. If `STOA_POLICY_TRUST_JWKS_FILE` is configured, its trust set must also load successfully.

The startup loader fetches and refreshes tenant tool permissions in the background. Missing inputs, a failed initial policy load, or a stale policy keep readiness failed. Only expect `1/1 Ready` after a fresh policy has loaded for every listed tenant and the other readiness checks, including Control Plane health and OIDC discovery when enabled, pass. The chart's `policies.enabled` and `policies.path` settings do not populate startup tenants or replace this tool-policy load.

## Helm Chart Reference

### Chart Metadata

| Field | Value |
|-------|-------|
| Chart name | `stoa-platform` (`charts/stoa-platform`) |
| Chart version | `0.1.0` |
| App version | `2.0.0` |
| Type | `application` |

### Lint and Install with a Values File

```bash
# From the stoa repository root
helm lint ./charts/stoa-platform

helm upgrade --install stoa-platform ./charts/stoa-platform \
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
    digest: sha256:0ea4741d3b83c4de5f5f221a42969e4afbee17ed1d66d40fb92500d77dce991e
    pullPolicy: IfNotPresent
  replicas: 2

  # Startup policy readiness gate (ADR-070 §4)
  policyBootTenants: []          # Populate with tenant IDs when controlPlaneUrl is set

  # Keycloak OIDC
  keycloakUrl: ""                # Required: https://auth.<YOUR_DOMAIN>
  keycloakRealm: ""              # Empty inherits keycloak.realm ("stoa")
  keycloakClientId: stoa-mcp-gateway

  # Control Plane connection
  controlPlaneUrl: "http://stoa-control-plane-api.stoa-system.svc.cluster.local:8000"

  # Gateway mode (ADR-024)
  mode: edge-mcp                 # Supported by Rust runtime: edge-mcp, sidecar, proxy, shadow

  # Auto-registration (ADR-036)
  autoRegister: true
  environment: ""                # Empty inherits global.environment ("dev")

  # Resources
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi

  # Secrets
  secretName: stoa-gateway-secrets

  # Logging
  logLevel: info                 # Options: trace, debug, info, warn, error
  logFormat: json                # Options: json, pretty, compact
```

`templates/_helpers.tpl` (`stoa-platform.pinnedImage`) requires **both** `image.repository` and `image.digest` (`sha256:` followed by 64 lowercase hexadecimal characters) and renders `image: "<repository>@<digest>"`. Setting `image.tag` is ignored by the template, and missing or malformed digests fail `helm template` / `helm install`.

The chart comment also lists `connect`, but the Rust runtime does not accept it for `STOA_GATEWAY_MODE` (use the Go `stoa-connect` binary for STOA Link). Use `edge-mcp`, `sidecar`, `proxy`, or `shadow` for `stoaGateway.mode`.

### OPA Policies

```yaml
stoaGateway:
  policies:
    enabled: true
    path: /etc/stoa/policies/default.rego
```

### Kafka/Redpanda Metering

```yaml
stoaGateway:
  kafka:
    enabled: false
    brokers: "redpanda.stoa-system.svc.cluster.local:9092"
    meteringTopic: stoa.metering
    errorsTopic: stoa.errors
```

### Kubernetes Watcher

```yaml
stoaGateway:
  k8s:
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

For deploying alongside third-party gateways in the same Kubernetes pod (`stoaSidecar.mainGateway.enabled=true` is required when `stoaSidecar.enabled=true`, and both images must specify `repository` and `digest`):

```yaml
stoaSidecar:
  enabled: false
  targetGateway: webmethods    # Options: webmethods, kong, gravitee, agentgateway, apigee, aws_apigateway, azure_apim
  policyBootTenants: []        # Same fail-closed semantics as stoaGateway.policyBootTenants
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
gatewaySync:
  enabled: true
  schedule: "0 */6 * * *"      # Every 6 hours
```

## Custom Resource Definitions

STOA ships 5 CRDs (Tool, ToolSet, GatewayInstance, GatewayBinding and Skill) that must be applied before or alongside the Helm chart:

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

### ToolSet CRD (`toolsets.gostoa.dev/v1alpha1`)

Federates tools from an upstream MCP server:

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
  baseUrl: https://kong-admin.<YOUR_DOMAIN>:8001
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

### Skill CRD (`skills.gostoa.dev/v1alpha1`)

Defines agent instructions with an explicit scope:

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

## Post-Install Verification

### 1. Check Pod Status

```bash
kubectl get pods -n stoa-system
```

Expected output for the minimal example before startup policy setup:

```
NAME                                 READY   STATUS    RESTARTS   AGE
stoa-gateway-<REPLICASET>-<POD_1>      0/1     Running   0          <AGE>
stoa-gateway-<REPLICASET>-<POD_2>      0/1     Running   0          <AGE>
```

After completing the startup policy setup and passing all readiness checks, the `READY` column should become `1/1` for each pod. `/health` below checks liveness only; it can return `OK` while `/ready` returns HTTP 503.

### 2. Verify Gateway Health

<EnvSetup />

```bash
curl --fail --silent --show-error "${STOA_GATEWAY_URL}/health"
```

Expected:

```text
OK
```

### 3. Verify CRDs

```bash
kubectl get crd | grep gostoa.dev
```

Expected:

```
gatewaybindings.gostoa.dev    <CREATED_AT>
gatewayinstances.gostoa.dev   <CREATED_AT>
skills.gostoa.dev             <CREATED_AT>
tools.gostoa.dev              <CREATED_AT>
toolsets.gostoa.dev           <CREATED_AT>
```

### 4. Verify Metrics Endpoint

```bash
curl -s "${STOA_GATEWAY_URL}/metrics" | head -5
```

You should see Prometheus-format metrics starting with `stoa_`.

## Upgrade

Follow [Upgrade](./upgrade) and the checklist in [Maintenance Cycle](./maintenance). From your checked-out `stoa` repository at the target revision:

```bash
git fetch origin
git checkout <TARGET_COMMIT_OR_TAG>

# Apply CRD changes BEFORE upgrading the Helm release (Helm does not upgrade existing CRDs)
kubectl apply -f ./charts/stoa-platform/crds/

helm upgrade stoa-platform ./charts/stoa-platform \
  -n stoa-system \
  -f my-values.yaml
```

## Uninstall

Use the ordered teardown and retention decisions in [Maintenance Cycle](./maintenance) §6. Short form:

```bash
helm uninstall stoa-platform -n stoa-system
kubectl delete namespace stoa-system

# Optional — ONLY with explicit OK: remove CRDs (destroys all related CRs)
kubectl delete crd tools.gostoa.dev toolsets.gostoa.dev \
  gatewayinstances.gostoa.dev gatewaybindings.gostoa.dev skills.gostoa.dev
```

Do not delete CRDs or external database volumes unless the change ticket records a data-retention decision. Prefer [Helm rollback](./upgrade#rolling-back) when the goal is to restore service.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Pod `CrashLoopBackOff` | Missing env vars or secrets | Check `kubectl logs` and verify `secretName` exists |
| Gateway `503` on startup | Keycloak URL unreachable | Verify `keycloakUrl` resolves from within the cluster |
| CRDs not found | CRDs not applied | Run `kubectl apply -f charts/stoa-platform/crds/` |
| Metrics not scraped | ServiceMonitor labels mismatch | Ensure `prometheus: kube-prometheus-stack` label matches |
| Sidecar gateway unreachable | Network policy blocking | Check `kubectl get networkpolicy -n stoa-system` |

## Related

- [Maintenance Cycle](./maintenance) -- Upgrade, rollback, and uninstall controls
- [Upgrade Guide](/docs/admin/upgrade) -- Version compatibility and zero-downtime notes
- [Keycloak Administration](/docs/admin/keycloak) -- Realm setup and OIDC clients
- [Monitoring Setup](/docs/admin/monitoring) -- Prometheus, Grafana, and alerting
- [Hardware Requirements](/docs/reference/hardware-requirements) -- Sizing guide
- [Configuration Reference](/docs/reference/configuration) -- Environment variables
- [Configuration sources](/docs/reference/config-sources) -- Which layer owns a setting, and how to change it
- [Hybrid Deployment](/docs/deployment/hybrid) -- Multi-cloud architecture
