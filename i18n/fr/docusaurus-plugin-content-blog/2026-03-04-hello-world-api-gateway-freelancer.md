---
slug: hello-world-api-gateway-freelancer
title: "Première API Protégée en 15 Minutes (Édition Freelance)"
description: "Rate limiting, auth et monitoring dès la première ligne. Construisez un API gateway prêt pour la production en tant que freelance ou indie hacker en 15 minutes chrono."
authors: [stoa-team]
tags: [tutorial, quickstart, api-gateway, security]
keywords:
  - hello world api gateway tutorial
  - freelancer api gateway setup
  - protect api with rate limiting tutorial
  - open source api gateway getting started
  - stoa platform hello world
  - api gateway for indie hackers
  - first api gateway freelancer
---
<!-- last verified: 2026-02 -->

La plupart des tutoriels « Hello World » vous mènent à un endpoint qui tourne. Celui-ci vous mène à un endpoint **protégé** — avec rate limiting, authentification et une piste d'audit — parce que c'est ce que la production exige vraiment.

Voici l'édition freelance : pragmatique, rapide et réaliste sur ce qui casse en premier au lancement.

<!-- truncate -->

## Pourquoi ce tutoriel est différent

Vous avez probablement vu les tutoriels du style « déployer nginx en une commande ». Ils sont parfaits pour les démos. Ils sont moins parfaits pour ce qui se passe ensuite : un bot martèle votre API à 10 000 requêtes/minute, un script kiddie découvre votre endpoint `/admin`, ou un client demande « que faisait l'API à 3h du matin mardi dernier ? »

STOA résout les trois cas avant même que vous n'écriviez votre premier endpoint. Ce tutoriel parcourt le Hello World complet — de zéro à une API protégée — en environ 15 minutes.

**Ce que vous allez construire :**

1. La plateforme STOA en local via Docker Compose
2. Une API backend (un simple serveur echo)
3. Cette API derrière le gateway de STOA avec :
   - Rate limiting (100 requêtes/minute par consommateur)
   - Authentification par clé API
   - Journalisation des requêtes
4. Un appel `curl` fonctionnel à travers le gateway protégé
5. Un plan de script vidéo utilisable pour enregistrer une démonstration

---

## Prérequis

- Docker et Docker Compose installés
- `curl` disponible (intégré à macOS/Linux, Windows : Git Bash ou WSL)
- 2 Go de RAM libre

C'est tout. Pas de Kubernetes. Pas de compte cloud. Pas de carte bancaire.

---

## Étape 1 — Cloner et démarrer STOA

```bash
git clone https://github.com/stoa-platform/stoa-quickstart
cd stoa-quickstart
docker compose up -d
```

Attendez ~30 secondes que tous les services démarrent, puis vérifiez :

```bash
curl -s http://localhost:8080/health | jq .
# {"status":"ok","version":"0.1.0"}
```

**Ce qui vient de démarrer ?**

