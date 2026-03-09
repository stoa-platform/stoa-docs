---
slug: stoactl-cli-manage-apis-terminal
title: "stoactl : Gérez vos APIs, Abonnements et MCP depuis le Terminal"
description: "kubectl pour votre gateway API. Installez stoactl, gérez les APIs et abonnements, et intégrez-les dans vos pipelines CI/CD depuis la ligne de commande."
authors: [stoa-team]
tags: [tutorial, quickstart, api-gateway]
keywords:
  - stoactl CLI
  - API management terminal
  - command line API gateway
  - kubectl for APIs
  - API gateway CLI tool
  - scriptable API management
  - CI/CD API deployment
---
<!-- last verified: 2026-02 -->

stoactl est l'interface en ligne de commande de STOA Platform qui apporte une gestion d'API de style kubectl à votre terminal. Installez-le en une commande, authentifiez-vous auprès de votre Control Plane API, et gérez les APIs, abonnements et outils MCP sans toucher à la console web — idéal pour les scripts, les pipelines CI/CD et les développeurs qui préfèrent le terminal.

<!-- truncate -->

## Qu'est-ce que stoactl ?

stoactl (prononcé "stoa-control") est un outil CLI basé sur Go et construit avec Cobra qui fournit une interface déclarative et scriptable à la Control Plane API de STOA Platform. Si vous avez utilisé `kubectl` pour gérer des ressources Kubernetes ou `gh` pour interagir avec GitHub, stoactl suit la même philosophie : des commandes puissantes et composables qui s'intègrent naturellement dans les workflows d'automatisation.

L'outil CLI abstrait les appels HTTP API et les payloads JSON, les remplaçant par des commandes intuitives comme `stoactl apis create` ou `stoactl tools list`. Il est conçu pour trois cas d'usage principaux :

1. **Développement local** : Créez rapidement des APIs de test, inspectez des abonnements et vérifiez les enregistrements d'outils MCP sans changer de navigateur
2. **Pipelines CI/CD** : Automatisez le déploiement et la configuration d'API dans le cadre de votre processus de release
3. **Infrastructure as Code** : Scriptez des configurations multi-tenant complexes avec des scripts shell ou des Makefiles qui orchestrent la création d'API dans différents environnements

Contrairement aux consoles web qui nécessitent des clics manuels dans des formulaires, stoactl permet des workflows reproductibles et versionnés. Vous pouvez committer vos scripts de gestion d'API aux côtés du code d'application, rendant les changements d'infrastructure révisables et auditables via les workflows Git standard.

## Installation

stoactl supporte trois méthodes d'installation selon votre plateforme et vos préférences.

### Go Install (Multi-Plateforme)

Si vous avez Go 1.21+ installé, utilisez `go install` pour la dernière version :

```bash
go install github.com/stoa-platform/stoactl@latest
```

Cela place le binaire dans `$GOPATH/bin` (généralement `~/go/bin`). Assurez-vous que ce répertoire est dans votre `PATH` :

```bash
export PATH="$PATH:$(go env GOPATH)/bin"
stoactl version
```

### Homebrew (macOS et Linux)

Pour les utilisateurs macOS ou Linux qui préfèrent les gestionnaires de paquets :

```bash
brew tap stoa-platform/stoactl
brew install stoactl
```

Homebrew gère la configuration du PATH automatiquement. Vérifiez l'installation :

```bash
stoactl --help
```

### Téléchargements de Binaires

