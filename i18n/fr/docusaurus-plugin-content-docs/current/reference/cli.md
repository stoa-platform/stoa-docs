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
| `stoactl get` | Lister les ressources (apis, tenants, subscriptions, gateways) |
| `stoactl delete` | Supprimer une ressource |
| `stoactl auth` | Commandes d'authentification |
| `stoactl config` | Gérer les contextes CLI |
| `stoactl token-usage` | Afficher les statistiques d'utilisation des tokens API |
| `stoactl reconcile` | Réconcilier les contrats UAC depuis un instantané local de gouvernance |
| `stoactl gateway` | Gérer et inspecter les instances de passerelle (`gw`, `gateways`) |
| `stoactl mcp` | Lister les serveurs/outils MCP, invoquer un outil et vérifier la santé MCP |
| `stoactl catalog` | Détecter la dérive du catalogue ou déclencher une synchronisation |
| `stoactl subscription` | Lister, inspecter, approuver ou révoquer des abonnements (`sub`) |
| `stoactl tenant` | Provisionner, inspecter, lister ou supprimer des tenants |
| `stoactl connect` | Inspecter les agents `stoa-connect` (STOA Link) et découvrir des API |
| `stoactl audit` | Exporter les journaux d'audit d'un tenant (`table`, `json`, `yaml`, `csv`) |
| `stoactl completion` | Générer les scripts d'autocomplétion (`bash`, `zsh`, `fish`) |
| `stoactl version` | Afficher les informations de version |

### Flags Globaux

| Flag / Variable | Description |
|-----------------|-------------|
| `--tenant <id>` / `STOACTL_TENANT` | Surcharger l'identifiant de tenant du contexte actif pour la commande |
| `--admin` | Utiliser le jeton de compte de service configuré au lieu du jeton OIDC utilisateur |
| `--namespace <ns>` / `STOACTL_NAMESPACE` | **Déprécié** en flag global (affiche un avertissement au profit de `--tenant` ; `--namespace` / `-n` sur `stoactl bridge` reste actif pour les métadonnées CRD Kubernetes) |

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

**Types de ressources :** `apis`, `tenants`, `subscriptions`, `gateways`

**Exemple :**

```bash
stoactl get apis
stoactl get api payment-api
stoactl get subscriptions
```

