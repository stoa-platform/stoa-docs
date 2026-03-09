---
sidebar_position: 6
title: "Prérequis Matériels et Guide de Dimensionnement"
description: "Prérequis CPU, mémoire et disque pour STOA Platform selon les déploiements Docker, VPS, Kubernetes et bare metal."
keywords:
  - hardware requirements
  - sizing guide
  - deployment
  - kubernetes
  - docker
  - vps
  - bare metal
  - resource limits
  - api gateway sizing
---

<!-- last verified: 2026-02 -->

# Prérequis Matériels et Guide de Dimensionnement

STOA Gateway fonctionne avec aussi peu que **1 vCPU / 128 Mo de RAM** en mode standalone. Un déploiement complet de la plateforme (gateway + control plane + auth + UI) nécessite **4 vCPU / 4 Go de RAM**. La HA en production démarre à **3 nœuds / 8 Go chacun**.

Ce guide couvre quatre profils de déploiement, du poste de développeur au cluster Kubernetes multi-tenant.

## Profils de Déploiement

| Profil | Cible | CPU | RAM | Disque | APIs | Cible RPS |
|---------|--------|-----|-----|------|------|-----------|
| **Docker Compose** | Dev / local | 4 vCPU | 8 Go | 20 Go | 10-50 | 1 000 |
| **VPS Unique** | Petite prod | 2 vCPU | 4 Go | 20 Go SSD | 50-200 | 5 000 |
| **K8s Managé** (3 nœuds) | Production HA | 3x 4 vCPU | 3x 8 Go+ | 3x 80 Go | 500+ | 20 000+ |
| **K3s bare metal** (3-5 nœuds) | Staging / edge | 3-5x 2 vCPU | 3-5x 4 Go | 3-5x 40 Go | 200-500 | 10 000 |

### Docker Compose (Développeur)

Recommandé pour le développement local et l'évaluation. Exécute la pile complète sur une seule machine.

```
Minimum : 4 vCPU, 8 Go RAM, 20 Go disque
Inclus : Gateway, Control Plane API, Console, Portal, Keycloak, PostgreSQL
Optionnel : OpenSearch, Prometheus, Grafana, Loki (+2 Go RAM)
```

### VPS Unique (Petite Production)

Un seul VPS peut exécuter le Gateway en standalone pour les petits catalogues API.

```
Minimum : 2 vCPU, 4 Go RAM, 20 Go SSD
Exécute : Gateway uniquement (ou Gateway + PostgreSQL + Keycloak pour la pile complète)
Idéal pour : Développeurs solo, petites équipes, < 200 APIs
```

### Kubernetes Managé (Production HA)

Déploiement HA de niveau production avec n'importe quel fournisseur Kubernetes managé.

```
Recommandé : 3 nœuds, 4 vCPU / 8 Go+ RAM chacun
Total : 12 vCPU, 24+ Go RAM
Inclus : Tous les composants (2 replicas chacun) + pile d'observabilité
Base de données : PostgreSQL managé recommandé (service séparé)
```

### K3s Bare Metal (Staging / Edge)

Kubernetes léger pour le staging, l'edge ou les environnements air-gapped.

```
Recommandé : 3-5 nœuds, 2 vCPU / 4 Go RAM chacun
Disposition : 1 control plane + 2-4 workers
Inclus : Tous les composants + ingress Traefik + cert-manager
```

## Dimensionnement des Composants

### STOA Gateway (Rust)

| Paramètre | Demande | Limite | Notes |
|---------|---------|-------|-------|
| CPU | 100m | 500m | Évolue linéairement avec le RPS |
| Mémoire | 64 Mi | 256 Mi | Cache route/politique en mémoire |
| Replicas | 2 | -- | HA : min 2 en production |
| Disque | Aucun | -- | Stateless ; CP API est la source de vérité |

Le Gateway est le composant le plus léger. Une seule instance traite des milliers de requêtes par seconde sur 100m CPU. Augmentez les limites CPU pour les charges à fort débit ; la mémoire reste faible quelle que soit la charge.

