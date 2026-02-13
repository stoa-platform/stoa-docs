---
sidebar_position: 7
title: "OpenShift Deployment"
description: "Deploy STOA Platform on Red Hat OpenShift — Routes, SecurityContextConstraints, Operator compatibility, and OCP-specific configuration."
keywords:
  - OpenShift
  - OCP
  - Routes
  - SCC
  - Red Hat
---

# OpenShift Deployment

STOA Platform runs on Red Hat OpenShift (4.12+) with minor configuration adjustments. This guide covers the differences from vanilla Kubernetes.

## Key Differences from Kubernetes

| Feature | Kubernetes | OpenShift |
|---------|-----------|-----------|
| Ingress | `Ingress` resource | `Route` resource (or Ingress via HAProxy) |
| Security | PodSecurityStandards | SecurityContextConstraints (SCC) |
| Registry | Any (GHCR, ECR) | Internal registry + pull secrets |
| TLS | cert-manager | OpenShift built-in or cert-manager |
| Networking | Calico/Cilium | OVN-Kubernetes (default) |

## Routes (Instead of Ingress)

Replace Kubernetes Ingress with OpenShift Routes:

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: stoa-gateway
  namespace: stoa-system
spec:
  host: mcp.<YOUR_DOMAIN>
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

Create routes for each service:

| Service | Host | Target Port |
|---------|------|-------------|
| Gateway | `mcp.<YOUR_DOMAIN>` | `http` (8080) |
| API | `api.<YOUR_DOMAIN>` | `http` (8000) |
| Console | `console.<YOUR_DOMAIN>` | `http` (8080) |
| Portal | `portal.<YOUR_DOMAIN>` | `http` (8080) |
| Keycloak | `auth.<YOUR_DOMAIN>` | `http` (8080) |

### Helm Override

Disable Ingress and use Routes instead:

```yaml
# values-openshift.yaml
stoaGateway:
  ingress:
    enabled: false

# Apply routes separately
# kubectl apply -f openshift/routes/
```

## SecurityContextConstraints

STOA containers run as non-root with the `restricted-v2` SCC (OpenShift default for new projects).

### Verify SCC Compatibility

```bash
# Check which SCC is assigned
oc get pods -n stoa-system -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.annotations.openshift\.io/scc}{"\n"}{end}'
```

All STOA containers should run under `restricted-v2`. If pods fail to schedule:

```bash
# Grant restricted-v2 explicitly (usually not needed)
oc adm policy add-scc-to-user restricted-v2 \
  -z default -n stoa-system
```

### Container Requirements

STOA containers are already compatible with `restricted-v2`:

- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `capabilities.drop: [ALL]`
- No host networking or privileged mode

## Image Pull Configuration

If using the internal OpenShift registry:

```bash
# Tag and push to internal registry
oc registry login
docker tag ghcr.io/stoa-platform/stoa-gateway:latest \
  image-registry.openshift-image-registry.svc:5000/stoa-system/stoa-gateway:latest
docker push image-registry.openshift-image-registry.svc:5000/stoa-system/stoa-gateway:latest
```

Or configure a pull secret for GHCR:

```bash
oc create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<GITHUB_USER> \
  --docker-password=<GITHUB_TOKEN> \
  -n stoa-system

oc secrets link default ghcr-pull-secret --for=pull -n stoa-system
```

## Operator Compatibility

STOA works alongside these OpenShift Operators:

| Operator | Purpose | Notes |
|----------|---------|-------|
| **Keycloak Operator** (RHSSO) | Identity management | Use instead of standalone Keycloak |
| **Prometheus Operator** | Monitoring | Included in OpenShift Monitoring |
| **Elasticsearch Operator** | Logging | Use for OpenSearch alternative |
| **cert-manager Operator** | TLS certificates | Available from OperatorHub |

### Using OpenShift Monitoring

OpenShift includes a built-in Prometheus stack. Enable user workload monitoring:

```yaml
# cluster-monitoring-config ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
data:
  config.yaml: |
    enableUserWorkload: true
```

STOA's ServiceMonitors will be automatically discovered by the user workload Prometheus instance.

## Installation on OpenShift

```bash
# Create project
oc new-project stoa-system

# Apply CRDs
oc apply -f charts/stoa-platform/crds/

# Install with OpenShift-specific values
helm install stoa-platform ./charts/stoa-platform \
  -n stoa-system \
  -f values-openshift.yaml

# Create routes
oc apply -f openshift/routes/
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Pod `CrashLoopBackOff` | SCC violation | Check `oc describe pod` for SCC errors |
| Route not accessible | TLS termination wrong | Use `edge` for HTTPS backends behind HTTP |
| Image pull fails | No pull secret | Create and link `ghcr-pull-secret` |
| ServiceMonitor not found | User workload monitoring disabled | Enable in `cluster-monitoring-config` |
| Network policy blocks traffic | OVN-Kubernetes vs Calico syntax | Use `networking.k8s.io/v1` (standard) |

## Related

- [Installation Guide](/docs/admin/installation) -- Standard Kubernetes deployment
- [Security Hardening](/docs/admin/security-hardening) -- Security configuration
- [Monitoring & Alerting](/docs/admin/monitoring) -- Prometheus setup
