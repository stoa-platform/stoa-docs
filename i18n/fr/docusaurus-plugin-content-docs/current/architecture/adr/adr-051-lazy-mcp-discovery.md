---
title: "ADR-051 : Découverte MCP Paresseuse avec Pattern Cache-First"
description: "Décide comment la STOA Gateway découvre les capacités des serveurs MCP upstream : paresseux à la première requête avec cache moka (Option A), évalué contre la découverte eager au démarrage (Option B) et le polling périodique en arrière-plan (Option C)."
keywords: [mcp, découverte, cache, chargement paresseux, moka, circuit breaker, upstream, capacités]
---

# ADR-051 : Découverte MCP Paresseuse avec Pattern Cache-First

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-27 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-1552 |

### Décisions Liées

- **ADR-024** : Gateway Unified Modes — la découverte s'applique au mode edge-mcp
- **ADR-044** : MCP OAuth 2.1 — les endpoints découverts peuvent nécessiter des tokens OAuth
- **ADR-046** : Fédération MCP — la découverte paresseuse est un prérequis pour le routage d'outils fédérés

## Contexte

La STOA Gateway proxyfie les appels d'outils vers des serveurs MCP upstream. Avant de proxyfier, la gateway doit savoir quelles capacités (outils, ressources, prompts) chaque serveur upstream offre. C'est le problème de découverte MCP.

### État Actuel (Pré-ADR)

La découverte n'est pas implémentée. La gateway s'appuie sur le Control Plane API pour fournir un registre d'outils statique. Quand un appel d'outil arrive, la gateway cherche l'outil dans son registre local (synchronisé depuis CP API) et transmet la requête. Il n'y a pas de sondage runtime des serveurs MCP upstream.

### Pourquoi la Découverte Paresseuse

À mesure que STOA évolue vers la Fédération MCP (ADR-046), la gateway doit découvrir les capacités des serveurs MCP upstream qui ne sont pas pré-enregistrés dans CP API. Cas d'usage :

1. **Serveurs upstream dynamiques** — serveurs MCP ajoutés à l'exécution via CRD ou API
2. **Routage fédéré** — la gateway découvre quel upstream sert un outil donné
3. **Négociation de capacités** — les capacités upstream changent dans le temps (nouveaux outils, ressources dépréciées)
4. **Routage conscient de la santé** — la découverte sert aussi de sonde de santé pour les serveurs upstream

### Contraintes

- Le démarrage de la gateway doit rester rapide (&lt;2s) — bloquer la découverte au démarrage est inacceptable
- Les serveurs MCP upstream peuvent être temporairement indisponibles
- Les réponses de découverte sont relativement stables (changent peu fréquemment)
- La gateway gère 100+ requêtes concurrentes ; la découverte ne doit pas devenir un goulot d'étranglement

## Options

### Option A : Découverte Paresseuse avec Cache-First (Choisie)

Sonder les serveurs MCP upstream à la première requête, mettre en cache les capacités découvertes avec un TTL configurable via le cache en mémoire moka. Les requêtes suivantes utilisent le cache. Un cache miss déclenche un sondage asynchrone.

```
Requête arrive → Vérifier le cache moka
  → HIT : retourner les capacités en cache (0ms de surcoût)
  → MISS : sonder l'upstream /mcp/capabilities → mettre en cache le résultat → retourner
```

- **TTL** : configurable (défaut 300s / 5 min)
- **Entrées max** : configurable (défaut 256)
- **Résilience** : circuit breaker + retry exponentiel sur les échecs de sondage
- **Éviction** : moka gère l'expiration par TTL + LRU quand au maximum de capacité

### Option B : Découverte Eager au Démarrage

Sonder tous les upstreams connus au démarrage de la gateway. Bloquer jusqu'à réception de toutes les réponses ou timeout.

- Avantage : cache chaud dès le début, pas de pénalité de latence à la première requête
- Inconvénient : **démarrage lent** (N upstreams × timeout), bloque la sonde de readiness, échoue si un upstream est down au démarrage, périmé si les upstreams changent après le démarrage

### Option C : Polling Périodique en Arrière-Plan

Une tâche en arrière-plan sonde tous les upstreams toutes les N secondes, maintenant un cache continuellement frais.

- Avantage : cache toujours frais, pas de pénalité à la première requête après le premier poll
- Inconvénient : **gaspille des ressources** en sondant des serveurs qui ne seront peut-être jamais interrogés, gestion du cycle de vie complexe (arrêt élégant des tâches de polling), nécessite toujours un repli paresseux pour les serveurs ajoutés entre les polls

## Décision

**Option A : Découverte Paresseuse avec pattern Cache-First.**

L'approche cache-first fournit le meilleur compromis :

