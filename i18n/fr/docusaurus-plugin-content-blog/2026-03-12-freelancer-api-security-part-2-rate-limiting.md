---
slug: freelancer-api-security-part-2-rate-limiting
title: "Rate Limiting Efficace (Sécurité Freelance Partie 2)"
description: "Fenêtres glissantes, allocations de burst, limites par endpoint et plans étagés. Comment affiner le rate limiting sans casser vos utilisateurs légitimes."
authors: [stoa-team]
tags: [security, tutorial, api-gateway]
keywords:
  - api rate limiting strategies
  - sliding window rate limiting
  - rate limit per endpoint
  - api rate limit tuning
  - burst allowance api
  - rate limiting freelancer api
  - api gateway rate limit configuration
---
<!-- last verified: 2026-02 -->

Vous avez configuré le rate limiting : 100 requêtes par minute. C'est fait, non ?

Pas tout à fait. Une limite fixe de 100 req/min casse les utilisateurs légitimes lors d'une activité en rafale, laisse les bots vous abuser avec des attaques à trickle lent, et ne différencie pas vos utilisateurs gratuits de vos clients payants.

Il s'agit de la Partie 2 de la série. Nous allons approfondir le rate limiting — les stratégies qui fonctionnent en pratique.

<!-- truncate -->

*Il s'agit de la Partie 2 de la Série Sécurité API pour Freelances. [Partie 1 : Vos APIs sont plus vulnérables que vous ne le pensez](/blog/freelancer-api-security-part-1-vulnerabilities) | [Partie 3 : Pistes d'audit quand les choses tournent mal](/blog/freelancer-api-security-part-3-audit-trails)*

---

## Pourquoi le rate limiting simple échoue

Une limite fixe de `100 requêtes/minute` semble raisonnable jusqu'à ce que vous pensiez à l'utilisation réelle :

**Scénario 1 — Le job par lots :** votre client exécute un job de synchronisation nocturne. Il effectue 200 requêtes dans les 10 premières secondes, puis rien pendant les 50 minutes suivantes. Avec une limite fixe, ça échoue. Avec une allocation de burst, ça réussit.

**Scénario 2 — Le bot lent :** un scraper effectue exactement 99 requêtes/minute, 24 heures sur 24. Il n'atteint jamais votre limite. Il extrait 142 560 enregistrements/jour. Une limite de volume quotidien le capture ; une limite par minute non.

**Scénario 3 — L'utilisateur gratuit :** vous voulez que les utilisateurs gratuits obtiennent 100 req/min et les utilisateurs payants 1 000 req/min. Une politique globale ne peut pas encoder ces distinctions. Les politiques par niveau de consommateur le peuvent.

**Scénario 4 — L'endpoint coûteux :** votre endpoint `/api/export` génère un PDF et prend 2 secondes. Chaque appel est 50 fois plus coûteux qu'une simple lecture. Une limite par endpoint a du sens ici ; appliquer la limite globale les traite comme équivalents.

Une bonne stratégie de rate limiting gère les quatre scénarios.

---

## Stratégie 1 : Fenêtre glissante + Burst

L'amélioration la plus importante par rapport à une limite fixe.

**Problème de la fenêtre fixe :** avec une fenêtre fixe de 100 req/min, un client peut effectuer 100 requêtes à 11:59:50, se réinitialiser à minuit, et effectuer 100 autres requêtes à 12:00:00 — 200 requêtes en 20 secondes sans violation.

**Solution de la fenêtre glissante :** la fenêtre se déplace avec chaque requête. « 100 requêtes dans les 60 dernières secondes » est évalué à chaque requête, pas au début de chaque minute.

**Allocation de burst :** permet de courts pics au-dessus du taux soutenu. Un client avec 100 req/min peut burster à 20 requêtes instantanément (le burst), puis continue au taux soutenu.

