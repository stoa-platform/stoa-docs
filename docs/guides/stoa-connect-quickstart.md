---
sidebar_position: 3
slug: /guides/stoa-connect-quickstart
title: "Connect a Third-Party Gateway with stoa-connect"
description: "Install and configure stoa-connect to link Kong, Gravitee, or webMethods to the STOA Control Plane — API discovery, policy sync, and heartbeat in under 10 minutes."
keywords: [stoa-connect, kong, gravitee, webmethods, hybrid gateway, control plane, api discovery, policy sync]
---

# Connect a Third-Party Gateway with stoa-connect

`stoa-connect` is a lightweight Go agent that runs alongside your existing API gateway (Kong, Gravitee, or webMethods) and connects it to the STOA Control Plane — no gateway replacement required.

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
</Tabs>

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STOA_CONTROL_PLANE_URL` | Yes | — | Control Plane API base URL |
| `STOA_GATEWAY_API_KEY` | Yes | — | `X-Gateway-Key` for CP authentication |
| `STOA_GATEWAY_TYPE` | Yes | `auto` | `kong`, `gravitee`, or `webmethods` |
| `STOA_GATEWAY_ADMIN_URL` | Yes | — | Local gateway admin API URL |
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

`stoactl connect` provides three subcommands for day-to-day operations:

```bash
# Show agent status and connectivity
stoactl connect status --url http://localhost:8090

# Trigger an immediate API discovery (instead of waiting 60s)
stoactl connect discover --admin-url http://localhost:8001

# Force a policy sync from the Control Plane
stoactl connect sync --url http://localhost:8090
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `UNAUTHORIZED` on startup | Invalid or expired `STOA_GATEWAY_API_KEY` | Regenerate the key in Console → Settings → Gateways |
| Gateway stays OFFLINE in Console | Heartbeat not reaching CP | Check firewall rules allow outbound HTTPS to `${STOA_API_URL}` |
| 0 APIs discovered | Wrong `STOA_GATEWAY_ADMIN_URL` | Verify with `curl ${STOA_GATEWAY_ADMIN_URL}/health` |
| Policy sync fails | Admin credentials rejected | Check `STOA_GATEWAY_ADMIN_TOKEN` / `USER` / `PASSWORD` |

For structured logs, set `LOG_LEVEL=debug` before starting the agent.

---

## Next Steps

- [Multi-Gateway Setup](./multi-gateway-setup.md) — manage multiple gateways from a single Control Plane
- [Gateway Auto-Registration](./gateway-auto-registration.md) — native STOA gateway registration without an agent
- [OPA Policies](./opa-policies.md) — write policies that stoa-connect will sync to your gateway
