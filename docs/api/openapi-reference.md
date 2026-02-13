---
sidebar_position: 4
title: "OpenAPI Reference"
description: "STOA Control Plane API — auto-generated OpenAPI 3.1 reference, endpoint categories, authentication, and interactive documentation."
keywords:
  - OpenAPI
  - API reference
  - REST API
  - Swagger
  - endpoints
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# OpenAPI Reference

The Control Plane API is documented using OpenAPI 3.1.0. The specification is auto-generated from FastAPI route definitions and kept in sync via CI.

## Live Documentation

The API serves interactive documentation at:

| Format | URL | Description |
|--------|-----|-------------|
| Swagger UI | `https://api.<YOUR_DOMAIN>/docs` | Interactive API explorer |
| ReDoc | `https://api.<YOUR_DOMAIN>/redoc` | Read-optimized documentation |
| OpenAPI JSON | `https://api.<YOUR_DOMAIN>/openapi.json` | Raw specification |

## Endpoint Categories

The API organizes endpoints into the following groups:

| Category | Prefix | Endpoints | Description |
|----------|--------|-----------|-------------|
| APIs | `/v1/apis` | CRUD + sync | API lifecycle management |
| Tenants | `/v1/tenants` | CRUD + members | Tenant management |
| Subscriptions | `/v1/subscriptions` | CRUD + approve/revoke | Subscription lifecycle |
| Consumers | `/v1/consumers` | CRUD + keys | Consumer management |
| Gateways | `/v1/gateways` | CRUD + health | Gateway instance management |
| Deployments | `/v1/deployments` | List + promote | Deployment tracking |
| Environments | `/v1/environments` | List | Environment management |
| Tools | `/v1/tools` | CRUD | MCP tool catalog |
| Webhooks | `/v1/tenants/{id}/webhooks` | CRUD + test | Event notifications |
| Service Accounts | `/v1/service-accounts` | CRUD + rotate | M2M authentication |
| Health | `/health` | GET | Platform health check |
| Metrics | `/metrics` | GET | Prometheus metrics |

## Authentication

All endpoints (except `/health` and `/openapi.json`) require a Bearer token:

<EnvSetup />

```bash
# Get a token
TOKEN=$(curl -s -X POST "${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=control-plane-api" \
  -d "username=admin" \
  -d "password=demo" \
  | jq -r '.access_token')

# Use the token
curl -s "${STOA_API_URL}/v1/apis" \
  -H "Authorization: Bearer $TOKEN"
```

## Common Response Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | Success | GET, PUT, PATCH |
| 201 | Created | POST (new resource) |
| 204 | No Content | DELETE |
| 400 | Bad Request | Invalid payload |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable | Validation error (with details) |
| 429 | Too Many Requests | Rate limit exceeded |

## Error Format

All errors follow a consistent format:

```json
{
  "detail": "API not found",
  "status_code": 404,
  "error_code": "API_NOT_FOUND"
}
```

Validation errors (422) include field-level details:

```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## Pagination

List endpoints support pagination:

```bash
curl "${STOA_API_URL}/v1/apis?skip=0&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `skip` | 0 | -- | Number of items to skip |
| `limit` | 20 | 100 | Number of items to return |

## Downloading the Specification

```bash
# Download the full OpenAPI spec
curl -s "${STOA_API_URL}/openapi.json" | jq '.' > openapi.json

# Count endpoints
cat openapi.json | jq '.paths | length'
```

The specification can be imported into tools like Postman, Insomnia, or any OpenAPI-compatible client.

## Contract Testing

The OpenAPI spec is validated in CI using snapshot tests:

```bash
# Generate and compare (in control-plane-api/)
pytest tests/test_openapi_contract.py -v
```

Any endpoint change that modifies the spec requires updating the snapshot.

## Related

- [Control Plane API](/docs/api/control-plane) -- API overview
- [MCP Gateway API](/docs/api/mcp-gateway) -- Gateway endpoints
- [Gateway Admin API](/docs/api/gateway-admin-api) -- Admin endpoints
- [Authentication](/docs/guides/authentication) -- Token acquisition
