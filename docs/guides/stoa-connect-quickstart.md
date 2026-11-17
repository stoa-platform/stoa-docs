---
sidebar_position: 3
slug: /guides/stoa-connect-quickstart
title: "Connect a Third-Party Gateway with stoa-connect"
description: "Install and configure stoa-connect to link Kong, Gravitee, or webMethods to the STOA Control Plane — API discovery, policy sync, and heartbeat in under 10 minutes."
keywords: [stoa-connect, kong, gravitee, webmethods, hybrid gateway, control plane, api discovery, policy sync]
---

# Connect a Third-Party Gateway with stoa-connect

`stoa-connect` (**STOA Link**, unified under [ADR-057](/docs/architecture/adr/adr-057-product-lineup-gateway-link-connect) and [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) is the lightweight Go on-site agent that runs alongside your existing API gateway (Kong, Gravitee, or webMethods) or serves loopback mTLS xDS ADS to upstream Envoy — connecting your data plane to the STOA Control Plane over outbound HTTPS/SSE.

## What You'll Accomplish

By the end of this guide, your third-party gateway will:

- Appear in the STOA Console under **Gateways**
- Expose its APIs in the Control Plane inventory (auto-discovered every 60 seconds)
- Receive policies pushed from STOA automatically
- Send heartbeats every 30 seconds so the Console shows live health

## Architecture

```
VPS / On-Premise
┌─────────────────────────────────────────┐
│  Third-Party Gateway (Kong/Gravitee/wM) │
│  ← admin API ─────────────────────┐     │
│                                    │     │
│  stoa-connect agent ──────────────┘     │
│  (Go binary, port 8090)                 │
│     ├── register with CP                │
│     ├── heartbeat 30s                   │
│     ├── discover APIs 60s               │
│     └── sync policies 60s              │
└──────────────────┬──────────────────────┘
                   │ HTTPS (X-Gateway-Key)
                   ▼
         STOA Control Plane
         (${STOA_API_URL})
```

## Prerequisites

- A running Kong, Gravitee, or webMethods gateway with its admin API accessible locally
- A STOA account at [console.gostoa.dev](https://console.gostoa.dev)
- A **Gateway API Key** from the STOA Console (Settings → Gateways → New Key)

## Step 1 — Install stoa-connect

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="linux" label="Linux (amd64)">

```bash
curl -sSL https://get.gostoa.dev/connect | sh
```

</TabItem>
<TabItem value="macos" label="macOS (Homebrew)">

```bash
brew install stoa-platform/tap/stoa-connect
```

</TabItem>
<TabItem value="docker" label="Docker">

```bash
docker pull ghcr.io/stoa-platform/stoa-connect:latest
```

</TabItem>
<TabItem value="go" label="From source (Go 1.22+)">

```bash
go install github.com/stoa-platform/stoa-connect@latest
```

</TabItem>
</Tabs>

Verify the installation:

```bash
stoa-connect --version
```

---

## Step 2 — Configure

Create a `.env` file (or export the variables into your shell / systemd unit):

<Tabs>
<TabItem value="kong" label="Kong">

```bash
# Control Plane connection
export STOA_CONTROL_PLANE_URL="${STOA_API_URL}"
export STOA_GATEWAY_API_KEY="gw_your_key_here"
export STOA_INSTANCE_NAME="kong-prod-01"    # auto-detected from hostname if omitted
export STOA_ENVIRONMENT="production"

# Gateway admin API
export STOA_GATEWAY_TYPE="kong"
export STOA_GATEWAY_ADMIN_URL="http://localhost:8001"
export STOA_GATEWAY_ADMIN_TOKEN="your-kong-admin-token"
```

</TabItem>
<TabItem value="gravitee" label="Gravitee">

```bash
export STOA_CONTROL_PLANE_URL="${STOA_API_URL}"
export STOA_GATEWAY_API_KEY="gw_your_key_here"
export STOA_INSTANCE_NAME="gravitee-prod-01"
export STOA_ENVIRONMENT="production"

export STOA_GATEWAY_TYPE="gravitee"
export STOA_GATEWAY_ADMIN_URL="http://localhost:8083"
export STOA_GATEWAY_ADMIN_USER="admin"
export STOA_GATEWAY_ADMIN_PASSWORD="your-gravitee-password"
```

</TabItem>
<TabItem value="webmethods" label="webMethods">

```bash
export STOA_CONTROL_PLANE_URL="${STOA_API_URL}"
export STOA_GATEWAY_API_KEY="gw_your_key_here"
export STOA_INSTANCE_NAME="webmethods-prod-01"
export STOA_ENVIRONMENT="production"

export STOA_GATEWAY_TYPE="webmethods"
export STOA_GATEWAY_ADMIN_URL="http://localhost:5555"
export STOA_GATEWAY_ADMIN_USER="Administrator"
export STOA_GATEWAY_ADMIN_PASSWORD="your-webmethods-password"
```

</TabItem>
<TabItem value="envoy" label="Envoy (xDS ADS)">

```bash
export STOA_CONTROL_PLANE_URL="${STOA_API_URL}"
export STOA_GATEWAY_API_KEY="gw_your_key_here"
export STOA_INSTANCE_NAME="envoy-prod-01"
export STOA_ENVIRONMENT="production"

# Explicit selection required (auto-detection never selects envoy; no admin URL needed)
export STOA_GATEWAY_TYPE="envoy"
export STOA_ENVOY_ADS_ADDR="127.0.0.1:18000"   # loopback IP literal only
export STOA_ENVOY_NODE_URI="spiffe://example.internal/envoy/prod-01"
export STOA_ENVOY_TLS_CERT="/etc/stoa-connect/tls/ads-server.crt"
export STOA_ENVOY_TLS_KEY="/etc/stoa-connect/tls/ads-server.key"
export STOA_ENVOY_CLIENT_CA="/etc/stoa-connect/tls/envoy-client-ca.crt"
export STOA_ENVOY_LISTENER_PORT="10000"
export STOA_ENVOY_AUTH_ADDR="127.0.0.1:9001"   # fail-closed gRPC ExtAuthzService
```

</TabItem>
</Tabs>

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STOA_CONTROL_PLANE_URL` | Yes | — | Control Plane API base URL |
| `STOA_GATEWAY_API_KEY` | Yes | — | `X-Gateway-Key` for CP authentication |
| `STOA_GATEWAY_TYPE` | Yes | `auto` | `kong`, `gravitee`, `webmethods`, `auto`, or `envoy` (`envoy` must be set explicitly) |
| `STOA_GATEWAY_ADMIN_URL` | Admin-API modes | — | Local gateway admin API URL (unused when `STOA_GATEWAY_TYPE=envoy`) |
| `STOA_ENVOY_ADS_ADDR` | Envoy mode | `127.0.0.1:18000` | Loopback mTLS ADS bind address (loopback IP literals only) |
| `STOA_ENVOY_NODE_URI` | Envoy mode | — | Required URI SAN of the authorized Envoy client certificate |
| `STOA_ENVOY_TLS_CERT` / `KEY` / `CLIENT_CA` | Envoy mode | — | Server certificate/key and mandatory mTLS client CA bundle |
| `STOA_ENVOY_LISTENER_PORT` | Envoy mode | — | Generated loopback HTTP listener port on Envoy |
| `STOA_ENVOY_AUTH_ADDR` | Envoy mode | — | `host:port` of the fail-closed gRPC `ExtAuthzService` (`stoa-gateway`) |
| `STOA_INSTANCE_NAME` | No | hostname | Identifier shown in the Console |
| `STOA_ENVIRONMENT` | No | `production` | Environment label |
| `STOA_HEARTBEAT_INTERVAL` | No | `30s` | Heartbeat frequency |
| `STOA_CONNECT_PORT` | No | `8090` | Local HTTP port for the agent |

---

## Step 3 — Run

<Tabs>
<TabItem value="binary" label="Binary">

```bash
stoa-connect
```

</TabItem>
<TabItem value="docker" label="Docker">

```bash
docker run -d \
  --name stoa-connect \
  --network host \
  --env-file .env \
  ghcr.io/stoa-platform/stoa-connect:latest
```

</TabItem>
<TabItem value="systemd" label="systemd">

```ini
# /etc/systemd/system/stoa-connect.service
[Unit]
Description=STOA Connect Agent
After=network.target

[Service]
EnvironmentFile=/etc/stoa-connect/env
ExecStart=/usr/local/bin/stoa-connect
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now stoa-connect
```

</TabItem>
</Tabs>

On startup, `stoa-connect` will:

1. Register the gateway with the Control Plane (`POST /v1/internal/gateways/register`)
2. Discover APIs from the local gateway admin API
3. Start the heartbeat loop (every 30 seconds)
4. Begin policy sync (every 60 seconds)

---

## Step 4 — Verify

Check the agent is healthy:

```bash
# Check agent health (replace URL with your agent's address)
curl -s http://localhost:8090/health | jq
```

Expected output:

```json
{
  "status": "ok",
  "version": "0.3.0",
  "gateway_id": "a1b2c3d4-...",
  "discovered_apis": 12
}
```

Or use the CLI:

```bash
stoactl connect status --url http://localhost:8090
```

Confirm the gateway appears in the Console at [console.gostoa.dev](https://console.gostoa.dev) under **Gateways**. The status indicator should be green within 30 seconds.

---

## CLI Reference

`stoactl connect` provides three subcommands for operator diagnostics:

```bash
# Show agent status and connectivity (:8090/health)
stoactl connect status --url http://localhost:8090

# Discover APIs directly on an admin-API gateway (kong | gravitee | webmethods | auto)
stoactl connect discover --admin-url http://localhost:8001 --type kong

# Send a sync trigger request (POST /sync)
stoactl connect sync --url http://localhost:8090
```

:::note Envoy xDS mode & `/sync` endpoint boundaries
- **Discovery (`stoactl connect discover`)** talks directly to a third-party gateway's admin API (`kong`, `gravitee`, `webmethods`, or `auto`). In **Envoy** mode (`STOA_GATEWAY_TYPE=envoy`), `stoa-connect` serves loopback mTLS xDS ADS from Control Plane state; `Discover` returns `UnsupportedError` and is skipped automatically.
- **Manual sync (`stoactl connect sync`)** sends `POST <url>/sync`. On current `main`, `cmd/stoa-connect/main.go` mounts `/health`, `/metrics`, and `/webhook/events`; policy and route updates are reconciled automatically via the agent's outbound SSE stream and sync loop.
:::

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `UNAUTHORIZED` on startup | Invalid or expired `STOA_GATEWAY_API_KEY` | Regenerate the key in Console → Settings → Gateways |
| Gateway stays OFFLINE in Console | Heartbeat not reaching CP | Check firewall rules allow outbound HTTPS to `${STOA_API_URL}` |
| 0 APIs discovered | Wrong `STOA_GATEWAY_ADMIN_URL` (or running in Envoy mode) | Verify with `curl ${STOA_GATEWAY_ADMIN_URL}/health` (Envoy mode skips discovery by design) |
| Policy sync fails | Admin credentials rejected or unsupported Envoy policy | Check `STOA_GATEWAY_ADMIN_*` credentials; in Envoy mode v1 only `cors`, `rate_limit`, and `ip_filter` are translated |

For structured logs, set `LOG_LEVEL=debug` before starting the agent.

---

## Companion versus stoa-connect

`stoa-connect` (**STOA Link**) is the control-plane synchronization and xDS agent. It syncs desired state to third-party gateway admin APIs (webMethods, Kong, Gravitee) or serves loopback mTLS ADS to upstream Envoy ([Data Plane Architecture](/docs/architecture/data-plane)), staying off the HTTP request payload path.

The companion is a different integration. The Rust `stoa-gateway` binary, started with `STOA_GATEWAY_MODE=sidecar`, answers HTTP `POST /authz` for a host in the same pod or for an application callout (while `STOA_EXT_AUTHZ_GRPC_ADDR` exposes the native Envoy gRPC `ExtAuthzService`). See [Companion usage](./companion-usage.md).

## Next Steps

- [Multi-Gateway Setup](/docs/guides/multi-gateway-setup) — Orchestrate multiple gateways from a single Control Plane
- [Gateway Auto-Registration](/docs/guides/gateway-auto-registration) — Zero-config gateway registration and heartbeats
- [OPA Policies](/docs/guides/opa-policies) — Author governance policies synchronized across gateways