Des binaires pré-compilés pour macOS (Intel et Apple Silicon), Linux (x64 et ARM64) et Windows sont disponibles sur la [page GitHub releases](https://github.com/stoa-platform/stoactl/releases). Téléchargez le binaire approprié pour votre plateforme :

```bash
# Exemple pour Linux x64
wget https://github.com/stoa-platform/stoactl/releases/latest/download/stoactl-linux-amd64
chmod +x stoactl-linux-amd64
sudo mv stoactl-linux-amd64 /usr/local/bin/stoactl
```

Pour Windows, téléchargez le fichier `.exe` et ajoutez son répertoire à votre PATH système.

## Configuration

Avant d'utiliser stoactl, vous devez vous authentifier auprès de votre Control Plane API STOA et configurer un contexte pour votre environnement.

### Authentification

stoactl utilise des clés API ou des tokens OAuth pour l'authentification. La méthode la plus simple pour démarrer est l'authentification par clé API :

```bash
stoactl login --server ${STOA_API_URL}
```

Cette commande vous demande une clé API, que vous pouvez générer depuis la Console STOA :

1. Naviguez vers **Paramètres** → **Clés API** dans l'interface Console
2. Cliquez sur **Générer une Nouvelle Clé**
3. Copiez la clé (elle n'est affichée qu'une fois)
4. Collez-la quand `stoactl login` vous le demande

stoactl stocke les credentials dans `~/.stoactl/config.yaml`. Le fichier est créé avec des permissions `0600` pour protéger vos clés.

### Gestion du Contexte

Si vous travaillez avec plusieurs environnements (développement, staging, production), stoactl supporte la commutation de contexte similaire à `kubectl` :

```bash
# Ajouter un contexte staging
stoactl context add staging --server https://staging-api.example.com --token <TOKEN>

# Ajouter un contexte production
stoactl context add production --server ${STOA_API_URL} --token <TOKEN>

# Basculer entre les contextes
stoactl context use staging
stoactl context use production

# Voir le contexte actuel
stoactl context current
```

Les contextes sont stockés dans le même fichier `~/.stoactl/config.yaml`. Chaque contexte peut pointer vers un serveur API différent et utiliser des credentials différentes, rendant sûr de tester des commandes en staging avant de les exécuter en production.

### Variables d'Environnement

Pour les environnements CI/CD, évitez de stocker des credentials dans des fichiers de configuration. stoactl respecte ces variables d'environnement :

```bash
export STOACTL_SERVER="${STOA_API_URL}"
export STOACTL_TOKEN="your-api-key-here"
stoactl apis list  # Utilise les variables d'env plutôt que le fichier de config
```

Cette approche s'intègre proprement avec les gestionnaires de secrets comme GitHub Actions secrets, HashiCorp Vault ou Kubernetes secrets.

## Commandes Principales

stoactl organise les commandes en groupes logiques suivant les types de ressources dans la Control Plane API.

### Gestion des APIs

Le groupe de commandes `apis` gère les opérations CRUD pour les ressources API.

#### Lister Toutes les APIs

Voir toutes les APIs dans votre tenant actuel :

```bash
stoactl apis list
```

La sortie inclut le nom de l'API, l'ID, le chemin de base, le type de gateway et le statut :

```
NAME              ID                                     BASE PATH    GATEWAY       STATUS
petstore-api      a1b2c3d4-e5f6-7890-abcd-ef1234567890  /petstore    stoa-edge     active
payment-api       f1e2d3c4-b5a6-9876-dcba-fe9876543210  /payments    kong          active
legacy-soap-api   9a8b7c6d-5e4f-3210-fedc-ba0987654321  /legacy      webmethods    inactive
```

Filtrer par type de gateway ou statut :

```bash
stoactl apis list --gateway stoa-edge
stoactl apis list --status active
```

#### Créer une API

Créez une API à partir d'un fichier de spécification OpenAPI :

```bash
stoactl apis create --name my-api --spec openapi.yaml
```

Le flag `--spec` accepte un chemin de fichier local ou une URL. stoactl valide le schéma OpenAPI avant de le soumettre à la Control Plane API. Pour une création en ligne sans fichier de spec :

```bash
stoactl apis create \
  --name quicktest-api \
  --base-path /test \
  --target-url https://httpbin.org \
  --gateway stoa-edge
```

Cela crée une configuration d'API minimale qui proxifie les requêtes vers l'URL cible.

#### Décrire une API

Obtenez des informations détaillées sur une API spécifique, incluant les politiques, les limites de débit et les abonnements associés :

```bash
stoactl apis describe petstore-api
```

La sortie inclut :
- La spécification OpenAPI (si disponible)
- Les politiques attachées (CORS, rate limiting, authentification)
- Les abonnements actifs
- La configuration de routage du gateway

#### Supprimer une API

Supprimer une API par nom ou ID :

```bash
stoactl apis delete petstore-api
```

Ajoutez `--force` pour ignorer la demande de confirmation :

```bash
stoactl apis delete petstore-api --force
```

La suppression d'une API révoque tous les abonnements associés et supprime les routes du gateway. Cette action est irréversible.

### Gestion des Abonnements

Les abonnements lient les applications (consommateurs d'API) aux APIs et appliquent les limites de débit, les quotas et le contrôle d'accès.

#### Lister les Abonnements

Voir tous les abonnements pour le tenant actuel :

```bash
stoactl subscriptions list
```

Filtrer par API ou application :

```bash
stoactl subscriptions list --api petstore-api
stoactl subscriptions list --app mobile-app
```

#### Créer un Abonnement

Accorder à une application l'accès à une API :

```bash
stoactl subscriptions create \
  --app mobile-app \
  --api petstore-api \
  --plan standard
```

Le flag `--plan` référence un plan de tarification/rate limit défini dans la Console. Les plans courants incluent `free`, `standard`, `premium`. Chaque plan spécifie des limites de débit (ex : 1000 requêtes/heure) et des quotas.

#### Révoquer un Abonnement

Supprimer l'accès pour une application :

```bash
stoactl subscriptions revoke <SUBSCRIPTION_ID>
```

La révocation d'un abonnement bloque immédiatement les requêtes de l'application vers l'API. La clé API de l'application reste valide mais retourne `403 Forbidden` pour l'API révoquée.

### Gestion des Outils MCP

Les outils MCP (Model Context Protocol) sont des endpoints d'API accessibles par les agents IA enregistrés dans le STOA Gateway. Le groupe de commandes `tools` gère ces ressources.

#### Lister les Outils

Voir tous les outils MCP enregistrés pour un tenant :

```bash
stoactl tools list --tenant acme
```

La sortie inclut le nom de l'outil, l'URL d'endpoint, la méthode HTTP et la description :

```
NAME                ENDPOINT                              METHOD  DESCRIPTION
create-customer     /api/customers                        POST    Create a new customer record
get-invoice         /api/invoices/{id}                    GET     Retrieve invoice by ID
process-payment     /api/payments                         POST    Process a payment transaction
```

#### Créer un Outil

Enregistrer un nouvel outil MCP depuis une définition JSON :

```bash
stoactl tools create --file tool-definition.json --tenant acme
```

Exemple `tool-definition.json` :

```json
{
  "name": "send-notification",
  "displayName": "Send Notification",
  "description": "Send a push notification to a user",
  "endpoint": "${STOA_API_URL}/notifications",
  "method": "POST",
  "inputSchema": {
    "type": "object",
    "properties": {
      "userId": {"type": "string"},
      "message": {"type": "string"}
    },
    "required": ["userId", "message"]
  }
}
```

Le gateway valide la définition de l'outil par rapport au JSON Schema MCP avant de l'accepter.

#### Supprimer un Outil

Supprimer un outil par nom :

```bash
stoactl tools delete send-notification --tenant acme
```

Cela retire l'outil de la liste `/tools` du serveur MCP. Les agents IA ne le verront plus dans leur catalogue d'outils.

### Statut du Système

La commande `status` fournit un health check pour votre déploiement STOA Platform :

```bash
stoactl status
```

La sortie inclut :
- Connectivité et version de la Control Plane API
- Santé du gateway (par type de gateway si plusieurs gateways configurés)
- Utilisateur actuel et contexte de tenant
- Fonctionnalités actives (ex : metering activé, mode GitOps)

Cette commande est utile dans les pipelines CI/CD pour vérifier que la plateforme est accessible avant d'exécuter des scripts d'automatisation.

## Utilisation Avancée

### Scripts de Workflow

La sortie prévisible et les codes de sortie de stoactl en font l'idéal pour les scripts shell. Voici un script qui crée plusieurs APIs à partir d'un répertoire de specs OpenAPI :

```bash
#!/bin/bash
set -e

SPECS_DIR="./openapi-specs"
GATEWAY="stoa-edge"

for spec_file in "$SPECS_DIR"/*.yaml; do
  api_name=$(basename "$spec_file" .yaml)
  echo "Creating API: $api_name"

  stoactl apis create \
    --name "$api_name" \
    --spec "$spec_file" \
    --gateway "$GATEWAY" \
    || echo "Failed to create $api_name (may already exist)"
done

echo "All APIs created successfully"
```

Pour les scripts de production, ajoutez des vérifications d'idempotence :

```bash
if stoactl apis describe "$api_name" &>/dev/null; then
  echo "API $api_name already exists, skipping"
else
  stoactl apis create --name "$api_name" --spec "$spec_file"
fi
```

### Intégration CI/CD

Intégrez stoactl dans GitHub Actions pour automatiser les déploiements d'API à chaque release :

```yaml
name: Deploy APIs

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install stoactl
        run: |
          go install github.com/stoa-platform/stoactl@latest
          echo "$HOME/go/bin" >> $GITHUB_PATH

      - name: Deploy APIs
        env:
          STOACTL_SERVER: ${{ secrets.STOA_API_URL }}
          STOACTL_TOKEN: ${{ secrets.STOA_API_KEY }}
        run: |
          stoactl apis create --name payment-api --spec specs/payment-openapi.yaml
          stoactl apis create --name orders-api --spec specs/orders-openapi.yaml
```

Ce pattern fonctionne avec GitLab CI, Jenkins, CircleCI ou n'importe quel système CI/CD supportant les commandes shell. Pour les workflows GitOps, combinez stoactl avec des outils comme ArgoCD ou Flux — consultez notre [tutoriel GitOps en 10 Minutes](/blog/gitops-in-10-minutes) pour les détails de configuration.

### Sortie JSON pour le Parsing

De nombreuses commandes stoactl supportent `--output json` pour une sortie lisible par machine :

```bash
stoactl apis list --output json | jq '.[] | select(.status == "active") | .name'
```

Cela permet des workflows avancés comme :
- Générer des rapports sur l'utilisation des APIs
- Filtrer des ressources par critères personnalisés
- Chaîner plusieurs commandes avec `xargs` ou `parallel`

### Opérations en Masse

Supprimer toutes les APIs inactives en une commande :

```bash
stoactl apis list --status inactive --output json \
  | jq -r '.[].id' \
  | xargs -I {} stoactl apis delete {} --force
```

Créer des abonnements pour plusieurs applications depuis un CSV :

```bash
# Format apps.csv : app_name,api_name,plan
tail -n +2 apps.csv | while IFS=, read -r app api plan; do
  stoactl subscriptions create --app "$app" --api "$api" --plan "$plan"
done
```

## Comparaison avec la Console Web

Bien que la Console STOA offre une interface visuelle pour gérer les APIs, stoactl présente des avantages distincts pour certains workflows :

| Fonctionnalité | Console Web | stoactl CLI |
|----------------|-------------|-------------|
| **Configuration initiale** | Assistants guidés, formulaires visuels | Nécessite la compréhension des flags CLI |
| **Opérations en masse** | Clics manuels, répétitifs | Scriptable, automatisé |
| **Contrôle de version** | Export manuel, pas d'historique | Scripts commités dans Git |
| **Intégration CI/CD** | Non possible | Natif (commandes shell) |
| **Vitesse pour les power users** | Plus lent (chargements de page, clics) | Instantané (appels API directs) |
| **Piste d'audit** | Logs d'actions UI | Historique des commandes, logs shell |
| **Gestion multi-environnements** | Changement de tenant manuel | Commutation de contexte (`stoactl context use`) |

Utilisez la Console pour le travail exploratoire et la confirmation visuelle. Utilisez stoactl pour l'automatisation, les tâches répétitives et les workflows infrastructure-as-code. De nombreuses équipes utilisent les deux : la Console pour la configuration initiale, stoactl pour les opérations du jour 2.

Pour une documentation CLI complète, consultez la [Référence CLI](/docs/reference/cli) dans la documentation STOA.

## FAQ

### stoactl peut-il gérer plusieurs tenants ?

Oui. Utilisez le flag `--tenant` sur les commandes qui le supportent, ou configurez des contextes séparés pour chaque tenant :

```bash
stoactl context add tenant-a --server ${STOA_API_URL} --token <TOKEN_A>
stoactl context add tenant-b --server ${STOA_API_URL} --token <TOKEN_B>
stoactl context use tenant-a
```

Chaque contexte peut s'authentifier comme un utilisateur différent avec des permissions de tenant différentes.

### Comment utiliser stoactl avec une instance STOA auto-hébergée ?

Pointez stoactl vers votre URL de Control Plane API auto-hébergée lors de la connexion :

```bash
stoactl login --server https://api.your-domain.com
```

Pour les déploiements quickstart avec Docker Compose, l'API est typiquement à `http://localhost:8000`. Consultez le [MCP Gateway Quickstart](/blog/mcp-gateway-quickstart-docker) pour les détails de configuration auto-hébergée.

### stoactl est-il sûr pour un usage en production ?

Oui. stoactl utilise la même Control Plane API que l'interface Console, avec la même authentification, autorisation et journalisation d'audit. Toutes les commandes nécessitent des clés API valides avec les permissions RBAC appropriées. Pour les pipelines de production :

1. Utilisez des tokens de compte de service dédiés (pas de clés API personnelles)
2. Stockez les tokens dans des gestionnaires de secrets (GitHub Secrets, Vault, etc.)
3. Activez la journalisation d'audit sur la Control Plane API pour suivre les actions stoactl
4. Testez les scripts en staging avant de les exécuter en production

stoactl n'inclut pas encore de flag `--dry-run`, mais vous pouvez prévisualiser les changements avec des commandes `describe` avant d'exécuter des opérations destructives comme `delete`.

## Prochaines Étapes

stoactl est un outil puissant pour les développeurs qui préfèrent les workflows en terminal et les équipes implémentant l'infrastructure-as-code pour la gestion d'API. Commencez par les bases — lister les APIs, décrire une ressource, créer une API de test — puis évoluez vers les scripts avancés et l'automatisation CI/CD.

Pour une compréhension plus large des patterns de gestion d'API, lisez [Guide Gateway API Open Source 2026](/blog/open-source-api-gateway-2026). Si vous êtes nouveau sur STOA Platform, le [Guide de Démarrage Rapide](/docs/guides/quickstart) vous guide à travers votre première API en 5 minutes via la console web, puis montre comment reproduire le même workflow avec stoactl.

Explorez des tutoriels supplémentaires :
- [Créez Votre Première API en 5 Minutes](/blog/stoa-quickstart-first-api-5-minutes)
- [GitOps en 10 Minutes](/blog/gitops-in-10-minutes)
- [MCP Gateway Quickstart avec Docker](/blog/mcp-gateway-quickstart-docker)

Vous avez des questions ou des retours sur stoactl ? Rejoignez les [GitHub Discussions](https://github.com/stoa-platform/stoactl/discussions) ou contribuez au code source du CLI — il est open source sous Apache 2.0.
