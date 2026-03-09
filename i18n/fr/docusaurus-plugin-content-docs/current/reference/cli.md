---
sidebar_position: 2
title: "Référence CLI (stoactl)"
description: "Référence CLI stoactl — interface en ligne de commande de style kubectl pour gérer les ressources STOA Platform, déployer des APIs et créer des ponts vers MCP."
keywords: [CLI, command line, stoactl, reference, deploy, rollback, logs, MCP, bridge, OpenAPI]
---

# Référence CLI (stoactl)

`stoactl` est une CLI de style kubectl pour gérer les ressources STOA Platform. Elle fournit le déploiement d'APIs, la création de projets, la création de ponts API-vers-MCP, les diagnostics et la gestion des ressources.

## Installation

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

---

## Référence Rapide

| Commande | Description |
|---------|-------------|
| `stoactl deploy` | Déployer une API depuis un fichier stoa.yaml |
| `stoactl logs` | Afficher l'historique de déploiement d'une API |
| `stoactl init` | Initialiser un nouveau projet STOA |
| `stoactl bridge` | Convertir une spec OpenAPI en CRDs Tool MCP |
| `stoactl doctor` | Lancer des vérifications de diagnostic |
| `stoactl apply` | Créer ou mettre à jour une ressource depuis un fichier YAML |
| `stoactl get` | Lister les ressources (apis, deployments, tools) |
| `stoactl delete` | Supprimer une ressource |
| `stoactl auth` | Commandes d'authentification |
| `stoactl config` | Gérer les contextes CLI |
| `stoactl token-usage` | Afficher les statistiques d'utilisation des tokens API |
| `stoactl version` | Afficher les informations de version |

---

## Commandes de Déploiement

### `stoactl deploy`

Déployer une API vers un environnement cible depuis un fichier [`stoa.yaml`](/docs/reference/stoa-yaml), ou utiliser les sous-commandes pour gérer les déploiements de manière impérative.

```bash
stoactl deploy [stoa.yaml] [flags]
stoactl deploy <sous-commande>
```

**Déploiement basé sur fichier (recommandé) :**

```bash
stoactl deploy ./stoa.yaml --env production
stoactl deploy ./api.yaml --env dev --watch
```

**Flags (déploiement basé sur fichier) :**

| Flag | Défaut | Description |
|------|---------|-------------|
| `--env` | — | Environnement cible : `dev`, `staging`, `production` (**obligatoire**) |
| `--watch`, `-w` | `false` | Interroger le statut de déploiement jusqu'à la fin (succès ou échec) |
| `--output`, `-o` | `table` | Format de sortie : `table`, `wide`, `yaml`, `json` |

---

#### `stoactl deploy create`

Créer un déploiement de manière impérative (sans fichier stoa.yaml).

```bash
stoactl deploy create --api-id <id> --env <env> --version <version> [flags]
```

**Flags :**

| Flag | Obligatoire | Description |
|------|----------|-------------|
| `--api-id` | **Oui** | ID de l'API à déployer |
| `--env` | **Oui** | Environnement cible |
| `--version` | **Oui** | Version à déployer (ex : `2.0.0`) |
| `--gateway` | Non | ID du gateway cible |
| `--commit` | Non | SHA du commit Git (pour la traçabilité) |
| `--watch`, `-w` | Non | Surveiller le déploiement jusqu'à la fin |

**Exemple :**

```bash
stoactl deploy create --api-id customer-api --env production --version 2.0.0 --watch
```

---

#### `stoactl deploy list`

Lister les déploiements récents avec des filtres optionnels.

```bash
stoactl deploy list [flags]
stoactl deploy ls [flags]
```

**Flags :**

| Flag | Description |
|------|-------------|
| `--api-id` | Filtrer par ID d'API |
| `--env` | Filtrer par environnement |
| `--status` | Filtrer par statut : `pending`, `in_progress`, `success`, `failed`, `rolled_back` |
| `--page` | Numéro de page (défaut : `1`) |
| `--page-size` | Éléments par page (défaut : `20`) |
| `-o` | Format de sortie : `table`, `wide`, `yaml`, `json` |

**Exemple :**

```bash
stoactl deploy list --env production --status success -o wide
```

---

#### `stoactl deploy get`

Obtenir des informations détaillées sur un déploiement spécifique.

```bash
stoactl deploy get <deployment-id>
```

**Exemple :**

```bash
stoactl deploy get deploy-abc12345
stoactl deploy get deploy-abc12345 -o json
```

---

#### `stoactl deploy rollback`

Annuler un déploiement vers sa version précédente.

```bash
stoactl deploy rollback <deployment-id>
```

**Exemple :**

```bash
# Trouver le déploiement à annuler
stoactl deploy list --api-id customer-api --env production

# Annuler
stoactl deploy rollback deploy-abc12345
```

