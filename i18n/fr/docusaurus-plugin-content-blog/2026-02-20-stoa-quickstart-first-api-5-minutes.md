---
slug: stoa-quickstart-first-api-5-minutes
title: "Publiez votre première API en 5 minutes (Quick Start)"
description: "Docker Compose up, créez une API, exposez-la via le MCP Gateway. Votre première API publiée en 5 minutes avec des instructions étape par étape."
authors: [stoa-team]
tags: [tutorial, quickstart, docker]
keywords:
  - stoa platform quick start tutorial
  - stoa api gateway getting started
  - mcp gateway docker compose setup
  - open source api gateway tutorial
  - stoa first api tutorial
---
<!-- last verified: 2026-02 -->

**STOA Platform** est un gateway API open source conçu pour l'ère de l'IA. Dans ce tutoriel, vous passerez de zéro à un endpoint API fonctionnel en **5 minutes**. Aucune configuration complexe, aucune heure à lire de la documentation — clonez, démarrez, et publiez votre première API.

À la fin, vous aurez la stack complète de STOA en local : Control Plane, MCP Gateway, Portail Développeur et Console. Vous créerez une API, l'exposerez via le gateway, et l'appellerez comme n'importe quel endpoint en production.

<!-- truncate -->

## Ce que vous allez construire

Dans ce quick start, vous allez :
1. Déployer STOA en local avec Docker Compose (4 services core)
2. Créer un tenant et enregistrer une API
3. Exposer l'API via le MCP Gateway
4. Appeler votre API via le gateway
5. La visualiser dans le Portail Développeur

**Durée** : 5 minutes
**Difficulté** : Débutant
**Prérequis** : Docker, Docker Compose, curl

## Prérequis

Avant de commencer, assurez-vous d'avoir :

- **Docker Desktop** (ou Docker Engine + Docker Compose v2)
- **curl** (pour tester les endpoints)
- **Un terminal** (bash, zsh, ou PowerShell)

Vérifiez que Docker fonctionne :
```bash
docker --version
docker compose version
```

Vous devriez voir la version 20.10+ pour Docker et 2.x pour Compose.

## Étape 1 : Cloner et démarrer STOA

STOA fournit un **dépôt quickstart** avec une stack Docker Compose préconfigurée. C'est le moyen le plus rapide d'exécuter STOA en local.

Clonez le dépôt :
```bash
git clone https://github.com/stoa-platform/stoa-quickstart.git
cd stoa-quickstart
```

Démarrez tous les services :
```bash
docker compose up -d
```

Cela lance 5 containers :
- **control-plane-api** — API backend pour gérer les tenants, APIs, politiques
- **control-plane-ui** — Console d'administration pour la configuration
- **mcp-gateway** — Gateway runtime qui proxifie les requêtes API
- **portal** — Portail Développeur pour la découverte d'APIs
- **keycloak** — Gestion des identités et des accès (préconfiguré)

Le premier démarrage télécharge les images (~2 Go). Les démarrages suivants prennent **< 10 secondes**.

## Étape 2 : Vérifier que les services fonctionnent

Vérifiez que tous les containers sont en bonne santé :
```bash
docker compose ps
```

Vous devriez voir tous les services à l'état `Up`. Si un service redémarre, attendez 30 secondes et vérifiez à nouveau.

Testez l'endpoint de santé de chaque service :
```bash
# Control Plane API
curl -s http://localhost:8080/health | jq .
# Attendu : {"status":"healthy"}

# MCP Gateway
curl -s http://localhost:8081/health | jq .
# Attendu : {"status":"ok"}

# Console UI
curl -s http://localhost:3000
# Attendu : réponse HTML

# Portal
curl -s http://localhost:3001
# Attendu : réponse HTML

# Keycloak
curl -s http://localhost:8082/health | jq .
# Attendu : {"status":"UP"}
```

Si tous les endpoints répondent, vous êtes prêt à configurer votre première API.

## Étape 3 : Se connecter à la Console

La **Console** est l'interface d'administration de STOA. Ouvrez-la dans votre navigateur :

```
http://localhost:3000
```

**Identifiants par défaut** :
- Nom d'utilisateur : `admin`
- Mot de passe : `admin`

Après la connexion, vous verrez le tableau de bord STOA. L'environnement quickstart inclut :
- Un **tenant par défaut** préconfiguré (`default`)
- Une **instance MCP Gateway** enregistrée et en ligne
- Rôle : `cpi-admin` (accès complet à la plateforme)

## Étape 4 : Créer votre première API

Maintenant, enregistrons une API. Pour ce tutoriel, nous utiliserons **JSONPlaceholder**, une API REST publique pour les tests.

### Option A : Via la Console UI

1. Naviguez vers **APIs** dans la barre latérale gauche
2. Cliquez sur **Créer une API**
3. Remplissez le formulaire :
   - **Nom** : `jsonplaceholder-posts`
   - **Nom d'affichage** : `JSONPlaceholder Posts API`
   - **URL Backend** : `https://jsonplaceholder.typicode.com`
   - **Chemin de base** : `/posts`
   - **Méthodes** : `GET`, `POST`
   - **Gateway** : Sélectionnez `mcp-gateway`