Pour lister les déploiements, utilisez [`stoactl deploy list`](#stoactl-deploy-list).

### `stoactl delete`

Supprimer une ressource.

```bash
stoactl delete <resource-type> <name>
```

**Exemple :**

```bash
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

### `stoactl auth status`

Afficher le statut d'authentification actuel.

```bash
stoactl auth status
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

## Commandes de Gouvernance, Plateforme & Agents

### `stoactl reconcile`

Réconcilier les contrats UAC (Universal API Contracts) vers les passerelles cibles à partir d'un instantané local YAML ou JSON (`stoa-go/internal/cli/cmd/reconcile/`).

```bash
stoactl reconcile -f ./snapshot.yaml --once
stoactl reconcile -f ./snapshot.yaml --interval 10s --state .stoactl-reconcile.json
```

| Flag | Défaut | Description |
|------|--------|-------------|
| `--file`, `-f` | — | Fichier YAML ou JSON local décrivant les cibles et contrats (**obligatoire**) |
| `--state` | `.stoactl-reconcile.json` | Fichier local d'état de réconciliation |
| `--once` | `false` | Exécuter une seule passe de réconciliation puis quitter |
| `--interval` | `5s` | Intervalle de la boucle continue de réconciliation |

### `stoactl gateway`

Gérer les instances de passerelle enregistrées (alias : `gw`, `gateways` ; supporte `-o table|wide|yaml|json`).

```bash
stoactl gateway list
stoactl gateway get <gateway-id>
stoactl gateway health <gateway-id>
```

### `stoactl mcp`

Interagir avec les serveurs et outils MCP via l'API Control Plane (source de vérité par défaut) ou vérifier la santé publique MCP d'une passerelle (`health --gateway <url>`).

```bash
stoactl mcp list-servers
stoactl mcp list-tools --server weather-mcp
stoactl mcp call get-weather --server weather-mcp --input '{"q":"Paris"}'
stoactl mcp health
stoactl mcp health --gateway http://localhost:8080
```

| Sous-commande / Flag | Description |
|----------------------|-------------|
| `list-servers` | Lister les serveurs MCP enregistrés via l'API Control Plane (`--gateway` ignoré) |
| `list-tools [--server <nom>]` | Lister les outils MCP via l'API Control Plane (filtrables par serveur) |
| `call <outil> --server <nom> [--input '<json>']` | Invoquer un outil MCP via l'API Control Plane (`--server` obligatoire) |
| `health [--gateway <url>]` | Vérifier l'état de santé MCP (Control Plane par défaut, ou `GET <url>/mcp/health` public avec `--gateway`) |
| `--output`, `-o` | Format de sortie : `table`, `json`, `yaml` |

:::note Limites du mode direct `--gateway` (`mcp.go`)
Utilisez le parcours Control Plane ci-dessus pour `list-tools` et `call`. Dans `stoa-go` actuel, `--gateway <url>` fonctionne avec `stoactl mcp health --gateway <url>` (qui interroge l'endpoint public `GET <url>/mcp/health`), tandis que `list-tools --gateway` et `call --gateway` n'envoient pas le JWT Bearer requis sur `/mcp/v1/tools*` et `call --gateway` transmet `{"tool_name", "input"}` alors que `POST /mcp/v1/tools/invoke` attend `{"tool", "arguments"}` (`handlers.rs` ; `POST /mcp/tools/call` attend `{"name", "arguments"}`).
:::

### `stoactl catalog`

Inspecter la dérive du catalogue d'API ou déclencher une synchronisation (mode simulation par défaut sans `--apply`).

```bash
stoactl catalog sync --tenant acme
stoactl catalog sync --tenant acme --apply -o json
```

### `stoactl subscription`

Gérer les abonnements consommateurs aux API (alias : `sub`, `subscriptions` ; supporte `-o table|wide|yaml|json`).

```bash
stoactl subscription list --status pending
stoactl subscription get <subscription-id>
stoactl subscription approve <subscription-id>
stoactl subscription revoke <subscription-id>
```

### `stoactl tenant`

Gérer les tenants de la plateforme et vérifier le provisionnement Keycloak (`-o table|wide|yaml|json`).

```bash
stoactl tenant list
stoactl tenant create --name acme --display-name "Acme Corp" --owner-email ops@example.com
stoactl tenant status acme
stoactl tenant get acme
stoactl tenant delete acme
```

### `stoactl connect`

Inspecter les agents [`stoa-connect` (STOA Link)](/docs/guides/stoa-connect-quickstart) et lancer une découverte ponctuelle sur une API d'administration.

```bash
# Vérifier l'état de santé d'un agent stoa-connect / STOA Link (:8090/health)
stoactl connect status --url http://localhost:8090

# Découvrir les API directement auprès d'une passerelle tierce
stoactl connect discover --admin-url http://localhost:8001 --type kong --token "${KONG_ADMIN_TOKEN}"
```

:::note Mode Envoy xDS vs `stoactl connect discover` / `sync`
- `stoactl connect discover` ne prend en charge que les passerelles dotées d'une API d'administration (`--type kong|gravitee|webmethods|auto`). **Envoy** upstream ne dispose pas de découverte par API d'administration : le mode Envoy se configure sur l'agent `stoa-connect` via `STOA_GATEWAY_TYPE=envoy` et l'ADS mTLS loopback (variables `STOA_ENVOY_*` ; voir le [Guide stoa-connect](/docs/guides/stoa-connect-quickstart)).
- La CLI définit également `stoactl connect sync --url <url>` (`POST <url>/sync`), mais `cmd/stoa-connect/main.go` sur `main` actuel ne monte que `/health`, `/metrics` et `/webhook/events` (n'utilisez pas `connect sync` sur `stoa-connect` ; la synchronisation des routes et politiques s'effectue automatiquement via les boucles périodiques / SSE de l'agent).
:::

### `stoactl audit`

Exporter les journaux d'audit d'un tenant avec masquage des données personnelles (PII) activé par défaut.

```bash
stoactl audit export --tenant acme --since 7d -o csv
stoactl audit export --tenant acme --action subscription.approved --redact-pii=true -o json
```

| Flag | Défaut | Description |
|------|--------|-------------|
| `--tenant` | — | Identifiant du tenant (**obligatoire**) |
| `--since` | `7d` | Fenêtre temporelle (`24h`, `7d`, `30d` ou date ISO-8601) |
| `--action` | `""` | Filtrer par type d'action d'audit |
| `--redact-pii` | `true` | Masquer les adresses e-mail et IP dans l'export |
| `--output`, `-o` | `table` | Format de sortie : `table`, `json`, `yaml`, `csv` |

### `stoactl completion`

Générer les scripts d'autocomplétion shell pour `bash`, `zsh` ou `fish`.

```bash
stoactl completion zsh > "${fpath[1]}/_stoactl"
stoactl completion bash > /etc/bash_completion.d/stoactl
stoactl completion fish > ~/.config/fish/completions/stoactl.fish
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
  issuer: ${STOA_AUTH_URL}/realms/stoa
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
```

---

## Voir Aussi

- [Référence stoa.yaml](/docs/reference/stoa-yaml) — Référence complète des champs du spec de déploiement
- [ADR-045 : Spec API Déclarative stoa.yaml](/docs/architecture/adr/adr-045-stoa-yaml-declarative-spec) — Décisions de conception
- [Guide de Gestion des Environnements](/docs/guides/environment-management) — Gérer dev, staging, production
