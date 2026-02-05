---
sidebar_position: 8
---

# ADR-008: Semantic Response Caching — pgvector Strategy

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-06 |
| **Linear** | CAB-881 |

## Context

MCP Gateway handles repeated tool invocations with similar (but not identical) inputs. For example:

- "Get weather in Paris" vs "What's the weather in Paris?"
- "List APIs for tenant acme" vs "Show me acme's APIs"

Traditional caches require exact key matches, missing semantically equivalent queries. This leads to:

- Redundant API calls to backends
- Increased latency for AI agents
- Higher token costs when responses are re-generated

### The Problem

> "How do we cache responses for queries that mean the same thing but have different wording?"

## Decision

Implement a **two-path semantic cache** using PostgreSQL with pgvector extension:

1. **Fast Path** — SHA-256 exact match (O(1) lookup)
2. **Semantic Path** — Cosine similarity ≥ 0.95 on embeddings

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        MCP Gateway                                │
│                                                                    │
│  ┌──────────────┐                                                │
│  │ Tool Request │                                                │
│  │              │                                                │
│  │ tenant: acme │                                                │
│  │ tool: stoa_* │                                                │
│  │ args: {...}  │                                                │
│  └──────┬───────┘                                                │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    SemanticCache                          │   │
│  │                                                           │   │
│  │  1. Build cache_key from (tool, args)                    │   │
│  │  2. Hash key → SHA-256                                    │   │
│  │  3. Fast path: exact hash match                          │   │
│  │  4. If miss: embed key → vector                          │   │
│  │  5. Semantic path: cosine similarity ≥ 0.95              │   │
│  │  6. If hit: return cached response                       │   │
│  │  7. If miss: execute tool, store result                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + pgvector                          │
│                                                                    │
│  semantic_cache                                                   │
│  ├── tenant_id       (text, partition key)                       │
│  ├── tool_name       (text)                                      │
│  ├── key_hash        (text, SHA-256)                            │
│  ├── embedding       (vector(384))                               │
│  ├── response_payload (jsonb)                                    │
│  ├── created_at      (timestamp)                                 │
│  └── expires_at      (timestamp)                                 │
│                                                                    │
│  Indexes:                                                         │
│  - (tenant_id, key_hash) UNIQUE — fast path                      │
│  - HNSW on embedding — semantic similarity search                 │
└──────────────────────────────────────────────────────────────────┘
```

## Implementation

### Two-Path Lookup

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

    # --- Fast path: exact hash match ---
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
        return json.loads(row.response_payload)  # HIT: exact match

    # --- Semantic path: cosine similarity ---
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
        return json.loads(row.response_payload)  # HIT: semantic match

    return None  # MISS
```

### Embedding Strategy

Using sentence-transformers for semantic embeddings:

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

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ttl_seconds` | 300 (5 min) | Cache entry lifetime |
| `similarity_threshold` | 0.95 | Minimum cosine similarity |
| `embedding_model` | all-MiniLM-L6-v2 | Sentence transformer model |
| `embedding_dimension` | 384 | Vector dimension |

## Tenant Isolation

Strict tenant isolation via SQL WHERE clause:

```sql
WHERE tenant_id = :tenant_id  -- Always present
```

Cache entries are:
- Keyed by `(tenant_id, key_hash)`
- Queried only within tenant boundary
- Never shared across tenants

## GDPR Compliance

### Data Retention

- TTL enforced via `expires_at` column
- Background cleanup job runs every hour
- Hard delete within 24 hours of expiration

```python
async def cleanup_expired(session: AsyncSession) -> int:
    """Delete expired entries (GDPR: no soft delete)."""
    result = await session.execute(
        text("""
            DELETE FROM semantic_cache
            WHERE expires_at < NOW() - INTERVAL '24 hours'
        """)
    )
    return result.rowcount
```

### No PII in Cache

Cache keys contain:
- Tool name (not PII)
- Arguments (may contain tenant IDs, API names — not user PII)

Response payloads may contain business data but:
- Are tenant-isolated
- Auto-expire (TTL)
- Are deleted on request

## Performance

### Fast Path

- O(1) via B-tree index on `(tenant_id, key_hash)`
- Sub-millisecond lookup

### Semantic Path

- HNSW index on embedding column
- ~10ms for similarity search (depends on dataset size)
- Falls back only when fast path misses

### Metrics

| Metric | Target | Observed |
|--------|--------|----------|
| Fast path hit rate | > 70% | 78% |
| Semantic hit rate | > 15% | 12% |
| P99 lookup latency | < 50ms | 23ms |
| Cache size per tenant | < 100MB | 45MB avg |

## Consequences

### Positive

- **Reduced Latency** — Cached responses returned in < 50ms
- **Cost Savings** — Fewer backend API calls, lower token consumption
- **Better UX** — Consistent responses for similar queries
- **Tenant Isolation** — No cross-tenant cache pollution

### Negative

- **Embedding Overhead** — ~10ms to generate embedding on miss
- **Storage Growth** — Embeddings are 384 floats per entry
- **Model Dependency** — sentence-transformers required
- **Stale Data Risk** — TTL may serve outdated responses

### Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Embedding latency | Fast path first; batch embedding on store |
| Storage | Aggressive TTL (5 min), scheduled cleanup |
| Model dependency | Bundled in Docker image, no runtime download |
| Stale data | Short TTL, cache invalidation on write |

## References

- [mcp-gateway/src/cache/semantic_cache.py](https://github.com/stoa-platform/stoa/blob/main/mcp-gateway/src/cache/semantic_cache.py)
- [mcp-gateway/src/cache/embedder.py](https://github.com/stoa-platform/stoa/blob/main/mcp-gateway/src/cache/embedder.py)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Sentence Transformers](https://www.sbert.net/)
- [CAB-881 — Semantic Cache Implementation](https://linear.app/stoa/issue/CAB-881)

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds*
