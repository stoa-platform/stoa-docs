---
slug: saas-playbook-4-scaling-multi-tenant
title: "Mise à l'Échelle des APIs Multi-Tenant de 50 à 5000 Tenants"
description: "Ne reconstruisez pas votre API pour scaler. HPA, connection pooling, stratégies de cache et routage par shard de tenant qui évoluent avec votre activité SaaS."
authors: [stoa-team]
tags: [tutorial, architecture, api-gateway]
keywords:
  - scaling multi-tenant API
  - SaaS API scaling 5000 tenants
  - multi-tenant API performance
  - connection pooling SaaS
  - horizontal scaling API gateway
  - Kubernetes HPA API gateway
  - tenant sharding
---
<!-- last verified: 2026-02 -->

Mettre à l'échelle une API SaaS multi-tenant n'est pas la même chose que mettre à l'échelle une API mono-tenant. À 50 tenants, votre API gateway effectue une petite quantité de travail par tenant sur chaque requête — résoudre une politique, vérifier une limite de rate, valider un token. À 5000 tenants, ce même travail multiplié sur des milliers de connexions simultanées crée des défis qui n'apparaissent pas dans les tests de charge précoces.

Il s'agit de la Partie 4 de la série **SaaS Playbook**. Nous supposons que vous avez déjà implémenté les fondations : [multi-tenancy](/blog/saas-playbook-1-multi-tenancy-101), [rate limiting](/blog/saas-playbook-2-rate-limiting-saas) et [journalisation d'audit](/blog/saas-playbook-3-audit-compliance). Maintenant, vous devez les mettre à l'échelle.

<!-- truncate -->

## Les Trois Goulots d'Étranglement de Mise à l'Échelle dans les APIs Multi-Tenant

Avant d'optimiser quoi que ce soit, comprenez où se trouvent les vrais goulots d'étranglement. Les API gateways multi-tenant atteignent typiquement trois murs de mise à l'échelle.

### Mur 1 : Surcharge de Résolution des Politiques

Chaque requête nécessite que le gateway résolve les politiques du tenant — quelles limites de rate s'appliquent, quelles GuardrailPolicies sont actives, vers quel upstream router. À petite échelle, c'est une recherche rapide en mémoire. À grande échelle, avec des milliers de tenants et des mises à jour fréquentes des politiques, la résolution des politiques peut devenir un goulot d'étranglement si elle n'est pas mise en cache correctement.

**Symptômes** : Latence P99 croissante à mesure que le nombre de tenants augmente, même quand le RPS par tenant est constant.

### Mur 2 : Épuisement du Connection Pool de Base de Données

Les architectures multi-tenant nécessitent souvent des recherches en base de données par requête pour la journalisation d'audit, le suivi des quotas ou la configuration des tenants. À grande échelle, le nombre de connexions simultanées à la base de données augmente proportionnellement au trafic des tenants, et l'épuisement du connection pool devient un problème sérieux.

**Symptômes** : Erreurs 503 intermittentes sous charge, le serveur de base de données montre le nombre maximum de connexions atteint, les requêtes expirent en attendant une connexion.

### Mur 3 : Voisin Bruyant à l'Échelle Infrastructure

Même avec le rate limiting par tenant, la contention au niveau infrastructure est possible. Un tenant exécutant des milliers de connexions simultanément peut épuiser les tampons de socket au niveau OS, le temps de planification CPU ou la bande passante réseau partagée — aucun desquels n'est contrôlé par les limites de rate au niveau applicatif.

**Symptômes** : Le pic de trafic d'un tenant provoque des augmentations de latence pour d'autres tenants, même quand aucune limite de rate n'est déclenchée.

## Stratégies de Cache pour les Gateways Multi-Tenant

L'optimisation la plus impactante : mettre en cache agressivement la configuration des tenants et les résultats de résolution des politiques.

### Cache de Configuration de Tenant

