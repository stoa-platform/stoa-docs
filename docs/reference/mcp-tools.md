---
sidebar_position: 4
title: MCP Tools Reference
description: Complete reference for STOA Platform MCP tools
---

# MCP Tools Reference

STOA exposes platform capabilities as MCP tools that AI agents can discover and invoke. This reference documents all built-in tools.

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| Platform & Discovery | `stoa_platform_info`, `stoa_platform_health`, `stoa_tools` | Platform status and tool discovery |
| API Catalog | `stoa_catalog`, `stoa_api_spec` | Browse and search APIs |
| Subscriptions | `stoa_subscription` | Manage API access and credentials |
| Observability | `stoa_metrics`, `stoa_logs`, `stoa_alerts` | Monitor API usage and health |
| UAC Contracts | `stoa_uac` | Universal API Contract management |
| Security | `stoa_security` | Audit logs and permissions |

---

## Platform & Discovery

### stoa_platform_info

Get STOA platform version, status, and available features.

```json
// Request
{"name": "stoa_platform_info", "arguments": {}}

// Response
{
  "version": "0.9.0",
  "status": "healthy",
  "features": ["mcp-gateway", "uac", "multi-tenant"],
  "mcp_protocol_version": "2024-11-05"
}
```

### stoa_platform_health

Health check all platform components.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `components` | string[] | No | Specific components to check (all if empty) |

```json
// Request
{"name": "stoa_platform_health", "arguments": {"components": ["gateway", "database"]}}

// Response
{
  "gateway": {"status": "healthy", "latency_ms": 12},
  "database": {"status": "healthy", "latency_ms": 8},
  "overall": "healthy"
}
```

### stoa_tools

Tool discovery and schema retrieval.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `list`, `schema`, or `search` |
| `tool_name` | string | For `schema` | Tool name to get schema for |
| `query` | string | For `search` | Search query |
| `category` | string | No | Filter by category |

```json
// List all tools
{"name": "stoa_tools", "arguments": {"action": "list", "category": "API Catalog"}}

// Get tool schema
{"name": "stoa_tools", "arguments": {"action": "schema", "tool_name": "stoa_catalog"}}

// Search tools
{"name": "stoa_tools", "arguments": {"action": "search", "query": "subscription"}}
```

---

## API Catalog

### stoa_catalog

Browse, search, and manage APIs in the catalog.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `list`, `get`, `search`, `versions`, `categories` |
| `api_id` | string | For `get`, `versions` | API identifier |
| `query` | string | For `search` | Search query |
| `status` | string | No | Filter: `active`, `deprecated`, `draft` |
| `tags` | string[] | No | Filter by tags |
| `page` | integer | No | Page number (default: 1) |
| `page_size` | integer | No | Results per page (default: 20) |

```json
// List active APIs
{"name": "stoa_catalog", "arguments": {"action": "list", "status": "active"}}

// Get API details
{"name": "stoa_catalog", "arguments": {"action": "get", "api_id": "billing-api-v2"}}

// Search APIs
{"name": "stoa_catalog", "arguments": {"action": "search", "query": "payment", "tags": ["finance"]}}

// List API versions
{"name": "stoa_catalog", "arguments": {"action": "versions", "api_id": "billing-api"}}

// List categories
{"name": "stoa_catalog", "arguments": {"action": "categories"}}
```

### stoa_api_spec

Retrieve API specifications and documentation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `openapi`, `docs`, `endpoints` |
| `api_id` | string | Yes | API identifier |
| `format` | string | No | `json` or `yaml` (default: json) |
| `version` | string | No | API version (latest if omitted) |
| `section` | string | No | Doc section for `docs` action |
| `method` | string | No | Filter endpoints by HTTP method |

```json
// Get OpenAPI spec
{"name": "stoa_api_spec", "arguments": {"action": "openapi", "api_id": "billing-api", "format": "yaml"}}

// Get documentation
{"name": "stoa_api_spec", "arguments": {"action": "docs", "api_id": "billing-api", "section": "authentication"}}

// List endpoints
{"name": "stoa_api_spec", "arguments": {"action": "endpoints", "api_id": "billing-api", "method": "POST"}}
```

---

## Subscriptions & Access

### stoa_subscription

Manage API subscriptions, credentials, and lifecycle.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `list`, `get`, `create`, `cancel`, `credentials`, `rotate_key` |
| `subscription_id` | string | For `get`, `cancel`, `credentials`, `rotate_key` | Subscription ID |
| `api_id` | string | For `create` | API to subscribe to |
| `plan` | string | No | Subscription plan |
| `reason` | string | No | Cancellation reason |
| `grace_period_hours` | integer | No | Hours to keep old key valid (default: 24) |

```json
// List subscriptions
{"name": "stoa_subscription", "arguments": {"action": "list", "status": "active"}}

// Subscribe to an API
{"name": "stoa_subscription", "arguments": {"action": "create", "api_id": "billing-api", "plan": "standard"}}

// Get credentials
{"name": "stoa_subscription", "arguments": {"action": "credentials", "subscription_id": "sub-123"}}

// Rotate API key
{"name": "stoa_subscription", "arguments": {"action": "rotate_key", "subscription_id": "sub-123", "grace_period_hours": 48}}

// Cancel subscription
{"name": "stoa_subscription", "arguments": {"action": "cancel", "subscription_id": "sub-123", "reason": "Migrating to v2"}}
```

