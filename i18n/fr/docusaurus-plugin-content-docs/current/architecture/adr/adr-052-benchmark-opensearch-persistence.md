---
title: "ADR-052 : Persistance Benchmark OpenSearch & Dimension LLM Routing"
description: "Étend le Benchmark Enterprise AI Readiness (ADR-049) avec la persistance OpenSearch pour le suivi historique, la gestion du cycle de vie ISM, et ajoute la Dimension 9 : LLM Routing en mode observation."
keywords: [benchmark, opensearch, persistance, historique, ILM, routage LLM, arena, tendances]
---

# ADR-052 : Persistance Benchmark OpenSearch & Dimension LLM Routing

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-28 |
| **Décideurs** | Équipe Plateforme |
| **Ticket** | CAB-1601 |

### Décisions Liées

- **ADR-049** : Benchmark Enterprise AI-Native Gateway — définit le framework à 8 dimensions que cet ADR étend
- **ADR-024** : Gateway Unified Modes — le mode proxy LLM active la nouvelle dimension

## Contexte

L'ADR-049 a introduit le Benchmark Enterprise AI Readiness (Couche 1) avec 8 dimensions, atteignant un score de 98,24/100 sur 7 sprints d'optimisation. Cependant, toutes les données de benchmark sont éphémères — elles n'existent que dans Prometheus via le Pushgateway, qui ne conserve les métriques que ~2 semaines avant l'arrêt du scraping.

Cela crée trois problèmes :

1. **Pas de suivi historique** : Impossible de répondre à "Le score de découverte MCP de STOA s'est-il amélioré ces 3 derniers mois ?" ou "Quand le support MCP de Gravitee est-il apparu ?"
2. **Pas de drill-down par dimension** : Les métriques Pushgateway sont agrégées. On stocke les scores composites et les jauges par dimension, mais pas la décomposition brute disponibilité/latence qui explique *pourquoi* un score a changé.
3. **Dimension manquante** : Le proxy LLM de la gateway (route `/v1/messages`, ADR-024) n'est pas benchmarké. Cette capacité différencie STOA des gateways API purs mais n'a aucune mesure.

### Exigences

- Persister les données par dimension, par gateway, par run pendant au moins 12 mois
- Supporter les tableaux de bord Grafana pour le suivi historique du score composite, les heatmaps par dimension, et les bandes de confiance IC95
- Ajouter LLM Routing comme Dimension 9 sans affecter le score composite existant (mode observation)
- Maintenir la compatibilité ascendante avec le pipeline de métriques Pushgateway existant

## Décision

### 1. OpenSearch comme Backend de Persistance

Les résultats de benchmark sont exportés vers OpenSearch selon un pattern d'index mensuel `stoa-bench-{yyyy.MM}`. Chaque run produit **1 document par dimension par gateway** (pas 1 document plat par gateway), permettant le drill-down Grafana par dimension.

#### Schéma de Document

```json
{
  "@timestamp": "2026-02-28T14:00:00Z",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "layer": "enterprise",
  "instance": "k8s",
  "gateway": "stoa-k8s",
  "dimension": "mcp_discovery",
  "dimension_score": 98.5,
  "composite_score": 98.24,
  "availability": {
    "passes": 50,
    "fails": 0,
    "score": 100.0
  },
  "latency": {
    "p50": 0.012,
    "p95": 0.035,
    "p99": 0.052,
    "cap": 0.5,
    "score": 93.0
  },
  "weight": 0.15,
  "ci95": {
    "lower": 97.1,
    "upper": 99.4
  },
  "stddev": 0.82
}
```

**Template d'index** (`stoa-bench-*`) : champs keyword pour gateway/dimension/layer/instance/run_id, half_float pour les scores, float pour les latences, date pour @timestamp. Un shard, un replica.

**Bulk API** : Les documents sont exportés via l'endpoint `_bulk` (une seule requête HTTP par run) pour minimiser la charge sur OpenSearch.

#### Pourquoi OpenSearch (Pas Prometheus Long-Term)

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| Prometheus + Thanos/Cortex | Déjà dans la stack | Surdimensionné pour ~1000 docs/jour ; pas de support natif d'objets imbriqués ; configuration HA complexe |
| OpenSearch | Déjà déployé pour les logs ; documents JSON natifs ; plugin Grafana disponible ; ISM pour le cycle de vie | Datasource séparée dans Grafana |
| PostgreSQL | Déjà déployé pour CP API | Mauvais outil pour l'agrégation de séries temporelles ; pas d'intégration Grafana native |

OpenSearch est déjà en cours d'exécution dans le cluster pour l'agrégation de logs. Ajouter un nouveau pattern d'index a un coût d'infrastructure nul.

### 2. Gestion du Cycle de Vie des Index (ISM)

La politique ISM `stoa-bench-lifecycle` gère la rétention des index :

| Phase | Durée | Actions |
|-------|-------|---------|
| Hot | 30 jours | Défaut — lecture/écriture, replicas complets |
| Warm | 30-90 jours | Lecture seule, force merge vers 1 segment |
| Cold | 90-365 jours | Nombre de replicas = 0 (économie de stockage) |
| Delete | >365 jours | Suppression automatique |

À ~1000 docs/jour (9 dimensions × 3 gateways × ~37 runs), les index mensuels restent sous 50 Mo. Stockage total annuel : ~600 Mo.

### 3. Dimension 9 : LLM Routing (Mode Observation)

