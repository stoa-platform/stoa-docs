---
slug: week-1-with-stoa-operations-runbook
title: "Runbook d'Opérations Semaine 1 : De l'Installation à la Production"
description: "Guide d'opérations jour par jour pour votre première semaine. Surveillance, politiques, consommateurs et étapes de renforcement pour la production dans le bon ordre."
authors: [stoa-team]
tags: [tutorial, education, api-gateway]
keywords:
  - stoa platform first week guide
  - api gateway operations runbook
  - stoa monitoring setup tutorial
  - api gateway production checklist
  - stoa platform onboarding guide
  - week 1 api gateway operations
---
<!-- last verified: 2026-02 -->

Vous avez installé STOA. Le health check retourne 200. Et maintenant ?

L'écart entre "ça tourne" et "c'est prêt pour la production" est là où la plupart des configurations échouent. Ce runbook couvre vos 7 premiers jours avec STOA — les habitudes opérationnelles qui préviennent les surprises à 3h du matin, la surveillance qui détecte les problèmes avant vos utilisateurs, et les étapes de renforcement qui séparent une démo d'un vrai déploiement.

<!-- truncate -->

## À Qui S'adresse Ce Guide

Ce guide est destiné aux développeurs, freelances et petites équipes qui ont STOA en fonctionnement (via [Docker Compose](/blog/stoa-quickstart-first-api-5-minutes) ou Kubernetes) et qui veulent passer de "installé" à "en exploitation avec confiance".

Chaque jour construit sur le précédent. Au Jour 7, vous aurez la surveillance, les alertes, les consommateurs, les politiques et une checklist de production complétée.

:::tip Configurez votre environnement
```bash
export STOA_API_URL="http://localhost:8000"      # Control Plane API
export STOA_GATEWAY_URL="http://localhost:3001"   # Endpoint Gateway
export STOA_AUTH_URL="http://localhost:8080"       # Keycloak
export TENANT_ID="default"                        # Votre ID de tenant
```