---

## Observability & Metrics

### stoa_metrics

Retrieve API usage, latency, errors, and quota metrics.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `usage`, `latency`, `errors`, `quota` |
| `api_id` | string | For `usage`, `latency`, `errors` | API identifier |
| `subscription_id` | string | For `quota` | Subscription ID |
| `time_range` | string | No | `1h`, `24h`, `7d`, `30d`, `custom` |
| `endpoint` | string | No | Specific endpoint for latency |

```json
// Get usage metrics
{"name": "stoa_metrics", "arguments": {"action": "usage", "api_id": "billing-api", "time_range": "24h"}}

// Get latency stats (p50, p95, p99)
{"name": "stoa_metrics", "arguments": {"action": "latency", "api_id": "billing-api", "endpoint": "/invoices"}}

// Get error breakdown
{"name": "stoa_metrics", "arguments": {"action": "errors", "api_id": "billing-api", "error_code": 500}}

// Check quota usage
{"name": "stoa_metrics", "arguments": {"action": "quota", "subscription_id": "sub-123"}}
```

### stoa_logs

Search and retrieve API call logs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `search`, `recent` |
| `api_id` | string | No | API identifier |
| `query` | string | For `search` | Lucene query syntax |
| `level` | string | No | `debug`, `info`, `warn`, `error` |
| `time_range` | string | No | `1h`, `24h`, `7d` |
| `limit` | integer | No | Max results (default: 100) |

```json
// Search error logs
{"name": "stoa_logs", "arguments": {"action": "search", "api_id": "billing-api", "query": "timeout", "level": "error"}}

// Get recent logs
{"name": "stoa_logs", "arguments": {"action": "recent", "api_id": "billing-api", "limit": 50}}
```

### stoa_alerts

Manage API alerts and incidents.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `list`, `acknowledge` |
| `alert_id` | string | For `acknowledge` | Alert ID |
| `api_id` | string | No | Filter by API |
| `severity` | string | No | `info`, `warning`, `critical` |
| `status` | string | No | `active`, `acknowledged`, `resolved` |
| `comment` | string | No | Acknowledgement comment |

```json
// List critical alerts
{"name": "stoa_alerts", "arguments": {"action": "list", "severity": "critical", "status": "active"}}

// Acknowledge alert
{"name": "stoa_alerts", "arguments": {"action": "acknowledge", "alert_id": "alert-123", "comment": "Investigating root cause"}}
```

---

## UAC Contracts

### stoa_uac

Universal API Contract management.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `list`, `get`, `validate`, `sla` |
| `contract_id` | string | For `get`, `validate`, `sla` | Contract ID |
| `api_id` | string | No | Filter by API |
| `subscription_id` | string | For `validate` | Subscription to validate |
| `status` | string | No | `active`, `expired`, `pending` |
| `time_range` | string | No | For SLA metrics: `7d`, `30d`, `90d` |

```json
// List active contracts
{"name": "stoa_uac", "arguments": {"action": "list", "api_id": "billing-api", "status": "active"}}

// Get contract details
{"name": "stoa_uac", "arguments": {"action": "get", "contract_id": "uac-123"}}

// Validate compliance
{"name": "stoa_uac", "arguments": {"action": "validate", "contract_id": "uac-123", "subscription_id": "sub-456"}}

// Get SLA metrics
{"name": "stoa_uac", "arguments": {"action": "sla", "contract_id": "uac-123", "time_range": "30d"}}
```

---

## Security & Compliance

### stoa_security

Security audit and permission management.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | `audit_log`, `check_permissions`, `list_policies` |
| `api_id` | string | No | API identifier |
| `action_type` | string | For `check_permissions` | `read`, `write`, `admin` |
| `policy_type` | string | No | `rate_limit`, `ip_whitelist`, `oauth`, `jwt` |
| `time_range` | string | No | `24h`, `7d`, `30d`, `90d` |
| `limit` | integer | No | Max audit entries (default: 100) |

```json
// Get audit log
{"name": "stoa_security", "arguments": {"action": "audit_log", "api_id": "billing-api", "time_range": "7d"}}

// Check permissions
{"name": "stoa_security", "arguments": {"action": "check_permissions", "api_id": "billing-api", "action_type": "write"}}

// List security policies
{"name": "stoa_security", "arguments": {"action": "list_policies", "policy_type": "rate_limit"}}
```

---

## Error Handling

All tools return errors in a consistent format:

```json
{
  "error": {
    "code": "SUBSCRIPTION_NOT_FOUND",
    "message": "No active subscription found for api_id: billing-api",
    "details": {
      "api_id": "billing-api",
      "tenant": "acme"
    }
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or missing authentication |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `SUBSCRIPTION_NOT_FOUND` | No active subscription |
| `QUOTA_EXCEEDED` | Rate limit or quota exceeded |
| `VALIDATION_ERROR` | Invalid request parameters |
| `INTERNAL_ERROR` | Server-side error |

---

## Tenant-Specific Tools

Beyond platform tools, each tenant can register custom MCP tools for their APIs. These appear with a prefix:

```
{tenant}__{api-name}__{tool-name}
```

Example for the OASIS gaming tenant:
- `oasis__Avatar-API__search-players`
- `oasis__Economy-API__transfer-coins`
- `oasis__Quests-API__create-quest`

Use `stoa_tools` with `action: list` to discover available tenant tools.
