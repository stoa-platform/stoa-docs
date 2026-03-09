---
slug: enterprise-ai-native-gateway-benchmark
title: "Benchmark des Gateways IA : Pourquoi le Débit Proxy Ne Suffit Pas"
description: "Le débit proxy ne dit rien sur la maturité IA. Nous avons construit un benchmark ouvert en 20 dimensions mesurant ce qui compte vraiment pour les gateways IA."
authors: [christophe]
tags: [architecture, comparison, ai, open-source, api-gateway]
keywords:
  - API gateway benchmark
  - enterprise AI readiness
  - MCP gateway benchmark
  - AI-native API gateway
  - gateway comparison 2026
  - API gateway performance
  - open source benchmark
---
<!-- last verified: 2026-02 -->

Les benchmarks de débit proxy vous indiquent à quelle vitesse un gateway peut transférer des requêtes HTTP. Ils ne vous disent rien sur la capacité de ce gateway à servir des agents IA, appliquer des guardrails sur les appels d'outils, ou gouverner des sessions autonomes. Nous avons construit un nouveau benchmark qui mesure ce qui compte vraiment.

<!-- truncate -->

## Le problème des benchmarks proxy

Chaque benchmark de gateway API disponible en ligne mesure la même chose : combien de requêtes par seconde le gateway peut-il proxifier de A vers B. Percentiles de latence, capacité en burst, gestion des connexions — toutes des variations de la même question : « quelle est la vitesse de votre reverse proxy ? »

Pour les gateways API traditionnels, c'est la bonne question. Kong, Envoy et APISIX sont optimisés pour le proxying HTTP à haut débit — une force de conception reflétée dans leurs architectures et leurs benchmarks.

Mais 2026 n'est pas 2020. Les agents IA effectuent des appels d'outils via MCP. Les entreprises ont besoin de guardrails qui détectent les PII dans les payloads des agents. Les équipes de sécurité ont besoin de chaînes OAuth 2.1 qui valident les tokens JWT à chaque invocation d'outil. Les équipes plateforme ont besoin de gouvernance sur les sessions d'agents qui peuvent s'exécuter de manière autonome pendant des heures.

**Rien de tout cela n'est mesuré par un benchmark de débit proxy.**

Notre propre [Gateway Arena](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic/arena/) exécute 7 scénarios mesurant les performances HTTP brutes à l'aide de [scripts k6 open source](https://github.com/stoa-platform/stoa/blob/main/scripts/traffic/arena/benchmark.js). Dans nos tests, Kong obtient un score de ~87 et STOA de ~73 — Kong est en tête sur le débit proxy car le test mesure ce dans quoi Kong excelle.

Mais demandez au benchmark si l'un ou l'autre gateway peut servir des outils MCP, évaluer des politiques OPA sur les appels d'outils, ou bloquer des PII dans les payloads des agents — la réponse est le silence. Le benchmark ne sait pas. Il n'a pas été conçu pour cela.

## Présentation de l'Enterprise AI Readiness Index

Nous introduisons une deuxième couche dans Gateway Arena : l'**Enterprise AI Readiness Index**. Il mesure 8 dimensions qui définissent ce qu'un gateway natif IA doit faire :

| Dimension | Poids | Ce qu'elle teste |
|-----------|-------|-----------------|
| **MCP Discovery** | 15% | `GET /mcp/capabilities` retourne-t-il du JSON valide ? |
| **MCP Tool Execution** | 20% | `POST /mcp/tools/list` répond-il en moins de 500ms ? |
| **Auth Chain** | 15% | JWT + appel d'outil se complète-t-il en moins d'1 seconde ? |
| **Policy Engine** | 15% | Le surcoût d'évaluation OPA est-il inférieur à 200ms ? |
| **AI Guardrails** | 10% | Les PII dans les payloads sont-ils bloqués ou expurgés ? |
| **Rate Limiting** | 10% | L'application du 429 se déclenche-t-elle sur le trafic en burst ? |
| **Resilience** | 10% | Un mauvais appel d'outil retourne-t-il 4xx, pas 500 ? |
| **Agent Governance** | 5% | Les endpoints de gouvernance de session existent-ils ? |

Chaque dimension est notée de 0 à 100 selon la disponibilité (pondération 60%) et la latence (pondération 40%). L'index composite est la somme pondérée.

## Deux couches, un seul framework

La décision de conception clé : **deux couches, pas une**. La couche 0 (débit proxy) reste inchangée. La couche 1 (maturité IA en entreprise) est additive.

```
Couche 0 — Proxy Baseline (existant)
  Kong ~87  |  STOA ~73
  Mesure : débit HTTP brut, burst, disponibilité

Couche 1 — Enterprise AI Readiness (nouveau)
  STOA ~78  |  Gravitee ~TBD  |  Kong ~10
  Mesure : MCP, auth, guardrails, gouvernance
```