### Control Plane API (Python / FastAPI)

| Paramètre | Demande | Limite | Notes |
|---------|---------|-------|-------|
| CPU | 200m | 1000m | Évolue avec les opérations de gestion API |
| Mémoire | 256 Mi | 512 Mi | Pool de connexions SQLAlchemy |
| Replicas | 2 | -- | HA : min 2 en production |
| Disque | Aucun | -- | État dans PostgreSQL |

### Keycloak (Java)

| Paramètre | Demande | Limite | Notes |
|---------|---------|-------|-------|
| CPU | 500m | 2000m | Le démarrage JVM est intensif en CPU |
| Mémoire | 512 Mi | 1536 Mi | Heap JVM : régler à 50-75% de la limite mémoire |
| Replicas | 1 | -- | Instance unique suffisante pour la plupart des déploiements |
| Disque | Aucun | -- | État dans PostgreSQL |

Keycloak est le composant le plus lourd. Pour les déploiements avec moins de 1 000 utilisateurs simultanés, une seule instance est suffisante. Passez à l'échelle horizontalement avec le cache Infinispan pour les déploiements plus importants.

### Console UI (React / nginx)

| Paramètre | Demande | Limite | Notes |
|---------|---------|-------|-------|
| CPU | 50m | 200m | Serveur de fichiers statiques |
| Mémoire | 64 Mi | 128 Mi | Processus worker nginx |
| Replicas | 1-2 | -- | CDN recommandé en production |

### Developer Portal (React / nginx)

| Paramètre | Demande | Limite | Notes |
|---------|---------|-------|-------|
| CPU | 50m | 200m | Serveur de fichiers statiques |
| Mémoire | 64 Mi | 128 Mi | Processus worker nginx |
| Replicas | 1-2 | -- | CDN recommandé en production |

### PostgreSQL

| Charge | CPU | Mémoire | Disque |
|----------|-----|--------|------|
| Petite (< 100 APIs) | 500m | 512 Mi | 5 Gi |
| Moyenne (100-1 000 APIs) | 2000m | 4 Gi | 20 Gi |
| Grande (1 000+ APIs) | 4000m+ | 8 Gi+ | 50 Gi+ |

Un service PostgreSQL managé est recommandé en production. Une seule instance sert à la fois la Control Plane API et Keycloak.

## Tailles des Images de Conteneurs

| Composant | Image de base | Taille compressée |
|-----------|-----------|----------------|
| stoa-gateway | `debian:bookworm-slim` | ~30 Mo |
| control-plane-api | `python:3.11-slim` | ~180 Mo |
| console | `nginx:alpine` | ~40 Mo |
| portal | `nginx:alpine` | ~40 Mo |
| keycloak | `quay.io/keycloak/keycloak:23.0` | ~400 Mo |

Toutes les images sont publiées sur `ghcr.io/stoa-platform/` et supportent `linux/amd64`.

## Dépendances Externes

### PostgreSQL 15+

Requis pour la Control Plane API et Keycloak.

| Utilisateurs Simultanés | Recommandé | Disque |
|-----------------|-------------|------|
| < 500 | 1 vCPU, 1 Go | 5 Gi |
| 500-5 000 | 2 vCPU, 4 Go | 20 Gi |
| 5 000+ | 4 vCPU, 8 Go | 50 Gi+ |

### Keycloak 23+

Authentification et RBAC. Le heap JVM doit être à 50-75% de la limite mémoire du conteneur.

| Utilisateurs Simultanés | Heap | CPU |
|-----------------|------|-----|
| < 500 | 512 Mo | 500m |
| 500-5 000 | 1 Go | 1000m |
| 5 000+ | 2 Go | 2000m |

### OpenSearch 2.x (optionnel)

Analytiques API et agrégation de logs. Non requis pour les fonctionnalités de base.

