---
sidebar_position: 2
slug: /guides/stoactl-quickstart
title: "Self-Host in 5 Minutes with stoactl"
description: "Set up a local STOA MCP Gateway with stoactl — from install to bridging your first REST API to MCP tools in under 5 minutes"
keywords: [stoactl, CLI, self-hosted, quickstart, MCP gateway, OpenAPI bridge, docker]
---

# Self-Host in 5 Minutes with stoactl

Get a local MCP Gateway running and bridge your first REST API — no cloud account needed.

## What You'll Build

By the end of this guide, you'll have:
- A running STOA MCP Gateway (Docker)
- An OpenAPI spec automatically converted to MCP tools
- AI-callable tools registered on your local gateway

## Prerequisites

- **Docker** (Docker Desktop or Docker Engine)
- **stoactl** — the STOA CLI

### Install stoactl

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

Verify the installation:

```bash
stoactl version
```

---

## Step 1: Initialize a Project

```bash
stoactl init my-api
cd my-api
```

This creates a complete project scaffold:

```
my-api/
├── docker-compose.yml   # Gateway + echo backend
├── stoa.yaml            # Gateway configuration
├── echo-nginx.conf      # Echo backend (returns static JSON)
├── example-api.yaml     # Example OpenAPI spec
├── tools/               # Output directory for bridge
└── README.md            # Project-specific instructions
```

## Step 2: Start the Gateway

```bash
docker compose up -d
```

Wait a few seconds for the gateway to start, then verify:

```bash
stoactl doctor
```

You should see all checks passing:

```
STOA Doctor

  ✓ Docker: running (v27.x)
  ✓ Gateway: healthy (http://localhost:8080/health)
  ✓ Port 8080: available
  ...
```

## Step 3: Bridge an API to MCP

The project includes an `example-api.yaml` (OpenAPI 3.0 spec) with 3 operations. Convert it to MCP tools:

```bash
stoactl bridge example-api.yaml --namespace default --output ./tools/
```

Output:

```
✓ Parsed OpenAPI 3.0 spec: my-api API (3 operations)
✓ Generated 3 Tool CRDs → ./tools/
  - list-items.yaml
  - create-item.yaml
  - get-item.yaml
```

### Preview what was generated

Each file in `tools/` is a valid Tool CRD:

```bash
cat tools/list-items.yaml
```

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: list-items
  namespace: default
  labels:
    generated-by: stoactl-bridge
spec:
  displayName: List all items
  endpoint: http://echo:8888/items
  method: GET
  inputSchema:
    type: object
    properties:
      limit:
        type: integer
        maximum: 100
        default: 20
  timeout: 30s
  enabled: true
```

## Step 4: Register Tools with the Gateway

Apply each generated tool to the running gateway:

```bash
for f in tools/*.yaml; do stoactl apply -f "$f"; done
```

Verify tools are registered:

```bash
stoactl get tools
```

## Step 5: Test via MCP

Call the gateway's MCP endpoint to list available tools:

```bash
curl -s http://localhost:8080/mcp/v1/tools | jq .
```

Invoke a tool:

```bash
curl -s http://localhost:8080/mcp/v1/tools/invoke \
  -H "Content-Type: application/json" \
  -d '{"name": "list-items", "arguments": {"limit": 5}}' | jq .
```

---

## Bridge Your Own API

Replace the example spec with your own OpenAPI 3.x file:

```bash
# Use your own spec
stoactl bridge your-api.yaml --namespace default --output ./tools/

# Filter specific operations by tag
stoactl bridge your-api.yaml --namespace default --include-tags payments

# Override the backend URL
stoactl bridge your-api.yaml --namespace default --server https://api.internal.com

# Preview without writing files
stoactl bridge your-api.yaml --namespace default --dry-run
```

### Bridge flags reference

| Flag | Description | Default |
|------|-------------|---------|
| `--namespace` | Target namespace for tools (required) | — |
| `--output` | Output directory for YAML files | `./tools/` |
| `--server` | Override `servers[0].url` from spec | From spec |
| `--auth-secret` | K8s secret name for auth | — |
| `--include-tags` | Only include operations with these tags | All |
| `--exclude-tags` | Exclude operations with these tags | None |
| `--include-ops` | Only include these operationIds | All |
| `--timeout` | Default timeout for tools | `30s` |
| `--dry-run` | Show summary without writing files | `false` |

---

## What's Next?

- **[Quick Start (Cloud)](/docs/guides/quickstart)** — Use the hosted STOA Platform
- **[Gateway Configuration](/docs/reference/configuration)** — Customize your gateway
- **[Tool CRD Reference](/docs/reference/crds/tool)** — Full Tool spec documentation
- **[CLI Reference](/docs/reference/cli)** — All stoactl commands

## FAQ

### What is stoactl?

`stoactl` is a kubectl-style CLI for managing STOA Platform resources. It provides project scaffolding (`init`), API-to-MCP bridging (`bridge`), diagnostic checks (`doctor`), and resource management (`apply`, `get`, `delete`).

### Can I bridge any REST API?

Yes. Any API with an OpenAPI 3.0 or 3.1 specification can be bridged to MCP tools. Each path+method operation becomes a separate MCP tool with its parameters mapped to the tool's input schema.

### Do I need a STOA cloud account?

No. The self-hosted setup with `stoactl init` + Docker is completely standalone. You can optionally connect to the hosted STOA Platform later for multi-tenant management, observability, and team features.
