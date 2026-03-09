---
slug: mcp-gateway-quickstart-docker
title: "Déployer un MCP Gateway avec Docker Compose en 10 minutes"
description: "Un MCP gateway prêt pour la production qui fonctionne localement en moins de 10 minutes. Setup Docker Compose avec auth, rate limiting et enregistrement d'outils inclus."
authors: [stoa-team]
tags: [tutorial, mcp, docker, quickstart, api-gateway]
keywords:
  - MCP gateway Docker Compose
  - deploy MCP gateway
  - Model Context Protocol tutorial
  - MCP gateway setup
  - AI agent gateway
  - MCP Docker deployment
  - STOA Platform tutorial
  - API gateway for AI agents
  - MCP server Docker
  - MCP protocol implementation
  - AI gateway deployment
  - LLM API gateway
---

<!-- last verified: 2026-02 -->

# Comment déployer un MCP Gateway avec Docker Compose (guide étape par étape)

Les agents IA ont besoin d'un moyen sécurisé et standardisé d'accéder à vos APIs. Le Model Context Protocol (MCP) fournit ce pont, et STOA Platform rend son déploiement trivial. Dans ce tutoriel, vous apprendrez à configurer un MCP gateway prêt pour la production en utilisant Docker Compose en moins de 10 minutes.

**Nouveau dans les MCP gateways ?** Commencez par notre guide complet : [Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway) pour comprendre l'architecture et le modèle de sécurité avant de déployer.

À la fin de ce guide, vous aurez un gateway fonctionnel qui expose vos APIs REST existantes aux agents IA comme Claude, se connecte à l'authentification et applique des politiques au runtime.

<!-- truncate -->

## Ce que vous allez construire

Vous allez déployer une stack MCP gateway complète avec :

- **stoa-gateway** : Serveur MCP basé sur Rust (mode edge-mcp)
- **Keycloak** : Authentification OAuth2/OIDC
- **PostgreSQL** : Stockage des métadonnées pour les outils, abonnements et politiques

Cette configuration reflète le [guide de démarrage rapide STOA](/docs/guides/quickstart) mais se concentre sur le composant gateway avec des exemples pratiques.

## Prérequis

Avant de commencer, assurez-vous d'avoir :

- **Docker** 20.10+ et **Docker Compose** 2.x installés
- **curl** ou **httpie** pour les tests
- **Un endpoint d'API REST** à exposer (nous utiliserons JSONPlaceholder comme démo)
- **Connaissances de base** de Docker, des APIs REST et d'OAuth2

Si vous migrez depuis un API gateway existant, consultez d'abord notre [Guide de migration API Gateway](/blog/api-gateway-migration-guide-2026).

## Étape 1 : Lancer la stack avec Docker Compose

Créez un nouveau répertoire pour votre projet MCP gateway :

```bash
mkdir mcp-gateway-demo
cd mcp-gateway-demo
```

Créez un fichier `docker-compose.yml` :

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: stoa
      POSTGRES_USER: stoa
      POSTGRES_PASSWORD: changeme
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stoa"]
      interval: 10s
      timeout: 5s
      retries: 5

  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/stoa
      KC_DB_USERNAME: stoa
      KC_DB_PASSWORD: changeme
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_HTTP_ENABLED: "true"
      KC_HOSTNAME_STRICT: "false"
    command: start-dev
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

  stoa-gateway:
    image: ghcr.io/stoa-platform/stoa-gateway:latest
    environment:
      DATABASE_URL: postgresql://stoa:changeme@postgres:5432/stoa
      KEYCLOAK_URL: http://keycloak:8080
      KEYCLOAK_REALM: stoa
      KEYCLOAK_CLIENT_ID: stoa-mcp-gateway
      KEYCLOAK_CLIENT_SECRET: your-client-secret-here
      LOG_LEVEL: info
      MODE: edge-mcp
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      keycloak:
        condition: service_started

volumes:
  postgres_data:
```

Lancer la stack :

```bash
docker-compose up -d
```

Vérifier que tous les services fonctionnent :

```bash
docker-compose ps
```

Vous devriez voir trois containers : `postgres`, `keycloak` et `stoa-gateway` tous dans l'état "Up".

**Accéder à Keycloak** : Naviguez vers `http://localhost:8080` et connectez-vous avec `admin/admin`. Vous devrez créer le realm `stoa` et le client `stoa-mcp-gateway` manuellement dans ce quickstart. Pour la production, utilisez le [chart Helm complet](/docs/deployment/hybrid) qui inclut la configuration automatisée des realms.

## Étape 2 : Enregistrer votre premier outil MCP

Un "outil" MCP est une fonction que les agents IA peuvent appeler. Chaque outil mappe vers l'un de vos endpoints d'API REST. Enregistrons un outil qui recherche des contacts.

D'abord, obtenez un token d'accès depuis Keycloak :

```bash
export KEYCLOAK_TOKEN=$(curl -s -X POST \
  'http://localhost:8080/realms/stoa/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=stoa-mcp-gateway' \
  -d 'client_secret=your-client-secret-here' \
  -d 'grant_type=client_credentials' \
  | jq -r '.access_token')
```

