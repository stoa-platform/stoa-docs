---
slug: stoa-docker-compose-local-development
title: "Lancer la Stack Complète en Local avec Docker Compose"
description: "API, Console, Portal, Gateway et Keycloak sur votre poste de travail. Configuration Docker Compose pas à pas pour le développement et les tests en local."
authors: [stoa-team]
tags: [tutorial, docker, quickstart]
keywords:
  - docker compose api gateway
  - stoa platform local development
  - api gateway docker setup
  - mcp gateway local testing
  - kubernetes api management local
---
<!-- last verified: 2026-02 -->

Lancez la stack complète de STOA Platform sur votre machine locale avec Docker Compose. Ce tutoriel vous montre comment démarrer l'API Control Plane, la Console UI, le Developer Portal, le MCP Gateway, Keycloak et PostgreSQL — tous configurés et prêts à l'emploi en moins de 10 minutes.

<!-- truncate -->

## Ce que vous allez lancer

STOA Platform est conçu comme une solution de gestion d'API cloud-native et Kubernetes-first. Mais pour le développement local, les tests et l'apprentissage, vous pouvez faire tourner toute la stack avec Docker Compose sans avoir besoin d'un cluster Kubernetes.

La stack locale comprend :

```
┌─────────────────────────────────────────────────┐
│  Developer Portal (React)      :8080            │
│  Console UI (React)             :3000           │
│  Control Plane API (FastAPI)   :8000           │
│  MCP Gateway (Rust)             :8080           │
│  Keycloak (Auth)                :8443           │
│  PostgreSQL (DB)                :5432           │
└─────────────────────────────────────────────────┘
```

**Vue d'ensemble de l'architecture** :
- **Control Plane API** — gère les APIs, politiques, applications et la configuration des gateways
- **Console UI** — interface d'administration pour les opérateurs de la plateforme (RBAC activé)
- **Developer Portal** — portail en libre-service pour les consommateurs d'API afin de découvrir et de s'abonner aux APIs
- **MCP Gateway** — gateway basé sur Rust qui proxifie les requêtes API et expose des outils MCP pour les agents IA
- **Keycloak** — fournisseur OpenID Connect pour l'authentification (pré-configuré avec 4 rôles RBAC)
- **PostgreSQL** — base de données pour l'API Control Plane et Keycloak

Il s'agit d'un environnement entièrement fonctionnel. Vous pouvez créer des APIs, configurer le rate limiting, tester les outils MCP avec Claude Desktop et expérimenter les workflows GitOps — sans avoir à déployer sur un fournisseur cloud.

Pour une vue d'ensemble de l'architecture et des principes de conception de STOA, consultez notre [Guide Open Source API Gateway](/blog/open-source-api-gateway-2026).

## Prérequis

Avant de commencer, assurez-vous d'avoir :