| Volume de Logs | Heap | Disque |
|------------|------|------|
| < 1 Go/jour | 512 Mo | 10 Gi |
| 1-10 Go/jour | 2 Go | 50 Gi |
| 10+ Go/jour | 4 Go | 200 Gi+ |

### Prometheus + Grafana (optionnel)

Métriques et tableaux de bord. Surcharge minimale pour la plupart des déploiements.

| Composant | CPU | Mémoire |
|-----------|-----|--------|
| Prometheus | 100m | 256 Mi |
| Grafana | 100m | 128 Mi |

## Conseils de Mise à l'Échelle

### Quand Passer à l'Échelle Horizontalement

| Signal | Action |
|--------|--------|
| CPU Gateway > 70% soutenu | Ajouter des replicas Gateway |
| Temps de réponse API P99 > 100 ms (surcharge gateway) | Ajouter des replicas Gateway |
| Temps de réponse CP API > 500 ms | Ajouter des replicas CP API |

### Quand Passer à l'Échelle Verticalement

| Signal | Action |
|--------|--------|
| Mémoire Gateway > 200 Mi | Augmenter la limite (grandes tables de routes) |
| Démarrage Keycloak > 120s | Augmenter la limite CPU |
| Requêtes lentes PostgreSQL | Augmenter `shared_buffers` et la RAM |
| Erreurs OOM dans n'importe quel pod | Augmenter la limite mémoire de 50% |

## Prérequis Réseau

### Ports

| Port | Composant | Protocole | Notes |
|------|-----------|----------|-------|
| 8080 | Gateway | HTTP | Proxy runtime + API admin |
| 8000 | CP API | HTTP | API REST du control plane |
| 8443 | Keycloak | HTTPS | Authentification (OIDC) |
| 80/443 | Console/Portal | HTTP/S | Interfaces web (via ingress) |
| 5432 | PostgreSQL | TCP | Base de données |
| 9200 | OpenSearch | HTTP | Analytiques (optionnel) |
| 9090 | Prometheus | HTTP | Métriques (optionnel) |

### Bande Passante

- Surcharge gateway par requête proxifiée : ~1 Ko (en-têtes, logs)
- Scraping de métriques : négligeable

### TLS

Les déploiements en production doivent terminer TLS au niveau du contrôleur ingress. STOA supporte :

- **cert-manager** avec Let's Encrypt (recommandé pour Kubernetes)
- Provisionnement manuel de certificats
- mTLS entre le Gateway et les APIs upstream ([ADR-039](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens))

## FAQ

### De combien de RAM STOA Gateway a-t-il besoin ?

Le Gateway fonctionne avec aussi peu que 64 Mo de RAM. La demande Kubernetes par défaut est de 64 Mi avec une limite de 256 Mi. L'utilisation de la mémoire augmente avec le nombre d'APIs enregistrées et de politiques en cache. Pour 1 000 APIs, attendez-vous à ~100 Mo.

### STOA peut-il fonctionner sur un Raspberry Pi ?

STOA Gateway se compile pour `linux/arm64` et fonctionne sur les appareils ARM. Un Raspberry Pi 4 (4 Go) peut exécuter le Gateway en standalone. La plateforme complète (avec Keycloak et PostgreSQL) nécessite au moins 4 Go de RAM, donc un Pi 4 avec 8 Go est recommandé pour la pile complète.

### Quel est le déploiement de production minimal ?

Un VPS unique avec 2 vCPU et 4 Go de RAM peut exécuter le Gateway en standalone et traiter des milliers de requêtes par seconde. Pour la HA avec la plateforme complète, commencez avec 3 nœuds Kubernetes (4 vCPU, 8 Go chacun).

### Comment se compare STOA en termes d'utilisation des ressources ?

Le runtime Rust de STOA Gateway utilise significativement moins de mémoire que les gateways basés sur la JVM. Une seule instance STOA Gateway (64 Mi par défaut) traite un débit comparable aux gateways qui nécessitent typiquement 256 Mi-1 Gi. Consultez [Performance Benchmarks](/docs/reference/performance-benchmarks) pour des mesures détaillées.