```bash
# Fenêtre glissante avec burst : 100 req/min, burst de 20
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sliding-window-with-burst",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "requests_per_minute": 100,
      "burst": 20,
      "algorithm": "sliding_window"
    }
  }' | jq .
```

Le burst gère le pattern « job par lots au démarrage » sans permettre le pattern « abus aux limites ».

---

## Stratégie 2 : Limites multi-niveaux par consommateur

Différents consommateurs obtiennent différentes limites selon leur plan.

**La mauvaise façon :** différentes politiques globales pour différentes APIs (crée de la surcharge de maintenance, difficile à gérer).

**La bonne façon :** politiques étagées liées aux consommateurs, avec la politique par défaut gérant les consommateurs sans niveau.

```bash
# Niveau 1 : Gratuit (politique par défaut, déjà liée à l'API)
# Déjà configuré depuis la Partie 1 : 100 req/min

# Niveau 2 : Starter (10 €/mois)
STARTER_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tier-starter",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "tenant",
    "priority": 50,
    "config": {
      "requests_per_minute": 500,
      "burst": 50,
      "algorithm": "sliding_window"
    }
  }' | jq -r .id)

# Niveau 3 : Pro (50 €/mois)
PRO_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tier-pro",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "tenant",
    "priority": 50,
    "config": {
      "requests_per_minute": 2000,
      "burst": 200,
      "algorithm": "sliding_window"
    }
  }' | jq -r .id)
```

Quand un client passe à un niveau supérieur, liez la politique de niveau supérieur à son consommateur. Le gateway applique la politique de priorité la plus haute correspondante. Pas de déploiement de code, pas de redémarrage.

---

## Stratégie 3 : Limites de volume quotidiennes

Les limites par minute arrêtent les abus de burst. Les limites quotidiennes arrêtent le scraper lent de la Stratégie 2.

```bash
# Ajouter une limite de quota quotidienne en plus de la limite par minute
DAILY_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "daily-volume-cap",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "requests_per_day": 5000,
      "reset_time": "00:00:00",
      "timezone": "UTC"
    }
  }' | jq -r .id)

# Lier à votre API (en plus de la politique par minute)
curl -s -X POST "${STOA_API_URL}/v1/admin/policies/bindings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "'$DAILY_POLICY_ID'",
    "api_catalog_id": "'$API_ID'",
    "tenant_id": "'$TENANT_ID'"
  }' | jq .
```

Le gateway applique LES DEUX limites simultanément. Un client qui reste sous 100 req/min mais effectue 50 000 requêtes/jour sera quand même bloqué au plafond quotidien.

---

## Stratégie 4 : Limites par endpoint

Certains endpoints sont plus coûteux que d'autres. Appliquez des limites plus strictes là où c'est important.