La configuration du tenant (quelles APIs sont enregistrées, quelles politiques s'appliquent, quel upstream utiliser) change rarement. Lisez-la une fois, mettez-la en cache en mémoire, invalidez uniquement quand l'UAC est mis à jour.

```yaml
# stoa-gateway configuration
gateway:
  cache:
    tenantConfig:
      strategy: in-memory
      ttl: 300s              # 5 minutes — balance freshness vs performance
      maxSize: 10000         # Support up to 10,000 cached tenant configs
      eviction: lru
      invalidateOnUAC: true  # Invalidate when UAC is updated via admin API
```

Avec un TTL de 5 minutes, les mises à jour de politique se propagent en 5 minutes après leur application. Pour la plupart des produits SaaS, c'est acceptable. Pour les configurations qui changent fréquemment (ex. ajustements dynamiques de rate limit), utilisez un TTL plus court ou une invalidation pilotée par événements.

### Cache de Compteur de Rate Limit

Les compteurs de rate limit doivent être cohérents entre les répliques du gateway. Les approches naïves (une ligne de base de données par compteur) ne passent pas à l'échelle. La bonne architecture :

**Pour les limites de débit (par seconde, par minute)** : Compteurs en mémoire par réplique avec synchronisation périodique vers le plan de contrôle. Acceptez qu'il puisse y avoir un léger surcomptage (un tenant pourrait brièvement dépasser sa limite d'une petite marge sur plusieurs répliques) en échange de vérifications de compteurs à latence en microseconde.

**Pour les limites de quota (journalier, mensuel)** : Compteurs centralisés dans la base de données du plan de contrôle, vérifiés par requête via un cache avec TTL de 10 à 30 secondes. Un léger surcomptage est acceptable ; le sous-comptage (laisser un tenant dépasser son quota mensuel) ne l'est pas.

```yaml
gateway:
  cache:
    rateLimits:
      throughput:
        strategy: in-memory-with-sync
        syncInterval: 5s     # Sync to control plane every 5 seconds
        overshootTolerance: 0.05  # Allow 5% overshoot per replica
      quota:
        strategy: cached-remote
        ttl: 30s             # Check control plane every 30 seconds
        refetchOnNearLimit: true   # Force-check when within 10% of limit
```

### Cache de Validation JWT

La validation JWT implique une vérification de signature cryptographique — relativement coûteuse à grande échelle. Mettez en cache les résultats de validation :

```yaml
gateway:
  auth:
    jwtCache:
      enabled: true
      ttl: 60s               # Cache valid tokens for 60 seconds
      negativeCache: true    # Cache invalid tokens too (prevents replay attacks on invalid tokens)
      maxSize: 100000        # Support 100K concurrent active tokens
```

La clé de cache est le claim `jti` (JWT ID) du token. Les tokens révoqués sont gérés via une liste de révocation qui est vérifiée même sur les cache hits — cela empêche de conserver un token valide mis en cache après sa révocation.

## Horizontal Pod Autoscaling pour le Gateway

