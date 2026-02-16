---
slug: stoactl-cli-manage-apis-terminal
title: "stoactl CLI: Manage Your APIs from the Terminal"
description: "Use stoactl to manage APIs, subscriptions, and MCP tools from your terminal. Installation, commands, and CI/CD integration."
authors: [stoa-team]
tags: [tutorial, quickstart, api-gateway]
unlisted: true
keywords:
  - stoactl CLI
  - API management terminal
  - command line API gateway
  - kubectl for APIs
  - API gateway CLI tool
  - scriptable API management
  - CI/CD API deployment
---
<!-- last verified: 2026-02 -->

stoactl is the command-line interface for STOA Platform that brings kubectl-style API management to your terminal. Install it with one command, authenticate to your Control Plane API, and manage APIs, subscriptions, and MCP tools without touching the web console—ideal for scripting, CI/CD pipelines, and developers who prefer the terminal.

<!-- truncate -->

## What is stoactl?

stoactl (pronounced "stoa-control") is a Go-based CLI tool built with Cobra that provides a declarative, scriptable interface to the STOA Platform Control Plane API. If you've used `kubectl` to manage Kubernetes resources or `gh` to interact with GitHub, stoactl follows the same philosophy: powerful, composable commands that fit naturally into automation workflows.

The CLI abstracts away HTTP API calls and JSON payloads, replacing them with intuitive commands like `stoactl apis create` or `stoactl tools list`. It's designed for three primary use cases:

1. **Local development**: Quickly create test APIs, inspect subscriptions, and verify MCP tool registrations without switching to a browser
2. **CI/CD pipelines**: Automate API deployment and configuration as part of your release process
3. **Infrastructure as Code**: Script complex multi-tenant setups with shell scripts or Makefiles that orchestrate API creation across environments

Unlike web consoles that require manual clicks through forms, stoactl enables reproducible, version-controlled workflows. You can commit your API management scripts alongside application code, making infrastructure changes reviewable and auditable through standard Git workflows.

## Installation

stoactl supports three installation methods depending on your platform and preferences.

### Go Install (Cross-Platform)

If you have Go 1.21+ installed, use `go install` for the latest version:

```bash
go install github.com/stoa-platform/stoactl@latest
```

This places the binary in `$GOPATH/bin` (usually `~/go/bin`). Ensure this directory is in your `PATH`:

```bash
export PATH="$PATH:$(go env GOPATH)/bin"
stoactl version
```

### Homebrew (macOS and Linux)

For macOS or Linux users who prefer package managers:

```bash
brew tap stoa-platform/stoactl
brew install stoactl
```

Homebrew handles the PATH configuration automatically. Verify the installation:

```bash
stoactl --help
```

### Binary Downloads