---

### `stoactl logs`

Afficher l'historique de déploiement d'une API — déploiements récents, statuts et messages d'erreur.

```bash
stoactl logs <api-name> [flags]
```

**Flags :**

| Flag | Défaut | Description |
|------|---------|-------------|
| `--env` | — | Filtrer par environnement (dev, staging, production) |
| `--limit` | `10` | Nombre de déploiements récents à afficher |

**Exemple :**

```bash
stoactl logs customer-api
stoactl logs customer-api --env production --limit 5
```

**Colonnes de sortie :** `ID`, `ENV`, `VERSION`, `STATUS`, `BY`, `STARTED`, `MESSAGE`

**Valeurs de statut :**

| Statut | Signification |
|--------|---------|
| `OK` | Déploiement réussi |
| `FAIL` | Déploiement échoué (voir colonne MESSAGE) |
| `...` | Déploiement en cours |
| `WAIT` | Déploiement en file d'attente |
| `<<<` | Déploiement annulé (rollback) |

---

## Commandes de Projet

### `stoactl init`

Créer un nouveau projet STOA avec tout ce qui est nécessaire pour exécuter un MCP gateway local.

```bash
stoactl init <name> [flags]
```

**Flags :**

| Flag | Défaut | Description |
|------|---------|-------------|
| `--port` | `8080` | Port du gateway |
| `--dir` | `.` | Répertoire parent pour le projet |
| `--no-context` | `false` | Ignorer la création d'un contexte CLI local |

**Exemple :**

```bash
stoactl init my-api --port 9090
cd my-api
docker compose up -d
stoactl doctor
```

**Fichiers générés :**
- `docker-compose.yml` — Gateway + backend echo
- `stoa.yaml` — Configuration du gateway
- `echo-nginx.conf` — Backend echo (JSON statique pour les tests)
- `example-api.yaml` — Spec OpenAPI exemple pour le bridge
- `README.md` — Démarrage rapide spécifique au projet
- `tools/` — Répertoire de sortie pour le bridge

### `stoactl doctor`

Lancer 6 vérifications de diagnostic pour valider votre configuration locale.

```bash
stoactl doctor
```

**Vérifications :**

| Vérification | Ce qu'elle valide |
|-------|-----------------|
| Docker | Le daemon Docker est en cours d'exécution |
| Gateway | L'endpoint de santé répond (HTTP 200) |
| Keychain | Le trousseau de clés du système est accessible |
| Clé API | Un token d'authentification valide existe |
| Port | Le port du gateway est disponible |
| Endpoint MCP | L'endpoint SSE répond |

---

## Commandes Bridge

### `stoactl bridge`

Convertir une spécification OpenAPI 3.x en CRDs Tool STOA. Chaque opération path+method devient un tool MCP distinct.

```bash
stoactl bridge <spec-file> [flags]
```

**Flags :**

| Flag | Défaut | Description |
|------|---------|-------------|
| `--namespace` | *(obligatoire)* | Namespace cible pour les tools générés |
| `--output` | `./tools/` | Répertoire de sortie pour les fichiers YAML |
| `--server` | Depuis la spec | Remplacer `servers[0].url` |
| `--auth-secret` | — | Nom du secret K8s pour l'authentification |
| `--include-tags` | Tous | N'inclure que les opérations avec ces tags |
| `--exclude-tags` | Aucun | Exclure les opérations avec ces tags |
| `--include-ops` | Tous | N'inclure que ces operationIds |
| `--timeout` | `30s` | Timeout par défaut pour les tools générés |
| `--dry-run` | `false` | Afficher un résumé sans écrire de fichiers |
| `--apply` | `false` | Enregistrer les tools directement via l'API *(planifié)* |

**Exemples :**

```bash
# Générer des tools depuis une spec OpenAPI
stoactl bridge petstore.yaml --namespace tenant-acme

# Prévisualiser sans écrire de fichiers
stoactl bridge petstore.yaml --namespace tenant-acme --dry-run

# Filtrer par tags
stoactl bridge api.yaml --namespace default --include-tags payments --exclude-tags internal

# Remplacer l'URL du backend
stoactl bridge api.yaml --namespace default --server https://api.internal.com
```

**Règles de correspondance :**

| Champ OpenAPI | Champ CRD Tool |
|--------------|----------------|
| `operationId` | `metadata.name` (kebab-case) |
| `summary` | `spec.displayName` |
| `description` | `spec.description` |
| `servers[0].url + path` | `spec.endpoint` |
| Méthode HTTP | `spec.method` |
| `parameters` + `requestBody` | `spec.inputSchema` |
| `security` + `securitySchemes` | `spec.authentication` |
| `tags` | `spec.tags` |

---

## Commandes de Ressources