4. Cliquez sur **Créer**

La Console valide vos entrées et enregistre l'API dans le Control Plane.

### Option B : Via l'API (curl)

Si vous préférez la ligne de commande, utilisez directement le Control Plane API :

```bash
curl -X POST http://localhost:8080/v1/apis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token" \
  -d '{
    "name": "jsonplaceholder-posts",
    "display_name": "JSONPlaceholder Posts API",
    "base_url": "https://jsonplaceholder.typicode.com",
    "base_path": "/posts",
    "version": "v1",
    "tenant_id": "default",
    "gateway_id": "mcp-gateway"
  }'
```

**Note** : L'environnement quickstart utilise un `demo-token` simplifié pour l'authentification. En production, vous utiliseriez des tokens OIDC Keycloak.

Vous devriez recevoir une réponse `201 Created` avec les métadonnées de l'API.

## Étape 5 : Synchroniser l'API avec le Gateway

L'API est maintenant enregistrée dans le Control Plane, mais le **MCP Gateway** n'en est pas encore informé. Vous devez la **synchroniser**.

### Via la Console

1. Naviguez vers **Instances Gateway** dans la barre latérale
2. Cliquez sur `mcp-gateway`
3. Cliquez sur **Synchroniser les APIs**
4. Sélectionnez `jsonplaceholder-posts` et cliquez sur **Synchroniser**

La Console envoie la configuration de l'API au Gateway. Le Gateway sait maintenant comment router les requêtes `/posts` vers le backend.

### Via l'API

```bash
curl -X POST http://localhost:8080/v1/gateways/mcp-gateway/sync \
  -H "Authorization: Bearer demo-token"
```

Cela déclenche une synchronisation complète de toutes les APIs vers le gateway sélectionné.

## Étape 6 : Appeler votre API via le Gateway

Voici le moment de vérité. Le Gateway écoute sur le port `8081`. Appelons l'API :

```bash
curl -s http://localhost:8081/posts | jq '.[0:3]'
```

Vous devriez voir les 3 premiers posts de JSONPlaceholder :

```json
[
  {
    "userId": 1,
    "id": 1,
    "title": "sunt aut facere repellat provident...",
    "body": "quia et suscipit..."
  },
  {
    "userId": 1,
    "id": 2,
    "title": "qui est esse",
    "body": "est rerum tempore vitae..."
  },
  {
    "userId": 1,
    "id": 3,
    "title": "ea molestias quasi exercitationem...",
    "body": "et iusto sed quo iure..."
  }
]
```

**Que s'est-il passé ?**
1. Votre requête curl a atteint le Gateway à `http://localhost:8081/posts`
2. Le Gateway a fait correspondre le chemin `/posts` à votre API enregistrée
3. Il a proxifié la requête vers `https://jsonplaceholder.typicode.com/posts`
4. Le backend a répondu avec du JSON
5. Le Gateway vous a retourné la réponse

C'est le cœur de STOA : **gestion centralisée des APIs** avec un routage découplé. Le Gateway ne se préoccupe pas des URLs backend — le Control Plane gère cela.

## Étape 7 : Visualiser l'API dans le Portail Développeur

STOA inclut un **Portail Développeur** où les consommateurs d'API découvrent et s'abonnent aux APIs. Ouvrez-le :

```
http://localhost:3001
```

Vous devriez voir `JSONPlaceholder Posts API` listée. Cliquez dessus pour voir :
- Description de l'API
- Endpoints disponibles (`GET /posts`, `POST /posts`)
- Exemples de requêtes
- Options d'abonnement (si vous configurez des clés API ou des limites de débit)

Le Portail est auto-généré à partir de vos métadonnées d'API. Tout changement dans la Console se reflète instantanément ici.

## Ce que vous avez construit

En 5 minutes, vous avez déployé une plateforme de gestion d'APIs de niveau production :

