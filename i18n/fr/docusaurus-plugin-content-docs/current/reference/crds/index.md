---
sidebar_position: 1
title: "CRDs Kubernetes pour STOA : Ressources Tool & ToolSet"
description: "Référence des Custom Resource Definitions (CRDs) Kubernetes STOA — ressources Tool et ToolSet pour la gestion déclarative des tools MCP et les flux GitOps"
keywords: [CRD, Kubernetes, custom resources, Tool, ToolSet]
---

# Référence des CRDs Kubernetes

STOA Platform utilise des Custom Resource Definitions (CRDs) Kubernetes pour la gestion déclarative des tools.

## CRDs Disponibles

| CRD | Version API | Description |
|-----|-------------|-------------|
| [Tool](./tool.md) | `gostoa.dev/v1alpha1` | Définition individuelle d'un tool MCP |
| [ToolSet](./toolset.md) | `gostoa.dev/v1alpha1` | Collection de tools depuis une spec OpenAPI |

## Installation

Les CRDs sont installées via le chart Helm STOA :

```bash
helm install stoa-platform ./charts/stoa-platform -n stoa-system --create-namespace
```

Ou manuellement :

```bash
kubectl apply -f https://raw.githubusercontent.com/stoa-platform/stoa/main/charts/stoa-platform/crds/
```

## Prérequis de Namespace

Les CRDs doivent être créées dans les namespaces tenant :

```yaml
metadata:
  name: my-tool
  namespace: tenant-acme  # Doit correspondre au namespace tenant
```

## Démarrage Rapide

Créer un tool simple :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: weather-api
  namespace: tenant-acme
spec:
  displayName: API Météo
  description: Obtenir la météo actuelle pour un lieu
  endpoint: https://api.weather.example/v1/current
  method: POST
  inputSchema:
    type: object
    properties:
      location:
        type: string
        description: Nom de la ville ou coordonnées
    required:
      - location
```

Appliquer :

```bash
kubectl apply -f weather-tool.yaml
```

Vérifier :

```bash
kubectl get tools -n tenant-acme
```