1. **Coût de démarrage nul** — la gateway démarre instantanément, sans blocage sur les sondages upstream
2. **Paiement à l'usage** — sonder uniquement les upstreams effectivement demandés
3. **Résilient** — le circuit breaker prévient les pannes en cascade quand les upstreams sont down
4. **Simple** — chemin de code unique (vérifier le cache → miss → sonder → mettre en cache), pas de tâches en arrière-plan
5. **Configurable** — TTL et capacité ajustables via variables d'env sans modification de code

La pénalité de latence à la première requête est acceptable car :
- Elle n'affecte que la toute première requête par upstream par fenêtre TTL
- Le circuit breaker + retry garantissent que la pénalité est bornée (max ~3 tentatives)
- Les requêtes suivantes dans la fenêtre TTL ont un surcoût nul

## Implémentation

### Composants Clés

| Composant | Emplacement | Objectif |
|-----------|----------|---------|
| `LazyMcpDiscovery` | `src/mcp/lazy_discovery.rs` | Struct principal : logique cache + sondage |
| `UpstreamCapabilities` | `src/mcp/lazy_discovery.rs` | Réponse de découverte en cache (outils, ressources, prompts, version protocole) |
| `DiscoveryError` | `src/mcp/lazy_discovery.rs` | Enum d'erreur (réseau, parsing, circuit breaker ouvert) |
| Champs de config | `src/config.rs` | `mcp_discovery_cache_ttl_secs`, `mcp_discovery_cache_max_entries` |
| Champ AppState | `src/state.rs` | `mcp_discovery: Arc<LazyMcpDiscovery>` |

### Stratégie de Cache

- **Moteur** : moka 0.12 `sync::Cache` (thread-safe, O(1) get/insert)
- **Clé** : URL du serveur upstream (String)
- **Valeur** : `UpstreamCapabilities` (Clone + Send + Sync + 'static)
- **TTL** : par entrée, configurable via `STOA_MCP_DISCOVERY_CACHE_TTL_SECS` (défaut 300)
- **Capacité** : entrées max, configurable via `STOA_MCP_DISCOVERY_CACHE_MAX_ENTRIES` (défaut 256)
- **Éviction** : expiration TTL + LRU quand au maximum de capacité (moka gère les deux)

### Résilience

- **Circuit breaker** : par upstream via `CircuitBreakerRegistry`, prévient les sondages répétés vers les upstreams défaillants
- **Retry** : backoff exponentiel (3 tentatives) quand le circuit est fermé
- **Repli** : `DiscoveryError::CircuitBreakerOpen` retourné quand le circuit est ouvert (échec rapide, pas d'appel réseau)

### Configuration

| Variable d'Env | Défaut | Description |
|---------|---------|-------------|
| `STOA_MCP_DISCOVERY_CACHE_TTL_SECS` | `300` | TTL du cache en secondes |
| `STOA_MCP_DISCOVERY_CACHE_MAX_ENTRIES` | `256` | Maximum d'upstreams en cache |

## Conséquences

### Positives

- Temps de démarrage de la gateway inchangé (pas de découverte bloquante)
- Efficace en mémoire : met en cache uniquement les upstreams effectivement utilisés
- Le circuit breaker prévient l'effet de troupeau en cas d'upstreams défaillants
- TTL configurable permettant d'ajuster la fraîcheur vs performance par déploiement
- Fondation pour le routage d'outils de la Fédération MCP (ADR-046)

### Négatives

- La première requête vers chaque upstream subit la latence de découverte (~50-500ms selon le réseau)
- Le TTL du cache signifie que les changements de capacités ne sont pas immédiatement visibles (péremption bornée)
- `entry_count()` sur le cache moka est finalement cohérent (considération de test, pas un problème runtime)

### Risques

- **Inadéquation du protocole upstream** : l'upstream peut ne pas implémenter `/mcp/capabilities`. Atténuation : les erreurs de parsing retournent `DiscoveryError::ParseError`, le circuit breaker se déclenche après des échecs répétés.
- **Cache stampede** : plusieurs requêtes concurrentes pour le même upstream non mis en cache. Atténuation : la déduplication native de moka (un seul sondage s'exécute, les autres attendent). À terme : envisager `get_with()` pour garantir un single-flight.

## Couverture de Tests

10 tests unitaires couvrant :
- Parsing de capacités (5 variantes : complètes, minimales, vides, champs manquants, JSON invalide)
- Aller-retour Serde (cohérence sérialisation/désérialisation)
- Chemin de cache hit (réponse en cache retournée sans appel réseau)
- Cache miss avec upstream inaccessible (propagation d'erreur)
- Invalidation de cache (entrée supprimée, compteur décrémenté)
- Comptage d'entrées (insert → count → vérifier)
