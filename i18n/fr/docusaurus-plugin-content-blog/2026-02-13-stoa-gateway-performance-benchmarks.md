---
slug: stoa-gateway-performance-benchmarks
title: "Gateway sub-milliseconde : benchmarks reproductibles"
authors: [stoa-team]
tags: [architecture, open-source, comparison]
description: "Authentification en sub-microseconde, rate limiting en nanosecondes, et un framework de benchmark entièrement reproductible. Tous les scripts k6 et la méthodologie de scoring sont publiés."
keywords:
  - api gateway benchmarks
  - gateway performance
  - api gateway latency
  - stoa gateway throughput
  - requests per second
  - api gateway comparison
  - open source api gateway performance
  - rust api gateway
---

<!-- last verified: 2026-02 -->

# Performances de STOA Gateway : overhead sub-milliseconde, entièrement reproductible

STOA Gateway ajoute **moins de 2 microsecondes** d'overhead total par requête avec l'authentification par API key et le rate limiting activés. Chaque benchmark est reproductible grâce à des scripts publiés, et notre Gateway Arena exécute des tests comparatifs toutes les 30 minutes sur une infrastructure identique.

Cet article présente notre approche de benchmarking, les principaux résultats, et comment vous pouvez tout reproduire vous-même.

<!-- truncate -->

## Pourquoi nous benchmarquons (et publions tout)

La plupart des fournisseurs d'API gateway publient des chiffres de performance, mais peu rendent leur méthodologie reproductible. Nous croyons en :

- **La transparence** : tous les scripts sont open source, toute la méthodologie est documentée
- **La reproductibilité** : n'importe qui peut exécuter les mêmes benchmarks sur son propre matériel
- **La comparaison équitable** : lors de la comparaison de gateways, nous utilisons une infrastructure et des conditions identiques

Nos benchmarks comportent trois niveaux : les **micro-benchmarks** pour les opérations internes, les **tests de charge** pour le débit end-to-end, et le **Gateway Arena** pour la comparaison continue multi-gateway.

## Niveau 1 : micro-benchmarks (Criterion)

