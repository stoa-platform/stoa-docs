---
unlisted: true
slug: saas-playbook-2-rate-limiting-saas
title: "Rate Limiting SaaS : Stratégies par Tenant qui Passent à l'Échelle"
description: "Token bucket vs sliding window pour les APIs multi-tenant. Configurez les niveaux de clé API, la gestion des bursts et les quotas par tenant sans code personnalisé."
authors: [stoa-team]
tags: [tutorial, architecture, api-gateway]
keywords:
  - API rate limiting SaaS multi-tenant
  - per-tenant rate limiting
  - API key tiers SaaS
  - burst handling API gateway
  - rate limiting strategies 2026
  - SaaS API quota management
  - STOA rate limiting
---
<!-- last verified: 2026-02 -->

Le rate limiting est ce qui distingue un produit SaaS qui monte en charge gracieusement de celui qui s'effondre à chaque fois qu'un client lance un batch job. Mais le rate limiting standard — un seul bucket global, un seul ensemble de limites — ne fonctionne pas pour les SaaS multi-tenant. Vous avez besoin d'un rate limiting **par tenant, par niveau, par endpoint** capable d'appliquer des quotas différents à des clients différents sans laisser personne dégrader l'expérience des autres.

Il s'agit de la Partie 2 de la série **SaaS Playbook**. La Partie 1 couvrait les [fondamentaux de la multi-tenancy et les modèles d'isolation des tenants](/blog/saas-playbook-1-multi-tenancy-101). Ici, nous allons en profondeur sur les stratégies de rate limiting.

<!-- truncate -->

## Pourquoi le Rate Limiting Standard Échoue pour le SaaS

La plupart des tutoriels sur le rate limiting couvrent les bases : choisissez un algorithme (token bucket, sliding window), choisissez une clé (adresse IP ou clé API), définissez un seuil. Terminé.

Ce modèle s'effondre dans les SaaS multi-tenant pour plusieurs raisons.

**Le problème du voisin bruyant** : Une seule limite de rate partagée signifie que le job d'export de données d'un tenant consomme la marge qui devrait appartenir au dashboard temps réel d'un autre tenant. Le support client reçoit des appels du tenant dont le dashboard est lent, même si son usage individuel était parfaitement normal.

**La différenciation de plan** : Votre niveau gratuit devrait obtenir 100 requêtes par minute. Votre niveau professionnel devrait en obtenir 10 000. Votre niveau enterprise a besoin de 100 000 avec des allocations de burst pour les opérations batch. Une seule limite globale ne peut pas encoder ces distinctions.

**La granularité au niveau endpoint** : Les endpoints de lecture et d'écriture ont des profils de coût différents. Lister des ressources est bon marché. Exécuter un rapport qui scanne 10 millions d'enregistrements est coûteux. Vous avez besoin de limites différentes pour différentes catégories d'endpoints, appliquées par tenant.

**Trafic en burst vs trafic soutenu** : Les charges de production réelles sont en burst. Un développeur testant une nouvelle intégration pourrait envoyer 200 requêtes en 5 secondes, puis rien pendant une heure. Rejeter ces 200 requêtes avec un compteur strict par minute est une UX hostile. Un rate limiter bien conçu permet de courts bursts tout en contrôlant le débit soutenu.

**Dégradation progressive vs 429 brutal** : Les clients enterprise avec des contrats à forte valeur s'attendent à un avertissement avant une coupure brutale. Ils veulent un header `X-RateLimit-Remaining` pour pouvoir ralentir proactivement, pas un mur soudain d'erreurs 429.

## Algorithmes de Rate Limiting

Comprendre les algorithmes vous aide à choisir le bon outil pour chaque scénario.

### Token Bucket

Le token bucket se remplit à un taux constant (ex. 100 tokens/minute) jusqu'à une capacité maximale (ex. 200 tokens). Chaque requête consomme un token. Quand le bucket est vide, les requêtes sont rejetées jusqu'à ce qu'il se remplisse.

**Comportement** : Permet des bursts jusqu'à la capacité du bucket. Le débit soutenu est limité au taux de remplissage.

**Idéal pour** : Les APIs où de courts bursts sont acceptables (dashboards interactifs, outils CLI).

**Piège** : Deux buckets pleins de requêtes peuvent arriver dans une seule période de remplissage. Avec un taux de remplissage de 100 req/min et une capacité de 200 tokens, un client peut envoyer 400 requêtes dans les deux premières minutes s'il a stocké des tokens.

### Sliding Window

Plutôt qu'une fenêtre d'une minute fixe qui se réinitialise à l'heure, une sliding window compte les requêtes dans les N dernières secondes, mesurées depuis le timestamp de chaque requête.

