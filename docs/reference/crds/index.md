---
sidebar_position: 1
---

# Kubernetes CRDs Reference

STOA Platform uses Kubernetes Custom Resource Definitions (CRDs) for declarative tool management.

## Available CRDs

| CRD | API Version | Description |
|-----|-------------|-------------|
| [Tool](./tool.md) | `gostoa.dev/v1alpha1` | Individual MCP tool definition |
| [ToolSet](./toolset.md) | `gostoa.dev/v1alpha1` | Tool collection from OpenAPI spec |

## Installation

CRDs are installed via the STOA Helm chart:

```bash
helm install stoa-platform ./charts/stoa-platform -n stoa-system --create-namespace
```

Or manually:

```bash
kubectl apply -f https://raw.githubusercontent.com/stoa-platform/stoa/main/charts/stoa-platform/crds/
```

## Namespace Requirements

CRDs must be created in tenant namespaces:

```yaml
metadata:
  name: my-tool
  namespace: tenant-acme  # Must match tenant namespace
```

## Quick Start

Create a simple tool:

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
```

Apply:

```bash
kubectl apply -f weather-tool.yaml
```

Verify:

```bash
kubectl get tools -n tenant-acme
```