Le STOA Gateway est sans état au niveau de la couche de traitement des requêtes (l'état vit dans la base de données du plan de contrôle et les caches). Cela le rend simple à mettre à l'échelle horizontalement.

### Configuration HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: stoa-gateway-hpa
  namespace: stoa-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: stoa-gateway
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60    # Scale up at 60% CPU (avoid overshooting)
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30   # React quickly to traffic spikes
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # Scale down slowly to avoid thrash
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
```

Le comportement asymétrique scale-up/scale-down est délibéré : montez rapidement (fenêtre de 30 secondes, 4 pods à la fois) pour gérer les pics de trafic, descendez lentement (fenêtre de 300 secondes, 1 pod à la fois) pour éviter le flapping.

### Requests et Limits de Ressources

Des requests de ressources appropriés sont critiques pour que l'HPA fonctionne correctement et pour que le scheduler Kubernetes prenne de bonnes décisions de placement :

```yaml
resources:
  requests:
    cpu: "500m"       # What the pod needs in steady state
    memory: "256Mi"
  limits:
    cpu: "2000m"      # What the pod can burst to
    memory: "512Mi"
```

Si vous fixez les limits de CPU trop bas, le gateway sera throttlé même quand de la marge est disponible sur le nœud. Fixez les limits à 2-4x la valeur des requests pour permettre la gestion des bursts sans être throttlé.

## Gestion du Connection Pool

### PgBouncer pour les Connexions de Base de Données

L'API du plan de contrôle se connecte à PostgreSQL pour la journalisation d'audit, le suivi des quotas et la configuration des tenants. Sans connection pooling, chaque pod du gateway pourrait ouvrir 10 à 20 connexions de base de données, et à 20 pods vous avez 200 à 400 connexions — épuisant facilement le `max_connections = 100` par défaut de PostgreSQL.

La solution : PgBouncer entre l'application et PostgreSQL, en mode transaction pooling.

```yaml
# pgbouncer.ini
[databases]
stoa_db = host=postgresql-primary port=5432 dbname=stoa

[pgbouncer]
pool_mode = transaction       # Transaction-level pooling (most aggressive)
max_client_conn = 1000        # Maximum client connections to PgBouncer
default_pool_size = 20        # Connections per database to PostgreSQL
max_db_connections = 50       # Hard cap on connections to PostgreSQL
```

Avec le transaction pooling, une connexion n'est conservée que pour la durée d'une seule transaction. Un connection pool de 50 connexions vers PostgreSQL peut servir 1000 clients simultanés — chaque client tient une connexion pendant des microsecondes (une transaction), puis la libère.

**Important** : Le transaction pooling est incompatible avec les fonctionnalités au niveau session comme les instructions `SET`, les verrous consultatifs ou les prepared statements à durée de vie de session. Les écritures de log d'audit et les mises à jour de compteur de quota sont de simples INSERT — ils fonctionnent parfaitement avec le transaction pooling.

### Calculateur de Taille du Connection Pool

```
Taille requise du pool = (requêtes/seconde) × (latence DB moy. en secondes)

Exemple :
- 10 000 req/sec
- Chaque requête fait 1 écriture DB (log d'audit) : latence moy. 2ms
- Connexions requises : 10 000 × 0,002 = 20 connexions

Ajoutez 2× de tampon pour les pics : 40 connexions
```

C'est le minimum théorique. En pratique, ajoutez 50 % de surcharge pour l'overhead d'établissement des connexions, la planification des requêtes et les pauses GC. Commencez avec 60 à 80 connexions pour 10K req/sec et faites des benchmarks.

## Sharding de Tenant pour les Grands Déploiements

À très grande échelle (10 000+ tenants, 100K+ req/sec), un seul cluster gateway partagé peut devenir insuffisant. Le sharding de tenant distribue les tenants sur des clusters gateway dédiés.

### Stratégie d'Attribution des Shards

```
Tenant → Hash cohérent → ID de Shard → Cluster gateway
```

STOA utilise le hachage cohérent avec des nœuds virtuels. Cela garantit :
- Le tenant A route toujours vers le shard 1 (faible surcharge de routage)
- L'ajout d'un nouveau shard migre seulement 1/N des tenants existants (perturbation minimale)
- Les patterns de trafic des tenants restent prévisibles par shard

```yaml
gateway:
  sharding:
    enabled: true
    shards:
      - id: shard-eu-1
        region: eu-west-1
        tenants: "hash range 0-33"
      - id: shard-eu-2
        region: eu-west-1
        tenants: "hash range 34-66"
      - id: shard-us-1
        region: us-east-1
        tenants: "hash range 67-100"
    consistentHash:
      virtualNodes: 150
      hashFunction: xxhash64
```

### Résidence des Données via le Sharding

Le sharding permet également l'application de la résidence des données : les tenants EU peuvent être épinglés aux shards EU, garantissant que leurs logs d'audit et leur trafic ne quittent jamais l'EU. Cela est réalisé via les métadonnées de tenant :

```bash
stoactl tenants create \
  --name eu-customer \
  --region eu \           # Forces assignment to EU shards
  --plan enterprise
```

## Couche de Cache pour les APIs à Haute Lecture

Pour les APIs avec un ratio lecture/écriture élevé (données de référence, catalogues, profils utilisateurs), une couche de cache entre le gateway et le backend réduit considérablement la charge sur le backend.

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: UniversalAPIContract
metadata:
  name: acme-contract
  namespace: tenant-acme
spec:
  apis:
    - name: catalog-api
      upstream: https://catalog.acme.internal/v1
      cache:
        enabled: true
        ttl: 300s            # Cache responses for 5 minutes
        varyBy:
          - header: "Accept-Language"
          - query: "category"
        invalidateOn:
          - method: POST     # Invalidate cache on writes
          - method: DELETE
          - method: PUT
          - method: PATCH
```

Le cache au niveau gateway fonctionne par tenant (les réponses mises en cache du tenant A sont séparées de celles du tenant B), par endpoint et par clé de variation. L'invalidation du cache est déclenchée par les opérations d'écriture ou les appels API de cache-bust explicites.

## Tests de Charge à Grande Échelle

Ne faites jamais confiance au fait que votre architecture de mise à l'échelle fonctionne sans la tester sous charge. Les patterns qui échouent sous charge sont rarement ceux que vous attendez.

### Simuler une Charge Multi-Tenant

```javascript
// k6 load test: simulate 1000 tenants, 10 req/sec each
import http from 'k6/http';
import { check } from 'k6';

const TENANTS = Array.from({length: 1000}, (_, i) => `tenant-${i:04d}`);

export const options = {
  scenarios: {
    constant_vus: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },   // Ramp up to 500 VUs
        { duration: '5m', target: 500 },   // Hold
        { duration: '2m', target: 0 },     // Ramp down
      ],
    },
  },
};

export default function() {
  const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const token = getToken(tenant);  // Fetch token from cache

  const res = http.get(`${__ENV.GATEWAY_URL}/${tenant}/api/resource`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency < 100ms': (r) => r.timings.duration < 100,
  });
}
```

Ce test simule une charge multi-tenant réaliste : distribution aléatoire des tenants, gestion réaliste des tokens et assertions de SLA de latence. Exécutez-le avant et après tout changement de configuration de cache.

## Ce Qui Vient Ensuite

Avec la mise à l'échelle couverte, vous disposez des quatre piliers fondamentaux d'une API SaaS multi-tenant prête pour la production. La dernière partie de cette série rassemble tout cela dans une checklist de production que vous pouvez utiliser comme porte de mise en production.

**SaaS Playbook Complet :**
1. [Partie 1 : Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101) — Isoler vos tenants
2. [Partie 2 : Stratégies de Rate Limiting](/blog/saas-playbook-2-rate-limiting-saas) — Quotas par tenant et gestion des bursts
3. [Partie 3 : Audit et Conformité](/blog/saas-playbook-3-audit-compliance) — Logs immuables et préparation GDPR
4. **Partie 4 : Mise à l'Échelle des APIs Multi-Tenant** — Cet article
5. [Partie 5 : Checklist de Production](/blog/saas-playbook-5-production-checklist) — Porte de mise en production en 20 points
6. [Build vs Buy : Analyse des Coûts d'API Gateway](/blog/saas-playbook-build-vs-buy-api-gateway) — Analyse TCO pour votre décision

## FAQ

### À quel nombre de tenants devrais-je commencer à penser au sharding ?

La plupart des APIs SaaS multi-tenant n'ont pas besoin de sharding avant d'atteindre 5 000 à 10 000 tenants actifs avec un trafic significatif par tenant. Avant cela, la mise à l'échelle horizontale du cluster gateway (via HPA) combinée avec un bon cache est suffisante. Concentrez-vous d'abord sur l'HPA et le connection pooling — le sharding ajoute une complexité opérationnelle significative.

### Comment éviter le problème du voisin bruyant au niveau infrastructure ?

Le rate limiting par tenant de STOA gère les voisins bruyants au niveau applicatif. Pour l'isolation au niveau infrastructure (CPU, réseau), envisagez Kubernetes ResourceQuota par namespace de tenant pour les tenants à forte valeur, ou des node pools dédiés pour les tenants enterprise dans le modèle Silo. La plupart des produits SaaS PME n'ont jamais besoin de ce niveau d'isolation.

### Devrais-je utiliser Redis pour les compteurs de rate limit ?

Redis est un choix courant pour les compteurs de rate limit distribués. STOA utilise une approche in-memory-with-sync comme valeur par défaut car elle a une latence plus faible (pas de saut réseau par incrément de compteur) et est plus simple à opérer. Si vous avez besoin d'une parfaite cohérence entre les répliques (zéro dépassement), Redis avec un script Lua fournit des opérations d'incrément atomiques. Benchmarkez les deux approches à votre échelle cible avant de vous engager.

### Comment dimensionner mon connection pool PgBouncer ?

Utilisez la formule : `taille du pool = (req/sec) × (latence DB moy.)`. Ajoutez 50 % de surcharge pour les bursts. Commencez conservateur et augmentez en fonction des métriques `pgbouncer` observées (`cl_waiting` devrait être proche de zéro en charge normale). Si `cl_waiting` est non nul, vous avez besoin de plus de connexions dans le pool.

### Quelle taille de nœud Kubernetes devrais-je utiliser pour les pods gateway ?

Pour le STOA Gateway (basé sur Rust), le CPU est typiquement le goulot d'étranglement avant la mémoire. Commencez avec des nœuds `4 CPU / 8 GB RAM` et mesurez. Chaque pod gateway peut typiquement gérer 10 000 à 50 000 req/sec selon la complexité des politiques et la configuration du cache. Dimensionnez vos nœuds pour que l'HPA puisse passer de `minReplicas` à `maxReplicas` sans saturer le CPU du nœud.
