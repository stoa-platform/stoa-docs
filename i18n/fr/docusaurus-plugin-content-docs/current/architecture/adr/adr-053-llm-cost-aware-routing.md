---
title: "ADR-053 : Routage LLM Conscient des Coûts"
description: "Décide comment la STOA Gateway route les requêtes LLM vers plusieurs fournisseurs avec optimisation des coûts, enforcement budgétaire et suivi des coûts basé sur Prometheus. Choisit LowestCost comme stratégie de routage par défaut (Option A), évaluée contre RoundRobin (Option B) et LowestLatency (Option C)."
keywords: [llm, routage, coût, budget, prometheus, multi-fournisseur, anthropic, openai, mistral]
---

# ADR-053 : Routage LLM Conscient des Coûts

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-03-01 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-1600 |

### Décisions Liées

- **ADR-024** : Gateway Unified Modes — le routage LLM opère en mode edge-mcp
- **ADR-041** : Plugin Architecture — les modules LLM utilisent des feature flags pour la séparation community/enterprise
- **ADR-051** : Découverte MCP Paresseuse — partage le pattern de cache moka pour les lookups de budget

## Contexte

La STOA Gateway proxyfie les requêtes LLM vers plusieurs fournisseurs (Anthropic, OpenAI, Mistral, Azure OpenAI, Google Vertex, AWS Bedrock). Sans routage conscient des coûts, les tenants paient le plein tarif sur un seul fournisseur sans visibilité sur les dépenses, sans enforcement budgétaire, et sans possibilité d'optimiser entre les fournisseurs.

### État Actuel (Pré-ADR)

La gateway dispose d'un module `LlmProxy` (`src/proxy/llm_proxy.rs`) qui transmet les requêtes à un seul fournisseur configuré. Aucune décision de routage n'est prise — la requête va au fournisseur configuré. Les comptages de tokens sont extraits des réponses mais ne sont pas utilisés pour le calcul des coûts ou les métriques.

### Pourquoi le Routage Conscient des Coûts

Les tenants multi-fournisseurs peuvent réaliser 30 à 85 % d'économies grâce au routage intelligent :

