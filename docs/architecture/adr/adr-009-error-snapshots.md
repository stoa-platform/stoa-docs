---
sidebar_position: 9
---

# ADR-009: Error Snapshots — Time-Travel Debugging with PII Masking

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-06 |
| **Linear** | CAB-397 |

## Context

When MCP tool invocations fail, debugging requires understanding the complete context:

- What was the request?
- What user/tenant initiated it?
- What LLM context existed?
- Were there retries?
- What was the cost impact?

Traditional logging captures fragments. Developers must correlate logs across services manually. This is especially problematic for:

- Intermittent failures
- Rate limit breaches
- Backend timeouts
- Schema validation errors

### The Problem

> "An AI agent failed mid-conversation. The user reports it 2 hours later. How do we reconstruct exactly what happened?"

## Decision

Implement **Error Snapshots** — complete point-in-time captures of failed requests with automatic PII masking and cURL replay generation.

### Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MCP Gateway                                   │
│                                                                        │
│  ┌────────────┐    ┌────────────────┐    ┌────────────────────────┐ │
│  │ Tool       │───▶│ Error Handler  │───▶│   capture_mcp_error()  │ │
│  │ Invocation │    │                │    │                        │ │
│  │ (fails)    │    │  status >= 400 │    │  - Build context       │ │
│  └────────────┘    └────────────────┘    │  - Mask PII            │ │
│                                           │  - Calculate cost      │ │
│                                           │  - Publish async       │ │
│                                           └───────────┬────────────┘ │
└───────────────────────────────────────────────────────┼──────────────┘
                                                        │
                                                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Snapshot Publisher                                  │
│                                                                        │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Kafka Topic     │    │  MinIO/S3       │    │  OpenSearch     │  │
│  │ error-snapshots │    │  (compressed)   │    │  (indexed)      │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

## Snapshot Model

```python
@dataclass
class MCPErrorSnapshot:
    # --- Identification ---
    snapshot_id: str              # UUID
    timestamp: datetime
    environment: str              # dev, staging, prod

    # --- Error Details ---
    error_type: MCPErrorType      # Enum: TOOL_EXECUTION, RATE_LIMIT, AUTH, etc.
    error_message: str            # Masked

    # --- Request Context ---
    request: RequestContext       # Method, path, headers (masked), body
    response_status: int

    # --- User Context ---
    user: UserContext             # tenant_id, user_id (hashed), roles

    # --- MCP Context ---
    mcp_server: MCPServerContext | None  # Server ID, protocol version
    tool_invocation: ToolInvocation | None  # Tool name, params (masked)
    llm_context: LLMContext | None  # Tokens, model, estimated cost

    # --- Retry Context ---
    retry_context: RetryContext | None  # Attempt count, backoff

    # --- Observability ---
    trace_id: str | None
    span_id: str | None
    conversation_id: str | None

    # --- Cost Impact ---
    total_cost_usd: float
    tokens_wasted: int

    # --- PII Tracking ---
    masked_fields: list[str]      # Fields that were masked
```

## Error Types

```python
class MCPErrorType(Enum):
    TOOL_EXECUTION = "tool_execution"      # Tool failed during execution
    TOOL_NOT_FOUND = "tool_not_found"      # Tool doesn't exist
    VALIDATION = "validation"               # Input validation failed
    AUTH = "auth"                           # Authentication/authorization
    RATE_LIMIT = "rate_limit"              # Rate limit exceeded
    TIMEOUT = "timeout"                     # Backend timeout
    UPSTREAM = "upstream"                   # Backend returned error
    INTERNAL = "internal"                   # MCP Gateway internal error
```

## PII Masking Strategy

### Automatic Masking

Three-layer masking before storage:

```python
# 1. Headers
masked_headers = mask_headers(request.headers)
# Authorization: Bearer eyJ... → Authorization: [REDACTED]
# X-API-Key: sk-... → X-API-Key: [REDACTED]

# 2. Tool Parameters
masked_params = mask_tool_params(tool.input_params)
# {"password": "secret123"} → {"password": "[REDACTED]"}
# {"email": "user@example.com"} → {"email": "[REDACTED]"}

# 3. Error Messages
masked_message = mask_error_message(error_message)
# "Invalid token for user john@..." → "Invalid token for user [REDACTED]"
```

### Sensitive Fields Configuration

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

## cURL Replay Generation

Each snapshot includes a cURL command to replay the request:

```python
def generate_curl_command(snapshot: MCPErrorSnapshot) -> str:
    """Generate cURL command for replay (secrets replaced with placeholders)."""
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

Example output:

```bash
curl -X POST 'https://mcp.gostoa.dev/tools/call' \
  -H 'Authorization: ${YOUR_AUTHORIZATION_HERE}' \
  -H 'Content-Type: application/json' \
  -d '{"tool": "acme:payment-api:create", "arguments": {...}}'
```

## Storage Strategy

### Partitioning

Snapshots partitioned by date and tenant:

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

### Retention

| Environment | Retention | Rationale |
|-------------|-----------|-----------|
| Production | 30 days | Compliance, debugging |
| Staging | 7 days | Testing |
| Development | 1 day | Cost savings |

### Compression

Snapshots compressed with gzip before storage:

```python
async def store_snapshot(snapshot: MCPErrorSnapshot) -> str:
    """Store snapshot with compression."""
    payload = snapshot.model_dump_json()
    compressed = gzip.compress(payload.encode())

    key = f"{snapshot.timestamp:%Y/%m/%d}/{snapshot.user.tenant_id}/{snapshot.snapshot_id}.json.gz"
    await s3.put_object(Bucket=bucket, Key=key, Body=compressed)

    return key
```

## Capture Conditions

Snapshots captured based on:

```python
if not settings.enabled:
    return None

if response_status < 400:
    return None  # Success — no snapshot

if 400 <= response_status < 500 and not settings.capture_on_4xx:
    return None  # Client error — optional

if response_status >= 500 and not settings.capture_on_5xx:
    return None  # Server error — usually captured
```

### Exclusions

```python
settings = MCPSnapshotSettings(
    exclude_paths=[
        "/health",
        "/metrics",
        "/ready",
    ],
    capture_on_4xx=True,   # Capture client errors
    capture_on_5xx=True,   # Capture server errors
)
```

## Cost Tracking

Snapshots calculate wasted resources:

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

Enables dashboards showing:
- Cost impact of errors per tenant
- Token waste trends
- Most expensive error types

## Consequences

### Positive

- **Time-Travel Debugging** — Reconstruct exact request state hours later
- **PII-Safe** — Automatic masking prevents compliance issues
- **Cost Visibility** — Track wasted tokens and API costs
- **Replay Capability** — cURL commands for reproduction
- **Correlation** — Links to traces via trace_id/span_id

### Negative

- **Storage Costs** — Snapshots consume S3 storage
- **Capture Latency** — ~5ms overhead per error
- **Masking Gaps** — Custom fields may need configuration
- **Data Volume** — High-error scenarios generate many snapshots

### Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Storage costs | Compression + short retention |
| Capture latency | Async publishing via Kafka |
| Masking gaps | Configurable sensitive fields |
| Data volume | Rate limiting, sampling for 4xx |

## References

- [mcp-gateway/src/features/error_snapshots/](https://github.com/stoa-platform/stoa/tree/main/mcp-gateway/src/features/error_snapshots/)
- [ADR-023 — Zero Blind Spot Observability](./adr-023-zero-blind-spot-observability.md)
- [CAB-397 — Error Snapshot Feature](https://linear.app/stoa/issue/CAB-397)

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds*