Pre-built binaries for macOS (Intel and Apple Silicon), Linux (x64 and ARM64), and Windows are available on the [GitHub releases page](https://github.com/stoa-platform/stoactl/releases). Download the appropriate binary for your platform:

```bash
# Example for Linux x64
wget https://github.com/stoa-platform/stoactl/releases/latest/download/stoactl-linux-amd64
chmod +x stoactl-linux-amd64
sudo mv stoactl-linux-amd64 /usr/local/bin/stoactl
```

For Windows, download the `.exe` file and add its directory to your system PATH.

## Configuration

Before using stoactl, you need to authenticate with your STOA Control Plane API and configure context for your environment.

### Authentication

stoactl uses API keys or OAuth tokens to authenticate. The simplest method for getting started is API key authentication:

```bash
stoactl login --server ${STOA_API_URL}
```

This command prompts you for an API key, which you can generate from the STOA Console:

1. Navigate to **Settings** → **API Keys** in the Console UI
2. Click **Generate New Key**
3. Copy the key (it's only shown once)
4. Paste it when prompted by `stoactl login`

stoactl stores the credentials in `~/.stoactl/config.yaml`. The file is created with `0600` permissions to protect your keys.

### Context Management

If you work with multiple environments (development, staging, production), stoactl supports context switching similar to `kubectl`:

```bash
# Add a staging context
stoactl context add staging --server https://staging-api.example.com --token <TOKEN>

# Add a production context
stoactl context add production --server ${STOA_API_URL} --token <TOKEN>

# Switch between contexts
stoactl context use staging
stoactl context use production

# View current context
stoactl context current
```

Contexts are stored in the same `~/.stoactl/config.yaml` file. Each context can point to a different API server and use different credentials, making it safe to test commands against staging before running them in production.

### Environment Variables

For CI/CD environments, avoid storing credentials in config files. stoactl respects these environment variables:

```bash
export STOACTL_SERVER="${STOA_API_URL}"
export STOACTL_TOKEN="your-api-key-here"
stoactl apis list  # Uses env vars instead of config file
```

This approach integrates cleanly with secret managers like GitHub Actions secrets, HashiCorp Vault, or Kubernetes secrets.

## Core Commands

stoactl organizes commands into logical groups following the resource types in the Control Plane API.

### Managing APIs

The `apis` command group handles CRUD operations for API resources.

#### List All APIs

View all APIs in your current tenant:

```bash
stoactl apis list
```

Output includes API name, ID, base path, gateway type, and status:

```
NAME              ID                                     BASE PATH    GATEWAY       STATUS
petstore-api      a1b2c3d4-e5f6-7890-abcd-ef1234567890  /petstore    stoa-edge     active
payment-api       f1e2d3c4-b5a6-9876-dcba-fe9876543210  /payments    kong          active
legacy-soap-api   9a8b7c6d-5e4f-3210-fedc-ba0987654321  /legacy      webmethods    inactive
```

Filter by gateway type or status:

```bash
stoactl apis list --gateway stoa-edge
stoactl apis list --status active
```

#### Create an API

Create an API from an OpenAPI specification file:

```bash
stoactl apis create --name my-api --spec openapi.yaml
```

The `--spec` flag accepts a local file path or a URL. stoactl validates the OpenAPI schema before submitting to the Control Plane API. For inline creation without a spec file:

```bash
stoactl apis create \
  --name quicktest-api \
  --base-path /test \
  --target-url https://httpbin.org \
  --gateway stoa-edge
```

This creates a minimal API configuration that proxies requests to the target URL.

#### Describe an API

Get detailed information about a specific API, including policies, rate limits, and associated subscriptions:

```bash
stoactl apis describe petstore-api
```

The output includes:
- OpenAPI specification (if available)
- Attached policies (CORS, rate limiting, authentication)
- Active subscriptions
- Gateway routing configuration

#### Delete an API

Remove an API by name or ID:

```bash
stoactl apis delete petstore-api
```

Add `--force` to skip the confirmation prompt:

```bash
stoactl apis delete petstore-api --force
```

Deleting an API revokes all associated subscriptions and removes routes from the gateway. This action is irreversible.

### Managing Subscriptions

Subscriptions link applications (API consumers) to APIs and enforce rate limits, quotas, and access control.

#### List Subscriptions

View all subscriptions for the current tenant:

```bash
stoactl subscriptions list
```

Filter by API or application:

```bash
stoactl subscriptions list --api petstore-api
stoactl subscriptions list --app mobile-app
```

#### Create a Subscription

Grant an application access to an API:

```bash
stoactl subscriptions create \
  --app mobile-app \
  --api petstore-api \
  --plan standard
```

The `--plan` flag references a pricing/rate-limit plan defined in the Console. Common plans include `free`, `standard`, `premium`. Each plan specifies rate limits (e.g., 1000 requests/hour) and quotas.

#### Revoke a Subscription

Remove access for an application:

```bash
stoactl subscriptions revoke <SUBSCRIPTION_ID>
```

Revoking a subscription immediately blocks the application's requests to the API. The application's API key remains valid but returns `403 Forbidden` for the revoked API.

### Managing MCP Tools

MCP (Model Context Protocol) tools are AI-agent-accessible API endpoints registered in the STOA Gateway. The `tools` command group manages these resources.

#### List Tools

View all MCP tools registered for a tenant:

```bash
stoactl tools list --tenant acme
```

Output includes tool name, endpoint URL, HTTP method, and description:

```
NAME                ENDPOINT                              METHOD  DESCRIPTION
create-customer     /api/customers                        POST    Create a new customer record
get-invoice         /api/invoices/{id}                    GET     Retrieve invoice by ID
process-payment     /api/payments                         POST    Process a payment transaction
```

#### Create a Tool

Register a new MCP tool from a JSON definition:

```bash
stoactl tools create --file tool-definition.json --tenant acme
```

Example `tool-definition.json`:

```json
{
  "name": "send-notification",
  "displayName": "Send Notification",
  "description": "Send a push notification to a user",
  "endpoint": "${STOA_API_URL}/notifications",
  "method": "POST",
  "inputSchema": {
    "type": "object",
    "properties": {
      "userId": {"type": "string"},
      "message": {"type": "string"}
    },
    "required": ["userId", "message"]
  }
}
```

The gateway validates the tool definition against the MCP JSON Schema before accepting it.

#### Delete a Tool

Remove a tool by name:

```bash
stoactl tools delete send-notification --tenant acme
```

This removes the tool from the MCP server's `/tools` list. AI agents will no longer see it in their tool catalog.

### System Status

The `status` command provides a health check for your STOA Platform deployment:

```bash
stoactl status
```

Output includes:
- Control Plane API connectivity and version
- Gateway health (per-gateway type if multiple gateways configured)
- Current user and tenant context
- Active features (e.g., metering enabled, GitOps mode)

This command is useful in CI/CD pipelines to verify the platform is reachable before running automation scripts.

## Advanced Usage

### Scripting Workflows

stoactl's predictable output and exit codes make it ideal for shell scripting. Here's a script that creates multiple APIs from a directory of OpenAPI specs:

```bash
#!/bin/bash
set -e

SPECS_DIR="./openapi-specs"
GATEWAY="stoa-edge"

for spec_file in "$SPECS_DIR"/*.yaml; do
  api_name=$(basename "$spec_file" .yaml)
  echo "Creating API: $api_name"

  stoactl apis create \
    --name "$api_name" \
    --spec "$spec_file" \
    --gateway "$GATEWAY" \
    || echo "Failed to create $api_name (may already exist)"
done

echo "All APIs created successfully"
```

For production scripts, add idempotency checks:

```bash
if stoactl apis describe "$api_name" &>/dev/null; then
  echo "API $api_name already exists, skipping"
else
  stoactl apis create --name "$api_name" --spec "$spec_file"
fi
```

### CI/CD Integration

Integrate stoactl into GitHub Actions to automate API deployments on every release:

```yaml
name: Deploy APIs

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install stoactl
        run: |
          go install github.com/stoa-platform/stoactl@latest
          echo "$HOME/go/bin" >> $GITHUB_PATH

      - name: Deploy APIs
        env:
          STOACTL_SERVER: ${{ secrets.STOA_API_URL }}
          STOACTL_TOKEN: ${{ secrets.STOA_API_KEY }}
        run: |
          stoactl apis create --name payment-api --spec specs/payment-openapi.yaml
          stoactl apis create --name orders-api --spec specs/orders-openapi.yaml
```

This pattern works with GitLab CI, Jenkins, CircleCI, or any CI/CD system that supports shell commands. For GitOps workflows, combine stoactl with tools like ArgoCD or Flux—see our [GitOps in 10 Minutes tutorial](/blog/gitops-in-10-minutes) for setup details.

### JSON Output for Parsing

Many stoactl commands support `--output json` for machine-readable output:

```bash
stoactl apis list --output json | jq '.[] | select(.status == "active") | .name'
```

This enables advanced workflows like:
- Generating reports on API usage
- Filtering resources by custom criteria
- Chaining multiple commands with `xargs` or `parallel`

### Bulk Operations

Delete all inactive APIs in one command:

```bash
stoactl apis list --status inactive --output json \
  | jq -r '.[].id' \
  | xargs -I {} stoactl apis delete {} --force
```

Create subscriptions for multiple applications from a CSV:

```bash
# apps.csv format: app_name,api_name,plan
tail -n +2 apps.csv | while IFS=, read -r app api plan; do
  stoactl subscriptions create --app "$app" --api "$api" --plan "$plan"
done
```

## Comparison with Web Console

While the STOA Console provides a visual interface for managing APIs, stoactl offers distinct advantages for certain workflows:

| Feature | Web Console | stoactl CLI |
|---------|-------------|-------------|
| **Initial setup** | Guided wizards, visual forms | Requires understanding CLI flags |
| **Bulk operations** | Manual, repetitive clicks | Scriptable, automated |
| **Version control** | Manual export, no history | Scripts committed to Git |
| **CI/CD integration** | Not possible | Native (shell commands) |
| **Speed for power users** | Slower (page loads, clicks) | Instant (direct API calls) |
| **Audit trail** | UI action logs | Command history, shell logs |
| **Multi-environment management** | Switch tenants manually | Context switching (`stoactl context use`) |

Use the Console for exploratory work and visual confirmation. Use stoactl for automation, repetitive tasks, and infrastructure-as-code workflows. Many teams use both: Console for initial setup, stoactl for day-2 operations.

For comprehensive CLI documentation, see the [CLI Reference](/docs/reference/cli) in the STOA docs.

## FAQ

### Can stoactl manage multiple tenants?

Yes. Use the `--tenant` flag on commands that support it, or configure separate contexts for each tenant:

```bash
stoactl context add tenant-a --server ${STOA_API_URL} --token <TOKEN_A>
stoactl context add tenant-b --server ${STOA_API_URL} --token <TOKEN_B>
stoactl context use tenant-a
```

Each context can authenticate as a different user with different tenant permissions.

### How do I use stoactl with self-hosted STOA Platform?

Point stoactl to your self-hosted Control Plane API URL during login:

```bash
stoactl login --server https://api.your-domain.com
```

For quickstart deployments using Docker Compose, the API is typically at `http://localhost:8000`. See the [MCP Gateway Quickstart](/blog/mcp-gateway-quickstart-docker) for self-hosted setup details.

### Is stoactl safe for production use?

Yes. stoactl uses the same Control Plane API that the Console UI calls, with the same authentication, authorization, and audit logging. All commands require valid API keys with appropriate RBAC permissions. For production pipelines:

1. Use dedicated service account tokens (not personal API keys)
2. Store tokens in secret managers (GitHub Secrets, Vault, etc.)
3. Enable audit logging on the Control Plane API to track stoactl actions
4. Test scripts in staging before running them in production

stoactl does not include a `--dry-run` flag yet, but you can preview changes with `describe` commands before running destructive operations like `delete`.

## Next Steps

stoactl is a powerful tool for developers who prefer terminal workflows and teams implementing infrastructure-as-code for API management. Start with the basics—list APIs, describe a resource, create a test API—then graduate to advanced scripting and CI/CD automation.

For a broader understanding of API management patterns, read [Open Source API Gateway in 2026](/blog/open-source-api-gateway-2026). If you're new to STOA Platform, the [Quick Start Guide](/docs/guides/quickstart) walks you through your first API in 5 minutes using the web Console, then shows how to replicate the same workflow with stoactl.

Explore additional tutorials:
- [Create Your First API in 5 Minutes](/blog/stoa-quickstart-first-api-5-minutes)
- [GitOps in 10 Minutes](/blog/gitops-in-10-minutes)
- [MCP Gateway Quickstart with Docker](/blog/mcp-gateway-quickstart-docker)

Have questions or feedback on stoactl? Join the [GitHub Discussions](https://github.com/stoa-platform/stoactl/discussions) or contribute to the CLI codebase—it's open source under Apache 2.0.