```
┌─────────────────────────────────────────────────────────────┐
│                       STOA Platform                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Console (Admin)          Portal (Développeurs)            │
│  localhost:3000           localhost:3001                   │
│       │                          │                          │
│       └──────────┬───────────────┘                          │
│                  │                                          │
│                  ▼                                          │
│         Control Plane API                                  │
│         localhost:8080                                     │
│                  │                                          │
│                  │ (sync)                                   │
│                  ▼                                          │
│           MCP Gateway                                      │
│           localhost:8081                                   │
│                  │                                          │
│                  │ (proxy)                                  │
│                  ▼                                          │
│         API Backend (JSONPlaceholder)                      │
│         jsonplaceholder.typicode.com                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Concepts clés que vous avez appris** :
- **Control Plane** : Registre d'APIs centralisé et gestion des politiques
- **MCP Gateway** : Proxy runtime qui applique les politiques et route les requêtes
- **Tenant** : Unité d'isolation logique (support multi-tenant)
- **API Sync** : Pousser la configuration du Control Plane vers le Gateway
- **Portail Développeur** : Catalogue d'APIs en libre-service pour les consommateurs

## Étapes suivantes

Maintenant que STOA fonctionne, explorez ces guides :

### Ajouter sécurité et gouvernance
- [Authentification et autorisation](/docs/guides/authentication) — Configurer OIDC, clés API et contrôle d'accès basé sur les rôles
- [Abonnements et clés API](/docs/guides/subscriptions) — Activer le libre-service pour les consommateurs
- [Configuration du portail](/docs/guides/portal) — Personnaliser la marque et la documentation API

### Intégrer avec les agents IA
Le MCP Gateway de STOA est conçu pour les workflows natifs IA. Apprenez à :
- [Connecter des agents IA aux APIs d'entreprise](/blog/connecting-ai-agents-enterprise-apis) — Exposer vos APIs comme outils MCP
- [Convertir des APIs REST en outils MCP](/blog/convert-rest-api-to-mcp-tools) — Générer des interfaces adaptées à l'IA
- [Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway) — Plongée approfondie dans le Model Context Protocol

### Comprendre l'architecture
- [Vue d'ensemble de l'architecture](/docs/concepts/architecture) — Comment le Control Plane, le Gateway et le Portail fonctionnent ensemble
- [Modes de Gateway](/docs/concepts/gateway) — Patterns de déploiement edge, sidecar, proxy et shadow
- [GitOps en 10 minutes](/blog/gitops-in-10-minutes) — Déployer STOA avec Kubernetes et ArgoCD

### Migrer depuis des gateways existants
Si vous évaluez STOA comme remplacement d'un gateway existant :
- [Guide de migration de gateway API 2026](/blog/api-gateway-migration-guide-2026) — Playbook de migration complet
- [Comparaison de gateways API open source](/blog/open-source-api-gateway-2026) — Matrice de fonctionnalités et guide de décision

### Explorer les fonctionnalités avancées
- [MCP Gateway Quick Start avec Docker](/blog/mcp-gateway-quickstart-docker) — Déploiement prêt pour la production
- [Référence CLI](/docs/reference/cli) — Automatiser la gestion des APIs avec `stoactl`
- [Référence de configuration](/docs/reference/configuration) — Variables d'environnement, feature flags et réglages

## Dépannage

### Les services ne démarrent pas
**Problème** : `docker compose up -d` échoue avec « port déjà utilisé »

**Solution** : Un autre service utilise les ports 8080-8082 ou 3000-3001. Arrêtez les services en conflit ou changez les ports dans `docker-compose.yml`.

### Le Gateway retourne 404
**Problème** : Appeler `http://localhost:8081/posts` retourne `{"error":"route not found"}`

**Solution** : L'API n'a pas été synchronisée. Allez dans **Instances Gateway** → `mcp-gateway` → **Synchroniser les APIs** et sélectionnez votre API.

### La connexion Keycloak échoue
**Problème** : La connexion à la Console retourne « Identifiants invalides »

**Solution** : Le quickstart utilise `admin/admin` par défaut. Si vous l'avez changé, vérifiez les valeurs de `KEYCLOAK_ADMIN` et `KEYCLOAK_ADMIN_PASSWORD` dans `docker-compose.yml`.

### L'API retourne 502 Bad Gateway
**Problème** : Le Gateway proxifie la requête mais le backend est inaccessible

**Solution** : Vérifiez que l'URL du backend est accessible depuis Docker :
```bash
docker exec stoa-mcp-gateway curl -s https://jsonplaceholder.typicode.com/posts
```

Si cela échoue, vérifiez votre configuration réseau ou utilisez une autre API de test.

## FAQ

### Puis-je utiliser STOA en production ?
Oui. STOA est sous **licence Apache 2.0** et prêt pour la production. L'environnement quickstart est destiné au développement local. Pour la production, déployez STOA sur Kubernetes avec des [charts Helm](/docs/deployment/hybrid) ou utilisez le [guide de déploiement GitOps](/blog/gitops-in-10-minutes).

### Comment STOA se compare-t-il à Kong ou Apigee ?
STOA est **natif IA** (conçu pour le protocole MCP), **open source** (sans enfermement propriétaire) et **multi-gateway** (orchestre Kong, Apigee et STOA Gateway depuis un seul control plane). Consultez la [comparaison de gateways API open source](/blog/open-source-api-gateway-2026) pour une matrice de fonctionnalités détaillée.

### Dois-je connaître Kubernetes pour utiliser STOA ?
Non. Ce quick start fonctionne entièrement sur Docker Compose. Pour les déploiements Kubernetes en production, STOA fournit des [charts Helm](/docs/deployment/hybrid) et des [workflows GitOps](/blog/gitops-in-10-minutes), mais ceux-ci sont optionnels.

---

**Prêt à construire ?** Clonez le dépôt [stoa-quickstart](https://github.com/stoa-platform/stoa-quickstart) et ayez votre première API en fonctionnement en 5 minutes.

**Rejoignez la communauté** : [GitHub Discussions](https://github.com/stoa-platform/stoa/discussions) | [Discord](https://discord.gg/stoa) | [Documentation](https://docs.gostoa.dev)
