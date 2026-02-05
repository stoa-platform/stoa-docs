---
sidebar_position: 4
---

# ADR-004: Gateway Adapter Pattern — Multi-Gateway Orchestration

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-06 |
| **Linear** | N/A (Foundational) |
| **Research** | CIR-eligible: Declarative Reconciliation of Proprietary API Gateways |

## Context

STOA Platform needs to orchestrate multiple API gateways (webMethods, Kong, Apigee, AWS API Gateway) through a unified control plane. Each gateway has a different admin API, different authentication mechanisms, and different resource models.

### The Problem

> "How do we manage APIs across heterogeneous gateways without creating N different codebases?"

Traditional approaches either:
1. **Vendor lock-in** — Build tight coupling to one gateway
2. **Lowest common denominator** — Support only features common to all gateways
3. **Code duplication** — Implement separate integrations per gateway

STOA needs an abstraction that enables:
- Full feature utilization per gateway
- Unified GitOps reconciliation
- Testable adapter implementations
- Future gateway additions without control plane changes

### Research Context

This pattern emerged from research into declarative reconciliation of proprietary API gateways — specifically webMethods, which lacks both a Terraform provider and a Kubernetes operator. The solution represents original research in applying GitOps principles to closed-source enterprise software.

## Decision

Adopt the **Gateway Adapter Pattern** — an abstract interface defining all operations required for STOA's GitOps reconciliation, with concrete implementations per gateway type.

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       STOA Control Plane                          │
│                                                                    │
│  ┌─────────────────┐    ┌──────────────────────────────────────┐ │
│  │  Reconciliation │────│         Adapter Registry              │ │
│  │    Pipeline     │    │                                        │ │
│  └─────────────────┘    │  ┌──────────────────────────────────┐ │ │
│                         │  │   GatewayAdapterInterface        │ │ │
│                         │  │   - sync_api()                   │ │ │
│                         │  │   - upsert_policy()              │ │ │
│                         │  │   - provision_application()      │ │ │
│                         │  │   - ...18 total methods          │ │ │
│                         │  └──────────────────────────────────┘ │ │
│                         │              ▲                         │ │
│                         │              │ implements              │ │
│                         │  ┌──────────┼──────────┬────────────┐ │ │
│                         │  │          │          │            │ │ │
│                         │  ▼          ▼          ▼            │ │ │
│                         │ ┌────────┐ ┌────────┐ ┌──────────┐  │ │
│                         │ │webMeth.│ │  stoa  │ │ template │  │ │
│                         │ │Adapter │ │Adapter │ │ Adapter  │  │ │
│                         │ └───┬────┘ └───┬────┘ └────┬─────┘  │ │
│                         └─────┼──────────┼───────────┼────────┘ │
└───────────────────────────────┼──────────┼───────────┼──────────┘
                                ▼          ▼           ▼
                           ┌────────┐ ┌────────┐  ┌────────┐
                           │webMeth.│ │  stoa  │  │ (new)  │
                           │Gateway │ │Gateway │  │Gateway │
                           └────────┘ └────────┘  └────────┘
```

### Interface Contract

```python
class GatewayAdapterInterface(ABC):
    """Abstract interface for gateway orchestration.

    All operations MUST be idempotent: calling the same operation twice
    with the same input must produce the same result without side effects.
    """

    # --- Lifecycle (3 methods) ---
    async def health_check(self) -> AdapterResult: ...
    async def connect(self) -> None: ...
    async def disconnect(self) -> None: ...

    # --- APIs (3 methods) ---
    async def sync_api(self, api_spec: dict, tenant_id: str) -> AdapterResult: ...
    async def delete_api(self, api_id: str) -> AdapterResult: ...
    async def list_apis(self) -> list[dict]: ...

    # --- Policies (3 methods) ---
    async def upsert_policy(self, policy_spec: dict) -> AdapterResult: ...
    async def delete_policy(self, policy_id: str) -> AdapterResult: ...
    async def list_policies(self) -> list[dict]: ...

    # --- Applications (3 methods) ---
    async def provision_application(self, app_spec: dict) -> AdapterResult: ...
    async def deprovision_application(self, app_id: str) -> AdapterResult: ...
    async def list_applications(self) -> list[dict]: ...

    # --- Auth/OIDC (3 methods) ---
    async def upsert_auth_server(self, auth_spec: dict) -> AdapterResult: ...
    async def upsert_strategy(self, strategy_spec: dict) -> AdapterResult: ...
    async def upsert_scope(self, scope_spec: dict) -> AdapterResult: ...

    # --- Aliases (1 method) ---
    async def upsert_alias(self, alias_spec: dict) -> AdapterResult: ...

    # --- Configuration (1 method) ---
    async def apply_config(self, config_spec: dict) -> AdapterResult: ...

    # --- Backup (1 method) ---
    async def export_archive(self) -> bytes: ...
```

### Standardized Result

All operations return a consistent result type:

```python
@dataclass
class AdapterResult:
    success: bool
    resource_id: str | None = None  # Gateway-side ID
    data: dict | None = None        # Additional response data
    error: str | None = None        # Error message if failed
