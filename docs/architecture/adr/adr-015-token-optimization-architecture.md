---
sidebar_position: 15
title: "ADR-015: Token Optimization Architecture"
description: "Decides the token optimization engine pipeline for reducing AI developer token consumption through the MCP Gateway."
keywords: [token optimization, AI, MCP Gateway, cost reduction, pipeline, LLM]
---

# ADR-015: Token Optimization Architecture — Token Optimization Engine

| Status | Proposed |
|--------|----------|
| **Date** | 2026-01-28 |
| **Decision Makers** | Christophe ABOULICAM |
| **Related Tickets** | CAB-881 (MEGA-38) |

## Context

Les MCP servers (Linear, Notion, GitHub…) retournent **100% du payload JSON** sans aucun filtrage. Un `linear.issue.get` renvoie typiquement 3 000–5 000 tokens alors que le dev IA n'en exploite que 500–800. Conséquences directes :

| Problème | Impact |
|----------|--------|
| Context window saturation | Le LLM perd en pertinence quand le contexte déborde |
| Coût tokens excessif | Facturation API proportionnelle aux tokens consommés |
| Latence accrue | Plus de tokens = plus de temps de traitement LLM |
| Pas de cache inter-requêtes | Requêtes identiques re-facturées à chaque appel |

**Objectif : réduire de 80% la consommation de tokens** des devs IA utilisant STOA MCP Gateway, sans perte d'information utile.

## Decision

Implémenter un **Token Optimization Engine** sous forme de pipeline middleware dans le MCP Gateway existant. Le pipeline s'exécute dans l'ordre suivant :

```
MCP Request → [Token Counter] → [Response Transformer] → [Semantic Cache] → MCP Response
                                        ↑
                                   [Adapters]
                               (Linear Lite, Notion Lite)
```

### 1. Token Counter

Middleware de métriques positionné en entrée et sortie du pipeline.

- Comptage tokens **avant** et **après** transformation (ratio de réduction)
- Exposition Prometheus : `stoa_tokens_input_total`, `stoa_tokens_output_total`, `stoa_token_savings_ratio`
- Alertes seuil configurable (ex. ratio < 50% déclenche un warning)
- Labels Prometheus : `tenant_id`, `adapter`, `method`

### 2. Response Transformer

Moteur de filtrage configurable piloté par la configuration UAC (Unified Access Control).

- **Field selection** : chaque adapter déclare ses champs via la config UAC du tenant. Seuls les champs déclarés sont transmis au LLM
- **Truncation intelligente** : les champs texte longs (descriptions, body) sont tronqués à un seuil configurable avec marqueur `[truncated]`
- **Pagination automatique** : les listes sont limitées à N éléments avec métadonnée `_pagination: {total, returned, hasMore}`

Configuration dans la section UAC du tenant :

```yaml
token_optimization:
  adapters:
    linear:
      fields: [id, title, state, priority, assignee.name]
      truncate:
        description: 200  # tokens max
      list_limit: 10
    notion:
      fields: [id, title, status, lastEditedTime]
      truncate:
        content: 300
      list_limit: 5
```

**Décision : configuration inline dans UAC** plutôt qu'un fichier séparé. La config token optimization est intrinsèquement liée au tenant et à ses permissions — la séparer créerait un risque de désynchronisation.

### 3. Adapters — Linear Lite & Notion Lite

Implémentations concrètes du Response Transformer pour chaque source de données.

| Adapter | Payload brut (tokens) | Payload optimisé (tokens) | Réduction |
|---------|----------------------|--------------------------|-----------|
| **Linear Lite** | ~4 000 | ~600 | 85% |
| **Notion Lite** | ~5 500 | ~800 | 85% |

Chaque adapter :
- Déclare un **schéma par défaut** de champs essentiels (utilisé si le tenant n'a pas de config custom)
- Implémente la logique de mapping spécifique à l'API source
- Gère les cas limites (champs nullable, nested objects, arrays)

### 4. Semantic Cache

Cache basé sur la similarité sémantique des requêtes pour éviter les appels redondants.

**Décision : pgvector** comme vector store plutôt qu'OpenSearch.

- pgvector est déjà dans le stack PostgreSQL existant — pas de nouveau composant infra
- Les volumes attendus (embeddings de requêtes MCP, pas de corpus documentaire) restent dans les capacités de pgvector
- OpenSearch serait surdimensionné pour ce use case

**Décision : similarité sémantique** (cosine similarity > 0.95) plutôt que match exact.

- Le match exact ne capture pas les reformulations (`get issue 123` vs `fetch issue #123`)
- Le seuil 0.95 limite les faux positifs tout en capturant les variations mineures

**Contraintes de sécurité :**

| Contrainte | Implémentation |
|------------|----------------|
| **Isolation multi-tenant** | Partition par `tenant_id` — jamais de cross-tenant embedding match. Le `tenant_id` est inclus dans la clause WHERE, pas dans l'embedding |
| **Cache poisoning** | TTL 5 min + hash SHA-256 de la requête normalisée |
| **PII dans logs** | Masking obligatoire : les paramètres de requête sont hashés dans les logs, jamais en clair |

Schéma de stockage :

```sql
CREATE TABLE semantic_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  request_hash VARCHAR(64) NOT NULL,
  request_embedding vector(384) NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cache_tenant_embedding
  ON semantic_cache USING ivfflat (request_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Partition-level isolation
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON semantic_cache
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

## Consequences

### Positives

- **Réduction de 80%+ des tokens** consommés par les devs IA
- **Coûts API LLM réduits** proportionnellement pour les tenants
- **Latence améliorée** : moins de tokens à traiter + cache hits
- **Observabilité native** : métriques Prometheus/Grafana dès le jour 1
- **Extensible** : ajouter un adapter (GitHub Lite, Jira Lite) = implémenter le trait ResponseTransformer

### Négatives

- **Complexité pipeline** : 4 étapes middleware ajoutent de la latence de traitement (estimée < 10ms hors cache miss)
- **Maintenance adapters** : chaque mise à jour d'API source (Linear v2, Notion API changes) nécessite une mise à jour de l'adapter
- **Faux positifs cache** : un seuil cosine trop bas pourrait retourner des réponses incorrectes (mitigé par seuil 0.95 + TTL court)
- **Embedding model dependency** : nécessite un modèle d'embedding (all-MiniLM-L6-v2 ou similaire) à héberger ou appeler

## Alternatives Considered

### 1. Filtrage côté client (LLM prompt engineering)

Demander au LLM d'ignorer les champs inutiles via le system prompt.

**Rejeté** : les tokens sont déjà consommés et facturés avant que le LLM ne les « ignore ». Aucune réduction réelle de coût.

### 2. Cache exact-match uniquement (Redis)

Cache clé-valeur classique sur le hash exact de la requête.

**Rejeté** : taux de hit trop faible. Les requêtes MCP varient légèrement en formulation, rendant le match exact inefficace. Un cache sémantique avec pgvector offre un taux de hit significativement supérieur.

### 3. OpenSearch pour le vector store

Déployer un cluster OpenSearch dédié aux embeddings de cache.

**Rejeté** : surdimensionné pour le volume attendu (milliers d'embeddings, pas millions). pgvector évite un composant infra supplémentaire et s'intègre nativement avec PostgreSQL existant.

### 4. Configuration transformer dans un fichier séparé

Fichier `token-optimization.yaml` indépendant du UAC.

**Rejeté** : risque de désynchronisation entre les permissions UAC et la config de filtrage. Un tenant pourrait avoir accès à des champs filtrés, ou inversement. L'inline dans UAC garantit la cohérence.