Les benchmarks [Criterion.rs](https://github.com/bheisler/criterion.rs) mesurent les opérations individuelles du Gateway de manière isolée, sans overhead réseau.

| Opération | Mesure | Signification |
|-----------|---------|--------------|
| Lecture cache API key | < 1 µs | La validation d'une API key est quasi-instantanée |
| Vérification rate limit | < 500 ns | La vérification du quota utilise une fenêtre glissante sans verrou |
| Normalisation de path | < 100 ns | Remplacement des UUID dans les paths pour l'analytique |
| Route matching (50 routes) | < 1 µs | Trouver le bon upstream parmi 50+ APIs enregistrées |
| Décodage JWT (HS256) | < 100 µs | Vérification complète de la signature |

Le point clé : **les opérations principales du Gateway se mesurent en nanosecondes et microsecondes, pas en millisecondes**. Lorsque votre appel d'API prend 200 ms, le Gateway ajoute moins de 0,001 % de cette latence.

### Pourquoi cela importe

L'overhead des fonctionnalités s'accumule. Si l'authentification ajoute 5 ms, le rate limiting 3 ms, et la normalisation de path 1 ms, vous avez 9 ms de "taxe gateway" sur chaque requête. Avec STOA, ce même ensemble de fonctionnalités ajoute moins de 2 µs au total, ce qui est pratiquement nul.

## Niveau 2 : tests de charge (hey)

Les tests de charge [hey](https://github.com/rakyll/hey) mesurent le débit réel end-to-end, y compris le réseau, TLS et le temps de réponse de l'upstream.

Notre script de benchmark (`scripts/benchmarks/load-test.sh`) exécute quatre scénarios à concurrence croissante :

1. **Health check** (débit HTTP de base)
2. **Proxy passthrough** (routage seul, sans authentification)
3. **Proxy + authentification API key** (routage + authentification)
4. **Proxy + authentification + rate limiting** (pipeline de fonctionnalités complet)

Le script configure le Gateway via l'API Admin entre les exécutions, de sorte que les résultats reflètent un **overhead de fonctionnalités réel**, et non des benchmarks synthétiques avec des réponses codées en dur.

### Impact des fonctionnalités : quasiment nul

La découverte la plus importante : **l'activation des fonctionnalités ne modifie pas de manière significative le débit ou la latence** au niveau réseau. La différence entre "proxy seul" et "proxy + authentification + rate limit" se situe dans le bruit de mesure, car l'overhead combiné (< 2 µs) est éclipsé par la latence réseau.

| Pile de fonctionnalités | Overhead gateway |
|------------------------|-----------------|
| Proxy seul | < 100 µs |
| + Authentification API Key | + < 1 µs |
| + Rate Limiting | + < 500 ns |
| **Total** | **< 102 µs** |

Cela signifie que vous pouvez activer toutes les fonctionnalités de sécurité et de gouvernance sans vous soucier de l'impact sur les performances.

## Niveau 3 : Gateway Arena (comparaison continue)

Le Gateway Arena est un CronJob Kubernetes qui benchmarque plusieurs API gateways toutes les 30 minutes dans des conditions identiques.

### Configuration

- Chaque gateway s'exécute sur un **VPS identique** (même fournisseur, même région, même spécifications)
- Tous les gateways proxifient vers le **même backend**
- Même outil de test, même concurrence, même durée
- Les résultats sont envoyés à Prometheus et visualisés dans Grafana

### Scoring

Chaque gateway reçoit un score composite de 0 à 100 :

```
Score = 0,40 × Latence + 0,30 × Disponibilité + 0,20 × TauxErreur + 0,10 × Consistance
```

Un score supérieur à 80 est excellent. Un score inférieur à 60 mérite investigation (généralement un problème de connectivité ou de configuration, pas une limitation du gateway).

### Trois scénarios

1. **Health Check** : une seule requête vers l'endpoint de santé (latence à froid + disponibilité)
2. **Proxy Passthrough** : 10 requêtes séquentielles via le proxy (débit soutenu)
3. **Burst concurrent** : 10 requêtes parallèles (gestion des pics + taux d'erreur sous charge)

> Les comparaisons de fonctionnalités sont basées sur des tests exécutés dans des conditions identiques à la date indiquée ci-dessus. Les capacités des gateways évoluent fréquemment. Nous encourageons les lecteurs à vérifier les performances actuelles avec leurs propres workloads. Toutes les marques déposées appartiennent à leurs propriétaires respectifs.

## Essayez vous-même

### Micro-benchmarks

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa/stoa-gateway
cargo bench
```

Les résultats apparaissent dans `target/criterion/` avec des rapports HTML.

### Tests de charge

```bash
# Installer hey
brew install hey

# Démarrer STOA Gateway (Docker Compose ou standalone)
docker compose up -d

# Exécuter les benchmarks
./scripts/benchmarks/load-test.sh --target http://localhost:8080
```

Le script génère un rapport Markdown avec le profil machine, les tableaux de latence et les taux d'erreur. Consultez la [documentation complète](/docs/reference/performance-benchmarks) pour les détails de méthodologie.

## Ce que nous avons appris

La construction de l'infrastructure de benchmarking nous a appris plusieurs choses :

1. **Le réseau domine** : avec un backend distant, l'overhead du gateway est invisible. Les micro-benchmarks sont essentiels pour mesurer le coût réel des fonctionnalités.
2. **La comparaison équitable est difficile** : différents gateways ont des paramètres par défaut, des comportements de préchauffage et des modes de défaillance différents. Une infrastructure identique est nécessaire mais pas suffisante.
3. **Le continu surpasse le ponctuel** : une seule exécution de benchmark peut être trompeuse. Exécuter toutes les 30 minutes permet de détecter les régressions et de visualiser la variance.

## Lectures complémentaires

- [Exigences matérielles et guide de dimensionnement](/docs/reference/hardware-requirements) — la quantité de CPU et de RAM dont vous avez réellement besoin
- [Référence des benchmarks de performance](/docs/reference/performance-benchmarks) — méthodologie complète, tous les scénarios, instructions de reproduction
- [Architecture Gateway (ADR-024)](/docs/architecture/adr/adr-024-gateway-unified-modes) — pourquoi nous avons choisi Rust et les quatre modes gateway

## Foire aux questions

### Combien de requêtes par seconde STOA peut-il gérer ?

Sur un seul cœur, STOA Gateway gère des dizaines de milliers de requêtes health check par seconde. Avec un proxy vers un backend upstream, le débit est limité par le backend et le réseau, pas par le Gateway. Sur un VPS 2 vCPU, attendez-vous à 2 000–5 000 RPS vers un backend distant.

### L'activation de l'authentification ralentit-elle le Gateway ?

Non. L'authentification par API key ajoute moins d'une microseconde par requête grâce à un cache en mémoire (moka). C'est invisible au niveau réseau. Vous pouvez activer l'authentification sur chaque API sans vous soucier des performances.

### Comment STOA se compare-t-il aux autres gateways ?

Le Gateway Arena effectue des comparaisons continues sur du matériel identique. Plutôt que de publier des chiffres ponctuels qui deviennent rapidement obsolètes, nous fournissons les outils et la méthodologie permettant à chacun d'exécuter sa propre comparaison. Consultez les [scripts de benchmark](https://github.com/stoa-platform/stoa/tree/main/scripts/benchmarks) et la [configuration de l'Arena](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic).