Remplacez par vos URLs de production si vous déployez à distance. Consultez le [guide d'opérations complet](/docs/guides/week-1-operations) pour les détails spécifiques à l'environnement.
:::

---

## Jour 1 : Vérifier que Tout Fonctionne

Avant d'ajouter quoi que ce soit de nouveau, confirmez que votre baseline est solide.

### Health Check de Tous les Services

```bash
# Gateway
curl -s ${STOA_GATEWAY_URL}/health | jq .
# Attendu : {"status":"ok","version":"..."}

# Control Plane API
curl -s ${STOA_API_URL}/health | jq .
# Attendu : {"status":"ok"}

# Keycloak
curl -s ${STOA_AUTH_URL}/health/ready
# Attendu : {"status":"UP"}
```

Si un service échoue, vérifiez les logs avant de continuer :

```bash
docker compose logs <service-name> --tail=50
```

### Obtenir votre Token Admin

Vous en aurez besoin pour chaque appel API dans ce runbook :

```bash
TOKEN=$(curl -s -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token \
  -d "client_id=control-plane-api" \
  -d "client_secret=your-client-secret" \
  -d "grant_type=client_credentials" | jq -r .access_token)
```

### Explorer la Console

Ouvrez `http://localhost:3000` (ou votre URL Console) et connectez-vous avec vos credentials admin. Parcourez :

- **Tableau de bord** : vue d'ensemble des APIs, consommateurs et volume de requêtes
- **APIs** : votre catalogue d'APIs enregistrées
- **Politiques** : limites de débit, CORS et règles de sécurité
- **Consommateurs** : qui a accès à quoi

C'est votre centre de commande. Mettez-le en favori.

**Checkpoint Jour 1** : Tous les services sains, Console accessible, token admin fonctionnel.

---

## Jour 2 : Enregistrer votre Première API

Si vous avez suivi le [Quick Start](/blog/stoa-quickstart-first-api-5-minutes), vous avez déjà une API de test. Maintenant enregistrons-en une vraie.

### Créer un Contrat UAC

L'[Universal API Contract](/blog/uac-in-5-minutes-define-once-expose-everywhere) est la façon dont STOA gère les APIs. Un contrat, plusieurs bindings de protocole :

```bash
CONTRACT_ID=$(curl -s -X POST "${STOA_API_URL}/v1/contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "my-service-api",
    "apiVersion": "1.0.0",
    "tenant": "'$TENANT_ID'",
    "displayName": "My Service API",
    "description": "Backend service for my application",
    "endpoint": {
      "url": "http://my-backend:8080/api",
      "method": "REST",
      "timeout": "15s"
    },
    "auth": {
      "type": "api_key"
    },
    "portal": {
      "visible": true,
      "categories": ["production"]
    }
  }' | jq -r .id)

echo "Contract ID: $CONTRACT_ID"
```

### Vérifier qu'elle est Accessible

```bash
curl -s -o /dev/null -w "HTTP %{http_code} in %{time_total}s\n" \
  "${STOA_GATEWAY_URL}/my-service-api/v1/health" \
  -H "X-API-Key: your-test-key"
```

Vous devriez voir `HTTP 200`. Si vous obtenez un `502`, votre URL backend n'est pas accessible depuis le conteneur gateway. Correction courante : utilisez `host.docker.internal` au lieu de `localhost` sur Mac/Windows.

**Checkpoint Jour 2** : Au moins une vraie API enregistrée et appelable via le gateway.

---

## Jour 3 : Configurer les Politiques

Les politiques sont ce qui transforme un proxy en gateway. Commencez par les deux plus importantes : le rate limiting et CORS.

### Ajouter le Rate Limiting

Protégez votre backend des pics de trafic :

```bash
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
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
  }' | jq .
```

### Ajouter CORS (Si Vous Avez des Clients Navigateur)

Sans en-têtes CORS, les navigateurs bloquent les appels API cross-origin :

```bash
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "browser-cors",
    "policy_type": "cors",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "origins": ["https://yourapp.com", "http://localhost:3000"],
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "headers": ["Content-Type", "Authorization", "X-API-Key"],
      "max_age": 3600
    }
  }' | jq .
```

### Tester le Rate Limiting

Envoyez une rafale de requêtes pour vérifier que la limite s'applique :

```bash
for i in $(seq 1 15); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "${STOA_GATEWAY_URL}/my-service-api/v1/health" \
    -H "X-API-Key: your-test-key")
  echo "Request $i: HTTP $STATUS"
done
```

Après avoir dépassé l'allocation de burst, vous devriez voir `HTTP 429` (Too Many Requests). Cela signifie que le rate limiting fonctionne.

**Checkpoint Jour 3** : Politiques de rate limiting et CORS actives et vérifiées.

---

## Jour 4 : Embarquer votre Premier Consommateur

Les APIs sont inutiles sans consommateurs. Configurons-en un.

### Créer un Consommateur

```bash
CONSUMER_ID=$(curl -s -X POST "${STOA_API_URL}/v1/consumers/${TENANT_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "client-001",
    "name": "Acme Corp Integration",
    "email": "dev@acme.example.com",
    "consumer_metadata": {
      "plan": "starter",
      "contact": "Alice"
    }
  }' | jq -r .id)

echo "Consumer ID: $CONSUMER_ID"
```

### Créer un Abonnement (Clé API)

```bash
API_KEY=$(curl -s -X POST "${STOA_API_URL}/v1/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": "'$CONSUMER_ID'",
    "api_id": "'$CONTRACT_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq -r .api_key)

echo "API Key for Acme: $API_KEY"
```

### Vérifier que le Consommateur Peut Accéder à l'API

```bash
curl -s "${STOA_GATEWAY_URL}/my-service-api/v1/health" \
  -H "X-API-Key: $API_KEY" \
  -w "\nHTTP %{http_code}\n"
```

Envoyez cette clé API à votre consommateur. Il peut également s'auto-inscrire via le [Portail Développeur](/docs/guides/portal) à `http://localhost:3002`.

**Checkpoint Jour 4** : Au moins un consommateur créé avec une clé API fonctionnelle.

---

## Jour 5 : Activer la Surveillance

Vous ne pouvez pas résoudre ce que vous ne pouvez pas voir. STOA expose des métriques Prometheus et des logs structurés nativement.

### Vérifier que les Métriques sont Exposées

```bash
curl -s ${STOA_GATEWAY_URL}/metrics | head -20
```

Vous devriez voir des métriques au format Prometheus : `stoa_requests_total`, `stoa_request_duration_seconds`, `stoa_rate_limit_exceeded_total`, et d'autres.

### Configurer un Script de Surveillance de Base

Si vous n'avez pas encore Prometheus/Grafana, commencez par un script de vérification simple :

```bash
#!/bin/bash
# check-stoa.sh — exécuter via cron toutes les 5 minutes

GATEWAY="${STOA_GATEWAY_URL:-http://localhost:3001}"

status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/health")
latency=$(curl -s -o /dev/null -w "%{time_total}" "$GATEWAY/health")

if [ "$status" != "200" ]; then
  echo "[ALERT] Gateway returned $status at $(date)"
fi

if (( $(echo "$latency > 2.0" | bc -l) )); then
  echo "[WARN] Gateway latency ${latency}s at $(date)"
fi
```

Ajoutez au cron :

```bash
crontab -e
# */5 * * * * /path/to/check-stoa.sh >> /var/log/stoa-monitor.log 2>&1
```

### Réviser les Logs du Gateway

STOA journalise chaque requête au format structuré. Les patterns importants à surveiller :

| Pattern de Log | Signification | Action |
|----------------|--------------|--------|
| `status=200` | Requête normale | Aucune |
| `status=429` | Limite de débit atteinte | Vérifier si le consommateur a besoin d'une limite plus élevée |
| `status=502` | Backend inaccessible | Vérifier immédiatement la santé du backend |
| `status=401` | Échec d'auth | Vérifier que la clé API ou le token est valide |

```bash
# Trouver les erreurs dans la dernière heure
docker compose logs stoa-gateway --since=1h 2>/dev/null | grep '"status":5'
```

Pour une configuration complète de l'observabilité avec des tableaux de bord Grafana, consultez le [Guide d'Observabilité](/docs/guides/observability).

