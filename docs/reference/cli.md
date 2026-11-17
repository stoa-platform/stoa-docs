---
sidebar_position: 2
title: "CLI Reference (stoactl)"
description: "stoactl CLI reference — kubectl-style command-line interface for managing STOA Platform resources, deploying APIs, and bridging to MCP."
keywords: [CLI, command line, stoactl, reference, deploy, rollback, logs, MCP, bridge, OpenAPI]
---

# CLI Reference (stoactl)

`stoactl` is a kubectl-style CLI for managing STOA Platform resources. It provides API deployment, project scaffolding, API-to-MCP bridging, diagnostics, and resource management.

## Installation

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="macos" label="macOS (Homebrew)">

```bash
brew install stoa-platform/tap/stoactl
```

</TabItem>
<TabItem value="linux" label="Linux">

```bash
curl -sSL https://get.gostoa.dev | sh
```

</TabItem>
<TabItem value="go" label="From source (Go 1.22+)">

```bash
go install github.com/stoa-platform/stoactl@latest
```

</TabItem>
</Tabs>

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `stoactl deploy` | Deploy an API from a stoa.yaml file |
| `stoactl logs` | Show deployment history for an API |
| `stoactl init` | Initialize a new STOA project |
| `stoactl bridge` | Convert OpenAPI spec to MCP Tool CRDs |
| `stoactl doctor` | Run diagnostic checks |
| `stoactl apply` | Create or update a resource from a YAML file |
| `stoactl get` | List resources (apis, tenants, subscriptions, gateways) |
| `stoactl delete` | Delete a resource |
| `stoactl auth` | Authentication commands |
| `stoactl config` | Manage CLI contexts |
| `stoactl token-usage` | View API token usage statistics |
| `stoactl reconcile` | Reconcile UAC contracts from a local governance snapshot |
| `stoactl gateway` | Manage and inspect gateway instances (`gw`, `gateways`) |
| `stoactl mcp` | List MCP servers/tools, invoke tools, and check MCP health |
| `stoactl catalog` | Detect catalog drift or trigger synchronization |
| `stoactl subscription` | List, inspect, approve, or revoke subscriptions (`sub`) |
| `stoactl tenant` | Provision, inspect, list, or delete tenants |
| `stoactl connect` | Inspect `stoa-connect` (STOA Link) agents and discover gateway APIs |
| `stoactl audit` | Export tenant audit logs (`table`, `json`, `yaml`, `csv`) |
| `stoactl completion` | Generate shell completion scripts (`bash`, `zsh`, `fish`) |
| `stoactl version` | Print version information |

### Global Flags

| Flag / Env | Description |
|------------|-------------|
| `--tenant <id>` / `STOACTL_TENANT` | Override the active context's tenant ID for the command |
| `--admin` | Authenticate with the configured service-account token instead of the user OIDC token |
| `--namespace <ns>` / `STOACTL_NAMESPACE` | **Deprecated** global flag (prints a deprecation warning in favor of `--tenant`; `--namespace` / `-n` on `stoactl bridge` remains active for Kubernetes CRD metadata) |

---

## Deployment Commands

### `stoactl deploy`

Deploy an API to a target environment from a [`stoa.yaml`](/docs/reference/stoa-yaml) file, or use sub-commands to manage deployments imperatively.

```bash
stoactl deploy [stoa.yaml] [flags]
stoactl deploy <subcommand>
```

**File-based deploy (recommended):**

```bash
stoactl deploy ./stoa.yaml --env production
stoactl deploy ./api.yaml --env dev --watch
```

**Flags (file-based deploy):**

| Flag | Default | Description |
|------|---------|-------------|
| `--env` | — | Target environment: `dev`, `staging`, `production` (**required**) |
| `--watch`, `-w` | `false` | Poll deployment status until completion (success or failure) |
| `--output`, `-o` | `table` | Output format: `table`, `wide`, `yaml`, `json` |

---

#### `stoactl deploy create`

Create a deployment imperatively (without a stoa.yaml file).

```bash
stoactl deploy create --api-id <id> --env <env> --version <version> [flags]
```

**Flags:**

| Flag | Required | Description |
|------|----------|-------------|
| `--api-id` | **Yes** | API ID to deploy |
| `--env` | **Yes** | Target environment |
| `--version` | **Yes** | Version to deploy (e.g. `2.0.0`) |
| `--gateway` | No | Target gateway ID |
| `--commit` | No | Git commit SHA (for traceability) |
| `--watch`, `-w` | No | Watch deployment until completion |

**Example:**

```bash
stoactl deploy create --api-id customer-api --env production --version 2.0.0 --watch
```

---

#### `stoactl deploy list`