| Service | Port | Objectif |
|---------|------|---------|
| Control Plane API | 8000 | Gérer tenants, APIs, consommateurs |
| Console UI | 3000 | Interface de gestion visuelle |
| MCP Gateway | 3001 | Le gateway que vos clients appellent |
| Developer Portal | 3002 | Portail en libre-service pour les consommateurs d'API |
| PostgreSQL | 5432 | Store de configuration |
| Keycloak | 8080 | Identité (tokens d'auth) |

Votre « plateforme de gestion d'API » tourne maintenant. Sur votre ordinateur portable. Gratuitement.

---

## Étape 2 — Créer un tenant

Dans STOA, tout vit à l'intérieur d'un **tenant** (pensez-y comme votre espace de travail ou celui de votre client). Créons-en un.

Ouvrez la Console sur `http://localhost:3000` et connectez-vous avec :
- Nom d'utilisateur : `admin@gostoa.dev`
- Mot de passe : `admin`

Puis créez votre premier tenant :

1. Cliquez sur **Tenants → Créer un tenant**
2. Nom : `hello-world`
3. Domaine : `hello-world.local`
4. Cliquez sur **Créer**

Ou via l'API :

```bash
# Obtenir un token admin
TOKEN=$(curl -s -X POST http://localhost:8080/realms/stoa/protocol/openid-connect/token \
  -d "client_id=control-plane-api&client_secret=change-me&grant_type=client_credentials" \
  | jq -r .access_token)

# Créer le tenant
curl -s -X POST http://localhost:8080/v1/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello-world",
    "domain": "hello-world.local",
    "plan": "free"
  }' | jq .
```

Notez l'`id` retourné — vous en aurez besoin ensuite.

---

## Étape 3 — Enregistrer votre API backend

Votre « API backend » peut être n'importe quoi — votre application Flask, un service Node.js, un endpoint REST existant. Pour ce tutoriel, nous allons utiliser un serveur echo public afin que vous n'ayez pas besoin de déployer quoi que ce soit de plus.

```bash
TENANT_ID="<your-tenant-id>"

curl -s -X POST http://localhost:8080/v1/tenants/$TENANT_ID/apis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "echo-api",
    "display_name": "Echo API",
    "description": "A simple echo server for testing",
    "backend_url": "https://httpbin.org",
    "version": "1.0.0",
    "spec_type": "rest"
  }' | jq .
```

Notez l'`api_id` retourné.

---

## Étape 4 — Ajouter le rate limiting (la partie importante)

C'est là que la plupart des tutoriels disent « ajoutez le rate limiting » et vous montrent une ligne de configuration. Voici pourquoi c'est vraiment important :

- Sans rate limiting : un client défaillant (bot, script, boucle while oubliée) peut faire tomber votre backend
- Avec rate limiting : le client défaillant reçoit `429 Too Many Requests`, votre backend reste stable

Ajoutons une limite de 100 requêtes/minute :

```bash
API_ID="<your-api-id>"

# Étape 1 : Créer la politique de rate limiting
POLICY_ID=$(curl -s -X POST http://localhost:8080/v1/admin/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "standard-rate-limit",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "requests_per_minute": 100,
      "burst": 10
    }
  }' | jq -r .id)

# Étape 2 : Lier la politique à votre API
curl -s -X POST http://localhost:8080/v1/admin/policies/bindings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "'$POLICY_ID'",
    "api_catalog_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq .
```

Les politiques sont réutilisables : la même politique de rate limiting peut être liée à plusieurs APIs. Chaque consommateur obtient son propre bucket de 100 req/min.

---

## Étape 5 — Créer un consommateur (clé API)

Un **consommateur** est quiconque appelle votre API — un client, un service, vous-même. Chaque consommateur reçoit une clé API.

```bash
curl -s -X POST http://localhost:8080/v1/consumers/$TENANT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "freelancer-client-001",
    "name": "Mon Premier Client",
    "email": "client@example.com"
  }' | jq .
```

La réponse inclut un `consumer_id`. Pour obtenir la clé API de ce consommateur, créez une souscription :

```bash
CONSUMER_ID="<consumer-id-from-above>"

curl -s -X POST http://localhost:8080/v1/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": "'$CONSUMER_ID'",
    "api_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq .api_key
```

Copiez l'`api_key` — c'est ce que votre client enverra avec chaque requête.

---

## Étape 6 — Appeler votre API protégée

Voici le vrai moment Hello World :

```bash
API_KEY="<your-api-key>"

# Appel via le gateway
curl -s http://localhost:8080/echo-api/get \
  -H "X-API-Key: $API_KEY" | jq .
```

Vous devriez voir une réponse de httpbin.org, routée à travers le gateway de STOA :

```json
{
  "headers": {
    "X-Api-Key": "your-key-here",
    "X-Consumer-Id": "hello-world-consumer",
    "X-Request-Id": "abc-123",
    "X-Forwarded-For": "172.19.0.1"
  },
  "origin": "172.19.0.1",
  "url": "http://localhost:8080/echo-api/get"
}
```

Notez les headers injectés — STOA ajoute automatiquement `X-Consumer-Id` et `X-Request-Id` à chaque requête proxifiée. Votre backend sait qui a appelé et dispose d'un identifiant de trace pour le débogage.

**Tester le rate limiting :**

```bash
# Bombarder l'API 110 fois
for i in $(seq 1 110); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/echo-api/get \
    -H "X-API-Key: $API_KEY"
done
```

Vous verrez `200` pour les 100 premières requêtes, puis `429` pour les 10 suivantes. Le rate limiting fonctionne.

---

## Étape 7 — Consulter la piste d'audit

STOA journalise chaque requête avec l'identité du consommateur, le timestamp, le code de réponse et la latence. Consultez la Console sur `http://localhost:3000` → **Logs** pour voir vos requêtes.

Ou interrogez via l'API :

```bash
curl -s "http://localhost:8080/v1/audit/$TENANT_ID?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs[] | {consumer, path, status, latency_ms}'
```

C'est votre piste d'audit. Quand un client demande « pourquoi mon API était lente à 3h du matin ? », vous avez la réponse.

---

## Étape 8 — Ce que vous avez maintenant

En 15 minutes, vous avez construit :

| Fonctionnalité | Statut |
|---------|--------|
| API Gateway | ✅ En cours d'exécution |
| Rate Limiting | ✅ 100 req/min par consommateur |
| Auth par clé API | ✅ Clés scoped par consommateur |
| Journalisation des requêtes | ✅ Piste d'audit complète |
| Gestion des consommateurs | ✅ Ajouter/révoquer sans changement de code |

Il s'agit de la même architecture utilisée dans les plateformes de gestion d'API en production qui coûtent des milliers d'euros par mois. Vous la faites tourner sur votre ordinateur portable gratuitement.

---

## Plan de script vidéo

Si vous souhaitez enregistrer une démonstration de ce tutoriel, voici un plan de script :

**Introduction (30s)**
> « La plupart des tutoriels vous montrent un endpoint qui tourne. Celui-ci vous montre un endpoint protégé — avec rate limiting, auth et une piste d'audit — parce que c'est ce que la production nécessite. Construisons votre premier API gateway en 15 minutes. »

**Acte 1 : Cloner et démarrer (2min)**
> Montrez `git clone` + `docker compose up -d` + health check. Mettez l'accent sur : « 6 services, zéro configuration. »

**Acte 2 : Créer le tenant + enregistrer l'API (3min)**
> Utilisez la Console UI pour l'effet visuel. Montrez l'API enregistrée avec l'URL du backend.

**Acte 3 : Rate limiting (2min)**
> Ajoutez la politique. Exécutez la boucle de 110 requêtes. Montrez les réponses `429`. « C'est le moment que la plupart des applications manquent. »

**Acte 4 : Consommateur avec clé API (2min)**
> Créez le consommateur via la Console. Copiez la clé API. Premier `curl` via le gateway.

**Acte 5 : Piste d'audit (1min)**
> Montrez la vue Logs dans la Console. « Quand votre client demande 'que s'est-il passé à 3h du matin', vous avez ceci. »

**Conclusion (30s)**
> « Voilà une API entièrement protégée, en local, en 15 minutes. Prochaines étapes : ajoutez votre vrai backend, invitez votre premier client sur le Developer Portal, et quand vous êtes prêt à déployer — c'est une seule commande avec Helm. »

---

## Prochaines étapes

Maintenant que vous disposez d'une API protégée fonctionnelle, voici ce à explorer ensuite :

1. **[Runbook d'opérations Semaine 1](/docs/guides/week-1-operations)** — surveillance, rotation des logs, premier ajustement des politiques, onboarding de votre premier vrai consommateur
2. **[Guide Developer Portal](/docs/guides/portal)** — laissez les clients s'auto-inscrire pour l'accès à l'API
3. **[Série Durcissement de la sécurité](/blog/tags/security)** — plongée approfondie dans les patterns d'auth, les pistes d'audit et la conformité
4. **[Développement local avec Docker Compose](/blog/stoa-docker-compose-local-development)** — conseils pour intégrer STOA dans votre configuration Docker existante

---

## FAQ

### STOA est-il gratuit ?

Oui — licence Apache 2.0, entièrement open source. Vous pouvez l'exécuter n'importe où, le modifier et le déployer commercialement sans rien payer. [En savoir plus sur pourquoi Apache 2.0](/blog/why-apache-2-not-bsl).

### Puis-je utiliser mon backend existant plutôt qu'httpbin ?

Absolument. Remplacez `https://httpbin.org` par `http://host.docker.internal:votre-port` (macOS/Windows) ou `http://172.17.0.1:votre-port` (Linux) pour pointer vers un service local. Tout backend HTTP fonctionne.

### Que se passe-t-il quand je passe en production ?

La même configuration Docker Compose peut être déployée sur n'importe quelle VM ou cluster Kubernetes. Consultez le [Guide de démarrage rapide](/docs/guides/quickstart) pour le déploiement Docker Compose, ou le [chart Helm](/docs/deployment/hybrid) pour Kubernetes.

### Comment ajouter plus de niveaux de rate limiting ?

Créez plusieurs groupes de consommateurs (free/pro/enterprise) avec différentes politiques de rate limiting. Les consommateurs obtiennent différentes clés API scoped à leur plan. Cela est couvert en détail dans le [guide d'onboarding des consommateurs](/docs/guides/consumer-onboarding).

### STOA peut-il gérer MCP (agents IA) ?

Oui — c'est en fait le différenciateur principal de STOA. Chaque API que vous enregistrez peut également être exposée comme outil MCP, la rendant appelable par des agents IA comme Claude. Consultez [convertir des APIs REST en outils MCP](/blog/convert-rest-api-to-mcp-tools).
