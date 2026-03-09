---
sidebar_position: 20
title: "Semaine 1 avec STOA : Runbook Opérationnel"
description: "Votre première semaine à opérer STOA en production. Couvre la surveillance, la gestion des logs, le réglage des politiques, l'intégration des consommateurs et les bases de la gestion des incidents."
---

# Semaine 1 avec STOA : Runbook Opérationnel

Vous avez déployé STOA et votre première API est en ligne. Et maintenant ?

Ce runbook couvre les tâches opérationnelles pratiques pour vos 7 premiers jours — les choses qui ne figurent pas dans le guide "démarrage rapide" mais que vous aurez réellement besoin de faire. Considérez-le comme le manuel que votre futur vous aurait aimé lire.

**À qui s'adresse ce guide :** Freelances, développeurs indépendants et petites équipes opérant STOA en production pour la première fois.

---

## Jour 1 : Vérifier Votre Déploiement

### Vérifier que Tous les Services sont Sains

```bash
# Si vous utilisez Docker Compose
docker compose ps

# Tous les services doivent afficher "Up" et "healthy"
# Sortie attendue :
# control-plane-api   Up   0.0.0.0:8000->8000/tcp   healthy
# control-plane-ui    Up   0.0.0.0:3000->3000/tcp   healthy
# stoa-gateway        Up   0.0.0.0:3001->3001/tcp   healthy
# developer-portal    Up   0.0.0.0:3002->3002/tcp   healthy
# postgres            Up   0.0.0.0:5432->5432/tcp   healthy
# keycloak            Up   0.0.0.0:8080->8080/tcp   healthy
```

### Vérifier que le Gateway Répond

```bash
curl -s ${STOA_GATEWAY_URL}/health
# Attendu : {"status":"ok","version":"0.1.0","uptime_seconds":3600}
```

### Confirmer que Votre API est Accessible

```bash
# Remplacez par votre clé API et votre chemin
curl -s ${STOA_GATEWAY_URL}/your-api/endpoint \
  -H "X-API-Key: your-api-key" \
  -w "\nHTTP Status: %{http_code}\nLatency: %{time_total}s\n"
```

Si vous voyez `HTTP Status: 200` et une latence raisonnable (inférieure à 500ms pour les backends locaux), tout va bien.

### Vérifier que Keycloak est Accessible

```bash
curl -s ${STOA_AUTH_URL}/health/ready
# Attendu : {"status":"UP"}
```

---

## Jour 2 : Configurer la Surveillance

### Activer les Métriques Intégrées de STOA

STOA expose des métriques Prometheus à `/metrics`. Si vous utilisez Docker Compose avec la stack d'observabilité :

```bash
# Vérifier que Prometheus scrape STOA
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "stoa-gateway") | .health'
# Attendu : "up"
```

Ouvrez Grafana à `http://localhost:3003` pour voir les tableaux de bord pré-construits :
- **Aperçu Gateway** : taux de requêtes, taux d'erreur, percentiles de latence
- **Utilisation Consommateurs** : requêtes par consommateur, top consommateurs par volume
- **Limitation de Débit** : requêtes rejetées au fil du temps

### Créer un Script de Vérification de Santé Simple

Sauvegardez ceci sous `check-stoa.sh` et lancez-le via cron :

```bash
#!/bin/bash
# check-stoa.sh — exécuter toutes les 5 minutes via cron

GATEWAY_URL="${STOA_GATEWAY_URL:-http://localhost:8080}"
ALERT_EMAIL="you@example.com"

response=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health")

if [ "$response" != "200" ]; then
  echo "ALERT: STOA gateway returned $response at $(date)" | mail -s "STOA Health Alert" "$ALERT_EMAIL"
fi
```

Ajoutez au cron :
```bash
crontab -e
# Ajoutez :
*/5 * * * * /path/to/check-stoa.sh
```

### Configurer la Surveillance de Disponibilité

