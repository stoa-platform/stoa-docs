---
sidebar_position: 2
slug: /guides/stoactl-quickstart
title: "Auto-hébergement en 5 Minutes avec stoactl"
description: "Mettez en place un MCP Gateway local avec stoactl — de l'installation au bridging de votre première API REST vers des outils MCP en moins de 5 minutes"
keywords: [stoactl, CLI, self-hosted, quickstart, MCP gateway, OpenAPI bridge, docker]
---

# Auto-hébergement en 5 Minutes avec stoactl

Démarrez un MCP Gateway local et faites le bridge de votre première API REST — sans compte cloud.

## Ce Que Vous Allez Construire

À la fin de ce guide, vous aurez :
- Un MCP Gateway STOA opérationnel (Docker)
- Une spec OpenAPI automatiquement convertie en outils MCP
- Des outils appelables par IA enregistrés sur votre gateway local

## Prérequis

- **Docker** (Docker Desktop ou Docker Engine)
- **stoactl** — le CLI STOA

### Installer stoactl

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="macos" label="macOS (Homebrew)">

```bash
brew install stoa-platform/tap/stoactl
```

</TabItem>
<TabItem value="linux" label="Linux">

```bash
curl -sSL https://get.gostoa.dev | sh
```

</TabItem>
<TabItem value="go" label="Depuis les sources (Go 1.22+)">

```bash
go install github.com/stoa-platform/stoactl@latest
```

</TabItem>
</Tabs>

Vérifiez l'installation :

```bash
stoactl version
```

---

## Étape 1 : Initialiser un Projet

```bash
stoactl init my-api
cd my-api
```

Cette commande crée un scaffold de projet complet :

```
my-api/
├── docker-compose.yml   # Gateway + echo backend
├── stoa.yaml            # Configuration du gateway
├── echo-nginx.conf      # Echo backend (retourne du JSON statique)
├── example-api.yaml     # Exemple de spec OpenAPI
├── tools/               # Répertoire de sortie pour le bridge
└── README.md            # Instructions spécifiques au projet
```

## Étape 2 : Démarrer le Gateway

```bash
docker compose up -d
```

Attendez quelques secondes que le gateway démarre, puis vérifiez :

```bash
stoactl doctor
```

Vous devriez voir toutes les vérifications réussir :

```
STOA Doctor

  ✓ Docker: running (v27.x)
  ✓ Gateway: healthy (http://localhost:8080/health)
  ✓ Port 8080: available
  ...
```

## Étape 3 : Faire le Bridge d'une API vers MCP

Le projet inclut un fichier `example-api.yaml` (spec OpenAPI 3.0) avec 3 opérations. Convertissez-le en outils MCP :

```bash
stoactl bridge example-api.yaml --namespace default --output ./tools/
```

Sortie :

```
✓ Parsed OpenAPI 3.0 spec: my-api API (3 operations)
✓ Generated 3 Tool CRDs → ./tools/
  - list-items.yaml
  - create-item.yaml
  - get-item.yaml
```

### Aperçu de ce qui a été généré

Chaque fichier dans `tools/` est un Tool CRD valide :

```bash
cat tools/list-items.yaml
```

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: list-items
  namespace: default
  labels:
    generated-by: stoactl-bridge
spec:
  displayName: List all items
  endpoint: http://echo:8888/items
  method: GET
  inputSchema:
    type: object
    properties:
      limit:
        type: integer
        maximum: 100
        default: 20
  timeout: 30s
  enabled: true
```

## Étape 4 : Enregistrer les Outils dans le Gateway

Appliquez chaque outil généré au gateway en cours d'exécution :

```bash
for f in tools/*.yaml; do stoactl apply -f "$f"; done
```

Vérifiez que les outils sont enregistrés :

```bash
stoactl get tools
```

## Étape 5 : Tester via MCP

Appelez l'endpoint MCP du gateway pour lister les outils disponibles :

```bash
curl -s http://localhost:8080/mcp/v1/tools | jq .
```

Invoquez un outil :

```bash
curl -s http://localhost:8080/mcp/v1/tools/invoke \
  -H "Content-Type: application/json" \
  -d '{"name": "list-items", "arguments": {"limit": 5}}' | jq .
```

---

## Faire le Bridge de Votre Propre API

Remplacez la spec d'exemple par votre propre fichier OpenAPI 3.x :

```bash
# Utiliser votre propre spec
stoactl bridge your-api.yaml --namespace default --output ./tools/

# Filtrer des opérations spécifiques par tag
stoactl bridge your-api.yaml --namespace default --include-tags payments

# Remplacer l'URL du backend
stoactl bridge your-api.yaml --namespace default --server https://api.internal.com

# Aperçu sans écriture de fichiers
stoactl bridge your-api.yaml --namespace default --dry-run
```

### Référence des flags de bridge

| Flag | Description | Défaut |
|------|-------------|--------|
| `--namespace` | Namespace cible pour les outils (obligatoire) | — |
| `--output` | Répertoire de sortie pour les fichiers YAML | `./tools/` |
| `--server` | Remplacer `servers[0].url` de la spec | Depuis la spec |
| `--auth-secret` | Nom du secret K8s pour l'auth | — |
| `--include-tags` | Inclure uniquement les opérations avec ces tags | Tous |
| `--exclude-tags` | Exclure les opérations avec ces tags | Aucun |
| `--include-ops` | Inclure uniquement ces operationIds | Tous |
| `--timeout` | Timeout par défaut pour les outils | `30s` |
| `--dry-run` | Afficher le résumé sans écrire de fichiers | `false` |

---

## Prochaines Étapes

- **[Démarrage Rapide (Cloud)](/docs/guides/quickstart)** — Utiliser la plateforme STOA hébergée
- **[Configuration du Gateway](/docs/reference/configuration)** — Personnaliser votre gateway
- **[Référence Tool CRD](/docs/reference/crds/tool)** — Documentation complète de la spec Tool
- **[Référence CLI](/docs/reference/cli)** — Toutes les commandes stoactl

## FAQ

### Qu'est-ce que stoactl ?

`stoactl` est un CLI de style kubectl pour gérer les ressources STOA Platform. Il fournit le scaffolding de projet (`init`), le bridging API-vers-MCP (`bridge`), les vérifications diagnostiques (`doctor`) et la gestion des ressources (`apply`, `get`, `delete`).

### Puis-je faire le bridge de n'importe quelle API REST ?

Oui. Toute API disposant d'une spécification OpenAPI 3.0 ou 3.1 peut être bridgée vers des outils MCP. Chaque opération path+method devient un outil MCP distinct avec ses paramètres mappés vers le schéma d'entrée de l'outil.

### Ai-je besoin d'un compte cloud STOA ?

Non. La configuration auto-hébergée avec `stoactl init` + Docker est complètement autonome. Vous pouvez optionnellement vous connecter à la plateforme STOA hébergée plus tard pour la gestion multi-tenant, l'observabilité et les fonctionnalités d'équipe.