Enregistrez maintenant l'outil via l'API admin du gateway :

```bash
curl -X POST http://localhost:3000/admin/tools \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search-contacts",
    "display_name": "Search Contacts",
    "description": "Search for contacts by name or email",
    "tenant_id": "acme",
    "endpoint": "https://jsonplaceholder.typicode.com/users",
    "method": "GET",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query"
        }
      },
      "required": ["query"]
    }
  }'
```

**Réponse** :

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "search-contacts",
  "display_name": "Search Contacts",
  "status": "active",
  "created_at": "2026-02-12T10:30:00Z"
}
```

Votre outil est maintenant enregistré et prêt à être appelé par des agents IA.

## Étape 3 : Connecter un agent IA

Le gateway expose un endpoint serveur MCP-compliant à `http://localhost:3000/mcp`. Les agents IA se connectent via le transport **Server-Sent Events (SSE)** ou **WebSocket**.

Voici comment Claude Desktop se connecte à votre gateway. Ajoutez ceci à vos paramètres MCP de Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` sur macOS) :

```json
{
  "mcpServers": {
    "stoa-acme": {
      "url": "http://localhost:3000/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_GATEWAY_API_KEY",
        "X-Tenant-ID": "acme"
      }
    }
  }
}
```

Redémarrez Claude Desktop. Vous devriez maintenant voir "search-contacts" disponible comme outil dans l'interface de Claude.

**Tester l'outil depuis Claude** :

```
Utilisateur : Trouver des contacts avec le nom "Leanne"
Claude : [appelle l'outil search-contacts avec query="Leanne"]
```

Le gateway proxifie la requête vers `https://jsonplaceholder.typicode.com/users?query=Leanne`, transforme la réponse et la retourne à Claude au format MCP.

### Exemple avec le SDK Python

Si vous construisez un agent IA personnalisé, utilisez le SDK Python STOA :

```python
from stoa_sdk import STOAClient

client = STOAClient(
    gateway_url="http://localhost:3000",
    api_key="YOUR_GATEWAY_API_KEY",
    tenant_id="acme"
)

# Lister les outils disponibles
tools = client.list_tools()
print(f"Available tools: {[t['name'] for t in tools]}")

# Appeler un outil
result = client.call_tool(
    name="search-contacts",
    arguments={"query": "Leanne"}
)
print(result)
```

Cette approche découple votre code agent de la structure API sous-jacente. Si vous passez de JSONPlaceholder à votre propre API CRM, le code agent reste inchangé.

## Étape 4 : Ajouter une politique au runtime

Le gateway supporte les politiques Open Policy Agent (OPA) pour l'autorisation dynamique, le rate limiting et le filtrage des données.

Créez un fichier de politique `policies/rate-limit.rego` :

```rego
package stoa.policies

import future.keywords.if
import future.keywords.in

default allow := false

# Autoriser jusqu'à 100 requêtes par heure par tenant
allow if {
    input.method == "GET"
    count(quota_usage[input.tenant_id]) < 100
}

quota_usage[tenant_id] := requests if {
    tenant_id := input.tenant_id
    requests := [r | r := data.requests[_]; r.tenant_id == tenant_id]
}
```

Charger la politique dans le gateway :

```bash
curl -X POST http://localhost:3000/admin/policies \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "rate-limit-acme",
    "tenant_id": "acme",
    "policy": "'"$(cat policies/rate-limit.rego)"'",
    "enabled": true
  }'
```

Maintenant, le tenant "acme" est limité à 100 appels d'outils par heure. Le 101ème appel retourne :

```json
{
  "error": "quota_exceeded",
  "message": "Tenant acme has exceeded rate limit",
  "retry_after": 3600
}
```

Les politiques sont évaluées **avant** le proxying vers votre API backend, donc vous ne gaspillez jamais de capacité backend sur des requêtes non autorisées.

## Étape 5 : Monitorer et déboguer

Le gateway expose des métriques Prometheus à `http://localhost:3000/metrics` :

```bash
curl http://localhost:3000/metrics | grep stoa_tool_calls_total
```

**Exemples de métriques** :

```
stoa_tool_calls_total{tenant_id="acme",tool_name="search-contacts",status="success"} 42
stoa_tool_calls_total{tenant_id="acme",tool_name="search-contacts",status="error"} 2
stoa_policy_evaluations_total{tenant_id="acme",policy_name="rate-limit-acme",result="allow"} 40
```

Pour les logs structurés, consultez le container gateway :

```bash
docker-compose logs -f stoa-gateway
```

Vous verrez :

```json
{
  "level": "info",
  "timestamp": "2026-02-12T10:45:00Z",
  "tenant_id": "acme",
  "tool_name": "search-contacts",
  "duration_ms": 123,
  "status": 200
}
```

Pour l'observabilité en production, intégrez avec Grafana et Loki. Voir [ADR-023 : Observabilité Zero Blind Spot](/docs/architecture/adr/adr-023-zero-blind-spot-observability) pour les détails.

## Ce que vous avez appris

Vous disposez maintenant d'un MCP gateway fonctionnel qui :

1. **Expose les APIs REST** comme outils MCP pour les agents IA
2. **Authentifie** via OAuth2/OIDC (Keycloak)
3. **Applique les politiques** (rate limiting, autorisation) avec OPA
4. **Surveille** l'utilisation des outils avec des métriques Prometheus

C'est la base pour les déploiements en production. Prochaines étapes :

- **Ajouter plus d'outils** : Chaque endpoint d'API backend devient un outil
- **Activer le mTLS** : Sécuriser la communication gateway-vers-backend ([ADR-039](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens))
- **Déployer sur Kubernetes** : Utiliser le [chart Helm](/docs/deployment/hybrid)
- **Intégrer avec votre Plan de Contrôle** : Gérer les outils via l'UI au lieu de curl

## Lectures complémentaires

- [Concepts MCP Gateway](/docs/concepts/mcp-gateway) — Architecture et conception
- [Guide de démarrage rapide](/docs/guides/quickstart) — Configuration complète de la plateforme (Plan de Contrôle + Gateway)
- [Guide de migration API Gateway](/blog/api-gateway-migration-guide-2026) — Migrer depuis Kong, Apigee, webMethods
- [ADR-024 : Modes Gateway](/docs/architecture/adr/adr-024-gateway-unified-modes) — Edge-MCP, Sidecar, Proxy, Shadow
- [Référence Tool CRD](/docs/reference/crds/tool) — Approche GitOps pour la gestion des outils

## Checklist de production

Avant de déployer en production :

- [ ] Remplacer les mots de passe `changeme` par des secrets depuis un vault
- [ ] Activer TLS pour tous les services (gateway, Keycloak, Postgres)
- [ ] Configurer l'export du realm Keycloak pour la reprise après sinistre
- [ ] Configurer l'agrégation de logs (ELK, Loki ou CloudWatch)
- [ ] Configurer les alertes Prometheus pour quota dépassé, échecs d'authentification
- [ ] Tester les scénarios de basculement (Postgres indisponible, Keycloak indisponible)
- [ ] Documenter votre catalogue d'outils dans un repository Git

## Note de version

Ce tutoriel utilise :

- **STOA Gateway** : v0.6.0 (Rust, mode edge-mcp)
- **Keycloak** : 23.0
- **PostgreSQL** : 15

Pour les dernières versions, consultez la [page des releases STOA](https://github.com/stoa-platform/stoa/releases).

## Foire aux questions

### Quelles sont les exigences Docker minimales pour exécuter un MCP gateway ?

Vous avez besoin de Docker 20.10+ et Docker Compose 2.x. Pour le développement/test, allouez au moins 4 Go de RAM à Docker Desktop. Pour la production, déployez sur un serveur Linux avec 8 Go+ de RAM et des volumes persistants pour les données PostgreSQL. Le gateway lui-même est léger (binaire Rust, ~50 Mo de RAM sous charge), mais Keycloak et PostgreSQL nécessitent plus de ressources. Voir le [guide de démarrage rapide](/docs/guides/quickstart) pour les options de déploiement Kubernetes.

### Ce setup est-il prêt pour la production ?

La configuration Docker Compose est adaptée au développement, aux tests et aux déploiements en production à faible trafic. Avant l'usage en production, remplacez tous les mots de passe `changeme` par des secrets depuis un vault, activez TLS pour tous les services, configurez l'agrégation de logs et configurez les alertes Prometheus. Pour des déploiements en production haute disponibilité avec plusieurs réplicas, utilisez le [chart Helm](/docs/guides/quickstart) sur Kubernetes.

### Quelle est la prochaine étape après ce quickstart ?

Après le quickstart, ajoutez plus d'outils en enregistrant des endpoints d'API REST supplémentaires, activez le mTLS pour la sécurité gateway-vers-backend, intégrez avec votre Plan de Contrôle pour une gestion des outils via UI plutôt que curl, et déployez sur Kubernetes pour l'usage en production. Explorez les capacités complètes de la plateforme dans le [guide des concepts MCP gateway](/blog/what-is-mcp-gateway) et la [documentation d'architecture](https://docs.gostoa.dev/docs/concepts/architecture).

---

**À propos de STOA Platform** : STOA est l'API gateway open source conçu pour les agents IA. Définissez votre contrat API une fois avec le Universal API Contract (UAC), et exposez-le partout : MCP, REST, GraphQL, gRPC. Sous licence Apache 2.0. [Commencez dès aujourd'hui](/docs/guides/quickstart).

**Besoin d'aide ?** Rejoignez notre [communauté Discord](https://discord.gostoa.dev) ou consultez le [guide de dépannage](/docs/reference/troubleshooting).

> **Avertissement** : Les capacités du produit et les options de configuration peuvent changer entre les versions. Ce guide reflète l'état de STOA Platform en février 2026. Pour les instructions de configuration les plus récentes, consultez la [documentation officielle](https://docs.gostoa.dev).