Pourquoi ne pas les fusionner ? Parce qu'elles mesurent des choses différentes. Un gateway qui obtient 90 sur un index combiné — est-il rapide, prêt pour l'IA, ou les deux ? Impossible à dire. Deux scores séparés apportent de la clarté : Kong est en tête sur le débit proxy, STOA est en tête sur les capacités natives IA.

## Ce que signifie un score de 0

Kong obtient un score quasi nul sur la couche 1 car son support MCP (plugin `ai-mcp-proxy`, ajouté dans Gateway 3.12) nécessite une licence Enterprise — l'édition open source n'inclut pas ce plugin. Dans notre arena, Kong tourne en OSS 3.9.1, la dernière version communautaire.

L'édition communautaire Gravitee 4.8 inclut un entrypoint MCP (Apache 2.0, sans licence requise). Nous avons ajouté Gravitee au benchmark enterprise avec le support du protocole Streamable HTTP (JSON-RPC 2.0) — ses scores apparaîtront dans les prochaines exécutions.

**Score 0 signifie « non implémenté dans l'édition testée », pas « cassé ».**

Et voici l'essentiel : c'est une invitation. La spécification du benchmark est ouverte ([ADR-049](/docs/architecture/adr/adr-049-enterprise-ai-native-benchmark)). Les [scripts k6 sont open source](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic/arena/). N'importe quel gateway peut :

1. Implémenter les endpoints MCP
2. S'ajouter à la configuration du gateway
3. Exécuter le benchmark
4. Publier son score

Si Kong implémente MCP demain, son score de couche 1 augmentera automatiquement. Aucune modification de notre côté. Le benchmark est un terrain équitable — nous avons juste défini ce que le terrain mesure.

## Comment nous notons chaque dimension

La formule de notation est transparente :

```
availability_score = passes / (passes + fails) × 100
latency_score = max(0, 100 × (1 - p95 / cap))
dimension_score = 0.6 × availability + 0.4 × latency
```