Pour une vérification de santé externe gratuite, utilisez [UptimeRobot](https://uptimerobot.com) ou [Better Stack](https://betterstack.com/uptime) :
- Surveiller : `https://your-gateway-domain/health`
- Intervalle de vérification : toutes les 5 minutes
- Alerte : email ou webhook Slack

Cela détecte les situations où votre serveur est opérationnel mais STOA ne l'est pas.

---

## Jour 3 : Gérer Vos Logs

### Où Sont les Logs ?

STOA envoie les logs vers stdout par défaut (Docker les capture). Consultez-les :

```bash
# Logs du gateway (requêtes, erreurs, événements de limitation de débit)
docker compose logs stoa-gateway --tail=100 --follow

# Logs de l'API (plan de contrôle, gestion des tenants)
docker compose logs control-plane-api --tail=100 --follow
```

### Ce qu'il Faut Surveiller

**Normal (ignorez ces entrées) :**
```
INFO  request completed path=/health status=200 latency=1ms
INFO  rate_limit_check consumer=my-consumer remaining=95/100
```

**Enquêtez sur celles-ci :**
```
WARN  rate_limit_exceeded consumer=my-consumer path=/api/endpoint
ERROR backend_error path=/api/endpoint status=502 error="connection refused"
ERROR auth_failed path=/api/endpoint reason="invalid_api_key"
```

**À corriger immédiatement :**
```
ERROR database_connection_failed
PANIC recovery triggered  # Cela ne devrait pas arriver — signalez un bug
```

### Configurer la Rotation des Logs

Par défaut, Docker conserve les logs indéfiniment. Ajoutez la rotation des logs dans votre `docker-compose.yml` :

```yaml
services:
  stoa-gateway:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"   # Max 100Mo par fichier de log
        max-file: "5"      # Conserver 5 fichiers rotatifs = 500Mo max
```

Redémarrez les services après la mise à jour :
```bash
docker compose up -d
```

### Interroger les Logs pour des Événements Spécifiques

```bash
# Trouver toutes les erreurs 5xx de la dernière heure
docker compose logs stoa-gateway --since=1h 2>/dev/null | grep '"status":5'

# Trouver les événements de limitation de débit pour un consommateur spécifique
docker compose logs stoa-gateway 2>/dev/null | grep "rate_limit_exceeded.*my-consumer"

# Compter les requêtes par code de statut
docker compose logs stoa-gateway --since=24h 2>/dev/null | grep -oP '"status":\d+' | sort | uniq -c

# Interroger les logs d'audit via l'API (structuré, filtrable)
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs[] | {action, resource, user, created_at}'
```

---

## Jour 4 : Ajuster Vos Politiques

### Revoir Vos Limites de Débit

Après quelques jours de trafic, vérifiez si vos limites sont adaptées :

```bash
TOKEN="your-admin-token"
TENANT_ID="your-tenant-id"

# Obtenir les événements de limitation de débit des dernières 24h
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?event_type=rate_limit_exceeded&hours=24" \
  -H "Authorization: Bearer $TOKEN" | jq '.total_events'
```

**Ajustez en fonction de ce que vous observez :**

| Événements/Jour | Action |
|----------------|--------|
| 0 | Vos limites sont peut-être trop généreuses — correct sauf si vous avez beaucoup de trafic |
| 1-50 | Normal — les clients dépassent occasionnellement la limite |
| 50-500 | Vérifiez quels consommateurs atteignent les limites — des offres par paliers pourraient être nécessaires |
| 500+ | Soit un client mal configuré, soit vos limites sont trop basses pour votre trafic |

### Mettre à Jour une Politique de Limitation de Débit

```bash
POLICY_ID="your-policy-id"

curl -s -X PATCH "${STOA_API_URL}/v1/admin/policies/$POLICY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "requests_per_minute": 200,
      "burst": 20
    }
  }' | jq .
```

Les modifications de limitation de débit prennent effet immédiatement — pas de redémarrage nécessaire.

### Ajouter une Politique CORS (Si Vous Servez des Clients Browser)

Si votre API est appelée depuis des navigateurs web, vous avez besoin des en-têtes CORS :

```bash
CORS_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
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
      "headers": ["Content-Type", "X-API-Key"],
      "max_age": 3600
    }
  }' | jq -r .id)

# Associer à votre API
curl -s -X POST "${STOA_API_URL}/v1/admin/policies/bindings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "'$CORS_POLICY_ID'",
    "api_catalog_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq .
```

---

## Jour 5 : Intégrer Votre Premier Consommateur

### Inviter un Client sur le Portail Développeur

Vos clients peuvent s'inscrire eux-mêmes à `http://localhost:3002` (ou votre URL de portail en production). Guidez-les :

1. **S'inscrire** : cliquer sur "Demander l'accès", renseigner nom + email
2. **Parcourir les APIs** : ils voient vos APIs publiées avec leurs descriptions
3. **S'abonner** : cliquer sur "S'abonner" sur l'API dont ils ont besoin
4. **Obtenir leur clé** : après votre approbation, ils reçoivent une clé API dans leur tableau de bord

Vous approuvez les abonnements dans la Console : **Abonnements → En attente → Approuver**.

### Création Programmatique de Consommateurs (Pour l'Automatisation)

Si vous construisez un SaaS et souhaitez provisionner automatiquement des clés API lors de l'inscription des utilisateurs :

```bash
# Étape 1 : Créer le consommateur
CONSUMER_ID=$(curl -s -X POST "${STOA_API_URL}/v1/consumers/$TENANT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "user-'$(date +%s)'",
    "name": "user-12345",
    "email": "user@example.com",
    "consumer_metadata": {
      "user_id": "12345",
      "plan": "starter"
    }
  }' | jq -r .id)

# Étape 2 : Créer un abonnement (obtenir la clé API)
API_KEY=$(curl -s -X POST "${STOA_API_URL}/v1/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": "'$CONSUMER_ID'",
    "api_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq -r .api_key)

echo "API Key: $API_KEY"
```

Stockez cette clé dans le compte de votre utilisateur. Vous pourrez la révoquer ultérieurement :

```bash
SUBSCRIPTION_ID="subscription-id-from-above"
curl -s -X POST "${STOA_API_URL}/v1/subscriptions/$SUBSCRIPTION_ID/revoke" \
  -H "Authorization: Bearer $TOKEN"
```

### Définir des Limites Spécifiques au Consommateur

Pour accorder à un consommateur premium une limite de débit plus élevée, créez une politique dédiée au scope tenant et associez-la à son consommateur :

```bash
# Créer une politique à haute limite scopée à un consommateur spécifique
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "premium-rate-limit-'$CONSUMER_ID'",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "tenant",
    "config": {
      "requests_per_minute": 1000,
      "burst": 50
    },
    "priority": 50
  }' | jq .
```

Les politiques de priorité plus haute (numéro plus petit) remplacent celles de priorité plus faible pour le même consommateur.

---

## Jour 6 : Se Préparer aux Incidents

### Construire Votre Runbook

Avant qu'un problème survienne, écrivez ce que vous ferez. Restez simple :

```markdown
# Runbook d'Incident STOA

## Gateway Hors Service (5xx sur le health check)
1. Vérifier le service : docker compose ps
2. Vérifier les logs : docker compose logs stoa-gateway --tail=50
3. Redémarrer si nécessaire : docker compose restart stoa-gateway
4. Si toujours en panne : docker compose down && docker compose up -d

## Base de Données Hors Service
1. Vérifier : docker compose ps postgres
2. Vérifier les logs : docker compose logs postgres --tail=20
3. Redémarrer : docker compose restart postgres
4. Attendre 30s, puis redémarrer les services dépendants

## Consommateur Bloqué (clé invalide)
1. Chercher le consommateur : GET /v1/consumers/$TENANT_ID (filtrer par email)
2. Obtenir ses abonnements : GET /v1/subscriptions/tenant/$TENANT_ID
3. Faire tourner la clé : POST /v1/subscriptions/$SUBSCRIPTION_ID/rotate-key
4. Envoyer la nouvelle clé au client

## Mauvaise Configuration de Limitation de Débit
1. Identifier la politique : GET /v1/tenants/$TENANT_ID/policies
2. Ajuster : PATCH /v1/tenants/$TENANT_ID/policies/$POLICY_ID
3. Les modifications prennent effet immédiatement
```

### Tester Vos Procédures de Récupération

Entraînez-vous avant d'en avoir besoin :

```bash
# Tester le redémarrage (devrait prendre <10s)
time docker compose restart stoa-gateway

# Tester l'arrêt/démarrage complet (devrait prendre <30s)
time (docker compose down && docker compose up -d)

# Tester la rotation des clés
curl -s -X POST "${STOA_API_URL}/v1/tenants/$TENANT_ID/consumers/$CONSUMER_ID/rotate-key" \
  -H "Authorization: Bearer $TOKEN" | jq .api_key
```

---

## Jour 7 : Revue Hebdomadaire

Exécutez ceci chaque semaine :

```bash
#!/bin/bash
# weekly-stoa-review.sh

echo "=== STOA Weekly Review $(date +%Y-%m-%d) ==="

echo ""
echo "--- Service Health ---"
docker compose ps

echo ""
echo "--- Error Rate (last 7 days) ---"
docker compose logs stoa-gateway --since=168h 2>/dev/null | grep -c '"status":5' || echo "0 errors"

echo ""
echo "--- Top Rate Limited Consumers ---"
curl -s "${STOA_API_URL}/v1/tenants/$TENANT_ID/logs?event_type=rate_limit_exceeded&hours=168" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | group_by(.consumer) | map({consumer: .[0].consumer, count: length}) | sort_by(.count) | reverse | .[0:5]'

echo ""
echo "--- Active Consumers ---"
curl -s "${STOA_API_URL}/v1/tenants/$TENANT_ID/consumers" \
  -H "Authorization: Bearer $TOKEN" | jq '.total'

echo ""
echo "--- Disk Usage ---"
docker system df
```

### Sur Quoi Agir

| Constat | Action |
|---------|--------|
| Un service non sain | Enquêter sur les logs immédiatement |
| Taux d'erreur >1% | Trouver la cause racine, corriger avant que ça empire |
| Consommateur atteignant les limites quotidiennement | Envisager de mettre à jour son offre ou d'augmenter sa limite |
| Disque >80% | Nettoyer les anciens logs : `docker system prune` (supprime les images/conteneurs inutilisés) |
| Aucune requête depuis 24h+ | Vérifier votre intégration client — quelque chose a peut-être cassé |

---

## Problèmes Courants de la Semaine 1

### "Le consommateur obtient 401 à chaque requête"

La clé API est soit incorrecte, soit non associée à la bonne API :
```bash
# Vérifier le consommateur et ses associations API
curl -s "${STOA_API_URL}/v1/tenants/$TENANT_ID/consumers?email=client@example.com" \
  -H "Authorization: Bearer $TOKEN" | jq '.consumers[0] | {api_key, api_ids}'
```

### "Le gateway retourne 502 Bad Gateway"

Votre backend est inaccessible depuis le conteneur gateway :
```bash
# Tester la connectivité backend depuis l'intérieur du conteneur gateway
docker compose exec stoa-gateway curl -s http://your-backend:port/health
```

Causes courantes :
- Utilisation de `localhost` pour l'URL du backend (ne fonctionne pas dans Docker — utilisez `host.docker.internal` sur Mac/Windows)
- Le service backend n'est pas démarré
- Un pare-feu bloque la connexion

### "Les logs remplissent le disque en quelques jours"

Ajoutez la configuration de rotation des logs du Jour 3, ou réduisez la verbosité des logs :
```yaml
# Dans docker-compose.yml
environment:
  - LOG_LEVEL=warn  # Loguer uniquement les avertissements et erreurs (par défaut : info)
```

### "Token Keycloak expiré, l'API admin retourne 401"

Les tokens expirent après 5 minutes par défaut :
```bash
# Toujours obtenir un token frais avant les appels API admin
get_token() {
  curl -s -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token \
    -d "client_id=control-plane-api&client_secret=${KC_SECRET}&grant_type=client_credentials" \
    | jq -r .access_token
}

TOKEN=$(get_token)
```

---

## La Suite

Après la semaine 1, vous devriez avoir un API gateway stable et surveillé. À partir de là :

- **[Série Sécurité : Partie 1 — Vos APIs sont Plus Vulnérables que Vous ne le Pensez](/blog/freelancer-api-security-part-1-vulnerabilities)** — durcissement de sécurité approfondi
- **[Stratégies de Limitation de Débit qui Fonctionnent Vraiment](/blog/freelancer-api-security-part-2-rate-limiting)** — au-delà de la limitation de base
- **[Guide d'Authentification](/docs/guides/authentication)** — JWT, OAuth 2.0 et options mTLS
- **[Guide d'Observabilité](/docs/guides/observability)** — configuration complète Prometheus + Grafana
- **[Intégration des Consommateurs](/docs/guides/consumer-onboarding)** — workflows du portail en libre-service
