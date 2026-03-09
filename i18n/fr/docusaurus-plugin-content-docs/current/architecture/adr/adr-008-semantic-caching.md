---
sidebar_position: 8
title: "ADR-008 : Cache sémantique de réponses"
description: "Décide la stratégie de cache sémantique basée sur pgvector pour les réponses aux outils MCP, afin de réduire la latence et la consommation de tokens."
keywords: [cache sémantique, pgvector, cache de réponses, performances, optimisation des tokens]
---

# ADR-008 : Cache sémantique de réponses — Stratégie pgvector

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-06 |
| **Linear** | CAB-881 |

## Contexte

Le MCP Gateway traite des invocations d'outils répétées avec des entrées similaires mais non identiques. Par exemple :

- « Météo à Paris » vs « Quel temps fait-il à Paris ? »
- « Lister les API du tenant acme » vs « Montre-moi les API d'acme »

Les caches traditionnels nécessitent des correspondances de clés exactes, manquant les requêtes sémantiquement équivalentes. Cela conduit à :

- Des appels API redondants vers les backends
- Une latence accrue pour les agents IA
- Des coûts en tokens plus élevés lors de la regénération des réponses

### Le problème

> « Comment mettre en cache les réponses pour des requêtes qui signifient la même chose mais s'expriment différemment ? »

## Décision

Implémenter un **cache sémantique à deux voies** utilisant PostgreSQL avec l'extension pgvector :

1. **Voie rapide** — Correspondance exacte SHA-256 (recherche O(1))
2. **Voie sémantique** — Similarité cosinus ≥ 0,95 sur les embeddings

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        MCP Gateway                                │
│                                                                    │
│  ┌──────────────┐                                                │
│  │ Requête outil│                                                │
│  │              │                                                │
│  │ tenant: acme │                                                │
│  │ outil: stoa_ │                                                │
│  │ args: {...}  │                                                │
│  └──────┬───────┘                                                │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    SemanticCache                          │   │
│  │                                                           │   │
│  │  1. Construire cache_key depuis (outil, args)            │   │
│  │  2. Hacher la clé → SHA-256                              │   │
│  │  3. Voie rapide : correspondance hash exacte             │   │
│  │  4. Si manqué : intégrer la clé → vecteur               │   │
│  │  5. Voie sémantique : similarité cosinus ≥ 0,95         │   │
│  │  6. Si trouvé : retourner la réponse en cache            │   │
│  │  7. Si manqué : exécuter l'outil, stocker le résultat   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + pgvector                          │
│                                                                    │
│  semantic_cache                                                   │
│  ├── tenant_id       (text, clé de partition)                   │
│  ├── tool_name       (text)                                      │
│  ├── key_hash        (text, SHA-256)                            │
│  ├── embedding       (vector(384))                               │
│  ├── response_payload (jsonb)                                    │
│  ├── created_at      (timestamp)                                 │
│  └── expires_at      (timestamp)                                 │
│                                                                    │
│  Index :                                                         │
│  - (tenant_id, key_hash) UNIQUE — voie rapide                   │
│  - HNSW sur embedding — recherche de similarité sémantique      │
└──────────────────────────────────────────────────────────────────┘
```

## Implémentation

### Recherche à deux voies

```python
async def lookup(
    self,
    session: AsyncSession,
    tenant_id: str,
    tool_name: str,
    arguments: dict,
) -> dict | None:
    cache_key = self._embedder.build_cache_key(tool_name, arguments)
    key_hash = self._embedder.hash_key(cache_key)  # SHA-256

    # --- Voie rapide : correspondance hash exacte ---
    result = await session.execute(
        text("""
            SELECT response_payload
            FROM semantic_cache
            WHERE tenant_id = :tenant_id
              AND key_hash = :key_hash
              AND expires_at > :now
            LIMIT 1
        """),
        {"tenant_id": tenant_id, "key_hash": key_hash, "now": now},
    )
    row = result.fetchone()
    if row is not None:
        return json.loads(row.response_payload)  # TROUVÉ : correspondance exacte

    # --- Voie sémantique : similarité cosinus ---
    embedding = self._embedder.embed(cache_key)

    result = await session.execute(
        text("""
            SELECT response_payload,
                   1 - (embedding <=> :embedding::vector) AS similarity
            FROM semantic_cache
            WHERE tenant_id = :tenant_id
              AND tool_name = :tool_name
              AND expires_at > :now
              AND 1 - (embedding <=> :embedding::vector) >= :threshold
            ORDER BY similarity DESC
            LIMIT 1
        """),
        {"embedding": embedding, "threshold": 0.95, ...},
    )
    row = result.fetchone()
    if row is not None:
        return json.loads(row.response_payload)  # TROUVÉ : correspondance sémantique

    return None  # MANQUÉ
