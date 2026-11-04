---
sidebar_position: 1
slug: /guides/quickstart
title: "Quickstart: Run STOA Locally"
description: "Prepare the local STOA stack with Docker Compose and configure the required credentials."
---

# Quickstart: Run STOA Locally

**Sovereign iPaaS — API & integration platform**

This is the local evaluation path for STOA, using the main [stoa repository](https://github.com/stoa-platform/stoa/tree/main/deploy/docker-compose). It includes the Console, Developer Portal, API, gateway, identity service and observability dependencies. Hosted access is **available on request** through [our team](mailto:sales@gostoa.dev).

:::info Validation scope
The Compose configuration was validated statically with `docker compose config --quiet`. No containers were started. Startup, sign-in, data seeding and a first API call still require runtime verification; no startup duration is promised.
:::

## Prerequisites

- Git, Docker and Docker Compose v2.
- A dedicated local Docker environment with enough resources for the full stack.
- Available ports and no existing containers using the names declared by the Compose file. A project name alone does not isolate fixed container names. Resolve collisions before starting; do not stop or recreate another installation.

## 1. Prepare the configuration

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa/deploy/docker-compose
cp .env.example .env
```

Edit `.env` locally before continuing. Replace the supplied credential values with your own; do not publish or commit this file. These variables are required by Compose, including the OpenSearch initialization services:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | PostgreSQL authentication. |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak administration. |
| `OPENSEARCH_ADMIN_PASSWORD` | OpenSearch administration and security initialization. |
| `OPENSEARCH_DASHBOARDS_PASSWORD` | OpenSearch Dashboards service account. |
| `OPENSEARCH_LOGWRITER_PASSWORD` | OpenSearch ingestion account. |
| `OPENSEARCH_OIDC_CLIENT_SECRET` | OpenSearch Dashboards identity client. |

Also configure `GRAFANA_PASSWORD` and `GRAFANA_OIDC_CLIENT_SECRET` for Grafana access. Set `OPENSEARCH_PASSWORD` consistently with `OPENSEARCH_ADMIN_PASSWORD` for API access to OpenSearch. Set `GATEWAY_ADMIN_TOKEN` and `GATEWAY_API_KEY` consistently for any gateway administration workflow. Optional identity profiles require their own credentials and are outside this quickstart.

Validate without starting services:

```bash
docker compose -p stoa-local-check -f docker-compose.yml config --quiet
```

An error naming a variable means it must be configured before proceeding. This check validates configuration only, not image availability, port availability or application health.

## 2. Start the local stack

After resolving local conflicts, start this explicit service set and its dependencies:

```bash
docker compose up -d nginx redpanda-init opensearch-init data-prepper tempo
```

This selects the application stack and its observability dependencies without starting Promtail or optional federation services. Do not replace it with an unqualified full-stack startup command. The separate `stoa-quickstart` repository is not an alternative path in this guide.

## 3. Check local access

Open the local reverse proxy in your browser: the Console is at `/`, the Developer Portal at `/portal`, API documentation at `/api/docs`, identity administration at `/auth`, Grafana at `/grafana`, and gateway health at `/gateway/health`. Use the host port configured by `PORT_PROXY`.

Demo data initialization has not yet been verified for this local path and remains pending.

## Register your own API {#register-your-own-api}

After sign-in works, use **Backend APIs** in the Console to register your backend. Continue with [MCP for Developers](/docs/guides/mcp-developer-guide) for agent access and [Subscription Lifecycle](/docs/guides/subscriptions-lifecycle) for subscriptions.

## Troubleshooting

| Problem | Action |
| --- | --- |
| Configuration validation fails | Check the variable named by Compose in your local `.env`. |
| Port or container-name collision | Use a dedicated environment; leave existing installations untouched. |
| Service unavailable after configuration validation | Check application readiness locally; static validation does not prove runtime health. |

## See also

- [Installation guide](/docs/deployment/hybrid)
- [MCP for Developers](/docs/guides/mcp-developer-guide)
