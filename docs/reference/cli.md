---
sidebar_position: 2
title: "CLI Reference"
description: "STOA CLI reference — command-line interface for managing APIs, tenants, and gateway operations (planned Q3 2026)."
keywords: [CLI, command line, stoactl, reference]
---

# CLI Reference

:::caution Coming Soon — Q3 2026
The `stoa` CLI is not yet available. This page documents the **planned** interface. Use the [REST API](/docs/api/control-plane) for now.
:::

Command-line interface reference for STOA Platform.

## Installation

```bash
# Install via Homebrew (macOS/Linux)
brew install stoa-platform/tap/stoa

# Install via Homebrew (macOS/Linux)
brew install stoa-platform/tap/stoactl

# Install via npm
npm install -g @stoa-platform/cli
```

## Authentication

```bash
# Login to STOA
stoa login

# Login with specific realm
stoa login --realm acme

# Set API endpoint
stoa config set api-url https://api.gostoa.dev

# View current config
stoa config view
```

## Global Flags

All commands support these flags:

```bash
--api-url string       API endpoint URL
--token string         Authentication token
--tenant string        Tenant context
--output string        Output format: json, yaml, table (default: table)
--verbose             Enable verbose logging
--quiet               Suppress non-essential output
```

## Tenant Commands

### `stoa tenant`

Manage tenants.

```bash
# Create tenant
stoa tenant create \
  --name acme \
  --tier starter \
  --admin-email admin@acme.com \
  --region us-east-1

# List tenants
stoa tenant list

# Get tenant details
stoa tenant get acme

# Update tenant
stoa tenant update acme \
  --tier business

# Delete tenant
stoa tenant delete acme

# Get tenant status
stoa tenant status acme
```

## API Commands

### `stoa api`

Manage APIs.

```bash
# Register API
stoa api register \
  --tenant acme \
  --name payment-api \
  --upstream https://api.payments.example.com \
  --path /payments \
  --version v1

# List APIs
stoa api list --tenant acme

# Get API details
stoa api get --tenant acme --name payment-api

# Update API
stoa api update \
  --tenant acme \
  --name payment-api \
  --rate-limit 2000

# Delete API
stoa api delete --tenant acme --name payment-api

# Test API
stoa api test \
  --tenant acme \
  --name payment-api \
  --endpoint /health
```

### API Policy Commands

```bash
# Add rate limiting
stoa api policy add-rate-limit \
  --tenant acme \
  --api payment-api \
  --requests 1000 \
  --period hour

# Add CORS
stoa api policy add-cors \
  --tenant acme \
  --api payment-api \
  --origins "*"

# Add caching
stoa api policy add-cache \
  --tenant acme \
  --api payment-api \
  --ttl 300

# List policies
stoa api policy list \
  --tenant acme \
  --api payment-api

# Remove policy
stoa api policy remove \
  --tenant acme \
  --api payment-api \
  --name rate-limiting
```

## Subscription Commands

### `stoa subscription`

Manage API subscriptions.

```bash
# Create subscription
stoa subscription create \
  --tenant acme \
  --api payment-api \
  --plan standard \
  --app my-mobile-app

# List subscriptions
stoa subscription list --tenant acme

# Get subscription details
stoa subscription get --subscription-id sub-12345

# Approve subscription
stoa subscription approve \
  --subscription-id sub-12345 \
  --rate-limit 1000

# Reject subscription
stoa subscription reject \
  --subscription-id sub-12345 \
  --reason "Invalid use case"

# Cancel subscription
stoa subscription cancel --subscription-id sub-12345

# View usage
stoa subscription usage \
  --subscription-id sub-12345 \
  --period last-30-days
```

## API Key Commands

### `stoa apikey`

Manage API keys.

```bash
# List API keys
stoa apikey list --tenant acme

# Create API key
stoa apikey create \
  --subscription-id sub-12345 \
  --name "Production Key" \
  --expires 2026-01-01

# Rotate API key
stoa apikey rotate --key-id key-abc123

# Revoke API key
stoa apikey revoke --key-id key-abc123

# Show API key
stoa apikey show --key-id key-abc123
```

## Authentication Commands

### `stoa auth`

Manage authentication settings.