Chaque dimension a un plafond de latence. MCP Discovery est plafonné à 500ms — si votre p95 est au-dessus, la composante latence obtient 0. Le rate limiting est plafonné à 1 seconde. La gouvernance des agents à 2 secondes (les endpoints d'administration sont moins critiques en latence).

Nous exécutons 3 runs par gateway (avec 1 warmup écarté) et calculons des intervalles de confiance CI95. La méthodologie reflète notre benchmark de couche 0 : médiane des runs valides, valeurs critiques de la distribution t, métriques Prometheus poussées vers Pushgateway, tableau de bord Grafana pour la visualisation.

## Les 8 scénarios en détail

### 1. MCP Discovery (15%)

```
GET /mcp/capabilities → JSON valide avec liste de capabilities
```

La fondation. Si votre gateway ne peut pas indiquer à un agent IA quels outils sont disponibles, rien d'autre n'a d'importance. Cela teste l'endpoint de découverte du protocole MCP — l'équivalent de la spec OpenAPI d'une API REST, mais pour les outils IA.

### 2. MCP Tool Execution (20%)

```
POST /mcp/tools/list → réponse JSON-RPC, p95 < 500ms
```

La dimension la plus pondérée. Le gateway peut-il servir une liste d'outils via JSON-RPC en moins d'une demi-seconde ? C'est le chemin critique pour chaque interaction d'agent IA. Un gateway qui ne peut pas faire cela n'est pas un gateway IA.

### 3. Auth Chain (15%)

Token Bearer JWT plus appel d'outil MCP. Le pipeline d'authentification complet : validation du token, vérification des scopes, autorisation d'outil — le tout en moins d'1 seconde. Les gateways sans support JWT sur les endpoints MCP obtiennent un crédit partiel s'ils appliquent une forme d'auth.

### 4. Policy Engine (15%)

Surcoût d'évaluation OPA (Open Policy Agent). Nous mesurons le delta entre un appel MCP brut et un appel qui passe par l'évaluation de politique OPA. Le plafond est de 200ms — si votre moteur de politique ajoute plus de 200ms de surcoût, il y a un problème.

### 5. AI Guardrails (10%)

Nous envoyons un appel d'outil avec des PII dans le payload : « Mon numéro de sécurité sociale est 123-45-6789. » Le gateway devrait soit bloquer la requête (4xx) soit expurger les PII avant de transférer. Un crash 500 est inacceptable — cela signifie que les guardrails eux-mêmes sont défaillants.

### 6. Rate Limiting (10%)

Trafic en burst contre le gateway pour déclencher des réponses 429. Les 200 (requête acceptée) et les 429 (rate limit appliqué) sont valides — ils prouvent que le rate limiter fonctionne. Un 500 signifie que le rate limiter a planté sous charge.

### 7. Resilience (10%)

Mauvais appel d'outil avec un nom d'outil inexistant et des arguments malformés. Le gateway devrait retourner une erreur 4xx gracieuse avec un corps d'erreur — pas un crash 500 ou une réponse vide. Cela teste la gestion des erreurs dans le chemin d'exécution des outils IA.

### 8. Agent Governance (5%)

Les endpoints de gouvernance de session existent-ils ? Le gateway peut-il rapporter les sessions d'agents actives, l'état du circuit breaker et l'utilisation des quotas ? Ce sont des exigences enterprise pour les déploiements d'agents autonomes — vous avez besoin de visibilité sur ce que font les agents.

## Exécutez-le vous-même

L'intégralité du benchmark est open source. Clonez le repo et exécutez :

```bash
# Test local contre un gateway STOA en cours d'exécution
k6 run --env SCENARIO=ent_mcp_discovery \
  --env TARGET_URL=http://localhost:8080 \
  --env MCP_BASE=http://localhost:8080/mcp \
  --env SUMMARY_FILE=/tmp/ent_test.json \
  scripts/traffic/arena/benchmark-enterprise.js

# Benchmark enterprise complet sur K8s
kubectl create job --from=cronjob/gateway-arena-enterprise \
  arena-ent-test -n stoa-system
```

Les résultats sont poussés vers Prometheus Pushgateway et visualisés dans un tableau de bord Grafana dédié.

## Ce que cela signifie pour le secteur

Nous ne prétendons pas que STOA surpasse Kong dans l'ensemble — Kong est en tête sur le débit proxy, comme le démontre la couche 0. Ce que nous affirmons, c'est que **le débit proxy est une métrique incomplète pour 2026**. Le secteur a besoin d'un benchmark qui mesure la maturité IA, et nous publions le premier.

La spec est ouverte. Le code est open source. L'invitation est lancée : implémentez MCP, exécutez le benchmark, publiez votre score.

> Les comparaisons de fonctionnalités sont basées sur la documentation publiquement disponible au
> 2026-02. Les capacités des produits évoluent fréquemment. Nous encourageons les lecteurs
> à vérifier les fonctionnalités actuelles directement auprès de chaque fournisseur. Toutes les marques
> appartiennent à leurs propriétaires respectifs.

## FAQ

### Qu'est-ce que l'Enterprise AI Readiness Index ?

Un score composite (0-100) mesurant 8 dimensions enterprise : support MCP, chaînes d'auth, évaluation de politiques OPA, guardrails PII, rate limiting, résilience et gouvernance des agents. Il complète les benchmarks de débit proxy traditionnels avec des capacités spécifiques à l'IA.

### Pourquoi Kong obtient-il 0 sur la couche 1 ?

Le support MCP de Kong (plugins `ai-mcp-proxy`, `ai-mcp-oauth2`) a été ajouté dans Gateway 3.12 mais nécessite une licence Enterprise. L'arena exécute Kong OSS 3.9.1, qui n'inclut pas les plugins MCP. Score 0 signifie « non disponible dans l'édition testée ». Les utilisateurs de Kong Enterprise avec MCP activé peuvent ajouter leur gateway à la configuration et ré-exécuter le benchmark.

### D'autres gateways peuvent-ils participer ?

Oui. Les scripts du benchmark sont [open source](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic/arena/). N'importe quel gateway qui implémente les endpoints testés peut s'ajouter à la configuration et exécuter le benchmark. Voir [ADR-049](/docs/architecture/adr/adr-049-enterprise-ai-native-benchmark) pour la spec complète.

### En quoi ce benchmark diffère-t-il des benchmarks existants ?

Les benchmarks traditionnels (comme le [TechEmpower Framework Benchmark](https://www.techempower.com/benchmarks/)) mesurent le débit HTTP brut. L'Enterprise AI Readiness Index mesure des capacités spécifiques aux gateways natifs IA : support du protocole MCP, guardrails IA et gouvernance des agents. Aucun benchmark existant ne mesure ces éléments.

### Le benchmark est-il biaisé en faveur de STOA ?

STOA a conçu le benchmark, donc les dimensions reflètent ce que nous pensons être important pour les gateways natifs IA. Cependant : la formule de notation est transparente, le code est open source, et la couche 0 (où Kong surpasse STOA) reste inchangée. Nous accueillons les révisions par les pairs et les remises en question sur les choix de dimensions. Les lecteurs peuvent juger si les 8 dimensions sont les bonnes.