1. **Docker** 20.10+ installé ([Obtenir Docker](https://docs.docker.com/get-docker/))
2. **Docker Compose** v2.0+ (inclus avec Docker Desktop, ou à installer via le plugin `docker compose`)
3. **8 Go de RAM minimum** (12 Go recommandés pour un fonctionnement fluide)
4. **10 Go d'espace disque libre** (pour les images et les volumes)
5. **Git** pour cloner le dépôt

Vérifiez votre configuration :

```bash
docker --version
# Docker version 24.0.0 or higher

docker compose version
# Docker Compose version v2.20.0 or higher
```

**Remarque** : ce guide utilise `docker compose` (syntaxe v2, avec un espace et non un tiret). Si vous utilisez une ancienne installation Docker, remplacez `docker compose` par `docker-compose` partout.

## Étape 1 : Cloner et configurer

Clonez le dépôt STOA Quickstart :

```bash
git clone https://github.com/stoa-platform/stoa-quickstart.git
cd stoa-quickstart
```

Le dépôt contient :
- `docker-compose.yml` — définitions des services pour tous les composants
- `.env.example` — modèle de configuration
- `keycloak/realm-export.json` — realm STOA pré-configuré avec 4 rôles et des utilisateurs de test
- `init-scripts/` — scripts d'initialisation de la base de données

Copiez le modèle d'environnement :

```bash
cp .env.example .env
```

Ouvrez `.env` et vérifiez les paramètres. Pour le développement local, les valeurs par défaut fonctionnent immédiatement :

```bash
# Control Plane API
API_BASE_URL=http://localhost:8000
DATABASE_URL=postgresql://stoa:stoa@postgres:5432/stoa

# Keycloak
KEYCLOAK_BASE_URL=https://localhost:8443
KEYCLOAK_REALM=stoa
KEYCLOAK_CLIENT_ID=control-plane-api
KEYCLOAK_CLIENT_SECRET=your-secret-here

# Gateway
GATEWAY_PORT=8080
STOA_CONTROL_PLANE_API_KEY=demo-gateway-key

# Console UI
VITE_API_URL=http://localhost:8000
VITE_KEYCLOAK_URL=https://localhost:8443
VITE_KEYCLOAK_REALM=stoa
VITE_KEYCLOAK_CLIENT_ID=control-plane-ui

# Portal
VITE_PORTAL_API_URL=http://localhost:8000
VITE_PORTAL_KEYCLOAK_CLIENT_ID=stoa-portal
```

**Important** : le `KEYCLOAK_CLIENT_SECRET` est généré automatiquement au démarrage de Keycloak. Laissez-le tel quel pour le premier démarrage — le script d'initialisation le renseignera.

## Étape 2 : Démarrer la stack

Démarrez tous les services en une seule commande :

```bash
docker compose up -d
```

Docker Compose va :
1. Télécharger les images de tous les services (~2 Go au total, uniquement lors du premier démarrage)
2. Créer un réseau Docker (`stoa-network`)
3. Démarrer PostgreSQL et attendre qu'il soit disponible
4. Démarrer Keycloak et importer le realm
5. Démarrer l'API Control Plane, la Console UI, le Portal et le Gateway

Suivez les logs de démarrage :

```bash
docker compose logs -f
```

**Temps de démarrage** : 2 à 3 minutes. Vous verrez :
- PostgreSQL : `database system is ready to accept connections`
- Keycloak : `Keycloak 23.0.0 started in XXXXms`
- Control Plane API : `Uvicorn running on http://0.0.0.0:8000`
- Gateway : `stoa-gateway listening on 0.0.0.0:8080`

Appuyez sur `Ctrl+C` pour arrêter de suivre les logs (les services continuent de tourner).

Vérifiez que tous les services sont en cours d'exécution :

```bash
docker compose ps
```

Résultat attendu :

```
NAME                      STATUS    PORTS
stoa-control-plane-api    Up        0.0.0.0:8000->8000/tcp
stoa-control-plane-ui     Up        0.0.0.0:3000->3000/tcp
stoa-portal               Up        0.0.0.0:8080->8080/tcp
stoa-gateway              Up        0.0.0.0:8081->8080/tcp
keycloak                  Up        0.0.0.0:8443->8443/tcp
postgres                  Up        0.0.0.0:5432->5432/tcp
```

**Remarque sur le mapping de ports** : le Gateway est mappé sur le port `8081` de l'hôte (et non `8080`) pour éviter les conflits avec le Portal. À l'intérieur du réseau Docker, il écoute sur le port `8080`.

## Étape 3 : Accéder aux services

Tous les services sont maintenant accessibles sur votre machine locale.

### Console UI (Interface d'administration)

Ouvrez [http://localhost:3000](http://localhost:3000)

**Utilisateurs pré-configurés** (issus de l'export du realm Keycloak) :

| Nom d'utilisateur | Mot de passe | Rôle | Permissions |
|----------|----------|------|-------------|
| `cpi-admin` | `admin` | CPI Admin | Accès complet à la plateforme (stoa:admin) |
| `tenant-admin` | `admin` | Tenant Admin | Tenant propre uniquement (stoa:write, stoa:read) |
| `devops` | `admin` | DevOps | Déployer/promouvoir (stoa:write, stoa:read) |
| `viewer` | `admin` | Viewer | Lecture seule (stoa:read) |

Connectez-vous en tant que `cpi-admin` / `admin` pour accéder à toutes les fonctionnalités.

### Developer Portal (Libre-service)

Ouvrez [http://localhost:8080](http://localhost:8080)

Le Portal est l'endroit où les consommateurs d'API découvrent les APIs disponibles, consultent la documentation, créent des applications et génèrent des clés d'API. Aucune connexion n'est requise pour la navigation ; l'authentification est nécessaire pour les souscriptions.

### Control Plane API (REST API)

URL de base : [http://localhost:8000](http://localhost:8000)

Documentation interactive :
- Swagger UI : [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc : [http://localhost:8000/redoc](http://localhost:8000/redoc)

Vérification de l'état :

```bash
curl http://localhost:8000/health
# {"status":"healthy","version":"0.1.0"}
```

### MCP Gateway

URL de base : [http://localhost:8081](http://localhost:8081)

Vérification de l'état :

```bash
curl http://localhost:8081/health
# {"status":"healthy","mode":"edge-mcp"}
```

Le Gateway fonctionne en mode `edge-mcp` par défaut, ce qui signifie qu'il est optimisé pour les intégrations avec les agents IA via le protocole MCP. Pour plus d'informations sur la configuration du MCP Gateway, consultez notre [Guide de démarrage rapide MCP Gateway](/blog/mcp-gateway-quickstart-docker).

### Keycloak (Fournisseur d'identité)

Console d'administration : [https://localhost:8443/admin](https://localhost:8443/admin)

**Identifiants** : `admin` / `admin` (pré-configurés dans l'export du realm)

Le realm STOA est pré-importé avec :
- 4 rôles : `cpi-admin`, `tenant-admin`, `devops`, `viewer`
- 4 utilisateurs de test (mots de passe tous `admin`)
- 3 clients : `control-plane-api`, `control-plane-ui`, `stoa-portal`
- Scopes : `stoa:read`, `stoa:write`, `stoa:admin`

**Remarque** : Keycloak utilise un certificat auto-signé pour HTTPS. Votre navigateur affichera un avertissement de sécurité. Cliquez sur « Avancé » et continuez malgré tout pour le développement local.

### PostgreSQL

Chaîne de connexion :

```
postgresql://stoa:stoa@localhost:5432/stoa
```

Connexion avec `psql` :

```bash
docker compose exec postgres psql -U stoa -d stoa
```

## Étape 4 : Créer votre première API

Créons une API via la Console UI et testons-la à travers le Gateway.

### Via la Console UI (Recommandé)

1. Ouvrez [http://localhost:3000](http://localhost:3000)
2. Connectez-vous en tant que `cpi-admin` / `admin`
3. Accédez à **APIs** → **Créer une API**
4. Remplissez le formulaire :
   - **Nom** : `httpbin-test`
   - **Nom d'affichage** : HTTPBin Test API
   - **Description** : API de test utilisant httpbin.org
   - **Chemin de base** : `/httpbin`
   - **URL du backend** : `https://httpbin.org`
   - **Instance Gateway** : `local-gateway` (créée automatiquement au démarrage)
5. Cliquez sur **Créer**

L'API est maintenant synchronisée avec le Gateway. Testez-la :

```bash
curl http://localhost:8081/httpbin/get
```

Vous devriez voir une réponse JSON de httpbin.org, proxifiée par le STOA Gateway.

### Via l'API REST

Si vous préférez la ligne de commande, utilisez directement l'API Control Plane :

```bash
# Obtenir un token d'accès
ACCESS_TOKEN=$(curl -s -X POST "https://localhost:8443/realms/stoa/protocol/openid-connect/token" \
  --insecure \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=cpi-admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=control-plane-api" \
  | jq -r '.access_token')

# Créer l'API
curl -X POST "http://localhost:8000/v1/apis" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "httpbin-test",
    "display_name": "HTTPBin Test API",
    "description": "Test API using httpbin.org",
    "base_path": "/httpbin",
    "backend_url": "https://httpbin.org",
    "gateway_instance_id": "local-gateway"
  }'
```

Pour un guide plus détaillé sur la création et la configuration d'APIs, consultez notre [Guide de première API en 5 minutes](/blog/stoa-quickstart-first-api-5-minutes).

## Étape 5 : Tester les outils MCP

Le STOA Gateway expose les APIs comme des outils MCP que les agents IA peuvent découvrir et invoquer. Vérifions l'intégration MCP.

### Lister les outils disponibles

```bash
curl http://localhost:8081/mcp/tools
```

Réponse :

```json
{
  "tools": [
    {
      "name": "httpbin_test_get",
      "description": "HTTPBin Test API - GET /httpbin/get",
      "inputSchema": {
        "type": "object",
        "properties": {}
      }
    }
  ]
}
```

Chaque endpoint d'API que vous créez est automatiquement exposé comme un outil MCP avec un nom généré selon le pattern : `{api_name}_{method}_{path}`.

### Invoquer un outil

```bash
curl -X POST "http://localhost:8081/mcp/tools/httpbin_test_get/call" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {}
  }'
```

Le Gateway proxifiera la requête vers `https://httpbin.org/get` et retournera la réponse.

### Connecter à Claude Desktop

Pour utiliser le STOA Gateway avec Claude Desktop (ou tout client compatible MCP) :

1. Ajoutez cette configuration à vos paramètres MCP :

```json
{
  "mcpServers": {
    "stoa-local": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": {
        "MCP_SERVER_URL": "http://localhost:8081/mcp"
      }
    }
  }
}
```

2. Redémarrez Claude Desktop
3. Vous verrez maintenant les outils STOA dans la palette d'outils

Pour un guide complet sur l'intégration MCP, incluant l'authentification OAuth 2.1 pour les déploiements en production, consultez notre [documentation MCP Gateway](/docs/guides/quickstart).

## Personnalisation

### Variables d'environnement

Modifiez `.env` pour personnaliser la stack. Changements courants :

**Changer les ports** (si les ports par défaut entrent en conflit avec d'autres services) :

```bash
API_PORT=9000
CONSOLE_PORT=4000
PORTAL_PORT=9080
GATEWAY_PORT=9081
```

**Activer les logs de débogage** :

```bash
LOG_LEVEL=DEBUG
RUST_LOG=debug
```

**Configurer CORS** (pour le développement d'un frontend externe) :

```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

**Pool de connexions à la base de données** :

```bash
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
```

Après avoir modifié `.env`, redémarrez la stack :

```bash
docker compose down
docker compose up -d
```

### Données persistantes

Par défaut, les données PostgreSQL sont stockées dans un volume Docker (`stoa-postgres-data`). Cela persiste entre les redémarrages de conteneurs.

Pour réinitialiser la base de données à un état propre :

```bash
docker compose down -v  # -v supprime les volumes
docker compose up -d
```

**Avertissement** : cela supprime toutes les APIs, politiques et applications que vous avez créées.

### Realm Keycloak personnalisé

Le realm par défaut (`keycloak/realm-export.json`) inclut des utilisateurs de test avec le mot de passe `admin`. Pour des tests locaux proches de la production, vous pouvez :

1. Importer un realm personnalisé : placez votre `realm.json` dans `keycloak/` et mettez à jour `docker-compose.yml` :

```yaml
keycloak:
  environment:
    KEYCLOAK_IMPORT: /opt/keycloak/data/import/my-realm.json
  volumes:
    - ./keycloak/my-realm.json:/opt/keycloak/data/import/my-realm.json
```

2. Ou configurer Keycloak manuellement via la Console d'administration et exporter le realm pour le réutiliser.

### Instances Gateway multiples

Pour simuler un déploiement multi-gateway (par exemple, modes edge + sidecar), ajoutez un autre service gateway :

```yaml
stoa-gateway-sidecar:
  image: ghcr.io/stoa-platform/stoa-gateway:latest
  container_name: stoa-gateway-sidecar
  ports:
    - "8082:8080"
  environment:
    MODE: sidecar
    CONTROL_PLANE_API_URL: http://control-plane-api:8000
    GATEWAY_API_KEY: ${STOA_CONTROL_PLANE_API_KEY}
  networks:
    - stoa-network
```

Enregistrez le gateway sidecar dans la Console UI sous **Instances Gateway** → **Enregistrer un Gateway**.

## Dépannage

### Les services ne démarrent pas

**Symptôme** : `docker compose up -d` se termine avec des erreurs.

**Causes** :
1. **Conflits de ports** — un autre service utilise les ports 3000, 8000, 8080 ou 8443
2. **Mémoire insuffisante** — Docker Desktop alloue moins de 8 Go de RAM
3. **Espace disque** — Docker dispose de moins de 10 Go libres

**Correction** :
```bash
# Vérifier l'utilisation des ports
lsof -i :3000
lsof -i :8000

# Libérer de l'espace disque Docker
docker system prune -a --volumes

# Augmenter la mémoire de Docker Desktop (Paramètres → Ressources → Mémoire → 12 Go)
```

### Avertissement de certificat Keycloak

**Symptôme** : le navigateur affiche « Votre connexion n'est pas privée » lors de l'accès à `https://localhost:8443`.

**Cause** : Keycloak utilise un certificat auto-signé pour le développement local.

**Correction** : cliquez sur « Avancé » → « Continuer vers localhost (non sécurisé) ». C'est sans danger pour le développement local. En production, configurez un vrai certificat.

### L'API Control Plane retourne 500

**Symptôme** : les requêtes API retournent `{"detail": "Internal server error"}`.

**Cause** : la connexion à la base de données a échoué ou la migration n'a pas été appliquée.

**Débogage** :
```bash
# Vérifier les logs de l'API
docker compose logs control-plane-api

# Erreurs courantes :
# - "connection refused" → PostgreSQL non prêt (attendre 30s et réessayer)
# - "relation does not exist" → migrations non appliquées

# Appliquer les migrations manuellement
docker compose exec control-plane-api alembic upgrade head
```

### Le Gateway retourne 404 pour les routes d'API

**Symptôme** : `curl http://localhost:8081/httpbin/get` retourne 404.

**Cause** : l'API n'est pas synchronisée avec le Gateway.

**Correction** :
1. Vérifiez que l'API existe : `curl http://localhost:8000/v1/apis`
2. Forcez la resynchronisation : modifiez l'API dans la Console UI et sauvegardez (aucun changement nécessaire)
3. Vérifiez la config du Gateway : `docker compose logs stoa-gateway | grep "Synced"`

### Les outils MCP n'apparaissent pas

**Symptôme** : `curl http://localhost:8081/mcp/tools` retourne un tableau `tools` vide.

**Cause** : aucune API n'a encore été créée, ou les APIs ont `enabled: false`.

**Correction** :
1. Créez une API via la Console UI (Étape 4)
2. Assurez-vous que le statut de l'API est « Actif »
3. Redémarrez le Gateway : `docker compose restart stoa-gateway`

### Erreur de syntaxe Docker Compose

**Symptôme** : `services.xxx Additional property yyy is not allowed`.

**Cause** : utilisation de la syntaxe `docker-compose` (v1) avec un fichier compose v2.

**Correction** : mettez à jour vers Docker Compose v2 (`docker compose` avec un espace, sans tiret). Ou modifiez `docker-compose.yml` pour être compatible v1 (non recommandé).

## Prochaines étapes

Maintenant que STOA fonctionne en local, explorez ces guides :

- **[GitOps en 10 minutes](/blog/gitops-in-10-minutes)** — gérez les APIs en tant que code avec des workflows GitOps
- **[Guide CLI stoactl](/blog/stoactl-cli-manage-apis-terminal)** — gérez les APIs depuis le terminal avec des commandes de style kubectl
- **[Open Source API Gateway 2026](/blog/open-source-api-gateway-2026)** — analyse approfondie de l'architecture et des principes de conception
- **[Guide de démarrage rapide](/docs/guides/quickstart)** — documentation complète pour les déploiements en production
- **[Référence de configuration](/docs/reference/configuration)** — toutes les variables d'environnement et paramètres expliqués

Pour le déploiement en production sur Kubernetes, consultez notre [Guide d'installation](/docs/admin/installation) avec des exemples de charts Helm et ArgoCD.

## FAQ

### Puis-je utiliser cette configuration pour la production ?

**Non.** Cette stack Docker Compose est conçue uniquement pour le développement local et les tests. Elle utilise :
- Des certificats auto-signés
- Des identifiants par défaut (`admin` / `admin`)
- Des services en instance unique (pas de haute disponibilité)
- PostgreSQL intégré (pas adapté à la production)

Pour la production, déployez sur Kubernetes en utilisant nos [charts Helm](https://github.com/stoa-platform/stoa/tree/main/charts/stoa-platform). Cela vous donne :
- Des déploiements multi-réplicas avec auto-scaling
- Des bases de données managées (RDS, Cloud SQL, etc.)
- Des certificats Let's Encrypt via cert-manager
- ArgoCD pour un déploiement continu basé sur GitOps

### Comment mettre à jour vers la dernière version ?

Téléchargez les dernières images et redémarrez :

```bash
docker compose pull
docker compose up -d
```

Docker Compose recréera les conteneurs avec les nouvelles images tout en préservant vos volumes de données (PostgreSQL, Keycloak).

**Remarque** : les mises à jour de versions majeures peuvent nécessiter des migrations de base de données. Consultez le [CHANGELOG](https://github.com/stoa-platform/stoa-quickstart/blob/main/CHANGELOG.md) avant de mettre à jour.

### Puis-je connecter des services externes à cette stack ?

**Oui.** Tous les services sont accessibles depuis la machine hôte :

- **Frontend externe** (React, Vue, etc.) → définissez `VITE_API_URL=http://localhost:8000` dans le `.env` de votre application
- **CLI externe** → `stoactl configure --api-url http://localhost:8000`
- **Postman/Insomnia** → importez la spec OpenAPI depuis `http://localhost:8000/openapi.json`

Pour les agents IA (Claude Desktop, plugins ChatGPT), configurez l'URL du MCP Gateway comme `http://localhost:8081/mcp`.

**Limitation** : les services dans d'autres stacks Docker Compose ne peuvent pas joindre cette stack par nom d'hôte (`control-plane-api` ne se résoudra pas). Utilisez `host.docker.internal` comme pont sur Mac/Windows, ou joignez le même réseau Docker.
