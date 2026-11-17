---
sidebar_position: 1
title: "Kubernetes CRDs Reference"
description: "STOA Kubernetes Custom Resource Definitions (gostoa.dev/v1alpha1) — Tool, ToolSet, Skill, GatewayInstance, and GatewayBinding."
keywords: [CRD, Kubernetes, custom resources, Tool, ToolSet, Skill, GatewayInstance, GatewayBinding]
---

# Kubernetes CRDs Reference

STOA Platform ships **five** namespaced Custom Resource Definitions (`gostoa.dev/v1alpha1`) in `charts/stoa-platform/crds/` for declarative MCP tool registration, agent context injection, and multi-gateway reconciliation.

## Available CRDs (`gostoa.dev/v1alpha1`)

| Kind | Plural / Short Name | Reconciler / Watcher | Purpose |
|------|---------------------|----------------------|---------|
| [`Tool`](./tool.md) | `tools` / `tool` | `stoa-gateway` (`CrdWatcher`) | Individual HTTP-backed MCP tool definition |
| [`ToolSet`](./toolset.md) | `toolsets` / `ts` | `stoa-gateway` (`CrdWatcher`) | Upstream MCP server connection (`sse` or `streamable-http`) exposing discovered tools |
| [`Skill`](./skill.md) | `skills` / `sk` | `stoa-gateway` (`CrdWatcher`) | Scoped system-prompt context instructions (`global`, `tenant`, `tool`, `user`) |
| [`GatewayInstance`](./gateway-instance.md) | `gatewayinstances` / `gwi` | `stoa-operator` (Python/Kopf, Beta) | Declarative registration and health tracking of a STOA or third-party gateway instance |
| [`GatewayBinding`](./gateway-binding.md) | `gatewaybindings` / `gwb` | `stoa-operator` (Python/Kopf, Beta) | Declarative binding of a catalog API and policies onto a `GatewayInstance` |

*(Note: `stoa-gateway`'s Rust K8s module also contains an internal `GuardrailPolicy` watcher struct, which is not currently shipped as a CRD manifest in `charts/stoa-platform/crds/`.)*

## Installation

All five CRDs are installed automatically with the `./charts/stoa-platform` Helm chart from a `stoa-platform/stoa` checkout:

```bash
helm install stoa-platform ./charts/stoa-platform -n stoa-system --create-namespace \
  -f values-override.yaml
```

To apply or upgrade CRDs explicitly (recommended before `helm upgrade`, as Helm does not overwrite existing CRDs):

```bash
kubectl apply -f charts/stoa-platform/crds/
```

## Namespace Scoping

All five CRDs are `Namespaced`. When `STOA_K8S_WATCHER_ENABLED=true`, `stoa-gateway` watches `Tool`, `ToolSet`, and `Skill` resources across namespaces and maps the resource's `metadata.namespace` to the owning tenant boundary.

## Quick Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: weather-api
  namespace: tenant-acme
spec:
  displayName: Weather API
  description: Get current weather for a location
  endpoint: https://api.weather.example/v1/current
  method: POST
  inputSchema:
    type: object
    properties:
      location:
        type: string
        description: City name or coordinates
    required:
      - location
  auth: bearer
  rateLimit: "100/min"
```

```bash
kubectl apply -f weather-tool.yaml
kubectl get tools,toolsets,skills,gatewayinstances,gatewaybindings -n tenant-acme
```
