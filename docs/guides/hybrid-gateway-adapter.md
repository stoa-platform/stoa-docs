---
sidebar_position: 4
slug: /guides/hybrid-gateway-adapter
title: "Hybrid Gateway Adapter — Bring Your Own Gateway"
description: "Implement a custom gateway adapter to orchestrate any API gateway through STOA's unified interface — Kong, Apigee, webMethods, AWS API Gateway integration"
keywords: [STOA, gateway adapter, hybrid, bring your own gateway, API gateway, integration, guide]
---

# Hybrid Gateway Adapter — Bring Your Own Gateway

## Overview

STOA's Gateway Adapter Pattern allows you to orchestrate **any API gateway** through a unified, gateway-agnostic interface. Your APIs, policies, OIDC configuration, and applications are declared in Git; the adapter translates them into gateway-specific REST calls during the GitOps reconciliation cycle.

```
Git (desired state) → ArgoCD → Control Plane API → Gateway Adapter → Your Gateway
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  STOA Control Plane                  │
│              GitOps Reconciliation Engine             │
├──────────┬──────────┬──────────┬────────────────────┤
│ webMethods│  Kong    │  Apigee  │  AWS API Gateway   │
│ Adapter  │ Adapter  │ Adapter  │     Adapter        │
│    ✅    │   🔜    │   🔜    │       🔜           │
├──────────┴──────────┴──────────┴────────────────────┤
│          GatewayAdapterInterface (ABC)               │
│  health_check · sync_api · upsert_policy · ...       │
└─────────────────────────────────────────────────────┘
```

### Interface Contract

Every adapter implements `GatewayAdapterInterface`. Key properties:

- **Idempotent**: Calling the same operation twice produces the same result
- **Declarative**: You specify desired state, the adapter computes the diff
- **Auth-agnostic**: Supports both OIDC proxy (JWT forwarding) and Basic Auth

### Reconciliation Lifecycle

```
PHASE 0:   health_check()         → Verify gateway is reachable
PHASE 1:   (load from Git)        → Read tenant/API definitions
PHASE 1.5: upsert_policy()        → Sync policies (CORS, rate-limit, etc.)
PHASE 1.7: upsert_auth_server()   → Sync OIDC (Keycloak, Okta, etc.)
PHASE 2:   list_apis()            → Fetch current gateway state
PHASE 3:   (compute diff)         → Compare Git vs gateway
PHASE 4:   sync_api()             → Create/update/delete APIs
PHASE 4.5: provision_application() → Sync OAuth applications
PHASE 5:   (portal visibility)    → Publish/unpublish from portal
PHASE 6:   apply_config()         → Global gateway configuration
PHASE 7:   export_archive()       → Backup gateway state
```

## Implementing a New Adapter

### 1. Create the adapter module

```
control-plane-api/src/adapters/
├── gateway_adapter_interface.py   # Don't modify
├── __init__.py
├── webmethods/                    # Reference implementation
│   ├── adapter.py
│   └── mappers.py
└── kong/                          # Your new adapter
    ├── __init__.py
    ├── adapter.py
    └── mappers.py
```

### 2. Implement the interface

```python
from ..gateway_adapter_interface import GatewayAdapterInterface, AdapterResult

class KongGatewayAdapter(GatewayAdapterInterface):
    async def health_check(self) -> AdapterResult:
        # GET /status on Kong Admin API
        ...

    async def sync_api(self, api_spec: dict, tenant_id: str,
                       auth_token=None) -> AdapterResult:
        # POST /services + POST /routes on Kong Admin API
        ...

    # ... implement all abstract methods
```

### 3. Register the adapter

In `adapters/registry.py`, register the new adapter class:

```python
from ..adapters.kong import KongGatewayAdapter

ADAPTER_REGISTRY = {
    "kong": KongGatewayAdapter,
    # ... other adapters
}
```

The Control Plane API creates adapters via `AdapterRegistry.create(gateway_type)` — no external orchestration needed.

## Supported Gateways

| Gateway | Status | Adapter | Notes |
|---------|--------|---------|-------|
| STOA Gateway (Rust) | ✅ Production | `adapters/stoa/` | Native, in-memory, MCP-first |
| Kong (DB-less) | ✅ Production | `adapters/kong/` | Declarative reload via `POST /config` |
| Gravitee (APIM v4) | ✅ Production | `adapters/gravitee/` | Full CRUD + lifecycle management |
| webMethods 10.x/11.x | ✅ Production | `adapters/webmethods/` | Full OIDC, aliases, backup |
| Apigee | 🔜 Planned | — | — |
| AWS API Gateway | 🔜 Planned | — | — |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WM_GATEWAY_URL` | `http://apim-gateway:5555` | webMethods admin URL |
| `WM_ADMIN_USER` | `Administrator` | Admin username (Basic Auth) |
| `WM_ADMIN_PASSWORD` | — | Admin password (Basic Auth) |
| `GATEWAY_USE_OIDC_PROXY` | `false` | Use OIDC proxy mode |
| `GATEWAY_ADMIN_PROXY_URL` | — | OIDC proxy URL |

### Git Structure

```
webmethods/
├── aliases/
│   ├── dev.yaml
│   ├── staging.yaml
│   └── prod.yaml
├── policies/
│   ├── cors-platform.yaml
│   ├── rate-limit-default.yaml
│   └── logging-standard.yaml
├── oidc/
│   └── keycloak-auth-server.yaml
├── config/
│   └── gateway-config.yaml
└── applications/
    └── .gitkeep
```

## Local Development

```bash
# Start the STOA platform locally
docker compose up -d

# Run adapter health check
curl ${STOA_API_URL}/v1/gateways

# Trigger a sync via the Control Plane API
curl -X POST ${STOA_API_URL}/v1/deployments/{id}/sync \
  -H "Authorization: Bearer $TOKEN"
```
