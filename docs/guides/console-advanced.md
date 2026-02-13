---
sidebar_position: 20
title: "Console Advanced Features"
description: "Advanced Console features — tenant dashboard, operations monitoring, gateway management, error snapshots, and API discovery."
keywords:
  - console
  - dashboard
  - operations
  - gateway management
  - monitoring
---

# Console Advanced Features

Beyond basic API and tenant management, the Console provides dashboards and operational tools for platform administrators.

## Tenant Dashboard

Each tenant has a dedicated dashboard showing real-time metrics sourced from Prometheus.

### Metrics Displayed

| Metric | Source | Description |
|--------|--------|-------------|
| Request rate | `stoa_http_requests_total` | Requests per second |
| Error rate | `stoa_http_requests_total{status=~"5.."}` | 5xx errors per second |
| P95 latency | `stoa_http_request_duration_seconds` | 95th percentile response time |
| Active subscriptions | Control Plane API | Count of approved subscriptions |
| Published APIs | Control Plane API | Count of APIs in catalog |

### Time Range

Select from 1h, 6h, or 24h ranges. Data refreshes automatically every 15 seconds.

### Accessing

Navigate to **Tenants** in the sidebar, select a tenant, then click **Dashboard**.

## Operations Dashboard

Platform-wide operational view available to `cpi-admin` users.

### Overview Cards

| Card | Thresholds |
|------|-----------|
| Error rate | Good: 0-1%, Warning: 1-5%, Critical: above 5% |
| P95 latency | Good: 0-500ms, Warning: 500ms-2s, Critical: above 2s |
| Requests/min | Informational (no threshold) |
| Active alerts | Count from Alertmanager |
| Uptime | Percentage over selected window |

### Recent Deployments

Shows the latest deployments across all components with:

- Component name and version
- Deployment timestamp
- Sync status (for ArgoCD-managed components)
- Health status

### Accessing

Navigate to **Operations** in the sidebar (visible to `cpi-admin` only).

## Gateway Management

### Gateway List

View all registered gateway instances with their status:

| Column | Description |
|--------|-------------|
| Name | Gateway display name |
| Type | `stoa`, `kong`, `gravitee`, `webmethods` |
| Status | `online`, `offline`, `degraded` |
| APIs synced | Number of APIs deployed to this gateway |
| Last health check | Timestamp of last successful check |

### Gateway Registration

Register a new gateway instance:

1. Navigate to **Gateways** in the sidebar
2. Click **Register Gateway**
3. Select the gateway type
4. Enter the base URL and admin credentials
5. Click **Test Connection** to verify
6. Click **Register**

The gateway appears in the list after a successful health check.

### Gateway Modes

For STOA Gateway instances, view and manage the active mode:

- **Edge MCP** — Production mode with full MCP protocol support
- **Sidecar** — Policy enforcement alongside existing gateways
- **Proxy** — API transformation and routing
- **Shadow** — Traffic observation for API discovery

See [Gateway Modes](/docs/guides/gateway-modes) for configuration details.

## Error Snapshots

Capture and analyze API errors for debugging.

### What's Captured

When an API returns an error (4xx or 5xx), the Console can capture:

- Request method, path, and headers
- Response status code and body
- Upstream response time
- Tenant and API context

### Viewing Snapshots

1. Navigate to **Error Snapshots** in the sidebar
2. Filter by API, status code, or time range
3. Click a snapshot to see full request/response details

### Retention

Error snapshots are stored for 7 days by default. Adjust retention in the platform configuration.

## API Discovery (Shadow Mode)

When a STOA Gateway runs in Shadow mode, it passively observes API traffic and discovers undocumented endpoints.

### Discovery Audit

The **Shadow Discovery** page shows:

- Discovered endpoints not yet in the API catalog
- Traffic patterns (method, path, frequency)
- Suggested OpenAPI fragments based on observed payloads
- Recommendations for adding endpoints to the catalog

This is useful for brownfield environments where existing APIs lack documentation.

## Request Explorer

Inspect individual API requests for debugging:

1. Navigate to **Request Explorer** in the sidebar
2. Select an API and time range
3. Browse request/response pairs
4. Filter by status code, latency, or consumer

Available to `cpi-admin` and `tenant-admin` roles.

## Observability Dashboard

The Console embeds Grafana dashboards for deep-dive monitoring:

- Click **Observability** in the sidebar
- Access pre-built STOA dashboards (request rates, latency histograms, error breakdowns)
- Requires Grafana OIDC integration with Keycloak (see [Monitoring](/docs/admin/monitoring))

## RBAC Visibility

| Feature | cpi-admin | tenant-admin | devops | viewer |
|---------|-----------|-------------|--------|--------|
| Tenant Dashboard | All tenants | Own tenant | Own tenant | Own tenant |
| Operations Dashboard | Yes | No | No | No |
| Gateway Management | Yes | No | No | No |
| Error Snapshots | All tenants | Own tenant | Own tenant | Own tenant (read) |
| Request Explorer | All tenants | Own tenant | Own tenant | No |

## Related

- [Console Guide](/docs/guides/console) -- Basic Console usage
- [Gateway Modes](/docs/guides/gateway-modes) -- Mode configuration
- [Monitoring](/docs/admin/monitoring) -- Prometheus and Grafana setup
- [Multi-Gateway Setup](/docs/guides/multi-gateway-setup) -- Adapter orchestration