Une nouvelle dimension mesure la capacité de la gateway à proxyfier des requêtes LLM API via `POST /v1/messages` (format Anthropic) :

| Champ | Valeur |
|-------|--------|
| Clé | `llm_routing` |
| Scénario | `ent_llm_routing` |
| Poids | **0.00** (mode observation) |
| Plafond Latence | 2.0s |
| Nécessite MCP | Non |

**Le mode observation** signifie :
- Le score est calculé et persisté dans OpenSearch
- Le score est visible sur le tableau de bord historique
- Le score **n'affecte pas** l'Indice de Maturité Entreprise composite
- Le poids sera augmenté (ex. 0.10) après validation sur plusieurs runs, en réduisant proportionnellement les autres poids

**Backend mock** : Un pod nginx (`llm-mock-backend`) renvoie du JSON statique au format Anthropic API en ~5ms. Cela isole le benchmark de la latence LLM réelle, mesurant uniquement la surcharge de la couche proxy de la gateway.

**Vérifications** :
- `llm_routing_status_2xx` — La réponse est 2xx
- `llm_routing_valid_json` — La réponse est du JSON valide
- `llm_routing_has_message` — La réponse contient `"type": "message"`
- `llm_routing_has_usage` — La réponse contient `usage.input_tokens > 0`

### 4. Export Dual (Pushgateway + OpenSearch)

Les deux pipelines s'exécutent en parallèle :
- **Pushgateway** : Pipeline existant, inchangé. Alimente le tableau de bord Grafana live (`gateway-arena-enterprise.json`).
- **OpenSearch** : Nouveau pipeline. Alimente le tableau de bord Grafana historique (`gateway-arena-historical.json`).

Si OpenSearch est inaccessible, le run continue — les métriques Pushgateway sont toujours exportées. L'export OpenSearch est au mieux effort avec un log d'avertissement.

### 5. Corpus Public

Un répertoire `corpus/` contient 9 fichiers JSON (un par dimension), chacun avec 5 tâches de test synthétiques. Cela documente publiquement ce que chaque dimension mesure, permettant aux autres gateways de préparer leurs implémentations avant d'exécuter le benchmark.

## Alternatives Considérées

### A. Remplacer Pushgateway par OpenSearch entièrement

**Rejeté.** Pushgateway alimente les alertes Prometheus existantes et le tableau de bord live. Le remplacer briserait la stack de monitoring. L'export dual ajoute moins de 100ms par run.

### B. Démarrer LLM Routing à un poids de 0.10 immédiatement

**Rejeté.** Changer les scores composites nécessite de re-normaliser les 8 poids existants. Démarrer à 0.00 (mode observation) permet de valider la stabilité de la dimension sur plusieurs runs avant de l'introduire dans le composite. Cela évite les régressions de score et donne à Gravitee/Kong le temps d'implémenter le support de proxy LLM s'ils le souhaitent.

### C. Utiliser un vrai backend LLM pour le benchmarking

**Rejeté.** Les vraies réponses LLM ont une latence variable (200ms-10s) qui domine la surcharge de la gateway. Un backend mock (~5ms) isole ce qu'on mesure réellement : la couche proxy de la gateway, pas le temps d'inférence du LLM.

## Conséquences

### Positives

- **Suivi historique** : Les tableaux de bord Grafana montrent l'évolution des scores sur des semaines/mois, permettant la détection de régressions.
- **Drill-down par dimension** : Les ingénieurs peuvent identifier quelle dimension spécifique a régressé et pourquoi (disponibilité vs latence).
- **Suivi de la maturité LLM** : Même à un poids de 0.00, le score LLM Routing fournit une visibilité sur un différenciateur clé.
- **Corpus de benchmark ouvert** : Les définitions de tâches publiées augmentent la transparence et la reproductibilité.

### Négatives

- **Deux datasources Grafana** : OpenSearch nécessite une datasource et un plugin Grafana séparés.
- **Coût de stockage** : ~600 Mo/an dans OpenSearch (négligeable).
- **Complexité d'export dual** : Deux chemins d'export à maintenir (Pushgateway + OpenSearch).

### Neutres

- Les métriques Pushgateway L0 et L1 existantes ne sont pas affectées.
- Le score composite reste inchangé jusqu'à ce que le poids LLM Routing soit augmenté lors d'une décision future.

## Implémentation

| Livrable | Repo | Fichiers Clés |
|----------|------|---------------|
| Refactoring export OpenSearch | stoa | `scripts/traffic/arena/run-arena-enterprise.py` |
| Template d'index | stoa | `k8s/arena/opensearch-index-template.json` |
| Politique ISM de cycle de vie | stoa | `k8s/arena/opensearch-ism-policy.json` |
| Backend LLM mock | stoa | `k8s/arena/llm-mock-backend.yaml` |
| Scénario k6 LLM routing | stoa | `scripts/traffic/arena/benchmark-enterprise.js` |
| Tableau de bord historique | stoa | `docker/observability/grafana/dashboards/gateway-arena-historical.json` |
| Datasource Grafana OpenSearch | stoa | `docker/observability/grafana/provisioning/datasources/prometheus.yml` |
| Bootstrap de déploiement | stoa | `k8s/arena/deploy-enterprise.sh` |
| Corpus public | stoa | `scripts/traffic/arena/corpus/*.json` (9 fichiers) |
| Cet ADR | stoa-docs | `docs/architecture/adr/adr-052-*` |
