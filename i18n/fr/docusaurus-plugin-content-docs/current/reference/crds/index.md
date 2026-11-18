---
sidebar_position: 1
title: "Référence des CRDs Kubernetes"
description: "Custom Resource Definitions Kubernetes STOA (gostoa.dev/v1alpha1) — Tool, ToolSet, Skill, GatewayInstance et GatewayBinding."
keywords: [CRD, Kubernetes, custom resources, Tool, ToolSet, Skill, GatewayInstance, GatewayBinding]
---

# Référence des CRDs Kubernetes

STOA Platform fournit **cinq** Custom Resource Definitions namespacées (`gostoa.dev/v1alpha1`) dans `charts/stoa-platform/crds/` pour l'enregistrement déclaratif d'outils MCP, l'injection de contexte agent et la réconciliation multi-passerelles.

## CRDs Disponibles (`gostoa.dev/v1alpha1`)

| Kind | Pluriel / Nom court | Contrôleur / Watcher | Rôle |
|------|---------------------|----------------------|------|
| [`Tool`](./tool.md) | `tools` / `tool` | `stoa-gateway` (`CrdWatcher`) | Définition d'un outil MCP individuel adossé à un endpoint HTTP |
| [`ToolSet`](./toolset.md) | `toolsets` / `ts` | `stoa-gateway` (`CrdWatcher`) | Connexion à un serveur MCP amont (`sse` ou `streamable-http`) exposant ses outils |
| [`Skill`](./skill.md) | `skills` / `sk` | `stoa-gateway` (`CrdWatcher`) | Instructions de contexte système hiérarchisées (`global`, `tenant`, `tool`, `user`) |
| [`GatewayInstance`](./gateway-instance.md) | `gatewayinstances` / `gwi` | `stoa-operator` (Python/Kopf, Bêta) | Déclaration et suivi de santé d'une instance de passerelle STOA ou tierce |
| [`GatewayBinding`](./gateway-binding.md) | `gatewaybindings` / `gwb` | `stoa-operator` (Python/Kopf, Bêta) | Liaison déclarative d'une API du catalogue et de politiques vers une `GatewayInstance` |

*(Note : le module K8s Rust de `stoa-gateway` inclut également un watcher interne `GuardrailPolicy`, qui n'est pas distribué comme manifeste CRD dans `charts/stoa-platform/crds/` à ce jour.)*

## Installation

Les cinq CRDs sont installées automatiquement par le chart Helm `./charts/stoa-platform` depuis un checkout de `stoa-platform/stoa` :

```bash
helm install stoa-platform ./charts/stoa-platform -n stoa-system --create-namespace \
  -f values-override.yaml
```

Pour appliquer ou mettre à jour les CRDs manuellement (recommandé avant `helm upgrade`, Helm ne mettant pas à jour les CRDs existantes) :

```bash
kubectl apply -f charts/stoa-platform/crds/
```

## Périmètre Namespace & Comportement Runtime

Les cinq CRDs ont une portée `Namespaced`. Lorsque `stoa-gateway` est compilé avec la feature Cargo `k8s` et démarré avec `STOA_K8S_ENABLED=true`, son `CrdWatcher` (`stoa-gateway/src/k8s/watcher.rs`) surveille les ressources `Tool`, `ToolSet` et `Skill`, associe `metadata.namespace` au périmètre tenant correspondant et met à jour les registres en mémoire directement (il ne patche **pas** la sous-ressource `.status` des `Tool`, `ToolSet` et `Skill`). `GatewayInstance` et `GatewayBinding` sont réconciliées séparément par `stoa-operator` (Bêta).

## Exemple Rapide

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

```bash
kubectl apply -f weather-tool.yaml
kubectl get tools,toolsets,skills,gatewayinstances,gatewaybindings -n tenant-acme
```
