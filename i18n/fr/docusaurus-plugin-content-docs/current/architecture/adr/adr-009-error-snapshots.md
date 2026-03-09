---
sidebar_position: 9
title: "ADR-009 : Snapshots d'erreurs"
description: "Décide l'architecture de débogage « voyage dans le temps » avec des snapshots d'erreurs, le masquage des données personnelles et le stockage OpenSearch pour les diagnostics gateway."
keywords: [snapshots d'erreurs, débogage, masquage PII, OpenSearch, observabilité, diagnostics]
---

# ADR-009 : Snapshots d'erreurs — Débogage « voyage dans le temps » avec masquage PII

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-06 |
| **Linear** | CAB-397 |

## Contexte

Lorsque des invocations d'outils MCP échouent, le débogage nécessite de comprendre le contexte complet :

- Quelle était la requête ?
- Quel utilisateur/tenant l'a initiée ?
- Quel contexte LLM existait ?
- Y a-t-il eu des retentatives ?
- Quel était l'impact sur les coûts ?

La journalisation traditionnelle ne capture que des fragments. Les développeurs doivent corréler manuellement les logs entre les services. Cela est particulièrement problématique pour :

- Les échecs intermittents
- Les dépassements de rate limit
- Les timeouts backend
- Les erreurs de validation de schéma

### Le problème

> « Un agent IA a échoué en pleine conversation. L'utilisateur le signale 2 heures plus tard. Comment reconstruire exactement ce qui s'est passé ? »

## Décision

Implémenter des **snapshots d'erreurs** — des captures complètes instantanées des requêtes échouées avec masquage automatique des données personnelles et génération de commandes cURL pour la reproduction.

### Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MCP Gateway                                   │
│                                                                        │
│  ┌────────────┐    ┌────────────────┐    ┌────────────────────────┐ │
│  │ Invocation │───▶│ Gestionnaire   │───▶│   capture_mcp_error()  │ │
│  │  d'outil   │    │  d'erreurs     │    │                        │ │
│  │ (échoue)   │    │                │    │  - Construire contexte │ │
│  └────────────┘    │  statut >= 400 │    │  - Masquer PII         │ │
│                    └────────────────┘    │  - Calculer coût       │ │
│                                           │  - Publier async       │ │
│                                           └───────────┬────────────┘ │
└───────────────────────────────────────────────────────┼──────────────┘
                                                        │
                                                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Éditeur de snapshots                                │
│                                                                        │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Topic Kafka     │    │  MinIO/S3       │    │  OpenSearch     │  │
│  │ error-snapshots │    │  (compressé)    │    │  (indexé)       │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

## Modèle de snapshot

```python
@dataclass
class MCPErrorSnapshot:
    # --- Identification ---
    snapshot_id: str              # UUID
    timestamp: datetime
    environment: str              # dev, staging, prod

    # --- Détails de l'erreur ---
    error_type: MCPErrorType      # Enum : TOOL_EXECUTION, RATE_LIMIT, AUTH, etc.
    error_message: str            # Masqué

    # --- Contexte de la requête ---
    request: RequestContext       # Méthode, chemin, headers (masqués), corps
    response_status: int

    # --- Contexte utilisateur ---
    user: UserContext             # tenant_id, user_id (haché), rôles

    # --- Contexte MCP ---
    mcp_server: MCPServerContext | None  # ID serveur, version protocole
    tool_invocation: ToolInvocation | None  # Nom outil, paramètres (masqués)
    llm_context: LLMContext | None  # Tokens, modèle, coût estimé

    # --- Contexte de retentative ---
    retry_context: RetryContext | None  # Nombre de tentatives, backoff

    # --- Observabilité ---
    trace_id: str | None
    span_id: str | None
    conversation_id: str | None

    # --- Impact sur les coûts ---
    total_cost_usd: float
    tokens_wasted: int

    # --- Suivi PII ---
    masked_fields: list[str]      # Champs qui ont été masqués
```

## Types d'erreurs

```python
class MCPErrorType(Enum):
    TOOL_EXECUTION = "tool_execution"      # Outil échoué pendant l'exécution
    TOOL_NOT_FOUND = "tool_not_found"      # Outil inexistant
    VALIDATION = "validation"               # Validation d'entrée échouée
    AUTH = "auth"                           # Authentification/autorisation
    RATE_LIMIT = "rate_limit"              # Rate limit dépassé
    TIMEOUT = "timeout"                     # Timeout backend
    UPSTREAM = "upstream"                   # Erreur retournée par le backend
    INTERNAL = "internal"                   # Erreur interne du MCP Gateway
```

## Stratégie de masquage PII

### Masquage automatique

Masquage en trois couches avant le stockage :

```python
# 1. Headers
masked_headers = mask_headers(request.headers)
# Authorization: Bearer eyJ... → Authorization: [REDACTED]
# X-API-Key: sk-... → X-API-Key: [REDACTED]

# 2. Paramètres d'outil
masked_params = mask_tool_params(tool.input_params)
# {"password": "secret123"} → {"password": "[REDACTED]"}
# {"email": "user@example.com"} → {"email": "[REDACTED]"}

# 3. Messages d'erreur
masked_message = mask_error_message(error_message)
# "Token invalide pour l'utilisateur john@..." → "Token invalide pour l'utilisateur [REDACTED]"
```

### Configuration des champs sensibles

```python
settings = MCPSnapshotSettings(
    sensitive_headers=[
        "authorization",
        "x-api-key",
        "cookie",
        "x-client-secret",
    ],
    sensitive_params=[
        "password",
        "secret",
        "token",
        "api_key",
        "email",
        "phone",
        "ssn",
        "credit_card",
    ],
)
```

## Génération de commande cURL pour la reproduction

Chaque snapshot inclut une commande cURL pour rejouer la requête :

```python
def generate_curl_command(snapshot: MCPErrorSnapshot) -> str:
    """Générer une commande cURL pour la reproduction (secrets remplacés par des placeholders)."""
    cmd = f"curl -X {snapshot.request.method}"
    cmd += f" '{snapshot.request.url}'"

    for header, value in snapshot.request.headers.items():
        if header.lower() in sensitive_headers:
            cmd += f" -H '{header}: ${{YOUR_{header.upper()}_HERE}}'"
        else:
            cmd += f" -H '{header}: {value}'"

    if snapshot.request.body:
        cmd += f" -d '{json.dumps(snapshot.request.body)}'"

    return cmd
```

Exemple de sortie :

```bash
curl -X POST '${STOA_GATEWAY_URL}/tools/call' \
  -H 'Authorization: ${YOUR_AUTHORIZATION_HERE}' \
  -H 'Content-Type: application/json' \
  -d '{"tool": "acme:payment-api:create", "arguments": {...}}'
```

## Stratégie de stockage

### Partitionnement

Les snapshots sont partitionnés par date et tenant :

```
s3://stoa-error-snapshots/
├── 2026/
│   └── 02/
│       └── 06/
│           ├── tenant-acme/
│           │   ├── snap_abc123.json.gz
│           │   └── snap_def456.json.gz
│           └── tenant-beta/
│               └── snap_xyz789.json.gz
```

### Rétention

| Environnement | Rétention | Justification |
|---------------|-----------|---------------|
| Production | 30 jours | Conformité, débogage |
| Staging | 7 jours | Tests |
| Développement | 1 jour | Économies |

### Compression

Les snapshots sont compressés avec gzip avant le stockage :

```python
async def store_snapshot(snapshot: MCPErrorSnapshot) -> str:
    """Stocker le snapshot avec compression."""
    payload = snapshot.model_dump_json()
    compressed = gzip.compress(payload.encode())

    key = f"{snapshot.timestamp:%Y/%m/%d}/{snapshot.user.tenant_id}/{snapshot.snapshot_id}.json.gz"
    await s3.put_object(Bucket=bucket, Key=key, Body=compressed)

    return key
```

## Conditions de capture

Les snapshots sont capturés selon les critères suivants :

```python
if not settings.enabled:
    return None

if response_status < 400:
    return None  # Succès — pas de snapshot

if 400 <= response_status < 500 and not settings.capture_on_4xx:
    return None  # Erreur client — optionnel

if response_status >= 500 and not settings.capture_on_5xx:
    return None  # Erreur serveur — généralement capturé
```

### Exclusions

```python
settings = MCPSnapshotSettings(
    exclude_paths=[
        "/health",
        "/metrics",
        "/ready",
    ],
    capture_on_4xx=True,   # Capturer les erreurs client
    capture_on_5xx=True,   # Capturer les erreurs serveur
)
```

## Suivi des coûts

Les snapshots calculent les ressources gaspillées :

```python
if llm_context:
    total_cost = llm_context.estimated_cost_usd
    tokens_wasted = llm_context.tokens_input + llm_context.tokens_output

snapshot = MCPErrorSnapshot(
    total_cost_usd=total_cost,
    tokens_wasted=tokens_wasted,
    ...
)
```

Permet des tableaux de bord affichant :
- L'impact des erreurs sur les coûts par tenant
- Les tendances de gaspillage de tokens
- Les types d'erreurs les plus coûteux

## Conséquences

### Positives

- **Débogage « voyage dans le temps »** — Reconstituer l'état exact de la requête des heures plus tard
- **Sûr pour la conformité** — Le masquage automatique évite les problèmes de conformité
- **Visibilité sur les coûts** — Suivi des tokens et coûts API gaspillés
- **Capacité de reproduction** — Commandes cURL pour la reproduction
- **Corrélation** — Liens vers les traces via trace_id/span_id

### Négatives

- **Coûts de stockage** — Les snapshots consomment de l'espace S3
- **Latence de capture** — ~5 ms de surcoût par erreur
- **Lacunes de masquage** — Les champs personnalisés peuvent nécessiter une configuration
- **Volume de données** — Les scénarios à forte erreur génèrent de nombreux snapshots

### Atténuations

| Défi | Atténuation |
|------|-------------|
| Coûts de stockage | Compression + rétention courte |
| Latence de capture | Publication asynchrone via Kafka |
| Lacunes de masquage | Champs sensibles configurables |
| Volume de données | Rate limiting, échantillonnage pour les 4xx |

## Références

- [mcp-gateway/src/features/error_snapshots/](https://github.com/stoa-platform/stoa/tree/main/mcp-gateway/src/features/error_snapshots/)
- [ADR-023 — Observabilité zéro angle mort](./adr-023-zero-blind-spot-observability.md)
- [CAB-397 — Fonctionnalité de snapshot d'erreur](https://linear.app/stoa/issue/CAB-397)

---

*Standard Marchemalo : Un architecte vétéran de 40 ans comprend en 30 secondes*