### `stoactl apply`

Créer ou mettre à jour une ressource depuis un fichier YAML.

```bash
stoactl apply -f <file>
```

**Exemple :**

```bash
# Appliquer un seul tool
stoactl apply -f tools/list-pets.yaml

# Appliquer tous les tools d'un répertoire
for f in tools/*.yaml; do stoactl apply -f "$f"; done
```

### `stoactl get`

Lister les ressources depuis le control plane.

```bash
stoactl get <resource-type>
```

**Types de ressources :** `apis`, `deployments`, `tools`

**Exemple :**

```bash
stoactl get apis
stoactl get tools
stoactl get deployments
```

### `stoactl delete`

Supprimer une ressource.

```bash
stoactl delete <resource-type> <name>
```

**Exemple :**

```bash
stoactl delete tool list-pets
stoactl delete api payment-api
```

---

## Commandes d'Authentification

### `stoactl auth login`

S'authentifier avec STOA Platform en utilisant le flux OAuth2 device flow.

```bash
stoactl auth login
```

Cette commande initie le flux d'autorisation par appareil :
1. Vous recevez un code et une URL
2. Ouvrez l'URL dans votre navigateur
3. Entrez le code pour autoriser
4. Les identifiants sont stockés dans votre trousseau de clés du système

### `stoactl auth logout`

Supprimer les identifiants stockés.

```bash
stoactl auth logout
```

### `stoactl auth whoami`

Afficher le statut d'authentification actuel.

```bash
stoactl auth whoami
```

### `stoactl auth rotate-key`

Générer une nouvelle clé API et la stocker dans le trousseau de clés du système.

```bash
stoactl auth rotate-key [flags]
```

| Flag | Défaut | Description |
|------|---------|-------------|
| `--auto` | `false` | Activer le rappel de rotation automatique |
| `--interval` | `90d` | Intervalle de rotation |

---

## Commandes de Configuration

### `stoactl config set-context`

Créer ou mettre à jour un contexte nommé.

```bash
stoactl config set-context <name> --server <url> --tenant <tenant>
```

**Exemple :**

```bash
stoactl config set-context prod --server ${STOA_API_URL} --tenant acme
stoactl config set-context local --server http://localhost:8080 --tenant default
```

### `stoactl config use-context`

Basculer vers un contexte nommé.

```bash
stoactl config use-context <name>
```

### `stoactl config get-contexts`

Lister tous les contextes configurés.

```bash
stoactl config get-contexts
```

---

## Commandes Utilitaires

### `stoactl token-usage`

Afficher les statistiques d'utilisation des tokens API.

```bash
stoactl token-usage
```

### `stoactl version`

Afficher les informations de version et de build.

```bash
stoactl version
```

---

## Flux de Travail

### Déployer une API (stoa.yaml)

```bash
# 1. S'authentifier
stoactl auth login

# 2. Créer stoa.yaml (ou exporter depuis la Console)
cat > stoa.yaml <<EOF
name: customer-api
version: 2.0.0
rate_limit:
  requests_per_minute: 1000
auth:
  type: oauth2
  issuer: ${STOA_AUTH_URL}/realms/acme
  required: true
EOF

# 3. Déployer en staging en premier
stoactl deploy ./stoa.yaml --env staging --watch

# 4. Vérifier les logs
stoactl logs customer-api --env staging

# 5. Déployer en production
stoactl deploy ./stoa.yaml --env production --watch
```

### Annuler un déploiement échoué

```bash
# 1. Trouver le déploiement échoué
stoactl deploy list --api-id customer-api --env production

# 2. Annuler
stoactl deploy rollback deploy-abc12345

# 3. Confirmer que l'annulation a réussi
stoactl logs customer-api --env production --limit 3
```

### Créer un pont API vers MCP

```bash
# 1. Configurer le projet
stoactl init my-api && cd my-api

# 2. Démarrer le gateway
docker compose up -d

# 3. Vérifier la configuration
stoactl doctor

# 4. Se connecter à la plateforme hébergée (optionnel)
stoactl config set-context prod --server ${STOA_API_URL} --tenant acme
stoactl auth login

# 5. Créer le pont vers MCP
stoactl bridge your-api.yaml --namespace default --output ./tools/

# 6. Enregistrer les tools
for f in tools/*.yaml; do stoactl apply -f "$f"; done

# 7. Vérifier
stoactl get tools
```

---

## Voir Aussi

- [Référence stoa.yaml](/docs/reference/stoa-yaml) — Référence complète des champs du spec de déploiement
- [ADR-045 : Spec API Déclarative stoa.yaml](/docs/architecture/adr/adr-045-stoa-yaml-declarative-spec) — Décisions de conception
- [Guide de Gestion des Environnements](/docs/guides/environment-management) — Gérer dev, staging, production