```bash
# Configure API authentication
stoa auth configure \
  --tenant acme \
  --api payment-api \
  --provider keycloak \
  --issuer https://auth.gostoa.dev/realms/acme

# Create role
stoa auth role create \
  --tenant acme \
  --name api-admin \
  --description "API Administrator"

# Assign role
stoa auth role assign \
  --tenant acme \
  --user user@example.com \
  --role api-admin

# List roles
stoa auth role list --tenant acme

# Test authentication
stoa auth test-connection --tenant acme

# Inspect token
stoa auth token inspect <token>
```

## MCP Commands

### `stoa mcp`

Manage MCP tools and resources.

```bash
# Register MCP server
stoa mcp register \
  --tenant acme \
  --name customer-tools \
  --url https://tools.acme.com/mcp \
  --transport http

# List MCP servers
stoa mcp list --tenant acme

# List available tools
stoa mcp tools list --tenant acme

# Invoke tool
stoa mcp tools invoke \
  --tenant acme \
  --tool search_database \
  --args '{"query":"customer@example.com"}'

# List resources
stoa mcp resources list --tenant acme

# Read resource
stoa mcp resources read \
  --tenant acme \
  --uri "customer://db/customers/123"

# Grant tool permission
stoa mcp permission grant \
  --tenant acme \
  --tool search_database \
  --role customer-service

# View metrics
stoa mcp metrics --tenant acme
```

## Metrics Commands

### `stoa metrics`

View metrics and analytics.

```bash
# Get tenant metrics
stoa metrics tenant \
  --tenant acme \
  --start 2025-01-01 \
  --end 2025-01-31 \
  --granularity day

# Get API metrics
stoa metrics api \
  --tenant acme \
  --api payment-api \
  --period last-7-days

# Export metrics
stoa metrics export \
  --tenant acme \
  --format csv \
  --output metrics.csv

# Live metrics
stoa metrics watch --tenant acme
```

## Log Commands

### `stoa logs`

View logs.

```bash
# Stream tenant logs
stoa logs --tenant acme --follow

# Filter by API
stoa logs --tenant acme --api payment-api

# Filter by level
stoa logs --tenant acme --level error

# Show last N lines
stoa logs --tenant acme --tail 100

# Time range
stoa logs \
  --tenant acme \
  --since "2025-01-09T10:00:00Z" \
  --until "2025-01-09T11:00:00Z"
```

## Configuration Commands

### `stoa config`

Manage CLI configuration.

```bash
# View config
stoa config view

# Set value
stoa config set api-url https://api.gostoa.dev
stoa config set default-tenant acme

# Get value
stoa config get api-url

# List all settings
stoa config list

# Reset to defaults
stoa config reset
```

## Portal Commands

### `stoa portal`

Manage developer portal.

```bash
# Configure portal
stoa portal configure \
  --tenant acme \
  --logo https://acme.com/logo.png \
  --primary-color "#4F46E5"

# Add custom domain
stoa portal domain add \
  --tenant acme \
  --domain portal.acme.com

# Enable/disable portal
stoa portal enable --tenant acme
stoa portal disable --tenant acme

# Get portal URL
stoa portal url --tenant acme
```

## Utility Commands

### `stoa version`

Show version information.

```bash
stoa version
```

### `stoa completion`

Generate shell completion scripts.

```bash
# Bash
stoa completion bash > /etc/bash_completion.d/stoa

# Zsh
stoa completion zsh > /usr/local/share/zsh/site-functions/_stoa

# Fish
stoa completion fish > ~/.config/fish/completions/stoa.fish

# PowerShell
stoa completion powershell > stoa.ps1
```

### `stoa help`

Get help for any command.

```bash
stoa help
stoa help tenant
stoa help api register
```

## Examples

### End-to-End Workflow

```bash
# 1. Login
stoa login

# 2. Create tenant
stoa tenant create \
  --name acme \
  --tier starter \
  --admin-email admin@acme.com

# 3. Register API
stoa api register \
  --tenant acme \
  --name payment-api \
  --upstream https://api.payments.example.com \
  --path /payments

# 4. Enable authentication
stoa auth configure \
  --tenant acme \
  --api payment-api \
  --provider keycloak

# 5. Create subscription
stoa subscription create \
  --tenant acme \
  --api payment-api \
  --plan standard

# 6. Test API
stoa api test \
  --tenant acme \
  --api payment-api \
  --endpoint /health

# 7. Monitor
stoa metrics watch --tenant acme
```

---

🚧 **Coming Soon**: CI/CD integration commands, import/export utilities, and backup/restore commands.