**Checkpoint Jour 5** : Script de surveillance en cours d'exécution, vous savez où trouver les logs et métriques.

---

## Jour 6 : Configurer les Alertes

La surveillance sans alerte signifie que vous ne découvrez les problèmes que quand les utilisateurs se plaignent. Configurez le minimum vital d'alertes.

### Trois Alertes Nécessaires dès le Jour 1

| Alerte | Condition | Pourquoi |
|--------|-----------|---------|
| **Gateway down** | Health check retourne non-200 | Votre API est hors ligne |
| **Taux d'erreur élevé** | Taux 5xx > 5% pendant 5 minutes | Le backend est en panne |
| **Tempête de rate limit** | Taux 429 > 50% pendant 10 minutes | Abus possible ou limites mal configurées |

### Surveillance Externe Gratuite

Pour une configuration rapide sans infrastructure, utilisez [UptimeRobot](https://uptimerobot.com) (tier gratuit : 50 moniteurs, vérifications toutes les 5 minutes) :

1. Ajouter un moniteur : `https://your-gateway-domain/health`
2. Alerte via email ou webhook Slack
3. Définir l'intervalle de vérification à 5 minutes

Cela couvre le scénario où votre serveur est opérationnel mais STOA est down.

### Alertes Prometheus (Si Vous Avez Prometheus)

```yaml
# prometheus-alerts.yml
groups:
  - name: stoa
    rules:
      - alert: StoaGatewayDown
        expr: up{job="stoa-gateway"} == 0
        for: 2m
        labels:
          severity: critical

      - alert: StoaHighErrorRate
        expr: rate(stoa_requests_total{status=~"5.."}[5m]) / rate(stoa_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning

      - alert: StoaRateLimitStorm
        expr: rate(stoa_rate_limit_exceeded_total[10m]) / rate(stoa_requests_total[10m]) > 0.5
        for: 10m
        labels:
          severity: warning
```

**Checkpoint Jour 6** : Au moins un health check externe configuré, vous saurez dans les 5 minutes si le gateway tombe.

---

## Jour 7 : Checklist de Production

Avant de dire à qui que ce soit "c'est prêt", parcourez cette checklist.

### Sécurité

| Vérification | Commande | Attendu |
|--------------|---------|---------|
| TLS activé | `curl -I https://your-gateway/health` | `HTTP/2 200` |
| API Admin non publique | `curl https://your-domain:8000/health` | Connection refusée depuis internet |
| Credentials par défaut changés | Vérifier le mot de passe admin Keycloak | Pas `admin`/`admin` |
| Clés API uniques par consommateur | `SELECT count(DISTINCT api_key) FROM subscriptions` | Égal au total des abonnements |

### Fiabilité

| Vérification | Commande | Attendu |
|--------------|---------|---------|
| Le gateway redémarre proprement | `docker compose restart stoa-gateway && curl /health` | 200 en moins de 10s |
| Le rate limiting fonctionne | Test de burst du Jour 3 | 429 après dépassement de la limite |
| Rotation des logs | Vérifier la configuration du driver Docker logs | `max-size` et `max-file` définis |

### Opérations

| Vérification | Comment | Attendu |
|--------------|---------|---------|
| Surveillance active | Vérifier votre outil de surveillance | Statut Vert/UP |
| Alertes testées | Déclencher une alerte de test | Alerte reçue en < 5 min |
| Procédure de sauvegarde documentée | Écrivez-la | Vous savez comment restaurer |
| Runbook d'incident existant | Créez-en un (template ci-dessous) | Couvre les 3 principaux scénarios de panne |

### Runbook d'Incident Minimal

Sauvegardez ceci quelque part que votre équipe peut trouver à 3h du matin :

```markdown
# Runbook d'Incident STOA

## Le gateway retourne 5xx
1. docker compose logs stoa-gateway --tail=50
2. docker compose restart stoa-gateway
3. Si toujours down : docker compose down && docker compose up -d

## Consommateur bloqué (clé invalide)
1. Chercher le consommateur : GET /v1/consumers/$TENANT_ID?email=their@email.com
2. Faire pivoter la clé : POST /v1/subscriptions/$SUB_ID/rotate-key
3. Envoyer la nouvelle clé au consommateur

## Rate limit trop agressif
1. GET /v1/admin/policies (trouver la politique)
2. PATCH /v1/admin/policies/$POLICY_ID avec des limites plus élevées
3. Les changements prennent effet immédiatement — pas de redémarrage
```

**Checkpoint Jour 7** : Tous les éléments de la checklist au vert. Vous êtes prêt pour la production.

---

## Ce que Vous avez Construit en Une Semaine

| Jour | Ce que Vous avez Fait | Pourquoi c'est Important |
|------|-----------------------|--------------------------|
| 1 | Vérifié la baseline | Confirmé que rien n'est cassé avant de construire dessus |
| 2 | Enregistré une vraie API | Votre première charge de travail en production |
| 3 | Ajouté des politiques | Protection contre les pics de trafic et les problèmes de navigateur |
| 4 | Embarqué un consommateur | Quelqu'un peut réellement utiliser votre API |
| 5 | Activé la surveillance | Vous verrez les problèmes avant les utilisateurs |
| 6 | Configuré les alertes | Vous saurez les problèmes même quand vous ne regardez pas |
| 7 | Checklist de production | Confiance que c'est prêt pour le trafic réel |

C'est la fondation. Tout le reste — configurations multi-gateway, déploiements GitOps, MCP pour les agents IA — se construit sur ces bases.

---

## FAQ

### Que faire si je suis bloqué sur une étape spécifique ?

Consultez le [guide d'opérations complet](/docs/guides/week-1-operations) pour le dépannage détaillé de chaque jour. Les problèmes courants comme les erreurs 502, l'expiration des tokens Keycloak et le réseau Docker y sont couverts.

### Comment ajouter plus de gateways (Kong, Gravitee) ?

Le pattern d'adaptateur de STOA supporte 7 backends gateway. Une fois votre premier gateway stable, consultez le [Guide de Configuration Multi-Gateway](/docs/guides/multi-gateway-setup) pour ajouter Kong, Gravitee, Apigee ou d'autres aux côtés du STOA Gateway.

### Où est la communauté ?

- **GitHub Issues** : [github.com/stoa-platform/stoa/issues](https://github.com/stoa-platform/stoa/issues) pour les bugs et demandes de fonctionnalités
- **GitHub Discussions** : pour les questions et les discussions d'architecture
- **Portail Développeur** : vos consommateurs peuvent s'auto-inscrire et parcourir les APIs

### Puis-je sauter des jours ?

Les jours sont séquentiels car chacun construit le contexte pour le suivant. Mais si vous avez déjà la surveillance (Jours 5-6 terminés), sautez au Jour 7 pour la checklist de production.

---

## Prochaines Étapes

- **[UAC en 5 Minutes](/blog/uac-in-5-minutes-define-once-expose-everywhere)** — définir un contrat, exposer en REST + MCP
- **[Sécurité API pour Freelances : Partie 1](/blog/freelancer-api-security-part-1-vulnerabilities)** — renforcement de la sécurité plus poussé après la Semaine 1
- **[Checklist de Sécurité API pour Développeurs Solo](/blog/api-security-checklist-solo-dev)** — gains de sécurité rapides
- **[Guide d'Embarquement des Consommateurs](/docs/guides/consumer-onboarding)** — workflows du portail en libre-service
- **[Guide d'Observabilité](/docs/guides/observability)** — configuration complète Prometheus + Grafana
- **[Guide d'Authentification](/docs/guides/authentication)** — JWT, OAuth 2.0 et options mTLS
