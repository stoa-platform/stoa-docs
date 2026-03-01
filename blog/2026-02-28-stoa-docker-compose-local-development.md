---
slug: stoa-docker-compose-local-development
title: "Run the Full Stack Locally with Docker Compose"
description: "API, Console, Portal, Gateway, and Keycloak running on your laptop. Step-by-step Docker Compose setup for local development and testing."
authors: [stoa-team]
tags: [tutorial, docker, quickstart]
keywords:
  - docker compose api gateway
  - stoa platform local development
  - api gateway docker setup
  - mcp gateway local testing
  - kubernetes api management local
---
<!-- last verified: 2026-02 -->

Run the complete STOA Platform stack on your local machine using Docker Compose. This tutorial shows you how to spin up the Control Plane API, Console UI, Developer Portal, MCP Gateway, Keycloak, and PostgreSQL — all configured and ready to use in under 10 minutes.

<!-- truncate -->

## What You'll Run

STOA Platform is designed as a cloud-native, Kubernetes-first API management solution. But for local development, testing, and learning, you can run the entire stack using Docker Compose without needing a Kubernetes cluster.

The local stack includes:

```
┌─────────────────────────────────────────────────┐
│  Developer Portal (React)      :8080            │
│  Console UI (React)             :3000           │
│  Control Plane API (FastAPI)   :8000           │
│  MCP Gateway (Rust)             :8080           │
│  Keycloak (Auth)                :8443           │
│  PostgreSQL (DB)                :5432           │
└─────────────────────────────────────────────────┘
```

**Architecture overview**:
- **Control Plane API** — manages APIs, policies, applications, and gateway configuration
- **Console UI** — admin interface for platform operators (RBAC-enabled)
- **Developer Portal** — self-service portal for API consumers to discover and subscribe to APIs
- **MCP Gateway** — Rust-based gateway that proxies API requests and exposes MCP tools for AI agents
- **Keycloak** — OpenID Connect provider for authentication (pre-configured with 4 RBAC roles)
- **PostgreSQL** — database for Control Plane API and Keycloak

This is a fully functional environment. You can create APIs, configure rate limiting, test MCP tools with Claude Desktop, and experiment with GitOps workflows — all without deploying to a cloud provider.

For a broader overview of STOA's architecture and design principles, see our [Open Source API Gateway Guide](/blog/open-source-api-gateway-2026).

## Prerequisites

Before you begin, ensure you have:

1. **Docker** 20.10+ installed ([Get Docker](https://docs.docker.com/get-docker/))
2. **Docker Compose** v2.0+ (included with Docker Desktop, or install via `docker compose` plugin)
3. **8GB RAM minimum** (12GB recommended for smooth operation)
4. **10GB free disk space** (for images and volumes)
5. **Git** to clone the repository

Verify your setup:

```bash
docker --version
# Docker version 24.0.0 or higher

docker compose version
# Docker Compose version v2.20.0 or higher
```

**Note**: This guide uses `docker compose` (v2 syntax, space not hyphen). If you're on an older Docker installation, replace `docker compose` with `docker-compose` throughout.

## Step 1: Clone & Configure

Clone the STOA Quickstart repository:

```bash
git clone https://github.com/stoa-platform/stoa-quickstart.git
cd stoa-quickstart
```

The repository includes:
- `docker-compose.yml` — service definitions for all components
- `.env.example` — configuration template
- `keycloak/realm-export.json` — pre-configured STOA realm with 4 roles and test users
- `init-scripts/` — database initialization scripts

Copy the environment template:

```bash
cp .env.example .env
```

Open `.env` and review the settings. For local development, the defaults work out of the box:

```bash
# Control Plane API
API_BASE_URL=http://localhost:8000
DATABASE_URL=postgresql://stoa:stoa@postgres:5432/stoa

# Keycloak
KEYCLOAK_BASE_URL=https://localhost:8443
KEYCLOAK_REALM=stoa
KEYCLOAK_CLIENT_ID=control-plane-api
KEYCLOAK_CLIENT_SECRET=your-secret-here

# Gateway
GATEWAY_PORT=8080
STOA_CONTROL_PLANE_API_KEY=demo-gateway-key

# Console UI
VITE_API_URL=http://localhost:8000
VITE_KEYCLOAK_URL=https://localhost:8443
VITE_KEYCLOAK_REALM=stoa
VITE_KEYCLOAK_CLIENT_ID=control-plane-ui

# Portal
VITE_PORTAL_API_URL=http://localhost:8000
VITE_PORTAL_KEYCLOAK_CLIENT_ID=stoa-portal
```

**Important**: The `KEYCLOAK_CLIENT_SECRET` is auto-generated during Keycloak startup. Leave it as-is for the first run — the init script will populate it.

## Step 2: Start the Stack

Start all services with a single command:

```bash
docker compose up -d
```

Docker Compose will:
1. Pull images for all services (~2GB total, first run only)
2. Create a Docker network (`stoa-network`)
3. Start PostgreSQL and wait for it to become healthy
4. Start Keycloak and run the realm import
5. Start the Control Plane API, Console UI, Portal, and Gateway

Monitor the startup logs:

```bash
docker compose logs -f
```

**Startup time**: 2-3 minutes. You'll see:
- PostgreSQL: `database system is ready to accept connections`
- Keycloak: `Keycloak 23.0.0 started in XXXXms`
- Control Plane API: `Uvicorn running on http://0.0.0.0:8000`
- Gateway: `stoa-gateway listening on 0.0.0.0:8080`

Press `Ctrl+C` to stop following logs (services continue running).

Verify all services are up:

```bash
docker compose ps
```

Expected output:

```
NAME                      STATUS    PORTS
stoa-control-plane-api    Up        0.0.0.0:8000->8000/tcp
stoa-control-plane-ui     Up        0.0.0.0:3000->3000/tcp
stoa-portal               Up        0.0.0.0:8080->8080/tcp
stoa-gateway              Up        0.0.0.0:8081->8080/tcp
keycloak                  Up        0.0.0.0:8443->8443/tcp
postgres                  Up        0.0.0.0:5432->5432/tcp
```

**Port mapping note**: The Gateway is mapped to `8081` on the host (not `8080`) to avoid conflicts with the Portal. Inside the Docker network, it listens on `8080`.

## Step 3: Access the Services

All services are now accessible on your local machine.

### Console UI (Admin Interface)

Open [http://localhost:3000](http://localhost:3000)

**Pre-configured users** (from Keycloak realm export):

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| `cpi-admin` | `admin` | CPI Admin | Full platform access (stoa:admin) |
| `tenant-admin` | `admin` | Tenant Admin | Own tenant only (stoa:write, stoa:read) |
| `devops` | `admin` | DevOps | Deploy/promote (stoa:write, stoa:read) |
| `viewer` | `admin` | Viewer | Read-only (stoa:read) |

Log in as `cpi-admin` / `admin` to access all features.

### Developer Portal (Self-Service)

Open [http://localhost:8080](http://localhost:8080)

The Portal is where API consumers discover available APIs, view documentation, create applications, and generate API keys. No login required for browsing; authentication required for subscriptions.

### Control Plane API (REST API)

Base URL: [http://localhost:8000](http://localhost:8000)

Interactive docs:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

Health check:

```bash
curl http://localhost:8000/health
# {"status":"healthy","version":"0.1.0"}
```

### MCP Gateway

Base URL: [http://localhost:8081](http://localhost:8081)

Health check:

```bash
curl http://localhost:8081/health
# {"status":"healthy","mode":"edge-mcp"}
```

The Gateway runs in `edge-mcp` mode by default, which means it's optimized for AI agent integrations via the MCP protocol. For more on MCP Gateway setup, see our [MCP Gateway Quickstart](/blog/mcp-gateway-quickstart-docker).

### Keycloak (Auth Provider)

Admin Console: [https://localhost:8443/admin](https://localhost:8443/admin)

**Credentials**: `admin` / `admin` (pre-configured in realm export)

The STOA realm is pre-imported with:
- 4 roles: `cpi-admin`, `tenant-admin`, `devops`, `viewer`
- 4 test users (passwords all `admin`)
- 3 clients: `control-plane-api`, `control-plane-ui`, `stoa-portal`
- Scopes: `stoa:read`, `stoa:write`, `stoa:admin`

**Note**: Keycloak uses a self-signed certificate for HTTPS. Your browser will show a security warning. Click "Advanced" and proceed anyway for local development.

### PostgreSQL

Connection string:

```
postgresql://stoa:stoa@localhost:5432/stoa
```

Connect with `psql`:

```bash
docker compose exec postgres psql -U stoa -d stoa
```

## Step 4: Create Your First API

Let's create an API using the Console UI and test it through the Gateway.

### Via Console UI (Recommended)

1. Open [http://localhost:3000](http://localhost:3000)
2. Log in as `cpi-admin` / `admin`
3. Navigate to **APIs** → **Create API**
4. Fill in the form:
   - **Name**: `httpbin-test`
   - **Display Name**: HTTPBin Test API
   - **Description**: Test API using httpbin.org
   - **Base Path**: `/httpbin`
   - **Backend URL**: `https://httpbin.org`
   - **Gateway Instance**: `local-gateway` (auto-created on startup)
5. Click **Create**

The API is now synced to the Gateway. Test it:

```bash
curl http://localhost:8081/httpbin/get
```

You should see a JSON response from httpbin.org, proxied through the STOA Gateway.

### Via REST API

If you prefer the command line, use the Control Plane API directly:

```bash
# Get an access token
ACCESS_TOKEN=$(curl -s -X POST "https://localhost:8443/realms/stoa/protocol/openid-connect/token" \
  --insecure \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=cpi-admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=control-plane-api" \
  | jq -r '.access_token')

# Create the API
curl -X POST "http://localhost:8000/v1/apis" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "httpbin-test",
    "display_name": "HTTPBin Test API",
    "description": "Test API using httpbin.org",
    "base_path": "/httpbin",
    "backend_url": "https://httpbin.org",
    "gateway_instance_id": "local-gateway"
  }'
```

For a more detailed walkthrough of API creation and configuration, see our [5-Minute First API Guide](/blog/stoa-quickstart-first-api-5-minutes).

## Step 5: Test MCP Tools

STOA Gateway exposes APIs as MCP tools that AI agents can discover and invoke. Let's verify the MCP integration.

### List Available Tools

```bash
curl http://localhost:8081/mcp/tools
```

Response:

```json
{
  "tools": [
    {
      "name": "httpbin_test_get",
      "description": "HTTPBin Test API - GET /httpbin/get",
      "inputSchema": {
        "type": "object",
        "properties": {}
      }
    }
  ]
}
```

Each API endpoint you create is automatically exposed as an MCP tool with a generated name pattern: `{api_name}_{method}_{path}`.

### Invoke a Tool

```bash
curl -X POST "http://localhost:8081/mcp/tools/httpbin_test_get/call" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {}
  }'
```

The Gateway will proxy the request to `https://httpbin.org/get` and return the response.

### Connect to Claude Desktop

To use STOA Gateway with Claude Desktop (or any MCP-compatible client):

1. Add this configuration to your MCP settings:

```json
{
  "mcpServers": {
    "stoa-local": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": {
        "MCP_SERVER_URL": "http://localhost:8081/mcp"
      }
    }
  }
}
```

2. Restart Claude Desktop
3. You'll now see STOA tools in the tool palette

For a complete guide to MCP integration, including OAuth 2.1 authentication for production deployments, see our [MCP Gateway documentation](/docs/guides/quickstart).

## Customization

### Environment Variables

Edit `.env` to customize the stack. Common changes:

**Change ports** (if defaults conflict with other services):

```bash
API_PORT=9000
CONSOLE_PORT=4000
PORTAL_PORT=9080
GATEWAY_PORT=9081
```

**Enable debug logging**:

```bash
LOG_LEVEL=DEBUG
RUST_LOG=debug
```

**Configure CORS** (for external frontend development):

```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

**Database connection pool**:

```bash
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
```

After changing `.env`, restart the stack:

```bash
docker compose down
docker compose up -d
```

### Persistent Data

By default, PostgreSQL data is stored in a Docker volume (`stoa-postgres-data`). This persists across container restarts.

To reset the database to a clean state:

```bash
docker compose down -v  # -v removes volumes
docker compose up -d
```

**Warning**: This deletes all APIs, policies, and applications you've created.

### Custom Keycloak Realm

The default realm (`keycloak/realm-export.json`) includes test users with the password `admin`. For production-like local testing, you can:

1. Import a custom realm: place your `realm.json` in `keycloak/` and update `docker-compose.yml`:

```yaml
keycloak:
  environment:
    KEYCLOAK_IMPORT: /opt/keycloak/data/import/my-realm.json
  volumes:
    - ./keycloak/my-realm.json:/opt/keycloak/data/import/my-realm.json
```

2. Or configure Keycloak manually via the Admin Console and export the realm for reuse.

### Multiple Gateway Instances

To simulate a multi-gateway deployment (e.g., edge + sidecar modes), add another gateway service:

```yaml
stoa-gateway-sidecar:
  image: ghcr.io/stoa-platform/stoa-gateway:latest
  container_name: stoa-gateway-sidecar
  ports:
    - "8082:8080"
  environment:
    MODE: sidecar
    CONTROL_PLANE_API_URL: http://control-plane-api:8000
    GATEWAY_API_KEY: ${STOA_CONTROL_PLANE_API_KEY}
  networks:
    - stoa-network
```

Register the sidecar gateway in the Console UI under **Gateway Instances** → **Register Gateway**.

## Troubleshooting

### Services Won't Start

**Symptom**: `docker compose up -d` exits with errors.

**Causes**:
1. **Port conflicts** — another service is using 3000, 8000, 8080, or 8443
2. **Insufficient memory** — Docker Desktop allocates less than 8 GB RAM
3. **Disk space** — Docker has less than 10 GB free

**Fix**:
```bash
# Check port usage
lsof -i :3000
lsof -i :8000

# Free up Docker disk space
docker system prune -a --volumes

# Increase Docker Desktop memory (Settings → Resources → Memory → 12GB)
```

### Keycloak Certificate Warning

**Symptom**: Browser shows "Your connection is not private" when accessing `https://localhost:8443`.

**Cause**: Keycloak uses a self-signed certificate for local development.

**Fix**: Click "Advanced" → "Proceed to localhost (unsafe)". This is safe for local development. For production, configure a real certificate.

### Control Plane API Returns 500

**Symptom**: API requests return `{"detail": "Internal server error"}`.

**Cause**: Database connection failed or migration not applied.

**Debug**:
```bash
# Check API logs
docker compose logs control-plane-api

# Common errors:
# - "connection refused" → PostgreSQL not ready (wait 30s and retry)
# - "relation does not exist" → migrations not applied

# Manually run migrations
docker compose exec control-plane-api alembic upgrade head
```

### Gateway Returns 404 for API Routes

**Symptom**: `curl http://localhost:8081/httpbin/get` returns 404.

**Cause**: API not synced to Gateway.

**Fix**:
1. Check API exists: `curl http://localhost:8000/v1/apis`
2. Force re-sync: Edit the API in Console UI and save (no changes needed)
3. Verify Gateway config: `docker compose logs stoa-gateway | grep "Synced"`

### MCP Tools Not Appearing

**Symptom**: `curl http://localhost:8081/mcp/tools` returns empty `tools` array.

**Cause**: No APIs created yet, or APIs have `enabled: false`.

**Fix**:
1. Create an API via Console UI (Step 4)
2. Ensure the API status is "Active"
3. Restart Gateway: `docker compose restart stoa-gateway`

### Docker Compose Syntax Error

**Symptom**: `services.xxx Additional property yyy is not allowed`.

**Cause**: Using `docker-compose` (v1) syntax with a v2 compose file.

**Fix**: Upgrade to Docker Compose v2 (`docker compose` with space, not hyphen). Or edit `docker-compose.yml` to be v1-compatible (not recommended).

## Next Steps

Now that you have STOA running locally, explore these guides:

- **[GitOps in 10 Minutes](/blog/gitops-in-10-minutes)** — manage APIs as code using GitOps workflows
- **[stoactl CLI Guide](/blog/stoactl-cli-manage-apis-terminal)** — manage APIs from the terminal with kubectl-style commands
- **[Open Source API Gateway 2026](/blog/open-source-api-gateway-2026)** — architecture deep-dive and design principles
- **[Quick Start Guide](/docs/guides/quickstart)** — comprehensive documentation for production deployments
- **[Configuration Reference](/docs/reference/configuration)** — all environment variables and settings explained

For production deployment to Kubernetes, see our [Installation Guide](/docs/admin/installation) with Helm charts and ArgoCD examples.

## FAQ

### Can I use this setup for production?

**No.** This Docker Compose stack is designed for local development and testing only. It uses:
- Self-signed certificates
- Default credentials (`admin` / `admin`)
- Single-replica services (no high availability)
- Embedded PostgreSQL (not production-grade)

For production, deploy to Kubernetes using our [Helm charts](https://github.com/stoa-platform/stoa/tree/main/charts/stoa-platform). This gives you:
- Multi-replica deployments with auto-scaling
- Managed databases (RDS, Cloud SQL, etc.)
- Let's Encrypt certificates via cert-manager
- ArgoCD for GitOps-based continuous deployment

### How do I update to the latest version?

Pull the latest images and restart:

```bash
docker compose pull
docker compose up -d
```

Docker Compose will recreate containers with the new images while preserving your data volumes (PostgreSQL, Keycloak).

**Note**: Major version upgrades may require database migrations. Check the [CHANGELOG](https://github.com/stoa-platform/stoa-quickstart/blob/main/CHANGELOG.md) before upgrading.

### Can I connect external services to this stack?

**Yes.** All services are accessible from the host machine:

- **External frontend** (React, Vue, etc.) → set `VITE_API_URL=http://localhost:8000` in your app's `.env`
- **External CLI** → `stoactl configure --api-url http://localhost:8000`
- **Postman/Insomnia** → import the OpenAPI spec from `http://localhost:8000/openapi.json`

For AI agents (Claude Desktop, ChatGPT plugins), configure the MCP Gateway URL as `http://localhost:8081/mcp`.

**Limitation**: Services inside other Docker Compose stacks cannot reach this stack by hostname (`control-plane-api` won't resolve). Use `host.docker.internal` as a bridge on Mac/Windows, or join the same Docker network.