**Comportement** : Plus lisse que les fenêtres fixes, pas de problème de thundering-herd aux limites de fenêtre.

**Idéal pour** : Les APIs de production où vous voulez des limites de débit soutenu prévisibles.

**Piège** : Plus gourmand en mémoire que le token bucket — nécessite de stocker les timestamps des requêtes récentes plutôt qu'un simple compteur.

### Fixed Window Counter

L'approche la plus simple : un compteur par fenêtre temporelle (ex. par minute, par heure). Se réinitialise au début de chaque fenêtre.

**Comportement** : Prévisible et facile à implémenter. Susceptible au thundering-herd aux limites de fenêtre (tous les clients se réinitialisent simultanément à :00).

**Idéal pour** : Les limites à grain grossier (application de quotas horaires ou journaliers), intégrations de facturation.

**À éviter pour** : Les APIs à haute fréquence — l'effet thundering-herd aux limites de fenêtre crée des pics de latence.

### Leaky Bucket

Les requêtes entrent dans une file d'attente et s'écoulent à un taux fixe. Si la file est pleine, les nouvelles requêtes sont rejetées.

**Comportement** : Trafic sortant parfaitement lisse. Pas de bursts.

**Idéal pour** : La livraison de webhook, les appels API sortants vers des services externes soumis à des limites de rate.

**À éviter pour** : Les APIs interactives — la mise en file d'attente introduit de la latence.

## Architecture de Rate Limiting STOA

STOA implémente le rate limiting par tenant au niveau de la couche gateway en utilisant des CRDs `GuardrailPolicy`. Chaque namespace de tenant a sa propre politique avec ses propres limites — les limites sont isolées entre les tenants par conception.

### Définir un Niveau de Rate Limit

Les niveaux de rate limit sont définis dans les ressources `GuardrailPolicy` :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: GuardrailPolicy
metadata:
  name: professional-tier
  namespace: tenant-acme
spec:
  rateLimit:
    algorithm: token-bucket
    requestsPerMinute: 10000
    burstMultiplier: 2.0        # Allow bursts up to 20,000 req/min
    perEndpoint:
      "/reports/*":
        requestsPerMinute: 100  # Expensive endpoints have stricter limits
      "/export/*":
        requestsPerMinute: 10
    headers:
      exposeRemaining: true     # Send X-RateLimit-Remaining in response
      exposeReset: true         # Send X-RateLimit-Reset in response
```

Cette politique s'applique à toutes les requêtes dans le namespace `tenant-acme`. Le namespace du tenant B possède sa propre `GuardrailPolicy` — leurs limites sont entièrement indépendantes.

### Niveaux de Clé API

L'UAC de STOA supporte l'attribution de niveau basée sur le plan. Quand vous créez un tenant avec `--plan professional`, le gateway résout automatiquement la `GuardrailPolicy` `professional-tier` pour ce tenant.

```yaml
# plan-tiers.yaml — global configuration
apiVersion: gostoa.dev/v1alpha1
kind: PlanTier
metadata:
  name: starter
spec:
  rateLimits:
    requestsPerMinute: 1000
    burstMultiplier: 1.5

---
apiVersion: gostoa.dev/v1alpha1
kind: PlanTier
metadata:
  name: professional
spec:
  rateLimits:
    requestsPerMinute: 10000
    burstMultiplier: 2.0

---
apiVersion: gostoa.dev/v1alpha1
kind: PlanTier
metadata:
  name: enterprise
spec:
  rateLimits:
    requestsPerMinute: 100000
    burstMultiplier: 3.0
    perEndpointOverrides: allowed   # Enterprise can configure custom per-endpoint limits
```

Quand un tenant passe du niveau starter au niveau professional, stoactl met à jour le namespace du tenant avec la nouvelle GuardrailPolicy. Le gateway prend en compte le changement sans redémarrage.

```bash
stoactl tenants upgrade --name acme --plan professional
# → Updates GuardrailPolicy in tenant-acme namespace
# → New limits apply within 30 seconds (hot reload)
```

### Gérer le Trafic en Burst Gracieusement

Les rejets 429 brutaux sont hostiles. Pour les produits SaaS, un meilleur pattern est :

1. **Avertir avant de throttler** : Envoyer des headers `X-RateLimit-Remaining: 10` pour que les clients puissent ralentir
2. **Limite douce → Limite dure** : À 80 % d'utilisation, retourner des réponses avec un hint `Retry-After`. À 100 %, retourner 429.
3. **File d'attente prioritaire** : Prioriser les requêtes de lecture sur les requêtes d'écriture quand le quota est rare

L'implémentation token bucket de STOA inclut un paramètre `warnThreshold` :

```yaml
spec:
  rateLimit:
    requestsPerMinute: 10000
    warnThreshold: 0.8          # Send warning headers at 80% utilization
    softLimitAction: warn       # Log + header, don't reject at soft limit
    hardLimitAction: reject     # 429 at hard limit