```

## Adapter Registry

Factory pattern for creating adapter instances:

```python
class AdapterRegistry:
    _adapters: dict[str, type[GatewayAdapterInterface]] = {}

    @classmethod
    def register(cls, gateway_type: str, adapter_class: type) -> None:
        cls._adapters[gateway_type] = adapter_class

    @classmethod
    def create(cls, gateway_type: str, config: dict) -> GatewayAdapterInterface:
        adapter_class = cls._adapters.get(gateway_type)
        if not adapter_class:
            raise ValueError(f"No adapter for '{gateway_type}'")
        return adapter_class(config=config)
```

### Registered Adapters

| Type | Class | Status | Use Case |
|------|-------|--------|----------|
| `webmethods` | `WebMethodsGatewayAdapter` | Production | Enterprise gateway |
| `stoa` | `StoaGatewayAdapter` | Production | Internal/MCP gateway |
| `template` | `TemplateGatewayAdapter` | Scaffold | New adapter development |
| `kong` | (planned) | Q2 2026 | OSS gateway |
| `apigee` | (planned) | Q3 2026 | Google Cloud |

## Implementation Structure

```
control-plane-api/src/adapters/
├── __init__.py
├── gateway_adapter_interface.py   # Abstract interface
├── registry.py                    # Adapter factory
│
├── webmethods/                    # Production adapter
│   ├── __init__.py
│   ├── adapter.py                 # WebMethodsGatewayAdapter
│   ├── client.py                  # HTTP client for webMethods API
│   └── mappers.py                 # Spec <-> webMethods translation
│
├── stoa/                          # Internal adapter
│   ├── __init__.py
│   └── adapter.py                 # StoaGatewayAdapter
│
└── template/                      # Scaffold for new adapters
    ├── __init__.py
    ├── adapter.py                 # TemplateGatewayAdapter
    └── mappers.py                 # TODO comments for implementation
```

## Idempotency Requirements

All adapter operations MUST be idempotent:

| Operation | Idempotency Behavior |
|-----------|---------------------|
| `sync_api` | Creates if missing, updates if exists (upsert) |
| `delete_api` | No-op if already deleted |
| `upsert_policy` | Creates or updates based on policy ID |
| `provision_application` | Returns existing app ID if already provisioned |
| `health_check` | Safe to call repeatedly |

### Idempotent Reconciliation Loop

```python
async def reconcile_api(adapter: GatewayAdapterInterface, api_spec: dict):
    """Idempotent reconciliation — safe to retry on failure."""

    # 1. Check current state
    existing = await adapter.list_apis()

    # 2. Sync desired state (creates or updates)
    result = await adapter.sync_api(api_spec, tenant_id)

    if not result.success:
        # Log and retry — idempotent, so safe
        logger.warning(f"Sync failed: {result.error}")
        raise ReconciliationError(result.error)

    return result.resource_id
```

## GitOps Integration

The adapter pattern enables declarative GitOps for any gateway:

```yaml
# stoa-gitops/tenants/acme/apis/payment-api/api.yaml
apiVersion: gostoa.dev/v1alpha1
kind: API
metadata:
  name: payment-api
  tenant: acme
spec:
  gateway_type: webmethods  # Selects adapter
  openapi: ./openapi.yaml
  policies:
    - rate-limit-100rpm
    - jwt-validation
```

The reconciliation pipeline:
1. Detects change in Git
2. Loads API spec from YAML
3. Uses `AdapterRegistry.create("webmethods")` to get adapter
4. Calls `adapter.sync_api(spec, "acme")`
5. Records result in audit log

## Consequences

### Positive

- **Gateway Agnostic** — Control plane doesn't know gateway internals
- **Testable** — Mock adapters for unit tests, real adapters for integration
- **Extensible** — New gateway support without control plane changes
- **Idempotent** — Safe retries, GitOps-compatible
- **Vendor Neutral** — Avoid lock-in to any single gateway

### Negative

- **Abstraction Overhead** — Some gateway-specific features may not fit the interface
- **Mapping Complexity** — Each adapter must translate to/from gateway-specific formats
- **Version Skew** — Gateway API versions may drift across implementations

### Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Feature gaps | `data` field in AdapterResult carries gateway-specific extras |
| Mapping complexity | Dedicated `mappers.py` module per adapter |
| Version skew | Adapter tests run against specific gateway versions |

## Adding a New Gateway

To add Kong support:

1. Copy `template/` to `kong/`
2. Implement `KongGatewayAdapter` following `mappers.py` TODOs
3. Register in `registry.py`:
   ```python
   from .kong import KongGatewayAdapter
   AdapterRegistry.register("kong", KongGatewayAdapter)
   ```
4. Add integration tests against Kong Admin API
5. Update documentation

## References

- [control-plane-api/src/adapters/](https://github.com/stoa-platform/stoa/tree/main/control-plane-api/src/adapters/)
- [ADR-024 — Unified Gateway Architecture](./adr-024-gateway-unified-modes.md)
- [ADR-007 — GitOps with ArgoCD](./adr-007-gitops-argocd.md)
- [Adapter Pattern — Wikipedia](https://en.wikipedia.org/wiki/Adapter_pattern)

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds*