**Candidats courants :**
- Endpoints d'export / de génération de rapport (intensifs en CPU/mémoire)
- Endpoints de recherche (intensifs en base de données)
- Enregistrement de webhooks (peut créer de l'état)
- Endpoints d'inférence IA (coût par appel)

```bash
# Rate limit global API : 200 req/min (généreux pour la plupart des endpoints)
# Rate limit endpoint export : 5 req/min (strict — opération coûteuse)

EXPORT_LIMIT_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "export-endpoint-limit",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "priority": 10,
    "config": {
      "requests_per_minute": 5,
      "burst": 2,
      "path_pattern": "/export/*"
    }
  }' | jq -r .id)
```

La politique par endpoint de priorité plus haute (numéro inférieur) s'applique aux chemins `/export/*`, tandis que la politique par défaut s'applique à tout le reste.

---

## Stratégie 5 : Limites conscientes des coûts pour les proxys IA

Si votre API proxifie des appels de modèles IA (OpenAI, Anthropic, etc.), les limites standard par nombre de requêtes ne suffisent pas — une seule requête avec un contexte de 100 000 tokens coûte bien plus que 100 requêtes simples.

La bonne métrique est les **tokens** (ou le coût estimé), pas les requêtes.

```bash
# Rate limit basé sur les tokens pour l'endpoint proxy IA
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ai-proxy-token-budget",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "requests_per_minute": 20,
      "burst": 5,
      "path_pattern": "/ai/*",
      "max_request_body_kb": 50
    }
  }' | jq .
```

Cela combine le rate limiting des requêtes avec les limites de taille de payload. Un corps de requête de 50 Ko est suffisant pour des prompts IA substantiels sans permettre l'attaque par bourrage de contexte de 1 Mo de la [Partie 1](/blog/freelancer-api-security-part-1-vulnerabilities).

---

## Affiner sans casser les utilisateurs

La partie la plus difficile du rate limiting n'est pas de le configurer — c'est de l'affiner correctement. Trop serré, et vous cassez les utilisateurs légitimes. Trop souple, et vous n'êtes pas protégé.

### Étape 1 : Observer avant de restreindre

Commencez avec des limites généreuses et observez les patterns d'utilisation réels :

```bash
# Vérifier l'utilisation des quotas pour tous les consommateurs sur les 7 derniers jours
curl -s "${STOA_API_URL}/v1/admin/quotas/$TENANT_ID/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.consumers | sort_by(.peak_rpm) | reverse | .[0:10] | .[] | {consumer: .name, peak_rpm, avg_rpm, daily_max}'
```

Cela montre vos meilleurs consommateurs par taux de requêtes de pointe et moyen. Définissez votre limite à 2-3× le taux de pointe légitime. Cela protège contre les abus tout en donnant de la marge aux vrais utilisateurs.

### Étape 2 : Retourner des headers de rate limit utiles

Quand vous retournez un `429`, incluez des informations pour que les clients puissent se rabattre intelligemment :

STOA ajoute automatiquement ces headers aux réponses limitées :
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709251200
Retry-After: 45
```

Un client bien conçu lit `Retry-After` et attend avant de réessayer. C'est la différence entre un pic bref et un troupeau déchaîné.

### Étape 3 : Différencier la limite de rate du quota dépassé

Deux types différents de 429 méritent des messages différents :

| Situation | Signification | Le client devrait |
|-----------|---------|---------------|
| Limite de rate atteinte | Trop de requêtes dans une courte fenêtre | Attendre `Retry-After` secondes |
| Quota quotidien atteint | Allocation du jour épuisée | Attendre jusqu'à `X-RateLimit-Reset` (minuit UTC) |
| Quota mensuel atteint | Limite du plan atteinte | Passer à un plan supérieur |

```bash
# Vérifier si un consommateur est proche de son quota
curl -s "${STOA_API_URL}/v1/quotas/$TENANT_ID/$CONSUMER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    daily_used: .daily_count,
    daily_limit: .daily_limit,
    pct_used: (.daily_count / .daily_limit * 100 | floor)
  }'
```

Envoyez un email d'avertissement quand les consommateurs atteignent 80% de leur quota quotidien — avant qu'ils ne se heurtent au mur.

### Étape 4 : Surveiller les faux positifs

Après avoir resserré les limites, vérifiez les utilisateurs légitimes bloqués :

```bash
# Trouver les consommateurs qui ont été limités dans les 24 dernières heures
curl -s "${STOA_API_URL}/v1/audit/$TENANT_ID?event_type=rate_limit_exceeded&hours=24" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs | group_by(.consumer_id) | map({
    consumer: .[0].consumer_name,
    count: length,
    first_hit: .[0].created_at,
    last_hit: .[-1].created_at
  }) | sort_by(.count) | reverse'
```

Si un client payant se retrouve régulièrement bloqué, sa limite est trop basse. Augmentez-la.

---

## La configuration complète de rate limiting

Voici la configuration complète pour une API SaaS de freelance typique :

```bash
# 1. Limite par défaut pour le niveau gratuit (tous les consommateurs commencent ici)
FREE_LIMIT=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"free-tier","policy_type":"rate_limit","tenant_id":"'$TENANT_ID'","scope":"api","config":{"requests_per_minute":100,"burst":20,"requests_per_day":5000}}' \
  | jq -r .id)

