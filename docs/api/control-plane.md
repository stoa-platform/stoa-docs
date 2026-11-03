---
sidebar_position: 1
title: "Control Plane REST API Reference"
description: "REST API reference for STOA Control Plane — manage tenants, APIs, tools, subscriptions, webhooks, and gateway operations via OpenAPI-documented endpoints"
keywords: [API reference, REST API, control plane, OpenAPI]
---

# Control Plane API

REST API reference for STOA Control Plane.

## OpenAPI Specification

The complete OpenAPI 3.1 specification is available:

- **JSON**: [openapi.json](https://raw.githubusercontent.com/stoa-platform/stoa/main/apis/control-plane-api/openapi.json)
- **Swagger UI**: `${STOA_API_URL}/docs`
- **ReDoc**: `${STOA_API_URL}/redoc`

Import into your favorite API client (Postman, Insomnia, Bruno):

```bash
# Download spec
curl -o openapi.json https://raw.githubusercontent.com/stoa-platform/stoa/main/apis/control-plane-api/openapi.json
```

## Base URL

```
${STOA_API_URL}/v1
```

:::tip Configure your environment
```bash
export STOA_API_URL="https://api.gostoa.dev"   # Replace with your domain
export STOA_AUTH_URL="https://auth.gostoa.dev"  # Keycloak OIDC provider
```
Self-hosted? Replace `gostoa.dev` with your domain.
:::

## Authentication

All API requests require authentication:

```bash
Authorization: Bearer <access_token>
```

Get access token from Keycloak:

```bash
curl -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token \
  -d "client_id=control-plane-api" \
  -d "client_secret=${STOA_CLIENT_SECRET}" \
  -d "grant_type=client_credentials"
```

## Tenants

### Create Tenant

```http
POST /tenants
Content-Type: application/json

{
  "name": "acme",
  "display_name": "ACME Corp",
  "description": "Payments team",
  "owner_email": "owner@example.com"
}
```

`name`, `display_name` and `owner_email` are required. The tenant identifier is derived from `name` (lower-cased, spaces replaced by hyphens). Provisioning runs asynchronously: poll `GET /tenants/{tenant_id}/provisioning-status`.

**Response:**

```json
{
  "id": "acme",
  "name": "acme",
  "display_name": "ACME Corp",
  "owner_email": "owner@example.com",
  "status": "active",
  "provisioning_status": "pending",
  "created_at": "2025-01-09T10:00:00Z"
}
```

### List Tenants

```http
GET /tenants
```

Returns a plain JSON array, without pagination. Platform admins see every tenant; other users only see their own tenant.

### Get Tenant

```http
GET /tenants/{tenant_id}
```

### Update Tenant

```http
PUT /tenants/{tenant_id}
Content-Type: application/json

{
  "display_name": "ACME Corporation",
  "description": "Payments and billing teams",
  "max_apis": 20
}
```

All fields are optional (`display_name`, `description`, `owner_email`, `max_apis`, `max_applications`); omitted fields are left unchanged.

### Delete Tenant

```http
DELETE /tenants/{tenant_id}
```

## APIs

### Register API

```http
POST /tenants/{tenant_id}/apis
Content-Type: application/json

{
  "name": "payment-api",
  "display_name": "Payment API",
  "description": "Payment processing API",
  "backend_url": "https://payments.internal.example.com",
  "version": "1.0.0",
  "tags": ["payments"]
}
```

`name`, `display_name` and `backend_url` are required. `version` defaults to `1.0.0`; `openapi_spec` optionally carries the OpenAPI document as a string. The API identifier is derived from `name`.

**Response:**

```json
{
  "id": "payment-api",
  "tenant_id": "acme",
  "name": "payment-api",
  "display_name": "Payment API",
  "version": "1.0.0",
  "backend_url": "https://payments.internal.example.com",
  "status": "draft",
  "created_at": "2025-01-09T10:15:00Z"
}
```

### List APIs

```http
GET /tenants/{tenant_id}/apis?page=1&page_size=20
```

Optional `environment` filter (`dev`, `staging` or `prod`). The response is a page envelope with `items`, `total`, `page` and `page_size`.

### Get API

```http
GET /tenants/{tenant_id}/apis/{api_id}
```

### Update API

```http
PUT /tenants/{tenant_id}/apis/{api_id}
Content-Type: application/json

{
  "description": "Payment processing API (new backend)",
  "backend_url": "https://payments-v2.internal.example.com"
}
```

Only the provided fields are updated (`display_name`, `version`, `description`, `backend_url`, `openapi_spec`, `tags`).

### Delete API

```http
DELETE /tenants/{tenant_id}/apis/{api_id}
```

## Subscriptions

Subscriptions are a top-level resource under `/subscriptions`; they are not nested under the tenant.

### Create Subscription

```http
POST /subscriptions
Content-Type: application/json

{
  "application_id": "app-123",
  "application_name": "Mobile App",
  "api_id": "payment-api",
  "api_name": "Payment API",
  "api_version": "1.0.0",
  "tenant_id": "acme",
  "plan_id": "basic",
  "plan_name": "Basic Plan"
}
```

Returns `201 Created`. All fields except `plan_id` and `plan_name` are required. The subscription starts in `pending` status until a tenant admin approves it; access uses the application's OAuth2 client credentials, no API key is issued.

**Response (abridged):**

```json
{
  "id": "0f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f",
  "application_id": "app-123",
  "api_id": "payment-api",
  "tenant_id": "acme",
  "status": "pending",
  "created_at": "2025-01-09T10:30:00Z"
}
```

### List Subscriptions

```http
GET /subscriptions/tenant/{tenant_id}?status=pending&page=1&page_size=20
```

Lists a tenant's subscriptions (tenant admins). `status` and `environment` filters are optional; the response is paginated (`items`, `total`, `page`, `page_size`, `total_pages`). Use `GET /subscriptions/my` for the calling user's own subscriptions.

### Get Subscription

```http
GET /subscriptions/{subscription_id}
```

### Approve Subscription

```http
POST /subscriptions/{subscription_id}/approve
Content-Type: application/json

{
  "expires_at": "2025-12-31T23:59:59Z"
}
```

`expires_at` is optional. Requires the tenant admin or platform admin role.

### Revoke Subscription

```http
POST /subscriptions/{subscription_id}/revoke
Content-Type: application/json

{
  "reason": "Violation of terms of service"
}
```

`reason` is required. A subscriber cancels their own subscription with `DELETE /subscriptions/{subscription_id}` (returns `204`).

## API Keys

### List API Keys

```http
GET /tenants/{tenant_id}/apikeys
```

### Create API Key

```http
POST /tenants/{tenant_id}/apikeys
Content-Type: application/json

{
  "subscription_id": "sub-12345",
  "name": "Production Key",
  "expires_at": "2026-01-09T00:00:00Z"
}
```

### Rotate API Key

```http
POST /tenants/{tenant_id}/apikeys/{key_id}/rotate
```

### Revoke API Key

```http
DELETE /tenants/{tenant_id}/apikeys/{key_id}
```

## Metrics

### Get Tenant Metrics

```http
GET /tenants/{tenant_id}/metrics
  ?start_date=2025-01-01
  &end_date=2025-01-31
  &granularity=day
```

**Response:**

```json
{
  "metrics": [
    {
      "date": "2025-01-09",
      "requests": 45231,
      "errors": 23,
      "p50_latency_ms": 87,
      "p95_latency_ms": 234,
      "p99_latency_ms": 456
    }
  ]
}
```

### Get API Metrics

```http
GET /tenants/{tenant_id}/apis/{api_id}/metrics
```

### Get Subscription Usage

```http
GET /tenants/{tenant_id}/subscriptions/{subscription_id}/usage
```

## Webhooks

### Create Webhook

```http
POST /tenants/{tenant_id}/webhooks
Content-Type: application/json

{
  "url": "https://myapp.com/webhooks/stoa",
  "events": [
    "subscription.created",
    "subscription.approved"
  ],
  "secret": "whsec_abc123"
}
```

### List Webhooks

```http
GET /tenants/{tenant_id}/webhooks
```

### Delete Webhook

```http
DELETE /tenants/{tenant_id}/webhooks/{webhook_id}
```

## Error Responses

Standard error format:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "tier",
        "message": "Invalid tier value"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `validation_error` | 400 | Invalid request data |
| `unauthorized` | 401 | Missing or invalid token |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `conflict` | 409 | Resource already exists |
| `rate_limited` | 429 | Too many requests |
| `internal_error` | 500 | Server error |

## Rate Limits

Control Plane API has rate limits:

- **Free tier**: 100 requests/hour
- **Starter**: 1,000 requests/hour
- **Business**: 10,000 requests/hour
- **Enterprise**: Custom

Headers included in response:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1673276400
```

---

🚧 **Coming Soon**: WebSocket API and Bulk operations.