1. **Routage basé sur le coût** — router vers le fournisseur le moins cher à qualité de modèle équivalente (30-50 % d'économies)
2. **Enforcement budgétaire** — vérification pré-vol 429 pour prévenir les dépenses incontrôlées (15-25 % d'économies)
3. **Facturation consciente du cache** — la mise en cache de prompt Anthropic coûte ~10 % du pricing d'entrée complet (10-15 % d'économies)
4. **Chaînes de repli** — le circuit breaker évite de payer pour des requêtes échouées (5-10 % d'économies)

### Contraintes

- La décision de routage doit ajouter moins de 5ms de latence (pas d'appels externes dans le chemin chaud)
- Le lookup de budget ne doit pas bloquer chaque requête (cache avec obsolescence bornée acceptable)
- Le suivi des coûts ne doit pas perdre de données lors d'un redémarrage de la gateway (le scraping Prometheus fournit la durabilité)
- Doit supporter la surcharge de fournisseur par requête via un header (pour les tests A/B, le débogage)

## Options

### Option A : Stratégie LowestCost par Défaut (Choisie)

Router chaque requête vers le fournisseur avec le coût-par-token le plus bas pour la classe de modèle demandée. Les métadonnées de prix sont configurées par fournisseur au démarrage (pas d'appels API runtime).

```
Requête arrive → Extraire le modèle depuis le payload
  → Filtrer les fournisseurs activés avec modèle compatible
  → Trier par cost_per_1m_input (croissant)
  → Sélectionner le moins cher → Transmettre la requête
  → Extraire les tokens depuis la réponse → Enregistrer les métriques de coût
```

- **Latence de décision** : moins de 1ms (tri en mémoire de 2-6 fournisseurs)
- **Surcharge** : le header `X-Stoa-Provider` contourne le routage, envoie vers un fournisseur spécifique
- **Repli** : si le fournisseur le moins cher échoue, le circuit breaker le marque comme défaillant, la prochaine requête va vers le deuxième moins cher

### Option B : Stratégie RoundRobin par Défaut

Distribuer les requêtes uniformément entre tous les fournisseurs activés. Simple, prévisible, mais ignore les différences de coût.

- Avantage : distribution équilibrée de la charge, pas de configuration de prix nécessaire
- Inconvénient : **pas d'optimisation des coûts** — un split 50/50 entre un fournisseur à $3/MTok et un à $15/MTok gaspille 40 % par rapport au routage tout vers le moins cher

### Option C : Stratégie LowestLatency par Défaut

Router vers le fournisseur avec la latence P50 observée la plus basse (fenêtre glissante). Optimise la vitesse, pas le coût.

- Avantage : meilleure expérience utilisateur pour les charges de travail sensibles à la latence
- Inconvénient : **le fournisseur le plus rapide est souvent le plus cher** — contrecarre l'objectif d'optimisation des coûts. Nécessite également une infrastructure de suivi de la latence (fenêtre glissante, décroissance).

## Décision

**Option A : LowestCost comme stratégie de routage par défaut.**

L'optimisation des coûts est la proposition de valeur principale pour les tenants multi-fournisseurs. La stratégie est :

1. **Simple** — métadonnées de prix statiques, pas d'appels API runtime, routage déterministe
2. **Surchargeable** — surcharge par requête via header pour les charges de travail sensibles à la latence ou spécifiques à un fournisseur
3. **Composable** — les tenants peuvent passer à RoundRobin ou LowestLatency via la configuration
4. **Mesurable** — les métriques Prometheus prouvent les économies (comparaison avant/après)

LowestLatency et RoundRobin restent disponibles comme options de configuration. Le router supporte les quatre stratégies : `LowestCost`, `LowestLatency`, `RoundRobin`, `HeaderOverride`.

## Implémentation

### Composants Clés

| Composant | Emplacement | Objectif |
|-----------|-------------|---------|
| `LlmRouter` | `src/llm/router.rs` | Router principal : 4 stratégies, sélection de fournisseur, intégration circuit breaker |
| `CostCalculator` | `src/llm/cost.rs` | Calcul du coût par requête depuis les comptages de tokens + prix fournisseur |
| `BudgetGate` | `src/llm/cost.rs` | Vérification budgétaire pré-vol (429 si dépassé) |
| `ProviderRegistry` | `src/llm/providers.rs` | 6 fournisseurs avec métadonnées de prix, mappings de modèles |
| Champs de config | `src/config.rs` | `LlmRouterConfig` (stratégie, budget, fournisseurs) |
| Champ AppState | `src/state.rs` | `llm_router: Option<Arc<LlmRouter>>` |
| Endpoints admin | `src/handlers/admin.rs` | `/admin/llm/{status,providers,costs}` |

### Flux de Routage

```
POST /v1/messages
  │
  ├─ BudgetGate::check_tenant_budget()
  │   └─ cache moka (TTL 60s) → lookup budget CP API
  │   └─ Si dépassé → 429 + X-Stoa-Budget-Exceeded: true
  │
  ├─ LlmRouter::select(strategy, model, headers)
  │   └─ LowestCost: trier les fournisseurs par cost_per_1m_input, choisir le moins cher activé
  │   └─ HeaderOverride: X-Stoa-Provider → direct vers le fournisseur nommé
  │   └─ Circuit breaker: ignorer les fournisseurs défaillants
  │
  ├─ LlmProxy::forward(provider, request)
  │   └─ Streaming SSE avec extraction de tokens
  │
  └─ CostCalculator::track(provider, model, tokens)
      └─ Émettre 7 métriques Prometheus
```

### Métriques Prometheus (7 compteurs/histogrammes)

| Métrique | Type | Labels | Description |
|--------|------|--------|-------------|
| `gateway_llm_requests_total` | counter | `provider`, `model`, `status` | Total des requêtes LLM |
| `gateway_llm_cost_total` | counter | `provider`, `model` | Coût cumulé en USD |
| `gateway_llm_tokens_input_total` | counter | `provider`, `model` | Total des tokens d'entrée |
| `gateway_llm_tokens_output_total` | counter | `provider`, `model` | Total des tokens de sortie |
| `gateway_llm_tokens_cache_read_total` | counter | `provider`, `model` | Tokens de lecture depuis le cache (Anthropic) |
| `gateway_llm_tokens_cache_write_total` | counter | `provider`, `model` | Tokens d'écriture dans le cache (Anthropic) |
| `gateway_llm_request_duration_seconds` | histogram | `provider`, `model` | Latence des requêtes |

### Exemples PromQL

```promql
# Dépenses LLM totales sur les 24 dernières heures
sum(increase(gateway_llm_cost_total[24h]))

# Coût par fournisseur sur les 7 derniers jours
sum by (provider) (increase(gateway_llm_cost_total[7d]))

# Coût moyen par requête
sum(rate(gateway_llm_cost_total[1h])) / sum(rate(gateway_llm_requests_total[1h]))

# Ratio d'économies du cache (Anthropic)
sum(rate(gateway_llm_tokens_cache_read_total{provider="anthropic"}[1h]))
  / sum(rate(gateway_llm_tokens_input_total{provider="anthropic"}[1h]))

# Utilisation du budget (nécessite l'endpoint budget CP API)
# gateway_llm_cost_total / tenant_budget_limit_usd * 100
```

### Synchronisation du Budget

Les limites budgétaires sont stockées dans le Control Plane API (table `llm_budget`). La gateway met en cache les limites avec moka avec un TTL de 60 secondes pour éviter les appels API par requête.

```
BudgetGate::check()
  → cache moka HIT → comparer dépenses vs limite (0ms de surcoût)
  → cache moka MISS → GET /v1/tenants/{id}/llm/budget → mettre en cache → comparer
  → Si dépenses >= limite → 429 Too Many Requests + X-Stoa-Budget-Exceeded: true
```

Invalidation du cache : `POST /admin/llm/budget-cache/clear` force l'éviction du cache (pour les changements de budget immédiats).

### API Admin

| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `/admin/llm/status` | GET | Bearer (token admin) | Statut du router : activé, stratégie, nombre de fournisseurs |
| `/admin/llm/providers` | GET | Bearer (token admin) | Liste des fournisseurs avec métadonnées de prix |
| `/admin/llm/costs` | GET | Bearer (token admin) | Statut du suivi des coûts + snapshot de métriques |
| `/admin/llm/budget-cache/clear` | POST | Bearer (token admin) | Forcer l'éviction du cache de budget |

### Configuration des Fournisseurs

```yaml
llm_router:
  enabled: true
  default_strategy: lowest_cost
  budget_limit_usd: 100.0
  providers:
    - provider: anthropic
      base_url: https://api.anthropic.com/v1
      api_key_env: ANTHROPIC_API_KEY
      default_model: claude-sonnet-4-20250514
      cost_per_1m_input: 3.0
      cost_per_1m_output: 15.0
      cost_per_1m_cache_read: 0.3
      cost_per_1m_cache_write: 3.75
      priority: 1
      max_concurrent: 50
    - provider: openai
      base_url: https://api.openai.com/v1
      api_key_env: OPENAI_API_KEY
      default_model: gpt-4o
      cost_per_1m_input: 2.5
      cost_per_1m_output: 10.0
      priority: 2
      max_concurrent: 50
```

## Conséquences

### Positives

- Les tenants multi-fournisseurs réalisent 30 à 85 % d'économies sans modification de code (configurer les fournisseurs, activer le routage)
- L'enforcement budgétaire prévient les dépenses incontrôlées avant qu'elles se produisent (429 pré-vol)
- Les métriques Prometheus fournissent une observabilité complète des coûts (par fournisseur, par modèle, par requête)
- La facturation consciente du cache prend correctement en compte la mise en cache de prompt Anthropic (lectures de cache 10x moins chères)
- L'API admin permet un tableau de bord Console UI pour le monitoring des coûts et la gestion du budget
- L'intégration du circuit breaker garantit que le routage évite automatiquement les fournisseurs défaillants

### Négatives

- Les métadonnées de prix sont statiques (configurées au déploiement) — les changements de prix des fournisseurs nécessitent une mise à jour de la configuration
- L'obsolescence du cache de budget (TTL 60s) signifie qu'un tenant peut légèrement dépasser son budget dans une rafale
- Le routage LowestCost peut concentrer tout le trafic sur un seul fournisseur (pas d'équilibrage de charge)

### Risques

- **Changements de prix des fournisseurs** : les fournisseurs en amont peuvent changer leurs tarifs sans préavis. Atténuation : les prix sont explicites dans la configuration, pas récupérés depuis les API des fournisseurs. Les opérateurs mettent à jour selon leur propre calendrier.
- **Condition de course sur le budget** : les requêtes concurrentes dans la fenêtre de cache de 60s pourraient dépasser le budget. Atténuation : acceptable pour la plupart des charges de travail. Futur : envisager un décrément atomique du budget avec Redis pour un enforcement strict.
- **Concentration sur un seul fournisseur** : LowestCost choisit toujours le moins cher, surchargeant potentiellement un fournisseur. Atténuation : limite `max_concurrent` par fournisseur + circuit breaker. Futur : envisager le routage par coût pondéré.

## Couverture de Tests

40 tests d'intégration couvrant :

- Statut LLM admin (activé/désactivé, nombre de fournisseurs, stratégie de routage)
- Fournisseurs LLM admin (liste avec métadonnées de prix, vide quand désactivé)
- Coûts LLM admin (suivi activé/désactivé, tableau de métriques)
- Enforcement de l'auth sur tous les endpoints admin (401 sans token, 401 avec mauvais token)
- Sélection de stratégie du router (LowestCost, RoundRobin, LowestLatency, HeaderOverride)
- Calculateur de coûts (calcul de coût basé sur les tokens, facturation consciente du cache)
- Budget gate (vérification pré-vol, réponse 429)
- Intégration du circuit breaker (fournisseur défaillant ignoré)

Le benchmark Arena L1 (dimension `ent_llm_cost`) valide les endpoints admin live avec le suivi des coûts et les métadonnées de prix des fournisseurs.