```

### Limites par Endpoint pour les Opérations Coûteuses

Tous les endpoints ne sont pas égaux. Un `GET /users/{id}` est bon marché — une recherche en base de données, peut-être un cache hit. Un `POST /reports/export` pourrait scanner des millions d'enregistrements, joindre plusieurs tables et streamer un CSV. Ils ne devraient pas partager la même limite de rate.

```yaml
spec:
  rateLimit:
    requestsPerMinute: 10000    # Default for all endpoints
    perEndpoint:
      "GET /users/*":
        requestsPerMinute: 10000  # Same as default, explicitly set
      "POST /reports/*":
        requestsPerMinute: 50     # Expensive — strict limit
      "GET /export/*":
        requestsPerMinute: 10     # Very expensive — very strict
      "POST /webhook/test":
        requestsPerMinute: 5      # Prevent webhook spam
```

Le gateway résout la règle correspondante la plus spécifique pour chaque requête.

## Appliquer des Quotas Journaliers et Mensuels

Les limites de rate contrôlent le débit par seconde/minute. Les limites de quota contrôlent la consommation sur des fenêtres plus longues — journalier, mensuel. Ce sont des primitives de facturation.

```yaml
spec:
  quota:
    daily:
      requests: 500000
      action: reject              # Hard stop at daily quota
    monthly:
      requests: 10000000
      action: notify              # Notify tenant admin, don't reject (yet)
      notifyAt: [0.75, 0.90]      # Notify at 75% and 90% utilization
```

Les compteurs de quota persistent au travers des redémarrages du gateway (stockés dans la base de données du plan de contrôle STOA). Les buckets de rate limit sont en mémoire — ils se réinitialisent au redémarrage, ce qui est le comportement correct pour le contrôle du débit.

## Implémenter des Niveaux de Clé API dans Votre Application

Pour les produits SaaS qui vendent l'accès API directement (outils développeur, APIs de données), les niveaux de clé API sont souvent plus intuitifs que les niveaux de plan de tenant.

### Émettre des Clés API avec Tag de Niveau

```bash
# Issue a professional-tier API key for a user within tenant-acme
stoactl apikeys create \
  --tenant acme \
  --user user-123 \
  --tier professional \
  --name "Production Integration Key" \
  --expires 2027-01-01
```

La clé émise porte les métadonnées de niveau dans son token opaque. Quand le gateway valide la clé, il résout la politique de rate limit correspondante.

### Scoper les Clés API à des Endpoints Spécifiques

Les cas d'usage enterprise nécessitent souvent des clés API scopées à des APIs spécifiques :

```bash
stoactl apikeys create \
  --tenant acme \
  --tier enterprise \
  --scope "billing-api:read orders-api:read,write" \
  --name "Billing Read-Only Key"
