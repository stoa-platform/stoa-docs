---
sidebar_position: 2
title: "CLI Reference (stoactl)"
description: "stoactl CLI reference — kubectl-style command-line interface for managing STOA Platform resources, bridging APIs to MCP, and local development"
keywords: [CLI, command line, stoactl, reference, MCP, bridge, OpenAPI]
---

# CLI Reference (stoactl)

`stoactl` is a kubectl-style CLI for managing STOA Platform resources. It provides project scaffolding, API-to-MCP bridging, diagnostics, and resource management.

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
| `stoactl init` | Initialize a new STOA project |
| `stoactl bridge` | Convert OpenAPI spec to MCP Tool CRDs |
| `stoactl doctor` | Run diagnostic checks |
| `stoactl apply` | Create or update a resource from a YAML file |
| `stoactl get` | List resources (apis, deployments, tools) |
| `stoactl delete` | Delete a resource |
| `stoactl auth` | Authentication commands |
| `stoactl config` | Manage CLI contexts |
| `stoactl token-usage` | View API token usage statistics |
| `stoactl version` | Print version information |

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

**Resource types:** `apis`, `deployments`, `tools`

**Example:**

```bash
stoactl get apis
stoactl get tools
stoactl get deployments
```

### `stoactl delete`

Delete a resource.

```bash
stoactl delete <resource-type> <name>
```

**Example:**

```bash
stoactl delete tool list-pets
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

### `stoactl auth whoami`

Display current authentication status.

```bash
stoactl auth whoami
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

## End-to-End Workflow

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

# 7. Verify
stoactl get tools
```
