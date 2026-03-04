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

## Webhook Management

Manage webhook endpoints for event-driven integrations between STOA and external systems.

### Creating a Webhook

1. Navigate to **Webhooks** in the Console sidebar
2. Click **Create Webhook**
3. Enter the target URL (HTTPS required in production)
4. Select event types to subscribe to
5. Enter a signing secret (minimum 32 characters)
6. Click **Save**

### Delivery History

View the delivery status of each webhook event:

| Status | Badge | Meaning |
|--------|-------|---------|
| `success` | Green | Endpoint returned 2xx |
| `pending` | Yellow | Delivery in progress or scheduled retry |
| `failed` | Red | All retry attempts exhausted |

Click a delivery to see full request/response details including headers and body.

### Testing & Retry

- Click **Test** on any webhook to send a synthetic event (payload includes `"test": true`)
- Click **Retry** on a failed delivery to re-send immediately

See [Webhooks](/docs/guides/webhooks) for the webhook API reference and signature verification examples.

## Credential Mappings

Map consumer credentials to backend authentication schemes. This enables the gateway to translate consumer API keys into backend-specific authentication without exposing internal credentials.

### Supported Auth Types

| Type | Use Case |
|------|----------|
| `api_key` | Backend expects an API key in header or query param |
| `bearer` | Backend expects a Bearer token |
| `basic` | Backend expects Basic auth (username:password) |

### Creating a Mapping

1. Navigate to **Credentials** in the Console sidebar
2. Click **Create Mapping**
3. Select the auth type
4. Configure source (consumer credential) and target (backend credential)
5. Click **Save**

### Managing Mappings

- **Edit**: Update target credentials when backend rotates keys
- **Delete**: Remove the mapping (consumers lose backend access)
- **Test**: Verify the mapping works with a dry-run request

## Contracts / UAC Management

Universal API Contracts (UAC) define multi-protocol API bindings — the foundation of STOA's "Define Once, Expose Everywhere" approach.

### Contract List

View all contracts with their protocol bindings and status:

| Column | Description |
|--------|-------------|
| Name | Contract display name |
| Protocols | Active bindings (REST, MCP, GraphQL, gRPC, Kafka) |
| Status | Draft, Published, Deprecated |
| APIs bound | Number of APIs using this contract |

### Creating a Contract

1. Navigate to **Contracts** in the Console sidebar
2. Click **Create Contract**
3. Enter name, description, and version
4. Add protocol bindings:
   - **REST**: OpenAPI spec URL or upload
   - **MCP**: Tool definitions and capabilities
   - **GraphQL**: Schema definition
   - **gRPC**: Proto file upload
   - **Kafka**: Topic and schema registry config
5. Click **Save as Draft** or **Publish**

### Contract Detail

View and manage a single contract:

- **Bindings**: Add, edit, or remove protocol bindings
- **History**: Version history with diff viewer
- **Consumers**: APIs and subscriptions using this contract

See [UAC Concepts](/docs/concepts/uac) for the architectural rationale.

## RBAC Visibility

| Feature | cpi-admin | tenant-admin | devops | viewer |
|---------|-----------|-------------|--------|--------|
| Tenant Dashboard | All tenants | Own tenant | Own tenant | Own tenant |
| Operations Dashboard | Yes | No | No | No |
| Gateway Management | Yes | No | No | No |
| Webhooks | All tenants | Own tenant | No | No |
| Credential Mappings | All tenants | Own tenant | No | No |
| Contracts / UAC | All tenants | Own tenant | Own tenant (read) | Own tenant (read) |
| Error Snapshots | All tenants | Own tenant | Own tenant | Own tenant (read) |
| Request Explorer | All tenants | Own tenant | Own tenant | No |

## Related

- [Console Guide](/docs/guides/console) -- Basic Console usage
- [Gateway Modes](/docs/guides/gateway-modes) -- Mode configuration
- [Monitoring](/docs/admin/monitoring) -- Prometheus and Grafana setup
- [Multi-Gateway Setup](/docs/guides/multi-gateway-setup) -- Adapter orchestration
