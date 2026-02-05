---
sidebar_position: 1
---

# Control Plane API

REST API reference for STOA Control Plane.

## OpenAPI Specification

The complete OpenAPI 3.1 specification is available:

- **JSON**: [openapi.json](https://raw.githubusercontent.com/stoa-platform/stoa/main/apis/control-plane-api/openapi.json)
- **Swagger UI**: `https://api.gostoa.dev/docs`
- **ReDoc**: `https://api.gostoa.dev/redoc`

Import into your favorite API client (Postman, Insomnia, Bruno):

```bash
# Download spec
curl -o openapi.json https://raw.githubusercontent.com/stoa-platform/stoa/main/apis/control-plane-api/openapi.json
```

## Base URL

```
https://api.gostoa.dev/v1
```

## Authentication

All API requests require authentication:

```bash
Authorization: Bearer <access_token>
```

Get access token from Keycloak:

```bash
curl -X POST https://auth.gostoa.dev/realms/stoa/protocol/openid-connect/token \
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
  "tier": "starter",
  "admin_email": "admin@acme.com",
  "region": "us-east-1"
}
```

**Response:**

```json
{
  "id": "ten-abc123",
  "name": "acme",
  "tier": "starter",
  "status": "provisioning",
  "gateway_url": "https://gateway.gostoa.dev/acme",
  "created_at": "2025-01-09T10:00:00Z"
}
```

### List Tenants

```http
GET /tenants?page=1&limit=20
```

### Get Tenant

```http
GET /tenants/{tenant_id}
```

### Update Tenant

```http
PATCH /tenants/{tenant_id}
Content-Type: application/json

{
  "tier": "business",
  "settings": {
    "rate_limit_multiplier": 2.0
  }
}
```

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
  "description": "Payment processing API",
  "upstream_url": "https://api.payments.example.com",
  "path": "/payments",
  "version": "v1",
  "auth_required": true,
  "rate_limit": {
    "requests_per_hour": 1000
  }
}
```

**Response:**

```json
{
  "id": "api-xyz789",
  "name": "payment-api",
  "public_url": "https://gateway.gostoa.dev/acme/payments",
  "status": "active",
  "created_at": "2025-01-09T10:15:00Z"
}
```

### List APIs

```http
GET /tenants/{tenant_id}/apis
```

### Get API

```http
GET /tenants/{tenant_id}/apis/{api_id}
```

### Update API

```http
PATCH /tenants/{tenant_id}/apis/{api_id}
Content-Type: application/json

{
  "rate_limit": {
    "requests_per_hour": 2000
  }
}
```

### Delete API

```http
DELETE /tenants/{tenant_id}/apis/{api_id}
```

## Subscriptions

### Create Subscription

```http
POST /tenants/{tenant_id}/subscriptions
Content-Type: application/json

{
  "api_id": "api-xyz789",
  "plan": "standard",
  "application": "mobile-app",
  "callback_url": "https://myapp.com/webhook"
}
```

**Response:**

```json
{
  "id": "sub-12345",
  "api_id": "api-xyz789",
  "status": "pending_approval",
  "api_key": null,
  "created_at": "2025-01-09T10:30:00Z"
}
```

### List Subscriptions

```http
GET /tenants/{tenant_id}/subscriptions
```

### Get Subscription

```http
GET /tenants/{tenant_id}/subscriptions/{subscription_id}
```

### Approve Subscription

```http
POST /tenants/{tenant_id}/subscriptions/{subscription_id}/approve
Content-Type: application/json

{
  "rate_limit": 1000,
  "quota": 50000
}
```

### Revoke Subscription

```http
DELETE /tenants/{tenant_id}/subscriptions/{subscription_id}
```

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