```

### Stratégie d'embedding

Utilisation de sentence-transformers pour les embeddings sémantiques :

```python
class Embedder:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self._model = SentenceTransformer(model_name)

    def build_cache_key(self, tool_name: str, arguments: dict) -> str:
        return f"{tool_name}:{json.dumps(arguments, sort_keys=True)}"

    def hash_key(self, cache_key: str) -> str:
        return hashlib.sha256(cache_key.encode()).hexdigest()

    def embed(self, cache_key: str) -> list[float]:
        return self._model.encode(cache_key).tolist()
```

### Configuration

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `ttl_seconds` | 300 (5 min) | Durée de vie d'une entrée en cache |
| `similarity_threshold` | 0,95 | Similarité cosinus minimale |
| `embedding_model` | all-MiniLM-L6-v2 | Modèle sentence transformer |
| `embedding_dimension` | 384 | Dimension du vecteur |

## Isolation des tenants

Isolation stricte des tenants via clause SQL WHERE :

```sql
WHERE tenant_id = :tenant_id  -- Toujours présent
```

Les entrées du cache sont :
- Identifiées par `(tenant_id, key_hash)`
- Interrogées uniquement dans les limites du tenant
- Jamais partagées entre tenants

## Conformité RGPD

### Rétention des données

- TTL appliqué via la colonne `expires_at`
- Job de nettoyage en arrière-plan toutes les heures
- Suppression définitive dans les 24h suivant l'expiration

```python
async def cleanup_expired(session: AsyncSession) -> int:
    """Supprimer les entrées expirées (RGPD : pas de suppression logique)."""
    result = await session.execute(
        text("""
            DELETE FROM semantic_cache
            WHERE expires_at < NOW() - INTERVAL '24 hours'
        """)
    )
    return result.rowcount
```

### Pas de données personnelles en cache

Les clés de cache contiennent :
- Le nom de l'outil (pas de données personnelles)
- Les arguments (peuvent contenir des IDs tenant, noms d'API — pas de données personnelles utilisateur)

Les payloads de réponse peuvent contenir des données métier mais :
- Sont isolés par tenant
- Expirent automatiquement (TTL)
- Sont supprimés sur demande

## Performances

### Voie rapide

- O(1) via index B-tree sur `(tenant_id, key_hash)`
- Recherche sous la milliseconde

### Voie sémantique

- Index HNSW sur la colonne d'embedding
- ~10 ms pour la recherche de similarité (selon la taille du jeu de données)
- Utilisée uniquement en cas d'échec de la voie rapide

### Métriques

| Métrique | Cible | Observé |
|----------|-------|---------|
| Taux de succès voie rapide | > 70% | 78% |
| Taux de succès sémantique | > 15% | 12% |
| Latence P99 de recherche | < 50 ms | 23 ms |
| Taille du cache par tenant | < 100 Mo | 45 Mo en moyenne |

## Conséquences

### Positives

- **Latence réduite** — Réponses en cache retournées en < 50 ms
- **Économies** — Moins d'appels API backend, moindre consommation de tokens
- **Meilleure UX** — Réponses cohérentes pour des requêtes similaires
- **Isolation des tenants** — Aucune pollution cross-tenant du cache

### Négatives

- **Surcoût d'embedding** — ~10 ms pour générer l'embedding en cas de cache miss
- **Croissance du stockage** — Les embeddings font 384 floats par entrée
- **Dépendance au modèle** — sentence-transformers requis
- **Risque de données périmées** — Le TTL peut servir des réponses obsolètes

### Atténuations

| Défi | Atténuation |
|------|-------------|
| Latence d'embedding | Voie rapide en premier ; embedding en batch au stockage |
| Stockage | TTL court (5 min), nettoyage planifié |
| Dépendance au modèle | Intégré dans l'image Docker, pas de téléchargement à l'exécution |
| Données périmées | TTL court, invalidation du cache à l'écriture |

## Références

- [mcp-gateway/src/cache/semantic_cache.py](https://github.com/stoa-platform/stoa/blob/main/mcp-gateway/src/cache/semantic_cache.py)
- [mcp-gateway/src/cache/embedder.py](https://github.com/stoa-platform/stoa/blob/main/mcp-gateway/src/cache/embedder.py)
- [Documentation pgvector](https://github.com/pgvector/pgvector)
- [Sentence Transformers](https://www.sbert.net/)
- [CAB-881 — Implémentation du cache sémantique](https://linear.app/stoa/issue/CAB-881)

---

*Standard Marchemalo : Un architecte vétéran de 40 ans comprend en 30 secondes*