List recent deployments with optional filters.

```bash
stoactl deploy list [flags]
stoactl deploy ls [flags]
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--api-id` | Filter by API ID |
| `--env` | Filter by environment |
| `--status` | Filter by status: `pending`, `in_progress`, `success`, `failed`, `rolled_back` |
| `--page` | Page number (default: `1`) |
| `--page-size` | Items per page (default: `20`) |
| `-o` | Output format: `table`, `wide`, `yaml`, `json` |

**Example:**

```bash
stoactl deploy list --env production --status success -o wide
```

---

#### `stoactl deploy get`

Get detailed information about a specific deployment.

```bash
stoactl deploy get <deployment-id>
```

**Example:**

```bash
stoactl deploy get deploy-abc12345
stoactl deploy get deploy-abc12345 -o json
```

---

#### `stoactl deploy rollback`

Rollback a deployment to its previous version.

```bash
stoactl deploy rollback <deployment-id>
```

**Example:**

```bash
# Find the deployment to roll back
stoactl deploy list --api-id customer-api --env production

# Roll back
stoactl deploy rollback deploy-abc12345
```

---

### `stoactl logs`

Show deployment history for an API — recent deployments, statuses, and error messages.

```bash
stoactl logs <api-name> [flags]
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--env` | — | Filter by environment (dev, staging, production) |
| `--limit` | `10` | Number of recent deployments to show |

**Example:**

```bash
stoactl logs customer-api
stoactl logs customer-api --env production --limit 5
```

**Output columns:** `ID`, `ENV`, `VERSION`, `STATUS`, `BY`, `STARTED`, `MESSAGE`

**Status values:**

| Status | Meaning |
|--------|---------|
| `OK` | Deployment succeeded |
| `FAIL` | Deployment failed (see MESSAGE column) |
| `...` | Deployment in progress |
| `WAIT` | Deployment queued |
| `<<<` | Deployment was rolled back |

---

## Project Commands

### `stoactl init`

Create a new STOA project with everything needed to run a local MCP gateway.

```bash
stoactl init <name> [flags]
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8080` | Gateway port |
| `--dir` | `.` | Parent directory for the project |
| `--no-context` | `false` | Skip creating a local CLI context |

**Example:**

```bash
stoactl init my-api --port 9090
cd my-api
docker compose up -d
stoactl doctor
```

**Generated files:**
- `docker-compose.yml` — Gateway + echo backend
- `stoa.yaml` — Gateway configuration
- `echo-nginx.conf` — Echo backend (static JSON for testing)
- `example-api.yaml` — Sample OpenAPI spec for bridge
- `README.md` — Project-specific quickstart
- `tools/` — Output directory for bridge

### `stoactl doctor`

Run 6 diagnostic checks to verify your local setup.

```bash
stoactl doctor
```

**Checks:**

| Check | What it verifies |
|-------|-----------------|
| Docker | Docker daemon is running |
| Gateway | Health endpoint responds (HTTP 200) |
| Keychain | OS Keychain is accessible |
| API key | Valid authentication token exists |
| Port | Gateway port is available |
| MCP endpoint | SSE endpoint is responding |

---

## Bridge Commands

### `stoactl bridge`

Convert an OpenAPI 3.x specification into STOA Tool CRDs. Each path+method operation becomes a separate MCP tool.

```bash
stoactl bridge <spec-file> [flags]
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--namespace` | *(required)* | Target namespace for generated tools |
| `--output` | `./tools/` | Output directory for YAML files |
| `--server` | From spec | Override `servers[0].url` |
| `--auth-secret` | — | K8s secret name for authentication |
| `--include-tags` | All | Only include operations with these tags |
| `--exclude-tags` | None | Exclude operations with these tags |
| `--include-ops` | All | Only include these operationIds |
| `--timeout` | `30s` | Default timeout for generated tools |
| `--dry-run` | `false` | Show summary without writing files |
| `--apply` | `false` | Register tools directly via API *(planned)* |

**Examples:**

```bash
# Generate tools from an OpenAPI spec
stoactl bridge petstore.yaml --namespace tenant-acme

# Preview without writing files
stoactl bridge petstore.yaml --namespace tenant-acme --dry-run

# Filter by tags
stoactl bridge api.yaml --namespace default --include-tags payments --exclude-tags internal

# Override backend URL
stoactl bridge api.yaml --namespace default --server https://api.internal.com
```

**Mapping rules:**

| OpenAPI Field | Tool CRD Field |
|--------------|----------------|
| `operationId` | `metadata.name` (kebab-case) |
| `summary` | `spec.displayName` |
| `description` | `spec.description` |
| `servers[0].url + path` | `spec.endpoint` |
| HTTP method | `spec.method` |
| `parameters` + `requestBody` | `spec.inputSchema` |
| `security` + `securitySchemes` | `spec.authentication` |
| `tags` | `spec.tags` |

