---
sidebar_position: 21
title: "Portal Advanced Features"
description: "Advanced Portal features — API testing sandbox, webhook management, service accounts, usage analytics, and workspace settings."
keywords:
  - developer portal
  - API testing
  - sandbox
  - usage analytics
  - workspace
---

# Portal Advanced Features

Beyond API discovery and subscriptions, the Developer Portal provides tools for testing, automation, and usage monitoring.

## API Testing Sandbox

Test API endpoints directly from the Portal without external tools.

### Features

| Feature | Description |
|---------|-------------|
| Method selector | GET, POST, PUT, PATCH, DELETE |
| Path builder | Auto-complete from API spec |
| Header editor | Add custom headers |
| Body editor | JSON editor with syntax highlighting |
| Auth injection | Automatic Bearer token or API key |
| Response viewer | Status, latency, formatted JSON/text |
| Request history | Recent requests for quick replay |

### Using the Sandbox

1. Navigate to an API detail page
2. Click **Try It** or **Sandbox**
3. Select the HTTP method and path
4. Add headers or body as needed
5. Choose the environment (dev, staging, production)
6. Click **Send**

### Environment Selection

The sandbox supports multiple environments:

| Environment | Base URL | Use Case |
|-------------|----------|----------|
| Development | Configured per API | Local testing |
| Staging | Staging gateway URL | Pre-production validation |
| Production | Production gateway URL | Live verification |

Switch environments using the dropdown at the top of the sandbox.

### Authentication

The sandbox automatically injects credentials based on your subscription:

- **Bearer token**: Uses your current session token
- **API key**: Uses the key from your active subscription

:::tip Webhook Management
Webhook management has moved to the **Console**. See [Console Advanced Features](/docs/guides/console-advanced#webhook-management).
:::

## Service Account Management

Create and manage service accounts for M2M API access.

### Creating a Service Account

1. Navigate to **Service Accounts** in the Portal sidebar
2. Click **Create Service Account**
3. Enter a name and optional description
4. Click **Create**
5. **Copy the credentials immediately** — the secret is shown only once

### Available Actions

| Action | Description |
|--------|-------------|
| Create | Generate new client_id + client_secret |
| Delete | Remove account and invalidate all tokens |
| Regenerate secret | New secret, old one invalidated immediately |

Service accounts inherit the RBAC role of the user who created them.

See [Service Accounts](/docs/guides/service-accounts) for usage patterns and CI/CD integration.

## Usage Analytics

Monitor your API consumption from the **Usage** page.

### Metrics Available

| Metric | Description |
|--------|-------------|
| Total requests | Cumulative requests across all subscriptions |
| Requests by API | Per-API breakdown |
| Error rate | Percentage of 4xx/5xx responses |
| Latency distribution | Response time percentiles |
| Quota usage | Current usage vs. rate limit |

### Time Ranges

Select from 24h, 7d, or 30d views to track consumption trends.

## Workspace Settings

Manage your workspace from the **Workspace** page:

- **Profile**: Update display name and contact email
- **Notifications**: Configure email notification preferences
- **API keys**: View and manage active API keys across subscriptions
- **Team members**: Invite collaborators to your workspace (tenant-admin only)

## MCP Server Discovery

Browse available MCP servers and AI tools:

1. Navigate to **Servers** in the Portal sidebar
2. Browse available MCP servers by category
3. View server details: tools offered, authentication requirements, pricing tier
4. Click **Subscribe** to request access to a server's tools

## Related

- [Developer Portal Guide](/docs/guides/portal) -- Basic Portal usage
- [Webhooks](/docs/guides/webhooks) -- Webhook API reference
- [Service Accounts](/docs/guides/service-accounts) -- M2M authentication
- [Subscriptions](/docs/guides/subscriptions) -- Subscription workflow