# 2. Limite par minute pour les endpoints coûteux
EXPORT_LIMIT=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"export-limit","policy_type":"rate_limit","tenant_id":"'$TENANT_ID'","scope":"api","priority":10,"config":{"requests_per_minute":5,"burst":2,"path_pattern":"/export/*"}}' \
  | jq -r .id)

# 3. Limite de taille de payload
SIZE_LIMIT=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"size-limit","policy_type":"transform","tenant_id":"'$TENANT_ID'","scope":"api","config":{"request":{"max_body_size_kb":100}}}' \
  | jq -r .id)

# 4. Lier les trois à votre API
for POLICY_ID in $FREE_LIMIT $EXPORT_LIMIT $SIZE_LIMIT; do
  curl -s -X POST "${STOA_API_URL}/v1/admin/policies/bindings" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"policy_id":"'$POLICY_ID'","api_catalog_id":"'$API_ID'","tenant_id":"'$TENANT_ID'"}' \
    -o /dev/null -w "Politique liée $POLICY_ID : %{http_code}\n"
done
```

Trois politiques, trois appels API, et vous avez : fenêtre glissante par minute, plafond de volume quotidien, protection par endpoint pour les appels coûteux, et limites de taille de payload.

---

## FAQ

### Quelle est la bonne valeur pour ma limite ?

Commencez à 10× votre utilisation de pointe légitime attendue. Si votre utilisateur le plus actif effectue 50 req/min en fonctionnement normal, définissez la limite à 500 req/min. Affinez avec le temps à mesure que vous observez l'utilisation.

### Devrais-je limiter par IP ou par consommateur ?

Par consommateur (clé API), toujours. Le rate limiting basé sur l'IP casse les environnements partagés (NAT d'entreprise, VMs cloud, réseaux mobiles) et est facilement contourné en faisant pivoter les IPs. Le rate limiting basé sur le consommateur ne peut pas être contourné en changeant d'IP.

### Mon client a un job par lots légitime qui burste — que puis-je faire ?

Option 1 : augmentez son allocation de burst (liez une politique à burst plus élevé à son consommateur).
Option 2 : demandez-lui d'ajouter un backoff exponentiel — son job réessaie après `Retry-After` secondes.
Option 3 : créez un endpoint de job asynchrone qui accepte un lot et le traite en arrière-plan, retournant un ID de job à interroger.

### Ai-je besoin de limites différentes pour les endpoints de lecture vs d'écriture ?

Souvent oui. Les écritures (POST, PUT, DELETE) devraient généralement avoir des limites plus strictes que les lectures (GET), car :
1. Elles sont plus coûteuses (écritures vs lectures de base de données)
2. Les abus ont un impact plus grave (création de données en masse, corruption d'état)

Utilisez la configuration `path_pattern` pour appliquer des limites plus strictes aux chemins d'écriture.

### Comment le rate limiting interagit-il avec les nouvelles tentatives ?

Retournez `Retry-After` dans la réponse 429. Les clients correctement implémentés se rabattront. Pour les services internes, implémentez un backoff exponentiel : première nouvelle tentative après 1s, deuxième après 2s, troisième après 4s, jusqu'à un maximum (par exemple 60s).

---

## Prochaine étape dans la série

Vous avez configuré le rate limiting. La question suivante est : que s'est-il passé avant que vous ne l'activiez, et que se passe-t-il quand quelque chose passe quand même ?

**[Partie 3 : Pistes d'audit quand les choses tournent mal](/blog/freelancer-api-security-part-3-audit-trails)** couvre la journalisation structurée, quoi capturer, comment construire des requêtes utiles, et la réponse aux incidents minimale viable pour les développeurs solo.
