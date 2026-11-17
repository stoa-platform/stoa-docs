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

- **Go 1.25+** (or **Docker** for container builds) to compile `stoa-connect` from [`stoa-platform/stoa/stoa-go`](https://github.com/stoa-platform/stoa/tree/main/stoa-go)
- A running Kong, Gravitee, or webMethods gateway with its admin API accessible locally (or upstream Envoy for loopback ADS mode)
- Reachable STOA Control Plane API and Console endpoints (`${STOA_API_URL}`, `${STOA_CONSOLE_URL}`)
- A **Gateway API Key** created in the STOA Console (Settings → Gateways → New Key)

## Step 1 — Install stoa-connect

:::warning Build from the monorepo checkout
Do **not** use `get.gostoa.dev/connect`, `brew install stoa-platform/tap/stoa-connect`, `go install github.com/stoa-platform/stoa-connect@latest`, or floating `:latest` tags. Monorepo GitHub Releases `stoa-go-v0.3.9` and `stoa-go-v0.3.10` publish **zero binary assets**; build the binary or container image from a verified checkout of `stoa-platform/stoa`.
:::

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="go-tag" label="Go build (stoa-go-v0.3.10)">

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa
git checkout stoa-go-v0.3.10
cd stoa-go
go build -ldflags "-s -w -X main.Version=0.3.10 -X main.Commit=$(git rev-parse --short HEAD)" \
  -o ./bin/stoa-connect ./cmd/stoa-connect
sudo install -m 0755 ./bin/stoa-connect /usr/local/bin/stoa-connect
```

</TabItem>
<TabItem value="go-main" label="Go build (main 639e8b9a)">

```bash
# Required when using post-May-2026 features such as Envoy loopback ADS mode
git clone https://github.com/stoa-platform/stoa.git
cd stoa
git checkout 639e8b9a2217695cfc2f590e246ed9d4ce4d4913
cd stoa-go
go build -ldflags "-s -w -X main.Version=0.3.10-main -X main.Commit=639e8b9a" \
  -o ./bin/stoa-connect ./cmd/stoa-connect
sudo install -m 0755 ./bin/stoa-connect /usr/local/bin/stoa-connect
```

</TabItem>
<TabItem value="docker" label="Docker (Dockerfile.connect)">

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa
git checkout 639e8b9a2217695cfc2f590e246ed9d4ce4d4913
cd stoa-go
docker build -f Dockerfile.connect -t stoa-connect:639e8b9a .
```

</TabItem>
</Tabs>

Confirm the compiled binary is on `PATH` (do **not** run `stoa-connect --version` — `cmd/stoa-connect/main.go` parses no CLI flags and immediately starts the HTTP listener on `:8090`; verify the running version via `GET /health` in Step 4):

```bash
command -v stoa-connect
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
  stoa-connect:639e8b9a
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

## Companion versus stoa-connect

`stoa-connect` is the GitOps path for a third-party gateway. It syncs desired state to the gateway admin API (webMethods, Kong, Gravitee, and Envoy adapters in the `stoa` repository) and stays off the client request path.

The companion is a different integration. The same Rust binary, with `STOA_GATEWAY_MODE=sidecar`, answers `POST /authz` for a host in the same pod or for an application callout. The host keeps authentication, routing, and enforcement. That path is not a recorded live Kong or webMethods demo. Mesh adapters are design notes. See [Companion usage](./companion-usage.md).

## Next Steps

- **Multi-Gateway Setup** — manage multiple gateways from a single Control Plane (coming soon)
- **Gateway Auto-Registration** — native STOA gateway registration without an agent (coming soon)
- **OPA Policies** — write policies that stoa-connect will sync to your gateway (coming soon)