```

Une clé avec le scope `billing-api:read` ne peut pas appeler les endpoints `billing-api:write`. Le gateway applique le scope au niveau de la couche de routage avant même que les limites de rate s'appliquent.

## Observabilité : Surveiller la Santé du Rate Limiting

Le rate limiting n'est utile que si vous pouvez le voir fonctionner. STOA expose des métriques Prometheus pour la télémétrie de rate limit :

```
# Per-tenant rate limit metrics
stoa_rate_limit_requests_total{tenant="acme", endpoint="/users", result="allowed"} 45231
stoa_rate_limit_requests_total{tenant="acme", endpoint="/reports", result="throttled"} 143
stoa_rate_limit_bucket_fill_ratio{tenant="acme"} 0.73
stoa_rate_limit_quota_remaining{tenant="acme", window="daily"} 423451
```

Un dashboard Grafana avec des visualisations de rate limit par tenant est livré avec la stack d'observabilité de STOA. Ajoutez des alertes pour :
- `stoa_rate_limit_requests_total{result="throttled"}` > 1 % du total des requêtes (indique un client mal configuré)
- `stoa_rate_limit_quota_remaining` < 10 % restant (alerte proactive de succès client)
- Pics soudains dans le taux de throttle d'un tenant (abus potentiel ou bug)

## Patterns Courants et Pièges

### Pattern : Valeurs par Défaut Généreuses, Exceptions Strictes

Commencez avec des limites par défaut permissives que presque aucun client légitime n'atteindra. Ajoutez des limites strictes uniquement pour les endpoints dont le coût est avéré. Vous pouvez toujours resserrer les limites — les assouplir après que les clients ont construit contre les limites strictes est beaucoup plus difficile.

### Pattern : Le Header Retry-After est Obligatoire

Chaque réponse 429 DOIT inclure un header `Retry-After` indiquant quand la limite se réinitialise. Sans lui, les clients réessaieront immédiatement et aggraveront le throttling. STOA envoie ce header automatiquement quand une requête est rejetée.

### Piège : Dérive d'Horloge dans les Systèmes Distribués

L'état du rate limiting doit être cohérent entre les répliques du gateway. STOA utilise un store de compteurs centralisé (soutenu par l'API du plan de contrôle) pour l'application des quotas, assurant la cohérence entre les répliques horizontales. L'état du token bucket est répliqué via le protocole de synchronisation d'état du plan de contrôle.

### Piège : Testez Vos Rate Limits Avant le Lancement

Chaque équipe SaaS découvre que ses rate limits sont mal configurées en production. Avant le lancement, effectuez des tests de charge qui simulent vos tenants les plus intensifs attendus. Utilisez les outils de simulation de charge de STOA ou k6 avec des scripts par tenant.

```bash
# Simulate professional-tier tenant load
k6 run --env TENANT=acme --env TARGET_RPS=10000 scripts/load-test.js
```

## Ce Qui Vient Ensuite

Avec la multi-tenancy et le rate limiting en place, votre API SaaS dispose de deux de ses trois mécanismes de sécurité fondamentaux. Le troisième est la **journalisation d'audit et la conformité**. La Partie 3 couvre comment construire des pistes d'audit immuables, satisfaire les demandes GDPR et préparer les audits de conformité sans reconstruire votre infrastructure de logging.

**SaaS Playbook Complet :**
1. [Partie 1 : Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101) — Isoler vos tenants
2. **Partie 2 : Stratégies de Rate Limiting** — Cet article
3. [Partie 3 : Audit et Conformité](/blog/saas-playbook-3-audit-compliance) — Logs immuables et préparation GDPR
4. [Partie 4 : Mise à l'Échelle des APIs Multi-Tenant](/blog/saas-playbook-4-scaling-multi-tenant) — De 50 à 5000 tenants
5. [Partie 5 : Checklist de Production](/blog/saas-playbook-5-production-checklist) — Porte de mise en production en 20 points
6. [Build vs Buy : Analyse des Coûts d'API Gateway](/blog/saas-playbook-build-vs-buy-api-gateway) — Analyse TCO pour votre décision

Pour une comparaison de la manière dont différents API gateways gèrent le rate limiting pour les cas d'usage PME, consultez notre [Guide d'Achat API Gateway PME](/blog/smb-api-gateway-buying-guide-2026).

## FAQ

### Quel algorithme de rate limiting devrais-je utiliser pour une API REST SaaS ?

**Token bucket** est la meilleure valeur par défaut pour les APIs SaaS interactives — il permet de courts bursts tout en contrôlant le débit soutenu. Utilisez **sliding window** quand vous avez besoin d'une application précise du taux soutenu sans allocation de burst. Utilisez **fixed window** pour les quotas de facturation à grain grossier (journalier/mensuel) où le timing exact aux limites de fenêtre n'a pas d'importance.

### Comment gérer les tenants sur des plans différents avec des limites différentes ?

Définissez des templates de GuardrailPolicy pour les niveaux de plan et assignez les tenants à un niveau de plan au moment de la création. Quand un tenant passe à un niveau supérieur, exécutez `stoactl tenants upgrade --plan` pour appliquer la nouvelle politique. STOA applique le changement en 30 secondes via hot reload — pas de redémarrage requis.

### Que dois-je retourner quand une requête est soumise au rate limiting ?

Retournez toujours HTTP 429 avec ces headers : `Retry-After: <secondes>`, `X-RateLimit-Limit: <max>`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset: <timestamp-unix>`. Incluez un corps JSON avec un code d'erreur et un message lisible par un humain. Ne retournez jamais 429 sans `Retry-After` — les clients réessaieront immédiatement et aggraveront le throttling.

### Comment empêcher le burst d'un tenant d'affecter d'autres tenants ?

Utilisez des buckets de rate limit par tenant — jamais un bucket global partagé. La GuardrailPolicy de STOA est scopée par namespace, donc chaque tenant possède son propre bucket indépendant. Le fait que le tenant A épuise son quota n'affecte en aucune façon le bucket du tenant B.

### Puis-je donner aux clients enterprise des rate limits personnalisées ?

Oui. Le niveau enterprise de STOA inclut `perEndpointOverrides: allowed`, ce qui permet à l'administrateur du tenant de configurer des limites par endpoint personnalisées dans son namespace. La limite globale du plan agit toujours comme plafond — ils ne peuvent pas dépasser ce que leur contrat permet.