---

## Resource Commands

### `stoactl apply`

Create or update a resource from a YAML file.

```bash
stoactl apply -f <file>
```

**Example:**

```bash
# Apply a single tool
stoactl apply -f tools/list-pets.yaml

# Apply all tools in a directory
for f in tools/*.yaml; do stoactl apply -f "$f"; done
```

### `stoactl get`

List resources from the control plane.

```bash
stoactl get <resource-type>
```

**Resource types:** `apis`, `tenants`, `subscriptions`, `gateways`

**Example:**

```bash
stoactl get apis
stoactl get api payment-api
stoactl get subscriptions
```

To list deployments, use [`stoactl deploy list`](#stoactl-deploy-list).

### `stoactl delete`

Delete a resource.

```bash
stoactl delete <resource-type> <name>
```

**Example:**

```bash
stoactl delete api payment-api
```

---

## Authentication Commands

### `stoactl auth login`

Authenticate with STOA Platform using OAuth2 device flow.

```bash
stoactl auth login
```

This initiates the device authorization flow:
1. You receive a code and URL
2. Open the URL in your browser
3. Enter the code to authorize
4. Credentials are stored in your OS Keychain

### `stoactl auth logout`

Remove stored credentials.

```bash
stoactl auth logout
```

### `stoactl auth status`

Display current authentication status.

```bash
stoactl auth status
```

### `stoactl auth rotate-key`

Generate a new API key and store it in the OS Keychain.

```bash
stoactl auth rotate-key [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--auto` | `false` | Enable automatic rotation reminder |
| `--interval` | `90d` | Rotation interval |

---

## Configuration Commands

### `stoactl config set-context`

Create or update a named context.

```bash
stoactl config set-context <name> --server <url> --tenant <tenant>
```

**Example:**

```bash
stoactl config set-context prod --server ${STOA_API_URL} --tenant acme
stoactl config set-context local --server http://localhost:8080 --tenant default
```

### `stoactl config use-context`

Switch to a named context.

```bash
stoactl config use-context <name>
```

### `stoactl config get-contexts`

List all configured contexts.

```bash
stoactl config get-contexts
```

---

## Utility Commands

### `stoactl token-usage`

View API token usage statistics.

```bash
stoactl token-usage
```

### `stoactl version`

Print version and build information.

```bash
stoactl version
```

---

## Governance, Platform & Agent Commands

### `stoactl reconcile`

Reconcile owned Universal API Contracts (UAC) against target gateways from a local YAML or JSON governance snapshot (`stoa-go/internal/cli/cmd/reconcile/`).

```bash
stoactl reconcile -f ./snapshot.yaml --once
stoactl reconcile -f ./snapshot.yaml --interval 10s --state .stoactl-reconcile.json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--file`, `-f` | — | Local YAML or JSON snapshot containing targets and contracts (**required**) |
| `--state` | `.stoactl-reconcile.json` | Local reconciliation status file |
| `--once` | `false` | Run a single reconciliation pass and exit |
| `--interval` | `5s` | Continuous reconciliation loop interval |

### `stoactl gateway`

Manage registered gateway instances (aliases: `gw`, `gateways`; supports `-o table|wide|yaml|json`).

```bash
stoactl gateway list
stoactl gateway get <gateway-id>
stoactl gateway health <gateway-id>
```

### `stoactl mcp`

Interact with MCP servers and tools via the Control Plane API or directly against a gateway (`--gateway <url>`).

```bash
stoactl mcp list-servers
stoactl mcp list-tools --server weather-mcp
stoactl mcp call get-weather --server weather-mcp --input '{"q":"Paris"}'
stoactl mcp health
```

| Subcommand / Flag | Description |
|-------------------|-------------|
| `list-servers` | List registered MCP servers |
| `list-tools [--server <name>]` | List MCP tools (optionally filtered by server) |
| `call <tool-name> --server <name> [--input '<json>']` | Invoke an MCP tool (`--server` is required) |
| `health` | Check MCP subsystem health |
| `--gateway <url>` | Query a `stoa-gateway` URL directly (bypasses Control Plane RBAC) |
| `--output`, `-o` | Output format: `table`, `json`, `yaml` |

### `stoactl catalog`

Inspect API catalog drift or trigger synchronization (`dry-run` by default unless `--apply` is passed).

```bash
stoactl catalog sync --tenant acme
stoactl catalog sync --tenant acme --apply -o json
```

### `stoactl subscription`

Manage consumer API subscriptions (aliases: `sub`, `subscriptions`; supports `-o table|wide|yaml|json`).

```bash
stoactl subscription list --status pending
stoactl subscription get <subscription-id>
stoactl subscription approve <subscription-id>
stoactl subscription revoke <subscription-id>
```

### `stoactl tenant`

Manage platform tenants and inspect Keycloak provisioning status (`-o table|wide|yaml|json`).

```bash
stoactl tenant list
stoactl tenant create --name acme --display-name "Acme Corp" --owner-email ops@example.com
stoactl tenant status acme
stoactl tenant get acme
stoactl tenant delete acme
```

### `stoactl connect`

Inspect [`stoa-connect` (STOA Link)](/docs/guides/stoa-connect-quickstart) agents and run ad-hoc admin-API discovery.

```bash
# Check stoa-connect / STOA Link agent health (:8090/health)
stoactl connect status --url http://localhost:8090

# Discover APIs directly from a third-party gateway admin API
stoactl connect discover --admin-url http://localhost:8001 --type kong --token "${KONG_ADMIN_TOKEN}"

# Send a sync trigger request
stoactl connect sync --url http://localhost:8090
```

:::note Envoy xDS mode vs `stoactl connect discover` / `sync`
- `stoactl connect discover` only supports admin-API gateways (`--type kong|gravitee|webmethods|auto`). Upstream **Envoy** has no admin-API discovery path: Envoy mode is configured on the `stoa-connect` agent via `STOA_GATEWAY_TYPE=envoy` and loopback mTLS ADS (`STOA_ENVOY_*` variables; see [stoa-connect Quickstart](/docs/guides/stoa-connect-quickstart)).
- `stoactl connect sync --url` sends `POST <url>/sync`. On current `main`, `cmd/stoa-connect/main.go` mounts `/health`, `/metrics`, and `/webhook/events` (policy synchronization runs automatically on the agent's background sync/SSE loop).
:::

### `stoactl audit`

Export tenant audit logs with PII redaction enabled by default.

```bash
stoactl audit export --tenant acme --since 7d -o csv
stoactl audit export --tenant acme --action subscription.approved --redact-pii=true -o json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--tenant` | — | Tenant ID (**required**) |
| `--since` | `7d` | Lookback window (`24h`, `7d`, `30d`, or ISO-8601 date) |
| `--action` | `""` | Filter by audit action name |
| `--redact-pii` | `true` | Mask email addresses and IP addresses in exported records |
| `--output`, `-o` | `table` | Output format: `table`, `json`, `yaml`, `csv` |

### `stoactl completion`

Generate shell completion scripts for `bash`, `zsh`, or `fish`.

```bash
stoactl completion zsh > "${fpath[1]}/_stoactl"
stoactl completion bash > /etc/bash_completion.d/stoactl
stoactl completion fish > ~/.config/fish/completions/stoactl.fish
```

---

## Workflows

### Deploy an API (stoa.yaml)

```bash
# 1. Authenticate
stoactl auth login

# 2. Create stoa.yaml (or export from Console)
cat > stoa.yaml <<EOF
name: customer-api
version: 2.0.0
rate_limit:
  requests_per_minute: 1000
auth:
  type: oauth2
  issuer: ${STOA_AUTH_URL}/realms/stoa
  required: true
EOF

# 3. Deploy to staging first
stoactl deploy ./stoa.yaml --env staging --watch

# 4. Check logs
stoactl logs customer-api --env staging

# 5. Deploy to production
stoactl deploy ./stoa.yaml --env production --watch
```

### Rollback a failed deployment

```bash
# 1. Find the failed deployment
stoactl deploy list --api-id customer-api --env production

# 2. Roll back
stoactl deploy rollback deploy-abc12345

# 3. Confirm rollback succeeded
stoactl logs customer-api --env production --limit 3
```

### Bridge an API to MCP

```bash
# 1. Set up project
stoactl init my-api && cd my-api

# 2. Start gateway
docker compose up -d

# 3. Verify setup
stoactl doctor

# 4. Connect to hosted platform (optional)
stoactl config set-context prod --server ${STOA_API_URL} --tenant acme
stoactl auth login

# 5. Bridge your API to MCP
stoactl bridge your-api.yaml --namespace default --output ./tools/

# 6. Register tools
for f in tools/*.yaml; do stoactl apply -f "$f"; done
```

---

## Related

- [stoa.yaml Reference](/docs/reference/stoa-yaml) — Full field reference for the deployment spec
- [ADR-045: stoa.yaml Declarative API Spec](/docs/architecture/adr/adr-045-stoa-yaml-declarative-spec) — Design decisions
- [Environment Management Guide](/docs/guides/environment-management) — Managing dev, staging, production
